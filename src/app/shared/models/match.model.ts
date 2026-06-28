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

// --- Partições de partidas (coleção Firestore `wcMatches`, servida via Function) ---
// As partidas são quebradas por fase+rodada (group-1/2/3, last-32, ..., final).

/** Status agregado de uma fase, derivado dos status dos seus jogos. */
export type PhaseStatus = 'finished' | 'ongoing' | 'timed';

/** Entrada do índice `_meta`: descreve uma partição sem trazer os jogos. */
export interface MatchPartInfo {
  id: string; // ex.: "group-1", "last-16"
  stage: MatchStage | string;
  matchday: number | null;
  phaseStatus: PhaseStatus;
  count: number;
}

/** Índice das partições (doc `_meta`), servido por GET /api/matches/meta. */
export interface MatchesMeta {
  competition: Competition | null;
  season: Season | null;
  parts: MatchPartInfo[];
  updatedAtMs?: number | null;
  source?: string;
}

/** Uma partição com seus jogos, servida por GET /api/matches?part=... */
export interface MatchPart {
  id: string;
  stage: MatchStage | string;
  matchday: number | null;
  phaseStatus: PhaseStatus;
  matches: Match[];
}

/** Resposta de GET /api/matches?part=... */
export interface MatchPartsResponse {
  meta: MatchesMeta | null;
  parts: MatchPart[];
  updatedAtMs?: number | null;
  source?: string;
}

// --- Modelo das seleções (collection Firestore `wcTeams`) ---
// Cada seleção é um documento próprio (id = TLA), derivado de wc-teams-data.json
// (GET /v4/competitions/WC/teams da api.football-data.org).

export interface Coach {
  id: number;
  firstName: string | null;
  lastName: string | null;
  name: string;
  dateOfBirth: string | null; // ISO 8601 (yyyy-mm-dd)
  nationality: string | null;
  contract: { start: string | null; until: string | null };
}

export interface SquadMember {
  id: number;
  name: string;
  position: string; // ex.: "Goalkeeper", "Defence", "Midfield", "Offence"
  dateOfBirth: string | null; // ISO 8601 (yyyy-mm-dd)
  nationality: string | null;
}

/**
 * Seleção participante da Copa 2026, com elenco e comissão técnica.
 * Documento da collection `wcTeams`, com `id` (TLA) como id do documento.
 */
export interface WcTeam {
  id: number; // id numérico da API (ex.: 758)
  tla: string; // código de 3 letras (ex.: "URU") — usado como id do documento
  name: string; // nome original da API (em inglês)
  namePt: string; // nome em português (derivado do enum de TLA em teams.ts)
  shortName: string;
  area: Area;
  crest: string | null;
  address: string | null;
  website: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  coach: Coach | null;
  squad: SquadMember[];
  lastUpdated: string; // ISO 8601 — vindo da API
}

export interface ResultSet {
  count: number;
  first: string;
  last: string;
  played: number;
}

// --- Artilharia (GET /v4/competitions/WC/scorers) ---

export interface ScorerPlayer {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null; // ISO 8601 (yyyy-mm-dd)
  nationality: string | null;
  section: string | null; // ex.: "Offence"
  position: string | null;
  shirtNumber: number | null;
}

export interface Scorer {
  player: ScorerPlayer;
  team: Team; // reusa Team (id, name, shortName, tla, crest)
  playedMatches: number | null;
  goals: number | null;
  assists: number | null;
  penalties: number | null;
}

export interface ScorersResponse {
  count: number;
  filters?: { season?: string };
  competition: Competition;
  season: Season;
  scorers: Scorer[];
}

export interface MatchesResponse {
  filters?: { season?: string };
  resultSet: ResultSet;
  competition: Competition;
  matches: Match[];
}

// --- Confrontos dos 16-avos (collection Firestore `wcLast32`) ---
// 1 documento por confronto, gravado pelo script functions/scripts/seed-last-32.js.
// Os times vêm da API (já definidos) e dão a base das FOLHAS da árvore do chaveamento.

/**
 * Confronto dos 16-avos (LAST_32), numerado de 1 a 16 conforme `brackets.md`.
 * `num` é o nº oficial do jogo na árvore (73..88), com `num = 72 + numero`.
 */
export interface Last32Confronto {
  numero: number; // 1..16 (ordem do brackets.md)
  num: number; // 73..88 (nº oficial; num = 72 + numero)
  matchId: number; // id real do jogo na API
  utcDate: string; // ISO 8601
  homeTeam: Team;
  awayTeam: Team;
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
