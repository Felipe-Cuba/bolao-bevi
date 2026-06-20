import { FieldValue } from 'firebase-admin/firestore';

import { BaseRepository } from './base.repository.js';
import { MATCHES_COLLECTION, MATCHES_DOC_ID } from '../config.js';

/**
 * Repositório do cache de partidas (documento único wcMatches/current).
 */
export class MatchesRepository extends BaseRepository {
  collectionName = MATCHES_COLLECTION;

  /** Lê o documento de cache (ou null se ainda não existe). */
  async readCurrent() {
    return this.findById(MATCHES_DOC_ID);
  }

  /** Grava o payload de partidas com o timestamp de atualização. */
  async writeCurrent(data, updatedAtMs) {
    return this.set(MATCHES_DOC_ID, {
      data,
      lastUpdated: FieldValue.serverTimestamp(),
      updatedAtMs,
    });
  }
}
