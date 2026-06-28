// Serviço de dados dos confrontos de 16-avos (`wcLast32`) para o front. Lê a coleção via
// Last32Firestore e expõe `queryOptions` do TanStack Query. Dados estáticos (gravados por
// script): staleTime infinito, lazy via `enabled` no componente.

import { Injectable, inject } from '@angular/core';
import { queryOptions } from '@tanstack/angular-query-experimental';

import { Last32Confronto } from '@shared/models/match.model';
import { Last32Firestore } from '@core/last32.firestore';

@Injectable({ providedIn: 'root' })
export class Last32Api {
  private readonly store = inject(Last32Firestore);

  /** Opções da query dos confrontos de 16-avos. Lazy: o componente habilita via `enabled`. */
  last32QueryOptions() {
    return queryOptions({
      queryKey: ['wc', 'last32'] as const,
      queryFn: (): Promise<Last32Confronto[]> => this.store.readLast32(),
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    });
  }
}
