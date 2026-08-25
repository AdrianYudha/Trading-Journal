import { supabase } from './supabase';

export type Profile = {
  id: string;
  username: string;
  role: 'admin' | 'student';
  created_at: string;
};

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@tradejournal.local`;

const normalizeUsername = (username: string) => username.trim().toLowerCase();

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, role, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Profile;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user || authData.user.id !== userId) return null;

  const fallbackUsername = normalizeUsername(
    authData.user.user_metadata?.username || authData.user.email?.split('@')[0] || 'user'
  );

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({ id: userId, username: fallbackUsername })
    .select('id, username, role, created_at')
    .single();

  if (createError) {
    if (createError.code === '23505') {
      const retry = await supabase
        .from('profiles')
        .select('id, username, role, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (retry.error) throw retry.error;
      return retry.data as Profile | null;
    }
    throw createError;
  }
  return created as Profile;
}

export async function login(username: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
}

export async function register(username: string, password: string) {
  const cleanUsername = normalizeUsername(username);
  const email = usernameToEmail(cleanUsername);

  // Registration intentionally uses the normal Supabase Auth API so the app
  // does not depend on a separately deployed Edge Function. The hosted
  // Supabase project must have email confirmation disabled because this app
  // uses an internal username@tradejournal.local identity and the product
  // requirement is username/password with no email verification.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: cleanUsername },
      emailRedirectTo: undefined,
    },
  });

  if (error) return { data, error };

  // With email confirmation disabled, Supabase returns a session immediately.
  // The database trigger creates the profile and assigns the first account
  // as admin; later accounts are students.
  if (!data.user) {
    return { data, error: new Error('Supabase tidak mengembalikan user. Periksa konfigurasi Authentication.') };
  }

  if (!data.session) {
    return {
      data,
      error: new Error('Registrasi berhasil dibuat, tetapi sesi belum aktif. Di Supabase buka Authentication → Settings → Email dan matikan Confirm email agar username/password bisa langsung digunakan tanpa verifikasi email.'),
    };
  }

  return { data, error: null };
}
