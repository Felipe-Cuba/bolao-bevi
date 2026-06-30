import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideTrophy, LucideX } from '@lucide/angular';

import { teamCrest } from '@shared/utils/teams.util';
import { Match, Team, realScoreText } from '@shared/models/match.model';
import { ScoredGuess, advancesFromMatch, isKnockout } from '@shared/utils/bolao-scoring.util';
import { Advances } from '@shared/models/bolao.model';
import { ShortNamePtPipe } from '@shared/pipes/match-labels.pipes';
import { PtsLabelPipe } from '@shared/pipes/bolao.pipes';

/** Linha pronta para render: times, placar real, palpite e pontos. */
interface DetalheRow {
  id: number;
  homeTla: string;
  awayTla: string;
  homeCrest: string;
  awayCrest: string;
  /** Placar real formatado (inclui "(x×y P)" em pênaltis). */
  realText: string;
  guessHome: number;
  guessAway: number;
  pts: 0 | 1 | 2 | 3;
  /** Lado que REALMENTE se classificou no mata-mata ('HOME'|'AWAY'), p/ colorir só o vencedor. */
  realSide: 'HOME' | 'AWAY' | null;
  /** TLA do time que o PALPITE indicou vencer/passar (null em palpite de empate sem escolha). */
  guessTla: string | null;
}

/**
 * Modal de detalhe: lista os palpites que geraram os pontos de uma categoria
 * (Cravou/Acertou/Errou) ou de um grupo. Recebe os itens já filtrados pelo painel.
 */
@Component({
  selector: 'app-bolao-detalhe-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideTrophy, LucideX, ShortNamePtPipe, PtsLabelPipe],
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
      realText: realScoreText(it.match.score) ?? '',
      guessHome: it.palpite.home,
      guessAway: it.palpite.away,
      pts: it.pts,
      realSide: isKnockout(it.match) ? advancesFromMatch(it.match) : null,
      guessTla: this.sideTla(it.match, this.guessSide(it)),
    })),
  );

  private teamTla(team: Match['homeTeam']): string {
    return (team as Team).tla || team.shortName || '—';
  }

  /** TLA do time de um lado do confronto, ou null. */
  private sideTla(match: Match, side: Advances | null): string | null {
    if (side === 'HOME') return this.teamTla(match.homeTeam);
    if (side === 'AWAY') return this.teamTla(match.awayTeam);
    return null;
  }

  /** Lado que o palpite indica vencer/passar: vencedor pelo placar, ou a escolha em empate. */
  private guessSide(it: ScoredGuess): Advances | null {
    const { home, away, advances } = it.palpite;
    if (home > away) return 'HOME';
    if (home < away) return 'AWAY';
    return advances ?? null;
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
