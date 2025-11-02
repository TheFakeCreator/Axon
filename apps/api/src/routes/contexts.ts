import { Router, type Request, type Response } from 'express';

const router: Router = Router();

// Placeholder routes for MVP
router.post('/', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Context creation coming soon' });
});

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: { contexts: [] } });
});

router.post('/search', (req: Request, res: Response) => {
  res.json({ success: true, data: { results: [] } });
});

export { router as contextRouter };
