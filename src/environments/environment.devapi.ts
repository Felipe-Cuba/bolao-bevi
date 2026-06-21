// Environment para rodar LOCALMENTE com a API via emulador de Functions.
// Usado pela configuração "devapi" do Angular (ng serve --configuration devapi).
//
// - API (/api/**): o proxy.conf.json encaminha para o emulador da function `api`.
//   A function emulada chama a API football-data.org server-side e escreve no
//   Firestore REAL (o emulador de Firestore NÃO sobe — ver firebase.json).
// - Firestore (leitura no front): @angular/fire lê o banco de PRODUÇÃO direto, sem
//   conectar a emulador (useEmulators ausente). Assim os grupos reais aparecem.
//
// Resultado: leitura E escrita batem no banco REAL. Suba o emulador de Functions
// (`bun --cwd functions run serve` ou `bun run emulator`) e rode `bun run start:api`.
// ATENÇÃO: criar/salvar/remover palpite afeta os dados de PRODUÇÃO.

import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  apiUrl: '/api/matches',
  gruposApiUrl: '/api/grupos',
  scorersApiUrl: '/api/scorers',
  localSeedUrl: 'wc-response-complete.json',
  useLocalData: false,
  firebaseConfig,
};
