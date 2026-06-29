import { Router } from 'express';

import { asyncHandler } from '../middlewares/async-handler.js';
import { inject } from '#core/injector';
import { GruposService } from '../services/grupos.service.js';

export const gruposRouter = Router();

// POST /api/grupos — cria um grupo.
gruposRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await inject(GruposService).createGroup(req.body?.name);
    res.status(201).json(result);
  }),
);

// GET /api/grupos/:id — metadados do grupo.
gruposRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await inject(GruposService).getGroup(req.params.id);
    res.status(200).json(result);
  }),
);

// POST /api/grupos/:id/entries — cria um palpite.
gruposRouter.post(
  '/:id/entries',
  asyncHandler(async (req, res) => {
    const { name, palpites } = req.body ?? {};
    const result = await inject(GruposService).saveEntry(req.params.id, name, palpites);
    res.status(201).json(result);
  }),
);

// PUT /api/grupos/:id/entries/:entryId — edita um palpite.
gruposRouter.put(
  '/:id/entries/:entryId',
  asyncHandler(async (req, res) => {
    const { name, palpites } = req.body ?? {};
    const result = await inject(GruposService).saveEntry(
      req.params.id,
      name,
      palpites,
      req.params.entryId,
    );
    res.status(200).json(result);
  }),
);

// DELETE /api/grupos/:id/entries/:entryId — remove um palpite.
gruposRouter.delete(
  '/:id/entries/:entryId',
  asyncHandler(async (req, res) => {
    const result = await inject(GruposService).removeEntry(req.params.id, req.params.entryId);
    res.status(200).json(result);
  }),
);
