// Simulação dos 16-avos (LAST_32) da Copa 2026 a partir da classificação atual. Derivação
// PURA (sem request): reflete "se a fase de grupos congelasse agora". Consome o schema
// declarativo (bracket-schema) — a regra de cruzamento dos jogos vem de lá, não daqui.
//
// Resolução:
//   • lados fixos (1º/2º) → linha 0/1 do grupo na classificação;
//   • lados de melhor-terceiro → ranqueia os 12 terceiros, pega os 8 melhores e os atribui
//     aos 8 jogos respeitando a PRIORIDADE por letra de cada jogo (ordem da string "3ºABCDF"),
//     via backtracking, garantindo emparelhamento completo sem conflito.

import { Team } from '@shared/models/match.model';
import { GroupStanding, StandingRow } from '@shared/utils/match-derivations.util';
import {
  GroupLetter,
  SchemaMatch,
  SlotRef,
  last32Games,
} from '@shared/utils/bracket-schema.util';

export interface BracketSlot {
  /** Time resolvido, ou null quando o slot ainda não pode ser determinado. */
  team: Team | null;
  /** Rótulo curto: "1º A", "2º F", "3º H" ou "3º (melhor terceiro)". */
  label: string;
  /** Letra do grupo de origem ("A".."L"), quando conhecida. */
  group: string | null;
}

export interface SimulatedMatch {
  /** Número oficial do jogo (73..88). */
  num: number;
  home: BracketSlot;
  away: BracketSlot;
}

export interface SimulatedBracket {
  /** Os 16 confrontos de 16-avos, indexados pelo número do jogo. */
  byNum: Map<number, SimulatedMatch>;
  /** true quando os 12 grupos têm um 3º colocado (8 melhores terceiros definíveis). */
  thirdsResolved: boolean;
  /** true quando todos os 16 confrontos têm os dois times definidos. */
  blocksComplete: boolean;
}

const ALL_GROUPS: readonly GroupLetter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
];

// ---------------------------------------------------------------------------
// Helpers de classificação
// ---------------------------------------------------------------------------

/** Mapa letra-do-grupo → linhas já ordenadas (buildStandings usa chaves "GROUP_X"). */
function rowsByGroup(standings: GroupStanding[]): Map<string, StandingRow[]> {
  const map = new Map<string, StandingRow[]>();
  for (const s of standings) {
    map.set(s.group.replace('GROUP_', ''), s.rows);
  }
  return map;
}

/** Slot de um colocado (1º/2º/3º) de um grupo. `ordinal` é 1, 2 ou 3 (para o rótulo). */
function placedSlot(
  rows: StandingRow[] | undefined,
  index: number,
  ordinal: number,
  group: GroupLetter,
): BracketSlot {
  const row = rows?.[index];
  return { team: row?.team ?? null, label: `${ordinal}º ${group}`, group };
}

/** Slot vazio de melhor-terceiro (quando os terceiros ainda não estão definidos). */
function unresolvedThird(): BracketSlot {
  return { team: null, label: '3º (melhor terceiro)', group: null };
}

interface ThirdEntry {
  group: GroupLetter;
  row: StandingRow;
}

/**
 * Ranqueia os terceiros colocados dos 12 grupos por pontos → saldo → gols pró, com desempate
 * estável final por letra (só p/ a simulação não "piscar" entre refreshes; não é critério
 * oficial FIFA). Retorna os 8 melhores e se há terceiros nos 12 grupos.
 */
function bestEightThirds(byGrp: Map<string, StandingRow[]>): {
  groups: GroupLetter[];
  eligible: boolean;
} {
  const thirds: ThirdEntry[] = [];
  for (const g of ALL_GROUPS) {
    const row = byGrp.get(g)?.[2];
    if (row) thirds.push({ group: g, row });
  }
  thirds.sort(
    (x, y) =>
      y.row.points - x.row.points ||
      y.row.goalDiff - x.row.goalDiff ||
      y.row.goalsFor - x.row.goalsFor ||
      x.group.localeCompare(y.group),
  );
  return {
    groups: thirds.slice(0, 8).map((t) => t.group),
    eligible: thirds.length === ALL_GROUPS.length,
  };
}

