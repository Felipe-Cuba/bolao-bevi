import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { MatchesResponse, ScorersResponse } from '@shared/models/match.model';

/** Documento de cache das partidas no Firestore: wcMatches/current. */
export interface WcCacheDoc {
  data: MatchesResponse;
  updatedAtMs: number | null;
}

/** Documento de cache da artilharia no Firestore: wcScorers/current. */
export interface WcScorersDoc {
  data: ScorersResponse;
  updatedAtMs: number | null;
}

/**
 * Acesso de leitura ao cache de partidas e artilharia no Firestore. Leitura sob
 * demanda (getDoc), não snapshot. As escritas são feitas server-side pela Cloud
 * Function (as Rules negam escrita ao cliente).
 */
@Injectable({ providedIn: 'root' })
export class MatchesFirestore {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  private static readonly DOC_ID = 'current';
  private static readonly MATCHES_COLLECTION = 'wcMatches';
  private static readonly SCORERS_COLLECTION = 'wcScorers';

  /** Lê a doc de cache de partidas (dados + updatedAtMs). null se ainda não existe. */
  async readMatches(): Promise<WcCacheDoc | null> {
    const raw = await this.readDoc<MatchesResponse>(MatchesFirestore.MATCHES_COLLECTION);
    return raw ? { data: raw.data, updatedAtMs: raw.updatedAtMs ?? null } : null;
  }

  /** Lê a doc de cache da artilharia (dados + updatedAtMs). null se ainda não existe. */
  async readScorers(): Promise<WcScorersDoc | null> {
    const raw = await this.readDoc<ScorersResponse>(MatchesFirestore.SCORERS_COLLECTION);
    return raw ? { data: raw.data, updatedAtMs: raw.updatedAtMs ?? null } : null;
  }

  /** Leitura genérica da doc `current` de uma coleção de cache. */
  private async readDoc<T>(
    collection: string,
  ): Promise<{ data: T; updatedAtMs?: number } | null> {
    // Firestore deve rodar no contexto de injeção (evita o warning do @angular/fire).
    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, collection, MatchesFirestore.DOC_ID)),
    );
    if (!snap.exists()) return null;
    return snap.data() as { data: T; updatedAtMs?: number };
  }
}
