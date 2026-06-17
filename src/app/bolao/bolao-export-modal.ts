import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideDownload, LucideX } from '@lucide/angular';

import { BolaoEntry } from './bolao.types';

/**
 * Modal de exportação: aparece quando há mais de um palpite. Permite escolher quais
 * exportar (ou marcar "exportar todos"). Emite os palpites selecionados; a página/painel
 * decide como gravar o arquivo (um único JSON ou um array).
 */
@Component({
  selector: 'app-bolao-export-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideDownload, LucideX],
  templateUrl: './bolao-export-modal.html',
  styleUrl: './bolao-export-modal.css',
})
export class BolaoExportModal {
  readonly entries = input.required<BolaoEntry[]>();
  /** Id pré-selecionado (o palpite ativo no painel). */
  readonly initialId = input<string | null>(null);

  readonly close = output<void>();
  readonly confirm = output<BolaoEntry[]>();

  /** Ids marcados para exportação. */
  readonly selectedIds = signal<Set<string>>(new Set());

  constructor() {
    // Inicializa a seleção com o palpite ativo (ou o primeiro).
    queueMicrotask(() => {
      const id = this.initialId() ?? this.entries()[0]?.id;
      this.selectedIds.set(id ? new Set([id]) : new Set());
    });
  }

  readonly allSelected = computed(() => {
    const list = this.entries();
    const sel = this.selectedIds();
    return list.length > 0 && list.every((e) => sel.has(e.id));
  });

  readonly count = computed(() => this.selectedIds().size);

  isChecked(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggle(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleAll(): void {
    const list = this.entries();
    this.selectedIds.set(this.allSelected() ? new Set() : new Set(list.map((e) => e.id)));
  }

  doExport(): void {
    const sel = this.selectedIds();
    const chosen = this.entries().filter((e) => sel.has(e.id));
    if (!chosen.length) return;
    this.confirm.emit(chosen);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
