import { FieldValue } from 'firebase-admin/firestore';

import { BaseRepository } from './base.repository.js';
import { SCORERS_COLLECTION, SCORERS_DOC_ID } from '#config';
import type { CachedDoc } from '#models';

/**
 * Repositório do cache da artilharia (documento único wcScorers/current).
 */
export class ScorersRepository extends BaseRepository {
  public collectionName = SCORERS_COLLECTION;

  /** Lê o documento de cache (ou null se ainda não existe). */
  public async readCurrent(): Promise<CachedDoc | null> {
    return this.findById(SCORERS_DOC_ID);
  }

  /** Grava o payload de artilheiros com o timestamp de atualização. */
  public async writeCurrent(data: unknown, updatedAtMs: number) {
    return this.set(SCORERS_DOC_ID, {
      data,
      lastUpdated: FieldValue.serverTimestamp(),
      updatedAtMs,
    });
  }
}
