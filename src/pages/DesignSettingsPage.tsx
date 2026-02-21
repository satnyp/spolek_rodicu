export function DesignSettingsPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h1 className="text-2xl font-black mb-6">Nastavení</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Email</span>
            <input className="rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" value="satny@gvid.cz" readOnly />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Role</span>
            <input className="rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent p-2.5" value="admin" readOnly />
          </label>
        </div>
      </div>
    </div>
  );
}
