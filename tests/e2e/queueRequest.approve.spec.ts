import { test, expect } from '@playwright/test';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, getDoc, getFirestore, serverTimestamp, doc } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const app = initializeApp({ apiKey: 'demo', authDomain: 'demo', projectId: 'prispevkyrodicu', appId: 'demo' }, 'e2e-approve');
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

test('accountant approves queueRequest and request + audit are created', async () => {
  const mint = httpsCallable<{ email: string }, { token: string }>(functions, 'mintTestToken');
  const requesterToken = (await mint({ email: 'requester@gvid.cz' })).data.token;
  await signInWithCustomToken(auth, requesterToken);
  const queueRef = await addDoc(collection(db, 'queueRequests'), {
    monthKey: '2026-01',
    description: 'Flow approve',
    amountCzk: 700,
    status: 'QUEUED',
    createdAt: serverTimestamp(),
    createdByEmail: 'requester@gvid.cz'
  });

  const accountantToken = (await mint({ email: 'accountant@gvid.cz' })).data.token;
  await signInWithCustomToken(auth, accountantToken);
  const approve = httpsCallable<{ queueId: string }, { requestId: string }>(functions, 'approveQueueRequest');
  const approval = await approve({ queueId: queueRef.id });

  const requestSnap = await getDoc(doc(db, 'requests', approval.data.requestId));
  expect(requestSnap.exists()).toBeTruthy();
  const queueSnap = await getDoc(doc(db, 'queueRequests', queueRef.id));
  expect(queueSnap.data()?.status).toBe('APPROVED');
});
