import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const usernameEmail = (username: string) => `${username.trim().toLowerCase()}@tradejournal.local`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Invalid session' }, 401);

    const admin = createClient(url, serviceKey);
    const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (caller?.role !== 'admin') return json({ error: 'Admin role required' }, 403);

    const body = await req.json();
    const action = body.action as string;

    if (action === 'list_users') {
      const { data: profiles, error } = await admin.from('profiles').select('id, username, role, created_at').eq('role', 'student').order('created_at', { ascending: false });
      if (error) throw error;
      const students = await Promise.all((profiles || []).map(async (p) => {
        const { count, error: countError } = await admin.from('trade_logs').select('id', { count: 'exact', head: true }).eq('user_id', p.id);
        if (countError) throw countError;
        return { ...p, total_trades: count || 0 };
      }));
      return json({ students });
    }

    if (action === 'create_user') {
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return json({ error: 'Username tidak valid' }, 400);
      if (password.length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email: usernameEmail(username), password, email_confirm: true, user_metadata: { username } });
      if (error) throw error;
      return json({ user_id: data.user?.id });
    }

    if (action === 'reset_password') {
      const password = String(body.password || '');
      if (password.length < 6) return json({ error: 'Password minimal 6 karakter' }, 400);
      const { error } = await admin.auth.admin.updateUserById(String(body.user_id), { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'delete_user') {
      const targetId = String(body.user_id);
      const { data: target } = await admin.from('profiles').select('role').eq('id', targetId).single();
      if (target?.role === 'admin') return json({ error: 'Akun admin tidak dapat dihapus dari dashboard murid.' }, 400);
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'get_user_trades') {
      const targetId = String(body.user_id);
      const { data, error } = await admin.from('trade_logs').select('*').eq('user_id', targetId).order('trade_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return json({ trades: data || [] });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
