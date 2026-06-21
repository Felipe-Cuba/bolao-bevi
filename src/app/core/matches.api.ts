import { Injectable, inject } from '@angular/core';
import { queryOptions } from '@tanstack/angular-query-experimental';
import { environment } from '@env/environment';
import {
  MatchesResponse,
  ScorersResponse,
  MatchesMeta,
  MatchPartsResponse,
} from '@shared/models/match.model';
import { MatchesFirestore } from '@core/matches.firestore';

/**
 * Resultado da busca de partidas, anotado com a origem real dos dados — para a UI
 * sinalizar de onde veio (Firestore em cache, API atualizada, ou seed local).
 */
export interface WcMatchesResult {
  data: MatchesResponse;
  source: 'api' | 'firestore' | 'local';
  /** Quando a API foi consultada pela última vez (epoch ms), se conhecido. */
  updatedAtMs?: number | null;
}

/** Resultado da busca de artilheiros, anotado com a origem real dos dados. */
export interface WcScorersResult {
  data: ScorersResponse;
  source: 'api' | 'firestore';
  updatedAtMs?: number | null;
}

/** Resposta da Cloud Function (proxy + gatekeeper). */
interface ProxyResponse<T> {
  data: T;
  updatedAtMs?: number | null;
  source?: string;
}

/**
 * Serviço de dados de partidas e artilharia para o front. Aplica o gate de 30s
 * (rate limit 10/min) lendo o cache do Firestore antes de chamar a Function, e expõe
 * `queryOptions` do TanStack Query para os componentes.
 */
@Injectable({ providedIn: 'root' })
export class MatchesApi {
  private readonly cache = inject(MatchesFirestore);

  /**
   * Intervalo mínimo entre chamadas reais à API (rate limit: 10/min). Também é o
   * cooldown do botão "Atualizar" na UI.
   */
  readonly refreshCooldownMs = 30_000;

  /**
   * Opções da query compartilhada de partidas.
   *
   * Estratégia anti-rate-limit: UMA query (`['wc','matches']`) lida por todos os
   * componentes (dedupe nativo), `staleTime: Infinity` e sem refetch implícito. O gate
   * de 30s (Firestore) evita chamadas reais à API; atualizar dispara `query.refetch()`.
   */
  matchesQueryOptions() {
    return queryOptions({
      queryKey: ['wc', 'matches'] as const,
      queryFn: () => this.fetchMatches(),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60, // 1h em cache
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    });
  }

  /**
   * Opções da query da artilharia. Mesma estratégia das partidas; lazy: o componente
   * habilita via `enabled` só quando a aba/seção precisa dos dados.
   */
  scorersQueryOptions() {
    return queryOptions({
      queryKey: ['wc', 'scorers'] as const,
      queryFn: () => this.fetchScorers(),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    });
  }

  /**
   * Índice das partições (`_meta`): competition/season + lista de partes com
   * `phaseStatus`. Leve; usado para badges e para decidir o que buscar por aba.
   */
  metaQueryOptions() {
    return queryOptions({
      queryKey: ['wc', 'matches', 'meta'] as const,
      queryFn: () => this.fetchMeta(),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    });
  }

  /**
   * Partes específicas (ex.: classificação lê só `group-1,group-2,group-3`). O cache
   * HTTP/CDN e o gate server-side (partes `finished` são imutáveis) evitam refetch real.
   */
  partsQueryOptions(ids: string[]) {
    const key = [...ids].sort().join(',');
    return queryOptions({
      queryKey: ['wc', 'matches', 'parts', key] as const,
      queryFn: () => this.fetchParts(ids),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    });
  }

  /** GET /api/matches/meta (via Function). */
  private async fetchMeta(): Promise<MatchesMeta> {
    if (!environment.apiUrl) {
      // Dev puro: deriva o meta do seed local (sem Function).
      const seed = await this.fetchLocalSeed();
      return { competition: seed.competition ?? null, season: null, parts: [], source: 'local' };
    }
    const res = await fetch(`${environment.apiUrl}/meta`);
    if (!res.ok) throw new Error(`Proxy /meta retornou ${res.status}`);
    return (await res.json()) as MatchesMeta;
  }

  /** GET /api/matches?part=a,b (via Function). */
  private async fetchParts(ids: string[]): Promise<MatchPartsResponse> {
    if (!environment.apiUrl) {
      throw new Error('Leitura por partição indisponível no modo dev puro (sem API).');
    }
    const q = encodeURIComponent(ids.join(','));
    const res = await fetch(`${environment.apiUrl}?part=${q}`);
    if (!res.ok) throw new Error(`Proxy ?part retornou ${res.status}`);
    return (await res.json()) as MatchPartsResponse;
  }

