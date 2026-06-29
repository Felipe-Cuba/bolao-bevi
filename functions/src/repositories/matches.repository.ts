import { FieldValue } from 'firebase-admin/firestore';

import { BaseRepository } from './base.repository.js';
import { MATCHES_COLLECTION, MATCHES_DOC_ID, META_DOC_ID } from '#config';
import type {
  AllParts,
  CachedDoc,
  Match,
  MatchPart,
  MatchesMeta,
  MatchesPayload,
  MetaDoc,
  PartDoc,
} from '#models';

/**
 * Repositório do cache de partidas (coleção wcMatches).
 *
 * Particionado por fase+rodada: um doc por parte (`group-1`, ..., `final`) + um doc
 * `_meta` com competition/season e o índice das partes. Mantém também o doc único legado
 * `current` durante a migração (retrocompat com o front antigo).
 */
export class MatchesRepository extends BaseRepository {
  public collectionName = MATCHES_COLLECTION;

  // ── Legado (doc único) — remover ao fim da migração ────────────────────────

  /** Lê o documento de cache legado (ou null se ainda não existe). */
  public async readCurrent(): Promise<CachedDoc<MatchesPayload> | null> {
    return this.findById(MATCHES_DOC_ID);
  }

  /** Grava o payload completo no doc legado, com timestamp de atualização. */
  public async writeCurrent(data: MatchesPayload, updatedAtMs: number) {
    return this.set(MATCHES_DOC_ID, {
      data,
      lastUpdated: FieldValue.serverTimestamp(),
      updatedAtMs,
    });
  }

  // ── Partições ──────────────────────────────────────────────────────────────

  /** Lê o doc `_meta` (índice das partes) ou null. */
  public async readMeta(): Promise<MetaDoc | null> {
    return this.findById(META_DOC_ID);
  }

  /** Lê as partes pedidas (na ordem dada). Ignora ids inexistentes. */
  public async readParts(ids: string[]): Promise<PartDoc[]> {
    const snaps = await Promise.all(ids.map((id) => this.getSnap(id)));
    return snaps.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }) as PartDoc);
  }

  /** Lê todas as partes listadas no `_meta`. */
  public async readAllParts(): Promise<AllParts> {
    const meta = await this.readMeta();
    if (!meta?.parts?.length) return { meta: null, parts: [] };
    const parts = await this.readParts(meta.parts.map((p) => p.id));
    return { meta, parts };
  }

  /**
   * Grava o `_meta` + cada parte num batch. Para reduzir writes, só reescreve a parte
   * cujo conteúdo mudou (compara o array `matches` serializado com o já gravado).
   * Retorna quantas partes foram efetivamente gravadas.
   */
  public async writePartitions(
    meta: MatchesMeta,
    parts: MatchPart[],
    updatedAtMs: number,
  ): Promise<number> {
    // Estado atual das partes, para diff (1 read por parte; barato e evita writes inúteis).
    const existing = await this.readParts(parts.map((p) => p.id));
    const prevById = new Map<string, PartDoc>(existing.map((p) => [p.id, p]));

    const batch = this.collection().firestore.batch();

    batch.set(this.docRef(META_DOC_ID), {
      competition: meta.competition,
      season: meta.season,
      parts: meta.parts,
      lastUpdated: FieldValue.serverTimestamp(),
      updatedAtMs,
    });

    let written = 0;
    for (const part of parts) {
      const prev = prevById.get(part.id);
      if (prev && sameMatches(prev.matches, part.matches)) continue; // inalterada
      batch.set(this.docRef(part.id), {
        id: part.id,
        stage: part.stage,
        matchday: part.matchday,
        phaseStatus: part.phaseStatus,
        matches: part.matches,
        lastUpdated: FieldValue.serverTimestamp(),
        updatedAtMs,
      });
      written++;
    }

    await batch.commit();
    return written;
  }
}

/** Compara duas listas de jogos por conteúdo relevante (status + placar + data). */
function sameMatches(a: Match[], b: Match[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return fingerprint(a) === fingerprint(b);
}

function fingerprint(matches: Match[]): string {
  return matches
    .map((m) => {
      const ft = m.score?.fullTime ?? ({} as Match['score']['fullTime']);
      return [m.id, m.status, m.utcDate, ft.home, ft.away].join(':');
    })
    .join('|');
}
