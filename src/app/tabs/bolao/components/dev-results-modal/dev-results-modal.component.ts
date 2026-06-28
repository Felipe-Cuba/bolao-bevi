// DEV ONLY — modal para forçar os RESULTADOS reais dos jogos só no front (sem tocar no
// banco), para testar como a pontuação do Bolão reage. Espelha a estrutura da modal de
// palpites (abas por fase + linhas de jogo), mas o que se digita aqui é o "placar real".
// Não deve ir para produção: aberta apenas quando DEV_SIM_KO está ligado.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideFlaskConical, LucideShieldOff, LucideX } from '@lucide/angular';

import { Match } from '@shared/models/match.model';
import {
  dedupeByTeamPair,
  groupMatchesPreservingOrder,
  stageLabel,
  STAGE_ORDER,
} from '@shared/utils/match-derivations.util';
import { isKnockout } from '@shared/utils/bolao-scoring.util';
import { Advances } from '@shared/models/bolao.model';
import {
  DevResult,
  DevResults,
  canEditMatch,
  randomDevResult,
} from '@shared/utils/dev-sim-knockout.util';
import {
  CanEditPipe,
  IsKnockoutPipe,
  IsPlaceholderPipe,
  TeamCrestPipe,
  TeamNamePipe,
} from '@shared/pipes/bolao.pipes';

/** Linha de edição de resultado (placar real + quem passa). */
interface DevLine {
  home: number | null;
  away: number | null;
  advances?: Advances | null;
}

@Component({
  selector: 'app-dev-results-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideFlaskConical,
    LucideX,
    LucideShieldOff,
    TeamNamePipe,
    TeamCrestPipe,
    IsPlaceholderPipe,
    CanEditPipe,
    IsKnockoutPipe,
  ],
  templateUrl: './dev-results-modal.component.html',
  styleUrl: './dev-results-modal.component.css',
})
export class DevResultsModal {
  readonly matches = input.required<Match[]>();
  /** Resultados forçados atuais (para pré-carregar a edição). */
  readonly results = input<DevResults>(new Map());

  /** Emite o novo mapa de resultados forçados (aplicado pela página). */
  readonly apply = output<DevResults>();
  readonly close = output<void>();

  readonly activeStage = signal<string | null>(null);

  /** Rascunho dos resultados: matchId → placar/quem passa. */
  readonly draft = signal<Map<number, DevLine>>(new Map());

  /** Fases presentes nos dados, em ordem oficial, com rótulo PT. */
  readonly phases = computed(() => {
    const present = new Set(this.matches().map((m) => String(m.stage)));
    return STAGE_ORDER.filter((s) => present.has(s)).map((stage) => ({
      stage,
      label: stageLabel(stage),
    }));
  });

  readonly isGroupStage = computed(() => this.activeStage() === 'GROUP_STAGE');

  /** Jogos da fase ativa, agrupados por grupo (grupos) ou em fase única (mata-mata). */
  readonly groups = computed(() => {
    const stage = this.activeStage();
    const inStage = this.matches().filter((m) => String(m.stage) === stage);
    if (this.isGroupStage()) {
      return groupMatchesPreservingOrder(inStage);
    }
    // dedupeByTeamPair: salvaguarda contra confrontos repetidos na mesma fase.
    return [
      {
        key: stage ?? 'KO',
        label: stage ? stageLabel(stage) : '',
        matches: dedupeByTeamPair([...inStage].sort((a, b) => a.utcDate.localeCompare(b.utcDate))),
      },
    ];
  });

  constructor() {
    // Pré-carrega o rascunho com os resultados ATUAIS de cada jogo (placar real/forçado já
    // refletido em `fullTime`), para editar a partir do que está valendo. Jogos sem placar
    // ficam vazios. O `advances` vem do override forçado, quando houver.
    effect(() => {
      const forced = this.results();
      const map = new Map<number, DevLine>();
      for (const m of this.matches()) {
        if (!this.canEdit(m)) continue;
        const { home, away } = m.score.fullTime;
        if (home == null || away == null) continue;
        map.set(m.id, { home, away, advances: forced.get(m.id)?.advances ?? null });
      }
      this.draft.set(map);
    });

    // Garante uma fase ativa válida.
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

  canEdit(match: Match): boolean {
    return canEditMatch(match);
  }

  setScore(matchId: number, side: 'home' | 'away', raw: string): void {
    const match = this.matches().find((m) => m.id === matchId);
    if (match && !this.canEdit(match)) return;
    const value = raw === '' ? null : Math.max(0, Math.trunc(Number(raw)));
    this.draft.update((map) => {
      const next = new Map(map);
      const line: DevLine = { ...(next.get(matchId) ?? { home: null, away: null }) };
      line[side] = Number.isNaN(value as number) ? null : value;
      // Placar não-empate no mata-mata define quem passa pelo placar.
      if (match && isKnockout(match) && line.home != null && line.away != null && line.home !== line.away) {
        line.advances = null;
      }
      next.set(matchId, line);
      return next;
    });
  }

  setAdvances(matchId: number, side: Advances): void {
    this.draft.update((map) => {
      const next = new Map(map);
      const line: DevLine = { ...(next.get(matchId) ?? { home: null, away: null }) };
      line.advances = line.advances === side ? null : side;
      next.set(matchId, line);
      return next;
    });
  }

  draftAdvances(line: DevLine | undefined): Advances | null {
    if (!line || line.home == null || line.away == null) return null;
    if (line.home > line.away) return 'HOME';
    if (line.home < line.away) return 'AWAY';
    return line.advances ?? null;
  }

  isDrawLine(line: DevLine | undefined): boolean {
    return !!line && line.home != null && line.away != null && line.home === line.away;
  }

  /** Limpa o resultado forçado de um jogo (volta ao real). */
  clearScore(matchId: number): void {
    this.draft.update((map) => {
      const next = new Map(map);
      next.delete(matchId);
      return next;
    });
  }

  /** DEV: randomiza o placar de UM jogo (0–4 gols; lado aleatório no empate de mata-mata). */
  randomizeOne(matchId: number): void {
    const match = this.matches().find((m) => m.id === matchId);
    if (!match || !this.canEdit(match)) return;
    this.draft.update((map) => {
      const next = new Map(map);
      next.set(matchId, randomDevResult(match));
      return next;
    });
  }

  /** Monta o mapa de resultados (só linhas completas) e emite para a página. */
  applyResults(): void {
    const out = new Map<number, DevResult>();
    for (const [matchId, line] of this.draft()) {
      if (line.home == null || line.away == null) continue;
      const result: DevResult = { home: line.home, away: line.away };
      if (line.home === line.away && line.advances) result.advances = line.advances;
      out.set(matchId, result);
    }
    this.apply.emit(out);
    this.close.emit();
  }

  /** Zera todos os resultados forçados. */
  clearAll(): void {
    this.draft.set(new Map());
  }

  /**
   * DEV: preenche TODOS os jogos editáveis (de todas as fases) com placares aleatórios
   * (0–4 gols), escolhendo um lado ao acaso para passar nos empates de mata-mata.
   */
  randomize(): void {
    const map = new Map<number, DevLine>();
    for (const m of this.matches()) {
      if (this.canEdit(m)) map.set(m.id, randomDevResult(m));
    }
    this.draft.set(map);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
