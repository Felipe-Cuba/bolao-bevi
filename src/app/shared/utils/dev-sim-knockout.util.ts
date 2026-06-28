// DEV ONLY — preenche os confrontos de mata-mata na modal de palpites a partir da
// simulação do chaveamento, para testar a UI e a pontuação 3/2/1/0 antes de a Copa
// definir os jogos reais. NÃO usar em produção: ligado por uma flag em wc-page.
//
// Como funciona: reusa `buildBracketTree` (projeta os 16-avos da classificação atual) e
// `applyBracketSimulation` (propaga vencedores). Geramos picks automáticos (sempre o lado
// "home") só para resolver os times das fases seguintes, e então emitimos `Match`
// sintéticos para cada nó cujos dois times ficaram definidos — substituindo na lista os
// jogos de mata-mata que ainda estão "A definir". Jogos reais já definidos são preservados.

import { Match, MatchPart, MatchStatus, MatchStage, Team } from '@shared/models/match.model';
import { buildStandings } from '@shared/utils/match-derivations.util';
import { buildBracketTree, BracketTree, TreeNode } from '@shared/utils/bracket-tree.util';
import { applyBracketSimulation, PickSide } from '@shared/utils/bracket-sim-play.util';
import { isKnockout } from '@shared/utils/bolao-scoring.util';
import { isPlaceholderTeam } from '@shared/utils/teams.util';
import { Advances } from '@shared/models/bolao.model';

/** Score "vazio" (jogo ainda não disputado). */
function emptyScore(): Match['score'] {
  return {
    winner: null,
    duration: 'REGULAR',
    fullTime: { home: null, away: null },
    halfTime: { home: null, away: null },
  };
}

/** Monta um `Match` sintético de mata-mata a partir de um nó da árvore com ambos os times. */
function nodeToMatch(node: TreeNode): Match | null {
  const home = node.home.team;
  const away = node.away.team;
  if (!home || !away || isPlaceholderTeam(home) || isPlaceholderTeam(away)) return null;
  return {
    id: node.num, // nº oficial do jogo (73..104) como id sintético
    utcDate: new Date(2026, 5, 1, 12, 0, 0).toISOString(), // data fictícia estável
    status: MatchStatus.TIMED,
    matchday: null,
    stage: node.round as unknown as MatchStage,
    group: null,
    lastUpdated: new Date(0).toISOString(),
    homeTeam: home as Team,
    awayTeam: away as Team,
    score: emptyScore(),
  };
}

/** Coleta todos os nós da árvore (colunas + final + 3º lugar). */
function allNodes(tree: BracketTree): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const col of [...tree.left, ...tree.right]) nodes.push(...col.nodes);
  nodes.push(tree.final, tree.thirdPlace);
  return nodes;
}

/** Deriva `MatchPart[]` de mata-mata a partir dos jogos (agrupa por stage; só DEV). */
function knockoutPartsFromMatches(matches: Match[]): MatchPart[] {
  const KO_STAGES: MatchStage[] = [
    MatchStage.LAST_32,
    MatchStage.LAST_16,
    MatchStage.QUARTER_FINALS,
    MatchStage.SEMI_FINALS,
    MatchStage.THIRD_PLACE,
    MatchStage.FINAL,
  ];
  const parts: MatchPart[] = [];
  for (const stage of KO_STAGES) {
    const inStage = matches.filter((m) => String(m.stage) === stage);
    if (inStage.length) {
      parts.push({ id: stage, stage, matchday: null, phaseStatus: 'timed', matches: inStage });
    }
  }
  return parts;
}

/** Resultado forçado (DEV) de um jogo de mata-mata → lado que avança (p/ a cascata). */
function resultPick(r: DevResult): PickSide {
  if (r.home > r.away) return 'home';
  if (r.home < r.away) return 'away';
  return r.advances === 'AWAY' ? 'away' : 'home'; // empate → escolha de "quem passa"
}

/**
 * Mescla confrontos de mata-mata SIMULADOS na lista de jogos (DEV). Deriva a classificação e
 * as fases do próprio `matches` e projeta os 16-avos. Como os jogos de mata-mata simulados
 * usam IDs SINTÉTICOS (nº do jogo, 73..104), os resultados forçados desses jogos vêm SEPARADOS
 * em `results` (mapeados por esse nº) e são aplicados aqui: definem o placar/winner do confronto
 * E guiam a cascata (quem avança à próxima fase). Sem resultado, o pick padrão é o lado "home".
 */
