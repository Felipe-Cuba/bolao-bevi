import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Team } from '@shared/models/match.model';
import { SimPodium } from '@shared/utils/bracket-sim-play.util';
import { PLACEHOLDER_CREST, teamCrest, teamNamePt } from '@shared/utils/teams.util';

/**
 * Pódio da simulação: 1º (ouro), 2º (prata), 3º (bronze). Cards de tamanho FIXO (não variam
 * com o nome da seleção); medalha e escudo acompanham o card. Posicionado de fora (absolute)
 * para ficar centralizado acima da árvore.
 */
@Component({
  selector: 'app-bracket-podium',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="podium">
      <div class="place place--2" [class.place--set]="podium().runnerUp">
        <span class="place__medal">🥈</span>
        <img class="place__crest" [src]="crest(podium().runnerUp)" [alt]="name(podium().runnerUp)" loading="lazy" />
        <span class="place__name" [title]="name(podium().runnerUp)">{{ name(podium().runnerUp) }}</span>
        <span class="place__cap">Vice</span>
      </div>
      <div class="place place--1" [class.place--set]="podium().champion">
        <span class="place__medal">🏆</span>
        <img class="place__crest" [src]="crest(podium().champion)" [alt]="name(podium().champion)" loading="lazy" />
        <span class="place__name" [title]="name(podium().champion)">{{ name(podium().champion) }}</span>
        <span class="place__cap">Campeã</span>
      </div>
      <div class="place place--3" [class.place--set]="podium().third">
        <span class="place__medal">🥉</span>
        <img class="place__crest" [src]="crest(podium().third)" [alt]="name(podium().third)" loading="lazy" />
        <span class="place__name" [title]="name(podium().third)">{{ name(podium().third) }}</span>
        <span class="place__cap">3º lugar</span>
      </div>
    </div>
  `,
  styleUrl: './podium.component.css',
})
export class BracketPodium {
  readonly podium = input.required<SimPodium>();

  crest(team: Team | null): string {
    return team ? teamCrest(team) : PLACEHOLDER_CREST;
  }

  name(team: Team | null): string {
    return team ? teamNamePt(team) : 'A definir';
  }
}
