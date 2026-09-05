// Vercel serverless function (Node runtime).
//
// Privileged action: declines a pending application and sends the
// applicant a simple decline notification via Resend. No account or
// client record is ever created for a declined application.
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

  const { application_id } = req.body || {};
  if (!application_id) {
    res.status(400).json({ error: 'application_id is required' });
    return;
  }

  const { data: application, error: applicationError } = await admin
    .from('applications')
    .select('id, business_name, contact_email, status')
    .eq('id', application_id)
    .maybeSingle();

  if (applicationError || !application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (application.status !== 'pending') {
    res.status(400).json({ error: 'Only a pending application can be declined' });
    return;
  }

  const { error: statusError } = await admin
    .from('applications')
    .update({ status: 'declined' })
    .eq('id', application.id);

  if (statusError) {
    console.error(statusError);
    res.status(500).json({ error: 'Failed to update application status' });
    return;
  }

  const notify = await sendNotificationEmail('declined', application.business_name, application.contact_email);
  if (!notify.ok) console.error('declined-email failed:', notify.error);

  res.status(200).json({ ok: true, emailSent: notify.ok });
};
