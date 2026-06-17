import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideTanStackQuery(new QueryClient()),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => {
      const firestore = getFirestore();
      // Em dev com emulador (config devapi), conecta ao Firestore emulado.
      if ((environment as { useEmulators?: boolean }).useEmulators) {
        connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
        console.info('[firestore] conectado ao EMULADOR 127.0.0.1:8080');
      } else {
        console.info('[firestore] usando Firestore de PRODUÇÃO (sem emulador)');
      }
      return firestore;
    }),
  ],
};
