import type { MonthSummary, RequestItem } from '../types/domain';

type Props = {
  months: MonthSummary[];
  requests: RequestItem[];
  selectedMonth: string;
  onSelectMonth: (m: string) => void;
  onEdit: (id: string) => void;
  onLogout: () => void;
  onUnlock: () => void;
  unlocked: boolean;
};

export function DesignMainPage({ months, requests, selectedMonth, onSelectMonth, onEdit, onLogout, onUnlock, unlocked }: Props) {
  const month = months.find((m) => m.monthKey === selectedMonth) ?? { monthKey: selectedMonth, label: 'Aktuální měsíc', counts: { total: 0 } };
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <div className="max-w-[1365px] mx-auto p-4 grid grid-cols-[240px_1fr_360px] gap-4">
        <aside className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="font-bold mb-3">Měsíce</h3>
          <div className="space-y-2">
            {months.map((m) => (
              <button key={m.monthKey} onClick={() => onSelectMonth(m.monthKey)} className={`w-full text-left p-3 rounded-xl border ${selectedMonth === m.monthKey ? 'border-primary bg-blue-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="font-semibold text-sm">{m.label}</div>
                <div className="text-xs text-slate-500">{m.monthKey}</div>
              </button>
            ))}
          </div>
        </aside>
        <main className="space-y-4">
          <header className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center">
            <h2 className="text-xl font-black">{month.label}</h2>
            <div className="flex gap-2">
              <button onClick={onUnlock} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm">{unlocked ? 'Odemčeno' : 'Odemknout (10 min)'}</button>
              <button onClick={onLogout} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm">Odhlásit</button>
            </div>
          </header>
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {requests.length === 0 && (
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500">Aktuální měsíc — zatím bez požadavků</div>
            )}
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {requests.map((item) => (
                <div key={item.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div>
                    <p className="text-sm font-bold">{item.description}</p>
                    <p className="text-xs text-slate-500">VS {item.vs}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black">{item.amountCzk} Kč</span>
                    <button onClick={() => onEdit(item.id)} className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs">Edit</button>
                  </div>
                </div>
              ))}
              <div className="w-full p-4 flex items-center justify-center gap-2 text-slate-500 border-t border-dashed border-slate-300 dark:border-slate-800">
                <span className="text-sm font-medium">Přidat nový požadavek...</span>
              </div>
            </div>
          </section>
        </main>
        <aside className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="font-bold mb-3">Editor</h3>
          <input className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5 mb-3" placeholder="Jméno" />
          <input className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5 mb-3" placeholder="Poznámka" />
          <button className="w-full p-2.5 rounded-xl bg-primary text-white font-semibold">Uložit</button>
        </aside>
      </div>
    </div>
  );
}
