import { Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { MatchesResponse } from './wc.types';

/** Documento de cache das partidas no Firestore: wcMatches/current. */
export interface WcCacheDoc {
  data: MatchesResponse;
  updatedAtMs: number | null;
}

const COLLECTION = 'wcMatches';
const DOC_ID = 'current';

/**
 * Lê a doc de cache completa do Firestore (dados + updatedAtMs). Retorna null se
 * ainda não existe. Leitura sob demanda (getDoc), não snapshot.
 */
export async function readCurrent(
  injector: Injector,
  fs: Firestore,
): Promise<WcCacheDoc | null> {
  // Firestore deve rodar no contexto de injeção (evita o warning do @angular/fire).
  const snap = await runInInjectionContext(injector, () => getDoc(doc(fs, COLLECTION, DOC_ID)));
  if (!snap.exists()) return null;
  const raw = snap.data() as { data: MatchesResponse; updatedAtMs?: number };
  return { data: raw.data, updatedAtMs: raw.updatedAtMs ?? null };
}
