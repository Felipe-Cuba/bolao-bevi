// Tipos do particionamento de partidas por fase+rodada (coleção wcMatches).

import type { Competition, Match, MatchStage, PhaseStatus, Season } from './match.model.js';

/** Entrada do índice de partes no doc `_meta` (sem os jogos). */
export interface MatchPartInfo {
  id: string; // ex.: "group-1", "last-32"
  stage: MatchStage | string;
  matchday: number | null;
  phaseStatus: PhaseStatus;
  count: number;
}

/** Uma parte completa (com os jogos), gravada num doc próprio. */
export interface MatchPart {
  id: string;
  stage: MatchStage | string;
  matchday: number | null;
  phaseStatus: PhaseStatus;
  matches: Match[];
}

/** Índice das partes: competition/season + lista de partes (doc `_meta`). */
export interface MatchesMeta {
  competition: Competition | null;
  season: Season | null;
  parts: MatchPartInfo[];
}

/** Resultado de `MatchPartitioner.partition`. */
export interface PartitionResult {
  meta: MatchesMeta;
  parts: MatchPart[];
}
