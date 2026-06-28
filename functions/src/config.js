// Constantes de configuração das Cloud Functions do Bolão Bevi.

/** Região onde a function é implantada (mesma do projeto). */
export const REGION = 'southamerica-east1';

/** Endpoint da API externa de partidas (football-data.org). */
export const API_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

/**
 * Intervalo mínimo entre chamadas reais à API (rate limit: 10/min). Salvaguarda
 * server-side: garante o gate mesmo que vários clientes peçam ao mesmo tempo.
 */
export const MIN_INTERVAL_MS = 30_000;

/** Cache persistente das partidas em Firestore (coleção wcMatches).
 *  Particionado por fase+rodada: docs `group-1`, ..., `final` + um doc `_meta`.
 *  `current` é o doc único legado, mantido durante a migração (retrocompat). */
export const MATCHES_COLLECTION = 'wcMatches';
export const MATCHES_DOC_ID = 'current';
export const META_DOC_ID = '_meta';

/**
 * Endpoint da artilharia. Pedimos limit=100 numa única chamada (a API pagina com
 * default 10): assim o ranking completo cabe num request só, respeitando o rate
 * limit de 10/min; a paginação acontece no front sobre o cache.
 */
export const SCORERS_API_URL = 'https://api.football-data.org/v4/competitions/WC/scorers?limit=100';

/** Cache persistente da artilharia em Firestore: wcScorers/current. */
export const SCORERS_COLLECTION = 'wcScorers';
export const SCORERS_DOC_ID = 'current';

/** Coleção dos grupos de palpites. */
export const GRUPOS_COLLECTION = 'grupos';

/** Coleção dos grupos da Copa (fase de grupos): 1 doc por grupo (group-a, ..., group-l). */
export const GROUPS_COLLECTION = 'wcGroups';
