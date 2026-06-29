// Inicialização do Firebase Admin SDK (única no processo) e export do Firestore.
// O Admin SDK ignora as Security Rules, então toda escrita validada aqui é permitida.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

export const db = getFirestore();
