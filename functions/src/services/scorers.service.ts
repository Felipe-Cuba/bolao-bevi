import { inject } from '#core/injector';
import { ScorersRepository } from '../repositories/scorers.repository.js';
import { SCORERS_API_URL } from '#config';
import { FootballDataClient } from '#lib/football-data.client';
import { CacheGate } from '#lib/cache-gate';
import { HttpError } from '#lib/http-error';
import type { ScorersResult } from '#models';

/**
 * Serviço da artilharia da Copa: proxy + gatekeeper da API football-data.org com cache
 * persistente no Firestore (via ScorersRepository). Mesmo desenho do MatchesService.
 */
export class ScorersService {
  /** Repositório injetado (singleton resolvido pelo injector). */
  private repo = inject(ScorersRepository);
  /** Cliente da API football-data.org (injetado). */
  private api = inject(FootballDataClient);

  /**
   * Decide pelo `updatedAtMs` no cache se chama a API real:
   *  - se a última atualização foi há < 30s, devolve o cache;
   *  - senão, chama a API, grava o cache e devolve o payload novo.
   * Em erro da API, cai no último cache (stale) se existir.
   *
   * Retorna { data, updatedAtMs, source }. Lança erro só quando não há nada a devolver.
   */
  public async getScorers(): Promise<ScorersResult> {
    const cached = await this.repo.readCurrent();

    // Gate: cache ainda fresco → devolve sem bater na API.
    if (cached && CacheGate.isFresh(cached.updatedAtMs)) {
      return { data: cached.data, updatedAtMs: cached.updatedAtMs, source: 'firestore' };
    }

    // Vencido → chama a API real.
    const res = await this.api.fetchJson(SCORERS_API_URL, 'scorers');
    if (!res.ok) {
      // Falhou (rede ou !ok, inclui 429). Devolve o último cache, se houver (stale-while-revalidate).
      if (cached) {
        return { data: cached.data, updatedAtMs: cached.updatedAtMs ?? null, source: 'firestore' };
      }
      throw new HttpError(res.status || 502, 'Artilharia indisponível.');
    }

    const data = res.data;
    const updatedAtMs = Date.now();
    await this.repo.writeCurrent(data, updatedAtMs);

    return { data, updatedAtMs, source: 'api' };
  }
}
