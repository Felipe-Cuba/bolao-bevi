import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Scorer } from '@shared/models/match.model';
import { teamCrest, teamNamePt } from '@shared/utils/teams.util';

@Component({
  selector: 'app-top-scorers-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card surface-card">
      @if (showHeader()) {
        <header class="card__head">
          <h2 class="card__title">Artilheiros</h2>
          <button type="button" class="card__link" (click)="seeAll.emit()">Ver todos</button>
        </header>
      }

      @if (top().length) {
        <ol class="list">
          @for (s of top(); track s.player.id; let i = $index) {
            <li class="row" [class.row--lead]="i === 0">
              <span class="row__pos">{{ i + 1 }}</span>
              <img
                class="row__crest crest"
                [src]="crest(s.team)"
                [alt]="teamName(s.team)"
                [title]="teamName(s.team)"
                loading="lazy"
              />
              <span class="row__name truncate">{{ s.player.name }}</span>
              <span class="row__goals">{{ s.goals ?? 0 }}</span>
            </li>
          }
        </ol>
      } @else {
        <p class="empty">Nenhum gol marcado ainda.</p>
      }
    </section>
  `,
  styleUrl: './top-scorers-card.component.css',
})
export class TopScorersCard {
  readonly scorers = input.required<Scorer[]>();

  /** Mostra o cabeçalho interno ("Artilheiros / Ver todos"). Desligado quando o pai
   *  já fornece um título externo (ex.: sidebar de Destaques). */
  readonly showHeader = input(true);

  /** Emitido ao clicar em "Ver todos" — o pai troca para a aba Artilheiros. */
  readonly seeAll = output<void>();

  readonly teamName = teamNamePt;
  readonly crest = teamCrest;

  /** Top 5 por gols (desempate por assistências). */
  readonly top = computed(() =>
    [...this.scorers()]
      .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0) || (b.assists ?? 0) - (a.assists ?? 0))
      .slice(0, 5),
  );
}
