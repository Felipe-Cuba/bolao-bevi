// Lógica de pontuação do Bolão Bevi (funções puras).
//
// Regras (palpite × placar real `score.fullTime`):
//   - placar exato        → +3
//   - só o resultado certo → +1 (mesmo vencedor, ou empate acertado)
//   - errou               →  0
// Só pontua jogos com resultado real disponível: FINISHED ou IN_PLAY (placar definido).

import { Match, MatchStatus, isLive } from '../wc/wc.types';
import { BolaoEntry, Palpite } from './bolao.types';

export type Outcome = 'HOME' | 'AWAY' | 'DRAW';

export function outcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME';
  if (home < away) return 'AWAY';
  return 'DRAW';
}

/** Indica se o jogo já tem resultado real para entrar no cálculo. */
export function isScorable(match: Match): boolean {
  if (match.status !== MatchStatus.FINISHED && !isLive(match)) return false;
  const { home, away } = match.score.fullTime;
  return home != null && away != null;
}

/** Pontos de um palpite contra um jogo (0 se o jogo ainda não pontua). */
export function scoreGuess(palpite: Palpite, match: Match): 0 | 1 | 3 {
  if (!isScorable(match)) return 0;
  const realHome = match.score.fullTime.home as number;
  const realAway = match.score.fullTime.away as number;

  if (palpite.home === realHome && palpite.away === realAway) return 3;
  if (outcome(palpite.home, palpite.away) === outcome(realHome, realAway)) return 1;
  return 0;
}

/** Pontuação de um único dia com jogos pontuados. */
export interface DayTally {
  /** Data no formato AAAA-MM-DD (local), para ordenação estável. */
  date: string;
  points: number;
  jogos: number; // quantos jogos pontuados nesse dia
}

export interface EntryTally {
  total: number;
  cravou: number; // palpites de +3 (placar exato)
  acertou: number; // palpites de +1 (resultado certo)
  errou: number; // palpites de 0 (sobre jogos já pontuáveis)
  jogosPontuados: number; // quantos jogos com palpite já tinham resultado
  porGrupo: Record<string, number>; // pontos somados por grupo (GROUP_x ou "KO" p/ mata-mata)
  porDia: DayTally[]; // pontos por dia (ordem cronológica), só dias com jogos pontuados
}

const KO_KEY = 'KO'; // chave para palpites de jogos sem grupo (mata-mata)

const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC−3
// Os jogos são majoritariamente nos EUA: partidas na madrugada de Brasília são, na
// prática, a "noite" do dia anterior. Recuamos 3h antes de extrair a data, então
// qualquer jogo até ~02:59 (Brasília) é contabilizado no dia anterior.
const NIGHT_SHIFT_MS = 3 * 60 * 60 * 1000;

/**
 * Chave de dia (AAAA-MM-DD) no fuso de Brasília, com jogos da madrugada atribuídos ao
 * dia anterior. Independe do fuso da máquina do usuário.
 */
function dayKey(utcDate: string): string {
  const shifted = new Date(Date.parse(utcDate) - BRASILIA_OFFSET_MS - NIGHT_SHIFT_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Agrega a pontuação de um palpite sobre o conjunto de jogos. */
export function tallyEntry(entry: BolaoEntry, matches: Match[]): EntryTally {
  const byId = new Map<number, Match>(matches.map((m) => [m.id, m]));
  const dias = new Map<string, DayTally>();
  const tally: EntryTally = {
    total: 0,
    cravou: 0,
    acertou: 0,
    errou: 0,
    jogosPontuados: 0,
    porGrupo: {},
    porDia: [],
  };

  for (const p of entry.palpites) {
    const match = byId.get(p.matchId);
    if (!match || !isScorable(match)) continue;

    tally.jogosPontuados++;
    const pts = scoreGuess(p, match);
    tally.total += pts;
    if (pts === 3) tally.cravou++;
    else if (pts === 1) tally.acertou++;
    else tally.errou++;

    const key = match.group ?? KO_KEY;
    tally.porGrupo[key] = (tally.porGrupo[key] ?? 0) + pts;

    const dk = dayKey(match.utcDate);
    const day = dias.get(dk);
    if (day) {
      day.points += pts;
      day.jogos++;
    } else {
      dias.set(dk, { date: dk, points: pts, jogos: 1 });
    }
  }

  tally.porDia = [...dias.values()].sort((a, b) => a.date.localeCompare(b.date));
  return tally;
}

export interface RankedEntry {
  entry: BolaoEntry;
  total: number;
}

/** Ranking comparativo dos palpites por total de pontos (desc). */
export function rankEntries(entries: BolaoEntry[], matches: Match[]): RankedEntry[] {
  return entries
    .map((entry) => ({ entry, total: tallyEntry(entry, matches).total }))
    .sort((a, b) => b.total - a.total);
}