  /**
   * Busca as partidas aplicando o gate de 30s no FRONT:
   * 1. Lê a doc do Firestore (dados + updatedAtMs) e a usa de imediato se fresca (< 30s).
   * 2. Senão chama a Function, que busca da API, grava no Firestore e devolve o payload.
   * Fallback final = Firestore (stale). O seed local em arquivo só é usado no modo dev
   * puro (useLocalData), não em produção.
   */
  private async fetchMatches(): Promise<WcMatchesResult> {
    if (environment.useLocalData || !environment.apiUrl) {
      const data = await this.fetchLocalSeed();
      return { data, source: 'local' };
    }

    // 1. Lê o Firestore primeiro (mostra o dado mais fresco já salvo).
    let cached: { data: MatchesResponse; updatedAtMs: number | null } | null = null;
    try {
      cached = await this.cache.readMatches();
    } catch (err) {
      console.warn('[wc] falha ao ler o Firestore:', err);
    }

    // 2. Gate: cache fresco → fica com o Firestore.
    if (this.isFresh(cached)) {
      return { data: cached!.data, source: 'firestore', updatedAtMs: cached!.updatedAtMs };
    }

    // 3. Vencido (ou sem cache) → chama a Function, que grava e devolve o payload novo.
    try {
      const payload = await this.fetchProxy<MatchesResponse>(environment.apiUrl);
      return {
        data: payload.data,
        source: payload.source === 'firestore' ? 'firestore' : 'api',
        updatedAtMs: payload.updatedAtMs ?? Date.now(),
      };
    } catch (err) {
      console.warn('[wc] proxy indisponível:', err);
      if (cached) return { data: cached.data, source: 'firestore', updatedAtMs: cached.updatedAtMs };
      throw err;
    }
  }

  /**
   * Busca a artilharia com o mesmo gate de 30s das partidas. Fallback final =
   * Firestore (stale). Sem seed local em arquivo.
   */
  private async fetchScorers(): Promise<WcScorersResult> {
    if (!environment.scorersApiUrl) {
      // Sem API configurada (dev puro): tenta só o Firestore.
      const cached = await this.cache.readScorers();
      if (cached) return { data: cached.data, source: 'firestore', updatedAtMs: cached.updatedAtMs };
      throw new Error('Artilharia indisponível: sem API e sem cache no Firestore.');
    }

    // 1. Lê o Firestore primeiro.
    let cached: { data: ScorersResponse; updatedAtMs: number | null } | null = null;
    try {
      cached = await this.cache.readScorers();
    } catch (err) {
      console.warn('[wc] falha ao ler scorers do Firestore:', err);
    }

    // 2. Gate: cache fresco → fica com o Firestore.
    if (this.isFresh(cached)) {
      return { data: cached!.data, source: 'firestore', updatedAtMs: cached!.updatedAtMs };
    }

    // 3. Vencido (ou sem cache) → chama a Function.
    try {
      const payload = await this.fetchProxy<ScorersResponse>(environment.scorersApiUrl);
      return {
        data: payload.data,
        source: payload.source === 'firestore' ? 'firestore' : 'api',
        updatedAtMs: payload.updatedAtMs ?? Date.now(),
      };
    } catch (err) {
      console.warn('[wc] proxy de scorers indisponível:', err);
      if (cached) return { data: cached.data, source: 'firestore', updatedAtMs: cached.updatedAtMs };
      throw err;
    }
  }

  /** Cache ainda dentro do gate de 30s. */
  private isFresh(cached: { updatedAtMs: number | null } | null): boolean {
    return (
      !!cached &&
      cached.updatedAtMs != null &&
      Date.now() - cached.updatedAtMs < this.refreshCooldownMs
    );
  }

  /** Chama a Function de proxy e valida o status. */
  private async fetchProxy<T>(url: string): Promise<ProxyResponse<T>> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Proxy retornou ${res.status}`);
    return (await res.json()) as ProxyResponse<T>;
  }

  /**
   * Busca o seed local servido como asset estático (public/wc-response-complete.json).
   * Fonte em dev puro; não é fallback de produção.
   */
  private async fetchLocalSeed(): Promise<MatchesResponse> {
    const res = await fetch(environment.localSeedUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Falha ao carregar seed local (${res.status})`);
    return (await res.json()) as MatchesResponse;
  }
}
