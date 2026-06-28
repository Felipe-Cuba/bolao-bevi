// Helpers PUROS de rascunho de palpite, compartilhados pela modal de palpites e pela tela
// de chaveamento. Centralizam a regra de "quem passa" (advances) e a montagem/validação de
// um `Palpite` a partir de uma `DraftLine`, para as duas telas se comportarem igual.

import { Match } from '@shared/models/match.model';
import { Advances, DraftLine, Palpite } from '@shared/models/bolao.model';
import { isKnockout } from '@shared/utils/bolao-scoring.util';

/** Lado que se classifica conforme o rascunho (vencedor pelo placar, ou a escolha em empate). */
export function draftAdvances(line: DraftLine | undefined): Advances | null {
  if (!line || line.home == null || line.away == null) return null;
  if (line.home > line.away) return 'HOME';
  if (line.home < line.away) return 'AWAY';
  return line.advances ?? null;
}

/** Linha com placar completo e empatado (no mata-mata, exige escolher "quem passa"). */
export function isDrawLine(line: DraftLine | undefined): boolean {
  return !!line && line.home != null && line.away != null && line.home === line.away;
}

/** Empate digitado num jogo de mata-mata ainda sem "quem passa" escolhido (palpite incompleto). */
export function needsAdvances(match: Match, line: DraftLine | undefined): boolean {
  if (!isKnockout(match) || !isDrawLine(line)) return false;
  return line!.advances == null;
}

/** Linha com placar completo (ambos os lados preenchidos). */
export function isCompleteLine(line: DraftLine | undefined): line is DraftLine & { home: number; away: number } {
  return !!line && line.home != null && line.away != null;
}

/**
 * Monta um `Palpite` a partir de uma linha completa. Só grava `advances` no mata-mata. Para
 * grupos o campo nunca é gravado. Retorna null se a linha não estiver completa.
 */
export function buildPalpite(matchId: number, line: DraftLine | undefined, match: Match | undefined): Palpite | null {
  if (!isCompleteLine(line)) return null;
  const palpite: Palpite = { matchId, home: line.home, away: line.away };
  if (match && isKnockout(match)) {
    const adv = draftAdvances(line);
    if (adv) palpite.advances = adv;
  }
  return palpite;
}
