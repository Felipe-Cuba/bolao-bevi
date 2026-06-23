// Monta a ÁRVORE visual do mata-mata (16-avos → final → campeã), estilo "caminho da seleção".
// Derivação PURA — não faz request. Combina duas fontes:
//   • 16-avos (LAST_32): os 16 confrontos PROJETADOS da classificação atual (buildSimulatedBracket).
//   • Oitavas → final: os jogos REAIS da API (placeholders "A definir" até serem jogados).
//
// IMPORTANTE: a topologia (qual jogo se liga a qual na fase seguinte) é a OFICIAL da FIFA 2026.
// A adjacência não vem nos dados (todo time de mata-mata chega como placeholder e não há campo
// "vencedor do jogo X"), mas a numeração dos jogos (Match 73→104) é fixa e segue a chave: dentro
// de cada fase os ids da API são sequenciais e correspondem ao nº do jogo, então ORDENAR POR id
// dá a ordem oficial. A partir dela, `TOPOLOGY` permuta cada posição da árvore para o ramo certo
// (ver Match 89–96 = pares de vencedores dos 16-avos). Os times de oitavas+ vêm SEMPRE da API.

import {
  Match,
  MatchPart,
  MatchStage,
  MatchStatus,
  Score,
  Team,
  scoreBreakdown,
} from '@shared/models/match.model';
import { GroupStanding } from '@shared/utils/match-derivations.util';
import { buildSimulatedBracket, SimulatedMatch } from '@shared/utils/bracket-simulation.util';
import { isPlaceholderTeam, teamNamePt } from '@shared/utils/teams.util';

export type BracketRound = 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'FINAL';
export type BracketSide = 'left' | 'right';

export interface TreeSlot {
  team: Team | null;
  label: string;
  score: number | null;
  winner: boolean;
}

export interface TreeNode {
  /** Id estável p/ @track, ex.: "L32-left-0", "FINAL". */
  id: string;
  round: BracketRound;
  side: BracketSide;
  slotIndex: number;
  home: TreeSlot;
  away: TreeSlot;
  origin: 'projected' | 'api';
  /** Texto de pênaltis/prorrogação, quando houver. */
  breakdown: string | null;
  /** true quando um jogo real da API alimenta este nó (oitavas+). */
  hasMatch: boolean;
}

export interface BracketColumn {
  round: BracketRound;
  side: BracketSide;
  nodes: TreeNode[];
}

export interface BracketTree {
  /** Colunas da metade esquerda, da borda ao centro: L32, L16, QF, SF. */
  left: BracketColumn[];
  /** Colunas da metade direita (espelhada). */
  right: BracketColumn[];
  /** Nó central da final. */
  final: TreeNode;
  /** Campeã (só quando a final está encerrada). */
  champion: Team | null;
  /** Reflete `thirdsResolved` da projeção dos 16-avos. */
  thirdsResolved: boolean;
  /** true quando nenhuma fase de mata-mata existe nos dados (pré-torneio/erro). */
  knockoutMissing: boolean;
}

// ---------------------------------------------------------------------------
// Topologia OFICIAL da FIFA 2026 (ver comentário do topo)
// ---------------------------------------------------------------------------

/** Fases do mata-mata, da borda ao centro (sem a final, que é o nó central). */
const SIDE_ROUNDS: BracketRound[] = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS'];

/** Quantos nós cada fase tem POR METADE. */
const NODES_PER_SIDE: Record<BracketRound, number> = {
  LAST_32: 8,
  LAST_16: 4,
  QUARTER_FINALS: 2,
  SEMI_FINALS: 1,
  FINAL: 1,
};

const SIDES: BracketSide[] = ['left', 'right'];

/**
 * Match 73–88 (16-avos) → id projetado de `buildSimulatedBracket`. A numeração da FIFA é fixa;
 * o confronto de cada jogo (1º/2º/3º dos grupos) casa 1:1 com os blocos do simulador. Indexado
 * pela ORDEM por id da API (índice 0 = Match 73, …, 15 = Match 88).
 */
