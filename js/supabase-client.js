// =============================================================
// LMagency — shared Supabase client + small auth helpers
// Loaded as an ES module by apply.js / login.js / portal.js / admin.js
// =============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://xuakbcycbugnepdqkgpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YWtiY3ljYnVnbmVwZHFrZ3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mjc1MjYsImV4cCI6MjEwNDAwMzUyNn0.Csw0yaLJkQDbk9RjT7aT3EeaJjNOc3mncBeHt3yb3J8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Resolves the current session's user, or null if signed out. */
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/** Checks agency_admins membership for the current user. */
export async function isAgencyAdmin(userId) {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('agency_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('isAgencyAdmin check failed:', error.message);
    return false;
  }
  return !!data;
}

/** Sends the signed-in user to wherever they belong: admin dashboard or client portal. */
export async function routeAfterLogin() {
  const user = await getCurrentUser();
  if (!user) return;
  const admin = await isAgencyAdmin(user.id);
  window.location.href = admin ? '/admin' : '/portal';
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login';
}
