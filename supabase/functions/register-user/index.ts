import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { username, password } = await req.json();
    const cleanUsername = String(username ?? '').trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      return json({ error: 'Username 3–30 karakter: huruf, angka, titik, underscore, atau strip.' }, 400);
    }
    if (typeof password !== 'string' || password.length < 6) {
      return json({ error: 'Password minimal 6 karakter.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Server Supabase belum dikonfigurasi. Set SUPABASE_SERVICE_ROLE_KEY pada Edge Function.' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `${cleanUsername}@tradejournal.local`;

    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (profileError) return json({ error: profileError.message }, 500);
    if (existingProfile) return json({ error: 'Username sudah terdaftar.' }, 409);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername },
    });

    if (createError) {
      const msg = createError.message.toLowerCase().includes('already')
        ? 'Username sudah terdaftar.'
        : createError.message;
      return json({ error: msg }, 400);
    }

    if (!created.user) return json({ error: 'Gagal membuat akun.' }, 500);

    // The database trigger normally creates this profile. This explicit upsert
    // also makes registration robust if the trigger was not installed yet.
    const { error: upsertError } = await admin.from('profiles').upsert({
      id: created.user.id,
      username: cleanUsername,
    }, { onConflict: 'id' });

    if (upsertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: `Profile gagal dibuat: ${upsertError.message}` }, 500);
    }

    return json({ ok: true, user_id: created.user.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan saat register.' }, 500);
  }
});
