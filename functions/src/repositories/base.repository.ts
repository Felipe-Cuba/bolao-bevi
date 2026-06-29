import { db } from '../firebase.js';

/**
 * Repositório base (abstrato) sobre uma coleção do Firestore.
 *
 * Encapsula o acesso ao Firestore para que os services não dependam diretamente do
 * Admin SDK. Subclasses informam o nome da coleção via `collectionName` e ganham as
 * operações genéricas abaixo. Não deve ser instanciado diretamente.
 *
 * Instâncias são obtidas via `inject(Repo)` (core/injector), que gerencia o
 * singleton. A base apenas impede a instanciação direta da classe abstrata.
 */
export class BaseRepository {
  /** Nome da coleção raiz. Subclasses DEVEM sobrescrever. */
  public collectionName = '';

  constructor() {
    if (new.target === BaseRepository) {
      throw new Error('BaseRepository é abstrata e não pode ser instanciada diretamente.');
    }
  }

  /** Referência da coleção raiz deste repositório. */
  public collection() {
    if (!this.collectionName) {
      throw new Error(`${this.constructor.name} não definiu collectionName.`);
    }
    return db.collection(this.collectionName);
  }

  /** Referência de um documento por id. */
  public docRef(id: string) {
    return this.collection().doc(id);
  }

  /** Snapshot de um documento. */
  public async getSnap(id: string) {
    return this.docRef(id).get();
  }

  /** Dados de um documento (ou null se não existir). */
  public async findById<T = unknown>(id: string): Promise<T | null> {
    const snap = await this.getSnap(id);
    return snap.exists ? (snap.data() as T) : null;
  }

  /** Indica se o documento existe. */
  public async exists(id: string): Promise<boolean> {
    return (await this.getSnap(id)).exists;
  }

  /** Grava (sobrescreve por padrão) um documento. */
  public async set<T>(id: string, data: T, options: FirebaseFirestore.SetOptions = {}): Promise<T> {
    await this.docRef(id).set(data as FirebaseFirestore.DocumentData, options);
    return data;
  }

  /** Remove um documento. */
  public async delete(id: string) {
    await this.docRef(id).delete();
  }
}
