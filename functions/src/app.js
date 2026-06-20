import express from 'express';
import cors from 'cors';

import { matchesRouter } from './routes/matches.routes.js';
import { gruposRouter } from './routes/grupos.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';

/**
 * Cria o app Express da API.
 *
 * Os routers são montados COM e SEM o prefixo /api para funcionar nos dois ambientes:
 *  - Produção (Hosting rewrite /api/**): a function recebe o path completo, ex.
 *    `/api/matches`.
 *  - Dev (proxy local): o proxy reescreve removendo /api, então a function recebe
 *    `/matches`.
 * Montar nas duas formas mantém o código indiferente a essa diferença.
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  for (const base of ['/api', '']) {
    app.use(`${base}/matches`, matchesRouter);
    app.use(`${base}/grupos`, gruposRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
