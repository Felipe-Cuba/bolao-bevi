// Regra do gate de cache (intervalo mínimo entre chamadas reais à API). Classe estática.
// Os serviços de partidas e artilharia compartilham essa decisão de "ainda está fresco?".

import { MIN_INTERVAL_MS } from '#config';

export class CacheGate {
  /**
   * O cache está FRESCO? (atualizado há menos de `intervalMs`). Quando true, não se deve
   * bater na API. `updatedAtMs` ausente/não-numérico conta como vencido.
   */
  public static isFresh(updatedAtMs: number | null | undefined, intervalMs = MIN_INTERVAL_MS): boolean {
    return typeof updatedAtMs === 'number' && Date.now() - updatedAtMs < intervalMs;
  }

  /** Inverso de `isFresh`: o cache venceu e pode-se chamar a API. */
  public static isStale(updatedAtMs: number | null | undefined, intervalMs = MIN_INTERVAL_MS): boolean {
    return !CacheGate.isFresh(updatedAtMs, intervalMs);
  }
}