const R32_MATCH_TO_SIM: string[] = [
  'B2-1', // 73: 2ºA × 2ºB
  'B3-E', // 74: 1ºE × 3º
  'B1-2', // 75: 1ºF × 2ºC
  'B1-1', // 76: 1ºC × 2ºF
  'B3-I', // 77: 1ºI × 3º
  'B2-3', // 78: 2ºE × 2ºI
  'B3-A', // 79: 1ºA × 3º
  'B3-L', // 80: 1ºL × 3º
  'B3-D', // 81: 1ºD × 3º
  'B3-G', // 82: 1ºG × 3º
  'B2-4', // 83: 2ºK × 2ºL
  'B1-3', // 84: 1ºH × 2ºJ
  'B3-B', // 85: 1ºB × 3º
  'B1-4', // 86: 1ºJ × 2ºH
  'B3-K', // 87: 1ºK × 3º
  'B2-2', // 88: 2ºD × 2ºG
];

/**
 * Permutação posição-na-árvore → índice na lista da fase ORDENADA POR id (= nº do jogo). Define a
 * adjacência oficial: dentro de cada metade, os nós adjacentes (0&1, 2&3, …) avançam juntos.
 *
 * 16-avos: Match 89=W74∧W77, 90=W73∧W75, 91=W76∧W78, 92=W79∧W80, 93=W83∧W84, 94=W81∧W82,
 * 95=W86∧W88, 96=W85∧W87. Semis: M101 = QF(89,90)+(93,94) → metade esquerda; M102 → direita.
 */
