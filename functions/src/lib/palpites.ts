// Validação/normalização de palpites (mesma regra do front, bolao-io.ts). Classe estática.

import type { Palpite } from '#models';

export class PalpiteValidator {
  /** Valida um palpite cru { matchId, home, away, advances? }. Type guard p/ Palpite. */
  public static isValid(p: unknown): p is Palpite {
    if (!p || typeof p !== 'object') return false;
    const c = p as Record<string, unknown>;
    return (
      Number.isFinite(c.matchId) &&
      Number.isInteger(c.home) &&
      (c.home as number) >= 0 &&
      Number.isInteger(c.away) &&
      (c.away as number) >= 0 &&
      (c.advances === undefined || c.advances === 'HOME' || c.advances === 'AWAY')
    );
  }

  /** Normaliza a lista de palpites, descartando entradas inválidas. Preserva `advances` (mata-mata). */
  public static sanitize(raw: unknown): Palpite[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is Palpite => PalpiteValidator.isValid(p)).map((p) => {
      const out: Palpite = { matchId: p.matchId, home: p.home, away: p.away };
      if (p.advances === 'HOME' || p.advances === 'AWAY') out.advances = p.advances;
      return out;
    });
  }
}
