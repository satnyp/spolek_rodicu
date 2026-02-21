export function DesignLoginPage({ onGoogle, onSeznam }: { onGoogle: () => void; onSeznam: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 md:p-10">
          <div className="flex flex-col items-center mb-10">
            <div className="h-16 w-16 rounded-xl bg-[#14266a] flex items-center justify-center mb-6 shadow-lg shadow-[#14266a]/20 text-white font-black">SR</div>
            <h1 className="text-2xl font-black tracking-tight">Příspěvky rodičů</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Přihlášení do aplikace Spolek rodičů</p>
          </div>
          <div className="space-y-4">
            <button onClick={onGoogle} className="w-full px-6 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm font-bold">Přihlásit se přes Google</button>
            <button onClick={onSeznam} className="w-full px-6 py-3.5 bg-[#CC0000] hover:bg-[#B30000] rounded-xl transition-all shadow-lg shadow-red-500/10 text-sm font-bold text-white">Přihlásit se přes Seznam.cz</button>
          </div>
        </div>
      </div>
    </div>
  );
}
