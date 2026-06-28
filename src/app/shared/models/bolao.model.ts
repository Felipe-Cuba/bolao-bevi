// Modelo de dados do Bolão Bevi — camada local (localStorage), independente da API.

/** Lado que se classifica num confronto de mata-mata (palpite de "quem passa"). */
export type Advances = 'HOME' | 'AWAY';

/** Palpite de placar para um jogo específico (indexado pelo id da partida). */
export interface Palpite {
  matchId: number;
  home: number;
  away: number;
  /**
   * Quem o palpiteiro acha que se classifica. Só no mata-mata. Em placar não-empate é
   * implícito pelo placar; obrigatório quando o palpite é de empate (decidido nos pênaltis).
   */
  advances?: Advances;
}

/** Linha do rascunho de edição: placar digitado (ainda não salvo), podendo estar incompleto. */
export interface DraftLine {
  home: number | null;
  away: number | null;
  /** Lado escolhido para passar (mata-mata). null/ausente = não escolhido. */
  advances?: Advances | null;
}

/** Um conjunto nomeado de palpites (ex.: "Dsintech palpites"). */
export interface BolaoEntry {
  id: string;
  name: string;
  palpites: Palpite[];
}

/** Chave do localStorage usada pelo storageSignal. */
export const BOLAO_STORAGE_KEY = 'bolao.entries';

/** Gera um id simples e único para um novo palpite. */
export function newEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
