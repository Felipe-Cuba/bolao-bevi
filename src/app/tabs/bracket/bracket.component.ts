import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  LucideRotateCcw,
  LucideTrophy,
  LucideChevronDown,
  LucideSave,
  LucideCircleQuestionMark,
} from '@lucide/angular';
import { BracketColumn, BracketTree, TreeNode, TreeSlot } from '@shared/utils/bracket-tree.util';
import {
  applyBracketSimulation,
  PickSide,
  prunePicks,
} from '@shared/utils/bracket-sim-play.util';
import { PLACEHOLDER_CREST, teamCrest } from '@shared/utils/teams.util';
import { Match } from '@shared/models/match.model';
import { DraftLine, Palpite } from '@shared/models/bolao.model';
import { BolaoStore } from '@core/bolao.store';
import { buildPalpite, draftAdvances, needsAdvances } from '@shared/utils/bolao-draft.util';
import {
  advancesFromMatch,
  isScorable,
  scoreGuess,
  pointsLabel,
} from '@shared/utils/bolao-scoring.util';
import { HelpModal, HelpBlock } from '@shared/components/help-modal/help-modal.component';
import { BRACKET_HELP } from './bracket-help.content';
import { BracketPodium } from './podium.component';

/** Variante de um card do centro: muda como os vencedores/perdedores são pintados. */
type NodeVariant = 'final' | 'third' | undefined;
type Medal = 'gold' | 'silver' | 'bronze' | null;

