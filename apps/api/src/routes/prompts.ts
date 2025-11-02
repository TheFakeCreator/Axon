import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../utils/logger.js';

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
 * 
 * TODO: Integrate PromptOrchestrator once service dependencies are initialized
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

    // TODO: Initialize and use PromptOrchestrator here
    // For MVP, return placeholder response
    
    if (stream) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Placeholder streaming response
      res.write(`data: ${JSON.stringify({
        type: 'start',
        requestId: 'mock-request-id',
      })}\n\n`);

      res.write(`data: ${JSON.stringify({
        type: 'content',
        content: 'Middleware integration coming soon. This is a placeholder response.',
      })}\n\n`);

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming response
      res.json({
        success: true,
        data: {
          requestId: 'mock-request-id',
          response: {
            content: 'Middleware integration coming soon. This is a placeholder response.',
          },
          metadata: {
            tokensUsed: 0,
            latency: {
              total: 0,
            },
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
