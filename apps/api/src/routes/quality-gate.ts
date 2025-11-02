import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../utils/logger.js';
import { getServices } from '../services/index.js';

const router: Router = Router();

// Request validation schema
const executeQualityGateSchema = z.object({
  workspacePath: z.string().min(1, 'Workspace path is required'),
  checks: z.object({
    runTests: z.boolean().default(true),
    runLinting: z.boolean().default(true),
    runTypeCheck: z.boolean().default(true),
  }).optional(),
  parallel: z.boolean().default(true),
});

/**
 * POST /api/v1/quality-gate/execute
 * Execute quality gate checks
 */
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = executeQualityGateSchema.parse(req.body);
    const { workspacePath, checks, parallel } = validatedData;

    logger.info('Executing quality gate', { workspacePath, checks, parallel });

    // Create quality gate with custom config for this execution
    const { QualityGateOrchestrator } = await import('@axon/quality-gate');
    const qualityGate = new QualityGateOrchestrator({
      workingDirectory: workspacePath,
      skipTests: !(checks?.runTests ?? true),
      skipLinting: !(checks?.runLinting ?? true),
      skipTypeCheck: !(checks?.runTypeCheck ?? true),
      parallel,
      minPassingScore: 70,
      customChecks: [],
    });

    // Execute quality checks
    const result = await qualityGate.executeQualityGate();

    res.json({
      success: true,
      data: {
        status: result.status,
        overallScore: result.overallScore,
        checks: result.checks,
        metrics: {
          totalDuration: result.totalDuration,
          checksExecuted: result.checks.filter(check => check.status !== 'skipped').length,
          timestamp: result.timestamp,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, 'Validation error', 'VALIDATION_ERROR'));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/v1/quality-gate/status/:id
 * Get quality gate execution status
 * 
 * Note: For async execution (future implementation with job queue)
 */
router.get('/status/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // TODO: Implement async job status tracking
  res.json({
    success: true,
    data: {
      id,
      status: 'pending',
      message: 'Async quality gate execution coming soon - requires job queue',
    },
  });
});

export { router as qualityGateRouter };

