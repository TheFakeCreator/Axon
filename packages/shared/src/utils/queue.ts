/**
 * BullMQ-based job queue utilities for async processing
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from './logger';

/**
 * Job types for different async operations
 */
export enum JobType {
  CONTEXT_EVOLUTION = 'context-evolution',
  EMBEDDING_GENERATION = 'embedding-generation',
  WORKSPACE_SCAN = 'workspace-scan',
  QUALITY_GATE = 'quality-gate',
  CONTEXT_SUMMARIZATION = 'context-summarization',
  BATCH_INDEXING = 'batch-indexing',
}

/**
 * Job priority levels
 */
export enum JobPriority {
  LOW = 10,
  NORMAL = 5,
  HIGH = 1,
  CRITICAL = 0,
}

/**
 * Job data for context evolution
 */
export interface ContextEvolutionJobData {
  interactionId: string;
  workspaceId: string;
  feedback?: {
    accepted: boolean;
    corrections?: string[];
  };
}

/**
 * Job data for embedding generation
 */
export interface EmbeddingJobData {
  texts: string[];
  contextIds: string[];
  workspaceId: string;
}

/**
 * Job data for workspace scanning
 */
export interface WorkspaceScanJobData {
  workspaceId: string;
  path: string;
  fullScan?: boolean;
}

/**
 * Job data for quality gate execution
 */
export interface QualityGateJobData {
  workspaceId: string;
  changedFiles: string[];
  testCommand?: string;
  lintCommand?: string;
}

/**
 * Generic job data type
 */
export type JobData =
  | ContextEvolutionJobData
  | EmbeddingJobData
  | WorkspaceScanJobData
  | QualityGateJobData
  | Record<string, unknown>;

/**
 * Job processor function type
 */
export type JobProcessor<T = JobData> = (job: Job<T>) => Promise<unknown>;

/**
 * Queue service configuration
 */
export interface QueueServiceConfig {
  redis: Redis;
  queuePrefix?: string;
  defaultJobOptions?: JobsOptions;
}

/**
 * Queue service for managing async jobs
 */
