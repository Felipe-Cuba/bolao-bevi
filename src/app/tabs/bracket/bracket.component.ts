import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BracketTree, TreeNode, TreeSlot } from '@shared/utils/bracket-tree.util';
import { PLACEHOLDER_CREST, teamCrest, teamNamePt } from '@shared/utils/teams.util';

@Component({
  selector: 'app-bracket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <section class="bracket-tree">
      @if (!bracket().thirdsResolved) {
        <p class="bracket-tree__hint">
          Simulação parcial dos 16-avos — os 8 melhores terceiros ainda não estão definidos.
          As fases seguintes mostram os jogos reais (“A definir” até acontecerem).
        </p>
      }

      <div class="bracket-tree__board">
       <div class="bracket-tree__inner">
        <!-- Metade esquerda -->
        <div class="half half--left">
          @for (col of bracket().left; track col.round) {
            <div class="column" [attr.data-round]="col.round">
              <span class="column__label">{{ roundLabel(col.round) }}</span>
              <div class="column__cells">
                @for (node of col.nodes; track node.id) {
                  <div class="cell">
                    <ng-container [ngTemplateOutlet]="matchNode" [ngTemplateOutletContext]="{ $implicit: node }" />
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Centro: final + campeã -->
        <div class="center">
          <span class="column__label center__label">Final</span>
          <ng-container [ngTemplateOutlet]="matchNode" [ngTemplateOutletContext]="{ $implicit: bracket().final }" />
          <div class="center__champion" [class.center__champion--set]="bracket().champion">
            <span class="center__trophy">🏆</span>
            <img class="center__crest" [src]="championCrest()" [alt]="championName()" loading="lazy" />
            <span class="center__name">{{ championName() }}</span>
            <span class="center__caption">Campeã</span>
          </div>
        </div>

        <!-- Metade direita (espelhada) -->
        <div class="half half--right">
          @for (col of bracket().right; track col.round) {
            <div class="column" [attr.data-round]="col.round">
              <span class="column__label">{{ roundLabel(col.round) }}</span>
              <div class="column__cells">
                @for (node of col.nodes; track node.id) {
                  <div class="cell">
                    <ng-container [ngTemplateOutlet]="matchNode" [ngTemplateOutletContext]="{ $implicit: node }" />
                  </div>
                }
              </div>
            </div>
          }
        </div>
       </div>
      </div>
    </section>

    <!-- Template de um confronto (dois slots empilhados) -->
    <ng-template #matchNode let-node>
      <div class="node" [class.node--live]="node.hasMatch && !node.breakdown">
        <div class="node__slot" [class.node__slot--tbd]="!node.home.team" [class.node__slot--win]="node.home.winner">
          <img class="node__crest crest" [src]="slotCrest(node.home)" [alt]="node.home.label" loading="lazy" />
          <span class="node__team" [title]="node.home.label">{{ node.home.label }}</span>
          @if (node.home.score !== null) {
            <span class="node__score">{{ node.home.score }}</span>
          }
        </div>
        <div class="node__slot" [class.node__slot--tbd]="!node.away.team" [class.node__slot--win]="node.away.winner">
          <img class="node__crest crest" [src]="slotCrest(node.away)" [alt]="node.away.label" loading="lazy" />
          <span class="node__team" [title]="node.away.label">{{ node.away.label }}</span>
          @if (node.away.score !== null) {
            <span class="node__score">{{ node.away.score }}</span>
          }
        </div>
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

  slotCrest(slot: TreeSlot): string {
    return slot.team ? teamCrest(slot.team) : PLACEHOLDER_CREST;
  }

  championCrest(): string {
    return teamCrest(this.bracket().champion);
  }

  championName(): string {
    const c = this.bracket().champion;
    return c ? teamNamePt(c) : 'A definir';
  }

  roundLabel(round: TreeNode['round']): string {
    const labels: Record<TreeNode['round'], string> = {
      LAST_32: '16-avos',
      LAST_16: 'Oitavas',
      QUARTER_FINALS: 'Quartas',
      SEMI_FINALS: 'Semis',
      FINAL: 'Final',
    };
    return labels[round];
  }
}
