# Running / Pending + Quick Edit Status

Fitur baru:
- Trade baru default ke `Running / Pending`.
- Running tidak dihitung sebagai Win, Loss, Win Rate, atau R:R settled.
- Quick Edit pada kolom Hasil memungkinkan perubahan langsung ke Win/Loss/BE.
- Win meminta Reward Ratio R; Loss otomatis -1R; BE otomatis 0R.
- Dashboard dan kalender menghitung ulang berdasarkan data terbaru saat dashboard dimuat kembali.

## Supabase
Jalankan migration baru:
`supabase/migrations/20260824180000_running_pending_outcome.sql`

Migration ini harus dijalankan setelah migration `20260824174500_reward_r.sql`.
