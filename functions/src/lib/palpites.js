// Validação/normalização de palpites (mesma regra do front, bolao-io.ts).

/** Valida um palpite cru { matchId, home, away, advances? }. */
export function isValidPalpite(p) {
  return (
    p &&
    typeof p === 'object' &&
    Number.isFinite(p.matchId) &&
    Number.isInteger(p.home) &&
    p.home >= 0 &&
    Number.isInteger(p.away) &&
    p.away >= 0 &&
    (p.advances === undefined || p.advances === 'HOME' || p.advances === 'AWAY')
  );
}

/** Normaliza a lista de palpites, descartando entradas inválidas. Preserva `advances` (mata-mata). */
export function sanitizePalpites(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidPalpite).map((p) => {
    const out = { matchId: p.matchId, home: p.home, away: p.away };
    if (p.advances === 'HOME' || p.advances === 'AWAY') out.advances = p.advances;
    return out;
  });
}
