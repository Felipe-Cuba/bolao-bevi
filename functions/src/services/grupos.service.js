import { randomUUID } from 'node:crypto';

import { inject } from '../core/injector.js';
import { GruposRepository } from '../repositories/grupos.repository.js';
import { newGroupCode } from '../lib/group-code.js';
import { sanitizePalpites } from '../lib/palpites.js';
import { HttpError } from '../lib/http-error.js';

/**
 * Serviço dos grupos de palpites compartilhados.
 *
 * Grupos sem autenticação: o id do grupo É o código de acesso (longo, aleatório).
 * Toda escrita passa por aqui (Rules negam escrita ao cliente); a existência do grupo
 * valida o código. Risco aceito: quem tem o código pode editar qualquer palpite do grupo.
 */
export class GruposService {
  /** Repositório injetado (singleton resolvido pelo injector). */
  repo = inject(GruposRepository);

  /** Garante que o grupo existe; lança 404 caso contrário. */
  async #requireGroup(groupId) {
    if (!(await this.repo.exists(groupId))) {
      throw new HttpError(404, 'Grupo não encontrado (código inválido).');
    }
  }

  /** Cria um grupo e devolve { groupId, name }. */
  async createGroup(name) {
    const clean = String(name ?? '').trim();
    if (!clean) throw new HttpError(400, 'Nome do grupo é obrigatório.');

    const groupId = newGroupCode();
    await this.repo.createGroup(groupId, clean);
    return { groupId, name: clean };
  }

  /** Lê os metadados do grupo. Lança 404 se não existir. */
  async getGroup(groupId) {
    const raw = await this.repo.findById(groupId);
    if (!raw) throw new HttpError(404, 'Grupo não encontrado (código inválido).');
    return { id: groupId, name: raw.name ?? 'Grupo' };
  }

  /**
   * Cria (entryId ausente) ou edita (entryId presente) um palpite no grupo.
   * Nome único por grupo (1 palpite por pessoa). Devolve { entry }.
   */
  async saveEntry(groupId, name, palpites, entryId = null) {
    const cleanName = String(name ?? '').trim();
    if (!groupId || !cleanName) throw new HttpError(400, 'groupId e name são obrigatórios.');

    await this.#requireGroup(groupId);

    // Nome deve ser único no grupo; ao editar, ignora o próprio doc na checagem.
    const dup = await this.repo.findEntriesByName(groupId, cleanName);
    const collides = dup.some((d) => d.id !== entryId);
    if (collides) throw new HttpError(409, `Já existe um palpite com o nome "${cleanName}".`);

    const id = entryId ?? randomUUID();
    const entry = { name: cleanName, palpites: sanitizePalpites(palpites), updatedAtMs: Date.now() };
    await this.repo.saveEntry(groupId, id, entry);
    return { entry: { id, ...entry } };
  }

  /** Remove um palpite do grupo. Devolve { ok: true }. */
  async removeEntry(groupId, entryId) {
    if (!groupId || !entryId) throw new HttpError(400, 'groupId e entryId são obrigatórios.');

    await this.#requireGroup(groupId);
    await this.repo.deleteEntry(groupId, entryId);
    return { ok: true };
  }
}
