import * as React from 'react';
import { ChevronDownIcon, DownloadIcon, FileSpreadsheetIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { supabase, type TradeLog, type TradeLogInsert, encodeFallbackMeta, normalizeTradeLogs, normalizeTradeLog } from '@/lib/supabase';
import { computeStats } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CoinCombobox } from '@/components/coin-combobox';
import { PatternMultiSelect } from '@/components/pattern-multi-select';
import { ScreenshotModal, ScreenshotThumbnail } from '@/components/screenshot-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type DraftRow = {
  id: string;
  trade_date: string;
  coin: string;
  patterns: string[];
  position: 'Long' | 'Short';
  result: 'Running' | 'Win' | 'Loss' | 'BE';
  reward_r: number;
  screenshot_url: string;
  notes: string;
  isNew: boolean;
};

const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

const todayStr = () => new Date().toISOString().slice(0, 10);

function parseTradeDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monthKey(value: string) {
  const date = parseTradeDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return monthFormatter.format(new Date(year, month - 1, 1));
}

function formatR(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(1)}R`;
}

function emptyDraft(): DraftRow {
  return {
    id: 'new-' + Math.random().toString(36).slice(2),
    trade_date: todayStr(),
    coin: '',
    patterns: [],
    position: 'Long',
    result: 'Running',
    reward_r: 0,
    screenshot_url: '',
    notes: '',
    isNew: true,
  };
}

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function excelColumnName(index: number) {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = concatBytes(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    );
    localParts.push(localHeader, data);

    const centralHeader = concatBytes(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    );
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const central = concatBytes(...centralParts);
  const locals = concatBytes(...localParts);
  const end = concatBytes(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(locals.length), u16(0),
  );
  return concatBytes(locals, central, end);
}

function buildXlsx(trades: TradeLog[], title: string, filename: string) {
  if (trades.length === 0) {
    toast.info('Tidak ada transaksi untuk diekspor.');
    return;
  }

  const stats = computeStats(trades);
  const headers = ['Tanggal', 'Koin', 'Pola / Setup', 'Posisi', 'Hasil', 'Reward Ratio (R)', 'URL Screenshot Chart'];
  const rows = trades.map((trade) => [
    trade.trade_date,
    trade.coin,
    trade.patterns.join(' | '),
    trade.position,
    trade.result === 'Running' ? 'Running / Pending' : trade.result,
    Number(trade.reward_r ?? 0),
    trade.screenshot_url ?? '',
  ]);

  // The report is intentionally centered inside a wider sheet (A and I are margins).
  // B:H contains the actual report so it does not look stuck to the far-left edge in Excel.
  const offset = 1; // Excel column B
  const excelRef = (index: number, row: number) => `${excelColumnName(index + offset)}${row}`;

  const cell = (ref: string, value: unknown, style = 0, type: 'inlineStr' | 'n' = 'inlineStr') => {
    if (type === 'n') {
      return `<c r="${ref}" s="${style}" t="n"><v>${Number(value) || 0}</v></c>`;
    }
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  };

  const blank = (ref: string, style = 0) => `<c r="${ref}" s="${style}"/>`;
  const sheetRows: string[] = [];

  // Title bar.
  sheetRows.push(
    `<row r="1" ht="38">` +
      cell('B1', title, 1) +
      blank('C1', 1) + blank('D1', 1) + blank('E1', 1) + blank('F1', 1) + blank('G1', 1) + blank('H1', 1) +
    `</row>`,
  );

  // KPI cards: yellow labels, dark values, and semantic green/red R values.
  sheetRows.push(
    `<row r="2" ht="27">` +
      cell('B2', 'TOTAL TRADE', 2) + cell('C2', stats.total, 3, 'n') +
      cell('D2', 'WIN RATE', 2) + cell('E2', `${stats.winRate.toFixed(1)}%`, 3) +
      cell('F2', 'TOTAL R', 2) + cell('G2', formatR(stats.totalR), stats.totalR >= 0 ? 4 : 5) +
      cell('H2', '', 0) +
    `</row>`,
  );

  sheetRows.push(
    `<row r="3" ht="27">` +
      cell('B3', 'TOTAL WIN', 2) + cell('C3', stats.wins, 6, 'n') +
      cell('D3', 'TOTAL LOSS', 2) + cell('E3', stats.losses, 7, 'n') +
      cell('F3', 'AVERAGE R', 2) + cell('G3', formatR(stats.averageR), stats.averageR >= 0 ? 4 : 5) +
      cell('H3', '', 0) +
    `</row>`,
  );

  sheetRows.push(
    `<row r="4" ht="23">` +
      cell('B4', 'EXPORTED', 8) + cell('C4', new Date().toLocaleString('id-ID'), 9) +
      cell('D4', 'OWNER', 8) + cell('E4', "Mee'Neng", 9) +
      cell('F4', 'RUNNING', 8) + cell('G4', trades.filter((t) => t.result === 'Running').length, 10, 'n') +
      cell('H4', '', 0) +
    `</row>`,
  );

  const headerCells = headers.map((h, i) => cell(excelRef(i, 6), h, 11)).join('');
  sheetRows.push(`<row r="6" ht="32">${headerCells}</row>`);

  rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 7;
    const result = String(row[4]);
    const resultStyle = result.startsWith('Win') ? 12 : result.startsWith('Loss') ? 13 : result.startsWith('BE') ? 14 : 15;
    const reward = Number(row[5]);
    const rewardStyle = reward > 0 ? 12 : reward < 0 ? 13 : 14;
    const baseStyle = rowIndex % 2 === 0 ? 16 : 17;

    const cells = [
      cell(excelRef(0, excelRow), row[0], baseStyle),
      cell(excelRef(1, excelRow), row[1], baseStyle),
      cell(excelRef(2, excelRow), row[2], baseStyle),
      cell(excelRef(3, excelRow), row[3], baseStyle),
      cell(excelRef(4, excelRow), row[4], resultStyle),
      cell(excelRef(5, excelRow), reward, rewardStyle, 'n'),
      cell(excelRef(6, excelRow), row[6], row[6] ? 18 : baseStyle),
    ];
    sheetRows.push(`<row r="${excelRow}" ht="28">${cells.join('')}</row>`);
  });

  const lastRow = rows.length + 6;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><tabColor rgb="FFFACC15"/></sheetPr>
<dimension ref="A1:I${lastRow}"/>
<sheetViews><sheetView showGridLines="0" workbookViewId="0" zoomScale="90"><pane ySplit="6" topLeftCell="B7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>
  <col min="1" max="1" width="3" customWidth="1"/>
  <col min="2" max="2" width="15" customWidth="1"/>
  <col min="3" max="3" width="15" customWidth="1"/>
  <col min="4" max="4" width="34" customWidth="1"/>
  <col min="5" max="5" width="13" customWidth="1"/>
  <col min="6" max="6" width="21" customWidth="1"/>
  <col min="7" max="7" width="18" customWidth="1"/>
  <col min="8" max="8" width="48" customWidth="1"/>
  <col min="9" max="9" width="3" customWidth="1"/>
</cols>
<sheetData>${sheetRows.join('')}</sheetData>
<mergeCells count="1"><mergeCell ref="B1:H1"/></mergeCells>
<autoFilter ref="B6:H${lastRow}"/>
<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>
<printOptions horizontalCentered="1" verticalCentered="0" gridLines="0"/>
<pageSetUpPr fitToPage="1"/>
</worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="165" formatCode="0.0&quot;R&quot;"/></numFmts>
<fonts count="7">
  <font><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
  <font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font>
  <font><b/><sz val="10"/><color rgb="FF111111"/><name val="Aptos"/></font>
  <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
  <font><b/><sz val="12"/><color rgb="FF16A34A"/><name val="Aptos"/></font>
  <font><b/><sz val="12"/><color rgb="FFDC2626"/><name val="Aptos"/></font>
  <font><b/><sz val="10"/><color rgb="FFFACC15"/><name val="Aptos"/></font>
</fonts>
<fills count="11">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFACC15"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF16A34A"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDC2626"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF27272A"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF18181B"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF3F3F46"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF713F12"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
  <border><left style="thin"><color rgb="FF3F3F46"/></left><right style="thin"><color rgb="FF3F3F46"/></right><top style="thin"><color rgb="FF3F3F46"/></top><bottom style="thin"><color rgb="FF3F3F46"/></bottom><diagonal/></border>
  <border><left style="medium"><color rgb="FFFACC15"/></left><right style="medium"><color rgb="FFFACC15"/></right><top style="medium"><color rgb="FFFACC15"/></top><bottom style="medium"><color rgb="FFFACC15"/></bottom><diagonal/></border>
  <border><left/><right/><top/><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="19">
  <xf numFmtId="0" fontId="0" fillId="2" borderId="2" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="6" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="6" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="5" fillId="6" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="5" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="6" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="8" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="9" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="5" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="9" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="10" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="7" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="7" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="3" fillId="7" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="3" fillId="7" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr defaultThemeVersion="164011"/><sheets><sheet name="Trade Journal" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const zip = zipStore([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/worksheets/sheet1.xml', content: sheet },
    { name: 'xl/styles.xml', content: styles },
  ]);

  const blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast.success('Export XLSX berhasil', { description: `${filename} siap dibuka di Excel / ONLYOFFICE.` });
}

function exportMonth(trades: TradeLog[], key: string) {
  const label = monthLabel(key).replace(/\s+/g, '_');
  buildXlsx(trades, `TRADE JOURNAL — ${monthLabel(key)}`, `Trade_Journal_${label}.xlsx`);
}

function exportAll(trades: TradeLog[]) {
  buildXlsx(trades, 'TRADE JOURNAL — SEMUA DATA', 'Trade_Journal_Semua_Data.xlsx');
}

function Mini({ label, value, valueClass = 'text-yellow-400' }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="rounded-lg border-2 border-zinc-800 bg-black p-3">
      <p className="text-[11px] font-black uppercase text-white">{label}</p>
      <p className={cn('mt-1 text-lg font-black', valueClass)}>{value}</p>
    </div>
  );
}

export function JournalPage() {
  const [rows, setRows] = React.useState<DraftRow[]>([]);
  const [saved, setSaved] = React.useState<TradeLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalUrl, setModalUrl] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [statusTrade, setStatusTrade] = React.useState<TradeLog | null>(null);
  const [statusChoice, setStatusChoice] = React.useState<'Win' | 'Loss' | 'BE' | null>(null);
  const [statusR, setStatusR] = React.useState('2');
  const [statusSaving, setStatusSaving] = React.useState(false);
  const [openMonths, setOpenMonths] = React.useState<string[]>([]);
  const [savingRows, setSavingRows] = React.useState<Set<string>>(new Set());
  const [deletingTrades, setDeletingTrades] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trade_logs')
      .select('*')
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Gagal memuat data: ' + error.message);
    } else if (data) {
      setSaved(normalizeTradeLogs(data));
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const groupedMonths = React.useMemo(() => {
    const groups = new Map<string, TradeLog[]>();
    for (const trade of saved) {
      const key = monthKey(trade.trade_date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(trade);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [saved]);

  React.useEffect(() => {
    if (groupedMonths.length === 0) return;
    const newest = groupedMonths[0][0];
    setOpenMonths((current) => current.length === 0 ? [newest] : current.filter((key) => groupedMonths.some(([month]) => month === key)));
  }, [groupedMonths]);

  const addRow = () => {
    if (rows.some((r) => r.isNew)) return;
    setRows((prev) => [emptyDraft(), ...prev]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRow = async (row: DraftRow) => {
    if (!row.coin) {
      toast.error('Nama koin wajib diisi.');
      return;
    }
    if (row.patterns.length === 0) {
      toast.error('Pilih minimal satu pola.');
      return;
    }

    const reward = row.result === 'Win'
      ? (Number(row.reward_r) > 0 ? Number(row.reward_r) : 2)
      : row.result === 'Loss' ? -1 : 0;

    const baseNotes = row.notes || null;
    const payload: TradeLogInsert = {
      trade_date: row.trade_date,
      coin: row.coin,
      patterns: row.patterns,
      position: row.position,
      result: row.result,
      reward_r: reward,
      screenshot_url: row.screenshot_url || null,
      notes: baseNotes,
    };

    let { data, error } = await supabase.from('trade_logs').insert(payload).select('*').single();

    if (error && /reward_r|schema cache/i.test(error.message)) {
      const fallbackResult = row.result === 'Running' ? 'BE' : row.result;
      const fallbackNotes = encodeFallbackMeta(baseNotes, row.result, reward);
      const fallback = await supabase.from('trade_logs').insert({
        trade_date: row.trade_date,
        coin: row.coin,
        patterns: row.patterns,
        position: row.position,
        result: fallbackResult,
        screenshot_url: row.screenshot_url || null,
        notes: fallbackNotes,
      }).select('*').single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      toast.error('Gagal menyimpan: ' + error.message);
      return;
    }

    toast.success('Trade berhasil disimpan', { description: `${row.coin} • ${row.position} • ${row.result === 'Running' ? '⏳ Running' : row.result}` });
    setSavingRows((prev) => new Set(prev).add(row.id));
    setSaved((prev) => [normalizeTradeLog(data), ...prev]);
    window.setTimeout(() => {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setSavingRows((prev) => { const next = new Set(prev); next.delete(row.id); return next; });
    }, 450);
  };

  const openStatusEditor = (trade: TradeLog) => {
    setStatusTrade(trade);
    setStatusChoice(null);
    setStatusR('2');
  };

  const applyStatusChoice = (choice: 'Win' | 'Loss' | 'BE') => {
    setStatusChoice(choice);
    if (choice === 'Win') setStatusR('2');
  };

  const saveStatus = async () => {
    if (!statusTrade || !statusChoice) return;
    setStatusSaving(true);
    const reward = statusChoice === 'Win' ? Math.max(0.1, Number(statusR) || 2) : statusChoice === 'Loss' ? -1 : 0;
    let { data, error } = await supabase.from('trade_logs').update({ result: statusChoice, reward_r: reward }).eq('id', statusTrade.id).select('*').single();

    if (error && /reward_r|schema cache/i.test(error.message)) {
      const fallbackNotes = encodeFallbackMeta(statusTrade.notes, statusChoice, reward);
      const fallback = await supabase.from('trade_logs').update({ result: statusChoice, notes: fallbackNotes }).eq('id', statusTrade.id).select('*').single();
      data = fallback.data;
      error = fallback.error;
    }

    setStatusSaving(false);
    if (error) {
      toast.error('Gagal memperbarui status: ' + error.message);
      return;
    }

    setSaved((prev) => prev.map((trade) => trade.id === statusTrade.id ? normalizeTradeLog({ ...data, reward_r: reward }) : trade));
    setStatusTrade(null);
    setStatusChoice(null);
    toast.success(`Status diperbarui menjadi ${statusChoice}.`);
  };

  const deleteSaved = async (id: string) => {
    if (deletingTrades.has(id)) return;
    setDeletingTrades((prev) => new Set(prev).add(id));
    const { error } = await supabase.from('trade_logs').delete().eq('id', id);
    if (error) {
      setDeletingTrades((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast.error('Gagal menghapus: ' + error.message);
      return;
    }
    toast.success('Trade berhasil dihapus', { description: 'Data telah dihapus dari Trade Log.' });
    window.setTimeout(() => {
      setSaved((prev) => prev.filter((trade) => trade.id !== id));
      setDeletingTrades((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 450);
  };

  const openModal = (url: string | null) => {
    setModalUrl(url);
    setModalOpen(true);
  };

  const toggleMonth = (key: string) => {
    setOpenMonths((current) => current.includes(key) ? current.filter((month) => month !== key) : [...current, key]);
  };

  return (
    <div className="space-y-5">
      <Toaster richColors theme="dark" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Trading Journal</h1>
          <p className="mt-1 text-sm font-bold text-white">Catat trade, buka riwayat per bulan, dan export jurnal kapan saja.</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            onClick={() => exportAll(saved)}
            variant="outline"
            className="border-yellow-400 bg-black font-black text-yellow-400 hover:bg-yellow-400 hover:text-black"
          >
            <FileSpreadsheetIcon className="mr-1.5 h-4 w-4" />
            Export Semua Data
          </Button>
          <Button onClick={addRow} className="bg-yellow-400 font-black text-black hover:bg-yellow-300">
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Tambah Baris
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border-2 border-yellow-400 bg-zinc-950">
          <Table className="min-w-[900px] border-collapse">
            <TableHeader>
              <TableRow className="border-zinc-700 hover:bg-transparent">
                {['Tanggal', 'Koin', 'Pola / Setup', 'Posisi', 'Hasil', 'Reward Ratio (R)', 'Screenshot', 'Aksi'].map((head) => (
                  <TableHead key={head} className="h-10 border border-zinc-700 px-1.5 text-center text-xs font-black uppercase tracking-wider text-yellow-400">{head}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <DraftTableRow key={row.id} row={row} updateRow={updateRow} saveRow={saveRow} removeRow={removeRow} saving={savingRows.has(row.id)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Trade Log per Bulan</h2>
            <p className="text-sm font-bold text-white">Klik header bulan untuk expand/collapse. Bulan terbaru terbuka otomatis.</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-10 text-center text-sm font-black text-white">Memuat data...</div>
        ) : groupedMonths.length === 0 ? (
          <div className="rounded-xl border-2 border-zinc-800 bg-zinc-950 p-10 text-center">
            <p className="text-sm font-black text-white">Belum ada trade log.</p>
            <p className="mt-1 text-xs font-bold text-white">Klik "Tambah Baris" untuk mencatat trade pertama Anda.</p>
          </div>
        ) : (
          groupedMonths.map(([key, monthTrades]) => {
            const stats = computeStats(monthTrades);
            const coins = Array.from(new Set(monthTrades.map((trade) => trade.coin))).sort();
            const isOpen = openMonths.includes(key);
            const monthName = monthLabel(key);

            return (
              <div key={key} className="overflow-hidden rounded-xl border-2 border-zinc-800 bg-zinc-900">
                <div className="flex items-stretch gap-2 border-b border-zinc-800 bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => toggleMonth(key)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-zinc-800"
                    aria-expanded={isOpen}
                  >
                    <div className="min-w-0">
                      <h3 className="text-base font-black capitalize text-white">{monthName}</h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-black text-white">
                        <span>Total Trade: {stats.total}</span>
                        <span>Win Rate: {stats.winRate.toFixed(1)}%</span>
                        <span className={stats.totalR >= 0 ? 'text-emerald-400' : 'text-red-400'}>Total R:R: {formatR(stats.totalR)}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] font-bold text-white">Koin: {coins.length ? coins.join(', ') : '-'}</p>
                    </div>
                    <ChevronDownIcon className={cn('h-5 w-5 shrink-0 text-yellow-400 transition-transform duration-300', isOpen && 'rotate-180')} />
                  </button>

                  <Button
                    type="button"
                    onClick={() => exportMonth(monthTrades, key)}
                    className="my-2 mr-2 shrink-0 self-center bg-yellow-400 px-3 font-black text-black hover:bg-yellow-300"
                    title={`Export ${monthName}`}
                  >
                    <DownloadIcon className="mr-1.5 h-4 w-4" />
                    <span className="hidden sm:inline">Export Excel</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                </div>

                <div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="border-t-2 border-zinc-800 p-2 sm:p-3">
                      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <Mini label="Total Trade" value={stats.total} />
                        <Mini label="Win" value={stats.wins} valueClass="text-emerald-400" />
                        <Mini label="Loss" value={stats.losses} valueClass="text-red-400" />
                        <Mini label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
                        <Mini label="Total R:R" value={formatR(stats.totalR)} valueClass={stats.totalR >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                      </div>

                      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Mini label="Average R:R" value={`${formatR(stats.averageR)} / trade`} valueClass={stats.averageR >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                        <Mini label="Koin Ditradingkan" value={coins.length ? coins.join(' · ') : '-'} valueClass="text-white" />
                      </div>

                      <TradeTable trades={monthTrades} onOpenChart={openModal} onEditStatus={openStatusEditor} onDelete={deleteSaved} deletingTrades={deletingTrades} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <p className="text-xs font-bold text-white">
        Tip: Tempel URL chart TradingView pada saat input. Klik thumbnail untuk melihat ukuran penuh.
      </p>

      <Dialog open={!!statusTrade} onOpenChange={(open) => { if (!open) { setStatusTrade(null); setStatusChoice(null); } }}>
        <DialogContent className="border-2 border-yellow-400 bg-black text-white">
          <DialogHeader>
            <DialogTitle className="font-black text-white">Edit Status Hasil</DialogTitle>
            <DialogDescription className="font-bold text-white">Pilih hasil akhir untuk trade {statusTrade?.coin}. Running tidak masuk Win Rate, Win/Loss, atau akumulasi R sampai diselesaikan.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(['Win', 'Loss', 'BE'] as const).map((choice) => (
              <Button key={choice} type="button" onClick={() => applyStatusChoice(choice)} className={cn('font-black', statusChoice === choice ? 'bg-yellow-400 text-black' : 'border border-zinc-700 bg-zinc-950 text-white hover:border-yellow-400')} variant={statusChoice === choice ? 'default' : 'outline'}>{choice}</Button>
            ))}
          </div>
          {statusChoice === 'Win' && <div className="rounded-lg border-2 border-yellow-400 bg-zinc-950 p-3">
            <label className="mb-1 block text-xs font-black uppercase text-yellow-400">Reward Ratio (R)</label>
            <Input autoFocus type="number" min="0.1" step="0.1" value={statusR} onChange={(e) => setStatusR(e.target.value)} className="border-zinc-700 bg-black font-black text-white" />
            <p className="mt-1 text-xs font-bold text-white">Contoh: 2R, 3R, 4.5R</p>
          </div>}
          {statusChoice === 'Loss' && <p className="rounded-lg border border-red-500 bg-red-500/10 p-3 font-black text-red-400">Loss akan otomatis dicatat sebagai -1R.</p>}
          {statusChoice === 'BE' && <p className="rounded-lg border border-yellow-400 bg-yellow-400/10 p-3 font-black text-yellow-400">BE akan otomatis dicatat sebagai 0R.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusTrade(null)} className="border-zinc-700 bg-black font-black text-white">Batal</Button>
            <Button type="button" disabled={!statusChoice || statusSaving} onClick={saveStatus} className="bg-yellow-400 font-black text-black hover:bg-yellow-300">{statusSaving ? 'Menyimpan...' : 'Simpan Status'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScreenshotModal url={modalUrl} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}

function DraftTableRow({ row, updateRow, saveRow, removeRow, saving }: { row: DraftRow; updateRow: (id: string, patch: Partial<DraftRow>) => void; saveRow: (row: DraftRow) => void; removeRow: (id: string) => void; saving: boolean }) {
  return (
    <TableRow className={cn('border-zinc-800 bg-yellow-400/[0.03] hover:bg-yellow-400/[0.06]', saving && 'animate-trade-success') }>
      <TableCell className="border border-zinc-700 px-1 py-1 text-center"><Input type="date" value={row.trade_date} onChange={(e) => updateRow(row.id, { trade_date: e.target.value })} className="mx-auto h-9 w-[150px] border-zinc-700 bg-zinc-950 text-center text-white" /></TableCell>
      <TableCell className="border border-zinc-700 px-1 py-1 text-center"><CoinCombobox value={row.coin} onChange={(v) => updateRow(row.id, { coin: v })} /></TableCell>
      <TableCell className="border border-zinc-700 px-1 py-1 text-center"><div className="min-w-[220px]"><PatternMultiSelect value={row.patterns} onChange={(v) => updateRow(row.id, { patterns: v })} /></div></TableCell>
      <TableCell className="border border-zinc-700 px-1 py-1 text-center"><Select value={row.position} onValueChange={(v: 'Long' | 'Short') => updateRow(row.id, { position: v })}><SelectTrigger className="mx-auto h-9 w-[110px] border-zinc-700 bg-zinc-950 text-center text-white"><SelectValue /></SelectTrigger><SelectContent className="border-zinc-700 bg-zinc-900 text-white"><SelectItem value="Long">Long</SelectItem><SelectItem value="Short">Short</SelectItem></SelectContent></Select></TableCell>
      <TableCell className="border border-zinc-700 px-1 py-1 text-center"><Select value={row.result} onValueChange={(v: 'Running' | 'Win' | 'Loss' | 'BE') => updateRow(row.id, { result: v, reward_r: v === 'Win' ? (row.reward_r > 0 ? row.reward_r : 2) : v === 'Loss' ? -1 : 0 })}><SelectTrigger className="mx-auto h-9 w-[115px] border-zinc-700 bg-zinc-950 text-center text-white"><SelectValue /></SelectTrigger><SelectContent className="border-zinc-700 bg-zinc-900 text-white"><SelectItem value="Running">⏳ Running / Pending</SelectItem><SelectItem value="Win">Win</SelectItem><SelectItem value="Loss">Loss</SelectItem><SelectItem value="BE">BE</SelectItem></SelectContent></Select></TableCell>
      <TableCell className="border border-zinc-700 px-1 py-1 text-center"><Input type="number" min="0.1" step="0.1" disabled={row.result !== 'Win'} value={row.result === 'Win' ? row.reward_r : row.result === 'Loss' ? -1 : 0} onChange={(e) => updateRow(row.id, { reward_r: Math.max(0.1, Number(e.target.value) || 2) })} className="mx-auto h-9 w-[110px] border-zinc-700 bg-zinc-950 text-center text-white disabled:cursor-not-allowed disabled:opacity-100" /></TableCell>
      <TableCell className="border border-zinc-700 px-1 py-1 text-center"><Input type="url" placeholder="Tempel URL gambar..." value={row.screenshot_url} onChange={(e) => updateRow(row.id, { screenshot_url: e.target.value })} className="mx-auto h-9 w-[220px] border-zinc-700 bg-zinc-950 text-center text-white placeholder:text-white" /></TableCell>
      <TableCell className="sticky right-0 z-10 border border-zinc-700 bg-zinc-950 px-1 py-1 text-center shadow-[-8px_0_12px_rgba(0,0,0,0.8)]"><div className="flex min-w-[120px] items-center justify-center gap-1"><Button size="sm" disabled={saving} onClick={() => saveRow(row)} className="h-8 min-w-[72px] bg-yellow-400 px-2.5 text-xs font-black text-black hover:bg-yellow-300">{saving ? '✓ Tersimpan' : 'Simpan'}</Button><Button size="sm" variant="ghost" onClick={() => removeRow(row.id)} className="h-8 px-2 text-white hover:bg-red-500/10 hover:text-red-400"><TrashIcon className="h-4 w-4" /></Button></div></TableCell>
    </TableRow>
  );
}

function TradeTable({ trades, onOpenChart, onEditStatus, onDelete, deletingTrades }: { trades: TradeLog[]; onOpenChart: (url: string | null) => void; onEditStatus: (trade: TradeLog) => void; onDelete: (id: string) => void; deletingTrades: Set<string> }) {
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-zinc-800">
      <Table className="min-w-[900px] border-collapse">
        <TableHeader>
          <TableRow className="border-zinc-700 hover:bg-transparent">
            {['Tanggal', 'Koin', 'Pola / Setup', 'Posisi', 'Hasil', 'Reward Ratio (R)', 'Screenshot', 'Aksi'].map((head) => (
              <TableHead key={head} className="h-9 border border-zinc-700 bg-zinc-950 px-1.5 text-center text-[11px] font-black uppercase text-yellow-400">{head}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => (
            <TableRow key={trade.id} className={cn('border-zinc-800 hover:bg-zinc-900/70', deletingTrades.has(trade.id) && 'animate-trade-delete')}>
              <TableCell className="border border-zinc-700 px-1.5 py-1.5 text-center text-xs font-bold text-white">{trade.trade_date}</TableCell>
              <TableCell className="border border-zinc-700 px-1.5 py-1.5 text-center text-xs font-black text-white">{trade.coin}</TableCell>
              <TableCell className="border border-zinc-700 px-1.5 py-1.5 text-center"><div className="mx-auto flex max-w-[300px] flex-wrap justify-center gap-1">{trade.patterns.map((pattern) => <span key={pattern} className="inline-flex rounded border border-yellow-400/30 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-black text-yellow-400">{pattern}</span>)}</div></TableCell>
              <TableCell className="border border-zinc-700 px-1.5 py-1.5 text-center"><span className={cn('inline-flex rounded px-2 py-0.5 text-[11px] font-black', trade.position === 'Long' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>{trade.position}</span></TableCell>
              <TableCell className="border border-zinc-700 px-1.5 py-1.5 text-center"><div className="flex items-center justify-center gap-1.5"><span className={cn('inline-flex rounded px-2 py-1 text-[11px] font-black', trade.result === 'Running' && 'border border-yellow-400 bg-yellow-400/15 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.35)]', trade.result === 'Win' && 'bg-emerald-500/15 text-emerald-400', trade.result === 'Loss' && 'bg-red-500/15 text-red-400', trade.result === 'BE' && 'bg-yellow-400/15 text-yellow-400')}>{trade.result === 'Running' ? '⏳ Running' : trade.result}</span><Button size="sm" variant="ghost" onClick={() => onEditStatus(trade)} className="h-7 px-1.5 font-black text-yellow-400 hover:bg-yellow-400/10 hover:text-yellow-300"><Pencil1Icon className="h-3.5 w-3.5" /><span className="sr-only">Edit Status</span></Button></div></TableCell>
              <TableCell className={cn('border border-zinc-700 px-1.5 py-1.5 text-center text-xs font-black', Number(trade.reward_r) > 0 ? 'text-emerald-400' : Number(trade.reward_r) < 0 ? 'text-red-400' : 'text-yellow-400')}>{formatR(Number(trade.reward_r ?? 0))}</TableCell>
              <TableCell className="border border-zinc-700 px-1.5 py-1.5 text-center"><div className="flex w-full items-center justify-center"><ScreenshotThumbnail url={trade.screenshot_url} onClick={() => onOpenChart(trade.screenshot_url)} /></div></TableCell>
              <TableCell className="sticky right-0 z-10 border border-zinc-700 bg-zinc-950 px-1.5 py-1.5 text-center shadow-[-8px_0_12px_rgba(0,0,0,0.8)]"><Button size="sm" disabled={deletingTrades.has(trade.id)} variant="ghost" onClick={() => onDelete(trade.id)} className="h-7 min-w-[42px] px-2 text-white hover:bg-red-500/10 hover:text-red-400">{deletingTrades.has(trade.id) ? '✓' : <TrashIcon className="h-3.5 w-3.5" />}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
