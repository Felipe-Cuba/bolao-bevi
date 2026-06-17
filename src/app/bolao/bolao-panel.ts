import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideCalendarDays,
  LucideChevronDown,
  LucideCrosshair,
  LucideDownload,
  LucideGrid3x3,
  LucideMedal,
  LucidePencil,
  LucideThumbsUp,
  LucideTrophy,
  LucideUpload,
  LucideX,
} from '@lucide/angular';

import { Match } from '../wc/wc.types';
import { BolaoStore } from './bolao-store';
import { rankEntries, tallyEntry } from './bolao-scoring';
import {
  downloadJson,
  exportEntries,
  exportEntry,
  parseEntries,
  slugify,
} from './bolao-io';
import { BolaoEntry } from './bolao.types';
import { BolaoExportModal } from './bolao-export-modal';

/** Célula do heatmap de pontos por grupo. */
interface GroupCell {
  label: string;
  value: number;
  /** Intensidade 0–1 relativa ao melhor grupo (para a cor da célula). */
  heat: number;
}

/** Coluna do mini-gráfico de pontos por dia. */
interface DayColumn {
  /** Rótulo curto (dd/mm) para o eixo. */
  label: string;
  points: number;
  jogos: number;
  /** Altura 0–1 relativa ao melhor dia. */
  height: number;
}

@Component({
  selector: 'app-bolao-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideTrophy,
    LucideCrosshair,
    LucideThumbsUp,
    LucideX,
    LucideDownload,
    LucideUpload,
    LucidePencil,
    LucideMedal,
    LucideChevronDown,
    LucideGrid3x3,
    LucideCalendarDays,
  ],
  templateUrl: './bolao-panel.html',
  styleUrl: './bolao-panel.css',
})
export class BolaoPanel {
  private readonly store = inject(BolaoStore);

  readonly matches = input.required<Match[]>();
  /** Pede para a página abrir a modal de palpites (estado vazio / botão editar). */
  readonly openModal = output<void>();

  readonly entries = this.store.entries;
  readonly selectedId = signal<string | null>(null);

  /** Feedback do import (sucesso/erro), exibido inline. */
  readonly feedback = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);

  constructor() {
    effect(() => {
      const list = this.entries();
      const id = this.selectedId();
      if (!list.some((e) => e.id === id)) {
        this.selectedId.set(list[0]?.id ?? null);
      }
    });
  }

  readonly selected = computed(
    () => this.entries().find((e) => e.id === this.selectedId()) ?? null,
  );

  readonly tally = computed(() => {
    const entry = this.selected();
    return entry ? tallyEntry(entry, this.matches()) : null;
  });

  /** Aproveitamento: % dos jogos pontuados em que marcou algum ponto (cravou + acertou). */
  readonly hitRate = computed(() => {
    const t = this.tally();
    if (!t || t.jogosPontuados === 0) return 0;
    return Math.round(((t.cravou + t.acertou) / t.jogosPontuados) * 100);
  });

  /** Heatmap A→L (+ KO se houver): valor por grupo e intensidade relativa ao melhor. */
  readonly groupCells = computed<GroupCell[]>(() => {
    const por = this.tally()?.porGrupo ?? {};
    const letters = 'ABCDEFGHIJKL'.split('');
    const cells: GroupCell[] = letters.map((l) => ({
      label: l,
      value: por[`GROUP_${l}`] ?? 0,
      heat: 0,
    }));
    if (por['KO']) cells.push({ label: 'KO', value: por['KO'], heat: 0 });

    const max = Math.max(0, ...cells.map((c) => c.value));
    if (max > 0) for (const c of cells) c.heat = c.value / max;
    return cells;
  });

  /** Colunas do mini-gráfico de pontos por dia (cronológico). */
  readonly dayColumns = computed<DayColumn[]>(() => {
    const dias = this.tally()?.porDia ?? [];
    const max = Math.max(0, ...dias.map((d) => d.points));
    return dias.map((d) => ({
      label: this.shortDay(d.date),
      points: d.points,
      jogos: d.jogos,
      height: max > 0 ? d.points / max : 0,
    }));
  });

  readonly ranking = computed(() => rankEntries(this.entries(), this.matches()));

  /** "AAAA-MM-DD" → "dd/mm". */
  private shortDay(date: string): string {
    const [, m, d] = date.split('-');
    return `${d}/${m}`;
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  /** Baixa o palpite selecionado como JSON. */
  exportSelected(): void {
    const entry = this.selected();
    if (!entry) return;
    downloadJson(`bolao-${slugify(entry.name)}.json`, exportEntry(entry));
  }

  /** Lê o arquivo escolhido, valida e importa para o store. */
  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = parseEntries(String(reader.result ?? ''));
      if (!result.ok) {
        this.feedback.set({ kind: 'err', text: result.error });
        return;
      }
      try {
        const added = await this.store.importEntries(result.entries);
        if (added[0]) this.selectedId.set(added[0].id);
        const n = added.length;
        this.feedback.set({
          kind: 'ok',
          text: n === 1 ? 'Palpite importado.' : `${n} palpites importados.`,
        });
      } catch (err) {
        this.feedback.set({ kind: 'err', text: (err as Error).message });
      }
    };
    reader.onerror = () => this.feedback.set({ kind: 'err', text: 'Falha ao ler o arquivo.' });
    reader.readAsText(file);
    input.value = ''; // permite reimportar o mesmo arquivo
  }
}
