// Camada de dados dos grupos compartilhados: leitura via @angular/fire (Firestore) e
// escrita via Cloud Function /api/grupos (Rules negam escrita ao cliente).

import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, getDoc, onSnapshot } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { BolaoEntry, Palpite } from '@shared/models/bolao.model';

/** Metadados de um grupo. */
export interface Grupo {
  id: string;
  name: string;
}

/**
 * Serviço de dados dos grupos: leitura reativa do Firestore e escrita pela API REST
 * (Cloud Function). Disponível apenas onde a Function existe (prod/devapi).
 */
@Injectable({ providedIn: 'root' })
export class GruposApi {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  /** URL base da Function de grupos (vazia em dev local puro → modo grupo indisponível). */
  get baseUrl(): string {
    return (environment as { gruposApiUrl?: string }).gruposApiUrl ?? '';
  }

  /** Indica se o modo grupo está disponível neste ambiente. */
  get available(): boolean {
    return this.baseUrl !== '';
  }

  /** Lê os metadados do grupo. Retorna null se não existir (código inválido). */
  async readGroup(groupId: string): Promise<Grupo | null> {
    try {
      const ref = doc(this.firestore, 'grupos', groupId);
      // Firestore precisa rodar no contexto de injeção (evita o warning do @angular/fire).
      const snap = await runInInjectionContext(this.injector, () => getDoc(ref));
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
   * Reflete em tempo real as edições de outros membros. Usa onSnapshot nativo do
   * Firestore (sem rxfire) para não inflar o bundle.
   */
  groupEntries$(groupId: string): Observable<BolaoEntry[]> {
    return new Observable<BolaoEntry[]>((subscriber) => {
      const ref = collection(this.firestore, 'grupos', groupId, 'entries');
      const unsubscribe = runInInjectionContext(this.injector, () =>
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

  /** Cria um grupo no servidor e devolve seu id (= código de acesso). */
  createGroup(name: string): Promise<{ groupId: string; name: string }> {
    return this.request('POST', '', { name });
  }

  /** Cria (entryId ausente = POST) ou atualiza (entryId = PUT) um palpite no grupo. */
  saveEntry(
    groupId: string,
    name: string,
    palpites: Palpite[],
    entryId?: string,
  ): Promise<{ entry: BolaoEntry }> {
    const enc = encodeURIComponent(groupId);
    if (entryId) {
      return this.request('PUT', `/${enc}/entries/${encodeURIComponent(entryId)}`, {
        name,
        palpites,
      });
    }
    return this.request('POST', `/${enc}/entries`, { name, palpites });
  }

  /** Remove um palpite do grupo. */
  removeEntry(groupId: string, entryId: string): Promise<{ ok: true }> {
    return this.request(
      'DELETE',
      `/${encodeURIComponent(groupId)}/entries/${encodeURIComponent(entryId)}`,
    );
  }

  /**
   * Chamada genérica à API REST de grupos. Monta a URL a partir da base (baseUrl) +
   * path, com o tratamento de erro padrão (mensagem do corpo ou status).
   */
  private async request<T>(
    method: 'POST' | 'PUT' | 'DELETE',
    path = '',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const base = this.baseUrl;
    if (!base) throw new Error('Modo grupo indisponível neste ambiente.');
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const body = data as { message?: string; error?: string };
      throw new Error(body.message ?? body.error ?? `Erro ${res.status}.`);
    }
    return data as T;
  }
}
