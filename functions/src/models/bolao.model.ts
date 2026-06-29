// Tipos do bolão (palpites e grupos compartilhados).

/** Lado que se classifica num jogo de mata-mata. */
export type Advances = 'HOME' | 'AWAY';

/** Um palpite cru { matchId, home, away, advances? }. */
export interface Palpite {
  matchId: number;
  home: number;
  away: number;
  /** Só no mata-mata; obrigatório quando o palpite é de empate. */
  advances?: Advances;
}

/** Um conjunto nomeado de palpites (documento na subcoleção `entries`). */
export interface BolaoEntry {
  id: string;
  name: string;
  palpites: Palpite[];
  updatedAtMs?: number;
}

/** Metadados de um grupo (doc na coleção `grupos`). */
export interface Grupo {
  name: string;
  createdAtMs?: number;
}
