import { Router } from 'express';
import { healthRouter } from './healthRoutes.js';
import { researchRouter } from './researchRoutes.js';
import { authRouter } from './authRoutes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/research', researchRouter);
apiRouter.use('/auth', authRouter);
