import { Router, type Request, type Response } from 'express';

const router: Router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '0.1.0',
    },
  });
});

router.get('/ready', (req: Request, res: Response) => {
  // Check if all services are ready
  // For MVP, we'll just return true
  res.json({
    success: true,
    data: {
      ready: true,
      services: {
        database: 'ready',
        vectorStore: 'ready',
        cache: 'ready',
      },
    },
  });
});

router.get('/live', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      alive: true,
    },
  });
});

export { router as healthRouter };
