# Trading Journal — Public Mode

Login/Register telah dihapus sesuai permintaan. Website langsung membuka Trade Journal.

## Jalankan

```bash
npm install
npm run dev
```

## Supabase

Jalankan migration `20260824190000_public_mode.sql` setelah migration sebelumnya. Migration ini membuka CRUD `trade_logs` untuk role `anon`, sehingga tidak diperlukan akun/login.

> Catatan: mode ini bukan lagi isolasi multi-user. Semua pengunjung menggunakan jurnal/database yang sama.
