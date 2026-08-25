# Monthly Accordion + Export

Versi ini menambahkan pengelompokan Trade Log per bulan pada halaman Journal.

- Bulan terbaru terbuka otomatis.
- Bulan lain tertutup sampai diklik.
- Ringkasan bulan: Total Trade, Win Rate, Total R:R, dan koin.
- Tombol Export Excel pada setiap bulan menghasilkan CSV yang kompatibel dengan Excel.
- Tombol Export Semua Data menghasilkan seluruh jurnal.
- Nama file bulanan: `Trade_Journal_NamaBulan_Tahun.csv`.
- Tidak membutuhkan migration Supabase baru.

CSV memakai BOM UTF-8 supaya karakter Indonesia dan simbol R terbaca baik saat dibuka di Excel.
