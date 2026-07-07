import { Router } from 'express';
import { createReport, getResearchStatus, startResearch } from '../controllers/researchController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

export const researchRouter = Router();

researchRouter.post('/start', requireAuth, requireRole('ROLE_ADMIN'), startResearch);
researchRouter.get('/status/:jobId', requireAuth, getResearchStatus);
researchRouter.post('/', requireAuth, createReport);
