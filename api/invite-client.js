// Vercel serverless function (Node runtime).
//
// Privileged action: creates a real Supabase Auth account for an accepted
// application's contact email (via admin.inviteUserByEmail, which also
// emails them a magic link) and creates the matching `clients` row.
//
// Requires SUPABASE_SERVICE_ROLE_KEY as a server-only env var in Vercel —
// never expose this key to the browser.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xuakbcycbugnepdqkgpf.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { application_id } = req.body || {};
  if (!application_id) {
    res.status(400).json({ error: 'application_id is required' });
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

  // 2. Load the accepted application.
  const { data: application, error: applicationError } = await admin
    .from('applications')
    .select('id, business_name, contact_email, instagram_handle, status')
    .eq('id', application_id)
    .maybeSingle();

  if (applicationError || !application) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (application.status !== 'accepted') {
    res.status(400).json({ error: 'Application must be accepted before inviting the client' });
    return;
  }

  const { data: existingClient } = await admin
    .from('clients')
    .select('id')
    .eq('application_id', application.id)
    .maybeSingle();

  if (existingClient) {
    res.status(400).json({ error: 'This application has already been invited' });
    return;
  }

  // 3. Create the Auth user + send the invite email.
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    application.contact_email,
    { redirectTo: 'https://www.lmagency.work/login' },
  );

  if (inviteError || !inviteData?.user) {
    console.error(inviteError);
    res.status(502).json({ error: inviteError?.message || 'Failed to send invite' });
    return;
  }

  // 4. Create the matching clients row.
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

  res.status(200).json({ ok: true });
};
