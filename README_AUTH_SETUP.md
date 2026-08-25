# Multi-User Trading Journal — Supabase Setup

Fitur yang ditambahkan:

- Login/register username + password tanpa OTP dan tanpa alamat email nyata.
- Isolasi `trade_logs` per `auth.uid()` dengan Supabase RLS.
- Role `admin` pada `profiles`.
- Route `/admin` terproteksi.
- Admin dapat melihat daftar murid, jumlah trade, menambah murid, reset password, menghapus murid, dan membuka mode evaluasi jurnal murid.
- Operasi admin yang membutuhkan service-role key dijalankan melalui Edge Function `admin-users`; service key tidak pernah dikirim ke browser.

## 1. Supabase Auth

Pada Supabase Dashboard, buka Authentication → Providers → Email.

Matikan **Confirm email** agar register langsung bisa login tanpa verifikasi email.

Aplikasi menggunakan email sintetis internal seperti `username@tradejournal.local`. Pengguna tidak diminta memasukkan email dan tidak ada email/OTP yang digunakan sebagai bagian dari UI.

## 2. Jalankan migration

Jalankan migration berikut di Supabase SQL Editor atau melalui Supabase CLI:

- `supabase/migrations/20260824163000_multi_user_auth.sql`

Migration ini membuat `profiles`, trigger pembuatan profile, menambahkan `user_id` ke `trade_logs`, dan mengganti policy RLS single-user menjadi policy per-user.

## 3. Buat akun admin pertama

1. Register akun pertama dari landing page aplikasi.
2. Setelah profile terbentuk, jalankan SQL:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE username = 'USERNAME_ADMIN';
```

Ganti `USERNAME_ADMIN` dengan username admin Anda.

## 4. Deploy Edge Function admin

```bash
supabase functions deploy admin-users
```

Edge Function menggunakan environment variable standar Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Service-role key hanya berada di environment Edge Function.

## 5. Jalankan aplikasi

```bash
npm install
npm run dev
```

Route utama:

- `/` — login/register dan aplikasi journal setelah login.
- `/admin` — dashboard admin.

### Catatan keamanan

Tombol **Login Sebagai Murid** di dashboard admin adalah mode evaluasi read-only: admin tetap berada pada sesi admin, tetapi jurnal milik murid yang dipilih dimuat melalui Edge Function yang memverifikasi role admin. Ini mencegah pengambilalihan sesi admin dan menjaga service-role key tetap server-side.
