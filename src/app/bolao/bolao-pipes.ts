// Pipes puros do formulário do Bolão. Pipes puros são memoizados pelo Angular: só
// reexecutam quando os argumentos mudam por referência. Como cada `Match` é um objeto
// estável entre ciclos, os pipes que dependem só do jogo (nome, escudo, placeholder,
// canEdit, scorable, placar real) são calculados uma única vez por linha — eliminando
// as centenas de chamadas de função por change detection que travavam o scroll.

import { Pipe, PipeTransform } from '@angular/core';

import { Match, Team } from '../wc/wc.types';
import { isPlaceholderTeam, teamCrest, teamNamePt } from '../wc/teams';
import { isScorable, scoreGuess } from './bolao-scoring';
import { DraftLine } from './bolao.types';

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
    return `${match.score.fullTime.home}×${match.score.fullTime.away}`;
  }
}

/**
 * Pontos do palpite atual (do rascunho) contra o jogo: 0 | 1 | 3, ou null quando o jogo
 * ainda não pontua ou a linha está incompleta. Recebe a `DraftLine` específica (não o Map
 * inteiro) para reavaliar só a linha que mudou.
 */
@Pipe({ name: 'livePoints' })
export class LivePointsPipe implements PipeTransform {
  transform(match: Match, line: DraftLine | undefined): 0 | 1 | 3 | null {
    if (!isScorable(match)) return null;
    if (!line || line.home == null || line.away == null) return null;
    return scoreGuess({ matchId: match.id, home: line.home, away: line.away }, match);
  }
}
