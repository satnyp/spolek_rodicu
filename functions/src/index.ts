import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { randomBytes, createHash } from 'node:crypto';

admin.initializeApp();
const db = admin.firestore();

const hardAdmin = 'satny@gvid.cz';

function base64url(input: Buffer) {
  return input.toString('base64url');
}

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

export const seznamStart = onRequest(async (req, res) => {
  const state = base64url(randomBytes(24));
  const codeVerifier = base64url(randomBytes(64));
  const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
  res.cookie('sr_state', state, { httpOnly: true, secure: true, sameSite: 'lax' });
  res.cookie('sr_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'lax' });
  const redirectUri = mustEnv('SEZNAM_REDIRECT_URI');
  const clientId = mustEnv('SEZNAM_CLIENT_ID');
  const url = new URL('https://login.szn.cz/api/v1/oauth/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  res.redirect(url.toString());
});

export const seznamCallback = onRequest(async (req, res) => {
  const state = req.query.state?.toString();
  if (!state || state !== req.cookies?.sr_state) {
    res.status(400).send('Invalid state');
    return;
  }
  const tokenResp = await fetch('https://login.szn.cz/api/v1/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: req.query.code?.toString() ?? '',
      redirect_uri: mustEnv('SEZNAM_REDIRECT_URI'),
      client_id: mustEnv('SEZNAM_CLIENT_ID'),
      client_secret: mustEnv('SEZNAM_CLIENT_SECRET'),
      code_verifier: req.cookies?.sr_verifier ?? '',
    }),
  }).then((r) => r.json() as Promise<{ access_token: string }>);

  const profile = await fetch('https://login.szn.cz/api/v1/user', {
    headers: { Authorization: `Bearer ${tokenResp.access_token}` },
  }).then((r) => r.json() as Promise<{ email?: string }>);

  const email = (profile.email ?? '').toLowerCase();
  const allow = await db.collection('allowlist').doc(email).get();
  const allowed = email === hardAdmin || (allow.exists && allow.get('active') === true);
  if (!allowed) {
    res.status(403).send('Not allowlisted');
    return;
  }

  const uid = `seznam:${email}`;
  const role = email === hardAdmin ? 'admin' : allow.get('role');
  const customToken = await admin.auth().createCustomToken(uid, { email, role, provider: 'seznam' });
  await db.collection('audit').add({ ts: admin.firestore.FieldValue.serverTimestamp(), actorEmail: email, action: 'LOGIN_SEZNAM', targetType: 'auth' });
  res.set('content-type', 'text/html');
  res.send(`<script>window.opener.postMessage({token:${JSON.stringify(customToken)}}, ${JSON.stringify(req.headers.origin ?? '*')});window.close();</script>`);
});

export const sendMail = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.replace('Bearer ', '');
  if (!idToken) return void res.status(401).send('Missing token');
  const decoded = await admin.auth().verifyIdToken(idToken);
  const email = decoded.email?.toLowerCase() ?? '';
  const allowSnap = await db.collection('allowlist').doc(email).get();
  const role = email === hardAdmin ? 'admin' : allowSnap.get('role');
  if (!['admin', 'accountant'].includes(role)) return void res.status(403).send('Insufficient role');

  const recipients = (req.body?.recipients ?? []) as string[];
  for (const recipient of recipients) {
    const snap = await db.collection('allowlist').doc(recipient.toLowerCase()).get();
    if (!(snap.exists && snap.get('active') === true)) {
      return void res.status(400).send(`Recipient not active: ${recipient}`);
    }
  }

  const appsResp = await fetch(mustEnv('APPS_SCRIPT_URL'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-SR-SECRET': mustEnv('APPS_SCRIPT_SECRET') },
    body: JSON.stringify(req.body),
  });

  await db.collection('audit').add({
    ts: admin.firestore.FieldValue.serverTimestamp(),
    actorUid: decoded.uid,
    actorEmail: email,
    action: 'SEND_MAIL',
    targetType: 'mail',
    diff: { recipientsCount: recipients.length },
  });

  res.status(appsResp.status).send(await appsResp.text());
});

export const approveQueue = onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.replace('Bearer ', '');
  if (!idToken) return void res.status(401).send('Missing token');
  const decoded = await admin.auth().verifyIdToken(idToken);
  const actorEmail = decoded.email?.toLowerCase() ?? '';
  const actorAllow = await db.collection('allowlist').doc(actorEmail).get();
  const role = actorEmail === hardAdmin ? 'admin' : actorAllow.get('role');
  if (!['admin', 'accountant'].includes(role)) return void res.status(403).send('Insufficient role');

  const queueId = req.body?.queueId as string;
  const queueRef = db.collection('queueRequests').doc(queueId);
  await db.runTransaction(async (tx) => {
    const queueSnap = await tx.get(queueRef);
    if (!queueSnap.exists) throw new Error('Queue not found');
    const q = queueSnap.data()!;
    const now = new Date();
    const year = now.getFullYear();
    const counterRef = db.collection('counters').doc(String(year));
    const counterSnap = await tx.get(counterRef);
    const nextSeq = counterSnap.exists ? (counterSnap.get('nextSeq') as number) : 1;
    tx.set(counterRef, { year, nextSeq: nextSeq + 1 }, { merge: true });
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const vs = `${dd}${mm}${year}${nextSeq}`;
    const requestRef = db.collection('requests').doc();
    tx.set(requestRef, {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: q.createdByUid,
      createdByEmail: q.createdByEmail,
      monthKey: q.monthKey,
      vs,
      seqYear: year,
      seqNum: nextSeq,
      description: q.description,
      amountCzk: q.amountCzk,
      state: 'NEW',
      updatedByEmail: actorEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(queueRef, {
      status: 'APPROVED',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedByEmail: actorEmail,
    }, { merge: true });
    const monthRef = db.collection('months').doc(q.monthKey);
    tx.set(monthRef, {
      monthKey: q.monthKey,
      label: q.monthKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      counts: { total: admin.firestore.FieldValue.increment(1), NEW: admin.firestore.FieldValue.increment(1) },
    }, { merge: true });
    tx.set(db.collection('audit').doc(), {
      ts: admin.firestore.FieldValue.serverTimestamp(),
      actorUid: decoded.uid,
      actorEmail,
      action: 'APPROVE_QUEUE',
      targetType: 'queue',
      targetId: queueId,
    });
  });
  res.send('OK');
});
