import { useEffect, useState } from 'react';
import { deleteAllowlist, listAllowlist, upsertAllowlist } from '../lib/data';
import type { AllowlistEntry, Role } from '../types/firestore';

const roles: Role[] = ['viewer', 'requester', 'accountant', 'admin'];

export function AllowlistPage({ actorEmail }: { actorEmail: string }) {
  const [items, setItems] = useState<AllowlistEntry[]>([]);
  const [form, setForm] = useState<AllowlistEntry>({ emailLower: '', role: 'viewer', active: true, label: '' });

  const refresh = () => listAllowlist().then(setItems);
  useEffect(() => { refresh(); }, []);

  return (
    <div>
      <h2>Allowlist</h2>
      <input placeholder="email" value={form.emailLower} onChange={(e) => setForm({ ...form, emailLower: e.target.value.toLowerCase() })} />
      <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{roles.map((r) => <option key={r}>{r}</option>)}</select>
      <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> active</label>
      <button onClick={async () => { await upsertAllowlist(form, actorEmail); setForm({ emailLower: '', role: 'viewer', active: true, label: '' }); refresh(); }}>Uložit</button>
      <ul>{items.map((item) => <li key={item.emailLower}>{item.emailLower} ({item.role}) <button onClick={async () => { await deleteAllowlist(item.emailLower); refresh(); }}>Smazat</button></li>)}</ul>
    </div>
  );
}
