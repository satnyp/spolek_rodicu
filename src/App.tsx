import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { db } from './lib/firebase';
import { useSession } from './hooks/useSession';
import type { MonthSummary, RequestItem, RequestState, Role } from './types/domain';

const stateStyles: Record<RequestState, string> = {
  NEW: 'bg-white',
  PAID: 'bg-sky-50',
  HAS_INVOICES: 'bg-violet-50',
  HANDED_TO_ACCOUNTANT: 'bg-emerald-50'
};

function currentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function monthTitle(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

function LoginScreen() {
  const session = useSession();
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6 text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-100 bg-white p-10 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-10 text-center">
            <h1 className="text-2xl font-black">Příspěvky rodičů</h1>
            <p className="mt-2 text-sm text-slate-500">Přihlášení do aplikace Spolek rodičů</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => void session.loginGoogle()} className="w-full rounded-xl border border-slate-200 px-6 py-3.5 text-sm font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Přihlásit se přes Google</button>
            <button className="w-full rounded-xl bg-red-700 px-6 py-3.5 text-sm font-bold text-white">Přihlásit se přes Seznam.cz</button>
          </div>
          <p className="mt-8 border-t border-slate-100 pt-8 text-center text-xs text-slate-400 dark:border-slate-800">Tato aplikace slouží výhradně pro potřeby učitelů a vedení gymnázia.</p>
        </div>
      </div>
    </div>
  );
}

