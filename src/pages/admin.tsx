import * as React from 'react';
import { EyeIcon, KeyRoundIcon, PlusIcon, Trash2Icon, UserCogIcon, UsersIcon } from 'lucide-react';
import { type TradeLog } from '@/lib/supabase';
import { type Profile } from '@/lib/auth';
import { adminAction } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScreenshotModal, ScreenshotThumbnail } from '@/components/screenshot-modal';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { computeStats, computePatternStats, computeConfluenceStats, topConfluence } from '@/lib/analytics';

export type StudentSummary = Profile & { total_trades: number };

export function AdminPage({ profile }: { profile: Profile }) {
  const [students, setStudents] = React.useState<StudentSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<StudentSummary | null>(null);
  const [trades, setTrades] = React.useState<TradeLog[]>([]);
  const [modalUrl, setModalUrl] = React.useState<string | null>(null);
  const [newUsername, setNewUsername] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [resetPassword, setResetPassword] = React.useState<Record<string, string>>({});

  const loadStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminAction<{ students: StudentSummary[] }>('list_users');
      setStudents(result.students);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat pengguna.');
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { loadStudents(); }, [loadStudents]);

  const viewStudent = async (student: StudentSummary) => {
    try {
      const result = await adminAction<{ trades: TradeLog[] }>('get_user_trades', { user_id: student.id });
      setSelected(student);
      setTrades(result.trades);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal membuka jurnal murid.'); }
  };

  const addStudent = async () => {
    if (!newUsername || newPassword.length < 6) { toast.error('Isi username dan password minimal 6 karakter.'); return; }
    try {
      await adminAction('create_user', { username: newUsername, password: newPassword });
      setNewUsername(''); setNewPassword('');
      toast.success('Murid berhasil ditambahkan.');
      loadStudents();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menambah murid.'); }
  };

  const doReset = async (student: StudentSummary) => {
    const password = resetPassword[student.id] || '';
    if (password.length < 6) { toast.error('Password baru minimal 6 karakter.'); return; }
    try {
      await adminAction('reset_password', { user_id: student.id, password });
      setResetPassword((p) => ({ ...p, [student.id]: '' }));
      toast.success(`Password ${student.username} berhasil direset.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal reset password.'); }
  };

  const deleteStudent = async (student: StudentSummary) => {
    if (!confirm(`Hapus akun ${student.username} beserta seluruh jurnalnya?`)) return;
    try {
      await adminAction('delete_user', { user_id: student.id });
      if (selected?.id === student.id) { setSelected(null); setTrades([]); }
      toast.success('Akun murid dihapus.');
      loadStudents();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus murid.'); }
  };

  const stats = computeStats(trades);
  const patterns = computePatternStats(trades);
  const confluences = computeConfluenceStats(trades);
  const insight = topConfluence(trades);

  return (
    <div className="space-y-6">
      <Toaster richColors theme="dark" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">Admin Control Center</p>
          <h1 className="mt-1 text-3xl font-black text-white">Dashboard Admin</h1>
          <p className="mt-1 text-sm font-medium text-white">Kelola akun murid dan evaluasi jurnal trading.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-bold text-white">
          <UserCogIcon className="h-4 w-4 text-yellow-400" /> {profile.username} · ADMIN
        </div>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-4 flex items-center gap-2"><PlusIcon className="h-5 w-5 text-yellow-400" /><h2 className="text-lg font-black text-white">Tambah Murid</h2></div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Username murid" className="border-zinc-700 bg-black text-white placeholder:text-white" />
          <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Password awal" className="border-zinc-700 bg-black text-white placeholder:text-white" />
          <Button onClick={addStudent} className="bg-yellow-400 font-black text-black hover:bg-yellow-300">Tambah Murid</Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-zinc-800 p-4"><UsersIcon className="h-5 w-5 text-yellow-400" /><h2 className="text-lg font-black text-white">Manajemen Murid</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead><tr className="border-b border-zinc-800"><th className="p-4 text-xs font-black uppercase text-yellow-400">Username</th><th className="p-4 text-xs font-black uppercase text-yellow-400">Tanggal Join</th><th className="p-4 text-xs font-black uppercase text-yellow-400">Total Trade</th><th className="p-4 text-xs font-black uppercase text-yellow-400">Reset Password</th><th className="p-4 text-right text-xs font-black uppercase text-yellow-400">Aksi</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="p-8 text-center font-bold text-white">Memuat...</td></tr> : students.length === 0 ? <tr><td colSpan={5} className="p-8 text-center font-bold text-white">Belum ada murid.</td></tr> : students.map((s) => (
                <tr key={s.id} className="border-b border-zinc-900 hover:bg-zinc-900">
                  <td className="p-4 font-black text-white">{s.username}</td>
                  <td className="p-4 text-sm font-bold text-white">{new Date(s.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 font-black text-yellow-400">{s.total_trades}</td>
                  <td className="p-4"><div className="flex max-w-[260px] gap-2"><Input value={resetPassword[s.id] || ''} onChange={(e) => setResetPassword((p) => ({ ...p, [s.id]: e.target.value }))} type="password" placeholder="Password baru" className="border-zinc-700 bg-black text-white placeholder:text-white" /><Button size="sm" onClick={() => doReset(s)} className="bg-yellow-400 text-black hover:bg-yellow-300"><KeyRoundIcon className="h-4 w-4" /></Button></div></td>
                  <td className="p-4 text-right"><div className="flex justify-end gap-2"><Button size="sm" onClick={() => viewStudent(s)} className="bg-yellow-400 font-black text-black hover:bg-yellow-300"><EyeIcon className="mr-1 h-4 w-4" /> Login Sebagai Murid</Button><Button size="sm" variant="outline" onClick={() => deleteStudent(s)} className="border-red-500/50 bg-black text-white hover:bg-red-500 hover:text-white"><Trash2Icon className="h-4 w-4" /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && <section className="space-y-4 rounded-xl border border-yellow-400/40 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-yellow-400">Mode Evaluasi Murid</p><h2 className="text-2xl font-black text-white">{selected.username}</h2><p className="text-sm font-bold text-white">Tampilan read-only jurnal murid.</p></div><Button variant="outline" onClick={() => setSelected(null)} className="border-zinc-700 bg-black text-white">Tutup Evaluasi</Button></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Mini label="Total Trade" value={stats.total}/><Mini label="Win" value={stats.wins}/><Mini label="Loss" value={stats.losses}/><Mini label="Win Rate" value={`${stats.winRate.toFixed(1)}%`}/></div>
        <div className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-4"><p className="text-sm font-black text-yellow-400">Auto-Insight</p><p className="mt-1 text-sm font-bold text-white">{insight ? `Kombinasi [${insight.combo}] memiliki Win Rate ${insight.winRate.toFixed(1)}% dari ${insight.total} trade.` : 'Belum ada confluence kombinasi yang cukup untuk insight.'}</p></div>
        <div className="overflow-x-auto rounded-lg border border-zinc-800"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-zinc-800"><th className="p-3 text-xs font-black text-yellow-400">Tanggal</th><th className="p-3 text-xs font-black text-yellow-400">Koin</th><th className="p-3 text-xs font-black text-yellow-400">Pola</th><th className="p-3 text-xs font-black text-yellow-400">Posisi</th><th className="p-3 text-xs font-black text-yellow-400">Hasil</th><th className="p-3 text-xs font-black text-yellow-400">Chart</th></tr></thead><tbody>{trades.map((t) => <tr key={t.id} className="border-b border-zinc-900"><td className="p-3 font-bold text-white">{t.trade_date}</td><td className="p-3 font-black text-white">{t.coin}</td><td className="p-3"><div className="flex max-w-[350px] flex-wrap gap-1">{t.patterns.map((p) => <span key={p} className="rounded border border-yellow-400/40 bg-yellow-400/10 px-1.5 py-0.5 text-[11px] font-bold text-yellow-400">{p}</span>)}</div></td><td className="p-3 font-black text-white">{t.position}</td><td className="p-3 font-black text-white">{t.result}</td><td className="p-3"><ScreenshotThumbnail url={t.screenshot_url} onClick={() => setModalUrl(t.screenshot_url)}/></td></tr>)}</tbody></table></div>
        <div className="grid gap-4 lg:grid-cols-2"><div><h3 className="mb-2 font-black text-white">Performa Pola Tunggal</h3><div className="overflow-x-auto rounded-lg border border-zinc-800"><table className="w-full text-left"><tbody>{patterns.map((p) => <tr key={p.pattern} className="border-b border-zinc-900"><td className="p-2 text-sm font-bold text-white">{p.pattern}</td><td className="p-2 text-right text-sm font-black text-yellow-400">{p.winRate.toFixed(1)}%</td></tr>)}</tbody></table></div></div><div><h3 className="mb-2 font-black text-white">Confluence</h3><div className="space-y-2">{confluences.map((c) => <div key={c.combo} className="rounded border border-zinc-800 p-2"><p className="text-sm font-bold text-white">{c.combo}</p><p className="text-xs font-black text-yellow-400">{c.winRate.toFixed(1)}% · {c.wins}/{c.total} win</p></div>)}</div></div></div>
      </section>}
      <ScreenshotModal url={modalUrl} open={!!modalUrl} onOpenChange={(v) => !v && setModalUrl(null)} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border border-zinc-800 bg-black p-3"><p className="text-xs font-black text-white">{label}</p><p className="mt-1 text-2xl font-black text-yellow-400">{value}</p></div>; }
