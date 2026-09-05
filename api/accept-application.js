// Vercel serverless function (Node runtime).
//
// Privileged action: accepts a pending application in one step — marks it
// accepted, creates the client's Auth account and sends them the Supabase
// invite email, creates the matching `clients` row (subscription_status
// defaults to 'pending_payment'), and sends the "you've been accepted"
// notification email via Resend.
const { requireAdmin } = require('./_lib/supabaseAdmin');
const { sendNotificationEmail } = require('./_lib/notify');

const REDIRECT_TO = 'https://www.lmagency.work/login';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { admin } = ctx;

  const { application_id } = req.body || {};
  if (!application_id) {
    res.status(400).json({ error: 'application_id is required' });
    return;
  }

  const { data: application, error: applicationError } = await admin
    .from('applications')
    .select('id, business_name, contact_email, instagram_handle, status')
    .eq('id', application_id)
    .maybeSingle();

  if (applicationError || !application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (application.status !== 'pending') {
    res.status(400).json({ error: 'Only a pending application can be accepted' });
    return;
  }

  const { data: existingClient } = await admin
    .from('clients')
    .select('id')
    .eq('application_id', application.id)
    .maybeSingle();

  if (existingClient) {
    res.status(400).json({ error: 'A client already exists for this application' });
    return;
  }

  const { error: statusError } = await admin
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', application.id);

  if (statusError) {
    console.error(statusError);
    res.status(500).json({ error: 'Failed to update application status' });
    return;
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    application.contact_email,
    { redirectTo: REDIRECT_TO },
  );

  if (inviteError || !inviteData?.user) {
    console.error(inviteError);
    res.status(502).json({ error: inviteError?.message || 'Failed to send invite' });
    return;
  }

  const { error: clientInsertError } = await admin.from('clients').insert({
    id: inviteData.user.id,
    business_name: application.business_name,
    instagram_handle: application.instagram_handle,
    application_id: application.id,
  });

  if (clientInsertError) {
    console.error(clientInsertError);
    res.status(500).json({ error: 'Invite sent, but failed to create the client record' });
    return;
  }

  // Best-effort: the invite + client record are what actually matter here.
  const notify = await sendNotificationEmail('accepted', application.business_name, application.contact_email);
  if (!notify.ok) console.error('accepted-email failed:', notify.error);

  res.status(200).json({ ok: true, emailSent: notify.ok });
};
