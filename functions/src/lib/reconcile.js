// Reconciliação anti-regressão do payload de partidas (função pura, sem Firestore).
//
// A API externa (football-data.org) ocasionalmente rebaixa um jogo já encerrado de volta
// para um estado "agendado" (ex.: FINISHED → TIMED). Como o cache é sobrescrito pelo
// payload bruto, essa regressão contaminava o status/placar e, com isso, a pontuação do
// bolão. Aqui congelamos qualquer jogo que JÁ estava num estado terminal no cache: ele
// nunca pode ser rebaixado por um payload novo que o traga num estado "menor".

import { TERMINAL, LIVE } from './partitions.js';

/** Um jogo já chegou a um estado definitivo (encerrado/cancelado)? */
function isTerminal(match) {
  return TERMINAL.has(match?.status);
}

/** O jogo está num estado terminal ou ao vivo (ou seja, "em jogo / já jogado")? */
function isTerminalOrLive(match) {
  return TERMINAL.has(match?.status) || LIVE.has(match?.status);
}

/**
 * Reconcilia a lista nova (da API) contra a cacheada, preservando a ordem da nova.
 *
 * Regra: se o jogo JÁ estava terminal no cache e o payload novo o traz num estado que NÃO
 * é terminal nem ao vivo (regressão), mantém-se a versão cacheada (status + placar). Em
 * qualquer outro caso aceita-se o novo — progressão normal (TIMED→IN_PLAY→FINISHED),
 * correções de placar de jogo ao vivo, jogos inéditos, etc.
 *
 * @param {Array} prevMatches lista de jogos atualmente no cache (pode ser vazia/ausente)
 * @param {Array} nextMatches lista de jogos do payload novo da API
 * @returns {Array} lista reconciliada (mesmo comprimento/ordem de nextMatches)
 */
export function reconcileMatches(prevMatches, nextMatches) {
  const next = Array.isArray(nextMatches) ? nextMatches : [];
  if (!Array.isArray(prevMatches) || prevMatches.length === 0) return next;

  const prevById = new Map(prevMatches.map((m) => [m.id, m]));

  return next.map((nextMatch) => {
    const prev = prevById.get(nextMatch.id);
    if (prev && isTerminal(prev) && !isTerminalOrLive(nextMatch)) {
      console.warn(
        `[matches] regressão ignorada no jogo ${nextMatch.id}: cache=${prev.status} ` +
          `→ api=${nextMatch.status}; mantendo a versão encerrada do cache.`,
      );
      return prev;
    }
    return nextMatch;
  });
}
