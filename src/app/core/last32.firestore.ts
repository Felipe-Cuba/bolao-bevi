// Leitura da coleção `wcLast32` (confrontos dos 16-avos): 1 doc por confronto, gravado
// pelo script functions/scripts/seed-last-32.js. Leitura sob demanda da coleção inteira
// (16 docs) via getDocs — as Rules negam escrita ao cliente.

import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

import { Last32Confronto } from '@shared/models/match.model';

@Injectable({ providedIn: 'root' })
export class Last32Firestore {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  private static readonly COLLECTION = 'wcLast32';

  /** Lê os 16 confrontos dos 16-avos, ordenados por `numero` (1..16). Vazio se não existir. */
  async readLast32(): Promise<Last32Confronto[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(collection(this.firestore, Last32Firestore.COLLECTION)),
    );
    return snap.docs
      .map((d) => d.data() as Last32Confronto)
      .sort((a, b) => a.numero - b.numero);
  }
}
