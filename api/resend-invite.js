// Vercel serverless function (Node runtime).
//
// Privileged action: lets an admin re-send access to an existing client
// whose original invite link expired (or who just needs a fresh one).
// If they've never completed their first login, this resends the invite
// email (fresh token, fresh expiry). If they've already logged in before,
// there's no "invite" left to resend, so this sends a fresh magic link
// instead — both use Supabase's own built-in email, no extra secrets.
//
// Requires SUPABASE_SERVICE_ROLE_KEY as a server-only env var in Vercel —
// never expose this key to the browser.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xuakbcycbugnepdqkgpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1YWtiY3ljYnVnbmVwZHFrZ3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mjc1MjYsImV4cCI6MjEwNDAwMzUyNn0.Csw0yaLJkQDbk9RjT7aT3EeaJjNOc3mncBeHt3yb3J8';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REDIRECT_TO = 'https://www.lmagency.work/login';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
    res.status(500).json({ error: 'Server is not configured' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!callerToken) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const { client_id } = req.body || {};
  if (!client_id) {
    res.status(400).json({ error: 'client_id is required' });
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Verify the caller's JWT and confirm they're an agency admin.
  const { data: { user: caller }, error: callerError } = await admin.auth.getUser(callerToken);
  if (callerError || !caller) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const { data: adminRow, error: adminError } = await admin
    .from('agency_admins')
    .select('user_id')
    .eq('user_id', caller.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  // 2. Load the client's auth account.
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(client_id);
  if (userError || !userData?.user?.email) {
    res.status(404).json({ error: 'Client account not found' });
    return;
  }

  const clientEmail = userData.user.email;
  const alreadyConfirmed = !!userData.user.email_confirmed_at;

  // 3. If they've never completed their first login, try resending the
  // invite itself (fresh token, fresh expiry). Otherwise — or if that
  // fails for any reason — fall back to a plain magic link, which works
  // for any existing account.
  if (!alreadyConfirmed) {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(clientEmail, {
      redirectTo: REDIRECT_TO,
    });
    if (!inviteError) {
      res.status(200).json({ ok: true, sent: 'invite' });
      return;
    }
    console.warn('Invite resend failed, falling back to magic link:', inviteError.message);
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: otpError } = await anon.auth.signInWithOtp({
    email: clientEmail,
    options: { emailRedirectTo: REDIRECT_TO },
  });

  if (otpError) {
    console.error(otpError);
    res.status(502).json({ error: otpError.message || 'Failed to send login link' });
    return;
  }

  res.status(200).json({ ok: true, sent: 'magiclink' });
};
