// Config pública do cliente Firebase (identificadores, não são segredo — podem ir ao bundle).
// O token da API football-data.org NÃO está aqui; ele fica só na Cloud Function (.env).
// use cp src/environments/firebase.config.example.ts src/environments/firebase.config.ts para criar o arquivo de configuração real, preenchendo os valores com os dados do seu projeto Firebase.
export const firebaseConfig = {
  apiKey: '<project-api-key>',
  authDomain: '<project-id>.firebaseapp.com',
  projectId: '<project-id>',
  storageBucket: '<project-id>.firebasestorage.app',
  messagingSenderId: '<project-messaging-sender-id>',
  appId: '<project-app-id>',
};
