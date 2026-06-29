import { randomUUID } from 'node:crypto';

import { inject } from '#core/injector';
import { GruposRepository } from '../repositories/grupos.repository.js';
import { GroupCode } from '#lib/group-code';
import { PalpiteValidator } from '#lib/palpites';
import { HttpError } from '#lib/http-error';
import type { BolaoEntry, Grupo, Palpite } from '#models';

/**
 * Serviço dos grupos de palpites compartilhados.
 *
 * Grupos sem autenticação: o id do grupo É o código de acesso (longo, aleatório).
 * Toda escrita passa por aqui (Rules negam escrita ao cliente); a existência do grupo
 * valida o código. Risco aceito: quem tem o código pode editar qualquer palpite do grupo.
 */
export class GruposService {
  /** Repositório injetado (singleton resolvido pelo injector). */
  private repo = inject(GruposRepository);

  /** Garante que o grupo existe; lança 404 caso contrário. */
  async #requireGroup(groupId: string): Promise<void> {
    if (!(await this.repo.exists(groupId))) {
      throw new HttpError(404, 'Grupo não encontrado (código inválido).');
    }
  }

  /** Cria um grupo e devolve { groupId, name }. */
  public async createGroup(name: string): Promise<{ groupId: string; name: string }> {
    const clean = String(name ?? '').trim();
    if (!clean) throw new HttpError(400, 'Nome do grupo é obrigatório.');

    const groupId = GroupCode.generate();
    await this.repo.createGroup(groupId, clean);
    return { groupId, name: clean };
  }

  /** Lê os metadados do grupo. Lança 404 se não existir. */
  public async getGroup(groupId: string): Promise<{ id: string; name: string }> {
    const raw = await this.repo.findById<Grupo>(groupId);
    if (!raw) throw new HttpError(404, 'Grupo não encontrado (código inválido).');
    return { id: groupId, name: raw.name ?? 'Grupo' };
  }

  /**
   * Cria (entryId ausente) ou edita (entryId presente) um palpite no grupo.
   * Nome único por grupo (1 palpite por pessoa). Devolve { entry }.
   */
  public async saveEntry(
    groupId: string,
    name: string,
    palpites: Palpite[],
    entryId: string | null = null,
  ): Promise<{ entry: BolaoEntry }> {
    const cleanName = String(name ?? '').trim();
    if (!groupId || !cleanName) throw new HttpError(400, 'groupId e name são obrigatórios.');

    await this.#requireGroup(groupId);

    // Nome deve ser único no grupo; ao editar, ignora o próprio doc na checagem.
    const dup = await this.repo.findEntriesByName(groupId, cleanName);
    const collides = dup.some((d) => d.id !== entryId);
    if (collides) throw new HttpError(409, `Já existe um palpite com o nome "${cleanName}".`);

    const id = entryId ?? randomUUID();
    const entry = {
      name: cleanName,
      palpites: PalpiteValidator.sanitize(palpites),
      updatedAtMs: Date.now(),
    };
    await this.repo.saveEntry(groupId, id, entry);
    return { entry: { id, ...entry } };
  }

  /** Remove um palpite do grupo. Devolve { ok: true }. */
  public async removeEntry(groupId: string, entryId: string): Promise<{ ok: true }> {
    if (!groupId || !entryId) throw new HttpError(400, 'groupId e entryId são obrigatórios.');

    await this.#requireGroup(groupId);
    await this.repo.deleteEntry(groupId, entryId);
    return { ok: true };
  }
}
