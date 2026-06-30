// Monta a ÁRVORE visual do mata-mata (16-avos → final → campeã), estilo "caminho da seleção".
// Derivação PURA — não faz request. Combina duas fontes:
//   • 16-avos (LAST_32): os confrontos REAIS da coleção `wcLast32` (times já definidos);
//     o placar/vencedor vem do jogo real da API casado por `matchId`.
//   • Oitavas → final: os jogos REAIS da API, casados POR TIMES (vencedores das fases
//     anteriores), não por ordem de id. "A definir" enquanto não houver vencedor/jogo.
//
// A topologia (quem alimenta quem) é DERIVADA do schema declarativo (bracket-schema): cada
// jogo de oitavas+ referencia os jogos anteriores via `winnerOf`. Um DFS a partir da final
// (raiz) atribui lado (esquerda/direita) e ordem vertical a cada nó — sem tabelas mágicas.

import {
  Last32Confronto,
  Match,
  MatchPart,
  MatchStage,
  MatchStatus,
  Score,
  Team,
  penaltyScore,
  scoreBreakdown,
  winnerSide,
} from '@shared/models/match.model';
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
  /** Gols no tempo normal (regularTime); cai p/ `score` quando não houve prorrogação/pênaltis. */
  regScore: number | null;
  /** Placar de pênaltis deste lado (decisivo), ou null se o jogo não foi aos pênaltis. */
  penScore: number | null;
  winner: boolean;
}

export interface TreeNode {
  /** Id estável p/ @track, ex.: "LAST_32-left-0", "FINAL". */
  id: string;
  /** Número oficial do jogo (73..104). */
  num: number;
  /** Id REAL do jogo na API (chave do palpite), ou null se ainda não definido. */
  matchId: number | null;
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
  const h = game.home?.kind === 'winnerOf' ? game.home.match : null;
  const a = game.away?.kind === 'winnerOf' ? game.away.match : null;
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
  return { team: null, label: 'A definir', score: null, regScore: null, penScore: null, winner: false };
}

/** Converte um lado (home/away) de um jogo real em slot, tratando placeholder e vencedor. */
function apiSlot(
  team: Team,
  score: number | null,
  regScore: number | null,
  penScore: number | null,
  finished: boolean,
  isWinner: boolean,
): TreeSlot {
  if (isPlaceholderTeam(team)) return emptySlot();
  return {
    team,
    label: teamNamePt(team),
    score: finished ? score : null,
    regScore: finished ? regScore : null,
    penScore: finished ? penScore : null,
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
      id, num, matchId: null, round, side, slotIndex,
      home: emptySlot(),
      away: emptySlot(),
      origin: 'api',
      breakdown: null,
      hasMatch: false,
    };
  }
  const finished = isFinished(match.status);
  const score: Score = match.score;
  // `winnerSide` cobre o caso da API não preencher `score.winner` em jogo decidido nos
  // pênaltis (desempata pelo `fullTime`), para o vencedor avançar mesmo assim.
  const winner = winnerSide(score);
  // Gols do tempo normal (cai p/ fullTime quando não houve prorrogação) e o placar de pênaltis.
  const reg = score.regularTime ?? score.fullTime;
  const pen = penaltyScore(score);
  return {
    id, num, matchId: match.id, round, side, slotIndex,
    home: apiSlot(match.homeTeam, score.fullTime.home, reg.home, pen?.home ?? null, finished, winner === 'HOME_TEAM'),
    away: apiSlot(match.awayTeam, score.fullTime.away, reg.away, pen?.away ?? null, finished, winner === 'AWAY_TEAM'),
    origin: 'api',
    breakdown: finished ? scoreBreakdown(score) : null,
    hasMatch: true,
  };
}

