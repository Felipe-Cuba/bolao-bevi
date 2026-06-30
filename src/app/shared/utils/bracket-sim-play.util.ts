// Simulação INTERATIVA do chaveamento: aplica os "picks" do usuário (quem ele decidiu que
// avança em cada jogo) sobre a árvore projetada, propagando cada vencedor à fase seguinte.
// Derivação PURA — recebe a árvore e o mapa de picks, devolve uma nova árvore com os
// vencedores marcados e os slots das fases seguintes preenchidos. A cascata é automática:
// reconstruir tudo a partir dos 16-avos garante que trocar um pick "lá embaixo" limpe os
// picks a jusante que dependiam do time removido (eles deixam de ter origem válida).

import {
  BracketColumn,
  BracketRound,
  BracketTree,
  TreeNode,
  TreeSlot,
} from '@shared/utils/bracket-tree.util';
import { LOSER_DESTINATION, WINNER_DESTINATION } from '@shared/utils/bracket-schema.util';
import { Team } from '@shared/models/match.model';

/** Lado escolhido pelo usuário num jogo. */
export type PickSide = 'home' | 'away';

/** Mapa num-do-jogo → lado que o usuário avançou. */
export type SimPicks = ReadonlyMap<number, PickSide>;

/** Classificação final simulada (para o pódio). */
export interface SimPodium {
  champion: Team | null; // 1º — vencedor da final
  runnerUp: Team | null; // 2º — perdedor da final
  third: Team | null; // 3º — vencedor da disputa de 3º lugar
}

/** Árvore com os picks aplicados, mais o pódio derivado. */
export type SimulatedTree = BracketTree & { podium: SimPodium };

/**
 * Ordem de processamento das fases. THIRD_PLACE vem depois das semis (recebe seus perdedores)
 * e da final — sua posição só precisa ser posterior a SEMI_FINALS.
 */
const ROUND_ORDER: BracketRound[] = [
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'FINAL',
  'THIRD_PLACE',
];

function roundIndex(round: BracketRound): number {
  return ROUND_ORDER.indexOf(round);
}

/** Slot "A definir". */
function emptySlot(): TreeSlot {
  return { team: null, label: 'A definir', score: null, regScore: null, penScore: null, winner: false };
}

/** Cópia rasa de um slot, zerando o destaque de vencedor (recalculado pela simulação). */
function resetSlot(slot: TreeSlot): TreeSlot {
  return { ...slot, winner: false };
}

/** Um slot tem time "real" (não placeholder) para poder avançar? */
function hasTeam(slot: TreeSlot): boolean {
  return slot.team != null;
}

/**
 * Aplica os picks sobre a árvore. Estratégia: clonar todos os nós, indexá-los por num e
 * processá-los em ordem de fase. Para cada jogo, se houver pick e o slot escolhido tiver
 * time, marca-o vencedor e copia o time para o slot de destino (jogo seguinte). Como as
 * fases ≥ oitavas começam vazias e só são preenchidas por propagação, um pick inválido
 * (cujo time sumiu) simplesmente não propaga — a cascata "limpa" sozinha.
 */
