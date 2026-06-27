// Derivações puras sobre a lista de partidas. Não fazem request — operam sobre os dados
// já em cache do TanStack Query, consumidas via `computed()` nos componentes.

import { Match, MatchStatus, isLive, isUpcoming } from '@shared/models/match.model';

export interface Highlights {
  /** Jogos ao vivo (se houver), no topo do destaque. */
  live: Match[];
  /** Próximo(s) jogo(s) agendado(s) — todos os que começam no mesmo horário do primeiro. */
  next: Match[];
  /** Último(s) jogo(s) finalizado(s) — todos os que começaram no mesmo horário do mais recente. */
  last: Match[];
  /** Finalizados (antigo→recente), particionados por fase para cabeçalhos sticky. */
  finishedByStage: MatchGroup[];
  /** Agendados (próximo→distante), particionados por fase para cabeçalhos sticky. */
  upcomingByStage: MatchGroup[];
}

const byUtcAsc = (a: Match, b: Match) => a.utcDate.localeCompare(b.utcDate);

/**
 * Destaques do dashboard: ao vivo + próximo + último jogo em destaque, e abaixo as
 * listas completas de finalizados (antigo→recente) e próximos (próximo→distante),
 * cada uma agrupada por fase (ordem oficial).
 */
export function buildHighlights(matches: Match[]): Highlights {
  const live = matches.filter(isLive).sort(byUtcAsc);

  const upcoming = matches.filter(isUpcoming).sort(byUtcAsc);

  // Finalizados em ordem cronológica ascendente (do mais antigo ao mais recente).
  const finished = matches
    .filter((m) => m.status === MatchStatus.FINISHED)
    .sort(byUtcAsc);

  // Próximo(s): todos os agendados que começam no mesmo horário do primeiro da fila.
  const next = upcoming.length
    ? upcoming.filter((m) => m.utcDate === upcoming[0].utcDate)
    : [];
  // Último(s): todos os finalizados que começaram no mesmo horário do mais recente.
  const last = finished.length
    ? finished.filter((m) => m.utcDate === finished[finished.length - 1].utcDate)
    : [];

  return {
    live,
    next,
    last,
    finishedByStage: groupByStage(finished),
    upcomingByStage: groupByStage(upcoming),
  };
}

export interface MatchGroup {
  key: string;
  label: string;
  matches: Match[];
}

const GROUP_LABEL: Record<string, string> = {};
function groupLabel(group: string): string {
  return GROUP_LABEL[group] ?? group.replace('GROUP_', 'Grupo ');
}

/**
 * Agrupa partidas por grupo (fase de grupos) e, no mata-mata (group === null),
 * agrupa pela fase (stage).
 */
