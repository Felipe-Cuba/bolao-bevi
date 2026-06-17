import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatchCard } from './match-card';
import { MatchGroup } from './wc-derivations';

@Component({
  selector: 'app-match-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchCard],
  template: `
    @for (g of groups(); track g.key) {
      <section class="ml__group">
        <h3 class="ml__title">{{ g.label }}</h3>
        <div class="grid">
          @for (m of g.matches; track m.id) {
            <app-match-card [match]="m" />
          }
        </div>
      </section>
    } @empty {
      <p class="empty">Nenhuma partida para os filtros selecionados.</p>
    }
  `,
  styleUrl: './match-list.css',
})
export class MatchList {
  readonly groups = input.required<MatchGroup[]>();
}
