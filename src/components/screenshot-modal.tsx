import * as React from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

async function resolvePreview(url: string): Promise<string | null> {
  if (!/^https:\/\/www\.tradingview\.com\/x\//i.test(url)) return url;
  const { data, error } = await supabase.functions.invoke('tradingview-preview', { body: { url } });
  return error || !data?.image_url ? null : data.image_url;
}

export function ScreenshotModal({ url, open, onOpenChange }: { url: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !url) return;
    setLoading(true);
    setPreview(null);
    resolvePreview(url).then(setPreview).finally(() => setLoading(false));
  }, [open, url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-zinc-800 bg-black p-2 text-white">
        <DialogTitle className="sr-only">Screenshot Chart</DialogTitle>
        <div className="flex flex-col gap-2">
          <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-md bg-zinc-950">
            {loading ? <p className="p-10 text-sm font-bold text-white">Memuat preview chart...</p> : preview ? <img src={preview} alt="Chart screenshot" className="max-h-[80vh] w-full object-contain" /> : <div className="p-10 text-center"><p className="text-sm font-bold text-white">Preview TradingView tidak tersedia.</p><p className="mt-1 text-xs text-white">Gunakan tombol di bawah untuk membuka snapshot asli.</p></div>}
          </div>
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <p className="max-w-[70%] truncate text-xs font-bold text-white">{url}</p>
            {url && <a href={url} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="border-yellow-400 bg-black font-black text-yellow-400 hover:bg-yellow-400 hover:text-black"><ExternalLinkIcon className="mr-1.5 h-3.5 w-3.5" />Open TradingView</Button></a>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ScreenshotThumbnail({ url, onClick }: { url: string | null; onClick: () => void }) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [errored, setErrored] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setErrored(false);
    if (!url) { setPreview(null); return; }
    resolvePreview(url).then((value) => { if (alive) setPreview(value); });
    return () => { alive = false; };
  }, [url]);

  if (!url) return <span className="text-xs font-bold text-white">—</span>;
  if (!preview || errored) return <button type="button" onClick={onClick} className="flex h-10 w-14 items-center justify-center rounded border border-yellow-400/50 bg-zinc-950 text-[10px] font-black text-yellow-400 hover:bg-yellow-400 hover:text-black" title="Buka snapshot TradingView">TV</button>;

  return <button type="button" onClick={onClick} className="group relative h-10 w-14 overflow-hidden rounded border border-zinc-700 hover:border-yellow-400 hover:ring-1 hover:ring-yellow-400" title="Klik untuk melihat gambar ukuran penuh">
    <img src={preview} alt="Chart thumbnail" className="h-full w-full object-cover" onError={() => setErrored(true)} />
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 text-[10px] font-black text-yellow-400 opacity-0 transition-opacity group-hover:opacity-100">View</span>
  </button>;
}
