import * as React from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, FilterIcon, XIcon } from 'lucide-react';
import { supabase, type TradeLog, normalizeTradeLogs } from '@/lib/supabase';
import {
  computeStats,
  computePatternStats,
  computeConfluenceStats,
  topConfluence,
  winRateColor,
  type PatternStat,
  type ConfluenceStat,
} from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ScreenshotModal, ScreenshotThumbnail } from '@/components/screenshot-modal';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseTradeDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monthKey(value: string) {
  const date = parseTradeDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return monthFormatter.format(new Date(y, m - 1, 1));
}

function monthStartFromKey(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function DashboardPage() {
  const [trades, setTrades] = React.useState<TradeLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [openMonths, setOpenMonths] = React.useState<string[]>([]);
  const [modalUrl, setModalUrl] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trade_logs')
      .select('*')
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) toast.error('Gagal memuat data: ' + error.message);
    else setTrades(normalizeTradeLogs(data));
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const stats = React.useMemo(() => computeStats(trades), [trades]);
  const patternStats = React.useMemo(() => computePatternStats(trades), [trades]);
  const confluenceStats = React.useMemo(() => computeConfluenceStats(trades), [trades]);
  const insight = React.useMemo(() => topConfluence(trades), [trades]);

  const groupedMonths = React.useMemo(() => {
    const groups = new Map<string, TradeLog[]>();
    for (const trade of trades) {
      const key = monthKey(trade.trade_date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(trade);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [trades]);

  React.useEffect(() => {
    if (groupedMonths.length && openMonths.length === 0) setOpenMonths([groupedMonths[0][0]]);
  }, [groupedMonths, openMonths.length]);

  const calendarTrades = React.useMemo(() => {
    const key = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
    return trades.filter((t) => monthKey(t.trade_date) === key);
  }, [trades, calendarMonth]);

  const dayMap = React.useMemo(() => {
    const map = new Map<string, TradeLog[]>();
    for (const trade of calendarTrades) {
      if (!map.has(trade.trade_date)) map.set(trade.trade_date, []);
      map.get(trade.trade_date)!.push(trade);
    }
    return map;
  }, [calendarTrades]);

  const filteredTrades = React.useMemo(
    () => selectedDate ? trades.filter((trade) => trade.trade_date === selectedDate) : trades,
    [trades, selectedDate]
  );

  const calendarDays = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const mondayOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: mondayOffset }, () => null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  };

  const goMonth = (delta: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDate(null);
  };

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center bg-black"><p className="text-sm font-black text-white">Memuat dashboard...</p></div>;
  }

  return (
    <div className="space-y-6 bg-black">
      <Toaster richColors theme="dark" />
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Dashboard Analytics</h1>
        <p className="mt-1 text-sm font-bold text-white">Ringkasan performa trading, kalender hasil harian, dan riwayat trade per bulan.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Trade" value={stats.total} accent="yellow" />
        <StatCard label="Total Win" value={stats.wins} accent="green" />
        <StatCard label="Total Loss" value={stats.losses} accent="red" />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} accent="yellow" />
        <StatCard label="Total R:R" value={formatR(stats.totalR)} accent={stats.totalR >= 0 ? 'green' : 'red'} />
        <StatCard label="Average R:R" value={formatR(stats.averageR)} accent={stats.averageR >= 0 ? 'green' : 'red'} />
      </div>

      <div className="rounded-xl border-2 border-yellow-400 bg-zinc-950 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg" aria-hidden>💡</span>
          <div>
            <h2 className="text-sm font-black text-yellow-400">Auto-Insight Kesimpulan</h2>
            <p className="mt-1 text-sm font-bold text-white">
              {insight ? <>Kombinasi <span className="font-black text-yellow-400">[{insight.combo}]</span> adalah setup terbaik dengan Win Rate <span className="font-black text-yellow-400">{insight.winRate.toFixed(1)}%</span> dari {insight.total} trade.</> : stats.total > 0 ? 'Belum ada kombinasi pola ganda yang cukup data. Tambahkan trade dengan beberapa pola sekaligus.' : 'Belum ada trade yang dicatat. Mulai isi journal untuk mendapatkan insight otomatis.'}
            </p>
          </div>
        </div>
      </div>

      <TradingCalendar
        month={calendarMonth}
        days={calendarDays}
        dayMap={dayMap}
        selectedDate={selectedDate}
        onPrevious={() => goMonth(-1)}
        onNext={() => goMonth(1)}
        onSelect={(date) => setSelectedDate(date === selectedDate ? null : date)}
      />

      <MonthlyTradeGroups
        groups={groupedMonths}
        openMonths={openMonths}
        onToggle={toggleMonth}
        selectedDate={selectedDate}
        filteredTrades={filteredTrades}
        onClearDate={() => setSelectedDate(null)}
        onOpenChart={setModalUrl}
      />

      <section>
        <h2 className="mb-3 text-lg font-black text-white">Performa Pola Tunggal</h2>
        <div className="overflow-hidden rounded-xl border-2 border-zinc-800 bg-zinc-950">
          <Table>
            <TableHeader><TableRow className="border-zinc-800 hover:bg-transparent"><TableHead className="h-10 px-4 text-xs font-black uppercase tracking-wider text-yellow-400">Pola</TableHead><TableHead className="h-10 px-4 text-right text-xs font-black uppercase tracking-wider text-yellow-400">Total</TableHead><TableHead className="h-10 px-4 text-right text-xs font-black uppercase tracking-wider text-yellow-400">Win</TableHead><TableHead className="h-10 px-4 text-right text-xs font-black uppercase tracking-wider text-yellow-400">Loss</TableHead><TableHead className="h-10 px-4 text-right text-xs font-black uppercase tracking-wider text-yellow-400">Win Rate</TableHead></TableRow></TableHeader>
            <TableBody>{patternStats.length === 0 ? <TableRow className="border-zinc-800"><TableCell colSpan={5} className="px-4 py-8 text-center text-sm font-bold text-white">Belum ada data pola.</TableCell></TableRow> : patternStats.map((p) => <PatternRow key={p.pattern} stat={p} />)}</TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-black text-white">Confluence Analytics (Kombinasi Pola)</h2>
        <div className="grid gap-3 sm:grid-cols-2">{confluenceStats.length === 0 ? <div className="col-span-full rounded-xl border-2 border-zinc-800 bg-zinc-950 p-8 text-center text-sm font-bold text-white">Belum ada kombinasi pola. Tambahkan trade dengan minimal 2 pola untuk melihat analisis confluence.</div> : confluenceStats.map((c) => <ConfluenceCard key={c.combo} stat={c} />)}</div>
      </section>

      <ScreenshotModal open={!!modalUrl} url={modalUrl} onOpenChange={(open) => !open && setModalUrl(null)} />
    </div>
  );
}

