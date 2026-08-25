import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type TradeLog = {
  id: string;
  user_id: string | null;
  trade_date: string;
  coin: string;
  patterns: string[];
  position: 'Long' | 'Short';
  result: 'Running' | 'Win' | 'Loss' | 'BE';
  reward_r?: number;
  screenshot_url: string | null;
  notes: string | null;
  created_at: string;
};

export type TradeLogInsert = Omit<TradeLog, 'id' | 'created_at' | 'user_id'> & { reward_r?: number };

export const COIN_OPTIONS = [
  'BTCUSDT',
  'ETHUSDT',
  'ICPUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'MATICUSDT',
  'DOTUSDT',
  'LTCUSDT',
  'TRXUSDT',
  'ATOMUSDT',
  'NEARUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT',
  'INJUSDT',
  'SUIUSDT',
  'SEIUSDT',
  'TIAUSDT',
  'ORDIUSDT',
  'PEPEUSDT',
  'SHIBUSDT',
  'WIFUSDT',
  'BONKUSDT',
  'FILUSDT',
  'RNDRUSDT',
  'FTMUSDT',
  'AAVEUSDT',
  'ALGOUSDT',
  'APEUSDT',
  'ATOMUSDT',
  'BCHUSDT',
  'BLURUSDT',
  'COMPUSDT',
  'CRVUSDT',
  'EGLDUSDT',
  'EOSUSDT',
  'ETCUSDT',
  'GALAUSDT',
  'GRTUSDT',
  'HBARUSDT',
  'IMXUSDT',
  'KASUSDT',
  'KAVAUSDT',
  'LDOUSDT',
  'MKRUSDT',
  'NEOUSDT',
  'PENDLEUSDT',
  'QNTUSDT',
  'RUNEUSDT',
  'SANDUSDT',
  'SNXUSDT',
  'STXUSDT',
  'THETAUSDT',
  'UNIUSDT',
  'VETUSDT',
  'WLDUSDT',
  'XLMUSDT',
  'XTZUSDT',
  'YFIUSDT',
  'ZECUSDT',
];

export const PATTERN_OPTIONS = [
  'Liquidity Sweep',
  'Deviation',
  'Bullish Engulfing',
  'Bearish Engulfing',
  'Bullish Divergence',
  'Bearish Divergence',
  'Order Block',
  'Fair Value Gap',
  'Break of Structure',
  'Change of Character',
  'Pin Bar',
  'Inside Bar',
  'Trendline Break',
  'Support Resistance',
  'Double Bottom',
  'Double Top',
  'Head & Shoulders',
  'Fibonacci Retracement',
];


/**
 * Compatibility layer for databases created before reward_r / Running existed.
 * If those columns are unavailable, the app stores the logical outcome/R in a
 * small metadata block inside notes and transparently restores it on read.
 */
const FALLBACK_META_RE = /\n?\[\[TJ_META\]\](.*?)\[\[\/TJ_META\]\]/s;

export function encodeFallbackMeta(notes: string | null | undefined, result: TradeLog['result'], rewardR: number) {
  const clean = (notes ?? '').replace(FALLBACK_META_RE, '').trim();
  const meta = JSON.stringify({ result, reward_r: rewardR });
  return `${clean}${clean ? '\n' : ''}[[TJ_META]]${meta}[[/TJ_META]]`;
}

export function normalizeTradeLog(raw: any): TradeLog {
  const notes = typeof raw?.notes === 'string' ? raw.notes : null;
  let result = raw?.result as TradeLog['result'];
  let reward = raw?.reward_r;
  const match = notes?.match(FALLBACK_META_RE);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta?.result) result = meta.result;
      if (meta?.reward_r !== undefined) reward = Number(meta.reward_r);
    } catch { /* keep database values */ }
  }
  if (reward === undefined || reward === null || Number.isNaN(Number(reward))) {
    reward = result === 'Win' ? 2 : result === 'Loss' ? -1 : 0;
  }
  return { ...raw, result, reward_r: Number(reward), notes } as TradeLog;
}

export function normalizeTradeLogs(rows: any[] | null | undefined): TradeLog[] {
  return (rows ?? []).map(normalizeTradeLog);
}