export function groupMatches(matches: Match[]): MatchGroup[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.group ?? `STAGE:${m.stage}`;
    const arr = buckets.get(key);
    if (arr) arr.push(m);
    else buckets.set(key, [m]);
  }

  return [...buckets.entries()]
    .map(([key, ms]) => ({
      key,
      label: key.startsWith('STAGE:') ? stageLabel(key.slice(6)) : groupLabel(key),
      matches: ms.sort(byUtcAsc),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Agrupa por grupo/fase com os grupos em ordem (Grupo A, B, C… e mata-mata por último),
 * preservando a ordem original dos jogos dentro de cada grupo (a que a API retornou).
 * Usado no formulário de palpites.
 */
export function groupMatchesPreservingOrder(matches: Match[]): MatchGroup[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.group ?? `STAGE:${m.stage}`;
    const arr = buckets.get(key);
    if (arr) arr.push(m);
    else buckets.set(key, [m]);
  }

  return [...buckets.entries()]
    .map(([key, ms]) => ({
      key,
      label: key.startsWith('STAGE:') ? stageLabel(key.slice(6)) : groupLabel(key),
      matches: ms,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

const STAGE_LABEL: Record<string, string> = {
  PRELIMINARY_ROUND: 'Rodada preliminar',
  GROUP_STAGE: 'Fase de grupos',
  LAST_64: '32-avos de final',
  LAST_32: '16-avos de final',
  LAST_16: 'Oitavas de final',
  QUARTER_FINALS: 'Quartas de final',
  SEMI_FINALS: 'Semifinais',
  THIRD_PLACE: 'Disputa de 3º lugar',
  FINAL: 'Final',
};
export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}

/** Ordem oficial das fases (do começo do torneio à final), para ordenar agrupamentos. */
export const STAGE_ORDER: readonly string[] = [
  'PRELIMINARY_ROUND',
  'GROUP_STAGE',
  'LAST_64',
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
];

function stageIndex(stage: string): number {
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? STAGE_ORDER.length : i;
}

/**
 * Agrupa partidas por fase (`stage`), em ordem oficial (STAGE_ORDER), preservando a
 * ordem cronológica dentro de cada fase. Usado nas listas de Destaques separadas por fase.
 */
export function groupByStage(matches: Match[]): MatchGroup[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = String(m.stage);
    const arr = buckets.get(key);
    if (arr) arr.push(m);
    else buckets.set(key, [m]);
  }

  return [...buckets.entries()]
    .map(([key, ms]) => ({
      key,
      label: stageLabel(key),
      matches: ms.sort(byUtcAsc),
    }))
    .sort((a, b) => stageIndex(a.key) - stageIndex(b.key));
}

export interface StandingRow {
  team: Match['homeTeam'];
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface GroupStanding {
  group: string;
  label: string;
  rows: StandingRow[];
}

/**
 * Classificação por grupo, calculada SÓ a partir dos jogos FINISHED da fase de grupos.
 * Pontuação 3/1/0. Desempate: pontos → saldo → gols pró.
 */
export function buildStandings(matches: Match[]): GroupStanding[] {
  const groups = new Map<string, Map<number, StandingRow>>();

  // Times da fase de grupos sempre têm id; placeholders (id null) são ignorados.
  const ensureRow = (table: Map<number, StandingRow>, team: Match['homeTeam']) => {
    if (team.id == null) return null;
    let row = table.get(team.id);
    if (!row) {
      row = {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      };
      table.set(team.id, row);
    }
    return row;
  };

  const tableFor = (group: string) => {
    let table = groups.get(group);
    if (!table) {
      table = new Map();
      groups.set(group, table);
    }
    return table;
  };

  // 1ª passada: registra todos os grupos e times a partir de TODAS as partidas
  // (mesmo sem jogo encerrado), para a classificação listar todos os grupos zerados.
  for (const m of matches) {
    if (!m.group) continue;
    const table = tableFor(m.group);
    ensureRow(table, m.homeTeam);
    ensureRow(table, m.awayTeam);
  }

  // 2ª passada: acumula estatísticas dos jogos encerrados E dos em andamento
  // (placar parcial dos jogos ao vivo já conta na tabela).
  for (const m of matches) {
    if (!m.group) continue;
    if (m.status !== MatchStatus.FINISHED && !isLive(m)) continue;
    const home = m.score.fullTime.home;
    const away = m.score.fullTime.away;
    if (home == null || away == null) continue;

    const table = tableFor(m.group);
    const h = ensureRow(table, m.homeTeam);
    const a = ensureRow(table, m.awayTeam);
    if (!h || !a) continue;

    h.played++;
    a.played++;
    h.goalsFor += home;
    h.goalsAgainst += away;
    a.goalsFor += away;
    a.goalsAgainst += home;

    if (home > away) {
      h.won++;
      h.points += 3;
      a.lost++;
    } else if (home < away) {
      a.won++;
      a.points += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }

  const standings: GroupStanding[] = [];
  for (const [group, table] of groups) {
    const rows = [...table.values()];
    for (const r of rows) r.goalDiff = r.goalsFor - r.goalsAgainst;
    rows.sort(
      (x, y) => y.points - x.points || y.goalDiff - x.goalDiff || y.goalsFor - x.goalsFor,
    );
    standings.push({ group, label: groupLabel(group), rows });
  }
  standings.sort((a, b) => a.group.localeCompare(b.group));
  return standings;
}

/** Lista de grupos distintos presentes nos dados (para o filtro). */
export function distinctGroups(matches: Match[]): string[] {
  const set = new Set<string>();
  for (const m of matches) if (m.group) set.add(m.group);
  return [...set].sort();
}
