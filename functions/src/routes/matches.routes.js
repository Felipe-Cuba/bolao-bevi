import { Router } from 'express';

import { asyncHandler } from '../middlewares/async-handler.js';
import { inject } from '../core/injector.js';
import { MatchesService } from '../services/matches.service.js';

export const matchesRouter = Router();

// GET /api/matches — partidas da Copa (proxy + gate de 30s).
matchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await inject(MatchesService).getMatches();
    res.set('Cache-Control', 'public, max-age=15');
    res.status(200).json(result);
  }),
);
