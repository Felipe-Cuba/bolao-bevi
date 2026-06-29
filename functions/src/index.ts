// Entrypoint das Cloud Functions do Bolão Bevi.
// Uma única function HTTP `api` (Express) atende toda a API REST sob /api/**:
//   GET    /api/matches
//   POST   /api/grupos
//   GET    /api/grupos/:id
//   POST   /api/grupos/:id/entries
//   PUT    /api/grupos/:id/entries/:entryId
//   DELETE /api/grupos/:id/entries/:entryId
//
// Servida via rewrite do Hosting (/api/** → api) em produção e via proxy de dev local.

import { onRequest } from 'firebase-functions/v2/https';

import { REGION } from './config.js';
import { createApp } from './app.js';

export const api = onRequest({ region: REGION, maxInstances: 3 }, createApp());
