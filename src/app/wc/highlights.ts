import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatchCard } from './match-card';
import { MatchRow } from './match-row';
import { Highlights } from './wc-derivations';

@Component({
  selector: 'app-highlights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard, MatchRow],
  template: `
    <!-- Destaque: ao vivo / próximo jogo + último jogo, em cards -->
    <section class="spotlight">
      @if (highlights().live.length) {
        @for (m of highlights().live; track m.id) {
          <div class="spotlight__item">
            <h2 class="spotlight__label"><span class="dot"></span> Ao vivo</h2>
            <app-match-card [match]="m" />
          </div>
        }
      } @else if (highlights().next; as next) {
        <div class="spotlight__item">
          <h2 class="spotlight__label">Próximo jogo</h2>
          <app-match-card [match]="next" />
        </div>
      }

      @if (highlights().last; as last) {
        <div class="spotlight__item">
          <h2 class="spotlight__label">Último jogo</h2>
          <app-match-card [match]="last" />
        </div>
      }
    </section>

    <!-- Lista de resultados (finalizados), do mais antigo ao mais recente, por fase -->
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

    <!-- Lista de próximos jogos, do mais próximo ao mais distante, por fase -->
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
  `,
  styleUrl: './highlights.css',
})
export class HighlightsComponent {
  readonly highlights = input.required<Highlights>();
}
