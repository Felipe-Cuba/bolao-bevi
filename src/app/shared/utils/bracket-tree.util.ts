// Monta a ÁRVORE visual do mata-mata (16-avos → final → campeã), estilo "caminho da seleção".
// Derivação PURA — não faz request. Combina duas fontes:
//   • 16-avos (LAST_32): confrontos PROJETADOS da classificação (buildSimulatedBracket), ou os
//     jogos REAIS da API quando já existirem com times definidos.
//   • Oitavas → final: os jogos REAIS da API (placeholders "A definir" até serem jogados).
//
// A topologia (quem alimenta quem) é DERIVADA do schema declarativo (bracket-schema): cada
// jogo de oitavas+ referencia os jogos anteriores via `winnerOf`. Um DFS a partir da final
// (raiz) atribui lado (esquerda/direita) e ordem vertical a cada nó — sem tabelas mágicas.

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
import { schemaByNum, SchemaMatch } from '@shared/utils/bracket-schema.util';

export type BracketRound =
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'FINAL'
  | 'THIRD_PLACE';
export type BracketSide = 'left' | 'right';

export interface TreeSlot {
  team: Team | null;
  label: string;
  score: number | null;
  winner: boolean;
}

export interface TreeNode {
  /** Id estável p/ @track, ex.: "LAST_32-left-0", "FINAL". */
  id: string;
  /** Número oficial do jogo (73..104). */
  num: number;
  round: BracketRound;
  side: BracketSide;
  slotIndex: number;
  home: TreeSlot;
  away: TreeSlot;
  origin: 'projected' | 'api';
  /** Texto de pênaltis/prorrogação, quando houver. */
  breakdown: string | null;
  /** true quando um jogo real da API alimenta este nó. */
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
  /** Nó da disputa de 3º lugar (jogo 103). Lados = perdedores das semifinais. */
  thirdPlace: TreeNode;
  /** Campeã (só quando a final está encerrada). */
  champion: Team | null;
  /** Reflete `thirdsResolved` da projeção dos 16-avos. */
  thirdsResolved: boolean;
  /** true quando nenhuma fase de mata-mata existe nos dados (pré-torneio/erro). */
  knockoutMissing: boolean;
}

// ---------------------------------------------------------------------------
// Layout derivado do schema (substitui TOPOLOGY + R32_MATCH_TO_SIM)
// ---------------------------------------------------------------------------

/** Fases da árvore, da borda ao centro (sem a final, que é o nó central). */
const SIDE_ROUNDS: BracketRound[] = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS'];

const FINAL_NUM = 104;
const THIRD_PLACE_NUM = 103;

/** Os dois jogos que alimentam um jogo (via `winnerOf` de seus lados), na ordem home, away. */
function feedersOf(game: SchemaMatch): [number, number] | null {
  const h = game.home.kind === 'winnerOf' ? game.home.match : null;
  const a = game.away.kind === 'winnerOf' ? game.away.match : null;
  return h != null && a != null ? [h, a] : null;
}

/**
 * Posição de cada jogo na árvore: lado (left/right) + slotIndex (ordem vertical).
 * DFS a partir da final: o feeder `home` da final cai à esquerda, o `away` à direita; em
 * cada metade, a ordem das folhas (LAST_32) de cima→baixo vem da visita home-antes-de-away.
 */
interface NodePos {
  side: BracketSide;
  /** Ordem de chegada das FOLHAS sob este nó (preenchido na descida). */
  order: number;
}

function computeLayout(): Map<number, NodePos> {
  const pos = new Map<number, NodePos>();
  let leafCounter = { left: 0, right: 0 };

  // DFS que percorre primeiro o feeder home, depois o away; ao chegar numa folha (LAST_32),
  // atribui a próxima posição vertical daquele lado. Os nós internos herdam o lado do pai.
  const visit = (num: number, side: BracketSide): void => {
    const game = schemaByNum.get(num);
    if (!game) return;
    const feeders = feedersOf(game);
    if (!feeders) {
      // Folha (16-avos): recebe a próxima ordem vertical do seu lado.
      pos.set(num, { side, order: leafCounter[side]++ });
      return;
    }
    // Nó interno: visita os filhos (que herdam o lado) e fica com a ordem do primeiro filho.
    const startOrder = leafCounter[side];
    for (const child of feeders) visit(child, side);
    pos.set(num, { side, order: startOrder });
  };

  // A final é a raiz: home → esquerda, away → direita.
  const final = schemaByNum.get(FINAL_NUM);
  const finalFeeders = final ? feedersOf(final) : null;
  if (finalFeeders) {
    visit(finalFeeders[0], 'left');
    visit(finalFeeders[1], 'right');
  }
  return pos;
}

/** Ordem dos nums por round+side (da borda ao centro), derivada do layout. Estável (const). */
const LAYOUT: Map<number, NodePos> = computeLayout();

/** Lista ordenada de nums de um round numa metade (de cima para baixo). */
function numsFor(round: BracketRound, side: BracketSide): number[] {
  const stage = round as unknown as MatchStage;
  return [...schemaByNum.values()]
    .filter((g) => (g.round as unknown as MatchStage) === stage)
    .map((g) => g.num)
    .filter((num) => LAYOUT.get(num)?.side === side)
    .sort((a, b) => (LAYOUT.get(a)!.order - LAYOUT.get(b)!.order));
}

// ---------------------------------------------------------------------------
// Helpers de nó
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

