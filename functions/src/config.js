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

/** Cache persistente das partidas em Firestore: wcMatches/current. */
export const MATCHES_COLLECTION = 'wcMatches';
export const MATCHES_DOC_ID = 'current';

/** Coleção dos grupos de palpites. */
export const GRUPOS_COLLECTION = 'grupos';
