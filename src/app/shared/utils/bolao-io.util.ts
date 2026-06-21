// Export/import de palpites do Bolão Bevi (JSON), com validação sem dependências.

import { BolaoEntry, newEntryId, Palpite } from '@shared/models/bolao.model';

/** JSON formatado de UM palpite (apenas name + palpites; sem o id interno). */
export function exportEntry(entry: BolaoEntry): string {
  return JSON.stringify({ name: entry.name, palpites: entry.palpites }, null, 2);
}

/** JSON formatado de VÁRIOS palpites (array de { name, palpites }; sem ids internos). */
export function exportEntries(entries: BolaoEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({ name: e.name, palpites: e.palpites })),
    null,
    2,
  );
}

/** Slug simples para o nome do arquivo (remove acentos via faixa de diacríticos). */
export function slugify(name: string): string {
  const noAccents = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'palpite';
}

/** Dispara o download de um texto como arquivo .json. */
export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ParseResult =
  | { ok: true; entries: BolaoEntry[] }
  | { ok: false; error: string };

function isPalpite(value: unknown): value is Palpite {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    Number.isFinite(p['matchId']) &&
    Number.isInteger(p['home']) &&
    (p['home'] as number) >= 0 &&
    Number.isInteger(p['away']) &&
    (p['away'] as number) >= 0
  );
}

/** Valida um objeto cru e devolve um BolaoEntry normalizado (id novo). */
function validateEntry(raw: unknown): BolaoEntry | string {
  if (typeof raw !== 'object' || raw === null) {
    return 'Cada palpite deve ser um objeto.';
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj['name'] !== 'string' || !obj['name'].trim()) {
    return 'Campo "name" ausente ou inválido.';
  }
  if (!Array.isArray(obj['palpites'])) {
    return 'Campo "palpites" deve ser uma lista.';
  }
  const palpites: Palpite[] = [];
  for (const item of obj['palpites'] as unknown[]) {
    if (!isPalpite(item)) {
      return 'Há um palpite com formato inválido (matchId/home/away).';
    }
    palpites.push({
      matchId: (item as Palpite).matchId,
      home: (item as Palpite).home,
      away: (item as Palpite).away,
    });
  }
  return { id: newEntryId(), name: (obj['name'] as string).trim(), palpites };
}

/**
 * Faz parse + validação de um JSON de palpites. Aceita um único objeto
 * `{ name, palpites }` ou um array deles (formato do storage). Em sucesso, devolve
 * entries normalizadas com ids novos.
 */
export function parseEntries(rawText: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Arquivo não é um JSON válido.' };
  }

  const list = Array.isArray(data) ? data : [data];
  if (!list.length) {
    return { ok: false, error: 'Nenhum palpite encontrado no arquivo.' };
  }

  const entries: BolaoEntry[] = [];
  for (const raw of list) {
    const result = validateEntry(raw);
    if (typeof result === 'string') {
      return { ok: false, error: result };
    }
    entries.push(result);
  }
  return { ok: true, entries };
}
