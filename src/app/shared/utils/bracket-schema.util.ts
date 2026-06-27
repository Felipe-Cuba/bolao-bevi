// Tabela DECLARATIVA do mata-mata da Copa 2026 — a fonte da verdade em código.
//
// Transcrição linha a linha de `brackets.md` (jogos 73→104, a numeração oficial da FIFA).
// Cada jogo declara seus dois lados de forma legível e auditável contra o md. A partir
// dela deriva-se TUDO: os 16-avos projetados (bracket-simulation) e a topologia da árvore
// (bracket-tree). Não há constantes mágicas — a adjacência das fases está nos `winnerOf`.
//
// Como ler um lado (SlotRef):
//   { kind: 'first',  group: 'E' }                 → "1ºE"  (1º colocado do grupo E)
//   { kind: 'second', group: 'B' }                 → "2ºB"  (2º colocado do grupo B)
//   { kind: 'third',  priority: ['A','B','C',...] }→ "3ºABCDF" (ordem = PRIORIDADE)
//   { kind: 'winnerOf', match: 74 }                → "V 74" (vencedor do jogo 74)
//   { kind: 'loserOf',  match: 101 }               → "P 101" (perdedor do jogo 101)

export type GroupLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

/** Fase de um jogo do mata-mata (inclui a disputa de 3º, que fica fora da árvore). */
export type SchemaRound =
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL';

/** Referência a um dos lados de um confronto. */
export type SlotRef =
  | { kind: 'first'; group: GroupLetter }
  | { kind: 'second'; group: GroupLetter }
  | { kind: 'third'; priority: GroupLetter[] }
  | { kind: 'winnerOf'; match: number }
  | { kind: 'loserOf'; match: number };

/** Um jogo do mata-mata, identificado pelo número oficial (73..104). */
export interface SchemaMatch {
  num: number;
  round: SchemaRound;
  home: SlotRef;
  away: SlotRef;
}

// Atalhos para manter a tabela curta e legível.
const G1 = (group: GroupLetter): SlotRef => ({ kind: 'first', group });
const G2 = (group: GroupLetter): SlotRef => ({ kind: 'second', group });
const T = (priority: string): SlotRef => ({
  kind: 'third',
  priority: priority.split('') as GroupLetter[],
});
const W = (match: number): SlotRef => ({ kind: 'winnerOf', match });
const L = (match: number): SlotRef => ({ kind: 'loserOf', match });

/**
 * Os 32 jogos do mata-mata (brackets.md). A ordem segue a numeração oficial.
 * LAST_32 (73–88) é projetado da classificação; LAST_16+ vem dos jogos reais da API.
 */
