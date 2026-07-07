import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';

const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