@Component({
  selector: 'app-bracket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    LucideRotateCcw,
    LucideTrophy,
    LucideChevronDown,
    LucideSave,
    LucideCircleQuestionMark,
    HelpModal,
    BracketPodium,
  ],
  template: `
    <section class="bracket bolao">
      <div class="bracket__bar">
        <div class="bracket__top">
          @if (entries().length) {
            <div class="picker">
              <svg lucideTrophy class="picker__icon" [size]="16"></svg>
              <select
                class="picker__select"
                [value]="selectedId()"
                (change)="selectEntry($any($event.target).value)"
              >
                @for (e of entries(); track e.id) {
                  <option [value]="e.id" [selected]="e.id === selectedId()">{{ e.name }}</option>
                }
              </select>
              <svg lucideChevronDown class="picker__chevron" [size]="14"></svg>
            </div>
          }
          <button type="button" class="bracket__help" (click)="helpOpen.set(true)">
            <svg lucideCircleQuestionMark [size]="14"></svg> Como funciona?
          </button>
        </div>
        <p class="bracket__tip">
          Palpite nos 16-avos (placar + quem passa); clique para simular as fases seguintes.
        </p>
        <div class="bracket__actions">
          @if (entries().length) {
            <button
              type="button"
              class="bracket__save"
              [disabled]="saving() || !dirty()"
              (click)="save()"
            >
              <svg lucideSave [size]="14"></svg>
              {{ saving() ? 'Salvando…' : dirty() ? 'Salvar palpites' : 'Salvo' }}
            </button>
          }
          @if (hasPicks()) {
            <button type="button" class="bracket__reset" (click)="clearSim()">
              <svg lucideRotateCcw [size]="14"></svg> Limpar simulação
            </button>
          }
        </div>
        @if (feedback(); as f) {
          <p class="bracket__feedback" [class.bracket__feedback--err]="f.kind === 'err'">
            {{ f.text }}
          </p>
        }
      </div>

      @if (!bracket().thirdsResolved) {
        <p class="bracket__hint">
          Confrontos dos 16-avos ainda não carregados. As fases seguintes mostram os
          jogos reais (“A definir” até acontecerem).
        </p>
      }

      <div class="bracket__scroll">
        <div class="bracket__inner">
          <!-- Pódio: faixa absoluta no topo, centralizada sobre o centro da árvore -->
          <app-bracket-podium class="bracket__podium" [podium]="podium()" />

          <!-- Metade esquerda (fluxo →) -->
          <div class="half half--left">
            @for (col of view().left; track col.round) {
              <div class="col" [class.col--feeds]="feeds(col)">
                <span class="col__label">{{ roundLabel(col.round) }}</span>
                <div class="col__cells">
                  @for (node of col.nodes; track node.id) {
                    <div class="cell">
                      <ng-container
                        [ngTemplateOutlet]="matchNode"
                        [ngTemplateOutletContext]="{ $implicit: node }"
                      />
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Centro: final + disputa de 3º (verticalmente centralizados) -->
          <div class="center">
            <span class="col__label center__label">Final</span>
            <ng-container
              [ngTemplateOutlet]="matchNode"
              [ngTemplateOutletContext]="{ $implicit: view().final, variant: 'final' }"
            />

            <span class="col__label center__label center__label--third">Disputa de 3º</span>
            <ng-container
              [ngTemplateOutlet]="matchNode"
              [ngTemplateOutletContext]="{ $implicit: view().thirdPlace, variant: 'third' }"
            />
          </div>

          <!-- Metade direita (espelhada, fluxo ←) -->
          <div class="half half--right">
            @for (col of view().right; track col.round) {
              <div class="col" [class.col--feeds]="feeds(col)">
                <span class="col__label">{{ roundLabel(col.round) }}</span>
                <div class="col__cells">
                  @for (node of col.nodes; track node.id) {
                    <div class="cell">
                      <ng-container
                        [ngTemplateOutlet]="matchNode"
                        [ngTemplateOutletContext]="{ $implicit: node }"
                      />
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </section>

    @if (helpOpen()) {
      <app-help-modal
        title="Como funciona o Chaveamento?"
        [blocks]="helpBlocks"
        (close)="helpOpen.set(false)"
      />
    }

    <!-- Template de um confronto (dois slots empilhados e clicáveis).
         variant: 'final' → vencedor ouro / perdedor prata; 'third' → vencedor bronze.
         Jogo de 16-avos DEFINIDO e em aberto recebe inputs de placar (palpite). -->
    <ng-template #matchNode let-node let-variant="variant">
      <div
        class="node"
        [class.node--live]="node.hasMatch && !node.breakdown"
        [class.node--third]="variant === 'third'"
        [class.node--bet]="playable(node)"
        [class.node--locked]="locked(node)"
      >
        @for (side of sides; track side) {
          <button
            type="button"
            class="slot"
            [class.slot--tbd]="!node[side].team"
            [class.slot--win]="node[side].winner"
            [class.slot--gold]="medal(node, side, variant) === 'gold'"
            [class.slot--silver]="medal(node, side, variant) === 'silver'"
            [class.slot--bronze]="medal(node, side, variant) === 'bronze'"
            [class.slot--pickable]="!!node[side].team"
            [class.slot--adv]="advSide(node) === side"
            [attr.data-bet-pts]="betSlotPts(node, side)"
            [disabled]="!node[side].team"
            (click)="pick(node, side)"
          >
            @if (playable(node)) {
              <input
                class="slot__bet"
                type="number"
                min="0"
                inputmode="numeric"
                [value]="betScore(node, side)"
                (click)="$event.stopPropagation()"
                (input)="setScore(node, side, $any($event.target).value)"
              />
            } @else if (locked(node) && betScore(node, side) !== null) {
              <span class="slot__bet slot__bet--ro">{{ betScore(node, side) }}</span>
            }
            <img class="slot__crest crest" [src]="slotCrest(node[side])" [alt]="node[side].label" loading="lazy" />
            <span class="slot__name" [title]="node[side].label">{{ node[side].label }}</span>
            @if (node[side].score !== null) {
              <span class="slot__score">{{ node[side].score }}</span>
            }
          </button>
        }
        @if (node.breakdown) {
          <span class="node__breakdown">{{ node.breakdown }}</span>
        }
        @if (locked(node) && betPoints(node) !== null) {
          <span class="node__pts" [attr.data-pts]="betPoints(node)">{{ betLabel(node) }}</span>
        }
      </div>
    </ng-template>
  `,
  styleUrl: './bracket.component.css',
})
export class BracketView {
  private readonly store = inject(BolaoStore);

