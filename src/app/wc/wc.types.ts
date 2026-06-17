// Tipos do domínio da Copa do Mundo 2026, modelados a partir de context.md
// (GET /v4/competitions/WC/matches da api.football-data.org).

export enum MatchStatus {
  TIMED = 'TIMED', // agendada com horário definido (status real da API)
  SCHEDULED = 'SCHEDULED', // agendada (legado/doc; alguns endpoints ainda retornam)
  LIVE = 'LIVE', // ao vivo (genérico)
  IN_PLAY = 'IN_PLAY', // em andamento
  PAUSED = 'PAUSED', // intervalo
  FINISHED = 'FINISHED', // encerrada
  POSTPONED = 'POSTPONED', // adiada
  SUSPENDED = 'SUSPENDED', // suspensa
  CANCELLED = 'CANCELLED', // cancelada
}

// Status considerados "agendado/por jogar" (cobre TIMED e o legado SCHEDULED).
export const UPCOMING_STATUSES: ReadonlySet<MatchStatus> = new Set([
  MatchStatus.TIMED,
  MatchStatus.SCHEDULED,
]);

export function isUpcoming(match: Match): boolean {
  return UPCOMING_STATUSES.has(match.status);
}

export enum MatchStage {
  FINAL = 'FINAL',
  THIRD_PLACE = 'THIRD_PLACE',
  SEMI_FINALS = 'SEMI_FINALS',
  QUARTER_FINALS = 'QUARTER_FINALS',
  LAST_16 = 'LAST_16',
  LAST_32 = 'LAST_32',
  LAST_64 = 'LAST_64',
  GROUP_STAGE = 'GROUP_STAGE',
  PRELIMINARY_ROUND = 'PRELIMINARY_ROUND',
}

export type MatchWinner = 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
export type MatchDuration = 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';

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
  /** Presente quando a partida foi além do tempo normal. */
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
  flag: string;
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
  status: MatchStatus;
  matchday: number | null; // null no mata-mata
  stage: MatchStage | string;
  group: string | null; // ex.: "GROUP_A"; null no mata-mata
  lastUpdated: string; // ISO 8601
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  referees?: Referee[];
  // Campos extras presentes em alguns endpoints; opcionais aqui.
  area?: Area;
  season?: Season;
  odds?: { msg?: string };
}

export interface Competition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
}

export interface ResultSet {
  count: number;
  first: string;
  last: string;
  played: number;
}

export interface MatchesResponse {
  filters?: { season?: string };
  resultSet: ResultSet;
  competition: Competition;
  matches: Match[];
}

// Status considerados "ao vivo" para destaque na UI.
export const LIVE_STATUSES: ReadonlySet<MatchStatus> = new Set([
  MatchStatus.LIVE,
  MatchStatus.IN_PLAY,
  MatchStatus.PAUSED,
]);

export function isLive(match: Match): boolean {
  return LIVE_STATUSES.has(match.status);
}

/**
 * Detalhe textual do resultado quando houve prorrogação/pênaltis.
 * Ex.: "Pênaltis (4-3)" ou "Prorrogação". Retorna null para jogo em tempo normal.
 */
export function scoreBreakdown(score: Score): string | null {
  if (score.duration === 'PENALTY_SHOOTOUT' && score.penalties) {
    return `Pênaltis (${score.penalties.home ?? 0}-${score.penalties.away ?? 0})`;
  }
  if (score.duration === 'EXTRA_TIME') {
    return 'Prorrogação';
  }
  return null;
}
