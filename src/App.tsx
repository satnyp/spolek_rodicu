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
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Search,
  X
} from 'lucide-react';
import { useSession } from './hooks/useSession';
import { db, functions, storage } from './lib/firebase';
import { compressImage } from './lib/imageCompression';
import { generateRequestPdf } from './lib/pdf';
import type { AllowlistEntry, MonthSummary, RequestItem, RequestState } from './types/domain';

type QueueRequestItem = {
  id: string;
  description: string;
  amountCzk: number;
  status: 'QUEUED' | 'APPROVED' | 'REJECTED';
  monthKey: string;
};

type ToastItem = {
  id: string;
  text: string;
};

const stateColors: Record<RequestState, string> = {
  NEW: 'request-new',
  PAID: 'request-paid',
  HAS_INVOICES: 'request-has-invoices',
  HANDED_TO_ACCOUNTANT: 'request-handed'
};

const states: RequestState[] = ['NEW', 'PAID', 'HAS_INVOICES', 'HANDED_TO_ACCOUNTANT'];

const statusTabs: Array<{ key: 'ALL' | RequestState; label: string }> = [
  { key: 'ALL', label: 'Vše' },
  { key: 'NEW', label: 'Nové' },
  { key: 'PAID', label: 'Zaplaceno' },
  { key: 'HAS_INVOICES', label: 'S doklady' },
  { key: 'HANDED_TO_ACCOUNTANT', label: 'Předáno účetní' }
];

