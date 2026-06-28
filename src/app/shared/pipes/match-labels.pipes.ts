// Pipes "tradutores" genéricos de jogo (abreviação de seleção, rótulo de status, rótulo de
// grupo). Puros → memoizados pelo Angular. Existem para tirar do HTML chamadas de função que
// só convertem um valor em texto (mantendo no template apenas pipes e ações diretas).

import { Pipe, PipeTransform } from '@angular/core';

import { MatchStatus } from '@shared/models/match.model';
import { teamShortNamePt } from '@shared/utils/teams.util';

/** TLA/código de uma seleção → abreviação em português (ALE, HOL, AFS…). */
@Pipe({ name: 'shortNamePt' })
export class ShortNamePtPipe implements PipeTransform {
  transform(value: string): string {
    return teamShortNamePt(value);
  }
}

const STATUS_LABELS: Record<string, string> = {
  ALL: 'Todos',
  [MatchStatus.TIMED]: 'Agendado',
  [MatchStatus.IN_PLAY]: 'Ao vivo',
  [MatchStatus.FINISHED]: 'Encerrado',
};

/** Status do jogo (ou 'ALL') → rótulo em português para o filtro. */
@Pipe({ name: 'statusLabel' })
export class StatusLabelPipe implements PipeTransform {
  transform(status: MatchStatus | 'ALL'): string {
    return STATUS_LABELS[status] ?? status;
  }
}

/** Chave de grupo ("GROUP_A") → rótulo curto ("Grupo A"). */
@Pipe({ name: 'groupShortLabel' })
export class GroupShortLabelPipe implements PipeTransform {
  transform(group: string): string {
    return group.replace('GROUP_', 'Grupo ');
  }
}