  readonly bracket = input.required<BracketTree>();
  /** Jogos reais (para pontuar/saber o estado FINISHED de cada 16-avo). */
  readonly matches = input<Match[]>([]);

  readonly sides: PickSide[] = ['home', 'away'];

  /** Palpites e seleção compartilhada (vivem no store). */
  readonly entries = this.store.entries;
  readonly selectedId = this.store.selectedEntryId;

  /** Picks do usuário: num-do-jogo → lado que ele decidiu que avança. */
  private readonly picks = signal<ReadonlyMap<number, PickSide>>(new Map());

  /**
   * Picks AUTOMÁTICOS dos jogos já decididos (resultado real): cada jogo encerrado fixa o
   * vencedor real, que assim "sobe" para a fase seguinte na simulação. O usuário não simula
   * esses nós (clique bloqueado), mas pode simular as fases seguintes ainda em aberto.
   */
  private readonly autoPicks = computed<ReadonlyMap<number, PickSide>>(() => {
    const map = new Map<number, PickSide>();
    const collect = (node: TreeNode) => {
      if (node.home.winner) map.set(node.num, 'home');
      else if (node.away.winner) map.set(node.num, 'away');
    };
    const t = this.bracket();
    for (const col of [...t.left, ...t.right]) for (const n of col.nodes) collect(n);
    collect(t.final);
    collect(t.thirdPlace);
    return map;
  });

  /** Picks efetivos: resultados reais (base) + simulação do usuário por cima. */
  private readonly effectivePicks = computed<ReadonlyMap<number, PickSide>>(
    () => new Map([...this.autoPicks(), ...this.picks()]),
  );

  /** Árvore exibida: a projetada/real com os picks (reais + simulação) aplicados. */
  readonly view = computed(() => applyBracketSimulation(this.bracket(), this.effectivePicks()));

  /** Classificação final simulada (1º/2º/3º) para o pódio. */
  readonly podium = computed(() => this.view().podium);

  readonly hasPicks = computed(() => this.picks().size > 0);

  /** Rascunho do palpite selecionado: matchId → placar/quem passa. */
  private readonly draft = signal<Map<number, DraftLine>>(new Map());