const TOPOLOGY: Record<BracketRound, Record<BracketSide, number[]>> = {
  // índices 0..15 = Match 73..88 (ordem por id)
  LAST_32: {
    left: [1, 4, 0, 2, 10, 11, 8, 9], // M74,77 | 73,75 | 83,84 | 81,82
    right: [3, 5, 6, 7, 13, 15, 12, 14], // M76,78 | 79,80 | 86,88 | 85,87
  },
  // índices 0..7 = Match 89..96
  LAST_16: {
    left: [0, 1, 4, 5], // M89,90 | 93,94
    right: [2, 3, 6, 7], // M91,92 | 95,96
  },
  // índices 0..3 = Match 97..100
  QUARTER_FINALS: {
    left: [0, 1], // M97,98
    right: [2, 3], // M99,100
  },
  // índices 0..1 = Match 101..102
  SEMI_FINALS: {
    left: [0], // M101
    right: [1], // M102
  },
  FINAL: { left: [0], right: [] },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slot vazio "A definir". */
function emptySlot(): TreeSlot {
  return { team: null, label: 'A definir', score: null, winner: false };
}

/** Converte um lado (home/away) de um jogo real em slot, tratando placeholder e vencedor. */
function apiSlot(team: Team, score: number | null, finished: boolean, isWinner: boolean): TreeSlot {
  if (isPlaceholderTeam(team)) return emptySlot();
  return {
    team,
    label: teamNamePt(team),
    score: finished ? score : null,
    winner: finished && isWinner,
  };
}

function isFinished(status: MatchStatus): boolean {
  return status === MatchStatus.FINISHED;
}

/** Constrói um nó de oitavas+ a partir de um jogo real (ou vazio quando não há jogo). */
function apiNode(
  match: Match | undefined,
  round: BracketRound,
  side: BracketSide,
  slotIndex: number,
): TreeNode {
  const id = `${round}-${side}-${slotIndex}`;
  if (!match) {
    return {
      id,
      round,
      side,
      slotIndex,
      home: emptySlot(),
      away: emptySlot(),
      origin: 'api',
      breakdown: null,
      hasMatch: false,
    };
  }
  const finished = isFinished(match.status);
  const score: Score = match.score;
  return {
    id,
    round,
    side,
    slotIndex,
    home: apiSlot(match.homeTeam, score.fullTime.home, finished, score.winner === 'HOME_TEAM'),
    away: apiSlot(match.awayTeam, score.fullTime.away, finished, score.winner === 'AWAY_TEAM'),
    origin: 'api',
    breakdown: finished ? scoreBreakdown(score) : null,
    hasMatch: true,
  };
}

/** Converte um confronto projetado dos 16-avos (SimulatedMatch) em nó da árvore. */
function projectedNode(m: SimulatedMatch, side: BracketSide, slotIndex: number): TreeNode {
  const toSlot = (s: SimulatedMatch['home']): TreeSlot => ({
    team: s.team,
    label: s.team ? teamNamePt(s.team) : s.label,
    score: null,
    winner: false,
  });
  return {
    id: `LAST_32-${side}-${slotIndex}`,
    round: 'LAST_32',
    side,
    slotIndex,
    home: toSlot(m.home),
    away: toSlot(m.away),
    origin: 'projected',
    breakdown: null,
    hasMatch: false,
  };
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

/** Monta a árvore completa do mata-mata a partir da classificação + jogos reais de mata-mata. */
export function buildBracketTree(
  standings: GroupStanding[],
  knockout: MatchPart[],
): BracketTree {
  const sim = buildSimulatedBracket(standings);
  const byId = new Map(sim.matches.map((m) => [m.id, m]));

  // Jogos reais agrupados por fase e ordenados POR id — dentro de cada fase os ids da API são
  // sequenciais e seguem o nº do jogo da FIFA, então essa ordem é a topológica oficial.
  const allMatches = knockout.flatMap((p) => p.matches);
  const byStage = new Map<string, Match[]>();
  for (const m of allMatches) {
    const arr = byStage.get(m.stage);
    if (arr) arr.push(m);
    else byStage.set(m.stage, [m]);
  }
  for (const arr of byStage.values()) arr.sort((a, b) => a.id - b.id);

  // Nó de oitavas+ (jogo real): pega da lista ordenada por id o índice topológico da posição `i`.
  const stageNode = (stage: MatchStage, round: BracketRound, side: BracketSide, i: number) => {
    const list = byStage.get(stage) ?? [];
    const srcIndex = TOPOLOGY[round][side][i];
    return apiNode(list[srcIndex], round, side, i);
  };

  const buildSide = (side: BracketSide): BracketColumn[] =>
    SIDE_ROUNDS.map((round) => {
      let nodes: TreeNode[];
      if (round === 'LAST_32') {
        // Posição na árvore → índice por id (= Match 73..88) → id do confronto projetado.
        nodes = TOPOLOGY.LAST_32[side].map((srcIndex, i) => {
          const m = byId.get(R32_MATCH_TO_SIM[srcIndex]);
          return m
            ? projectedNode(m, side, i)
            : apiNode(undefined, 'LAST_32', side, i); // segurança; na prática sempre existe
        });
      } else {
        const stage = round as unknown as MatchStage;
        nodes = Array.from({ length: NODES_PER_SIDE[round] }, (_, i) =>
          stageNode(stage, round, side, i),
        );
      }
      return { round, side, nodes };
    });

  const left = buildSide('left');
  const right = buildSide('right');

  // Final: nó central a partir do (único) jogo real da fase FINAL.
  const finalMatch = (byStage.get(MatchStage.FINAL) ?? [])[0];
  const final = apiNode(finalMatch, 'FINAL', 'left', 0);
  final.id = 'FINAL';

  // Campeã: vencedor da final, quando encerrada.
  let champion: Team | null = null;
  if (finalMatch && isFinished(finalMatch.status)) {
    const w = finalMatch.score.winner;
    if (w === 'HOME_TEAM') champion = finalMatch.homeTeam;
    else if (w === 'AWAY_TEAM') champion = finalMatch.awayTeam;
    if (champion && isPlaceholderTeam(champion)) champion = null;
  }

  // Mata-mata "ausente" só quando NENHUMA fase de KO existe nos dados.
  const knockoutMissing = SIDE_ROUNDS.slice(1)
    .map((r) => r as unknown as MatchStage)
    .concat(MatchStage.FINAL)
    .every((stage) => (byStage.get(stage) ?? []).length === 0);

  return {
    left,
    right,
    final,
    champion,
    thirdsResolved: sim.thirdsResolved,
    knockoutMissing,
  };
}
