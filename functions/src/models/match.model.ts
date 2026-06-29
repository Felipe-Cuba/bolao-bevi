// Tipos do domínio da Copa (espelham o payload da football-data.org e o front).
// Interfaces puras (apenas shape de dados) — sem comportamento.

export type MatchStatus =
  | 'TIMED'
  | 'SCHEDULED'
  | 'LIVE'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED';

export type MatchStage =
  | 'FINAL'
  | 'THIRD_PLACE'
  | 'SEMI_FINALS'
  | 'QUARTER_FINALS'
  | 'LAST_16'
  | 'LAST_32'
  | 'LAST_64'
  | 'GROUP_STAGE'
  | 'PRELIMINARY_ROUND';

export type MatchWinner = 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
export type MatchDuration = 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';

/** Status agregado de uma fase, derivado dos status dos seus jogos. */
export type PhaseStatus = 'finished' | 'ongoing' | 'timed';

export interface Team {
  // No mata-mata os times ainda não definidos vêm com todos os campos nulos.
  id: number | null;
  name: string | null;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

export interface ScoreLine {
  home: number | null;
  away: number | null;
}

export interface Score {
  winner: MatchWinner;
  duration: MatchDuration;
  /** Placar final (após prorrogação/pênaltis, quando houver). */
  fullTime: ScoreLine;
  halfTime: ScoreLine;
  regularTime?: ScoreLine;
  extraTime?: ScoreLine;
  penalties?: ScoreLine;
}

export interface Referee {
  id: number;
  name: string;
  type: string;
  nationality: string;
}

export interface Area {
  id: number;
  name: string;
  code: string;
  flag: string | null;
}

export interface Competition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

export interface Season {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number | null;
  winner: Team | null;
}

export interface Match {
  id: number;
  utcDate: string; // ISO 8601
  status: MatchStatus | string;
  matchday: number | null; // null no mata-mata
  stage: MatchStage | string;
  group: string | null; // ex.: "GROUP_A"; null no mata-mata
  lastUpdated: string; // ISO 8601
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  referees?: Referee[];
  area?: Area;
  season?: Season;
  odds?: { msg?: string };
}

/** Payload bruto retornado pela API de partidas da football-data.org. */
export interface MatchesPayload {
  competition: Competition | null;
  season: Season | null;
  matches: Match[];
}
