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
  LucideDownload,
  LucidePlus,
  LucideSave,
  LucideShieldOff,
  LucideTrash2,
  LucideTrophy,
  LucideUpload,
  LucideX,
} from '@lucide/angular';

import { Match } from '@shared/models/match.model';
import {
  dedupeByTeamPair,
  groupMatchesPreservingOrder,
  stageLabel,
  STAGE_ORDER,
} from '@shared/utils/match-derivations.util';
import { isKnockout } from '@shared/utils/bolao-scoring.util';
import {
  buildPalpite,
  draftAdvances,
  isDrawLine,
  needsAdvances,
} from '@shared/utils/bolao-draft.util';
import { isPlaceholderTeam } from '@shared/utils/teams.util';
import { downloadJson, exportEntry, parseEntries, slugify } from '@shared/utils/bolao-io.util';
import { BolaoStore } from '@core/bolao.store';
import { Advances, DraftLine, Palpite } from '@shared/models/bolao.model';
import {
  CanEditPipe,
  IsKnockoutPipe,
  IsPlaceholderPipe,
  IsScorablePipe,
  LivePointsPipe,
  PtsLabelPipe,
  RealAdvancesSidePipe,
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
    LucideDownload,
    LucideShieldOff,
    LucideUpload,
    TeamNamePipe,
    TeamCrestPipe,
    IsPlaceholderPipe,
    CanEditPipe,
    IsScorablePipe,
    LivePointsPipe,
    IsKnockoutPipe,
    PtsLabelPipe,
    RealScorePipe,
    RealAdvancesSidePipe,
  ],
  templateUrl: './entry-modal.component.html',
  styleUrl: './entry-modal.component.css',
})
export class BolaoModal {
  private readonly store = inject(BolaoStore);

  readonly matches = input.required<Match[]>();
  /** Palpite a pré-selecionar ao abrir (ex.: o selecionado no painel). null = primeiro. */
  readonly initialId = input<string | null>(null);
  /** DEV ONLY: habilita atalhos de desenvolvimento (ex.: zerar um palpite). */
  readonly dev = input<boolean>(false);
  readonly close = output<void>();

  readonly entries = this.store.entries;

  /** Id do palpite em edição. */
  readonly activeId = signal<string | null>(null);
  readonly newName = signal('');
  /** Nome do palpite em edição (editável; salvo junto com os palpites). */
  readonly editName = signal('');

  /** Fase ativa (aba). Default: a primeira fase presente (normalmente GROUP_STAGE). */
  readonly activeStage = signal<string | null>(null);