function MainLayout({ theme = 'light', role = 'admin', designMode = false }: { theme?: 'light' | 'dark'; role?: Role; designMode?: boolean }) {
  const session = useSession();
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [inlineDescription, setInlineDescription] = useState('');
  const [inlineAmount, setInlineAmount] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (designMode || !session.user) {
      return;
    }
    const q = query(collection(db, 'months'), orderBy('monthKey', 'desc'), limit(24));
    return onSnapshot(q, (snap) => {
      const found = snap.docs.map((item) => item.data() as MonthSummary);
      setMonths(found);
      if (!found.length) {
        setMonths([{ monthKey: currentMonthKey(), label: monthTitle(currentMonthKey()), counts: { total: 0 } }]);
      } else if (!selectedMonth) {
        setSelectedMonth(found[0].monthKey);
      }
    });
  }, [designMode, selectedMonth, session.user]);

  useEffect(() => {
    if (designMode) {
      const mock: RequestItem[] = [
        { id: '1', description: 'Cestovné na soutěž', amountCzk: 2450, monthKey: selectedMonth, state: 'NEW', vs: '120120251' },
        { id: '2', description: 'Učební pomůcky', amountCzk: 1820, monthKey: selectedMonth, state: 'PAID', vs: '120120252' }
      ];
      setRequests(mock);
      return;
    }
    const q = query(collection(db, 'requests'), where('monthKey', '==', selectedMonth), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestItem, 'id'>) }))));
  }, [designMode, selectedMonth]);

  const canEdit = role === 'admin' || role === 'accountant';
  const unlocked = lockedUntil > Date.now();

  async function createInlineRequest() {
    if (!inlineDescription.trim() || !inlineAmount.trim() || !session.user) return;
    await addDoc(collection(db, 'requests'), {
      description: inlineDescription.trim(),
      amountCzk: Number(inlineAmount),
      monthKey: selectedMonth,
      state: 'NEW',
      vs: `AUTO-${Date.now()}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: session.user.uid,
      createdByEmail: session.user.email
    });
    setInlineDescription('');
    setInlineAmount('');
  }

  async function changeState(id: string, next: RequestState) {
    if (!canEdit || !unlocked || designMode) return;
    await updateDoc(doc(db, 'requests', id), { state: next, updatedAt: serverTimestamp() });
  }

  return (
    <div className="min-h-screen bg-background-light p-4 text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <div className="mx-auto flex max-w-[1500px] gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <aside className="w-64 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Timeline</h3>
          <div className="space-y-2">
            {(months.length ? months : [{ monthKey: currentMonthKey(), label: monthTitle(currentMonthKey()), counts: { total: 0 } }]).map((month) => (
              <button key={month.monthKey} onClick={() => setSelectedMonth(month.monthKey)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedMonth === month.monthKey ? 'border-primary bg-primary/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <p className="font-semibold">{month.label || monthTitle(month.monthKey)}</p>
                <p className="text-xs text-slate-500">{month.counts?.total ?? 0} položek</p>
              </button>
            ))}
          </div>
        </aside>
        <main className="flex-1 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black capitalize">{monthTitle(selectedMonth)}</h2>
            <button disabled={!canEdit} onClick={() => setLockedUntil(unlocked ? 0 : Date.now() + 10 * 60 * 1000)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">{unlocked ? 'Lock' : 'Unlock 10 min'}</button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_120px] gap-2 rounded-xl border border-dashed border-slate-300 p-2 dark:border-slate-600">
              <input value={inlineDescription} onChange={(e) => setInlineDescription(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void createInlineRequest()} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Nový požadavek" />
              <input value={inlineAmount} onChange={(e) => setInlineAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void createInlineRequest()} className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Kč" />
            </div>
            {requests.map((request) => (
              <article key={request.id} className={`rounded-xl border border-slate-200 p-3 dark:border-slate-700 ${stateStyles[request.state]}`}>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setSelectedId(request.id)} className="text-left">
                    <p className="text-xs text-slate-500">VS {request.vs}</p>
                    <p className="font-semibold">{request.description}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{request.amountCzk} Kč</span>
                    <select disabled={!canEdit || !unlocked} value={request.state} onChange={(e) => void changeState(request.id, e.target.value as RequestState)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800">
                      <option value="NEW">NEW</option>
                      <option value="PAID">PAID</option>
                      <option value="HAS_INVOICES">HAS_INVOICES</option>
                      <option value="HANDED_TO_ACCOUNTANT">HANDED_TO_ACCOUNTANT</option>
                    </select>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
        {selectedId ? (
          <section className="w-[340px] rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Editor</h3>
            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm dark:border-slate-600">PDF panel requestu {selectedId}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SettingsScreen({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return <div className="min-h-screen bg-background-light p-8 dark:bg-background-dark"><div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h1 className="text-2xl font-black">Nastavení uživatelů</h1></div></div>;
}

function LoadingFallback() {
  return <div className="min-h-screen animate-pulse bg-background-light p-8 dark:bg-background-dark"><div className="mx-auto h-40 max-w-3xl rounded-2xl bg-slate-200 dark:bg-slate-800" /></div>;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { if (this.state.hasError) return <div className="min-h-screen bg-red-50 p-8 text-red-700">Aplikaci se nepodařilo načíst.</div>; return this.props.children; }
}



function DesignPreview({ file }: { file: string }) {
  return <img src={`/docs/design/${file}`} alt="design" className="h-[1280px] w-[1600px]" />;
}

function AppRoutes() {
  const session = useSession();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const theme = (qs.get('theme') === 'dark' ? 'dark' : 'light') as 'light' | 'dark';

  if (session.loading) return <LoadingFallback />;

  return (
    <Routes>
      <Route path="/__design/login" element={<DesignPreview file="prihlasovaci_obrazovka.png" />} />
      <Route path="/__design/main" element={<DesignPreview file={theme === 'dark' ? 'dark_mode.png' : 'design_main.png'} />} />
      <Route path="/__design/settings" element={<DesignPreview file="nastaveni.png" />} />
      <Route path="/settings" element={session.user ? <SettingsScreen /> : <Navigate to="/" replace />} />
      <Route path="/" element={session.user ? <MainLayout role={session.role ?? 'viewer'} /> : <LoginScreen />} />
    </Routes>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
}
