import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { storageSignal } from 'ngx-oneforall/signals/storage-signal';

import { BolaoEntry, BOLAO_STORAGE_KEY, newEntryId, Palpite } from '@shared/models/bolao.model';
import { GruposApi } from '@core/grupo.firestore';

/**
 * Store dos palpites do bolão com DOIS modos:
 *  - sem grupo (groupId = null): persiste em localStorage, como antes;
 *  - em grupo: `entries` reflete a subcoleção do Firestore (reativa), e as escritas
 *    passam pela Cloud Function (não tocam o localStorage).
 *
 * A API pública (`entries`, `createEntry`, `saveEntry`, `removeEntry`, `importEntries`)
 * é a mesma; no modo grupo os métodos de escrita são assíncronos.
 */
@Injectable({ providedIn: 'root' })
export class BolaoStore {
  private readonly grupos = inject(GruposApi);

  /** Grupo ativo (código = id). null = modo local. */
  readonly groupId = signal<string | null>(null);

  /** Palpites locais (localStorage) — usados fora de grupo. */
  private readonly localEntries = storageSignal<BolaoEntry[]>(BOLAO_STORAGE_KEY, []);

  /** Palpites do grupo ativo (stream do Firestore → signal). Vazio quando sem grupo. */
  private readonly groupEntries = toSignal(
    toObservable(this.groupId).pipe(
      switchMap((id) =>
        id ? this.grupos.groupEntries$(id) : of([] as BolaoEntry[]),
      ),
    ),
    { initialValue: [] as BolaoEntry[] },
  );

  /** Fonte ativa de palpites: grupo (se houver) ou local. */
  readonly entries = computed<BolaoEntry[]>(() =>
    this.groupId() ? this.groupEntries() : this.localEntries(),
  );

  /** Verdadeiro quando operando dentro de um grupo. */
  readonly inGroup = computed(() => this.groupId() !== null);

  // ── Escritas ──────────────────────────────────────────────────────────────
  // No modo local mutam o localStorage (síncrono). No modo grupo chamam a Function;
  // o stream do Firestore atualiza `entries` automaticamente.

  async createEntry(name: string): Promise<BolaoEntry> {
    const clean = name.trim() || 'Sem nome';
    const gid = this.groupId();
    if (gid) {
      const { entry } = await this.grupos.saveEntry(gid, clean, []);
      return entry;
    }
    const entry: BolaoEntry = { id: newEntryId(), name: clean, palpites: [] };
    this.localEntries.update((list: BolaoEntry[]) => [...list, entry]);
    return entry;
  }

  /**
   * Salva nome + palpites de um palpite existente (renomear + editar num passo só).
   * No modo grupo o PUT valida nome único; colisão devolve 409, propagado ao chamador.
   */
  async saveEntry(id: string, name: string, palpites: Palpite[]): Promise<void> {
    const clean = name.trim() || 'Sem nome';
    const gid = this.groupId();
    if (gid) {
      await this.grupos.saveEntry(gid, clean, palpites, id);
      return;
    }
    this.localEntries.update((list: BolaoEntry[]) =>
      list.map((e) => (e.id === id ? { ...e, name: clean, palpites } : e)),
    );
  }

  async removeEntry(id: string): Promise<void> {
    const gid = this.groupId();
    if (gid) {
      await this.grupos.removeEntry(gid, id);
      return;
    }
    this.localEntries.update((list: BolaoEntry[]) => list.filter((e) => e.id !== id));
  }

  /**
   * Adiciona palpites importados. No modo local, resolve colisão de nome com sufixo
   * "(importado)". No modo grupo, envia cada um pela Function (que valida nome único).
   * Devolve as entries efetivamente adicionadas.
   */
  async importEntries(incoming: BolaoEntry[]): Promise<BolaoEntry[]> {
    const gid = this.groupId();
    if (gid) {
      const added: BolaoEntry[] = [];
      const taken = new Set(this.entries().map((e) => e.name));
      for (const entry of incoming) {
        let name = entry.name;
        while (taken.has(name)) name = `${name} (importado)`;
        taken.add(name);
        const { entry: saved } = await this.grupos.saveEntry(gid, name, entry.palpites);
        added.push(saved);
      }
      return added;
    }

    const added: BolaoEntry[] = [];
    this.localEntries.update((list: BolaoEntry[]) => {
      const names = new Set(list.map((e) => e.name));
      const next = [...list];
      for (const entry of incoming) {
        let name = entry.name;
        while (names.has(name)) name = `${name} (importado)`;
        names.add(name);
        const final = { ...entry, name };
        next.push(final);
        added.push(final);
      }
      return next;
    });
    return added;
  }
}
