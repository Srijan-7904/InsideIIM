import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  TAVILY_API_KEY: z.string().optional().default(''),
  FMP_API_KEY: z.string().optional().default(''),
  NEWS_API_KEY: z.string().optional().default(''),
  SEC_API_KEY: z.string().optional().default(''),
});

export const env = envSchema.parse(process.env);
