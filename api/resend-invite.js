// Vercel serverless function (Node runtime).
//
// Privileged action: lets an admin re-send access to an existing client
// whose original invite link expired (or who just needs a fresh one).
// If they've never completed their first login, this resends the invite
// email (fresh token, fresh expiry). If they've already logged in before,
// there's no "invite" left to resend, so this sends a fresh magic link
// instead — both use Supabase's own built-in email, no extra secrets.
const { requireAdmin, getAnonClient } = require('./_lib/supabaseAdmin');

const REDIRECT_TO = 'https://www.lmagency.work/login';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { admin } = ctx;

  const { client_id } = req.body || {};
  if (!client_id) {
    res.status(400).json({ error: 'client_id is required' });
    return;
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(client_id);
  if (userError || !userData?.user?.email) {
    res.status(404).json({ error: 'Client account not found' });
    return;
  }

  const clientEmail = userData.user.email;
  const alreadyConfirmed = !!userData.user.email_confirmed_at;

  // If they've never completed their first login, try resending the
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

  const anon = getAnonClient();
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
