// Camada de dados dos grupos compartilhados: leitura via @angular/fire (Firestore) e
// escrita via Cloud Function /api/grupos (Rules negam escrita ao cliente).

import { Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { BolaoEntry, Palpite } from './bolao.types';

/** Metadados de um grupo. */
export interface Grupo {
  id: string;
  name: string;
}

/** URL da Cloud Function de grupos (vazia em dev local puro → modo grupo indisponível). */
export function gruposApiUrl(): string {
  return (environment as { gruposApiUrl?: string }).gruposApiUrl ?? '';
}

/** Lê os metadados do grupo. Retorna null se não existir (código inválido). */
export async function readGroup(
  injector: Injector,
  fs: Firestore,
  groupId: string,
): Promise<Grupo | null> {
  try {
    // Firestore precisa rodar no contexto de injeção (evita o warning do @angular/fire).
  const ref = doc(fs, 'grupos', groupId);
  console.info('[readGroup] path =>', ref.path, '| db =>', (fs as { _databaseId?: { database?: string; projectId?: string } })._databaseId);
  const snap = await runInInjectionContext(injector, () => getDoc(ref));

  console.info('[readGroup] exists =>', snap.exists(), '| fromCache =>', snap.metadata.fromCache);

  if (!snap.exists()) return null;
  const raw = snap.data() as { name?: string };
  return { id: groupId, name: raw.name ?? 'Grupo' };
  } catch (err) {
    console.warn('Falha ao ler grupo do Firestore:', err);
    return null;
  }
}

/**
 * Stream reativo dos palpites de um grupo (subcoleção entries), ordenado por nome.
 * Reflete em tempo real as edições de outros membros. Usa onSnapshot nativo do Firestore
 * (sem rxfire) para não inflar o bundle.
 */
export function groupEntries$(
  injector: Injector,
  fs: Firestore,
  groupId: string,
): Observable<BolaoEntry[]> {
  return new Observable<BolaoEntry[]>((subscriber) => {
    const ref = collection(fs, 'grupos', groupId, 'entries');
    const unsubscribe = runInInjectionContext(injector, () =>
      onSnapshot(
        ref,
        (snap) => {
        const list = snap.docs
          .map((d) => {
            const r = d.data() as { name?: string; palpites?: Palpite[] };
            return {
              id: d.id,
              name: r.name ?? 'Sem nome',
              palpites: Array.isArray(r.palpites) ? r.palpites : [],
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
          subscriber.next(list);
        },
        (err) => subscriber.error(err),
      ),
    );
    return unsubscribe;
  });
}

/** Resposta padrão de erro da Function. */
async function postGrupos<T>(payload: Record<string, unknown>): Promise<T> {
  const url = gruposApiUrl();
  if (!url) throw new Error('Modo grupo indisponível neste ambiente.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Erro ${res.status}.`);
  }
  return data as T;
}

/** Cria um grupo no servidor e devolve seu id (= código de acesso). */
export function createGroupApi(name: string): Promise<{ groupId: string; name: string }> {
  return postGrupos({ action: 'createGroup', name });
}

/** Cria/atualiza um palpite no grupo (entryId ausente = novo). */
export function saveEntryApi(
  groupId: string,
  name: string,
  palpites: Palpite[],
  entryId?: string,
): Promise<{ entry: BolaoEntry }> {
  return postGrupos({ action: 'saveEntry', groupId, entryId, name, palpites });
}

/** Remove um palpite do grupo. */
export function removeEntryApi(groupId: string, entryId: string): Promise<{ ok: true }> {
  return postGrupos({ action: 'removeEntry', groupId, entryId });
}
