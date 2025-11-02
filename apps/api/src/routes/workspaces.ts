import { Router, type Request, type Response } from 'express';

const router: Router = Router();

// Placeholder routes for MVP
router.post('/', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Workspace creation coming soon' });
});

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: { workspaces: [] } });
});

router.get('/:id', (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

export { router as workspaceRouter };
