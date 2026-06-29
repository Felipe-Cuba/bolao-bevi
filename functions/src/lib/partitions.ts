// Particionamento do payload de partidas por fase+rodada (classe estática, sem Firestore).
//
// O payload bruto da API (football-data.org) traz competition/season/matches num único
// objeto. Aqui separamos os jogos em partes coesas (group-1/2/3, last-32, ..., final),
// cada uma com um `phaseStatus` agregado, para gravar/ler granularmente no Firestore.

import type {
  Match,
  MatchesPayload,
  PhaseStatus as PhaseStatusType,
} from '#models';
import type { MatchPart, MatchesMeta, PartitionResult } from '#models';

/** Particionador do payload de partidas. Métodos e tabelas são todos estáticos. */
export class MatchPartitioner {
  /** Status agregado de uma fase, derivado dos status dos seus jogos. */
  public static PhaseStatus: Record<'FINISHED' | 'ONGOING' | 'TIMED', PhaseStatusType> = {
    FINISHED: 'finished', // todos os jogos concluídos (imutável → cacheável "para sempre")
    ONGOING: 'ongoing', // misto, ou algum jogo ao vivo
    TIMED: 'timed', // todos ainda por jogar
  };

  // Estados terminais contam como "concluído"; ao vivo força "ongoing"; o resto é "pendente".
  public static TERMINAL: ReadonlySet<string> = new Set(['FINISHED', 'CANCELLED']);
  public static LIVE: ReadonlySet<string> = new Set(['IN_PLAY', 'PAUSED', 'LIVE']);

  // Ordem oficial das partes (para montar o payload completo de forma estável).
  public static PART_ORDER: readonly string[] = [
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

  // Mapa stage → id de partição (mata-mata: 1 parte por fase, matchday é null).
  static #STAGE_PART: Record<string, string> = {
    LAST_32: 'last-32',
    LAST_16: 'last-16',
    QUARTER_FINALS: 'quarters',
    SEMI_FINALS: 'semis',
    THIRD_PLACE: 'third',
    FINAL: 'final',
  };

  /** Id da partição de um jogo (fase de grupos por rodada; mata-mata por fase). */
  public static partIdFor(match: Match): string {
    if (match.stage === 'GROUP_STAGE') {
      return `group-${match.matchday ?? 'x'}`;
    }
    return MatchPartitioner.#STAGE_PART[match.stage] ?? `stage-${String(match.stage).toLowerCase()}`;
  }

  /**
   * Status agregado de um conjunto de jogos:
   *  - algum ao vivo, ou mistura de concluídos e pendentes → ongoing
   *  - todos concluídos (FINISHED/CANCELLED) → finished
   *  - nenhum concluído e nenhum ao vivo (todos pendentes) → timed
   */
  public static phaseStatusFor(matches: Match[]): PhaseStatusType {
    const { PhaseStatus, TERMINAL, LIVE } = MatchPartitioner;
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
  public static partition(payload: MatchesPayload): PartitionResult {
    const matches: Match[] = Array.isArray(payload?.matches) ? payload.matches : [];

    // Agrupa por id de partição preservando a ordem de chegada dentro de cada parte.
    const byId = new Map<string, Match[]>();
    for (const match of matches) {
      const id = MatchPartitioner.partIdFor(match);
      const list = byId.get(id) ?? byId.set(id, []).get(id)!;
      list.push(match);
    }

    // Ordena as partes: as conhecidas pela ordem oficial, as demais ao final (alfabético).
    const order = MatchPartitioner.PART_ORDER;
    const ids = [...byId.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const parts: MatchPart[] = ids.map((id) => {
      const list = byId.get(id) ?? [];
      const first = list[0];
      return {
        id,
        stage: first.stage,
        matchday: first.matchday ?? null,
        phaseStatus: MatchPartitioner.phaseStatusFor(list),
        matches: list,
      };
    });

    const meta: MatchesMeta = {
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
  public static assemble(meta: MatchesMeta | null, parts: MatchPart[]): MatchesPayload {
    const ordered = [...parts].sort(
      (a, b) => MatchPartitioner.#indexOfPart(a.id) - MatchPartitioner.#indexOfPart(b.id),
    );
    const matches = ordered.flatMap((p) => p.matches ?? []);
    return {
      competition: meta?.competition ?? null,
      season: meta?.season ?? null,
      matches,
    };
  }

  static #indexOfPart(id: string): number {
    const i = MatchPartitioner.PART_ORDER.indexOf(id);
    return i === -1 ? MatchPartitioner.PART_ORDER.length : i;
  }
}
