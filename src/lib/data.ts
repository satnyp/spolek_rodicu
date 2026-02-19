import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import type { AllowlistEntry, RequestRecord, Role } from '../types/firestore';

export async function listMonths(pageSize = 24) {
  const q = query(collection(db, 'months'), orderBy('monthKey', 'desc'), limit(pageSize));
  return (await getDocs(q)).docs.map((d) => d.data());
}

export async function listRequestsForMonth(monthKey: string): Promise<RequestRecord[]> {
  const q = query(collection(db, 'requests'), where('monthKey', '==', monthKey), orderBy('createdAt', 'desc'), limit(200));
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestRecord, 'id'>) }));
}

export async function listAllowlist(): Promise<AllowlistEntry[]> {
  return (await getDocs(collection(db, 'allowlist'))).docs.map((d) => d.data() as AllowlistEntry);
}

export async function upsertAllowlist(entry: AllowlistEntry, actor: string) {
  await setDoc(
    doc(db, 'allowlist', entry.emailLower),
    { ...entry, updatedAt: serverTimestamp(), createdAt: serverTimestamp(), createdBy: actor },
    { merge: true }
  );
}

export async function deleteAllowlist(emailLower: string) {
  if (emailLower === 'satny@gvid.cz') return;
  await deleteDoc(doc(db, 'allowlist', emailLower));
}

export async function createQueueRequest(payload: { monthKey: string; description: string; amountCzk: number; createdByUid: string; createdByEmail: string; }) {
  await addDoc(collection(db, 'queueRequests'), { ...payload, status: 'QUEUED', createdAt: serverTimestamp() });
}

export async function saveEditorData(requestId: string, editorData: Record<string, string>, actor: string) {
  await setDoc(doc(db, 'requests', requestId), { editorData, updatedAt: serverTimestamp(), updatedByEmail: actor }, { merge: true });
}

export async function updateRequestState(requestId: string, state: string, actor: string) {
  await setDoc(doc(db, 'requests', requestId), { state, updatedAt: serverTimestamp(), updatedByEmail: actor }, { merge: true });
}

export async function uploadAttachment(requestId: string, file: File, actorEmail: string) {
  const path = `attachments/${requestId}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return {
    storagePath: path,
    filename: file.name,
    mime: file.type,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedByEmail: actorEmail,
    kind: 'invoice',
  };
}

export function canEdit(role: Role | null) {
  return role === 'admin' || role === 'accountant';
}
