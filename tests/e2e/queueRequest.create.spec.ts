import { test, expect } from '@playwright/test';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, getFirestore, serverTimestamp } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const app = initializeApp({ apiKey: 'demo', authDomain: 'demo', projectId: 'prispevkyrodicu', appId: 'demo' }, 'e2e-create');
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

test('requester can create queueRequest in emulator', async () => {
  const mint = httpsCallable<{ email: string }, { token: string }>(functions, 'mintTestToken');
  const { data } = await mint({ email: 'requester@gvid.cz' });
  await signInWithCustomToken(auth, data.token);
  const docRef = await addDoc(collection(db, 'queueRequests'), {
    monthKey: '2026-01',
    description: 'E2E queue',
    amountCzk: 500,
    status: 'QUEUED',
    createdAt: serverTimestamp(),
    createdByEmail: 'requester@gvid.cz'
  });
  expect(docRef.id.length).toBeGreaterThan(5);
});
