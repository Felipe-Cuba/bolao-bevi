// Environment de DESENVOLVIMENTO com a SIMULAÇÃO do Bolão ligada (DEV ONLY).
//
// Igual ao environment de dev (lê o JSON local), mas com `devSimKo: true`: a tela do Bolão
// passa a mostrar os confrontos de mata-mata simulados e o botão "Resultados (dev)" para
// forçar placares só no front (sem tocar no banco). Usado pela configuração "devsim"
// (npm run start:devsim). TODO: remover quando a Copa definir os jogos reais.

import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  apiUrl: '/api/matches',
  gruposApiUrl: '/api/grupos',
  scorersApiUrl: '/api/scorers',
  localSeedUrl: 'wc-response-complete.json',
  useLocalData: false,
  devSimKo: true,
  firebaseConfig,
};
