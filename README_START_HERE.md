# Trading Journal — Multi User + Admin + Calendar Update

Versi ini mempertahankan fitur Multi-User/Admin/Supabase yang sudah ada dan menambahkan:

- Grouping Trade Log per bulan dengan accordion/FAQ style.
- Ringkasan setiap bulan: Total Trade, Win Rate, dan daftar koin.
- Tabel transaksi di dalam setiap bulan.
- Trading Calendar / Heatmap bulanan.
- Hijau = dominan Win, merah = dominan Loss, abu-abu = No Trade, kuning = Win/Loss seimbang.
- Klik tanggal kalender untuk memfilter transaksi pada tanggal tersebut.
- Tombol hapus filter untuk kembali melihat semua trade.
- Preview chart TradingView tetap tersedia di tabel.
- Tema tetap pure black + yellow #FACC15 + white/high-contrast text.
- Login/register, RLS, admin dashboard, reset password, tambah/hapus murid, dan evaluasi murid tetap dipertahankan.

## Jalankan lokal

```bash
npm install
npm run dev
```

Kemudian buka URL localhost yang ditampilkan Vite.

## Supabase

Gunakan konfigurasi `.env` yang sudah ada atau isi:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

Tidak ada migration database baru untuk fitur calendar/grouping karena fitur tersebut membaca `trade_logs` yang sudah ada.

## Catatan

Validasi build penuh membutuhkan dependency npm ter-install. Pada environment pembuatan ZIP ini dependency tidak tersedia, sehingga `npm install` perlu dijalankan di komputer sebelum `npm run build`/`npm run dev`.


## Risk to Reward (R:R)

Versi ini menambahkan kolom `Reward Ratio (R)` pada trade log.
- Win: input R, default `2R`.
- Loss: otomatis `-1R`.
- BE: otomatis `0R`.
- Dashboard menampilkan Total R:R dan Average R:R.
- Accordion bulanan menampilkan Total R:R dan Average R:R.

Setelah memperbarui project, jalankan migration baru `supabase/migrations/20260824174500_reward_r.sql` di Supabase SQL Editor. Migration ini aman untuk data lama dan otomatis menormalkan Loss/BE menjadi -1R/0R.
