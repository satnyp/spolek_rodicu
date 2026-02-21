import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const fallback = {
  apiKey: 'AIzaSyDddZrdWTcM1qeiXDsAI6LkLbyaL1v-dw0',
  authDomain: 'prispevkyrodicu.firebaseapp.com',
  projectId: 'prispevkyrodicu',
  storageBucket: 'prispevkyrodicu.firebasestorage.app',
  messagingSenderId: '609240256764',
  appId: '1:609240256764:web:1639029e9e419a411b0779',
};

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || fallback.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fallback.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || fallback.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fallback.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallback.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || fallback.appId,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