export const BRACKET_SCHEMA: readonly SchemaMatch[] = [
  // ── 16-avos de final (73–88) ──────────────────────────────────────────────
  { num: 73, round: 'LAST_32', home: G2('A'), away: G2('B') },
  { num: 74, round: 'LAST_32', home: G1('E'), away: T('ABCDF') },
  { num: 75, round: 'LAST_32', home: G1('F'), away: G2('C') },
  { num: 76, round: 'LAST_32', home: G1('C'), away: G2('F') },
  { num: 77, round: 'LAST_32', home: G1('I'), away: T('CDFGH') },
  { num: 78, round: 'LAST_32', home: G2('E'), away: G2('I') },
  { num: 79, round: 'LAST_32', home: G1('A'), away: T('CEFHI') },
  { num: 80, round: 'LAST_32', home: G1('L'), away: T('EHIJK') },
  { num: 81, round: 'LAST_32', home: G1('D'), away: T('BEFIJ') },
  { num: 82, round: 'LAST_32', home: G1('G'), away: T('AEHIJ') },
  { num: 83, round: 'LAST_32', home: G2('K'), away: G2('L') },
  { num: 84, round: 'LAST_32', home: G1('H'), away: G2('J') },
  { num: 85, round: 'LAST_32', home: G1('B'), away: T('EFGIJ') },
  { num: 86, round: 'LAST_32', home: G1('J'), away: G2('H') },
  { num: 87, round: 'LAST_32', home: G1('K'), away: T('DEIJL') },
  { num: 88, round: 'LAST_32', home: G2('D'), away: G2('G') },

  // ── Oitavas de final (89–96) ──────────────────────────────────────────────
  { num: 89, round: 'LAST_16', home: W(74), away: W(77) },
  { num: 90, round: 'LAST_16', home: W(73), away: W(75) },
  { num: 91, round: 'LAST_16', home: W(76), away: W(78) },
  { num: 92, round: 'LAST_16', home: W(79), away: W(80) },
  { num: 93, round: 'LAST_16', home: W(83), away: W(84) },
  { num: 94, round: 'LAST_16', home: W(81), away: W(82) },
  { num: 95, round: 'LAST_16', home: W(86), away: W(88) },
  { num: 96, round: 'LAST_16', home: W(85), away: W(87) },

  // ── Quartas de final (97–100) ─────────────────────────────────────────────
  { num: 97, round: 'QUARTER_FINALS', home: W(89), away: W(90) },
  { num: 98, round: 'QUARTER_FINALS', home: W(93), away: W(94) },
  { num: 99, round: 'QUARTER_FINALS', home: W(91), away: W(92) },
  { num: 100, round: 'QUARTER_FINALS', home: W(95), away: W(96) },

  // ── Semifinais (101–102) ──────────────────────────────────────────────────
  { num: 101, round: 'SEMI_FINALS', home: W(97), away: W(98) },
  { num: 102, round: 'SEMI_FINALS', home: W(99), away: W(100) },

  // ── Disputa de 3º lugar (103) — fora da árvore principal ──────────────────
  { num: 103, round: 'THIRD_PLACE', home: L(101), away: L(102) },

  // ── Final (104) ───────────────────────────────────────────────────────────
  { num: 104, round: 'FINAL', home: W(101), away: W(102) },
];

/** Índice num → jogo, para lookups O(1). */
export const schemaByNum: ReadonlyMap<number, SchemaMatch> = new Map(
  BRACKET_SCHEMA.map((m) => [m.num, m]),
);

/** Os 16 jogos de 16-avos (73–88), na ordem oficial. */
export function last32Games(): SchemaMatch[] {
  return BRACKET_SCHEMA.filter((m) => m.round === 'LAST_32');
}

/** Os 8 jogos de 16-avos que recebem um melhor-terceiro (lado `third`), na ordem oficial. */
export function thirdGames(): SchemaMatch[] {
  return last32Games().filter((m) => m.away.kind === 'third' || m.home.kind === 'third');
}

/** Destino do vencedor de um jogo: o jogo seguinte e em qual lado (home/away) ele entra. */
export interface WinnerDestination {
  match: number;
  slot: 'home' | 'away';
}

/**
 * Mapa num → para onde vai o VENCEDOR daquele jogo (qual jogo seguinte, em qual slot).
 * Derivado dos `winnerOf` do schema. A final (104) não tem destino. Usado pela simulação
 * interativa para propagar um pick à fase seguinte.
 */
export const WINNER_DESTINATION: ReadonlyMap<number, WinnerDestination> = (() => {
  const map = new Map<number, WinnerDestination>();
  for (const m of BRACKET_SCHEMA) {
    if (m.home.kind === 'winnerOf') map.set(m.home.match, { match: m.num, slot: 'home' });
    if (m.away.kind === 'winnerOf') map.set(m.away.match, { match: m.num, slot: 'away' });
  }
  return map;
})();

/**
 * Mapa num → para onde vai o PERDEDOR daquele jogo (qual jogo, em qual slot). Derivado dos
 * `loserOf` do schema — na prática só a disputa de 3º lugar (103) recebe perdedores (das semis).
 */
export const LOSER_DESTINATION: ReadonlyMap<number, WinnerDestination> = (() => {
  const map = new Map<number, WinnerDestination>();
  for (const m of BRACKET_SCHEMA) {
    if (m.home.kind === 'loserOf') map.set(m.home.match, { match: m.num, slot: 'home' });
    if (m.away.kind === 'loserOf') map.set(m.away.match, { match: m.num, slot: 'away' });
  }
  return map;
})();
