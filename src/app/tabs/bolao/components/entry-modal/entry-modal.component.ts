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
  LucidePlus,
  LucideSave,
  LucideShieldOff,
  LucideTrash2,
  LucideTrophy,
  LucideUpload,
  LucideX,
} from '@lucide/angular';

import { Match } from '@shared/models/match.model';
import { groupMatchesPreservingOrder, stageLabel, STAGE_ORDER } from '@shared/utils/match-derivations.util';
import { isPlaceholderTeam } from '@shared/utils/teams.util';
import { parseEntries } from '@shared/utils/bolao-io.util';
import { BolaoStore } from '@core/bolao.store';
import { DraftLine, Palpite } from '@shared/models/bolao.model';
import {
  CanEditPipe,
  IsPlaceholderPipe,
  IsScorablePipe,
  LivePointsPipe,
  RealScorePipe,
  TeamCrestPipe,
  TeamNamePipe,
} from '@shared/pipes/bolao.pipes';

@Component({
  selector: 'app-bolao-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideTrophy,
    LucideX,
    LucidePlus,
    LucideTrash2,
    LucideSave,
    LucideShieldOff,
    LucideUpload,
    TeamNamePipe,
    TeamCrestPipe,
    IsPlaceholderPipe,
    CanEditPipe,
    IsScorablePipe,
    RealScorePipe,
    LivePointsPipe,
  ],
  templateUrl: './entry-modal.component.html',
  styleUrl: './entry-modal.component.css',
})
export class BolaoModal {
  private readonly store = inject(BolaoStore);

  readonly matches = input.required<Match[]>();
  readonly close = output<void>();

  readonly entries = this.store.entries;

  /** Id do palpite em edição. */
  readonly activeId = signal<string | null>(null);
  readonly newName = signal('');

  /** Fase ativa (aba). Default: a primeira fase presente (normalmente GROUP_STAGE). */
  readonly activeStage = signal<string | null>(null);

  /** Feedback do import (sucesso/erro), exibido inline. */
  readonly feedback = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);

  /** Rascunho dos palpites: matchId → placar digitado. */
  readonly draft = signal<Map<number, DraftLine>>(new Map());

  readonly activeEntry = computed(() => {
    const id = this.activeId();
    return this.entries().find((e) => e.id === id) ?? null;
  });

  /** Fases presentes nos dados, em ordem oficial, com rótulo PT. */
  readonly phases = computed(() => {
    const present = new Set(this.matches().map((m) => String(m.stage)));
    return STAGE_ORDER.filter((s) => present.has(s)).map((stage) => ({
      stage,
      label: stageLabel(stage),
    }));
  });

  /** Verdadeiro quando a aba ativa é a fase de grupos (renderiza sub-seções por grupo). */
  readonly isGroupStage = computed(() => this.activeStage() === 'GROUP_STAGE');

  /** Jogos da fase ativa, agrupados por grupo (fase de grupos) ou em fase única (mata-mata). */
  readonly groups = computed(() => {
    const stage = this.activeStage();
    const inStage = this.matches().filter((m) => String(m.stage) === stage);
    if (this.isGroupStage()) {
      return groupMatchesPreservingOrder(inStage);
    }
    // Mata-mata: uma única seção com os confrontos da fase, em ordem cronológica.
    return [
      {
        key: stage ?? 'KO',
        label: stage ? stageLabel(stage) : '',
        matches: [...inStage].sort((a, b) => a.utcDate.localeCompare(b.utcDate)),
      },
    ];
  });

  constructor() {
    // Seleciona o primeiro palpite automaticamente quando existir e nada estiver ativo.
    effect(() => {
      const list = this.entries();
      if (!this.activeId() && list.length) {
        this.selectEntry(list[0].id);
      }
    });

    // Garante uma fase ativa válida assim que as fases forem conhecidas.
    effect(() => {
      const phases = this.phases();
      const current = this.activeStage();
      if (phases.length && !phases.some((p) => p.stage === current)) {
        this.activeStage.set(phases[0].stage);
      }
    });
  }

  setStage(stage: string): void {
    this.activeStage.set(stage);
  }

  /** Só é editável quando os dois confrontos da partida estão definidos (sem placeholders). */
  canEdit(match: Match): boolean {
    return !isPlaceholderTeam(match.homeTeam) && !isPlaceholderTeam(match.awayTeam);
  }

  selectEntry(id: string): void {
    this.activeId.set(id);
    const entry = this.entries().find((e) => e.id === id);
    const map = new Map<number, DraftLine>();
    for (const p of entry?.palpites ?? []) {
      map.set(p.matchId, { home: p.home, away: p.away });
    }
    this.draft.set(map);
  }

  async createEntry(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    try {
      const entry = await this.store.createEntry(name);
      this.newName.set('');
      this.selectEntry(entry.id);
    } catch (err) {
      this.feedback.set({ kind: 'err', text: (err as Error).message });
    }
  }

  /** Lê o arquivo escolhido, valida e importa para o store (mesma lógica do painel). */
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
        if (added[0]) this.selectEntry(added[0].id);
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
    input.value = '';
  }

  async removeActive(): Promise<void> {
    const id = this.activeId();
    if (!id) return;
    try {
      await this.store.removeEntry(id);
      this.activeId.set(null);
      this.draft.set(new Map());
    } catch (err) {
      this.feedback.set({ kind: 'err', text: (err as Error).message });
    }
  }

  setScore(matchId: number, side: 'home' | 'away', raw: string): void {
    // Guarda: não aceita palpite de confronto ainda não definido (placeholder).
    const match = this.matches().find((m) => m.id === matchId);
    if (match && !this.canEdit(match)) return;

    const value = raw === '' ? null : Math.max(0, Math.trunc(Number(raw)));
    this.draft.update((map) => {
      const next = new Map(map);
      const line = { ...(next.get(matchId) ?? { home: null, away: null }) };
      line[side] = Number.isNaN(value as number) ? null : value;
      next.set(matchId, line);
      return next;
    });
  }

  async save(): Promise<void> {
    const id = this.activeId();
    if (!id) return;
    const palpites: Palpite[] = [];
    for (const [matchId, line] of this.draft()) {
      if (line.home == null || line.away == null) continue;
      palpites.push({ matchId, home: line.home, away: line.away });
    }
    try {
      await this.store.setPalpites(id, palpites);
      this.close.emit();
    } catch (err) {
      this.feedback.set({ kind: 'err', text: (err as Error).message });
    }
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
