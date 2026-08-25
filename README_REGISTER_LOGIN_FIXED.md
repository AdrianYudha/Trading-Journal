# FIX LOGIN & REGISTER — TANPA EDGE FUNCTION

Versi ini tidak memerlukan Edge Function `register-user` untuk register.

## 1. Jalankan project

```bash
npm install
npm run dev
```

## 2. Supabase — wajib sekali

Buka Supabase Dashboard → Authentication → Providers → Email.

Pastikan **Confirm email / Email confirmations** dimatikan.

Alasannya: aplikasi ini memang menggunakan username + password tanpa OTP dan tanpa verifikasi email. Username dipetakan menjadi email internal:

`username@tradejournal.local`

Alamat ini hanya identitas teknis untuk Supabase Auth dan tidak perlu menerima email.

## 3. Jalankan migration

Di SQL Editor jalankan migration di folder `supabase/migrations` secara berurutan, terutama:

- `20260824163000_multi_user_auth.sql`
- `20260824173400_auth_admin_registration.sql`
- `20260824174500_reward_r.sql`
- `20260824180000_running_pending_outcome.sql`

## 4. Register

Contoh:

Username: `adrian`
Password: `12345678`

Setelah register berhasil, akun langsung mendapatkan session dan masuk ke aplikasi. Tidak ada Edge Function yang diperlukan.

## 5. Akun admin

Trigger database menjadikan akun pertama sebagai `admin`; akun berikutnya menjadi `student`.

Jika database sudah memiliki akun lama, migration memperbaiki profile dan memastikan ada admin.

## Jika login lama menampilkan Invalid login credentials

Pastikan username yang dipakai sama persis (huruf besar/kecil tidak masalah) dan akun tersebut memang ada di Supabase → Authentication → Users.

Jika akun sebelumnya dibuat oleh versi Edge Function yang gagal, hapus akun yang tidak lengkap dari Authentication → Users lalu Register ulang dari aplikasi.
