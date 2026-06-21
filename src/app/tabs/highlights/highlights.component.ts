import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatchCard } from '@shared/components/match-card/match-card.component';
import { MatchRow } from './components/match-row/match-row.component';
import { TopScorersCard } from '../scorers/components/top-scorers-card/top-scorers-card.component';
import { Highlights } from '@shared/utils/match-derivations.util';
import { Scorer } from '@shared/models/match.model';

@Component({
  selector: 'app-highlights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, MatchRow, TopScorersCard],
  template: `
    <!-- Destaque: ao vivo / próximo / último jogo, 3 cards lado a lado -->
    <section class="spotlight">
      @for (m of highlights().live; track m.id) {
        <div class="spotlight__item spotlight__item--live">
          <h2 class="spotlight__label spotlight__label--live"><span class="dot"></span> Ao vivo</h2>
          <app-match-card [match]="m" />
        </div>
      }

      @if (highlights().next; as next) {
        <div class="spotlight__item">
          <h2 class="spotlight__label">Próximo jogo</h2>
          <app-match-card [match]="next" />
        </div>
      }

      @if (highlights().last; as last) {
        <div class="spotlight__item">
          <h2 class="spotlight__label spotlight__label--done">Último jogo</h2>
          <app-match-card [match]="last" />
        </div>
      }
    </section>

    <!-- Corpo: listas (esquerda) + artilheiros (sidebar à direita) -->
    <div class="hl-body">
      <div class="hl-lists">
        <!-- Resultados (finalizados), do mais antigo ao mais recente, por fase -->
        <section class="hl">
          <h2 class="hl__title">Resultados</h2>
          @if (highlights().finishedByStage.length) {
            <div class="list scroll">
              @for (phase of highlights().finishedByStage; track phase.key) {
                <h4 class="phase">{{ phase.label }}</h4>
                @for (m of phase.matches; track m.id) {
                  <app-match-row [match]="m" />
                }
              }
            </div>
          } @else {
            <p class="empty">Nenhum resultado ainda.</p>
          }
        </section>

        <!-- Próximos jogos, do mais próximo ao mais distante, por fase -->
        <section class="hl">
          <h2 class="hl__title">Próximos jogos</h2>
          @if (highlights().upcomingByStage.length) {
            <div class="list scroll">
              @for (phase of highlights().upcomingByStage; track phase.key) {
                <h4 class="phase">{{ phase.label }}</h4>
                @for (m of phase.matches; track m.id) {
                  <app-match-row [match]="m" />
                }
              }
            </div>
          } @else {
            <p class="empty">Nenhum jogo agendado.</p>
          }
        </section>
      </div>

      <aside class="hl-aside">
        <section class="hl">
          <h2 class="hl__title">
            Artilheiros
            <button type="button" class="hl__link" (click)="seeScorers.emit()">Ver todos</button>
          </h2>
          <app-top-scorers-card
            [scorers]="scorers()"
            [showHeader]="false"
            (seeAll)="seeScorers.emit()"
          />
        </section>
      </aside>
    </div>
  `,
  styleUrl: './highlights.component.css',
})
export class HighlightsComponent {
  readonly highlights = input.required<Highlights>();
  readonly scorers = input.required<Scorer[]>();
  readonly seeScorers = output<void>();
}
