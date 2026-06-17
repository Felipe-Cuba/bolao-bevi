import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes, randomUUID } from 'node:crypto';

// Token lido de variável de ambiente. O firebase-functions carrega automaticamente
// os arquivos functions/.env e functions/.env.<projectId> (ex.: .env.bolao-bevi) tanto
// no deploy quanto no emulador. NÃO vai ao bundle do frontend.
const API_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

// Intervalo mínimo entre chamadas reais à API (rate limit: 10/min). Salvaguarda
// server-side: garante o gate mesmo que vários clientes peçam ao mesmo tempo.
const MIN_INTERVAL_MS = 30_000;

// Cache persistente em Firestore: wcMatches/current = { data, lastUpdated, updatedAtMs }.
const COLLECTION = 'wcMatches';
const DOC_ID = 'current';

initializeApp();
const db = getFirestore();

/**
 * Proxy + gatekeeper das partidas da Copa. Chamado pelo app via rewrite /api/wc
 * (mesma origem, sem CORS). Decide pelo `updatedAtMs` no Firestore se chama a API real:
 * - se a última atualização foi há < 30s, devolve o cache do Firestore;
 * - senão, chama a API, grava no Firestore e devolve o payload novo.
 * Em erro da API, cai no último cache do Firestore (stale) se existir.
 */
export const wcMatches = onRequest(
  { region: 'southamerica-east1', cors: true, maxInstances: 3 },
  async (req, res) => {
    const ref = db.collection(COLLECTION).doc(DOC_ID);

    try {
      const snap = await ref.get();
      const cached = snap.exists ? snap.data() : null;
      const now = Date.now();

      // Gate: cache ainda fresco → devolve sem bater na API.
      if (cached && typeof cached.updatedAtMs === 'number' && now - cached.updatedAtMs < MIN_INTERVAL_MS) {
        res.set('Cache-Control', 'public, max-age=15');
        res.status(200).json({ data: cached.data, updatedAtMs: cached.updatedAtMs, source: 'firestore' });
        return;
      }

      // Vencido → chama a API real.
      const apiRes = await fetch(API_URL, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN ?? '' },
      });

      if (!apiRes.ok) {
        // Falhou (inclui 429). Devolve o último cache, se houver.
        if (cached) {
          res.status(200).json({ data: cached.data, updatedAtMs: cached.updatedAtMs ?? null, source: 'firestore' });
          return;
        }
        res.status(apiRes.status).json({ error: `API retornou ${apiRes.status}` });
        return;
      }

      const data = await apiRes.json();
      const updatedAtMs = Date.now();
      await ref.set({ data, lastUpdated: FieldValue.serverTimestamp(), updatedAtMs });

      res.set('Cache-Control', 'public, max-age=15');
      res.status(200).json({ data, updatedAtMs, source: 'api' });
    } catch (err) {
      console.error('[wcMatches] erro:', err);
      // Último recurso: tenta devolver o cache do Firestore.
      try {
        const snap = await ref.get();
        if (snap.exists) {
          const cached = snap.data();
          res.status(200).json({ data: cached.data, updatedAtMs: cached.updatedAtMs ?? null, source: 'firestore' });
          return;
        }
      } catch {
        /* ignora */
      }
      res.status(502).json({ error: 'Falha ao consultar a API.' });
    }
  },
);

// ── Grupos de palpites compartilhados ──────────────────────────────────────
const GRUPOS = 'grupos';
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Gera um código/id de grupo longo e aleatório (24 chars base62). É a "senha" do grupo. */
function newGroupCode() {
  const bytes = randomBytes(24);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Valida um palpite cru { matchId, home, away } (mesma regra do front, bolao-io.ts). */
function isValidPalpite(p) {
  return (
    p &&
    typeof p === 'object' &&
    Number.isFinite(p.matchId) &&
    Number.isInteger(p.home) &&
    p.home >= 0 &&
    Number.isInteger(p.away) &&
    p.away >= 0
  );
}

/** Normaliza a lista de palpites, descartando entradas inválidas. */
function sanitizePalpites(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isValidPalpite)
    .map((p) => ({ matchId: p.matchId, home: p.home, away: p.away }));
}

/**
 * Grupos sem autenticação: o id do grupo É o código de acesso (longo, aleatório).
 * Toda escrita passa por aqui (Rules negam escrita ao cliente); a existência do grupo
 * valida o código. Risco aceito: quem tem o código pode editar qualquer palpite do grupo.
 *
 * Ações (POST, body.action):
 *  - createGroup { name }                          → { groupId }
 *  - saveEntry   { groupId, entryId?, name, palpites } → { entry }
 *  - removeEntry { groupId, entryId }              → { ok: true }
 */
export const grupos = onRequest(
  { region: 'southamerica-east1', cors: true, maxInstances: 3 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Use POST.' });
      return;
    }

    const body = req.body ?? {};
    const action = body.action;

    try {
      if (action === 'createGroup') {
        const name = String(body.name ?? '').trim();
        if (!name) {
          res.status(400).json({ error: 'Nome do grupo é obrigatório.' });
          return;
        }
        const groupId = newGroupCode();
        await db.collection(GRUPOS).doc(groupId).set({ name, createdAtMs: Date.now() });
        res.status(200).json({ groupId, name });
        return;
      }

      if (action === 'saveEntry') {
        const groupId = String(body.groupId ?? '');
        const name = String(body.name ?? '').trim();
        if (!groupId || !name) {
          res.status(400).json({ error: 'groupId e name são obrigatórios.' });
          return;
        }

        const groupRef = db.collection(GRUPOS).doc(groupId);
        const groupSnap = await groupRef.get();
        if (!groupSnap.exists) {
          res.status(404).json({ error: 'Grupo não encontrado (código inválido).' });
          return;
        }

        const palpites = sanitizePalpites(body.palpites);
        const entriesRef = groupRef.collection('entries');

        // Nome deve ser único no grupo (1 palpite por pessoa). Se editando (entryId),
        // ignora o próprio doc na checagem de colisão.
        const entryId = body.entryId ? String(body.entryId) : null;
        const dup = await entriesRef.where('name', '==', name).get();
        const collides = dup.docs.some((d) => d.id !== entryId);
        if (collides) {
          res.status(409).json({ error: `Já existe um palpite com o nome "${name}".` });
          return;
        }

        const id = entryId ?? randomUUID();
        const entry = { name, palpites, updatedAtMs: Date.now() };
        await entriesRef.doc(id).set(entry, { merge: false });
        res.status(200).json({ entry: { id, ...entry } });
        return;
      }

      if (action === 'removeEntry') {
        const groupId = String(body.groupId ?? '');
        const entryId = String(body.entryId ?? '');
        if (!groupId || !entryId) {
          res.status(400).json({ error: 'groupId e entryId são obrigatórios.' });
          return;
        }
        const groupRef = db.collection(GRUPOS).doc(groupId);
        if (!(await groupRef.get()).exists) {
          res.status(404).json({ error: 'Grupo não encontrado (código inválido).' });
          return;
        }
        await groupRef.collection('entries').doc(entryId).delete();
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Ação desconhecida.' });
    } catch (err) {
      console.error('[grupos] erro:', err);
      res.status(500).json({ error: 'Falha ao processar a requisição.' });
    }
  },
);
