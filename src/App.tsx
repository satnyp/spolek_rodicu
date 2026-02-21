import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useSession } from './hooks/useSession';
import { db, storage } from './lib/firebase';
import { generateRequestPdf } from './lib/pdf';
import { compressImage } from './lib/imageCompression';
import type { AllowlistEntry, MonthSummary, RequestItem, RequestState } from './types/domain';

const stateTone: Record<RequestState, string> = {
  NEW: 'bg-white',
  PAID: 'bg-blue-50',
  HAS_INVOICES: 'bg-violet-50',
  HANDED_TO_ACCOUNTANT: 'bg-green-50'
};

function DesignFrame({ image, dark = false }: { image: string; dark?: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);

  return (
    <div className="h-screen w-full bg-background-light dark:bg-background-dark">
      <img src={`/desing_html/${image}`} alt={image} className="h-full w-full object-cover" />
    </div>
  );
}

export function App() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  if (location.pathname === '/__design/login') return <DesignFrame image="prihlasovaci_obrazovka.png" />;
  if (location.pathname === '/__design/settings') return <DesignFrame image="nastaveni.png" />;
  if (location.pathname === '/__design/main') return <DesignFrame image={searchParams.get('theme') === 'dark' ? 'dark_mode.png' : 'design_main.png'} dark={searchParams.get('theme') === 'dark'} />;
  return <LiveApp />;
}

function LiveApp() {
  const session = useSession();
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<Record<string, string>>({});
  const [allowlistEmail, setAllowlistEmail] = useState('');
  const [allowlistRole, setAllowlistRole] = useState<AllowlistEntry['role']>('viewer');

  useEffect(() => {
    if (!session.user) return;
    const q = query(collection(db, 'months'), orderBy('monthKey', 'desc'), limit(24));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => d.data() as MonthSummary);
      setMonths(items);
      if (!selectedMonth && items[0]?.monthKey) setSelectedMonth(items[0].monthKey);
    });
  }, [session.user, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    const q = query(collection(db, 'requests'), where('monthKey', '==', selectedMonth), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestItem, 'id'>) }))));
  }, [selectedMonth]);

  const canEdit = session.role === 'admin' || session.role === 'accountant';
  const active = useMemo(() => requests.find((r) => r.id === editorId), [requests, editorId]);

  if (session.loading) return <div className="grid min-h-screen place-items-center">Načítám…</div>;
  if (!session.user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background-light">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <h1 className="mb-2 text-2xl font-black">Spolek rodičů</h1>
          <button className="rounded bg-primary px-4 py-2 text-white" onClick={session.loginGoogle}>Přihlásit Google</button>
        </div>
      </div>
    );
  }
  if (session.accessDenied) return <div className="grid min-h-screen place-items-center">Nemáš přístup.</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-background-light font-display">
      <aside className="w-72 overflow-y-auto border-r border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Měsíce</h2>
        <div className="space-y-1">
          {months.map((month) => (
            <button key={month.monthKey} onClick={() => setSelectedMonth(month.monthKey)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selectedMonth === month.monthKey ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50'}`}>
              <span>{month.label}</span><span>{month.counts?.total ?? 0}</span>
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-black">{selectedMonth || 'Historie požadavků'}</h1>
          <button className="rounded border border-slate-200 px-3 py-2 text-sm" onClick={session.logout}>Odhlásit</button>
        </header>
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white">
          {requests.map((item) => (
            <div key={item.id} className={`flex items-center justify-between border-b border-slate-100 p-4 last:border-b-0 ${stateTone[item.state]}`}>
              <div>
                <p className="text-sm font-bold">{item.description}</p>
                <p className="text-xs text-slate-500">{item.vs}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black">{item.amountCzk} Kč</span>
                {canEdit && <button className="rounded bg-slate-100 px-3 py-1 text-xs" onClick={() => { setEditorId(item.id); setEditorData(item.editorData ?? {}); }}>Edit</button>}
              </div>
            </div>
          ))}
        </section>
      </main>
      <aside className="w-80 overflow-y-auto border-l border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-bold">Editor</h3>
        {active ? (
          <div className="space-y-2">
            <input className="w-full rounded border border-slate-300 px-3 py-2" value={editorData.name ?? ''} onChange={(e) => setEditorData((p) => ({ ...p, name: e.target.value }))} />
            <input className="w-full rounded border border-slate-300 px-3 py-2" value={editorData.note ?? ''} onChange={(e) => setEditorData((p) => ({ ...p, note: e.target.value }))} />
            <button className="rounded bg-primary px-3 py-2 text-white" onClick={async () => {
              if (!active) return;
              await updateDoc(doc(db, 'requests', active.id), { editorData, updatedAt: serverTimestamp() });
              await addDoc(collection(db, 'audit'), { ts: serverTimestamp(), action: 'UPDATE_EDITOR', targetId: active.id, diff: { editorData } });
            }}>Uložit</button>
            <button className="rounded border border-slate-300 px-3 py-2" onClick={() => generateRequestPdf(editorData, `SR_${active.vs}.pdf`)}>Stáhnout PDF</button>
            <label className="block rounded border border-slate-300 px-3 py-2 text-center text-sm">Upload<input type="file" className="hidden" accept="image/*,.pdf" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file || !active) return;
              const final = file.type.startsWith('image/') ? (await compressImage(file)).file : file;
              const path = `attachments/${active.id}/${crypto.randomUUID()}_${final.name}`;
              await uploadBytes(ref(storage, path), final);
              const downloadURL = await getDownloadURL(ref(storage, path));
              await updateDoc(doc(db, 'requests', active.id), { attachments: [{ storagePath: path, filename: final.name, downloadURL }] });
            }} /></label>
          </div>
        ) : <p className="text-sm text-slate-500">Vyberte požadavek.</p>}
        {session.role === 'admin' && (
          <div className="mt-6 space-y-2 rounded border border-slate-200 p-3">
            <h4 className="font-semibold">Allowlist</h4>
            <input className="w-full rounded border border-slate-300 px-3 py-2" value={allowlistEmail} onChange={(e) => setAllowlistEmail(e.target.value)} placeholder="email" />
            <select className="w-full rounded border border-slate-300 px-3 py-2" value={allowlistRole} onChange={(e) => setAllowlistRole(e.target.value as AllowlistEntry['role'])}><option>viewer</option><option>requester</option><option>accountant</option><option>admin</option></select>
            <button className="rounded bg-primary px-3 py-2 text-white" onClick={async () => {
              const emailLower = allowlistEmail.toLowerCase().trim();
              await setDoc(doc(db, 'allowlist', emailLower), { emailLower, role: allowlistRole, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            }}>Přidat</button>
          </div>
        )}
      </aside>
    </div>
  );
}
