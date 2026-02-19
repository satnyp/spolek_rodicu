import { useEffect, useMemo, useState } from 'react';
import type { RequestRecord, Role } from '../types/firestore';
import { canEdit, createQueueRequest, listMonths, listRequestsForMonth, saveEditorData, updateRequestState, uploadAttachment } from '../lib/data';
import { compressImage } from '../utils/imageCompression';
import { generatePdf } from '../utils/pdf';

const stateLabels = ['NEW', 'PAID', 'HAS_INVOICES', 'HANDED_TO_ACCOUNTANT'] as const;

export function Dashboard({ role, email, uid }: { role: Role; email: string; uid: string }) {
  const [months, setMonths] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [active, setActive] = useState<RequestRecord | null>(null);
  const [editorData, setEditorData] = useState<Record<string, string>>({});
  const [unlockedUntil, setUnlockedUntil] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [compressionInfo, setCompressionInfo] = useState('');

  useEffect(() => {
    listMonths().then((items) => {
      setMonths(items);
      if (items[0]?.monthKey) setSelectedMonth(items[0].monthKey);
    });
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    listRequestsForMonth(selectedMonth).then(setRequests);
  }, [selectedMonth]);

  const lockRemaining = Math.max(0, unlockedUntil - Date.now());
  const unlocked = lockRemaining > 0;

  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);

  return (
    <div className="layout">
      <aside>
        <h3>Timeline</h3>
        {months.map((m) => (
          <button key={m.monthKey} className={m.monthKey === selectedMonth ? 'active' : ''} onClick={() => setSelectedMonth(m.monthKey)}>
            {m.label} ({m.counts?.total ?? 0})
          </button>
        ))}
      </aside>
      <main>
        <h2>{selectedMonth}</h2>
        {role !== 'viewer' && (
          <button onClick={() => createQueueRequest({ monthKey: selectedMonth, description: 'Nový požadavek', amountCzk: 0, createdByUid: uid, createdByEmail: email })}>
            Přidat do fronty
          </button>
        )}
        <div>
          <button disabled={selectedCount === 0 || !canEdit(role)}>Bulk email ({selectedCount})</button>
        </div>
        {requests.map((request) => (
          <article key={request.id} className={`card ${request.state}`}>
            <input type="checkbox" checked={Boolean(selectedIds[request.id])} onChange={(e) => setSelectedIds((p) => ({ ...p, [request.id]: e.target.checked }))} />
            <strong>{request.vs}</strong> {request.description} — {request.amountCzk} Kč
            <button onClick={() => setActive(request)}>Edit</button>
            {stateLabels.map((state) => (
              <button key={state} disabled={!canEdit(role) || !unlocked} onClick={() => updateRequestState(request.id, state, email)}>
                {state}
              </button>
            ))}
          </article>
        ))}
      </main>
      <section>
        <h3>Editor</h3>
        <button disabled={!canEdit(role)} onClick={() => setUnlockedUntil(Date.now() + 10 * 60 * 1000)}>
          {unlocked ? `Odemčeno (${Math.ceil(lockRemaining / 1000)} s)` : 'Odemknout na 10 minut'}
        </button>
        {active && (
          <>
            <p>Aktivní VS: {active.vs}</p>
            <input placeholder="Název pole PDF" onChange={(e) => setEditorData((prev) => ({ ...prev, [e.target.value]: prev[e.target.value] ?? '' }))} />
            <textarea placeholder="JSON editor data" value={JSON.stringify(editorData, null, 2)} onChange={(e) => setEditorData(JSON.parse(e.target.value || '{}'))} />
            <button disabled={!unlocked || !canEdit(role)} onClick={() => saveEditorData(active.id, editorData, email)}>Uložit</button>
            <button onClick={() => generatePdf(editorData, active.vs)}>Stáhnout PDF</button>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !canEdit(role)) return;
                const compressed = await compressImage(file);
                setCompressionInfo(`Původní ${Math.round(compressed.originalBytes / 1024)} KB -> ${Math.round(compressed.compressedBytes / 1024)} KB`);
                await uploadAttachment(active.id, compressed.file, email);
              }}
            />
            <small>{compressionInfo}</small>
          </>
        )}
      </section>
    </div>
  );
}
