import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Scorer } from '@shared/models/match.model';
import { teamCrest, teamNamePt } from '@shared/utils/teams.util';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-scorers-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sorted().length) {
      <!-- Pódio: top 3 artilheiros -->
      <section class="podium">
        @for (s of podium(); track s.player.id; let i = $index) {
          <article class="pod" [class.pod--1]="i === 0" [class.pod--2]="i === 1" [class.pod--3]="i === 2">
            <div class="pod__rank">{{ i + 1 }}</div>
            <img
              class="pod__crest"
              [src]="crest(s.team)"
              [alt]="teamName(s.team)"
              [title]="teamName(s.team)"
              loading="lazy"
            />
            <div class="pod__name truncate" [title]="s.player.name">{{ s.player.name }}</div>
            <div class="pod__team truncate">{{ teamName(s.team) }}</div>
            <div class="pod__goals">{{ s.goals ?? 0 }}<span class="pod__goals-lab">gols</span></div>
          </article>
        }
      </section>

      <!-- Tabela: do 4º em diante -->
      @if (rest().length) {
        <section class="scorers surface-card">
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-table__pos">#</th>
                <th class="table__player">Jogador</th>
                <th title="Gols">G</th>
                <th title="Assistências">A</th>
                <th title="Pênaltis">P</th>
                <th title="Jogos">J</th>
              </tr>
            </thead>
            <tbody>
              @for (s of rest(); track s.player.id; let i = $index) {
                <tr>
                  <td class="data-table__pos">{{ i + 4 }}</td>
                  <td class="table__player">
                    <img
                      class="table__crest crest"
                      [src]="crest(s.team)"
                      [alt]="teamName(s.team)"
                      [title]="teamName(s.team)"
                      loading="lazy"
                    />
                    <span class="table__name">
                      {{ s.player.name }}
                      <small class="table__team">{{ teamName(s.team) }}</small>
                    </span>
                  </td>
                  <td class="table__goals">{{ s.goals ?? 0 }}</td>
                  <td>{{ s.assists ?? 0 }}</td>
                  <td>{{ s.penalties ?? 0 }}</td>
                  <td>{{ s.playedMatches ?? 0 }}</td>
                </tr>
              }
            </tbody>
          </table>

          @if (hasMore()) {
            <button type="button" class="more" (click)="showMore()">
              Ver mais ({{ sorted().length - visible().length }})
            </button>
          }
        </section>
      }
    } @else {
      <p class="empty">Nenhum gol marcado ainda.</p>
    }
  `,
  styleUrl: './scorers.component.css',
})
export class ScorersTable {
  readonly scorers = input.required<Scorer[]>();

  readonly teamName = teamNamePt;
  readonly crest = teamCrest;

  /** Quantos itens mostrar (paginação local). */
  private readonly limit = signal(PAGE_SIZE);

  /** Ordena por gols desc, desempate por assistências desc. */
  readonly sorted = computed(() =>
    [...this.scorers()].sort(
      (a, b) => (b.goals ?? 0) - (a.goals ?? 0) || (b.assists ?? 0) - (a.assists ?? 0),
    ),
  );

  readonly visible = computed(() => this.sorted().slice(0, this.limit()));
  readonly hasMore = computed(() => this.limit() < this.sorted().length);

  /** Top 3 (pódio). */
  readonly podium = computed(() => this.sorted().slice(0, 3));

  /** Do 4º em diante, respeitando a paginação local. */
  readonly rest = computed(() => this.visible().slice(3));

  showMore(): void {
    this.limit.update((n) => n + PAGE_SIZE);
  }
}
