// Environment para testar LOCALMENTE com a API real via emulador da Cloud Function.
// Usado pela configuração "devapi" do Angular (ng serve --configuration devapi).
//
// O app chama /api/wc, que o proxy.conf.json encaminha para o emulador de Functions,
// que por sua vez chama a API football-data.org server-side (token em functions/.env.bolao-bevi).
// useEmulators liga o connect ao Firestore emulado (porta 8080).

import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  apiUrl: '/api/wc',
  gruposApiUrl: '/api/grupos',
  localSeedUrl: 'wc-response-complete.json',
  useLocalData: false,
  firebaseConfig,
  useEmulators: true,
};
