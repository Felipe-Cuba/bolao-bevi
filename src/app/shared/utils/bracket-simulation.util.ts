// Simulação do chaveamento de 16-avos (round of 32) da Copa 2026. Derivação PURA sobre a
// classificação (saída de `buildStandings`) — não faz request. Reflete "se a fase de grupos
// congelasse agora". As regras de cruzamento (3 blocos) são as oficiais da FIFA descritas em
// context.md: 12 grupos (A–L), classificam 1º + 2º de cada grupo + os 8 melhores terceiros.

import { Team } from '@shared/models/match.model';
import { GroupStanding, StandingRow } from '@shared/utils/match-derivations.util';

export type BracketBlock = 1 | 2 | 3;

export interface BracketSlot {
  /** Time resolvido, ou null quando o slot ainda não pode ser determinado. */
  team: Team | null;
  /** Rótulo curto: "1º A", "2º F", "3º H" ou "3º (melhor terceiro)". */
  label: string;
  /** Letra do grupo de origem ("A".."L"), quando conhecida — base da regra de não-repetição. */
  group: string | null;
}

export interface SimulatedMatch {
  /** Id estável p/ @track, ex.: "B1-1", "B3-A". */
  id: string;
  block: BracketBlock;
  home: BracketSlot;
  away: BracketSlot;
}

export interface SimulatedBracket {
  /** 16 confrontos, ordenados bloco 1 → 2 → 3. */
  matches: SimulatedMatch[];
  /** true quando os 12 grupos têm um 3º colocado (8 melhores terceiros definíveis). */
  thirdsResolved: boolean;
  /** true quando todos os 16 confrontos têm os dois times definidos. */
  blocksComplete: boolean;
}

// ---------------------------------------------------------------------------
// Constantes das regras (context.md)
// ---------------------------------------------------------------------------

/** Bloco 1 — 1º vs 2º (fixo): [grupo do 1º, grupo do 2º]. */
const BLOCK_1: [string, string][] = [
  ['C', 'F'],
  ['F', 'C'],
  ['H', 'J'],
  ['J', 'H'],
];

/** Bloco 2 — 2º vs 2º (fixo): [grupo do 2º (casa), grupo do 2º (fora)]. */
const BLOCK_2: [string, string][] = [
  ['A', 'B'],
  ['D', 'G'],
  ['E', 'I'],
  ['K', 'L'],
];

/** Bloco 3 — 1º colocado (host) → grupos cujos 3ºs ele pode enfrentar. K por eliminação. */
const BLOCK_3_ALLOWED: Record<string, string[]> = {
  A: ['C', 'E', 'F', 'H', 'I'],
  B: ['E', 'F', 'G', 'I', 'J'],
  D: ['B', 'E', 'F', 'I', 'J'],
  E: ['A', 'B', 'C', 'D', 'F'],
  G: ['A', 'E', 'H', 'I', 'J'],
  I: ['C', 'D', 'F', 'G', 'H'],
  L: ['E', 'H', 'I', 'J', 'K'],
};

/** Ordem de atribuição dos 1ºs no Bloco 3; K por último (recebe o terceiro remanescente). */
const BLOCK_3_FIRSTS = ['A', 'B', 'D', 'E', 'G', 'I', 'L', 'K'] as const;

const ALL_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mapa letra-do-grupo → linhas já ordenadas (buildStandings usa chaves "GROUP_X"). */
function rowsByGroup(standings: GroupStanding[]): Map<string, StandingRow[]> {
  const map = new Map<string, StandingRow[]>();
  for (const s of standings) {
    const letter = s.group.replace('GROUP_', '');
    map.set(letter, s.rows);
  }
  return map;
}

/** N-ésima linha (0-based) de um grupo, ou undefined se ainda não existe. */
function nth(rows: StandingRow[] | undefined, i: number): StandingRow | undefined {
  return rows?.[i];
}

/** Slot de um colocado (1º/2º/3º) de um grupo. `ordinal` é 1, 2 ou 3 (para o rótulo). */
function slotFor(
  rows: StandingRow[] | undefined,
  index: number,
  ordinal: number,
  group: string,
): BracketSlot {
  const row = nth(rows, index);
  return { team: row?.team ?? null, label: `${ordinal}º ${group}`, group };
}

