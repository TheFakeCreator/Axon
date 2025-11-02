import { Router, type Request, type Response } from 'express';
import { checkServicesHealth } from '../services/index.js';

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

router.get('/ready', async (req: Request, res: Response) => {
  const health = await checkServicesHealth();
  
  res.status(health.healthy ? 200 : 503).json({
    success: health.healthy,
    data: {
      ready: health.healthy,
      services: health.services,
      timestamp: new Date().toISOString(),
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
