import { inject } from '../core/injector.js';
import { MatchesRepository } from '../repositories/matches.repository.js';
import { API_URL, MIN_INTERVAL_MS } from '../config.js';

/**
 * Serviço das partidas da Copa: proxy + gatekeeper da API football-data.org com cache
 * persistente no Firestore (via MatchesRepository).
 */
export class MatchesService {
  /** Repositório injetado (singleton resolvido pelo injector). */
  repo = inject(MatchesRepository);

  /**
   * Decide pelo `updatedAtMs` no cache se chama a API real:
   *  - se a última atualização foi há < 30s, devolve o cache;
   *  - senão, chama a API, grava o cache e devolve o payload novo.
   * Em erro da API, cai no último cache (stale) se existir.
   *
   * Retorna { data, updatedAtMs, source }. Lança erro só quando não há nada a devolver.
   */
  async getMatches() {
    const cached = await this.repo.readCurrent();
    const now = Date.now();

    // Gate: cache ainda fresco → devolve sem bater na API.
    if (cached && typeof cached.updatedAtMs === 'number' && now - cached.updatedAtMs < MIN_INTERVAL_MS) {
      return { data: cached.data, updatedAtMs: cached.updatedAtMs, source: 'firestore' };
    }

    // Vencido → chama a API real.
    let apiRes;
    try {
      apiRes = await fetch(API_URL, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN ?? '' },
      });
    } catch (err) {
      console.error('[matches] falha ao chamar a API:', err);
      if (cached) return { data: cached.data, updatedAtMs: cached.updatedAtMs ?? null, source: 'firestore' };
      throw err;
    }

    if (!apiRes.ok) {
      // Falhou (inclui 429). Devolve o último cache, se houver.
      if (cached) return { data: cached.data, updatedAtMs: cached.updatedAtMs ?? null, source: 'firestore' };
      const error = new Error(`API retornou ${apiRes.status}`);
      error.status = apiRes.status;
      throw error;
    }

    const data = await apiRes.json();
    const updatedAtMs = Date.now();
    await this.repo.writeCurrent(data, updatedAtMs);

    return { data, updatedAtMs, source: 'api' };
  }
}
