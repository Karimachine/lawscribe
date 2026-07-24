import { createClient } from '@supabase/supabase-js';

let cachedClient;

export function getSupabaseAdmin() {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cachedClient = url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;
  return cachedClient;
}

export async function getUserFromToken(supabase, authHeader) {
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