export function withSimulatedKnockout(matches: Match[], results: DevResults = new Map()): Match[] {
  const standings = buildStandings(matches.filter((m) => !!m.group));
  const knockoutParts = knockoutPartsFromMatches(matches);
  const tree = buildBracketTree(standings, knockoutParts);
  if (tree.knockoutMissing) return matches;

  // Picks seguem o resultado forçado do confronto (por nº do jogo) quando houver; senão "home".
  // Iteramos porque cada fase só ganha times depois de a anterior propagar.
  let picks = new Map<number, PickSide>();
  for (let pass = 0; pass < 6; pass++) {
    const view = applyBracketSimulation(tree, picks);
    const next = new Map(picks);
    for (const node of allNodes(view)) {
      if (!node.home.team || !node.away.team || next.has(node.num)) continue;
      const forced = results.get(node.num);
      next.set(node.num, forced ? resultPick(forced) : 'home');
    }
    if (next.size === picks.size) break;
    picks = next;
  }

  const simView = applyBracketSimulation(tree, picks);
  let simMatches = allNodes(simView)
    .map(nodeToMatch)
    .filter((m): m is Match => m !== null);
  if (!simMatches.length) return matches;

  // Aplica o resultado forçado (placar + winner) sobre cada confronto simulado, por nº do jogo.
  simMatches = withDevResults(simMatches, results);

  const simByStage = new Set(simMatches.map((m) => String(m.stage)));
  const simIds = new Set(simMatches.map((m) => m.id));

  // Mantém grupos + jogos de mata-mata reais já definidos; descarta placeholders substituídos.
  const kept = matches.filter((m) => {
    const stage = String(m.stage);
    if (!simByStage.has(stage)) return true;
    if (simIds.has(m.id)) return false;
    const placeholder = isPlaceholderTeam(m.homeTeam) || isPlaceholderTeam(m.awayTeam);
    return !placeholder;
  });

  return [...kept, ...simMatches];
}

// ---------------------------------------------------------------------------
// DEV ONLY — sobrescrita de RESULTADOS reais (só no front, sem tocar no banco)
// ---------------------------------------------------------------------------

/** Resultado "real" forçado para um jogo (placar + quem passa no mata-mata). */
export interface DevResult {
  home: number;
  away: number;
  /** Mata-mata empatado: lado que se classifica (define `score.winner`). */
  advances?: Advances | null;
}

/** Mapa matchId → resultado forçado. */
export type DevResults = ReadonlyMap<number, DevResult>;

/** Jogo com os dois times definidos (editável / sorteável). */
export function canEditMatch(match: Match): boolean {
  return !isPlaceholderTeam(match.homeTeam) && !isPlaceholderTeam(match.awayTeam);
}

function rnd(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

/**
 * DEV: gera um resultado aleatório para um jogo (0–`maxGoals` gols por lado; em empate de
 * mata-mata sorteia o lado que passa). Helper único reusado pelos botões de randomizar.
 */
export function randomDevResult(match: Match, maxGoals = 8): DevResult {
  const home = rnd(maxGoals);
  const away = rnd(maxGoals);
  const result: DevResult = { home, away };
  if (isKnockout(match) && home === away) {
    result.advances = Math.random() < 0.5 ? 'HOME' : 'AWAY';
  }
  return result;
}

/**
 * Aplica resultados forçados (DEV) sobre os jogos: marca-os FINISHED com o placar dado e o
 * `winner` correspondente (do placar, ou do lado que passa em empate). Não muta os originais.
 */
export function withDevResults(matches: Match[], results: DevResults): Match[] {
  if (!results.size) return matches;
  return matches.map((m) => {
    const r = results.get(m.id);
    if (!r) return m;
    const winner =
      r.home > r.away
        ? 'HOME_TEAM'
        : r.home < r.away
          ? 'AWAY_TEAM'
          : r.advances === 'HOME'
            ? 'HOME_TEAM'
            : r.advances === 'AWAY'
              ? 'AWAY_TEAM'
              : 'DRAW';
    return {
      ...m,
      status: MatchStatus.FINISHED,
      score: {
        ...m.score,
        winner,
        fullTime: { home: r.home, away: r.away },
      },
    };
  });
}
