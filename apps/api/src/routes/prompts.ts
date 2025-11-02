import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../utils/logger.js';
import { getServices } from '../services/index.js';

const router: Router = Router();

// Request validation schema
const processPromptSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
  workspaceId: z.string().uuid('Invalid workspace ID'),
  source: z.enum(['cli', 'api', 'editor', 'chat']).default('api'),
  metadata: z.object({
    fileName: z.string().optional(),
    language: z.string().optional(),
    cursorPosition: z.object({
      line: z.number(),
      column: z.number(),
    }).optional(),
  }).optional(),
  stream: z.boolean().default(false),
});

type ProcessPromptRequest = z.infer<typeof processPromptSchema>;

/**
 * POST /api/v1/prompts/process
 * Process a prompt with context injection
 */
router.post('/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validatedData = processPromptSchema.parse(req.body) as ProcessPromptRequest;
    
    const { prompt, workspaceId, source, metadata, stream } = validatedData;

    logger.info('Processing prompt', {
      workspaceId,
      promptLength: prompt.length,
      stream,
      source,
    });

    // Get the orchestrator service
    const { promptOrchestrator } = getServices();

    if (stream) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      try {
        // Use streaming orchestration
        const streamGenerator = promptOrchestrator.processStreaming({
          prompt,
          workspaceId,
          metadata,
        });

        // Send start event
        res.write(`data: ${JSON.stringify({
          type: 'start',
          requestId: 'streaming',
        })}\n\n`);

        for await (const chunk of streamGenerator) {
          // Send Server-Sent Event
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        // Send completion event
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        logger.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: {
            code: 'STREAMING_ERROR',
            message: error instanceof Error ? error.message : 'Streaming failed',
          },
        })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const result = await promptOrchestrator.process({
        prompt,
        workspaceId,
        metadata,
      });

      res.json({
        success: true,
        data: {
          requestId: result.requestId,
          response: result.llmResponse.content,
          metadata: {
            tokensUsed: result.llmResponse.usage.totalTokens,
            latency: result.latencyBreakdown,
            contextUsed: result.retrievedContexts.length,
            actions: result.processedResponse.actions,
          },
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, 'Validation error', 'VALIDATION_ERROR'));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/v1/prompts/history
 * Get prompt processing history (placeholder for MVP)
 */
router.get('/history', async (req: Request, res: Response) => {
  const { workspaceId, limit = 10, offset = 0 } = req.query;

  res.json({
    success: true,
    data: {
      interactions: [],
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: 0,
      },
    },
  });
});

export { router as promptRouter };