function TradingCalendar({ month, days, dayMap, selectedDate, onPrevious, onNext, onSelect }: { month: Date; days: Array<Date | null>; dayMap: Map<string, TradeLog[]>; selectedDate: string | null; onPrevious: () => void; onNext: () => void; onSelect: (date: string) => void }) {
  return (
    <section className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><CalendarDaysIcon className="h-5 w-5 text-yellow-400" /><h2 className="text-lg font-black text-white">Trading Calendar / Heatmap</h2></div>
        <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={onPrevious} aria-label="Bulan sebelumnya" className="border-zinc-700 bg-black text-white hover:bg-zinc-800"><ChevronLeftIcon className="h-4 w-4" /></Button><div className="min-w-[150px] text-center text-sm font-black capitalize text-white">{monthFormatter.format(month)}</div><Button variant="outline" size="icon" onClick={onNext} aria-label="Bulan berikutnya" className="border-zinc-700 bg-black text-white hover:bg-zinc-800"><ChevronRightIcon className="h-4 w-4" /></Button></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-black text-white"><Legend className="bg-emerald-500" label="Dominan Win" /><Legend className="bg-red-500" label="Dominan Loss" /><Legend className="bg-zinc-700" label="No Trade" /><Legend className="bg-yellow-400" label="Win/Loss seimbang" /></div>
      <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((day) => <div key={day} className="p-1 text-center text-[10px] font-black uppercase text-white sm:text-xs">{day}</div>)}{days.map((date, index) => { if (!date) return <div key={`empty-${index}`} className="min-h-12 rounded-lg bg-black" />; const key = toDateKey(date); const entries = dayMap.get(key) || []; const settled = entries.filter((t) => t.result !== 'Running'); const wins = settled.filter((t) => t.result === 'Win').length; const losses = settled.filter((t) => t.result === 'Loss').length; const hasTrades = entries.length > 0; const state = !hasTrades ? 'none' : settled.length === 0 ? 'pending' : wins > losses ? 'win' : losses > wins ? 'loss' : 'mixed'; return <button type="button" key={key} onClick={() => onSelect(key)} title={hasTrades ? `${dayFormatter.format(date)} · ${entries.length} trade` : `${dayFormatter.format(date)} · No Trade`} className={cn('min-h-12 rounded-lg border-2 p-1 text-left transition-transform hover:scale-[1.02] sm:min-h-16', state === 'win' && 'border-emerald-400 bg-emerald-500 text-white', state === 'loss' && 'border-red-400 bg-red-500 text-white', state === 'mixed' && 'border-yellow-400 bg-yellow-400 text-black', state === 'none' && 'border-zinc-800 bg-zinc-700 text-white', state === 'pending' && 'border-blue-400 bg-blue-600 text-white', selectedDate === key && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-black')}><div className="text-xs font-black">{date.getDate()}</div>{hasTrades && <div className="mt-1 text-[10px] font-black leading-tight">{entries.length} trade<br />{wins}W · {losses}L{entries.filter((t) => t.result === 'Running').length ? ` · ${entries.filter((t) => t.result === 'Running').length}⏳` : ''}</div>}</button>; })}</div>
      {selectedDate && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border-2 border-yellow-400 bg-black p-3"><div className="flex items-center gap-2 text-sm font-black text-white"><FilterIcon className="h-4 w-4 text-yellow-400" />Filter tanggal: {dayFormatter.format(parseTradeDate(selectedDate))}</div><button type="button" onClick={() => onSelect(selectedDate)} className="inline-flex items-center gap-1 text-sm font-black text-yellow-400 hover:text-yellow-300"><XIcon className="h-4 w-4" /> Hapus filter</button></div>}
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded-sm border border-white', className)} />{label}</span>; }

function MonthlyTradeGroups({ groups, openMonths, onToggle, selectedDate, filteredTrades, onClearDate, onOpenChart }: { groups: Array<[string, TradeLog[]]>; openMonths: string[]; onToggle: (key: string) => void; selectedDate: string | null; filteredTrades: TradeLog[]; onClearDate: () => void; onOpenChart: (url: string) => void }) {
  return <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-white">Trade Log per Bulan</h2><p className="text-sm font-bold text-white">Klik bulan untuk membuka ringkasan dan transaksi.</p></div>{selectedDate && <Button variant="outline" onClick={onClearDate} className="border-yellow-400 bg-black font-black text-yellow-400 hover:bg-yellow-400 hover:text-black"><XIcon className="mr-1.5 h-4 w-4" /> Tampilkan Semua Trade</Button>}</div>{groups.length === 0 ? <div className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-8 text-center font-black text-white">Belum ada trade.</div> : groups.map(([key, monthTrades]) => { const stats = computeStats(monthTrades); const coins = Array.from(new Set(monthTrades.map((t) => t.coin))).sort(); const isOpen = openMonths.includes(key); const visible = selectedDate ? monthTrades.filter((t) => t.trade_date === selectedDate) : monthTrades; return <div key={key} className="overflow-hidden rounded-xl border-2 border-zinc-800 bg-zinc-950"><button type="button" onClick={() => onToggle(key)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-zinc-900"><div className="min-w-0"><h3 className="text-base font-black capitalize text-white">{monthLabel(key)}</h3><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-black text-white"><span>{stats.total} Trade</span><span>Win Rate {stats.winRate.toFixed(1)}%</span><span className={stats.totalR >= 0 ? 'text-emerald-400' : 'text-red-400'}>R:R {formatR(stats.totalR)}</span><span>Koin: {coins.length ? coins.join(', ') : '-'}</span></div></div><ChevronDownIcon className={cn('h-5 w-5 shrink-0 text-yellow-400 transition-transform', isOpen && 'rotate-180')} /></button>{isOpen && <div className="border-t-2 border-zinc-800 p-3 sm:p-4"><div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5"><Mini label="Total Trade" value={stats.total} /><Mini label="Win" value={stats.wins} /><Mini label="Loss" value={stats.losses} /><Mini label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} /><Mini label="Total R:R" value={formatR(stats.totalR)} valueClass={stats.totalR >= 0 ? 'text-emerald-400' : 'text-red-400'} /></div><div className="mb-3 rounded-lg border-2 border-yellow-400 bg-black p-3"><p className="text-xs font-black uppercase text-yellow-400">Average R:R</p><p className={cn('mt-1 text-xl font-black', stats.averageR >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatR(stats.averageR)} per trade</p></div><div className="mb-3 rounded-lg border-2 border-zinc-800 bg-black p-3"><p className="text-xs font-black uppercase text-yellow-400">Koin Ditradingkan</p><p className="mt-1 text-sm font-black text-white">{coins.length ? coins.join(' · ') : '-'}</p></div>{selectedDate && <p className="mb-3 text-sm font-black text-yellow-400">Menampilkan {visible.length} trade pada {dayFormatter.format(parseTradeDate(selectedDate))}.</p>}<TradeTable trades={visible} onOpenChart={onOpenChart} /></div>}</div>; })}</section>;
}

function TradeTable({ trades, onOpenChart }: { trades: TradeLog[]; onOpenChart: (url: string) => void }) { return <div className="overflow-x-auto rounded-lg border-2 border-zinc-800"><Table className="min-w-[820px]"><TableHeader><TableRow className="border-zinc-800 hover:bg-transparent"><TableHead className="px-1.5 text-center text-xs font-black text-yellow-400">Tanggal</TableHead><TableHead className="px-1.5 text-center text-xs font-black text-yellow-400">Koin</TableHead><TableHead className="px-1.5 text-center text-xs font-black text-yellow-400">Pola / Setup</TableHead><TableHead className="px-1.5 text-center text-xs font-black text-yellow-400">Posisi</TableHead><TableHead className="px-1.5 text-center text-xs font-black text-yellow-400">Hasil</TableHead><TableHead className="px-1.5 text-center text-xs font-black text-yellow-400">Reward Ratio (R)</TableHead><TableHead className="px-1.5 text-center text-xs font-black text-yellow-400">Chart</TableHead></TableRow></TableHeader><TableBody>{trades.length === 0 ? <TableRow className="border-zinc-800"><TableCell colSpan={7} className="p-8 text-center font-black text-white">Tidak ada transaksi untuk filter ini.</TableCell></TableRow> : trades.map((t) => <TableRow key={t.id} className="border-zinc-800"><TableCell className="px-1.5 py-1.5 text-center font-bold text-white">{t.trade_date}</TableCell><TableCell className="px-1.5 py-1.5 text-center font-black text-white">{t.coin}</TableCell><TableCell className="max-w-[300px] px-1.5 py-1.5 text-center font-bold text-white">{t.patterns.join(' · ')}</TableCell><TableCell className="px-1.5 py-1.5 text-center font-black text-white">{t.position}</TableCell><TableCell className={cn('px-1.5 py-1.5 text-center font-black', t.result === 'Win' ? 'text-emerald-400' : t.result === 'Loss' ? 'text-red-400' : t.result === 'Running' ? 'text-yellow-400' : 'text-yellow-400')}>{t.result === 'Running' ? '⏳ Running' : t.result}</TableCell><TableCell className={cn('px-1.5 py-1.5 text-center font-black', Number(t.reward_r) > 0 ? 'text-emerald-400' : Number(t.reward_r) < 0 ? 'text-red-400' : 'text-yellow-400')}>{formatR(Number(t.reward_r ?? 0))}</TableCell><TableCell className="px-1.5 py-1.5 text-center">{t.screenshot_url ? <ScreenshotThumbnail url={t.screenshot_url} onClick={() => onOpenChart(t.screenshot_url!)} /> : <span className="text-xs font-bold text-white">-</span>}</TableCell></TableRow>)}</TableBody></Table></div>; }

function formatR(value: number) { const normalized = Number.isFinite(value) ? value : 0; return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(1)}R`; }

function Mini({ label, value, valueClass = 'text-yellow-400' }: { label: string; value: string | number; valueClass?: string }) { return <div className="rounded-lg border-2 border-zinc-800 bg-black p-3"><p className="text-[11px] font-black uppercase text-white">{label}</p><p className={cn('mt-1 text-lg font-black', valueClass)}>{value}</p></div>; }

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: 'yellow' | 'green' | 'red' }) { const accentClass = accent === 'green' ? 'text-emerald-400' : accent === 'red' ? 'text-red-400' : 'text-yellow-400'; return <div className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-yellow-400"><p className="text-xs font-black uppercase tracking-wider text-white">{label}</p><p className={cn('mt-2 text-3xl font-black', accentClass)}>{value}</p></div>; }
function PatternRow({ stat }: { stat: PatternStat }) { return <TableRow className="border-zinc-800 hover:bg-zinc-900"><TableCell className="px-4 py-2.5 text-sm font-black text-white">{stat.pattern}</TableCell><TableCell className="px-4 py-2.5 text-right text-sm font-black text-white">{stat.total}</TableCell><TableCell className="px-4 py-2.5 text-right text-sm font-black text-emerald-400">{stat.wins}</TableCell><TableCell className="px-4 py-2.5 text-right text-sm font-black text-red-400">{stat.losses}</TableCell><TableCell className={cn('px-4 py-2.5 text-right text-sm font-black', winRateColor(stat.winRate))}>{stat.winRate.toFixed(1)}%</TableCell></TableRow>; }
function ConfluenceCard({ stat }: { stat: ConfluenceStat }) { return <div className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-4 hover:border-yellow-400"><div className="flex items-start justify-between gap-2"><div className="flex flex-wrap gap-1">{stat.patterns.map((p) => <span key={p} className="inline-flex items-center rounded border border-yellow-400 bg-black px-1.5 py-0.5 text-[11px] font-black text-yellow-400">{p}</span>)}</div><span className={cn('text-sm font-black', winRateColor(stat.winRate))}>{stat.winRate.toFixed(1)}%</span></div><div className="mt-3 flex items-center gap-3"><Progress value={stat.winRate} className="h-2 bg-zinc-800" /><span className="shrink-0 text-xs font-black text-white">{stat.wins}/{stat.total} win</span></div></div>; }
