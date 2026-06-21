// Particionamento do payload de partidas por fase+rodada (funções puras, sem Firestore).
//
// O payload bruto da API (football-data.org) traz competition/season/matches num único
// objeto. Aqui separamos os jogos em partes coesas (group-1/2/3, last-32, ..., final),
// cada uma com um `phaseStatus` agregado, para gravar/ler granularmente no Firestore.

/** Status agregado de uma fase, derivado dos status dos seus jogos. */
export const PhaseStatus = {
  FINISHED: 'finished', // todos os jogos concluídos (imutável → cacheável "para sempre")
  ONGOING: 'ongoing', // misto, ou algum jogo ao vivo
  TIMED: 'timed', // todos ainda por jogar
};

// Estados terminais contam como "concluído"; ao vivo força "ongoing"; o resto é "pendente".
const TERMINAL = new Set(['FINISHED', 'CANCELLED']);
const LIVE = new Set(['IN_PLAY', 'PAUSED', 'LIVE']);

// Mapa stage → id de partição (mata-mata: 1 parte por fase, matchday é null).
const STAGE_PART = {
  LAST_32: 'last-32',
  LAST_16: 'last-16',
  QUARTER_FINALS: 'quarters',
  SEMI_FINALS: 'semis',
  THIRD_PLACE: 'third',
  FINAL: 'final',
};

// Ordem oficial das partes (para montar o payload completo de forma estável).
export const PART_ORDER = [
  'group-1',
  'group-2',
  'group-3',
  'last-32',
  'last-16',
  'quarters',
  'semis',
  'third',
  'final',
];

/** Id da partição de um jogo (fase de grupos por rodada; mata-mata por fase). */
export function partIdFor(match) {
  if (match.stage === 'GROUP_STAGE') {
    return `group-${match.matchday ?? 'x'}`;
  }
  return STAGE_PART[match.stage] ?? `stage-${String(match.stage).toLowerCase()}`;
}

/**
 * Status agregado de um conjunto de jogos:
 *  - algum ao vivo, ou mistura de concluídos e pendentes → ongoing
 *  - todos concluídos (FINISHED/CANCELLED) → finished
 *  - nenhum concluído e nenhum ao vivo (todos pendentes) → timed
 */
export function phaseStatusFor(matches) {
  if (!matches.length) return PhaseStatus.TIMED;

  let done = 0;
  let live = 0;
  for (const m of matches) {
    if (LIVE.has(m.status)) live++;
    else if (TERMINAL.has(m.status)) done++;
  }

  if (live > 0) return PhaseStatus.ONGOING;
  if (done === matches.length) return PhaseStatus.FINISHED;
  if (done === 0) return PhaseStatus.TIMED;
  return PhaseStatus.ONGOING; // misto (uns concluídos, outros pendentes)
}

/**
 * Particiona o payload bruto da API em { meta, parts }.
 *
 * meta:  { competition, season, parts: [{ id, stage, matchday, phaseStatus, count }] }
 * parts: [{ id, stage, matchday, phaseStatus, matches }]  (na ordem oficial)
 */
export function partition(payload) {
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];

  // Agrupa por id de partição preservando a ordem de chegada dentro de cada parte.
  const byId = new Map();
  for (const match of matches) {
    const id = partIdFor(match);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(match);
  }

  // Ordena as partes: as conhecidas pela ordem oficial, as demais ao final (alfabético).
  const ids = [...byId.keys()].sort((a, b) => {
    const ia = PART_ORDER.indexOf(a);
    const ib = PART_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const parts = ids.map((id) => {
    const list = byId.get(id);
    const first = list[0];
    return {
      id,
      stage: first.stage,
      matchday: first.matchday ?? null,
      phaseStatus: phaseStatusFor(list),
      matches: list,
    };
  });

  const meta = {
    competition: payload?.competition ?? null,
    season: payload?.season ?? null,
    parts: parts.map((p) => ({
      id: p.id,
      stage: p.stage,
      matchday: p.matchday,
      phaseStatus: p.phaseStatus,
      count: p.matches.length,
    })),
  };

  return { meta, parts };
}

/**
 * Remonta o payload completo (compatível com o formato antigo) a partir do meta + partes.
 * `parts` pode vir fora de ordem; reordenamos pela ordem oficial.
 */
export function assemble(meta, parts) {
  const ordered = [...parts].sort(
    (a, b) => indexOfPart(a.id) - indexOfPart(b.id),
  );
  const matches = ordered.flatMap((p) => p.matches ?? []);
  return {
    competition: meta?.competition ?? null,
    season: meta?.season ?? null,
    matches,
  };
}

function indexOfPart(id) {
  const i = PART_ORDER.indexOf(id);
  return i === -1 ? PART_ORDER.length : i;
}
