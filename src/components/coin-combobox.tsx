import * as React from 'react';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { COIN_OPTIONS } from '@/lib/supabase';

interface CoinComboboxProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CoinCombobox({ value, onChange, className }: CoinComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white transition-colors hover:border-yellow-400/60 focus:outline-none focus:ring-1 focus:ring-yellow-400',
            className
          )}
        >
          <span className={cn('truncate', !value && 'text-white')}>
            {value ? value : 'Pilih koin...'}
          </span>
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 text-yellow-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] border-zinc-700 bg-zinc-900 p-0" align="start">
        <Command className="bg-transparent">
          <CommandInput value={search} onValueChange={setSearch} placeholder="Cari koin... (contoh ICP)" className="text-white" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-white">
              Koin tidak ditemukan di daftar.
            </CommandEmpty>
            <CommandGroup>
              {search.trim() && !COIN_OPTIONS.some((coin) => coin.toLowerCase() === search.trim().toLowerCase()) && (
                <CommandItem
                  value={search.trim().toUpperCase()}
                  keywords={[search.trim().toUpperCase()]}
                  onSelect={() => {
                    onChange(search.trim().toUpperCase().replace(/\s+/g, ''));
                    setOpen(false);
                    setSearch('');
                  }}
                  className="font-black text-yellow-400 data-[selected=true]:bg-yellow-400 data-[selected=true]:text-black"
                >
                  + Gunakan {search.trim().toUpperCase()}
                </CommandItem>
              )}
              {COIN_OPTIONS.map((coin) => (
                <CommandItem
                  key={coin}
                  value={coin}
                  onSelect={(current) => {
                    onChange(current === value ? '' : current);
                    setOpen(false);
                  }}
                  className="text-white data-[selected=true]:bg-yellow-400/15 data-[selected=true]:text-yellow-400"
                >
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === coin ? 'opacity-100 text-yellow-400' : 'opacity-0'
                    )}
                  />
                  {coin}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
