import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LucideRotateCcw } from '@lucide/angular';
import { BracketColumn, BracketTree, TreeNode, TreeSlot } from '@shared/utils/bracket-tree.util';
import {
  applyBracketSimulation,
  PickSide,
  prunePicks,
} from '@shared/utils/bracket-sim-play.util';
import { PLACEHOLDER_CREST, teamCrest } from '@shared/utils/teams.util';
import { BracketPodium } from './podium.component';

/** Variante de um card do centro: muda como os vencedores/perdedores são pintados. */
type NodeVariant = 'final' | 'third' | undefined;
type Medal = 'gold' | 'silver' | 'bronze' | null;

@Component({
  selector: 'app-bracket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, LucideRotateCcw, BracketPodium],
  template: `
    <section class="bracket">
      <div class="bracket__bar">
        <p class="bracket__tip">
          Toque numa seleção para avançá-la — monte sua simulação até a final.
        </p>
        @if (hasPicks()) {
          <button type="button" class="bracket__reset" (click)="clearSim()">
            <svg lucideRotateCcw [size]="14"></svg> Limpar simulação
          </button>
        }
      </div>

      @if (!bracket().thirdsResolved) {
        <p class="bracket__hint">
          Simulação parcial dos 16-avos — os 8 melhores terceiros ainda não estão definidos.
          As fases seguintes mostram os jogos reais (“A definir” até acontecerem).
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

    <!-- Template de um confronto (dois slots empilhados e clicáveis).
         variant: 'final' → vencedor ouro / perdedor prata; 'third' → vencedor bronze. -->
    <ng-template #matchNode let-node let-variant="variant">
      <div
        class="node"
        [class.node--live]="node.hasMatch && !node.breakdown"
        [class.node--third]="variant === 'third'"
      >
        <button
          type="button"
          class="slot"
          [class.slot--tbd]="!node.home.team"
          [class.slot--win]="node.home.winner"
          [class.slot--gold]="medal(node, 'home', variant) === 'gold'"
          [class.slot--silver]="medal(node, 'home', variant) === 'silver'"
          [class.slot--bronze]="medal(node, 'home', variant) === 'bronze'"
          [class.slot--pickable]="!!node.home.team"
          [disabled]="!node.home.team"
          (click)="pick(node, 'home')"
        >
          <img class="slot__crest crest" [src]="slotCrest(node.home)" [alt]="node.home.label" loading="lazy" />
          <span class="slot__name" [title]="node.home.label">{{ node.home.label }}</span>
          @if (node.home.score !== null) {
            <span class="slot__score">{{ node.home.score }}</span>
          }
        </button>
        <button
          type="button"
          class="slot"
          [class.slot--tbd]="!node.away.team"
          [class.slot--win]="node.away.winner"
          [class.slot--gold]="medal(node, 'away', variant) === 'gold'"
          [class.slot--silver]="medal(node, 'away', variant) === 'silver'"
          [class.slot--bronze]="medal(node, 'away', variant) === 'bronze'"
          [class.slot--pickable]="!!node.away.team"
          [disabled]="!node.away.team"
          (click)="pick(node, 'away')"
        >
          <img class="slot__crest crest" [src]="slotCrest(node.away)" [alt]="node.away.label" loading="lazy" />
          <span class="slot__name" [title]="node.away.label">{{ node.away.label }}</span>
          @if (node.away.score !== null) {
            <span class="slot__score">{{ node.away.score }}</span>
          }
        </button>
        @if (node.breakdown) {
          <span class="node__breakdown">{{ node.breakdown }}</span>
        }
      </div>
    </ng-template>
  `,
  styleUrl: './bracket.component.css',
})
export class BracketView {
  readonly bracket = input.required<BracketTree>();

  /** Picks do usuário: num-do-jogo → lado que ele decidiu que avança. */
  private readonly picks = signal<ReadonlyMap<number, PickSide>>(new Map());

  /** Árvore exibida: a projetada/real com os picks da simulação aplicados. */
  readonly view = computed(() => applyBracketSimulation(this.bracket(), this.picks()));

  /** Classificação final simulada (1º/2º/3º) para o pódio. */
  readonly podium = computed(() => this.view().podium);

  readonly hasPicks = computed(() => this.picks().size > 0);

  /** Avança (ou desfaz) um time num jogo; a cascata a jusante é limpa automaticamente. */
  pick(node: TreeNode, side: PickSide): void {
    const slot = node[side];
    if (!slot.team) return; // só dá para escolher um time já definido

    const next = new Map(this.picks());
    if (next.get(node.num) === side) {
      next.delete(node.num); // toggle: clicar de novo no escolhido desfaz
    } else {
      next.set(node.num, side);
    }
    // Poda picks que ficaram órfãos (times que deixaram de chegar até eles).
    this.picks.set(prunePicks(this.bracket(), next));
  }

  clearSim(): void {
    this.picks.set(new Map());
  }

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
