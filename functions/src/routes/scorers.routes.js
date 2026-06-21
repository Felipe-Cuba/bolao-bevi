import { Router } from 'express';

import { asyncHandler } from '../middlewares/async-handler.js';
import { inject } from '../core/injector.js';
import { ScorersService } from '../services/scorers.service.js';

export const scorersRouter = Router();

// GET /api/scorers — artilharia da Copa (proxy + gate de 30s).
scorersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await inject(ScorersService).getScorers();
    res.set('Cache-Control', 'public, max-age=15');
    res.status(200).json(result);
  }),
);
