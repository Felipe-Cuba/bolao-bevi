import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Match, Team, isLive, scoreBreakdown } from './wc.types';
import { teamCrest, teamNamePt } from './teams';

const STATUS_LABEL: Record<string, string> = {
  TIMED: 'Agendado',
  SCHEDULED: 'Agendado',
  LIVE: 'AO VIVO',
  IN_PLAY: 'AO VIVO',
  PAUSED: 'Intervalo',
  FINISHED: 'Encerrado',
  POSTPONED: 'Adiado',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
};

/**
 * Linha compacta de uma partida — formato de lista (não card). Usada nas listas
 * roláveis de finalizados e próximos no dashboard de destaques.
 */
@Component({
  selector: 'app-match-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row" [class.row--live]="live()">
      <time class="row__when">{{ when() }}</time>

      <div class="row__team row__team--home">
        <span class="row__name" [title]="teamName(match().homeTeam)">{{ teamShort(match().homeTeam) }}</span>
        <img class="row__crest" [src]="teamCrest(match().homeTeam)" [alt]="teamName(match().homeTeam)" loading="lazy" />
      </div>

      <div class="row__score">
        @if (hasScore()) {
          <span class="row__num">{{ match().score.fullTime.home }}</span>
          <span class="row__sep">×</span>
          <span class="row__num">{{ match().score.fullTime.away }}</span>
        } @else {
          <span class="row__vs">vs</span>
        }
      </div>

      <div class="row__team row__team--away">
        <img class="row__crest" [src]="teamCrest(match().awayTeam)" [alt]="teamName(match().awayTeam)" loading="lazy" />
        <span class="row__name" [title]="teamName(match().awayTeam)">{{ teamShort(match().awayTeam) }}</span>
      </div>

      <span class="row__tail">
        @if (live()) {
          <span class="row__badge row__badge--live">{{ statusLabel() }}</span>
        } @else if (breakdown(); as bd) {
          <span class="row__extra">{{ bd }}</span>
        }
      </span>
    </div>
  `,
  styleUrl: './match-row.css',
})
export class MatchRow {
  readonly match = input.required<Match>();

  readonly teamName = teamNamePt;
  readonly teamCrest = teamCrest;

  teamShort(team: Team): string {
    return team.tla || team.shortName || '—';
  }

  readonly live = computed(() => isLive(this.match()));
  readonly statusLabel = computed(() => STATUS_LABEL[this.match().status] ?? this.match().status);
  readonly breakdown = computed(() => scoreBreakdown(this.match().score));

  readonly hasScore = computed(() => {
    const ft = this.match().score.fullTime;
    return ft.home != null && ft.away != null;
  });

  readonly when = computed(() => {
    return new Date(this.match().utcDate).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  });
}
