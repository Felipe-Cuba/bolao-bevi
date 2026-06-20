import { db } from '../firebase.js';

/**
 * Repositório base (abstrato) sobre uma coleção do Firestore.
 *
 * Encapsula o acesso ao Firestore para que os services não dependam diretamente do
 * Admin SDK. Subclasses informam o nome da coleção via `collectionName` e ganham as
 * operações genéricas abaixo. Não deve ser instanciado diretamente.
 *
 * Instâncias são obtidas via `inject(Repo)` (core/injector.js), que gerencia o
 * singleton. A base apenas impede a instanciação direta da classe abstrata.
 */
export class BaseRepository {
  /** Nome da coleção raiz. Subclasses DEVEM sobrescrever. */
  collectionName = '';

  constructor() {
    if (new.target === BaseRepository) {
      throw new Error('BaseRepository é abstrata e não pode ser instanciada diretamente.');
    }
  }

  /** Referência da coleção raiz deste repositório. */
  collection() {
    if (!this.collectionName) {
      throw new Error(`${this.constructor.name} não definiu collectionName.`);
    }
    return db.collection(this.collectionName);
  }

  /** Referência de um documento por id. */
  docRef(id) {
    return this.collection().doc(id);
  }

  /** Snapshot de um documento. */
  async getSnap(id) {
    return this.docRef(id).get();
  }

  /** Dados de um documento (ou null se não existir). */
  async findById(id) {
    const snap = await this.getSnap(id);
    return snap.exists ? snap.data() : null;
  }

  /** Indica se o documento existe. */
  async exists(id) {
    return (await this.getSnap(id)).exists;
  }

  /** Grava (sobrescreve por padrão) um documento. */
  async set(id, data, options = {}) {
    await this.docRef(id).set(data, options);
    return data;
  }

  /** Remove um documento. */
  async delete(id) {
    await this.docRef(id).delete();
  }
}