  /**
   * Modo de edição (switch ao lado do nome). Desligado (padrão): placares ficam só leitura
   * e o seletor "Quem passa?" some — o time escolhido fica realçado (branco/sublinhado).
   * Ligado: inputs editáveis e, no mata-mata, o seletor reaparece.
   */
  readonly editing = signal(false);
  toggleEditing(): void {
    this.editing.update((v) => !v);
  }

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
    // Seleção inicial: o palpite pedido (`initialId`, ex.: o selecionado no painel) se
    // ainda estiver na lista; senão o primeiro. Só age quando nada está ativo.
    effect(() => {
      const list = this.entries();
      if (this.activeId() || !list.length) return;
      const wanted = this.initialId();
      const target = (wanted && list.find((e) => e.id === wanted)) || list[0];
      this.selectEntry(target.id);
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
    // Mantém a seleção compartilhada (painel/chaveamento) em sincronia com a modal.
    this.store.selectEntry(id);
    // Selecionar/trocar de palpite sempre entra em modo LEITURA (switch desligado).
    this.editing.set(false);
    const entry = this.entries().find((e) => e.id === id);
    this.editName.set(entry?.name ?? '');
    const map = new Map<number, DraftLine>();
    for (const p of entry?.palpites ?? []) {
      map.set(p.matchId, { home: p.home, away: p.away, advances: p.advances ?? null });
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
      this.editing.set(true); // palpite novo já abre em modo edição
    } catch (err) {
      this.feedback.set({ kind: 'err', text: (err as Error).message });
    }
  }

  /** Baixa o palpite ativo como JSON. */
  exportActive(): void {
    const entry = this.activeEntry();
    if (!entry) return;
    downloadJson(`bolao-${slugify(entry.name)}.json`, exportEntry(entry));
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
    if (!this.editing()) return; // só em modo edição
    // Guarda: não aceita palpite de confronto ainda não definido (placeholder).
    const match = this.matches().find((m) => m.id === matchId);
    if (match && !this.canEdit(match)) return;

    const value = raw === '' ? null : Math.max(0, Math.trunc(Number(raw)));
    this.draft.update((map) => {
      const next = new Map(map);
      const line: DraftLine = { ...(next.get(matchId) ?? { home: null, away: null }) };
      line[side] = Number.isNaN(value as number) ? null : value;
      // Mata-mata: placar não-empate define o classificado pelo próprio placar — descarta a
      // escolha manual de "quem passa" (ela só vale quando o palpite é de empate).
      if (match && isKnockout(match) && line.home != null && line.away != null && line.home !== line.away) {
        line.advances = null;
      }
      next.set(matchId, line);
      return next;
    });
  }

  /** DEV: zera o palpite de UM jogo (remove a linha do rascunho). Salva ao clicar em "Salvar". */
  clearScore(matchId: number): void {
    this.draft.update((map) => {
      if (!map.has(matchId)) return map;
      const next = new Map(map);
      next.delete(matchId);
      return next;
    });
  }

  /** Define "quem passa" num jogo de mata-mata (usado quando o palpite é de empate). */
  setAdvances(matchId: number, side: Advances): void {
    if (!this.editing()) return; // só em modo edição
    const match = this.matches().find((m) => m.id === matchId);
    if (match && !this.canEdit(match)) return;
    this.draft.update((map) => {
      const next = new Map(map);
      const line: DraftLine = { ...(next.get(matchId) ?? { home: null, away: null }) };
      line.advances = line.advances === side ? null : side; // toggle
      next.set(matchId, line);
      return next;
    });
  }

  /** Lado que se classifica conforme o rascunho (vencedor pelo placar, ou a escolha em empate). */
  draftAdvances(line: DraftLine | undefined): Advances | null {
    return draftAdvances(line);
  }

  /** Linha com placar completo e empatado (no mata-mata, exige escolher "quem passa"). */
  isDrawLine(line: DraftLine | undefined): boolean {
    return isDrawLine(line);
  }

  /** Empate digitado num jogo de mata-mata ainda sem "quem passa" escolhido (palpite incompleto). */
  needsAdvances(match: Match, line: DraftLine | undefined): boolean {
    return needsAdvances(match, line);
  }

  async save(): Promise<void> {
    const id = this.activeId();
    if (!id) return;
    const name = this.editName().trim();
    if (!name) {
      this.feedback.set({ kind: 'err', text: 'O nome do palpite não pode ficar vazio.' });
      return;
    }
    const matchById = new Map(this.matches().map((m) => [m.id, m]));
    const palpites: Palpite[] = [];
    for (const [matchId, line] of this.draft()) {
      if (line.home == null || line.away == null) continue;
      const match = matchById.get(matchId);
      // Mata-mata com empate exige "quem passa"; sem isso o palpite é ambíguo → bloqueia o salvar.
      if (match && needsAdvances(match, line)) {
        this.feedback.set({
          kind: 'err',
          text: 'Indique quem passa nos jogos de mata-mata empatados.',
        });
        return;
      }
      const palpite = buildPalpite(matchId, line, match);
      if (palpite) palpites.push(palpite);
    }
    try {
      await this.store.saveEntry(id, name, palpites);
      this.close.emit();
    } catch (err) {
      this.feedback.set({ kind: 'err', text: (err as Error).message });
    }
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
