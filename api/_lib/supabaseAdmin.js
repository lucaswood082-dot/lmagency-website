// Shared helpers for the admin-only Vercel functions under /api.
// Not itself a route — files under an `_`-prefixed folder are excluded
// from Vercel's file-system routing.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xuakbcycbugnepdqkgpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YWtiY3ljYnVnbmVwZHFrZ3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mjc1MjYsImV4cCI6MjEwNDAwMzUyNn0.Csw0yaLJkQDbk9RjT7aT3EeaJjNOc3mncBeHt3yb3J8';

function getServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Verifies the request carries a valid session for a signed-in agency
 * admin. On success, resolves { admin, caller }. On failure, writes the
 * appropriate error response itself and resolves null — callers should
 * just `return` when they get null back.
 */
async function requireAdmin(req, res) {
  const admin = getServiceRoleClient();
  if (!admin) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
    res.status(500).json({ error: 'Server is not configured' });
    return null;
  }

  const authHeader = req.headers.authorization || '';
  const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!callerToken) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return null;
  }

  const { data: { user: caller }, error: callerError } = await admin.auth.getUser(callerToken);
  if (callerError || !caller) {
    res.status(401).json({ error: 'Invalid session' });
    return null;
  }

  const { data: adminRow, error: adminError } = await admin
    .from('agency_admins')
    .select('user_id')
    .eq('user_id', caller.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }

  return { admin, caller };
}

module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY, getServiceRoleClient, getAnonClient, requireAdmin };
