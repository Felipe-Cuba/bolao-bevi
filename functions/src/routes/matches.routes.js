import { Router } from 'express';

import { asyncHandler } from '../middlewares/async-handler.js';
import { inject } from '../core/injector.js';
import { MatchesService } from '../services/matches.service.js';
import { PhaseStatus } from '../lib/partitions.js';

export const matchesRouter = Router();

// GET /api/matches/meta — índice das partes (leve) com phaseStatus.
matchesRouter.get(
  '/meta',
  asyncHandler(async (req, res) => {
    const result = await inject(MatchesService).getMeta();
    res.set('Cache-Control', 'public, max-age=30');
    res.status(200).json(result);
  }),
);

// GET /api/matches            → payload completo (retrocompat).
// GET /api/matches?part=a,b   → só as partes pedidas + _meta.
matchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const svc = inject(MatchesService);
    const partParam = typeof req.query.part === 'string' ? req.query.part.trim() : '';

    if (partParam) {
      const ids = partParam.split(',').map((s) => s.trim()).filter(Boolean);
      const result = await svc.getParts(ids);
      // Se todas as partes pedidas terminaram, são imutáveis → cache longo.
      const immutable =
        result.meta &&
        ids.every(
          (id) =>
            result.meta.parts.find((p) => p.id === id)?.phaseStatus === PhaseStatus.FINISHED,
        );
      res.set('Cache-Control', immutable ? 'public, max-age=3600' : 'public, max-age=30');
      res.status(200).json(result);
      return;
    }

    const result = await svc.getAllMatches();
    res.set('Cache-Control', 'public, max-age=30');
    res.status(200).json(result);
  }),
);
