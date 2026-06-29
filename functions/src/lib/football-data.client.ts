// Cliente da API football-data.org. Centraliza a chamada HTTP com o header de autenticação
// e a tolerância a erro (rede/!ok), evitando a duplicação que existia entre os serviços de
// partidas e artilharia. NÃO decide política de cache/stale — isso fica em cada serviço.
//
// Classe injetável (resolvida via core/injector): o token é lido uma única vez aqui.

/** Resultado de uma chamada à API: nunca lança; o chamador decide o que fazer. */
/**
 * @typedef {Object} FetchResult
 * @property {boolean} ok   - true quando a resposta veio 2xx.
 * @property {number}  status - status HTTP (0 quando houve falha de rede).
 * @property {*}       data - corpo JSON quando ok; null caso contrário.
 */

import type { FetchResult } from '#models';

export class FootballDataClient {
  /** Token de acesso, lido do ambiente uma vez. */
  private token = process.env.FOOTBALL_DATA_TOKEN ?? '';

  /**
   * Busca uma URL da football-data.org e devolve { ok, status, data } sem lançar.
   * `tag` só rotula os logs (ex.: 'matches' | 'scorers').
   */
  public async fetchJson<T = unknown>(url: string, tag = 'football-data'): Promise<FetchResult<T>> {
    let res: Response;
    try {
      res = await fetch(url, { headers: { 'X-Auth-Token': this.token } });
    } catch (err) {
      console.error(`[${tag}] falha ao chamar a API:`, err);
      return { ok: false, status: 0, data: null };
    }

    if (!res.ok) {
      console.warn(`[${tag}] API retornou ${res.status}.`);
      return { ok: false, status: res.status, data: null };
    }

    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  }
}
