import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { LucideCheck, LucideCopy, LucideUsers, LucideX } from '@lucide/angular';

import { GrupoService } from './grupo.service';

/**
 * Modal para criar um grupo. Pede o nome, cria via Function e exibe o link gerado
 * com botão de copiar e de entrar no grupo.
 */
@Component({
  selector: 'app-grupo-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideUsers, LucideX, LucideCopy, LucideCheck],
  templateUrl: './grupo-modal.html',
  styleUrl: './grupo-modal.css',
})
export class GrupoModal {
  private readonly grupo = inject(GrupoService);

  readonly close = output<void>();

  readonly name = signal('');
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);

  /** Id do grupo criado (null enquanto não criado). */
  readonly createdId = signal<string | null>(null);

  /** Link absoluto do grupo recém-criado. */
  readonly link = signal('');

  async create(): Promise<void> {
    const name = this.name().trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    this.error.set(null);
    try {
      const id = await this.grupo.create(name);
      this.createdId.set(id);
      this.link.set(`${location.origin}/g/${id}`);
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.creating.set(false);
    }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set('Não foi possível copiar. Copie o link manualmente.');
    }
  }

  enter(): void {
    const id = this.createdId();
    if (id) this.grupo.enter(id);
    this.close.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
