import { BaseRepository } from './base.repository.js';
import { GRUPOS_COLLECTION } from '../config.js';

const ENTRIES_SUBCOLLECTION = 'entries';

/**
 * Repositório dos grupos e suas entradas (palpites). Estende a base com as operações
 * específicas da subcoleção `entries` de cada grupo.
 */
export class GruposRepository extends BaseRepository {
  collectionName = GRUPOS_COLLECTION;

  /** Referência da subcoleção de entries de um grupo. */
  entriesRef(groupId) {
    return this.docRef(groupId).collection(ENTRIES_SUBCOLLECTION);
  }

  /** Cria um grupo com nome e timestamp de criação. */
  async createGroup(groupId, name) {
    return this.set(groupId, { name, createdAtMs: Date.now() });
  }

  /** Busca uma entry pelo nome dentro do grupo (para checar unicidade). */
  async findEntriesByName(groupId, name) {
    const snap = await this.entriesRef(groupId).where('name', '==', name).get();
    return snap.docs;
  }

  /** Grava (sobrescreve) uma entry no grupo. */
  async saveEntry(groupId, entryId, entry) {
    await this.entriesRef(groupId).doc(entryId).set(entry, { merge: false });
    return entry;
  }

  /** Remove uma entry do grupo. */
  async deleteEntry(groupId, entryId) {
    await this.entriesRef(groupId).doc(entryId).delete();
  }
}
