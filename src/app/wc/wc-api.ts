import { Injector } from '@angular/core';
import { queryOptions } from '@tanstack/angular-query-experimental';
import { Firestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';
import { MatchesResponse } from './wc.types';
import { readCurrent } from './wc-firestore';

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

/** Intervalo mínimo entre chamadas reais à API (rate limit: 10/min). Também é o
 *  cooldown do botão "Atualizar" na UI. */
export const REFRESH_COOLDOWN_MS = 30_000;
const MIN_INTERVAL_MS = REFRESH_COOLDOWN_MS;

/**
 * Busca o seed local servido como asset estático (public/wc-response-complete.json).
 * Fonte em dev e fallback quando tudo falha.
 */
async function fetchLocalSeed(): Promise<MatchesResponse> {
  const res = await fetch(environment.localSeedUrl, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Falha ao carregar seed local (${res.status})`);
  }
  return (await res.json()) as MatchesResponse;
}

/** Resposta da Cloud Function /api/wc (proxy + gatekeeper). */
interface ProxyResponse {
  data: MatchesResponse;
  updatedAtMs?: number | null;
  source?: string;
}

/**
 * Busca as partidas aplicando o gate de 30s no FRONT:
 * 1. Lê a doc completa do Firestore (dados + updatedAtMs) e a usa de imediato.
 * 2. Se a última atualização foi há < 30s → fica com o Firestore (não chama a API).
 * 3. Senão → chama a Function (/api/wc), que busca da API, grava no Firestore e devolve
 *    o payload novo.
 * Em qualquer falha, cai no que tiver: Firestore (stale) ou seed local.
 *
 * Em dev com useLocalData (sem API), usa só o JSON local.
 */
export async function fetchWcMatches(
  injector: Injector,
  fs: Firestore,
): Promise<WcMatchesResult> {
  if (environment.useLocalData || !environment.apiUrl) {
    const data = await fetchLocalSeed();
    return { data, source: 'local' };
  }

  // 1. Lê o Firestore primeiro (mostra o dado mais fresco já salvo).
  let cached: { data: MatchesResponse; updatedAtMs: number | null } | null = null;
  try {
    cached = await readCurrent(injector, fs);
  } catch (err) {
    console.warn('[wc] falha ao ler o Firestore:', err);
  }

  // 2. Gate: cache fresco → fica com o Firestore.
  const now = Date.now();
  if (cached && cached.updatedAtMs != null && now - cached.updatedAtMs < MIN_INTERVAL_MS) {
    return { data: cached.data, source: 'firestore', updatedAtMs: cached.updatedAtMs };
  }

  // 3. Vencido (ou sem cache) → chama a Function, que grava e devolve o payload novo.
  try {
    const res = await fetch(environment.apiUrl);
    if (!res.ok) throw new Error(`Proxy retornou ${res.status}`);
    const payload = (await res.json()) as ProxyResponse;
    return {
      data: payload.data,
      source: payload.source === 'firestore' ? 'firestore' : 'api',
      updatedAtMs: payload.updatedAtMs ?? Date.now(),
    };
  } catch (err) {
    console.warn('[wc] proxy indisponível:', err);
    if (cached) {
      return { data: cached.data, source: 'firestore', updatedAtMs: cached.updatedAtMs };
    }
    const data = await fetchLocalSeed();
    return { data, source: 'local' };
  }
}

/**
 * Opções da query compartilhada de partidas.
 *
 * Estratégia anti-rate-limit: UMA query (`['wc','matches']`) lida por todos os componentes
 * (dedupe nativo), `staleTime: Infinity` e sem refetch implícito. O gate de 30s (Firestore)
 * evita chamadas reais à API; atualizar dispara `query.refetch()`.
 */
export function wcMatchesQueryOptions(injector: Injector, fs: Firestore) {
  return queryOptions({
    queryKey: ['wc', 'matches'] as const,
    queryFn: () => fetchWcMatches(injector, fs),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 1h em cache
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });
}