/** Converte um confronto de 16-avos da coleção `wcLast32` em nó da árvore (sem placar). */
function confrontoNode(
  c: Last32Confronto,
  side: BracketSide,
  slotIndex: number,
): TreeNode {
  const toSlot = (team: Team): TreeSlot => ({
    team,
    label: teamNamePt(team),
    score: null,
    regScore: null,
    penScore: null,
    winner: false,
  });
  return {
    id: `LAST_32-${side}-${slotIndex}`,
    num: c.num,
    matchId: c.matchId,
    round: 'LAST_32',
    side,
    slotIndex,
    home: toSlot(c.homeTeam),
    away: toSlot(c.awayTeam),
    origin: 'projected',
    breakdown: null,
    hasMatch: false,
  };
}

/** Um jogo real da API tem ambos os times definidos (não-placeholder)? */
function hasRealTeams(match: Match | undefined): match is Match {
  return !!match && !isPlaceholderTeam(match.homeTeam) && !isPlaceholderTeam(match.awayTeam);
}

/** Time vencedor de um nó já resolvido (placar/winner da API), ou null se indefinido. */
function nodeWinner(node: TreeNode): Team | null {
  if (node.home.winner && node.home.team) return node.home.team;
  if (node.away.winner && node.away.team) return node.away.team;
  return null;
}

/** Compara dois times por tla (fallback id). Robusto a placeholders (null). */
function sameTeam(a: Team | null | undefined, b: Team | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.tla && b.tla) return a.tla === b.tla;
  return a.id != null && a.id === b.id;
}