interface ThirdEntry {
  group: string;
  row: StandingRow;
}

/**
 * Ranqueia os terceiros colocados dos 12 grupos por pontos → saldo → gols pró, com desempate
 * estável final por letra do grupo (só p/ a simulação não "piscar" entre refreshes; não é o
 * critério oficial FIFA). Retorna os 8 melhores e se há terceiros nos 12 grupos.
 */
function bestEightThirds(byGrp: Map<string, StandingRow[]>): {
  ranked: ThirdEntry[];
  eligible: boolean;
} {
  const thirds: ThirdEntry[] = [];
  for (const g of ALL_GROUPS) {
    const row = nth(byGrp.get(g), 2);
    if (row) thirds.push({ group: g, row });
  }
  thirds.sort(
    (x, y) =>
      y.row.points - x.row.points ||
      y.row.goalDiff - x.row.goalDiff ||
      y.row.goalsFor - x.row.goalsFor ||
      x.group.localeCompare(y.group),
  );
  return { ranked: thirds.slice(0, 8), eligible: thirds.length === ALL_GROUPS.length };
}

/**
 * Atribui, por backtracking, cada host (1º colocado) a um dos 8 melhores terceiros, respeitando
 * `BLOCK_3_ALLOWED` e a regra inviolável de não enfrentar time do próprio grupo. K recebe o
 * terceiro remanescente. Retorna host→grupo-do-terceiro, ou null se não houver emparelhamento.
 */
function assignBlock3(qualifiedThirds: string[]): Record<string, string> | null {
  const result: Record<string, string> = {};
  const used = new Set<string>();

  const solve = (index: number): boolean => {
    if (index === BLOCK_3_FIRSTS.length) return true;
    const host = BLOCK_3_FIRSTS[index];
    const candidates = qualifiedThirds.filter((t) => {
      if (used.has(t)) return false;
      if (t === host) return false; // regra inviolável: nunca o próprio grupo
      if (host === 'K') return true; // K: qualquer terceiro restante
      return BLOCK_3_ALLOWED[host].includes(t);
    });
    for (const t of candidates) {
      result[host] = t;
      used.add(t);
      if (solve(index + 1)) return true;
      used.delete(t);
      delete result[host];
    }
    return false;
  };

  return solve(0) ? result : null;
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

/** Monta o chaveamento simulado de 16-avos a partir da classificação atual. */
export function buildSimulatedBracket(standings: GroupStanding[]): SimulatedBracket {
  const byGrp = rowsByGroup(standings);
  const matches: SimulatedMatch[] = [];

  // Bloco 1 — 1º X vs 2º Y
  BLOCK_1.forEach(([first, second], i) => {
    matches.push({
      id: `B1-${i + 1}`,
      block: 1,
      home: slotFor(byGrp.get(first), 0, 1, first),
      away: slotFor(byGrp.get(second), 1, 2, second),
    });
  });

  // Bloco 2 — 2º X vs 2º Y
  BLOCK_2.forEach(([a, b], i) => {
    matches.push({
      id: `B2-${i + 1}`,
      block: 2,
      home: slotFor(byGrp.get(a), 1, 2, a),
      away: slotFor(byGrp.get(b), 1, 2, b),
    });
  });

  // Bloco 3 — 1º host vs 3º atribuído (melhores terceiros)
  const { ranked, eligible } = bestEightThirds(byGrp);
  const qualifiedThirds = ranked.map((t) => t.group);
  const assignment = qualifiedThirds.length === 8 ? assignBlock3(qualifiedThirds) : null;

  for (const host of BLOCK_3_FIRSTS) {
    const thirdGroup = assignment?.[host] ?? null;
    const away: BracketSlot = thirdGroup
      ? slotFor(byGrp.get(thirdGroup), 2, 3, thirdGroup)
      : { team: null, label: '3º (melhor terceiro)', group: null };
    matches.push({
      id: `B3-${host}`,
      block: 3,
      home: slotFor(byGrp.get(host), 0, 1, host),
      away,
    });
  }

  const blocksComplete = matches.every((m) => m.home.team != null && m.away.team != null);

  return { matches, thirdsResolved: eligible, blocksComplete };
}
