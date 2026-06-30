import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Match, MatchStatus, Team, isLive, scoreBreakdown, winnerSide } from '@shared/models/match.model';
import { teamCrest, teamNamePt } from '@shared/utils/teams.util';

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

@Component({
  selector: 'app-match-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.live]="live()" [class.finished]="finished()">
      <header class="card__top">
        <span class="badge" [class.badge--live]="live()" [class.badge--done]="finished()">
          @if (live()) { <span class="dot"></span> }
          {{ statusLabel() }}
        </span>
        <time class="card__date">{{ when() }}</time>
      </header>

      <div class="card__teams">
        <div class="team" [class.team--win]="homeWin()" [class.team--lose]="awayWin()">
          <img class="team__crest crest" [src]="teamCrest(match().homeTeam)" [alt]="teamName(match().homeTeam)" loading="lazy" />
          <span class="team__name" [title]="teamName(match().homeTeam)">{{ teamLabel(match().homeTeam) }}</span>
        </div>

        <div class="score">
          @if (hasScore()) {
            <span class="score__num" [class.score__num--win]="homeWin()">{{ match().score.fullTime.home }}</span>
            <span class="score__sep">×</span>
            <span class="score__num" [class.score__num--win]="awayWin()">{{ match().score.fullTime.away }}</span>
          } @else {
            <span class="score__vs">vs</span>
          }
        </div>

        <div class="team team--away" [class.team--win]="awayWin()" [class.team--lose]="homeWin()">
          <img class="team__crest crest" [src]="teamCrest(match().awayTeam)" [alt]="teamName(match().awayTeam)" loading="lazy" />
          <span class="team__name" [title]="teamName(match().awayTeam)">{{ teamLabel(match().awayTeam) }}</span>
        </div>
      </div>

      @if (breakdown(); as bd) {
        <footer class="card__breakdown">{{ bd }}</footer>
      }
    </article>
  `,
  styleUrl: './match-card.component.css',
})
export class MatchCard {
  readonly match = input.required<Match>();

  readonly teamName = teamNamePt;
  readonly teamCrest = teamCrest;

  /** Nome completo da seleção; cai para "A definir" em placeholders de mata-mata. */
  teamLabel(team: Team): string {
    return teamNamePt(team);
  }

  readonly live = computed(() => isLive(this.match()));
  readonly finished = computed(() => this.match().status === MatchStatus.FINISHED);

  /** Vencedor destacado só quando a partida terminou (evita "vencedor" no meio do jogo). */
  readonly homeWin = computed(() => this.finished() && winnerSide(this.match().score) === 'HOME_TEAM');
  readonly awayWin = computed(() => this.finished() && winnerSide(this.match().score) === 'AWAY_TEAM');
  readonly statusLabel = computed(() => STATUS_LABEL[this.match().status] ?? this.match().status);
  readonly breakdown = computed(() => scoreBreakdown(this.match().score));

  readonly hasScore = computed(() => {
    const ft = this.match().score.fullTime;
    return ft.home != null && ft.away != null;
  });

  readonly when = computed(() => {
    const d = new Date(this.match().utcDate);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  });
}
