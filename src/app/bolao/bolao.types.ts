// Modelo de dados do Bolão Bevi — camada local (localStorage), independente da API.

/** Palpite de placar para um jogo específico (indexado pelo id da partida). */
export interface Palpite {
  matchId: number;
  home: number;
  away: number;
}

/** Linha do rascunho de edição: placar digitado (ainda não salvo), podendo estar incompleto. */
export interface DraftLine {
  home: number | null;
  away: number | null;
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
