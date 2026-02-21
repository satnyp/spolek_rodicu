import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import type { SessionState } from './hooks/useSession';
import { useSession } from './hooks/useSession';
import { DesignLoginPage } from './pages/DesignLoginPage';
import { DesignMainPage } from './pages/DesignMainPage';
import { DesignSettingsPage } from './pages/DesignSettingsPage';
import type { MonthSummary, RequestItem } from './types/domain';
import { db, storage } from './lib/firebase';
import { compressImage } from './lib/imageCompression';

type SessionLike = SessionState & {
  loginGoogle: () => Promise<void>;
  loginSeznamWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

type DesignPreset = 'login' | 'main' | 'settings';

const mockMonths: MonthSummary[] = [
  { monthKey: '2025-01', label: 'Leden 2025', counts: { total: 4 } },
  { monthKey: '2024-12', label: 'Prosinec 2024', counts: { total: 2 } }
];
const mockRequests: RequestItem[] = [
  { id: 'r1', monthKey: '2025-01', description: 'Výtvarné potřeby', amountCzk: 4500, state: 'NEW', vs: '250101' },
  { id: 'r2', monthKey: '2025-01', description: 'Sportovní vybavení', amountCzk: 12800, state: 'PAID', vs: '250102' }
];

function makeMockSession(preset: DesignPreset): SessionLike {
  if (preset === 'login') {
    return { user: null, loading: false, accessDenied: false, role: null, allowlistEntry: null, loginGoogle: async () => undefined, loginSeznamWithToken: async () => undefined, logout: async () => undefined };
  }
  return {
    user: { uid: 'design', email: 'satny@gvid.cz' } as SessionLike['user'],
    loading: false,
    accessDenied: false,
    role: 'admin',
    allowlistEntry: { emailLower: 'satny@gvid.cz', role: 'admin', active: true },
    loginGoogle: async () => undefined,
    loginSeznamWithToken: async () => undefined,
    logout: async () => undefined
  };
}

function AppInner({ session, designPreset, theme }: { session: SessionLike; designPreset?: DesignPreset; theme?: 'light' | 'dark' }) {
  const isDesign = Boolean(designPreset);
  const [months, setMonths] = useState<MonthSummary[]>(isDesign ? mockMonths : []);
  const [selectedMonth, setSelectedMonth] = useState(isDesign ? '2025-01' : '');
  const [requests, setRequests] = useState<RequestItem[]>(isDesign && designPreset !== 'settings' && designPreset !== 'login' ? mockRequests : []);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<Record<string, string>>({});
  const [lockedUntil, setLockedUntil] = useState(0);

  useEffect(() => {
    if (!isDesign) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    return () => document.documentElement.classList.remove('dark');
  }, [isDesign, theme]);

  useEffect(() => {
    if (isDesign || !session.user) return;
    const q = query(collection(db, 'months'), orderBy('monthKey', 'desc'), limit(24));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => d.data() as MonthSummary);
      setMonths(items);
      setSelectedMonth((prev) => prev || items[0]?.monthKey || new Date().toISOString().slice(0, 7));
    });
  }, [isDesign, session.user]);

  useEffect(() => {
    if (isDesign || !selectedMonth) return;
    const q = query(collection(db, 'requests'), where('monthKey', '==', selectedMonth), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestItem, 'id'>) })));
    });
  }, [isDesign, selectedMonth]);

  async function saveEditor() {
    if (!editorId || isDesign) return;
    await updateDoc(doc(db, 'requests', editorId), { editorData, updatedAt: serverTimestamp(), updatedByEmail: session.user?.email });
    await addDoc(collection(db, 'audit'), { ts: serverTimestamp(), actorEmail: session.user?.email, action: 'UPDATE_EDITOR', targetType: 'request', targetId: editorId, diff: { editorData } });
  }

  async function uploadAttachment(file: File) {
    if (!editorId || isDesign) return;
    const finalFile = file.type.startsWith('image/') ? (await compressImage(file)).file : file;
    const path = `attachments/${editorId}/${crypto.randomUUID()}_${finalFile.name}`;
    await uploadBytes(ref(storage, path), finalFile);
    await getDownloadURL(ref(storage, path));
  }

  if (session.loading) return <div className="min-h-screen grid place-items-center">Načítání...</div>;
  if (!session.user) return <DesignLoginPage onGoogle={() => void session.loginGoogle()} onSeznam={() => undefined} />;
  if (session.accessDenied) return <div className="min-h-screen grid place-items-center">Nemáš přístup — kontaktuj správce.</div>;
  if (designPreset === 'settings') return <DesignSettingsPage />;

  return (
    <div>
      <DesignMainPage
        months={months.length ? months : [{ monthKey: new Date().toISOString().slice(0, 7), label: 'Aktuální měsíc', counts: { total: 0 } }]}
        requests={requests}
        selectedMonth={selectedMonth || new Date().toISOString().slice(0, 7)}
        onSelectMonth={setSelectedMonth}
        onEdit={(id) => setEditorId(id)}
        onLogout={() => void session.logout()}
        onUnlock={() => setLockedUntil(Date.now() + 10 * 60 * 1000)}
        unlocked={lockedUntil > Date.now()}
      />
      {editorId && (
        <div className="fixed right-4 bottom-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 w-80">
          <input className="w-full rounded-lg border p-2 mb-2 bg-transparent" placeholder="Jméno" onChange={(e) => setEditorData((p) => ({ ...p, name: e.target.value }))} />
          <input className="w-full rounded-lg border p-2 mb-2 bg-transparent" placeholder="Poznámka" onChange={(e) => setEditorData((p) => ({ ...p, note: e.target.value }))} />
          <input type="file" className="mb-2" onChange={(e) => e.target.files?.[0] && void uploadAttachment(e.target.files[0])} />
          <button className="w-full rounded-lg bg-primary text-white p-2" onClick={() => void saveEditor()}>Uložit</button>
        </div>
      )}
    </div>
  );
}

export function App() {
  const session = useSession();
  return <AppInner session={session} />;
}

export function DesignApp({ preset, theme = 'light' }: { preset: DesignPreset; theme?: 'light' | 'dark' }) {
  return <AppInner session={makeMockSession(preset)} designPreset={preset} theme={theme} />;
}
