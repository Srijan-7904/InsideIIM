import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { env } from './config/env.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp());

app.get('/', (_request, response) => {
  response.json({
    name: 'InsideIIM AI Investment Research Agent API',
    status: 'ok',
  });
});

app.use('/api', apiRouter);
app.use(notFound);
app.use(errorHandler);
