// Tabela DECLARATIVA do mata-mata da Copa 2026 — a fonte da verdade em código.
//
// Transcrição de `brackets.md` (jogos 73→104, a numeração oficial da FIFA). A partir dela
// deriva-se a TOPOLOGIA da árvore (bracket-tree): cada jogo de oitavas+ referencia os jogos
// anteriores via `winnerOf`/`loserOf`, sem constantes mágicas — a adjacência das fases está
// nesses refs.
//
// 16-avos (LAST_32, 73–88): são FOLHAS. Os times vêm dos confrontos REAIS da coleção
// `wcLast32` (1 doc por confronto, numerado 1–16; `num = 72 + numero`), não mais de uma
// projeção da classificação — por isso aqui só guardamos `{ num, round }`.
//
// Estrutura da árvore (brackets.md): duas metades que só se cruzam na final.
//   • Lado A: confrontos 1–8  (num 73–80) → oitavas 89–92 → quartas 97–98 → semi 101
//   • Lado B: confrontos 9–16 (num 81–88) → oitavas 93–96 → quartas 99–100 → semi 102
// As oitavas pareiam VENCEDORES de confrontos consecutivos: V73×V74, V75×V76, …, V87×V88.
//
// Como ler um lado (SlotRef) de oitavas+:
//   { kind: 'winnerOf', match: 74 } → "V 74" (vencedor do jogo 74)
//   { kind: 'loserOf',  match: 101 } → "P 101" (perdedor do jogo 101)

/** Fase de um jogo do mata-mata (inclui a disputa de 3º, que fica fora da árvore). */
export type SchemaRound =
  | 'LAST_32'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL';

/**
 * Referência a um dos lados de um confronto de oitavas+ (LAST_32 não usa: seus times vêm
 * da coleção `wcLast32`).
 */
export type SlotRef =
  | { kind: 'winnerOf'; match: number }
  | { kind: 'loserOf'; match: number };

/** Um jogo do mata-mata, identificado pelo número oficial (73..104). */
export interface SchemaMatch {
  num: number;
  round: SchemaRound;
  /** Lados (winnerOf/loserOf) — apenas para oitavas+; ausentes nos 16-avos (folhas). */
  home?: SlotRef;
  away?: SlotRef;
}

// Atalhos para manter a tabela curta e legível.
const W = (match: number): SlotRef => ({ kind: 'winnerOf', match });
const L = (match: number): SlotRef => ({ kind: 'loserOf', match });

/**
 * Os 32 jogos do mata-mata (brackets.md). A ordem segue a numeração oficial.
 * LAST_32 (73–88) são folhas (times vêm de `wcLast32`); LAST_16+ vêm dos jogos reais da API,
 * com a topologia abaixo.
 */
export const BRACKET_SCHEMA: readonly SchemaMatch[] = [
  // ── 16-avos de final (73–88) — folhas; times vêm da coleção wcLast32 ──────────
  { num: 73, round: 'LAST_32' },
  { num: 74, round: 'LAST_32' },
  { num: 75, round: 'LAST_32' },
  { num: 76, round: 'LAST_32' },
  { num: 77, round: 'LAST_32' },
  { num: 78, round: 'LAST_32' },
  { num: 79, round: 'LAST_32' },
  { num: 80, round: 'LAST_32' },
  { num: 81, round: 'LAST_32' },
  { num: 82, round: 'LAST_32' },
  { num: 83, round: 'LAST_32' },
  { num: 84, round: 'LAST_32' },
  { num: 85, round: 'LAST_32' },
  { num: 86, round: 'LAST_32' },
  { num: 87, round: 'LAST_32' },
  { num: 88, round: 'LAST_32' },

  // ── Oitavas de final (89–96) — vencedores de confrontos consecutivos ──────────
  // Lado A (confrontos 1–8 / num 73–80)
  { num: 89, round: 'LAST_16', home: W(73), away: W(74) },
  { num: 90, round: 'LAST_16', home: W(75), away: W(76) },
  { num: 91, round: 'LAST_16', home: W(77), away: W(78) },
  { num: 92, round: 'LAST_16', home: W(79), away: W(80) },
  // Lado B (confrontos 9–16 / num 81–88)
  { num: 93, round: 'LAST_16', home: W(81), away: W(82) },
  { num: 94, round: 'LAST_16', home: W(83), away: W(84) },
  { num: 95, round: 'LAST_16', home: W(85), away: W(86) },
  { num: 96, round: 'LAST_16', home: W(87), away: W(88) },

  // ── Quartas de final (97–100) ─────────────────────────────────────────────
  // Lado A
  { num: 97, round: 'QUARTER_FINALS', home: W(89), away: W(90) },
  { num: 98, round: 'QUARTER_FINALS', home: W(91), away: W(92) },
  // Lado B
  { num: 99, round: 'QUARTER_FINALS', home: W(93), away: W(94) },
  { num: 100, round: 'QUARTER_FINALS', home: W(95), away: W(96) },

  // ── Semifinais (101–102) ──────────────────────────────────────────────────
  { num: 101, round: 'SEMI_FINALS', home: W(97), away: W(98) }, // Lado A
  { num: 102, round: 'SEMI_FINALS', home: W(99), away: W(100) }, // Lado B

  // ── Disputa de 3º lugar (103) — fora da árvore principal ──────────────────
  { num: 103, round: 'THIRD_PLACE', home: L(101), away: L(102) },

  // ── Final (104) ───────────────────────────────────────────────────────────
  { num: 104, round: 'FINAL', home: W(101), away: W(102) },
];

/** Índice num → jogo, para lookups O(1). */
export const schemaByNum: ReadonlyMap<number, SchemaMatch> = new Map(
  BRACKET_SCHEMA.map((m) => [m.num, m]),
);

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
    if (m.home?.kind === 'winnerOf') map.set(m.home.match, { match: m.num, slot: 'home' });
    if (m.away?.kind === 'winnerOf') map.set(m.away.match, { match: m.num, slot: 'away' });
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
    if (m.home?.kind === 'loserOf') map.set(m.home.match, { match: m.num, slot: 'home' });
    if (m.away?.kind === 'loserOf') map.set(m.away.match, { match: m.num, slot: 'away' });
  }
  return map;
})();
