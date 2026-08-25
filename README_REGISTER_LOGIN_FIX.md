# REGISTER & LOGIN FIX

Masalah sebelumnya: tombol Register memanggil Edge Function `register-user`, tetapi folder function belum ada di project sehingga akun tidak pernah dibuat. Akibatnya Login selalu `Invalid login credentials`.

## 1. Deploy migration
Di Supabase SQL Editor, jalankan migration secara berurutan seperti biasa.

## 2. Deploy Edge Function register-user
Pastikan Supabase CLI sudah login, lalu dari folder `project` jalankan:

```bash
supabase functions deploy register-user --no-verify-jwt
```

## 3. Set Service Role secret
Di Supabase Dashboard → Edge Functions → Secrets, buat:

`SUPABASE_SERVICE_ROLE_KEY`

Isi dengan **service_role key** project Supabase kamu. Jangan pernah memasukkan key ini ke `.env` frontend atau Git.

## 4. Tidak ada verifikasi email
Function `register-user` membuat user dengan `email_confirm: true`, sehingga user tidak perlu membuka email, OTP, atau verifikasi email.

## 5. Login
Username `adrian` akan dipetakan ke:

`adrian@tradejournal.local`

Jadi pengguna tetap login memakai username + password.

## 6. Jika Login tetap Invalid
Pastikan user memang sudah muncul di Supabase → Authentication → Users. Jika belum muncul, deploy function di langkah 2 dan coba Register lagi.

## 7. Jalankan frontend
```bash
npm install
npm run dev
```