export class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private redis: Redis;
  private queuePrefix: string;
  private defaultJobOptions: JobsOptions;

  constructor(config: QueueServiceConfig) {
    this.redis = config.redis;
    this.queuePrefix = config.queuePrefix || 'axon';
    this.defaultJobOptions = config.defaultJobOptions || {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
      },
    };
  }

  /**
   * Create or get a queue
   */
  private getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.redis,
        prefix: this.queuePrefix,
      });

      this.queues.set(name, queue);
      logger.info('Queue created', { name });

      // Set up queue events
      const queueEvents = new QueueEvents(name, {
        connection: this.redis,
        prefix: this.queuePrefix,
      });

      queueEvents.on('completed', ({ jobId }) => {
        logger.debug('Job completed', { queue: name, jobId });
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        logger.error('Job failed', { queue: name, jobId, failedReason });
      });

      queueEvents.on('progress', ({ jobId, data }) => {
        logger.debug('Job progress', { queue: name, jobId, progress: data });
      });

      this.queueEvents.set(name, queueEvents);
    }

    return this.queues.get(name)!;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T = JobData>(
    queueName: string,
    jobType: JobType | string,
    data: T,
    options?: JobsOptions
  ): Promise<Job<T>> {
    try {
      const queue = this.getQueue(queueName);
      const mergedOptions = { ...this.defaultJobOptions, ...options };

      const job = await queue.add(jobType, data, mergedOptions);

      logger.info('Job added to queue', {
        queue: queueName,
        jobType,
        jobId: job.id,
        priority: mergedOptions.priority,
      });

      return job;
    } catch (error) {
      logger.error('Failed to add job to queue', { queueName, jobType, error });
      throw error;
    }
  }

  /**
   * Add multiple jobs to a queue
   */
  async addBulkJobs<T = JobData>(
    queueName: string,
    jobs: Array<{
      name: string;
      data: T;
      opts?: JobsOptions;
    }>
  ): Promise<Job<T>[]> {
    try {
      const queue = this.getQueue(queueName);
      const bulkJobs = jobs.map((job) => ({
        name: job.name,
        data: job.data,
        opts: { ...this.defaultJobOptions, ...job.opts },
      }));

      const addedJobs = await queue.addBulk(bulkJobs);

      logger.info('Bulk jobs added to queue', {
        queue: queueName,
        count: jobs.length,
      });

      return addedJobs;
    } catch (error) {
      logger.error('Failed to add bulk jobs to queue', { queueName, error });
      throw error;
    }
  }

  /**
   * Register a worker to process jobs
   */
  registerWorker<T = JobData>(
    queueName: string,
    processor: JobProcessor<T>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Worker<T> {
    if (this.workers.has(queueName)) {
      logger.warn('Worker already registered for queue', { queue: queueName });
      return this.workers.get(queueName) as Worker<T>;
    }

    const worker = new Worker<T>(
      queueName,
      async (job: Job<T>) => {
        logger.info('Processing job', {
          queue: queueName,
          jobId: job.id,
          jobName: job.name,
          attempt: job.attemptsMade + 1,
        });

        try {
          const result = await processor(job);
          logger.info('Job processed successfully', {
            queue: queueName,
            jobId: job.id,
          });
          return result;
        } catch (error) {
          logger.error('Job processing failed', {
            queue: queueName,
            jobId: job.id,
            error,
          });
          throw error;
        }
      },
      {
        connection: this.redis,
        prefix: this.queuePrefix,
        concurrency: options?.concurrency || 5,
        limiter: options?.limiter,
      }
    );

    worker.on('completed', (job) => {
      logger.info('Worker completed job', {
        queue: queueName,
        jobId: job.id,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Worker failed job', {
        queue: queueName,
        jobId: job?.id,
        error,
      });
    });

    worker.on('error', (error) => {
      logger.error('Worker error', { queue: queueName, error });
    });

    this.workers.set(queueName, worker as Worker);
    logger.info('Worker registered', {
      queue: queueName,
      concurrency: options?.concurrency || 5,
    });

    return worker;
  }

  /**
   * Get job by ID
   */
  async getJob<T = JobData>(queueName: string, jobId: string): Promise<Job<T> | null> {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);
      return job as Job<T> | null;
    } catch (error) {
      logger.error('Failed to get job', { queueName, jobId, error });
      return null;
    }
  }

  /**
   * Get job state
   */
  async getJobState(queueName: string, jobId: string): Promise<string | null> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (!job) return null;
      return await job.getState();
    } catch (error) {
      logger.error('Failed to get job state', { queueName, jobId, error });
      return null;
    }
  }

  /**
   * Get waiting jobs count
   */
  async getWaitingCount(queueName: string): Promise<number> {
    try {
      const queue = this.getQueue(queueName);
      return await queue.getWaitingCount();
    } catch (error) {
      logger.error('Failed to get waiting count', { queueName, error });
      return 0;
    }
  }

  /**
   * Get active jobs count
   */
  async getActiveCount(queueName: string): Promise<number> {
    try {
      const queue = this.getQueue(queueName);
      return await queue.getActiveCount();
    } catch (error) {
      logger.error('Failed to get active count', { queueName, error });
      return 0;
    }
  }

  /**
   * Get completed jobs count
   */
  async getCompletedCount(queueName: string): Promise<number> {
    try {
      const queue = this.getQueue(queueName);
      return await queue.getCompletedCount();
    } catch (error) {
      logger.error('Failed to get completed count', { queueName, error });
      return 0;
    }
  }

  /**
   * Get failed jobs count
   */
  async getFailedCount(queueName: string): Promise<number> {
    try {
      const queue = this.getQueue(queueName);
      return await queue.getFailedCount();
    } catch (error) {
      logger.error('Failed to get failed count', { queueName, error });
      return 0;
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
      logger.info('Queue paused', { queue: queueName });
    } catch (error) {
      logger.error('Failed to pause queue', { queueName, error });
      throw error;
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
      logger.info('Queue resumed', { queue: queueName });
    } catch (error) {
      logger.error('Failed to resume queue', { queueName, error });
      throw error;
    }
  }

  /**
   * Remove a job from queue
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.remove();
        logger.info('Job removed', { queue: queueName, jobId });
      }
    } catch (error) {
      logger.error('Failed to remove job', { queueName, jobId, error });
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.retry();
        logger.info('Job retried', { queue: queueName, jobId });
      }
    } catch (error) {
      logger.error('Failed to retry job', { queueName, jobId, error });
      throw error;
    }
  }

  /**
   * Clean old jobs from queue
   */
  async cleanQueue(
    queueName: string,
    grace: number = 86400000,
    status?: 'completed' | 'failed'
  ): Promise<string[]> {
    try {
      const queue = this.getQueue(queueName);
      const cleaned = await queue.clean(grace, 1000, status);
      logger.info('Queue cleaned', {
        queue: queueName,
        status,
        removed: cleaned.length,
      });
      return cleaned;
    } catch (error) {
      logger.error('Failed to clean queue', { queueName, error });
      return [];
    }
  }

  /**
   * Close a queue and its worker
   */
  async closeQueue(queueName: string): Promise<void> {
    try {
      const worker = this.workers.get(queueName);
      if (worker) {
        await worker.close();
        this.workers.delete(queueName);
        logger.info('Worker closed', { queue: queueName });
      }

      const queueEvents = this.queueEvents.get(queueName);
      if (queueEvents) {
        await queueEvents.close();
        this.queueEvents.delete(queueName);
      }

      const queue = this.queues.get(queueName);
      if (queue) {
        await queue.close();
        this.queues.delete(queueName);
        logger.info('Queue closed', { queue: queueName });
      }
    } catch (error) {
      logger.error('Failed to close queue', { queueName, error });
      throw error;
    }
  }

  /**
   * Close all queues and workers
   */
  async closeAll(): Promise<void> {
    try {
      const queueNames = Array.from(this.queues.keys());
      await Promise.all(queueNames.map((name) => this.closeQueue(name)));
      logger.info('All queues closed');
    } catch (error) {
      logger.error('Failed to close all queues', { error });
      throw error;
    }
  }

  /**
   * Health check - verify queue is operational
   */
  async healthCheck(queueName: string): Promise<boolean> {
    try {
      const queue = this.getQueue(queueName);
      await queue.getWaitingCount(); // Simple check to verify queue is accessible
      return true;
    } catch (error) {
      logger.error('Queue health check failed', { queueName, error });
      return false;
    }
  }
}
