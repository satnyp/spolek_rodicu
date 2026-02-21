import crypto from 'node:crypto';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';

admin.initializeApp();
const db = getFirestore();

const SEZNAM_CLIENT_ID = defineSecret('SEZNAM_CLIENT_ID');
const SEZNAM_CLIENT_SECRET = defineSecret('SEZNAM_CLIENT_SECRET');
const SEZNAM_REDIRECT_URI = defineSecret('SEZNAM_REDIRECT_URI');
const APPS_SCRIPT_URL = defineSecret('APPS_SCRIPT_URL');
const APPS_SCRIPT_SECRET = defineSecret('APPS_SCRIPT_SECRET');

const ADMIN_EMAIL = 'satny@gvid.cz';

function assertEmulatorOnly() {
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
  if (!emulator) {
    throw new HttpsError('failed-precondition', 'This endpoint is available only in Firebase Emulator.');
  }
}

export const mintTestToken = onCall(async (request) => {
  assertEmulatorOnly();
  const email = String(request.data?.email ?? '').toLowerCase().trim();
  if (!email) {
    throw new HttpsError('invalid-argument', 'email is required');
  }

  const uid = `test:${email}`;
  const allow = await db.doc(`allowlist/${email}`).get();
  const allowData = allow.data() as { role?: string } | undefined;
  const role = email === ADMIN_EMAIL ? 'admin' : allowData?.role ?? 'viewer';

  await admin.auth().createUser({ uid, email }).catch(() => undefined);
  await admin.auth().setCustomUserClaims(uid, { role, email });
  const token = await admin.auth().createCustomToken(uid, { email, role, provider: 'test' });
  return { token };
});