// ---------------------------------------------------------------------------
// Atribuição dos melhores-terceiros aos jogos (prioridade por letra + backtracking)
// ---------------------------------------------------------------------------

interface ThirdGame {
  num: number;
  hostGroup: GroupLetter | null; // grupo do 1º colocado mandante (salvaguarda anti-próprio-grupo)
  priority: GroupLetter[]; // ordem de preferência (string "3ºABCDF" do md)
}

/** Letra do grupo do lado "first" de um jogo (o host do confronto de 3º). */
function hostGroupOf(game: SchemaMatch): GroupLetter | null {
  const fixed: SlotRef = game.home.kind === 'third' ? game.away : game.home;
  return fixed.kind === 'first' ? fixed.group : null;
}

/**
 * Atribui cada jogo de 3º a um dos grupos classificados, iterando os candidatos NA ORDEM da
 * prioridade do jogo. Backtracking garante uma atribuição completa (todos os jogos, sem
 * repetir grupo, nunca o próprio grupo do host). Ordem fixa dos jogos + prioridade tornam a
 * primeira solução estável entre refreshes. Retorna num→grupo, ou null se inviável.
 */
function assignThirds(
  games: ThirdGame[],
  qualified: Set<GroupLetter>,
): Map<number, GroupLetter> | null {
  const result = new Map<number, GroupLetter>();
  const used = new Set<GroupLetter>();

  const solve = (i: number): boolean => {
    if (i === games.length) return true;
    const game = games[i];
    for (const g of game.priority) {
      if (!qualified.has(g)) continue;
      if (used.has(g)) continue;
      if (g === game.hostGroup) continue; // salvaguarda inviolável
      result.set(game.num, g);
      used.add(g);
      if (solve(i + 1)) return true;
      used.delete(g);
      result.delete(game.num);
    }
    return false;
  };

  return solve(0) ? result : null;
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

/** Resolve um lado fixo (1º/2º) de um jogo. Lados de 3º são resolvidos à parte. */
function fixedSlot(ref: SlotRef, byGrp: Map<string, StandingRow[]>): BracketSlot {
  if (ref.kind === 'first') return placedSlot(byGrp.get(ref.group), 0, 1, ref.group);
  if (ref.kind === 'second') return placedSlot(byGrp.get(ref.group), 1, 2, ref.group);
  return unresolvedThird(); // 'third' sem atribuição ainda
}

/** Monta o chaveamento simulado de 16-avos a partir da classificação atual. */
export function buildSimulatedBracket(standings: GroupStanding[]): SimulatedBracket {
  const byGrp = rowsByGroup(standings);
  const games = last32Games();

  // 1. Ranqueia os 8 melhores terceiros.
  const { groups: qualifiedThirds, eligible } = bestEightThirds(byGrp);

  // 2. Atribui-os aos jogos de 3º (prioridade por letra + backtracking).
  const thirdGames: ThirdGame[] = games
    .filter((g) => g.home.kind === 'third' || g.away.kind === 'third')
    .map((g) => {
      const thirdRef = g.home.kind === 'third' ? g.home : g.away;
      return {
        num: g.num,
        hostGroup: hostGroupOf(g),
        priority: thirdRef.kind === 'third' ? thirdRef.priority : [],
      };
    });

  const assignment =
    qualifiedThirds.length === 8
      ? assignThirds(thirdGames, new Set(qualifiedThirds))
      : null;

  // 3. Resolve cada confronto: fixos direto, terceiros pela atribuição.
  const resolveSide = (ref: SlotRef, num: number): BracketSlot => {
    if (ref.kind !== 'third') return fixedSlot(ref, byGrp);
    const group = assignment?.get(num) ?? null;
    return group ? placedSlot(byGrp.get(group), 2, 3, group) : unresolvedThird();
  };

  const byNum = new Map<number, SimulatedMatch>();
  for (const g of games) {
    byNum.set(g.num, {
      num: g.num,
      home: resolveSide(g.home, g.num),
      away: resolveSide(g.away, g.num),
    });
  }

  const blocksComplete = [...byNum.values()].every(
    (m) => m.home.team != null && m.away.team != null,
  );

  return { byNum, thirdsResolved: eligible, blocksComplete };
}
