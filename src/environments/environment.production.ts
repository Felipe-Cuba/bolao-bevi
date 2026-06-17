// Environment de PRODUÇÃO (usado no build via fileReplacements no angular.json).
//
// Em produção o app consome a Cloud Function de proxy via rewrite '/api/wc' (mesma origem,
// sem CORS). O token NÃO fica aqui — ele é um secret da Function, server-side.

import { firebaseConfig } from './firebase.config';

export const environment = {
  production: true,
  // Rota relativa servida pelo Hosting → Cloud Function wcMatches (proxy da API).
  apiUrl: '/api/wc',
  // Rota relativa → Cloud Function `grupos` (criar/salvar/remover palpites do grupo).
  gruposApiUrl: '/api/grupos',
  localSeedUrl: 'wc-response-complete.json',
  // Usa a API real (via proxy). Em qualquer falha, cai no seed local automaticamente.
  useLocalData: false,
  firebaseConfig,
};