  /** Há edições não salvas no rascunho. */
  readonly dirty = signal(false);
  /** Salvamento em andamento. */
  readonly saving = signal(false);
  /** Mensagem de feedback (sucesso/erro) do salvar. */
  readonly feedback = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);

  /** Modal "Como funciona?". */
  readonly helpOpen = signal(false);
  readonly helpBlocks: HelpBlock[] = BRACKET_HELP;

  /** Índice matchId → jogo real (para pontuar e checar FINISHED). */
  private readonly matchById = computed(
    () => new Map(this.matches().map((m) => [m.id, m])),
  );

  constructor() {
    // Carrega o rascunho a partir do palpite selecionado (e some quando troca/limpa).
    // Recarregar descarta edições não salvas do palpite anterior (troca de seleção).
    effect(() => {
      const entry = this.store.selectedEntry();
      const map = new Map<number, DraftLine>();
      for (const p of entry?.palpites ?? []) {
        map.set(p.matchId, { home: p.home, away: p.away, advances: p.advances ?? null });
      }
      this.draft.set(map);
      this.dirty.set(false);
      this.feedback.set(null);
    });
  }

  selectEntry(id: string): void {
    this.store.selectEntry(id);
  }

  // ── Estado de um nó ─────────────────────────────────────────────────────────

  /** Jogo real correspondente ao nó (por matchId), ou undefined. */
  private matchOf(node: TreeNode): Match | undefined {
    return node.matchId != null ? this.matchById().get(node.matchId) : undefined;
  }

  /**
   * Nó já decidido pelo RESULTADO REAL (jogo encerrado/pontuável) — trava o palpite.
   * Baseia-se no jogo real (`matches`), NÃO no `winner` da árvore (que a simulação também
   * marca ao escolher quem avança).
   */
  locked(node: TreeNode): boolean {
    const match = this.matchOf(node);
    return !!match && isScorable(match);
  }

  /** Nó que aceita palpite: 16-avo definido (tem matchId), ainda em aberto. */
  playable(node: TreeNode): boolean {
    return node.round === 'LAST_32' && node.matchId != null && !this.locked(node);
  }

  // ── Palpite (placar + quem passa) ───────────────────────────────────────────

  /** Placar do palpite (rascunho) de um lado do nó, ou null. */
  betScore(node: TreeNode, side: PickSide): number | null {
    if (node.matchId == null) return null;
    const line = this.draft().get(node.matchId);
    if (!line) return null;
    return side === 'home' ? line.home : line.away;
  }

  /** Lado que se classifica conforme o palpite (placar, ou a escolha de empate). */
  advSide(node: TreeNode): PickSide | null {
    if (node.matchId == null) return null;
    const adv = draftAdvances(this.draft().get(node.matchId));
    return adv === 'HOME' ? 'home' : adv === 'AWAY' ? 'away' : null;
  }

  /** Pontos do palpite contra o jogo real (só quando encerrado/pontuável). */
  betPoints(node: TreeNode): 0 | 1 | 2 | 3 | null {
    const match = this.matchOf(node);
    if (!match || !isScorable(match) || node.matchId == null) return null;
    const line = this.draft().get(node.matchId);
    if (!line || line.home == null || line.away == null) return null;
    const palpite: Palpite = {
      matchId: node.matchId,
      home: line.home,
      away: line.away,
      advances: line.advances ?? undefined,
    };
    return scoreGuess(palpite, match);
  }

  betLabel(node: TreeNode): string {
    return pointsLabel(this.betPoints(node));
  }

  /**
   * Pontos para COLORIR o slot do time que REALMENTE passou num jogo encerrado, com a cor do
   * resultado do palpite (Cravou/Na trave/Acertou/Errou). O slot do palpite mantém o `slot--adv`.
   * null fora desse caso (jogo aberto ou outro lado).
   */
  betSlotPts(node: TreeNode, side: PickSide): 0 | 1 | 2 | 3 | null {
    const match = this.matchOf(node);
    if (!match || !this.locked(node)) return null;
    const real = advancesFromMatch(match); // lado que passou de verdade
    const realSide: PickSide | null = real === 'HOME' ? 'home' : real === 'AWAY' ? 'away' : null;
    if (realSide !== side) return null;
    return this.betPoints(node);
  }

  /** Digita o placar de um lado num jogo palpitável; agenda o save. */
  setScore(node: TreeNode, side: PickSide, raw: string): void {
    if (!this.playable(node) || node.matchId == null) return;
    const id = node.matchId;
    const value = raw === '' ? null : Math.max(0, Math.trunc(Number(raw)));
    this.draft.update((map) => {
      const next = new Map(map);
      const line: DraftLine = { ...(next.get(id) ?? { home: null, away: null }) };
      line[side] = Number.isNaN(value as number) ? null : value;
      // Placar não-empate define quem passa pelo placar (limpa a escolha manual de empate).
      if (line.home != null && line.away != null && line.home !== line.away) {
        line.advances = null;
      }
      next.set(id, line);
      return next;
    });
    this.dirty.set(true);
  }

  // ── Clique no card: simulação + "quem passa" do palpite em empate ───────────

  /** Avança (ou desfaz) um time num jogo; alimenta a simulação e, em 16-avo, o palpite. */
  pick(node: TreeNode, side: PickSide): void {
    const slot = node[side];
    if (!slot.team) return; // só dá para escolher um time já definido
    if (this.locked(node)) return; // jogo já decidido: vencedor real manda, sem simular este nó

    // Em jogo palpitável de empate, o clique define "quem passa" do palpite.
    if (this.playable(node) && node.matchId != null) {
      const id = node.matchId;
      const line = this.draft().get(id);
      const isDraw = !!line && line.home != null && line.away != null && line.home === line.away;
      if (isDraw) {
        const advances = side === 'home' ? 'HOME' : 'AWAY';
        this.draft.update((map) => {
          const next = new Map(map);
          const cur: DraftLine = { ...(next.get(id) ?? { home: null, away: null }) };
          cur.advances = cur.advances === advances ? null : advances; // toggle
          next.set(id, cur);
          return next;
        });
        this.dirty.set(true);
      }
    }

    // Simulação (sempre): propaga o vencedor às fases seguintes.
    const next = new Map(this.picks());
    if (next.get(node.num) === side) {
      next.delete(node.num); // toggle: clicar de novo no escolhido desfaz
    } else {
      next.set(node.num, side);
    }
    // Poda sobre os picks EFETIVOS (reais + usuário) para não descartar escolhas que
    // dependem de um vencedor real; depois guarda só a parte do usuário (sem os automáticos).
    const auto = this.autoPicks();
    const pruned = prunePicks(this.bracket(), new Map([...auto, ...next]));
    const userOnly = new Map<number, PickSide>();
    for (const [num, s] of pruned) if (!auto.has(num)) userOnly.set(num, s);
    this.picks.set(userOnly);
  }

  clearSim(): void {
    this.picks.set(new Map());
  }

  // ── Persistência (salvar explícito) ─────────────────────────────────────────

  /** Salva os palpites do rascunho na entry selecionada. Valida empate sem "quem passa". */
  async save(): Promise<void> {
    const entry = this.store.selectedEntry();
    if (!entry) {
      this.feedback.set({ kind: 'err', text: 'Selecione um palpite primeiro.' });
      return;
    }
    const byId = this.matchById();
    const palpites: Palpite[] = [];
    for (const [matchId, line] of this.draft()) {
      if (line.home == null || line.away == null) continue; // linha incompleta: ignora
      const match = byId.get(matchId);
      // Empate de mata-mata exige "quem passa" — sem isso bloqueia (não perde o rascunho).
      if (match && needsAdvances(match, line)) {
        this.feedback.set({
          kind: 'err',
          text: 'Indique quem passa nos jogos empatados (clique numa seleção).',
        });
        return;
      }
      const palpite = buildPalpite(matchId, line, match);
      if (palpite) palpites.push(palpite);
    }
    this.saving.set(true);
    try {
      await this.store.saveEntry(entry.id, entry.name, palpites);
      this.dirty.set(false);
      this.feedback.set({ kind: 'ok', text: 'Palpites salvos.' });
      setTimeout(() => this.feedback.set(null), 2500);
    } catch (err) {
      this.feedback.set({ kind: 'err', text: (err as Error).message });
    } finally {
      this.saving.set(false);
    }
  }

  // ── Apresentação ────────────────────────────────────────────────────────────

  /** Coluna que alimenta a próxima fase (todas, menos as semifinais — borda do centro). */
  feeds(col: BracketColumn): boolean {
    return col.round !== 'SEMI_FINALS';
  }

  slotCrest(slot: TreeSlot): string {
    return slot.team ? teamCrest(slot.team) : PLACEHOLDER_CREST;
  }

  /**
   * Medalha de um slot conforme a variante do card:
   *   final → vencedor 'gold', perdedor (decidido) 'silver';
   *   third → vencedor 'bronze'.
   * Nos demais cards, sem medalha (usa o destaque verde padrão).
   */
  medal(node: TreeNode, side: PickSide, variant: NodeVariant): Medal {
    if (variant === 'final') {
      if (node[side].winner) return 'gold';
      // Perdedor da final = o outro lado, quando o vencedor já foi escolhido.
      const other = side === 'home' ? 'away' : 'home';
      if (node[other].winner && node[side].team) return 'silver';
      return null;
    }
    if (variant === 'third') {
      return node[side].winner ? 'bronze' : null;
    }
    return null;
  }

  roundLabel(round: TreeNode['round']): string {
    const labels: Record<TreeNode['round'], string> = {
      LAST_32: '16-avos',
      LAST_16: 'Oitavas',
      QUARTER_FINALS: 'Quartas',
      SEMI_FINALS: 'Semis',
      FINAL: 'Final',
      THIRD_PLACE: 'Disputa de 3º',
    };
    return labels[round];
  }
}
