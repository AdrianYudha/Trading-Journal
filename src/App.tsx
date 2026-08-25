import * as React from 'react';
import { LineChartIcon, TableIcon } from 'lucide-react';
import { JournalPage } from '@/pages/journal';
import { DashboardPage } from '@/pages/dashboard';
import { type Profile } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import './App.css';

type Tab = 'journal' | 'dashboard';

function App() {
  const [tab, setTab] = React.useState<Tab>('journal');
  const isAdminRoute = window.location.pathname === '/admin';

  const guestProfile: Profile = {
    id: 'public-workspace',
    username: 'trader',
    role: 'student',
    created_at: new Date().toISOString(),
  };

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-yellow-400/50 bg-zinc-950 p-8 text-center">
          <h1 className="text-2xl font-black text-white">Admin Dashboard Dinonaktifkan</h1>
          <p className="mt-3 font-bold text-white">Mode Login telah dihapus. Gunakan halaman utama untuk Trade Journal.</p>
          <Button onClick={() => { window.history.pushState({}, '', '/'); window.location.reload(); }} className="mt-6 bg-yellow-400 font-black text-black hover:bg-yellow-300">Kembali ke Journal</Button>
        </div>
      </div>
    );
  }

  return (
    <Shell profile={guestProfile} tab={tab} setTab={setTab}>
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-2 pb-24 pt-5 sm:px-3 sm:pt-6">
        {tab === 'journal' ? <JournalPage /> : <DashboardPage />}
      </main>
    </Shell>
  );
}

function Shell({ children, profile, tab, setTab }: { children: React.ReactNode; profile: Profile; tab?: Tab; setTab?: (t: Tab) => void }) {
  void profile;
  return <div className="min-h-screen bg-black text-white flex flex-col">
    <Toaster richColors theme="dark" />
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-2 py-2.5 sm:px-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400 text-black"><LineChartIcon className="h-5 w-5" /></div>
          <div><h1 className="text-base font-black leading-tight text-white">Trade Journal</h1><p className="text-[11px] font-bold leading-tight text-white">Crypto Futures Log</p></div>
        </div>
        {setTab && <nav className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <NavButton active={tab === 'journal'} onClick={() => setTab('journal')} icon={<TableIcon className="h-4 w-4" />} label="Journal" />
          <NavButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<LineChartIcon className="h-4 w-4" />} label="Dashboard" />
        </nav>}
      </div>
    </header>
    {children}
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black px-2 py-3">
      <div className="mx-auto max-w-[1500px] text-center">
        <p className="text-xs font-black text-white">© {new Date().getFullYear()} Mee'nNeng · Trading Journal</p>
        <p className="mt-1 text-[11px] font-bold text-white">Hak milik Mee'nNeng. Semua hak dilindungi.</p>
      </div>
    </footer>
  </div>;
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-black transition-all', active ? 'bg-yellow-400 text-black' : 'text-white hover:bg-zinc-800')}>{icon}{label}</button>;
}

export default App;
