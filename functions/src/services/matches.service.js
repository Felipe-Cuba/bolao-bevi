import { inject } from '../core/injector.js';
import { MatchesRepository } from '../repositories/matches.repository.js';
import { API_URL, MIN_INTERVAL_MS } from '../config.js';
import { partition, assemble, PhaseStatus } from '../lib/partitions.js';
import { reconcileMatches } from '../lib/reconcile.js';

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
  repo = inject(MatchesRepository);

  // ── Leitura ─────────────────────────────────────────────────────────────────

  /** Payload completo (retrocompat). Mantém o shape { data, updatedAtMs, source }. */
  async getAllMatches() {
    await this.refreshIfStale();
    const { meta, parts } = await this.repo.readAllParts();
    if (meta) {
      return { data: assemble(meta, parts), updatedAtMs: meta.updatedAtMs ?? null, source: 'firestore' };
    }
    // Fallback ao doc legado, se as partes ainda não existirem.
    const cached = await this.repo.readCurrent();
    if (cached) return { data: cached.data, updatedAtMs: cached.updatedAtMs ?? null, source: 'firestore' };
    throw notFound();
  }

  /** Só as partes pedidas + o `_meta`. */
  async getParts(ids) {
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
  async getMeta() {
    await this.refreshIfStale();
    const meta = await this.repo.readMeta();
    if (!meta) throw notFound();
    return { ...publicMeta(meta), updatedAtMs: meta.updatedAtMs ?? null, source: 'firestore' };
  }

  // ── Gate + atualização ───────────────────────────────────────────────────────

  /**
   * Atualiza do upstream se o cache estiver vencido. O gate de 30s usa o `_meta`.
   * Otimização: se todas as partes pedidas já estão `finished` (imutáveis), não chama a
   * API mesmo fora dos 30s.
   */
  async refreshIfStale(requestedIds = null) {
    const meta = await this.repo.readMeta();
    const now = Date.now();

    if (meta && requestedIds && allFinished(meta, requestedIds)) return; // imutável
    if (meta && typeof meta.updatedAtMs === 'number' && now - meta.updatedAtMs < MIN_INTERVAL_MS) {
      return; // gate: ainda fresco
    }

    await this.fetchAndStore();
  }

  /** Busca da API, particiona e grava (partes + meta + doc legado). Tolera falha. */
  async fetchAndStore() {
    let apiRes;
    try {
      apiRes = await fetch(API_URL, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN ?? '' },
      });
    } catch (err) {
      console.error('[matches] falha ao chamar a API:', err);
      return; // mantém o cache atual (stale)
    }

    if (!apiRes.ok) {
      console.warn(`[matches] API retornou ${apiRes.status}; mantendo cache.`);
      return;
    }

    const data = await apiRes.json();
    const updatedAtMs = Date.now();

    // Guard anti-regressão: a API às vezes rebaixa um jogo já encerrado (FINISHED→TIMED),
    // o que sobrescreveria o cache e estragaria a pontuação. Reconcilia contra o cache atual
    // antes de particionar/gravar, congelando jogos que já estavam em estado terminal.
    const reconciled = {
      ...data,
      matches: reconcileMatches(await this.readCachedMatches(), data.matches),
    };
    const { meta, parts } = partition(reconciled);

    await this.repo.writePartitions(meta, parts, updatedAtMs);
    await this.repo.writeCurrent(reconciled, updatedAtMs); // legado (remover ao fim da migração)
  }

  /**
   * Lê os jogos atualmente em cache (partes particionadas, com fallback ao doc legado).
   * Retorna [] se ainda não há nada — aí a reconciliação aceita o payload novo inteiro.
   */
  async readCachedMatches() {
    try {
      const { meta, parts } = await this.repo.readAllParts();
      if (meta) return assemble(meta, parts).matches ?? [];
      const cached = await this.repo.readCurrent();
      return cached?.data?.matches ?? [];
    } catch (err) {
      console.warn('[matches] falha ao ler cache para reconciliação; usando payload novo:', err);
      return [];
    }
  }
}

/** Erro 404 padrão quando não há nada a devolver. */
function notFound() {
  const error = new Error('Partidas indisponíveis (sem cache).');
  error.status = 404;
  return error;
}

/** True se todas as partes pedidas existem no meta e estão finished. */
function allFinished(meta, ids) {
  const byId = new Map((meta.parts ?? []).map((p) => [p.id, p]));
  return ids.every((id) => byId.get(id)?.phaseStatus === PhaseStatus.FINISHED);
}

/** Remove campos internos (lastUpdated do servidor) do meta antes de enviar. */
function publicMeta(meta) {
  return { competition: meta.competition, season: meta.season, parts: meta.parts };
}

/** Forma pública de uma parte (sem lastUpdated interno). */
function publicPart(p) {
  return {
    id: p.id,
    stage: p.stage,
    matchday: p.matchday,
    phaseStatus: p.phaseStatus,
    matches: p.matches,
  };
}
