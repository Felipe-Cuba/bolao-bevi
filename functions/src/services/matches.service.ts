import { inject } from '#core/injector';
import { MatchesRepository } from '../repositories/matches.repository.js';
import { API_URL } from '#config';
import { MatchPartitioner } from '#lib/partitions';
import { MatchReconciler } from '#lib/reconcile';
import { FootballDataClient } from '#lib/football-data.client';
import { CacheGate } from '#lib/cache-gate';
import { HttpError } from '#lib/http-error';
import type {
  Match,
  MatchPart,
  MatchPartInfo,
  MatchesMeta,
  MatchesPayload,
  MatchesResult,
  MetaDoc,
  PartsResult,
} from '#models';

/**
 * Serviço das partidas da Copa: proxy + gatekeeper da API football-data.org com cache
 * persistente no Firestore, particionado por fase+rodada (via MatchesRepository).
 *
 * O gate de 30s (MIN_INTERVAL_MS) é preservado. Ao buscar da API, particiona o payload e
 * grava as partes (só as alteradas) + o `_meta`; mantém também o doc único legado durante
 * a migração. A leitura monta de volta o que o cliente pediu (tudo, ou só algumas partes).
 */
export class MatchesService {
  /** Repositório injetado (singleton resolvido pelo injector). */
  private repo = inject(MatchesRepository);
  /** Cliente da API football-data.org (injetado). */
  private api = inject(FootballDataClient);

  // ── Leitura ─────────────────────────────────────────────────────────────────

  /** Payload completo (retrocompat). Mantém o shape { data, updatedAtMs, source }. */
  public async getAllMatches(): Promise<MatchesResult> {
    await this.refreshIfStale();
    const { meta, parts } = await this.repo.readAllParts();
    if (meta) {
      return {
        data: MatchPartitioner.assemble(meta, parts),
        updatedAtMs: meta.updatedAtMs ?? null,
        source: 'firestore',
      };
    }
    // Fallback ao doc legado, se as partes ainda não existirem.
    const cached = await this.repo.readCurrent();
    if (cached) return { data: cached.data, updatedAtMs: cached.updatedAtMs ?? null, source: 'firestore' };
    throw new HttpError(404, 'Partidas indisponíveis (sem cache).');
  }

  /** Só as partes pedidas + o `_meta`. */
  public async getParts(ids: string[]): Promise<PartsResult> {
    await this.refreshIfStale(ids);
    const [meta, parts] = await Promise.all([this.repo.readMeta(), this.repo.readParts(ids)]);
    return {
      meta: meta ? publicMeta(meta) : null,
      parts: parts.map(publicPart),
      updatedAtMs: meta?.updatedAtMs ?? null,
      source: 'firestore',
    };
  }

  /** Só o índice das partes (leve). */
  public async getMeta(): Promise<MatchesMeta & { updatedAtMs: number | null; source: 'firestore' }> {
    await this.refreshIfStale();
    const meta = await this.repo.readMeta();
    if (!meta) throw new HttpError(404, 'Partidas indisponíveis (sem cache).');
    return { ...publicMeta(meta), updatedAtMs: meta.updatedAtMs ?? null, source: 'firestore' };
  }

  // ── Gate + atualização ───────────────────────────────────────────────────────

  /**
   * Atualiza do upstream se o cache estiver vencido. O gate de 30s usa o `_meta`.
   * Otimização: se todas as partes pedidas já estão `finished` (imutáveis), não chama a
   * API mesmo fora dos 30s.
   */
  public async refreshIfStale(requestedIds: string[] | null = null): Promise<void> {
    const meta = await this.repo.readMeta();

    if (meta && requestedIds && allFinished(meta, requestedIds)) return; // imutável
    if (meta && CacheGate.isFresh(meta.updatedAtMs)) return; // gate: ainda fresco

    await this.fetchAndStore();
  }

  /** Busca da API, particiona e grava (partes + meta + doc legado). Tolera falha. */
  public async fetchAndStore(): Promise<void> {
    const res = await this.api.fetchJson<MatchesPayload>(API_URL, 'matches');
    if (!res.ok || !res.data) return; // mantém o cache atual (stale)

    const data = res.data;
    const updatedAtMs = Date.now();

    // Guard anti-regressão: a API às vezes rebaixa um jogo já encerrado (FINISHED→TIMED),
    // o que sobrescreveria o cache e estragaria a pontuação. Reconcilia contra o cache atual
    // antes de particionar/gravar, congelando jogos que já estavam em estado terminal.
    const reconciled: MatchesPayload = {
      ...data,
      matches: MatchReconciler.reconcile(await this.readCachedMatches(), data.matches),
    };
    const { meta, parts } = MatchPartitioner.partition(reconciled);

    await this.repo.writePartitions(meta, parts, updatedAtMs);
    await this.repo.writeCurrent(reconciled, updatedAtMs); // legado (remover ao fim da migração)
  }

  /**
   * Lê os jogos atualmente em cache (partes particionadas, com fallback ao doc legado).
   * Retorna [] se ainda não há nada — aí a reconciliação aceita o payload novo inteiro.
   */
  public async readCachedMatches(): Promise<Match[]> {
    try {
      const { meta, parts } = await this.repo.readAllParts();
      if (meta) return MatchPartitioner.assemble(meta, parts).matches ?? [];
      const cached = await this.repo.readCurrent();
      return cached?.data?.matches ?? [];
    } catch (err) {
      console.warn('[matches] falha ao ler cache para reconciliação; usando payload novo:', err);
      return [];
    }
  }
}

/** True se todas as partes pedidas existem no meta e estão finished. */
function allFinished(meta: MetaDoc, ids: string[]): boolean {
  const byId = new Map<string, MatchPartInfo>((meta.parts ?? []).map((p) => [p.id, p]));
  return ids.every((id) => byId.get(id)?.phaseStatus === MatchPartitioner.PhaseStatus.FINISHED);
}

/** Remove campos internos (lastUpdated do servidor) do meta antes de enviar. */
function publicMeta(meta: MetaDoc): MatchesMeta {
  return { competition: meta.competition, season: meta.season, parts: meta.parts };
}

/** Forma pública de uma parte (sem lastUpdated interno). */
function publicPart(p: MatchPart): MatchPart {
  return {
    id: p.id,
    stage: p.stage,
    matchday: p.matchday,
    phaseStatus: p.phaseStatus,
    matches: p.matches,
  };
}
