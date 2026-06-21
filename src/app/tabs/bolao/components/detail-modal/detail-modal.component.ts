import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideTrophy, LucideX } from '@lucide/angular';

import { teamCrest } from '@shared/utils/teams.util';
import { Match, Team } from '@shared/models/match.model';
import { ScoredGuess } from '@shared/utils/bolao-scoring.util';

/** Linha pronta para render: times, placar real, palpite e pontos. */
interface DetalheRow {
  id: number;
  homeTla: string;
  awayTla: string;
  homeCrest: string;
  awayCrest: string;
  realHome: number;
  realAway: number;
  guessHome: number;
  guessAway: number;
  pts: 0 | 1 | 3;
}

/**
 * Modal de detalhe: lista os palpites que geraram os pontos de uma categoria
 * (Cravou/Acertou/Errou) ou de um grupo. Recebe os itens já filtrados pelo painel.
 */
@Component({
  selector: 'app-bolao-detalhe-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideTrophy, LucideX],
  templateUrl: './detail-modal.component.html',
  styleUrl: './detail-modal.component.css',
})
export class BolaoDetalheModal {
  readonly title = input.required<string>();
  readonly items = input.required<ScoredGuess[]>();

  readonly close = output<void>();

  readonly rows = computed<DetalheRow[]>(() =>
    this.items().map((it) => ({
      id: it.match.id,
      homeTla: this.teamTla(it.match.homeTeam),
      awayTla: this.teamTla(it.match.awayTeam),
      homeCrest: teamCrest(it.match.homeTeam),
      awayCrest: teamCrest(it.match.awayTeam),
      realHome: it.match.score.fullTime.home as number,
      realAway: it.match.score.fullTime.away as number,
      guessHome: it.palpite.home,
      guessAway: it.palpite.away,
      pts: it.pts,
    })),
  );

  private teamTla(team: Match['homeTeam']): string {
    return (team as Team).tla || team.shortName || '—';
  }

  ptsLabel(pts: 0 | 1 | 3): string {
    return pts === 3 ? '+3' : pts === 1 ? '+1' : '0';
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
