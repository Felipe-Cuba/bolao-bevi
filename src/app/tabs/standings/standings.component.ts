import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GroupStanding } from '@shared/utils/match-derivations.util';
import { teamCrest, teamNamePt } from '@shared/utils/teams.util';

@Component({
  selector: 'app-standings-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="standings">
      @for (g of standings(); track g.group) {
        <div class="standings__group surface-card">
          <h3 class="standings__title">{{ g.label }}</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-table__pos">#</th>
                <th class="table__team">Time</th>
                <th title="Pontos">P</th>
                <th title="Jogos">J</th>
                <th title="Vitórias">V</th>
                <th title="Empates">E</th>
                <th title="Derrotas">D</th>
                <th title="Saldo de gols">SG</th>
              </tr>
            </thead>
            <tbody>
              @for (row of g.rows; track row.team.id; let i = $index) {
                <tr [class.qualify]="i < 2">
                  <td class="data-table__pos">{{ i + 1 }}</td>
                  <td class="table__team">
                    <img class="table__crest crest" [src]="teamCrest(row.team)" [alt]="teamName(row.team)" loading="lazy" />
                    <span>{{ teamName(row.team) }}</span>
                  </td>
                  <td class="table__pts">{{ row.points }}</td>
                  <td>{{ row.played }}</td>
                  <td>{{ row.won }}</td>
                  <td>{{ row.drawn }}</td>
                  <td>{{ row.lost }}</td>
                  <td>{{ row.goalDiff > 0 ? '+' + row.goalDiff : row.goalDiff }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @empty {
        <p class="empty">Sem jogos encerrados na fase de grupos ainda.</p>
      }
    </section>
  `,
  styleUrl: './standings.component.css',
})
export class StandingsTable {
  readonly standings = input.required<GroupStanding[]>();

  readonly teamName = teamNamePt;
  readonly teamCrest = teamCrest;
}