/** Constrói um nó a partir de um jogo real da API (ou vazio quando não há jogo). */
function apiNode(
  match: Match | undefined,
  num: number,
  round: BracketRound,
  side: BracketSide,
  slotIndex: number,
): TreeNode {
  const id = `${round}-${side}-${slotIndex}`;
  if (!match) {
    return {
      id, num, round, side, slotIndex,
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
    id, num, round, side, slotIndex,
    home: apiSlot(match.homeTeam, score.fullTime.home, finished, score.winner === 'HOME_TEAM'),
    away: apiSlot(match.awayTeam, score.fullTime.away, finished, score.winner === 'AWAY_TEAM'),
    origin: 'api',
    breakdown: finished ? scoreBreakdown(score) : null,
    hasMatch: true,
  };
}

/** Converte um confronto projetado dos 16-avos (SimulatedMatch) em nó da árvore. */
function projectedNode(
  m: SimulatedMatch,
  side: BracketSide,
  slotIndex: number,
): TreeNode {
  const toSlot = (s: SimulatedMatch['home']): TreeSlot => ({
    team: s.team,
    label: s.team ? teamNamePt(s.team) : s.label,
    score: null,
    winner: false,
  });
  return {
    id: `LAST_32-${side}-${slotIndex}`,
    num: m.num,
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

/** Um jogo real da API tem ambos os times definidos (não-placeholder)? */
function hasRealTeams(match: Match | undefined): match is Match {
  return !!match && !isPlaceholderTeam(match.homeTeam) && !isPlaceholderTeam(match.awayTeam);
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

  // Jogos reais agrupados por fase e ordenados POR id — dentro de cada fase os ids da API são
  // sequenciais e seguem o nº do jogo da FIFA. Mapeamos num→Match assumindo essa correspondência.
  const allMatches = knockout.flatMap((p) => p.matches);
  const byStage = new Map<string, Match[]>();
  for (const m of allMatches) {
    const arr = byStage.get(String(m.stage));
    if (arr) arr.push(m);
    else byStage.set(String(m.stage), [m]);
  }
  for (const arr of byStage.values()) arr.sort((a, b) => a.id - b.id);

  /** Jogo real da API correspondente a um num, via posição na fase ordenada por id. */
  const apiMatchFor = (num: number): Match | undefined => {
    const game = schemaByNum.get(num);
    if (!game) return undefined;
    const stage = game.round as unknown as MatchStage;
    const list = byStage.get(stage) ?? [];
    // O índice do num dentro da sua fase (na ordem oficial dos nums) casa com a ordem por id.
    const phaseNums = [...schemaByNum.values()]
      .filter((g) => (g.round as unknown as MatchStage) === stage)
      .map((g) => g.num)
      .sort((a, b) => a - b);
    return list[phaseNums.indexOf(num)];
  };

  /** Constrói o nó de um num na posição (round/side/slotIndex). */
  const buildNode = (
    num: number,
    round: BracketRound,
    side: BracketSide,
    slotIndex: number,
  ): TreeNode => {
    if (round === 'LAST_32') {
      // Prefere o jogo real (com times definidos) à projeção, quando existir.
      const real = apiMatchFor(num);
      if (hasRealTeams(real)) return apiNode(real, num, 'LAST_32', side, slotIndex);
      const projected = sim.byNum.get(num);
      return projected
        ? projectedNode(projected, side, slotIndex)
        : apiNode(undefined, num, 'LAST_32', side, slotIndex);
    }
    return apiNode(apiMatchFor(num), num, round, side, slotIndex);
  };

  const buildSide = (side: BracketSide): BracketColumn[] =>
    SIDE_ROUNDS.map((round) => ({
      round,
      side,
      nodes: numsFor(round, side).map((num, i) => buildNode(num, round, side, i)),
    }));

  const left = buildSide('left');
  const right = buildSide('right');

  // Final: nó central (num 104).
  const finalMatch = apiMatchFor(FINAL_NUM);
  const final = apiNode(finalMatch, FINAL_NUM, 'FINAL', 'left', 0);
  final.id = 'FINAL';

  // Disputa de 3º lugar (num 103). Os lados vêm dos perdedores das semis (preenchidos pela
  // simulação); sem dados reais começa "A definir".
  const thirdMatch = apiMatchFor(THIRD_PLACE_NUM);
  const thirdPlace = apiNode(thirdMatch, THIRD_PLACE_NUM, 'THIRD_PLACE', 'left', 0);
  thirdPlace.id = 'THIRD_PLACE';

  // Campeã: vencedor da final, quando encerrada.
  let champion: Team | null = null;
  if (finalMatch && isFinished(finalMatch.status)) {
    const w = finalMatch.score.winner;
    if (w === 'HOME_TEAM') champion = finalMatch.homeTeam;
    else if (w === 'AWAY_TEAM') champion = finalMatch.awayTeam;
    if (champion && isPlaceholderTeam(champion)) champion = null;
  }

  // Mata-mata "ausente" só quando NENHUMA fase de KO (oitavas+) existe nos dados.
  const koStages: MatchStage[] = SIDE_ROUNDS.slice(1).map((r) => r as unknown as MatchStage);
  koStages.push(MatchStage.FINAL);
  const knockoutMissing = koStages.every((stage) => (byStage.get(stage) ?? []).length === 0);

  return {
    left,
    right,
    final,
    thirdPlace,
    champion,
    thirdsResolved: sim.thirdsResolved,
    knockoutMissing,
  };
}