export function App() {
  const session = useSession();
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [queueRequests, setQueueRequests] = useState<QueueRequestItem[]>([]);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<Record<string, string>>({});
  const [lockedUntil, setLockedUntil] = useState<number>(0);
  const [allowlistEmail, setAllowlistEmail] = useState('');
  const [allowlistRole, setAllowlistRole] = useState<AllowlistEntry['role']>('viewer');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mailRecipients, setMailRecipients] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RequestState>('ALL');
  const [mobileTimelineOpen, setMobileTimelineOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickDescription, setQuickDescription] = useState('');
  const [quickAmount, setQuickAmount] = useState('');

  function pushToast(text: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  }

  useEffect(() => {
    if (!session.user) {
      return;
    }
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
    if (!selectedMonth) {
      return;
    }
    const q = query(collection(db, 'requests'), where('monthKey', '==', selectedMonth), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestItem, 'id'>) })));
    });
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) {
      return;
    }
    const q = query(
      collection(db, 'queueRequests'),
      where('monthKey', '==', selectedMonth),
      where('status', '==', 'QUEUED'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      setQueueRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QueueRequestItem, 'id'>) })));
    });
  }, [selectedMonth]);

  const canEdit = session.role === 'accountant' || session.role === 'admin';
  const canCreateQueue = canEdit || session.role === 'requester';
  const unlocked = lockedUntil > Date.now();
  const activeRequest = useMemo(() => requests.find((r) => r.id === editorId) ?? null, [requests, editorId]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesStatus = statusFilter === 'ALL' || request.state === statusFilter;
      const matchesSearch = request.description.toLowerCase().includes(descriptionFilter.toLowerCase().trim());
      return matchesStatus && matchesSearch;
    });
  }, [descriptionFilter, requests, statusFilter]);

  async function saveEditor() {
    if (!activeRequest || !canEdit || !unlocked) {
      return;
    }
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
    pushToast('Změny v editoru uloženy.');
  }

  async function updateState(state: RequestState, id: string) {
    if (!canEdit || !unlocked) {
      return;
    }
    await updateDoc(doc(db, 'requests', id), {
      state,
      updatedAt: serverTimestamp(),
      updatedByEmail: session.user?.email,
      updatedByUid: session.user?.uid
    });
    pushToast(`Stav změněn na ${state}.`);
  }

  async function onAttachment(file: File) {
    if (!activeRequest || !canEdit) {
      return;
    }
    let finalFile = file;
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file);
      finalFile = compressed.file;
      pushToast(`Komprese: ${Math.round(compressed.originalBytes / 1024)} KB → ${Math.round(compressed.finalBytes / 1024)} KB`);
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
    pushToast('Příloha nahrána.');
  }

  async function addAllowlist() {
    if (session.role !== 'admin') {
      return;
    }
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
    pushToast('Uživatel přidán do allowlistu.');
  }

  async function sendBulkMail() {
    const recipients = mailRecipients
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const callable = httpsCallable(functions, 'sendBulkMail');
    await callable({ recipients, requestIds: selectedIds, monthKey: selectedMonth });
    pushToast('Informační email odeslán.');
  }

  async function createQueueRequest() {
    if (!canCreateQueue || !selectedMonth || !quickDescription.trim() || !quickAmount.trim()) {
      return;
    }
    await addDoc(collection(db, 'queueRequests'), {
      monthKey: selectedMonth,
      description: quickDescription.trim(),
      amountCzk: Number(quickAmount),
      status: 'QUEUED',
      createdAt: serverTimestamp(),
      createdByUid: session.user?.uid,
      createdByEmail: session.user?.email,
      updatedAt: serverTimestamp()
    });
    pushToast('Přidáno do fronty.');
    setQuickAdding(false);
    setQuickDescription('');
    setQuickAmount('');
  }

  async function seznamLogin() {
    const start = import.meta.env.VITE_SEZNAM_START_URL;
    const popup = window.open(start, 'seznam_login', 'width=500,height=700');
    if (!popup) {
      return;
    }
    window.addEventListener(
      'message',
      async (event) => {
        if (event.origin !== window.location.origin) {
          return;
        }
        const token = event.data?.firebaseToken;
        if (token) {
          await session.loginSeznamWithToken(token);
        }
      },
      { once: true }
    );
  }

  if (session.loading) {
    return (
      <div className="center">
        <div className="skeleton w-72 h-8" />
        <div className="skeleton w-48 h-8" />
      </div>
    );
  }

  if (!session.user) {
    return (
      <div className="center">
        <div className="auth-card card">
          <h1>Spolek rodičů</h1>
          <p>Moderní správa požadavků spolku.</p>
          <button className="btn btn-primary" onClick={session.loginGoogle}>
            Přihlásit Google
          </button>
          <button className="btn btn-ghost" onClick={seznamLogin}>
            Přihlásit Seznam
          </button>
        </div>
      </div>
    );
  }

  if (session.accessDenied) {
    return <div className="center">Nemáš přístup — kontaktuj správce.</div>;
  }

  const selectedMonthLabel = months.find((month) => month.monthKey === selectedMonth)?.label ?? selectedMonth;

  return (
    <div className="app-shell">
      <div className={`mobile-overlay ${mobileTimelineOpen ? 'show' : ''}`} onClick={() => setMobileTimelineOpen(false)} aria-hidden="true" />
      <aside className={`timeline-panel ${mobileTimelineOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <h3>Měsíce</h3>
          <button className="icon-btn mobile-only" onClick={() => setMobileTimelineOpen(false)} aria-label="Zavřít timeline">
            <X size={16} />
          </button>
        </div>
        {months.length === 0 ? (
          <div className="stack-gap-sm">
            <div className="skeleton h-9" />
            <div className="skeleton h-9" />
            <div className="skeleton h-9" />
          </div>
        ) : (
          <div className="stack-gap-sm">
            {months.map((month) => (
              <button
                key={month.monthKey}
                className={`timeline-item ${selectedMonth === month.monthKey ? 'active' : ''}`}
                onClick={() => {
                  setSelectedMonth(month.monthKey);
                  setMobileTimelineOpen(false);
                }}
              >
                <span>
                  <strong>{month.label}</strong>
                  <small>{month.monthKey}</small>
                </span>
                <span className="timeline-meta">
                  {(month.counts?.total ?? 0).toString()}
                  <Circle size={8} />
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <main className="list-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-only" onClick={() => setMobileTimelineOpen(true)} aria-label="Otevřít timeline">
              <Menu size={18} />
            </button>
            <h2>{selectedMonthLabel || 'Bez měsíce'}</h2>
          </div>
          <div className="toolbar-actions">
            {canEdit && (
              <button className={`btn ${unlocked ? 'btn-success' : 'btn-secondary'}`} onClick={() => setLockedUntil(Date.now() + 10 * 60 * 1000)}>
                {unlocked ? <LockOpen size={16} /> : <Lock size={16} />}
                {unlocked ? 'Odemčeno' : 'Odemknout (10 min)'}
              </button>
            )}
            <button className="btn btn-ghost" onClick={session.logout}>
              <LogOut size={16} /> Odhlásit
            </button>
          </div>
        </header>

        <div className="filters card">
          <label className="search-input" aria-label="Vyhledávání">
            <Search size={16} />
            <input value={descriptionFilter} onChange={(event) => setDescriptionFilter(event.target.value)} placeholder="Vyhledat v popisu" />
          </label>
          <div className="tabs" role="tablist" aria-label="Filtr stavu">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={statusFilter === tab.key}
                className={`chip ${statusFilter === tab.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {queueRequests.length > 0 && (
          <section className="card queue-box">
            <h4>Ve frontě</h4>
            {queueRequests.map((item) => (
              <div key={item.id} className="queue-item">
                <span>{item.description}</span>
                <strong>{item.amountCzk} Kč</strong>
              </div>
            ))}
          </section>
        )}

        {requests.length === 0 && (
          <section className="empty-state card">
            <h3>{selectedMonthLabel || 'Aktuální měsíc'}</h3>
            <hr />
            {canCreateQueue ? (
              <div className="quick-row">
                {!quickAdding ? (
                  <button className="btn btn-ghost quick-add" onClick={() => setQuickAdding(true)}>
                    + Rychle přidat požadavek
                  </button>
                ) : (
                  <div className="quick-form">
                    <input
                      autoFocus
                      value={quickDescription}
                      placeholder="Popis"
                      onChange={(event) => setQuickDescription(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void createQueueRequest();
                        }
                      }}
                    />
                    <input
                      value={quickAmount}
                      type="number"
                      placeholder="Částka"
                      onChange={(event) => setQuickAmount(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void createQueueRequest();
                        }
                      }}
                    />
                    <button className="btn btn-primary" onClick={createQueueRequest}>
                      <Check size={16} /> Vytvořit
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p>V tomto měsíci nejsou žádné požadavky.</p>
            )}
          </section>
        )}

        <section className="stack-gap-md">
          {filteredRequests.map((item) => (
            <article key={item.id} className={`request-card card ${stateColors[item.state]} ${editorId === item.id ? 'active' : ''}`}>
              <div className="request-main">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) =>
                      setSelectedIds((prev) =>
                        event.target.checked ? [...prev, item.id] : prev.filter((value) => value !== item.id)
                      )
                    }
                    aria-label={`Vybrat ${item.description}`}
                  />
                </label>
                <div>
                  <strong>{item.vs}</strong>
                  <p>{item.description}</p>
                </div>
                <div className="request-meta">
                  <span className="badge">{item.state}</span>
                  <strong>{item.amountCzk} Kč</strong>
                </div>
              </div>
              <div className="request-actions">
                {canEdit && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditorId(item.id);
                      setEditorData(item.editorData ?? {});
                    }}
                  >
                    <Pencil size={16} /> Edit
                  </button>
                )}
                {canEdit && unlocked && (
                  <div className="dropdown-inline">
                    {states.map((state) => (
                      <button key={state} className="btn btn-ghost" onClick={() => updateState(state, item.id)}>
                        {state}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        {canEdit && selectedIds.length > 0 && (
          <section className="bulk-bar card" role="region" aria-label="Bulk mail panel">
            <Mail size={18} />
            <input value={mailRecipients} onChange={(event) => setMailRecipients(event.target.value)} placeholder="a@gvid.cz,b@gvid.cz" />
            <button className="btn btn-primary" onClick={sendBulkMail}>
              Poslat informační mail
            </button>
          </section>
        )}
      </main>

      <section className={`editor-sheet ${editorId ? 'open' : ''}`} aria-hidden={!editorId}>
        <div className="panel-header">
          <h3>Editor</h3>
          <div className="stack-inline">
            {editorId && (
              <button className="icon-btn" onClick={() => setEditorId(null)} aria-label="Zavřít editor">
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
        {activeRequest ? (
          <div className="stack-gap-md">
            <input
              className="input"
              value={editorData.name ?? ''}
              onChange={(event) => setEditorData((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Jméno"
              readOnly={!canEdit}
            />
            <input
              className="input"
              value={editorData.note ?? ''}
              onChange={(event) => setEditorData((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Poznámka"
              readOnly={!canEdit}
            />
            {canEdit ? (
              <>
                <button className="btn btn-primary" onClick={saveEditor}>
                  Uložit
                </button>
                <label className="btn btn-secondary file-upload">
                  Upload přílohy
                  <input type="file" accept="image/*,.pdf" onChange={(event) => event.target.files?.[0] && onAttachment(event.target.files[0])} />
                </label>
              </>
            ) : (
              <p className="muted">Pouze čtení.</p>
            )}
            <button className="btn btn-ghost" onClick={() => generateRequestPdf(editorData, `SR_${activeRequest.vs}.pdf`)}>
              Stáhnout PDF
            </button>
          </div>
        ) : (
          <div className="empty-editor">
            <ChevronLeft size={18} />
            <p>Vyberte požadavek pro detail.</p>
          </div>
        )}

        {session.role === 'admin' && (
          <div className="admin-box card">
            <h4>Allowlist</h4>
            <input className="input" value={allowlistEmail} onChange={(event) => setAllowlistEmail(event.target.value)} placeholder="email" />
            <select className="input" value={allowlistRole} onChange={(event) => setAllowlistRole(event.target.value as AllowlistEntry['role'])}>
              <option value="viewer">viewer</option>
              <option value="requester">requester</option>
              <option value="accountant">accountant</option>
              <option value="admin">admin</option>
            </select>
            <button className="btn btn-primary" onClick={addAllowlist}>
              Přidat
            </button>
          </div>
        )}
      </section>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}
