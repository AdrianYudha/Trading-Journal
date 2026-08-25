import type { TradeLog } from '@/lib/supabase';

export type PatternStat = {
  pattern: string;
  total: number;
  wins: number;
  losses: number;
  bes: number;
  winRate: number;
};

export type ConfluenceStat = {
  combo: string;
  patterns: string[];
  total: number;
  wins: number;
  winRate: number;
};

export type Stats = {
  total: number;
  wins: number;
  losses: number;
  bes: number;
  winRate: number;
  totalR: number;
  averageR: number;
};

const isSettled = (t: TradeLog) => t.result !== 'Running';
const isWin = (t: TradeLog) => t.result === 'Win';

export function computeStats(trades: TradeLog[]): Stats {
  const settled = trades.filter(isSettled);
  const total = trades.length;
  const wins = settled.filter(isWin).length;
  const losses = settled.filter((t) => t.result === 'Loss').length;
  const bes = settled.filter((t) => t.result === 'BE').length;
  const totalR = settled.reduce((sum, t) => sum + Number(t.reward_r ?? (t.result === 'Win' ? 2 : t.result === 'Loss' ? -1 : 0)), 0);
  const averageR = settled.length === 0 ? 0 : totalR / settled.length;
  const winRate = settled.length === 0 ? 0 : (wins / settled.length) * 100;
  return { total, wins, losses, bes, winRate, totalR, averageR };
}

export function computePatternStats(trades: TradeLog[]): PatternStat[] {
  const map = new Map<string, { total: number; wins: number; losses: number; bes: number }>();

  for (const t of trades.filter(isSettled)) {
    for (const p of t.patterns) {
      const cur = map.get(p) ?? { total: 0, wins: 0, losses: 0, bes: 0 };
      cur.total += 1;
      if (t.result === 'Win') cur.wins += 1;
      else if (t.result === 'Loss') cur.losses += 1;
      else cur.bes += 1;
      map.set(p, cur);
    }
  }

  const stats: PatternStat[] = [];
  for (const [pattern, s] of map.entries()) {
    stats.push({
      pattern,
      total: s.total,
      wins: s.wins,
      losses: s.losses,
      bes: s.bes,
      winRate: s.total === 0 ? 0 : (s.wins / s.total) * 100,
    });
  }
  stats.sort((a, b) => b.total - a.total);
  return stats;
}

export function computeConfluenceStats(trades: TradeLog[]): ConfluenceStat[] {
  const map = new Map<string, { patterns: string[]; total: number; wins: number }>();

  for (const t of trades.filter(isSettled)) {
    if (t.patterns.length < 2) continue;
    const sorted = [...t.patterns].sort();
    const key = sorted.join(' + ');
    const cur = map.get(key) ?? { patterns: sorted, total: 0, wins: 0 };
    cur.total += 1;
    if (isWin(t)) cur.wins += 1;
    map.set(key, cur);
  }

  const stats: ConfluenceStat[] = [];
  for (const [combo, s] of map.entries()) {
    stats.push({
      combo,
      patterns: s.patterns,
      total: s.total,
      wins: s.wins,
      winRate: s.total === 0 ? 0 : (s.wins / s.total) * 100,
    });
  }
  stats.sort((a, b) => b.total - a.total || b.winRate - a.winRate);
  return stats;
}

export function topConfluence(trades: TradeLog[]): ConfluenceStat | null {
  const combos = computeConfluenceStats(trades);
  if (combos.length === 0) return null;
  return combos.reduce((best, cur) =>
    cur.total >= 3 && cur.winRate > best.winRate ? cur : best,
  combos[0]
  );
}

export function winRateColor(wr: number): string {
  if (wr >= 70) return 'text-emerald-400';
  if (wr < 50) return 'text-red-400';
  return 'text-yellow-400';
}

export function winRateBarColor(wr: number): string {
  if (wr >= 70) return 'bg-emerald-500';
  if (wr < 50) return 'bg-red-500';
  return 'bg-yellow-400';
}
