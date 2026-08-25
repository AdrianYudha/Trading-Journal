import * as React from 'react';
import { CheckIcon, ChevronDownIcon, PlusCircledIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PATTERN_OPTIONS } from '@/lib/supabase';

const CUSTOM_PATTERN_STORAGE_KEY = 'trade-journal-custom-patterns';

function readCustomPatterns(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PATTERN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string' && p.trim().length > 0) : [];
  } catch {
    return [];
  }
}

interface PatternMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

export function PatternMultiSelect({ value, onChange, className }: PatternMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [customPatterns, setCustomPatterns] = React.useState<string[]>(readCustomPatterns);

  const allPatterns = React.useMemo(
    () => Array.from(new Set([...PATTERN_OPTIONS, ...customPatterns])),
    [customPatterns]
  );

  const normalizedSearch = search.trim();
  const exactExists = allPatterns.some((pattern) => pattern.toLowerCase() === normalizedSearch.toLowerCase());

  const toggle = (pattern: string) => {
    if (value.includes(pattern)) {
      onChange(value.filter((p) => p !== pattern));
    } else {
      onChange([...value, pattern]);
    }
  };

  const addCustomPattern = () => {
    const pattern = normalizedSearch.replace(/\s+/g, ' ').trim();
    if (!pattern || exactExists) return;

    const next = [...customPatterns, pattern];
    setCustomPatterns(next);
    localStorage.setItem(CUSTOM_PATTERN_STORAGE_KEY, JSON.stringify(next));
    onChange([...value, pattern]);
    setSearch('');
  };

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      {value.map((p) => (
        <span
          key={p}
          className="inline-flex items-center gap-1 rounded-md border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-xs font-medium text-yellow-400"
        >
          {p}
          <button
            type="button"
            onClick={() => toggle(p)}
            className="rounded-sm text-yellow-400/80 transition-colors hover:text-yellow-400"
          >
            <Cross2Icon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-zinc-700 px-2 py-1 text-xs font-bold text-white transition-colors hover:border-yellow-400/60 hover:text-yellow-400"
          >
            <PlusCircledIcon className="h-3.5 w-3.5" />
            {value.length === 0 ? 'Pilih pola...' : 'Tambah pola'}
            <ChevronDownIcon className="h-3 w-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] border-zinc-700 bg-zinc-900 p-0" align="center">
          <Command className="bg-transparent">
            <CommandInput value={search} onValueChange={setSearch} placeholder="Cari pola atau buat pola baru..." className="text-white" />
            <CommandList>
              <CommandEmpty className="py-3 text-center text-sm font-bold text-white">Pola tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                {normalizedSearch && !exactExists && (
                  <CommandItem
                    value={`__add__${normalizedSearch}`}
                    onSelect={addCustomPattern}
                    className="font-black text-yellow-400 data-[selected=true]:bg-yellow-400 data-[selected=true]:text-black"
                  >
                    + Gunakan pola: {normalizedSearch}
                  </CommandItem>
                )}
                {allPatterns.map((pattern) => {
                  const selected = value.includes(pattern);
                  return (
                    <CommandItem
                      key={pattern}
                      value={pattern}
                      onSelect={() => toggle(pattern)}
                      className="text-white data-[selected=true]:bg-yellow-400/15 data-[selected=true]:text-yellow-400"
                    >
                      <span className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                        selected ? 'border-yellow-400 bg-yellow-400 text-black' : 'border-zinc-600 opacity-50'
                      )}>
                        {selected && <CheckIcon className="h-3 w-3" />}
                      </span>
                      {pattern}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