/** O jogo real da API casa com o par de times esperado (em qualquer ordem)? */
function matchHasTeams(match: Match, t1: Team, t2: Team): boolean {
  return (
    (sameTeam(match.homeTeam, t1) && sameTeam(match.awayTeam, t2)) ||
    (sameTeam(match.homeTeam, t2) && sameTeam(match.awayTeam, t1))
  );
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------

/** Ordem de resolução das fases (16-avos → final → 3º lugar). */
const RESOLVE_ROUNDS: BracketRound[] = [
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'FINAL',
  'THIRD_PLACE',
];

/**
 * Monta a árvore completa do mata-mata a partir dos confrontos REAIS dos 16-avos (coleção
 * `wcLast32`) + os jogos reais de mata-mata da API (oitavas → final).
 *
 * Resolução por fase: os 16-avos vêm dos confrontos (com placar do jogo real casado por
 * `matchId`, quando houver). Cada fase seguinte é casada POR TIMES — descobrimos os dois
 * vencedores que deveriam estar no jogo (via topologia do schema) e achamos o `Match` real
 * cujos times batem, em qualquer ordem. Assim a montagem independe da ordem de id da API.
 */
export function buildBracketTree(
  last32: Last32Confronto[],
  knockout: MatchPart[],
): BracketTree {
  // Jogos reais agrupados por fase (sem depender de ordem de id).
  const allMatches = knockout.flatMap((p) => p.matches);
  const byStage = new Map<string, Match[]>();
  for (const m of allMatches) {
    const arr = byStage.get(String(m.stage));
    if (arr) arr.push(m);
    else byStage.set(String(m.stage), [m]);
  }

  const confrontoByNum = new Map<number, Last32Confronto>(last32.map((c) => [c.num, c]));

  /** Jogo real da API de uma fase com o par de times esperado (em qualquer ordem). */
  const apiMatchByTeams = (stage: MatchStage, t1: Team, t2: Team): Match | undefined =>
    (byStage.get(stage) ?? []).find((m) => hasRealTeams(m) && matchHasTeams(m, t1, t2));

  /** Jogo real da API de um 16-avo, casado pelo `matchId` do confronto. */
  const apiMatchById = (matchId: number): Match | undefined =>
    (byStage.get(MatchStage.LAST_32) ?? []).find((m) => m.id === matchId);

  // Resolve os nós por num, em ordem de fase (cada fase usa os vencedores da anterior).
  const nodeByNum = new Map<number, TreeNode>();

  const resolveNode = (num: number): TreeNode => {
    const game = schemaByNum.get(num)!;
    const round = game.round as BracketRound;
    const stage = round as unknown as MatchStage;
    // Posição visual (placeholder; o slotIndex real é reatribuído ao montar as colunas).
    if (round === 'LAST_32') {
      const c = confrontoByNum.get(num);
      if (!c) return apiNode(undefined, num, 'LAST_32', 'left', 0);
      const real = apiMatchById(c.matchId);
      return hasRealTeams(real)
        ? apiNode(real, num, 'LAST_32', 'left', 0)
        : confrontoNode(c, 'left', 0);
    }
    // Oitavas+: par esperado = vencedores dos feeders já resolvidos.
    const feeders = feedersOf(game);
    if (!feeders) return apiNode(undefined, num, round, 'left', 0);
    const home = nodeWinner(nodeByNum.get(feeders[0])!);
    const away = nodeWinner(nodeByNum.get(feeders[1])!);
    if (!home || !away) return apiNode(undefined, num, round, 'left', 0);
    const real = apiMatchByTeams(stage, home, away);
    return real
      ? apiNode(real, num, round, 'left', 0)
      : apiNode(undefined, num, round, 'left', 0);
  };

  // 3º lugar: par = perdedores das semis. Resolvido após as semis (ver ordem abaixo).
  const resolveThirdPlace = (): TreeNode => {
    const game = schemaByNum.get(THIRD_PLACE_NUM)!;
    const loserOf = (ref: SchemaMatch['home']): Team | null => {
      if (ref?.kind !== 'loserOf') return null;
      const node = nodeByNum.get(ref.match);
      if (!node) return null;
      if (node.home.winner && node.away.team) return node.away.team;
      if (node.away.winner && node.home.team) return node.home.team;
      return null;
    };
    const home = loserOf(game.home);
    const away = loserOf(game.away);
    if (!home || !away) return apiNode(undefined, THIRD_PLACE_NUM, 'THIRD_PLACE', 'left', 0);
    const real = apiMatchByTeams(MatchStage.THIRD_PLACE, home, away);
    return apiNode(real, THIRD_PLACE_NUM, 'THIRD_PLACE', 'left', 0);
  };

  for (const round of RESOLVE_ROUNDS) {
    const nums = [...schemaByNum.values()]
      .filter((g) => (g.round as BracketRound) === round)
      .map((g) => g.num);
    for (const num of nums) {
      nodeByNum.set(num, round === 'THIRD_PLACE' ? resolveThirdPlace() : resolveNode(num));
    }
  }

  // Monta as colunas a partir do layout (lado + ordem vertical), reusando os nós resolvidos.
  const placeNode = (num: number, round: BracketRound, side: BracketSide, slotIndex: number): TreeNode => {
    const base = nodeByNum.get(num)!;
    return { ...base, id: `${round}-${side}-${slotIndex}`, side, slotIndex };
  };

  const buildSide = (side: BracketSide): BracketColumn[] =>
    SIDE_ROUNDS.map((round) => ({
      round,
      side,
      nodes: numsFor(round, side).map((num, i) => placeNode(num, round, side, i)),
    }));

  const left = buildSide('left');
  const right = buildSide('right');

  // Final: nó central (num 104), já resolvido por times na ordem de fase.
  const final: TreeNode = { ...nodeByNum.get(FINAL_NUM)!, id: 'FINAL', side: 'left', slotIndex: 0 };

  // Disputa de 3º lugar (num 103).
  const thirdPlace: TreeNode = {
    ...nodeByNum.get(THIRD_PLACE_NUM)!,
    id: 'THIRD_PLACE',
    side: 'left',
    slotIndex: 0,
  };

  // Campeã: vencedor da final, quando encerrada.
  let champion: Team | null = nodeWinner(final);
  if (champion && isPlaceholderTeam(champion)) champion = null;

  // Mata-mata "ausente" só quando NENHUMA fase de KO (oitavas+) existe nos dados.
  const koStages: MatchStage[] = SIDE_ROUNDS.slice(1).map((r) => r as unknown as MatchStage);
  koStages.push(MatchStage.FINAL);
  const knockoutMissing =
    last32.length === 0 && koStages.every((stage) => (byStage.get(stage) ?? []).length === 0);

  return {
    left,
    right,
    final,
    thirdPlace,
    champion,
    thirdsResolved: last32.length > 0,
    knockoutMissing,
  };
}