export function applyBracketSimulation(tree: BracketTree, picks: SimPicks): SimulatedTree {
  // 1. Clona colunas e nós (sem mutar a árvore original).
  const cloneSlotPair = (n: TreeNode): TreeNode => ({
    ...n,
    home: resetSlot(n.home),
    away: resetSlot(n.away),
  });

  const cloneColumns = (cols: BracketColumn[]): BracketColumn[] =>
    cols.map((c) => ({ ...c, nodes: c.nodes.map(cloneSlotPair) }));

  const left = cloneColumns(tree.left);
  const right = cloneColumns(tree.right);
  const final = cloneSlotPair(tree.final);
  const thirdPlace = cloneSlotPair(tree.thirdPlace);

  // 2. Indexa todos os nós por num (inclui a final e a disputa de 3º).
  const byNum = new Map<number, TreeNode>();
  for (const col of [...left, ...right]) for (const n of col.nodes) byNum.set(n.num, n);
  byNum.set(final.num, final);
  byNum.set(thirdPlace.num, thirdPlace);

  // 3. Para fases ≥ oitavas, esvazia os slots: serão preenchidos só por propagação de picks
  //    (assim a árvore reflete a simulação, não os placeholders/jogos da API).
  for (const n of byNum.values()) {
    if (roundIndex(n.round) > roundIndex('LAST_32')) {
      n.home = emptySlot();
      n.away = emptySlot();
    }
  }

  // 4. Propaga em ordem de fase: 16-avos → final → 3º lugar.
  const ordered = [...byNum.values()].sort(
    (a, b) => roundIndex(a.round) - roundIndex(b.round) || a.num - b.num,
  );

  for (const node of ordered) {
    const pick = picks.get(node.num);
    if (!pick) continue;
    const winnerSlot = node[pick];
    if (!hasTeam(winnerSlot)) continue; // pick órfão (time não chegou): ignora → cascata limpa
    const loserSlot = node[pick === 'home' ? 'away' : 'home'];

    // Marca o vencedor escolhido.
    node.home = { ...node.home, winner: pick === 'home' };
    node.away = { ...node.away, winner: pick === 'away' };

    // Propaga o VENCEDOR para o jogo seguinte.
    const winDest = WINNER_DESTINATION.get(node.num);
    if (winDest) {
      const target = byNum.get(winDest.match);
      if (target) target[winDest.slot] = advancedSlot(winnerSlot.team!, winnerSlot.label);
    }

    // Propaga o PERDEDOR para a disputa de 3º lugar (só as semis têm destino de perdedor).
    const loseDest = LOSER_DESTINATION.get(node.num);
    if (loseDest && hasTeam(loserSlot)) {
      const target = byNum.get(loseDest.match);
      if (target) target[loseDest.slot] = advancedSlot(loserSlot.team!, loserSlot.label);
    }
  }

  const podium: SimPodium = {
    champion: simulatedChampion(final, picks),
    runnerUp: simulatedLoser(final, picks),
    third: simulatedChampion(thirdPlace, picks),
  };

  return {
    ...tree,
    left,
    right,
    final,
    thirdPlace,
    champion: podium.champion,
    podium,
  };
}

/** Slot de um time que avançou via simulação (sem placar; será clicável adiante). */
function advancedSlot(team: Team, label: string): TreeSlot {
  return { team, label, score: null, regScore: null, penScore: null, winner: false };
}

/** Vencedor simulado de um nó: o lado escolhido, se houver pick e time. */
function simulatedChampion(node: TreeNode, picks: SimPicks): Team | null {
  const pick = picks.get(node.num);
  if (!pick) return null;
  return node[pick].team ?? null;
}

/** Perdedor simulado de um nó: o lado NÃO escolhido, se houver pick e time. */
function simulatedLoser(node: TreeNode, picks: SimPicks): Team | null {
  const pick = picks.get(node.num);
  if (!pick) return null;
  const loser = node[pick === 'home' ? 'away' : 'home'];
  return loser.team ?? null;
}

/**
 * Remove os picks "órfãos": jogos cujo lado escolhido não tem mais time depois de aplicar a
 * simulação (porque um pick anterior mudou e o time deixou de chegar até aqui). Itera até
 * estabilizar — limpar um órfão pode tornar outro órfão. Devolve um Map novo, podado.
 *
 * Usar após cada clique mantém o estado consistente (cascata a jusante limpa de fato).
 */
export function prunePicks(tree: BracketTree, picks: SimPicks): Map<number, PickSide> {
  let current = new Map(picks);
  for (;;) {
    const applied = applyBracketSimulation(tree, current);
    const byNum = new Map<number, TreeNode>();
    for (const col of [...applied.left, ...applied.right]) {
      for (const n of col.nodes) byNum.set(n.num, n);
    }
    byNum.set(applied.final.num, applied.final);
    byNum.set(applied.thirdPlace.num, applied.thirdPlace);

    const next = new Map(current);
    for (const [num, side] of current) {
      const node = byNum.get(num);
      if (!node || !hasTeam(node[side])) next.delete(num);
    }
    if (next.size === current.size) return next;
    current = next;
  }
}
