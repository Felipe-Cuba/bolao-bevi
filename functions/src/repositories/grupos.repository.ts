import type {
  CollectionReference,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import { BaseRepository } from './base.repository.js';
import { GRUPOS_COLLECTION } from '#config';
import type { BolaoEntry, Grupo } from '#models';

const ENTRIES_SUBCOLLECTION = 'entries';

/**
 * Repositório dos grupos e suas entradas (palpites). Estende a base com as operações
 * específicas da subcoleção `entries` de cada grupo.
 */
export class GruposRepository extends BaseRepository {
  public collectionName = GRUPOS_COLLECTION;

  /** Referência da subcoleção de entries de um grupo. */
  public entriesRef(groupId: string): CollectionReference {
    return this.docRef(groupId).collection(ENTRIES_SUBCOLLECTION);
  }

  /** Cria um grupo com nome e timestamp de criação. */
  public async createGroup(groupId: string, name: string): Promise<Grupo> {
    return this.set(groupId, { name, createdAtMs: Date.now() });
  }

  /** Busca uma entry pelo nome dentro do grupo (para checar unicidade). */
  public async findEntriesByName(groupId: string, name: string): Promise<QueryDocumentSnapshot[]> {
    const snap = await this.entriesRef(groupId).where('name', '==', name).get();
    return snap.docs;
  }

  /** Grava (sobrescreve) uma entry no grupo. */
  public async saveEntry(
    groupId: string,
    entryId: string,
    entry: Omit<BolaoEntry, 'id'>,
  ): Promise<Omit<BolaoEntry, 'id'>> {
    await this.entriesRef(groupId).doc(entryId).set(entry, { merge: false });
    return entry;
  }

  /** Remove uma entry do grupo. */
  public async deleteEntry(groupId: string, entryId: string): Promise<void> {
    await this.entriesRef(groupId).doc(entryId).delete();
  }
}
