import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BolaoStore } from '@core/bolao.store';
import { GruposApi } from '@core/grupo.firestore';

/**
 * Orquestra o "modo grupo": valida o código da URL, liga/desliga o BolaoStore para a
 * fonte do Firestore, e expõe utilidades de UI (nome do grupo, link, copiar, sair, criar).
 */
@Injectable({ providedIn: 'root' })
export class GrupoService {
  private readonly store = inject(BolaoStore);
  private readonly grupos = inject(GruposApi);
  private readonly router = inject(Router);

  /** Nome do grupo ativo (null fora de grupo). */
  readonly name = signal<string | null>(null);
  /** Erro ao entrar no grupo (ex.: código inválido). */
  readonly error = signal<string | null>(null);

  readonly inGroup = this.store.inGroup;
  readonly groupId = this.store.groupId;

  /** Disponível apenas onde a Function de grupos existe (prod/devapi). */
  readonly available = computed(() => this.grupos.available);

  /** Link absoluto do grupo atual, para copiar/compartilhar. */
  readonly link = computed(() => {
    const id = this.groupId();
    return id ? `${location.origin}/g/${id}` : '';
  });

  /**
   * Sincroniza o modo grupo a partir do código da rota. Chamado pela página quando o
   * paramMap muda. Sem código → modo local. Código inválido → erro + modo local.
   */
  async sync(codigo: string | null): Promise<void> {
    this.error.set(null);

    if (!codigo) {
      this.store.groupId.set(null);
      this.name.set(null);
      return;
    }

    const grupo = await this.grupos.readGroup(codigo);
    if (!grupo) {
      this.error.set('Grupo não encontrado. Verifique o link.');
      this.store.groupId.set(null);
      this.name.set(null);
      return;
    }

    this.name.set(grupo.name);
    this.store.groupId.set(codigo);
  }

  /** Cria um grupo no servidor e devolve seu id (código de acesso). */
  async create(name: string): Promise<string> {
    const { groupId } = await this.grupos.createGroup(name);
    return groupId;
  }

  /** Navega para o grupo (entra). */
  enter(groupId: string): void {
    this.router.navigate(['/g', groupId]);
  }

  /** Sai do grupo (volta para a raiz / modo local). */
  leave(): void {
    this.router.navigate(['/']);
  }

  /** Copia o link do grupo para a área de transferência. */
  async copyLink(): Promise<boolean> {
    const url = this.link();
    if (!url) return false;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
}
