// Lógica de pontuação do Bolão Bevi (funções puras).
//
// Regras (palpite × placar real `score.fullTime`):
//   - placar exato        → +3
//   - só o resultado certo → +1 (mesmo vencedor, ou empate acertado)
//   - errou               →  0
// Só pontua jogos com resultado real disponível: FINISHED ou IN_PLAY (placar definido).

import { Match, MatchStatus, isLive } from '@shared/models/match.model';
import { STAGE_ORDER, stageLabel } from '@shared/utils/match-derivations.util';
import { BolaoEntry, Palpite } from '@shared/models/bolao.model';

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

/** Pontuação por rodada de grupos (matchday) ou fase de mata-mata (stage). */
export interface PhaseTally {
  /** Chave estável: 'GROUP_1'..'GROUP_3' (rodadas) ou o stage do mata-mata. */
  key: string;
  label: string; // 'Rodada 1' / 'Oitavas de final' / ...
  order: number; // ordem cronológica oficial (p/ ordenar)
  points: number;
  jogos: number; // jogos pontuados nessa fase/rodada
}

export interface EntryTally {
  total: number;
  cravou: number; // palpites de +3 (placar exato)
  acertou: number; // palpites de +1 (resultado certo)
  errou: number; // palpites de 0 (sobre jogos já pontuáveis)
  jogosPontuados: number; // quantos jogos com palpite já tinham resultado
  porGrupo: Record<string, number>; // pontos somados por grupo (GROUP_x ou "KO" p/ mata-mata)
  porDia: DayTally[]; // pontos por dia (ordem cronológica), só dias com jogos pontuados
  porFase: PhaseTally[]; // pontos por rodada/fase, progressivo (só fases com jogo na agenda)
  potencialRestante: number; // máximo ainda obtível na FASE ATIVA (+3 por palpite pendente)
  melhorDia: DayTally | null; // dia de maior pontuação (entre os pontuados)
  piorDia: DayTally | null; // dia de menor pontuação (entre os pontuados)
}

/** Chave de fase/rodada de um jogo: rodada (matchday) nos grupos, stage no mata-mata. */
function phaseKey(match: Match): string {
  if (String(match.stage) === 'GROUP_STAGE' && match.matchday != null) {
    return `GROUP_${match.matchday}`;
  }
  return String(match.stage);
}

/** Rótulo legível de uma chave de fase. */
function phaseLabel(key: string): string {
  if (key.startsWith('GROUP_')) return `Rodada ${key.slice(6)}`;
  return stageLabel(key);
}

/** Ordem cronológica oficial de uma chave de fase (rodadas de grupo antes do mata-mata). */
function phaseOrder(key: string): number {
  if (key.startsWith('GROUP_')) {
    // Rodadas 1..3 ficam ANTES de qualquer fase de mata-mata.
    return Number(key.slice(6)); // 1, 2, 3
  }
  const i = STAGE_ORDER.indexOf(key);
  // +10 garante que todo mata-mata venha depois das rodadas de grupo.
  return i === -1 ? STAGE_ORDER.length + 10 : i + 10;
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

  // Buckets de fase/rodada criados a partir do CALENDÁRIO, para uma fase/rodada aparecer
  // assim que tiver jogo "montado" (mesmo com 0 pts) — comportamento progressivo.
  // No mata-mata, os confrontos vêm com times nulos ("A definir") até serem definidos;
  // por isso só criamos o bucket quando há jogo com ambos os times definidos. Rodadas de
  // grupo sempre têm times, então 1/2/3 aparecem desde o início.
  const fases = new Map<string, PhaseTally>();
  for (const m of matches) {
    if (m.homeTeam.id == null || m.awayTeam.id == null) continue;
    const key = phaseKey(m);
    if (!fases.has(key)) {
      fases.set(key, { key, label: phaseLabel(key), order: phaseOrder(key), points: 0, jogos: 0 });
    }
  }

  const tally: EntryTally = {
    total: 0,
    cravou: 0,
    acertou: 0,
    errou: 0,
    jogosPontuados: 0,
    porGrupo: {},
    porDia: [],
    porFase: [],
    potencialRestante: 0,
    melhorDia: null,
    piorDia: null,
  };

  // Potencial (+3 por jogo com palpite ainda não pontuável) acumulado por fase, para
  // depois ficar só com o da fase ATIVA (a fase mais antiga ainda com jogos pendentes).
  const potencialPorFase = new Map<string, number>();

  for (const p of entry.palpites) {
    const match = byId.get(p.matchId);
    if (!match) continue;

    // Jogo ainda não pontuável, mas com palpite → +3 potencial na fase do jogo.
    if (!isScorable(match)) {
      const fk = phaseKey(match);
      potencialPorFase.set(fk, (potencialPorFase.get(fk) ?? 0) + 3);
      continue;
    }

    tally.jogosPontuados++;
    const pts = scoreGuess(p, match);
    tally.total += pts;
    if (pts === 3) tally.cravou++;
    else if (pts === 1) tally.acertou++;
    else tally.errou++;

    const key = match.group ?? KO_KEY;
    tally.porGrupo[key] = (tally.porGrupo[key] ?? 0) + pts;

    const fase = fases.get(phaseKey(match));
    if (fase) {
      fase.points += pts;
      fase.jogos++;
    }

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
  tally.porFase = [...fases.values()].sort((a, b) => a.order - b.order);

  // Potencial restante = só o da FASE ATIVA: a fase mais antiga (menor order) que ainda
  // tem jogos pendentes com palpite. Fases futuras só contam quando viram a ativa.
  let faseAtivaOrder = Infinity;
  for (const fk of potencialPorFase.keys()) {
    const ord = phaseOrder(fk);
    if (ord < faseAtivaOrder) faseAtivaOrder = ord;
  }
  if (faseAtivaOrder !== Infinity) {
    for (const [fk, pts] of potencialPorFase) {
      if (phaseOrder(fk) === faseAtivaOrder) {
        tally.potencialRestante = pts;
        break;
      }
    }
  }

  // Melhor/pior dia entre os dias com jogos pontuados.
  for (const d of tally.porDia) {
    if (!tally.melhorDia || d.points > tally.melhorDia.points) tally.melhorDia = d;
    if (!tally.piorDia || d.points < tally.piorDia.points) tally.piorDia = d;
  }

  return tally;
}

const KO_KEY_GROUP = 'KO'; // grupo dos jogos sem fase de grupos (mata-mata)

/** Palpite resolvido contra o jogo real (para listagens detalhadas). */
export interface ScoredGuess {
  match: Match;
  palpite: Palpite;
  pts: 0 | 1 | 3;
  /** Grupo do jogo (GROUP_x) ou "KO" no mata-mata. */
  group: string;
}

/**
 * Lista detalhada dos palpites sobre jogos já pontuáveis (ordenada por data).
 * Base para as modais que mostram "quais palpites geraram estes pontos".
 */
export function entryBreakdown(entry: BolaoEntry, matches: Match[]): ScoredGuess[] {
  const byId = new Map<number, Match>(matches.map((m) => [m.id, m]));
  const out: ScoredGuess[] = [];

  for (const palpite of entry.palpites) {
    const match = byId.get(palpite.matchId);
    if (!match || !isScorable(match)) continue;
    out.push({
      match,
      palpite,
      pts: scoreGuess(palpite, match),
      group: match.group ?? KO_KEY_GROUP,
    });
  }

  return out.sort((a, b) => a.match.utcDate.localeCompare(b.match.utcDate));
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
