// Environment de DESENVOLVIMENTO.
//
// Em dev, useLocalData: true → o app lê o JSON local (public/wc-response-complete.json)
// como fonte única, sem chamar a API (evita o bloqueio de CORS no browser).
//
// Em produção, o app consome a Cloud Function de proxy (apiUrl: '/api/wc'), que chama a
// API server-side com o token — ver environment.production.ts.

import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  // URL de onde buscar as partidas (proxy /api/wc em prod). Vazio = não chama API.
  apiUrl: '',
  // URL da Function de grupos. Vazio em local puro = modo grupo indisponível (use devapi).
  gruposApiUrl: '',
  // URL da Function de artilharia. Vazio em local puro = lê só o Firestore (se houver).
  scorersApiUrl: '',
  // Caminho do seed servido como asset estático (fonte/fallback local).
  localSeedUrl: 'wc-response-complete.json',
  // Em dev, lê SEMPRE o JSON local. Mude para false para testar via apiUrl.
  useLocalData: true,
  // DEV ONLY: simula confrontos de mata-mata + permite forçar resultados na tela do Bolão.
  // Ligado pela configuração "devsim" (npm run start:devsim). TODO: remover.
  devSimKo: false,
  firebaseConfig,
};
