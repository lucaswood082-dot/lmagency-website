// Vercel serverless function (Node runtime).
//
// Privileged action: emails an accepted client the payment link, contract
// link, and next-steps text, then records onboarding_sent_at. Fails
// clearly (and does not record onboarding_sent_at) if the PAYMENT_LINK /
// CONTRACT_LINK secrets haven't been set yet on the edge function — see
// the TODO in supabase/functions/send-notification-email.
const { requireAdmin } = require('./_lib/supabaseAdmin');
const { sendNotificationEmail } = require('./_lib/notify');

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

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id, business_name')
    .eq('id', client_id)
    .maybeSingle();

  if (clientError || !client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(client_id);
  if (userError || !userData?.user?.email) {
    res.status(404).json({ error: 'Client account not found' });
    return;
  }

  const notify = await sendNotificationEmail('onboarding', client.business_name, userData.user.email);
  if (!notify.ok) {
    res.status(502).json({ error: notify.error });
    return;
  }

  const { error: updateError } = await admin
    .from('clients')
    .update({ onboarding_sent_at: new Date().toISOString() })
    .eq('id', client_id);

  if (updateError) {
    console.error(updateError);
    res.status(500).json({ error: 'Email sent, but failed to record onboarding_sent_at' });
    return;
  }

  res.status(200).json({ ok: true });
};