export const seedEmulatorData = onRequest(async (_req: Request, res: Response) => {
  try {
    assertEmulatorOnly();
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error) });
    return;
  }

  const seed = [
    { emailLower: ADMIN_EMAIL, role: 'admin' },
    { emailLower: 'test@gvid.cz', role: 'admin' },
    { emailLower: 'accountant@gvid.cz', role: 'accountant' },
    { emailLower: 'requester@gvid.cz', role: 'requester' }
  ];

  for (const user of seed) {
    await db.doc(`allowlist/${user.emailLower}`).set({ ...user, active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  await db.doc('months/2026-01').set({ monthKey: '2026-01', label: 'leden 2026', counts: { total: 0 }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  res.json({ ok: true, seeded: seed.map((s) => s.emailLower) });
});

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export const authSeznamStart = onRequest({ secrets: [SEZNAM_CLIENT_ID, SEZNAM_REDIRECT_URI] }, async (req: Request, res: Response) => {
  const state = crypto.randomBytes(24).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = sha256(verifier);
  await db.collection('oauthState').doc(state).set({ verifier, createdAt: FieldValue.serverTimestamp() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SEZNAM_CLIENT_ID.value(),
    redirect_uri: SEZNAM_REDIRECT_URI.value(),
    scope: 'identity',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  res.redirect(`https://login.szn.cz/api/v1/oauth/auth?${params.toString()}`);
});

export const authSeznamCallback = onRequest({ secrets: [SEZNAM_CLIENT_ID, SEZNAM_CLIENT_SECRET, SEZNAM_REDIRECT_URI] }, async (req: Request, res: Response) => {
  const code = req.query.code?.toString();
  const state = req.query.state?.toString();
  if (!code || !state) {
    res.status(400).send('Missing code/state');
    return;
  }
  const stateRef = db.collection('oauthState').doc(state);
  const stateSnap = await stateRef.get();
  if (!stateSnap.exists) {
    res.status(400).send('Invalid state');
    return;
  }
  const verifier = stateSnap.data()?.verifier;
  await stateRef.delete();

  const tokenResp = await fetch('https://login.szn.cz/api/v1/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: SEZNAM_CLIENT_ID.value(),
      client_secret: SEZNAM_CLIENT_SECRET.value(),
      redirect_uri: SEZNAM_REDIRECT_URI.value(),
      code_verifier: verifier
    })
  });

  if (!tokenResp.ok) {
    res.status(401).send('Token exchange failed');
    return;
  }
  const tokenData = (await tokenResp.json()) as { access_token: string };
  const userResp = await fetch('https://login.szn.cz/api/v1/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const userData = (await userResp.json()) as { email?: string };
  const email = userData.email?.toLowerCase();
  if (!email) {
    res.status(403).send('Seznam account has no email');
    return;
  }

  const allow = await db.doc(`allowlist/${email}`).get();
  const allowData = allow.data() as { active?: boolean; role?: string } | undefined;
  if (email !== ADMIN_EMAIL && (!allow.exists || !allowData?.active)) {
    res.status(403).send('Not allowlisted');
    return;
  }

  const uid = `seznam:${email}`;
  const customClaims = { role: email === ADMIN_EMAIL ? 'admin' : allowData?.role ?? 'viewer' };
  await admin.auth().setCustomUserClaims(uid, customClaims);
  const firebaseToken = await admin.auth().createCustomToken(uid, { email, provider: 'seznam' });

  await db.collection('audit').add({
    ts: FieldValue.serverTimestamp(),
    action: 'LOGIN_SEZNAM',
    actorEmail: email,
    actorUid: uid,
    targetType: 'auth',
    targetId: uid
  });

  res.type('html').send(`<!DOCTYPE html><html><body><script>
    window.opener?.postMessage({ firebaseToken: '${firebaseToken}' }, window.location.origin);
    window.close();
  </script></body></html>`);
});

export const approveQueueRequest = onCall(async (request) => {
  if (!request.auth?.token.email) throw new HttpsError('unauthenticated', 'Login required');
  const actorEmail = request.auth.token.email.toLowerCase();
  const queueId = request.data.queueId as string;
  const queueRef = db.doc(`queueRequests/${queueId}`);

  return db.runTransaction(async (tx: Transaction) => {
    const queueSnap = await tx.get(queueRef);
    if (!queueSnap.exists) throw new HttpsError('not-found', 'Queue item missing');
    const queueData = queueSnap.data() as { monthKey: string; description: string; amountCzk: number };

    const today = new Date();
    const year = today.getFullYear();
    const counterRef = db.doc(`counters/${year}`);
    const counterSnap = await tx.get(counterRef);
    const nextSeq = counterSnap.exists ? ((counterSnap.data()?.nextSeq as number) ?? 1) : 1;
    tx.set(counterRef, { year, nextSeq: nextSeq + 1 }, { merge: true });

    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const vs = `${dd}${mm}${year}${nextSeq}`;
    const requestRef = db.collection('requests').doc();
    tx.set(requestRef, {
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: request.auth?.uid,
      createdByEmail: actorEmail,
      monthKey: queueData.monthKey,
      description: queueData.description,
      amountCzk: queueData.amountCzk,
      state: 'NEW',
      vs,
      seqYear: year,
      seqNum: nextSeq,
      attachments: []
    });

    tx.update(queueRef, {
      status: 'APPROVED',
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedByEmail: actorEmail,
      reviewedByUid: request.auth?.uid
    });

    tx.set(db.doc(`months/${queueData.monthKey}`), {
      monthKey: queueData.monthKey,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    tx.set(db.collection('audit').doc(), {
      ts: FieldValue.serverTimestamp(),
      actorUid: request.auth?.uid,
      actorEmail,
      action: 'APPROVE_QUEUE',
      targetType: 'queue',
      targetId: queueId,
      diff: { requestId: requestRef.id, vs }
    });

    return { requestId: requestRef.id, vs };
  });
});

export const sendBulkMail = onCall({ secrets: [APPS_SCRIPT_URL, APPS_SCRIPT_SECRET] }, async (request) => {
  if (!request.auth?.token.email) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token.role as string | undefined;
  if (!['admin', 'accountant'].includes(role ?? '')) {
    throw new HttpsError('permission-denied', 'Only admin/accountant');
  }

  const recipients = (request.data.recipients ?? []) as string[];
  if (!Array.isArray(recipients) || recipients.length < 1) {
    throw new HttpsError('invalid-argument', 'Recipients required');
  }

  const checks = await Promise.all(recipients.map(async (email) => {
    if (email.toLowerCase() === ADMIN_EMAIL) return true;
    const doc = await db.doc(`allowlist/${email.toLowerCase()}`).get();
    return doc.exists && doc.data()?.active === true;
  }));
  if (checks.includes(false)) throw new HttpsError('permission-denied', 'All recipients must be allowlisted and active');

  const payload = {
    recipients,
    monthKey: request.data.monthKey,
    requestIds: request.data.requestIds,
    actorEmail: request.auth.token.email
  };

  const response = await fetch(APPS_SCRIPT_URL.value(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-SR-SECRET': APPS_SCRIPT_SECRET.value()
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new HttpsError('internal', `Apps Script error: ${await response.text()}`);
  }

  await db.collection('audit').add({
    ts: FieldValue.serverTimestamp(),
    actorUid: request.auth.uid,
    actorEmail: request.auth.token.email,
    action: 'SEND_MAIL',
    targetType: 'mail',
    targetId: request.data.monthKey,
    diff: payload
  });

  return { ok: true };
});
