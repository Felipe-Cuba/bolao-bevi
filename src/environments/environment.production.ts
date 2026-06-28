// Environment de PRODUÇÃO (usado no build via fileReplacements no angular.json).
//
// Em produção o app consome a Cloud Function de proxy via rewrite '/api/wc' (mesma origem,
// sem CORS). O token NÃO fica aqui — ele é um secret da Function, server-side.

import { firebaseConfig } from './firebase.config';

export const environment = {
  production: true,
  // Rota relativa servida pelo Hosting → function `api` (Express), endpoint de partidas.
  apiUrl: '/api/matches',
  // Rota base → function `api`, recurso de grupos (criar/salvar/remover palpites).
  gruposApiUrl: '/api/grupos',
  // Rota → function `api`, recurso de artilharia.
  scorersApiUrl: '/api/scorers',
  localSeedUrl: 'wc-response-complete.json',
  // Usa a API real (via proxy). Em qualquer falha, cai no cache do Firestore.
  useLocalData: false,
  // Recurso de DEV; sempre desligado em produção.
  devSimKo: false,
  firebaseConfig,
};
