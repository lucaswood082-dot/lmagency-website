// Calls the send-notification-email Edge Function (accepted / declined /
// onboarding templates). Uses the anon key, matching the same auth
// pattern the applications-insert trigger already uses to call
// send-application-confirmation.
const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('./supabaseAdmin');

const NOTIFY_URL = `${SUPABASE_URL}/functions/v1/send-notification-email`;

async function sendNotificationEmail(type, businessName, contactEmail) {
  const res = await fetch(NOTIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type, business_name: businessName, contact_email: contactEmail }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error || `Failed to send ${type} email` };
  }
  return { ok: true };
}

module.exports = { sendNotificationEmail };
