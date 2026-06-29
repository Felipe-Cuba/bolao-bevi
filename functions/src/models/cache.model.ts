// Tipos dos documentos de cache no Firestore e das respostas dos serviços.

import type { Match, MatchesPayload } from './match.model.js';
import type { MatchPart, MatchesMeta } from './partition.model.js';

/** Origem dos dados devolvidos por um serviço de cache. */
export type DataSource = 'api' | 'firestore';

/** Doc de cache legado (wcMatches/current) e cache de artilharia (wcScorers/current). */
export interface CachedDoc<T = unknown> {
  data: T;
  updatedAtMs: number | null;
  lastUpdated?: unknown; // Firestore Timestamp (server)
}

/** Doc `_meta` lido do Firestore (índice + timestamp). */
export interface MetaDoc extends MatchesMeta {
  updatedAtMs: number | null;
  lastUpdated?: unknown;
}

/** Parte lida do Firestore (com id e timestamp). */
export interface PartDoc extends MatchPart {
  updatedAtMs?: number | null;
  lastUpdated?: unknown;
}

/** Resultado de `readAllParts`: meta + partes (ou meta null se ainda não há cache). */
export interface AllParts {
  meta: MetaDoc | null;
  parts: PartDoc[];
}

/** Resposta dos serviços de partidas (payload completo). */
export interface MatchesResult {
  data: MatchesPayload;
  updatedAtMs: number | null;
  source: DataSource;
}

/** Resposta de "só as partes pedidas + meta". */
export interface PartsResult {
  meta: MatchesMeta | null;
  parts: MatchPart[];
  updatedAtMs: number | null;
  source: DataSource;
}

/** Resposta da artilharia. */
export interface ScorersResult {
  data: unknown;
  updatedAtMs: number | null;
  source: DataSource;
}

/** Resultado tolerante de uma chamada à API externa (FootballDataClient). */
export interface FetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
}
