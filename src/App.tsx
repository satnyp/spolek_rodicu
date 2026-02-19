import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useSession } from './hooks/useSession';
import { db, functions, storage } from './lib/firebase';
import { compressImage } from './lib/imageCompression';
import { generateRequestPdf } from './lib/pdf';
import type { AllowlistEntry, MonthSummary, RequestItem, RequestState } from './types/domain';

const stateColors: Record<RequestState, string> = {
  NEW: '#fff',
  PAID: '#e6f4ff',
  HAS_INVOICES: '#f2eaff',
  HANDED_TO_ACCOUNTANT: '#e9f9ea'
};

export function App() {
  const session = useSession();
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<Record<string, string>>({});
  const [lockedUntil, setLockedUntil] = useState<number>(0);
  const [allowlistEmail, setAllowlistEmail] = useState('');
  const [allowlistRole, setAllowlistRole] = useState<AllowlistEntry['role']>('viewer');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mailRecipients, setMailRecipients] = useState('');

  useEffect(() => {
    if (!session.user) return;
    const q = query(collection(db, 'months'), orderBy('monthKey', 'desc'), limit(24));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => d.data() as MonthSummary);
      setMonths(items);
      if (!selectedMonth && items[0]?.monthKey) {
        setSelectedMonth(items[0].monthKey);
      }
    });
  }, [session.user, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    const q = query(collection(db, 'requests'), where('monthKey', '==', selectedMonth), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestItem, 'id'>) })));
    });
  }, [selectedMonth]);

  const canEdit = session.role === 'accountant' || session.role === 'admin';
  const unlocked = lockedUntil > Date.now();
  const activeRequest = useMemo(() => requests.find((r) => r.id === editorId) ?? null, [requests, editorId]);

  async function saveEditor() {
    if (!activeRequest || !canEdit || !unlocked) return;
    await updateDoc(doc(db, 'requests', activeRequest.id), {
      editorData,
      updatedAt: serverTimestamp(),
      updatedByEmail: session.user?.email,
      updatedByUid: session.user?.uid
    });
    await addDoc(collection(db, 'audit'), {
      ts: serverTimestamp(),
      actorEmail: session.user?.email,
      actorUid: session.user?.uid,
      action: 'UPDATE_EDITOR',
      targetType: 'request',
      targetId: activeRequest.id,
      diff: { editorData }
    });
  }

  async function updateState(state: RequestState, id: string) {
    if (!canEdit || !unlocked) return;
    await updateDoc(doc(db, 'requests', id), {
      state,
      updatedAt: serverTimestamp(),
      updatedByEmail: session.user?.email,
      updatedByUid: session.user?.uid
    });
  }

  async function onAttachment(file: File) {
    if (!activeRequest || !canEdit) return;
    let finalFile = file;
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file);
      finalFile = compressed.file;
      alert(`Komprese: ${Math.round(compressed.originalBytes / 1024)} KB → ${Math.round(compressed.finalBytes / 1024)} KB`);
    }
    const path = `attachments/${activeRequest.id}/${crypto.randomUUID()}_${finalFile.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, finalFile);
    const downloadURL = await getDownloadURL(storageRef);
    await updateDoc(doc(db, 'requests', activeRequest.id), {
      attachments: [
        {
          storagePath: path,
          filename: finalFile.name,
          mime: finalFile.type,
          sizeBytes: finalFile.size,
          uploadedByUid: session.user?.uid,
          uploadedByEmail: session.user?.email,
          uploadedAt: new Date().toISOString(),
          kind: 'invoice',
          downloadURL
        }
      ]
    });
  }

  async function addAllowlist() {
    if (session.role !== 'admin') return;
    const emailLower = allowlistEmail.toLowerCase().trim();
    await setDoc(doc(db, 'allowlist', emailLower), {
      emailLower,
      role: allowlistRole,
      active: true,
      createdBy: session.user?.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    setAllowlistEmail('');
  }

  async function sendBulkMail() {
    const recipients = mailRecipients.split(',').map((value) => value.trim()).filter(Boolean);
    const callable = httpsCallable(functions, 'sendBulkMail');
    await callable({ recipients, requestIds: selectedIds, monthKey: selectedMonth });
  }

  async function seznamLogin() {
    const start = import.meta.env.VITE_SEZNAM_START_URL;
    const popup = window.open(start, 'seznam_login', 'width=500,height=700');
    if (!popup) return;
    window.addEventListener('message', async (event) => {
      if (event.origin !== window.location.origin) return;
      const token = event.data?.firebaseToken;
      if (token) {
        await session.loginSeznamWithToken(token);
      }
    }, { once: true });
  }

  if (session.loading) return <div className="center">Načítám…</div>;

  if (!session.user) {
    return (
      <div className="center">
        <h1>Spolek rodičů</h1>
        <button onClick={session.loginGoogle}>Přihlásit Google</button>
        <button onClick={seznamLogin}>Přihlásit Seznam</button>
      </div>
    );
  }

  if (session.accessDenied) {
    return <div className="center">Nemáš přístup — kontaktuj správce.</div>;
  }

  return (
    <div className="layout">
      <aside>
        <h3>Měsíce</h3>
        {months.map((month) => (
          <button key={month.monthKey} className={selectedMonth === month.monthKey ? 'selected' : ''} onClick={() => setSelectedMonth(month.monthKey)}>
            {month.label} ({month.counts?.total ?? 0})
          </button>
        ))}
      </aside>
      <main>
        <header>
          <h2>{selectedMonth || 'Bez měsíce'}</h2>
          <button onClick={session.logout}>Odhlásit</button>
          {canEdit && <button onClick={() => setLockedUntil(Date.now() + 10 * 60 * 1000)}>{unlocked ? 'Odemčeno' : 'Odemknout na 10 min'}</button>}
        </header>
        {requests.map((item) => (
          <article key={item.id} style={{ background: stateColors[item.state] }} className={editorId === item.id ? 'active' : ''}>
            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, item.id] : prev.filter((v) => v !== item.id))} />
            <strong>{item.vs}</strong> {item.description} — {item.amountCzk} Kč
            <div>
              <button onClick={() => { setEditorId(item.id); setEditorData(item.editorData ?? {}); }}>Edit</button>
              {canEdit && unlocked && (['NEW', 'PAID', 'HAS_INVOICES', 'HANDED_TO_ACCOUNTANT'] as RequestState[]).map((state) => <button key={state} onClick={() => updateState(state, item.id)}>{state}</button>)}
            </div>
          </article>
        ))}
        {canEdit && selectedIds.length > 0 && (
          <section>
            <h4>Bulk email</h4>
            <input value={mailRecipients} onChange={(e) => setMailRecipients(e.target.value)} placeholder="a@gvid.cz,b@gvid.cz" />
            <button onClick={sendBulkMail}>Odeslat</button>
          </section>
        )}
      </main>
      <section>
        <h3>Editor</h3>
        {activeRequest ? (
          <>
            <input value={editorData.name ?? ''} onChange={(e) => setEditorData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Jméno" />
            <input value={editorData.note ?? ''} onChange={(e) => setEditorData((prev) => ({ ...prev, note: e.target.value }))} placeholder="Poznámka" />
            <button onClick={saveEditor}>Uložit</button>
            <button onClick={() => generateRequestPdf(editorData, `SR_${activeRequest.vs}.pdf`)}>Stáhnout PDF</button>
            <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && onAttachment(e.target.files[0])} />
          </>
        ) : <p>Vyberte požadavek.</p>}

        {session.role === 'admin' && (
          <div>
            <h4>Allowlist</h4>
            <input value={allowlistEmail} onChange={(e) => setAllowlistEmail(e.target.value)} placeholder="email" />
            <select value={allowlistRole} onChange={(e) => setAllowlistRole(e.target.value as AllowlistEntry['role'])}>
              <option value="viewer">viewer</option>
              <option value="requester">requester</option>
              <option value="accountant">accountant</option>
              <option value="admin">admin</option>
            </select>
            <button onClick={addAllowlist}>Přidat</button>
          </div>
        )}
      </section>
    </div>
  );
}
