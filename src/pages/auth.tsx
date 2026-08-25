import * as React from 'react';
import { LineChartIcon, LogInIcon, UserPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { login, register } from '@/lib/auth';
import { toast } from 'sonner';

export function AuthPage() {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      toast.error('Username 3–30 karakter: huruf, angka, titik, underscore, atau strip.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password minimal 6 karakter.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await login(cleanUsername, password);
        if (error) throw error;
        toast.success('Login berhasil.');
      } else {
        const { data, error } = await register(cleanUsername, password);
        if (error) throw error;
        toast.success('Akun berhasil dibuat. Silakan login.');
        setMode('login');
        setPassword('');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black shadow-[0_0_35px_rgba(250,204,21,0.2)]">
            <LineChartIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight">Trade Journal</h1>
          <p className="mt-2 text-sm font-medium text-white">Crypto Futures Journal & Analytics</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-7">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-black p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={cn('rounded-lg px-3 py-2.5 text-sm font-bold', mode === 'login' ? 'bg-yellow-400 text-black' : 'text-white hover:bg-zinc-900')}
            >
              <LogInIcon className="mr-1.5 inline h-4 w-4" /> Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={cn('rounded-lg px-3 py-2.5 text-sm font-bold', mode === 'register' ? 'bg-yellow-400 text-black' : 'text-white hover:bg-zinc-900')}
            >
              <UserPlusIcon className="mr-1.5 inline h-4 w-4" /> Register
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-white">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="contoh: adrian" className="h-11 border-zinc-700 bg-black text-white placeholder:text-white" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-white">Password</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Minimal 6 karakter" className="h-11 border-zinc-700 bg-black text-white placeholder:text-white" />
            </div>
            <Button disabled={loading} className="h-11 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300">
              {loading ? 'Memproses...' : mode === 'login' ? 'Login ke Journal' : 'Buat Akun'}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs font-medium text-white">
            Tanpa verifikasi email dan tanpa OTP. Username dipakai sebagai identitas login.
          </p>
        </div>
      </div>
    </div>
  );
}
