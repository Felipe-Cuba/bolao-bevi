// Pipes puros do formulário do Bolão. Pipes puros são memoizados pelo Angular: só
// reexecutam quando os argumentos mudam por referência. Como cada `Match` é um objeto
// estável entre ciclos, os pipes que dependem só do jogo (nome, escudo, placeholder,
// canEdit, scorable, placar real) são calculados uma única vez por linha — eliminando
// as centenas de chamadas de função por change detection que travavam o scroll.

import { Pipe, PipeTransform } from '@angular/core';

import { Match, Team, realScoreText } from '@shared/models/match.model';
import { isPlaceholderTeam, teamCrest, teamNamePt } from '@shared/utils/teams.util';
import {
  advancesFromMatch,
  isKnockout,
  isScorable,
  pointsLabel,
  scoreGuess,
} from '@shared/utils/bolao-scoring.util';
import { DraftLine } from '@shared/models/bolao.model';

@Pipe({ name: 'teamName' })
export class TeamNamePipe implements PipeTransform {
  transform(team: Team): string {
    return teamNamePt(team);
  }
}

@Pipe({ name: 'teamCrest' })
export class TeamCrestPipe implements PipeTransform {
  transform(team: Team): string {
    return teamCrest(team);
  }
}

@Pipe({ name: 'isPlaceholder' })
export class IsPlaceholderPipe implements PipeTransform {
  transform(team: Team): boolean {
    return isPlaceholderTeam(team);
  }
}

@Pipe({ name: 'canEdit' })
export class CanEditPipe implements PipeTransform {
  transform(match: Match): boolean {
    return !isPlaceholderTeam(match.homeTeam) && !isPlaceholderTeam(match.awayTeam);
  }
}

@Pipe({ name: 'isScorable' })
export class IsScorablePipe implements PipeTransform {
  transform(match: Match): boolean {
    return isScorable(match);
  }
}

@Pipe({ name: 'realScore' })
export class RealScorePipe implements PipeTransform {
  transform(match: Match): string | null {
    if (!isScorable(match)) return null;
    return realScoreText(match.score);
  }
}

/** Verdadeiro quando o jogo é de mata-mata (precisa de "quem passa"). */
@Pipe({ name: 'isKnockout' })
export class IsKnockoutPipe implements PipeTransform {
  transform(match: Match): boolean {
    return isKnockout(match);
  }
}

/** Pontos do palpite (0|1|2|3|null) → rótulo: Cravou / Na trave / Acertou / Errou. */
@Pipe({ name: 'ptsLabel' })
export class PtsLabelPipe implements PipeTransform {
  transform(pts: 0 | 1 | 2 | 3 | null): string {
    return pointsLabel(pts);
  }
}

/** Lado que REALMENTE se classificou ('HOME'|'AWAY') no mata-mata já pontuável, ou null. */
@Pipe({ name: 'realAdvancesSide' })
export class RealAdvancesSidePipe implements PipeTransform {
  transform(match: Match): 'HOME' | 'AWAY' | null {
    if (!isKnockout(match) || !isScorable(match)) return null;
    return advancesFromMatch(match);
  }
}


/**
 * Pontos do palpite atual (do rascunho) contra o jogo: 0 | 1 | 2 | 3, ou null quando o jogo
 * ainda não pontua ou a linha está incompleta. Recebe a `DraftLine` específica (não o Map
 * inteiro) para reavaliar só a linha que mudou. No mata-mata usa `line.advances` (quem passa).
 */
@Pipe({ name: 'livePoints' })
export class LivePointsPipe implements PipeTransform {
  transform(match: Match, line: DraftLine | undefined): 0 | 1 | 2 | 3 | null {
    if (!isScorable(match)) return null;
    if (!line || line.home == null || line.away == null) return null;
    return scoreGuess(
      { matchId: match.id, home: line.home, away: line.away, advances: line.advances ?? undefined },
      match,
    );
  }
}
