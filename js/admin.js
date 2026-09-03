// =============================================================
// LMagency — /admin: agency dashboard (applications, clients, submissions)
// =============================================================
import { supabase, getCurrentUser, isAgencyAdmin, signOut } from './supabase-client.js';

const loadingShell = document.getElementById('loading-shell');
const dashboardContent = document.getElementById('dashboard-content');

const applicationsList = document.getElementById('applications-list');
const applicationsCount = document.getElementById('applications-count');
const clientsList = document.getElementById('clients-list');
const clientsCount = document.getElementById('clients-count');
const submissionsGroups = document.getElementById('submissions-groups');
const submissionsCount = document.getElementById('submissions-count');

document.getElementById('sign-out-btn').addEventListener('click', signOut);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function init() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login';
    return;
  }

  const admin = await isAgencyAdmin(user.id);
  if (!admin) {
    window.location.href = '/portal';
    return;
  }

  loadingShell.hidden = true;
  dashboardContent.hidden = false;

  await refreshAll();
}

// Clients load first so the "already invited" badge on applications is accurate.
async function refreshAll() {
  await loadClientsAndSubmissions();
  await loadApplications();
}

// =============================================================
// Applications
// =============================================================
let clientsByApplicationId = {};
let clientsByEmail = {};

async function loadApplications() {
  const { data, error } = await supabase
    .from('applications')
    .select('id, business_name, contact_email, instagram_handle, message, status, created_at, desired_weekly_posts, content_types_interested, goals')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    applicationsList.innerHTML = '<div class="empty-state">Could not load applications.</div>';
    return;
  }

  applicationsCount.textContent = `${data.length} total`;

  if (!data.length) {
    applicationsList.innerHTML = '<div class="empty-state">No applications yet.</div>';
    return;
  }

  applicationsList.innerHTML = data.map((app) => renderApplicationCard(app)).join('');

  applicationsList.querySelectorAll('[data-accept]').forEach((btn) => {
    btn.addEventListener('click', () => updateApplicationStatus(btn.dataset.accept, 'accepted'));
  });
  applicationsList.querySelectorAll('[data-decline]').forEach((btn) => {
    btn.addEventListener('click', () => updateApplicationStatus(btn.dataset.decline, 'declined'));
  });
  applicationsList.querySelectorAll('[data-invite]').forEach((btn) => {
    btn.addEventListener('click', () => inviteClient(btn.dataset.invite, btn));
  });
  applicationsList.querySelectorAll('[data-resend-invite]').forEach((btn) => {
    btn.addEventListener('click', () => resendInvite(btn.dataset.resendInvite, btn));
  });
  applicationsList.querySelectorAll('[data-delete-application]').forEach((btn) => {
    btn.addEventListener('click', () => deleteApplication(btn.dataset.deleteApplication));
  });
}

function renderApplicationCard(app) {
  const linkedClient = clientsByApplicationId[app.id];
  const duplicateClient = !linkedClient && clientsByEmail[app.contact_email];
  const badgeClass = `badge-${app.status}`;

  let statusAction = '';
  if (app.status === 'pending') {
    statusAction = `
      <button class="btn-tiny is-primary" data-accept="${app.id}">Accept</button>
      <button class="btn-tiny is-danger" data-decline="${app.id}">Decline</button>
    `;
  } else if (app.status === 'accepted') {
    if (linkedClient) {
      statusAction = `
        <span class="badge badge-active">Invited</span>
        <button class="btn-tiny" data-resend-invite="${linkedClient.id}">Resend invite</button>
      `;
    } else if (duplicateClient) {
      statusAction = `<span class="badge badge-active">Already a client (via another application)</span>`;
    } else {
      statusAction = `<button class="btn-tiny is-primary" data-invite="${app.id}">Invite client</button>`;
    }
  }

  return `
    <div class="record-card" id="app-card-${app.id}">
      <div class="record-top">
        <span class="record-title">${escapeHtml(app.business_name)}</span>
        <span class="badge ${badgeClass}">${escapeHtml(app.status)}</span>
      </div>
      <div class="record-meta">
        <a href="mailto:${escapeHtml(app.contact_email)}">${escapeHtml(app.contact_email)}</a>
        ${app.instagram_handle ? ` · ${escapeHtml(app.instagram_handle)}` : ''}
        · ${formatDate(app.created_at)}
      </div>
      ${app.desired_weekly_posts != null ? `<p class="record-body"><strong>Posts/week wanted:</strong> ${escapeHtml(String(app.desired_weekly_posts))}</p>` : ''}
      ${app.content_types_interested && app.content_types_interested.length ? `<p class="record-body"><strong>Interested in:</strong> ${escapeHtml(app.content_types_interested.join(', '))}</p>` : ''}
      ${app.goals ? `<p class="record-body"><strong>Goals:</strong> ${escapeHtml(app.goals)}</p>` : ''}
      ${app.message ? `<p class="record-body"><strong>Message:</strong> ${escapeHtml(app.message)}</p>` : ''}
      <div class="record-actions">
        ${statusAction}
        ${!linkedClient ? `<button class="btn-tiny is-danger" data-delete-application="${app.id}">Delete</button>` : ''}
      </div>
      <p class="notice" id="app-notice-${app.id}"></p>
    </div>
  `;
}

async function deleteApplication(id) {
  if (!confirm('Delete this application? This cannot be undone.')) return;

  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) {
    console.error(error);
    const notice = document.getElementById(`app-notice-${id}`);
    if (notice) {
      notice.textContent = 'Could not delete.';
      notice.classList.add('notice-error');
    }
    return;
  }
  await loadApplications();
}

async function updateApplicationStatus(id, status) {
  const { error } = await supabase.from('applications').update({ status }).eq('id', id);
  if (error) {
    console.error(error);
    const notice = document.getElementById(`app-notice-${id}`);
    if (notice) {
      notice.textContent = 'Could not update status.';
      notice.classList.add('notice-error');
    }
    return;
  }
  await loadApplications();
}

async function inviteClient(applicationId, btn) {
  btn.disabled = true;
  btn.textContent = 'Inviting…';

  const { data: { session } } = await supabase.auth.getSession();
  const notice = document.getElementById(`app-notice-${applicationId}`);

  try {
    const res = await fetch('/api/invite-client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ application_id: applicationId }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Invite failed');
    }

    if (notice) {
      notice.textContent = 'Invite sent.';
      notice.classList.add('notice-success');
    }

    await refreshAll();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Invite client';
    if (notice) {
      notice.textContent = err.message || 'Could not send invite.';
      notice.classList.add('notice-error');
    }
  }
}

// =============================================================
// Clients + Submissions (loaded together so submissions can be
// grouped/labeled by client business name)
// =============================================================
async function loadClientsAndSubmissions() {
  const [{ data: clients, error: clientsError }, { data: applications }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, business_name, instagram_handle, timezone, weekly_allocation, subscription_status, current_period_end, application_id, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('applications').select('id, contact_email'),
  ]);

  const contactEmailByApplicationId = {};
  (applications || []).forEach((a) => { contactEmailByApplicationId[a.id] = a.contact_email; });

  if (clientsError) {
    console.error(clientsError);
    clientsList.innerHTML = '<div class="empty-state">Could not load clients.</div>';
    return;
  }

  clientsByApplicationId = {};
  clientsByEmail = {};
  (clients || []).forEach((c) => {
    if (c.application_id) {
      clientsByApplicationId[c.application_id] = c;
      const email = contactEmailByApplicationId[c.application_id];
      if (email) clientsByEmail[email] = c;
    }
  });

  clientsCount.textContent = `${clients.length} total`;

  if (!clients.length) {
    clientsList.innerHTML = '<div class="empty-state">No clients yet — invite one from the Applications list above.</div>';
  } else {
    clientsList.innerHTML = clients.map((c) => renderClientCard(c, contactEmailByApplicationId[c.application_id])).join('');

    clientsList.querySelectorAll('[data-save-client]').forEach((btn) => {
      btn.addEventListener('click', () => saveClient(btn.dataset.saveClient));
    });
    clientsList.querySelectorAll('[data-resend-invite]').forEach((btn) => {
      btn.addEventListener('click', () => resendInvite(btn.dataset.resendInvite, btn));
    });
  }

  await loadSubmissions(clients || []);
}

function renderClientCard(client, contactEmail) {
  const statusOptions = ['active', 'expired', 'cancelled', 'inactive'];
  return `
    <div class="record-card">
      <div class="record-top">
        <span class="record-title">${escapeHtml(client.business_name || 'Unnamed client')}</span>
        <span class="badge badge-${client.subscription_status}">${escapeHtml(client.subscription_status)}</span>
      </div>
      <div class="record-meta">
        ${contactEmail ? `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a> · ` : ''}
        ${client.instagram_handle ? `${escapeHtml(client.instagram_handle)} · ` : ''}
        Client since ${formatDate(client.created_at)}
      </div>
      <div class="inline-edit-row">
        <label class="hint" for="status-${client.id}">Status</label>
        <select id="status-${client.id}">
          ${statusOptions.map((s) => `<option value="${s}" ${s === client.subscription_status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <label class="hint" for="period-end-${client.id}">Renews / ends</label>
        <input type="date" id="period-end-${client.id}" value="${client.current_period_end || ''}">
        <button class="btn-tiny is-primary" data-save-client="${client.id}">Save</button>
        <button class="btn-tiny" data-resend-invite="${client.id}">Resend invite</button>
      </div>
      <p class="notice" id="client-notice-${client.id}"></p>
    </div>
  `;
}

async function resendInvite(clientId, btn) {
  const notice = document.getElementById(`client-notice-${clientId}`);
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Sending…';

  const { data: { session } } = await supabase.auth.getSession();

  try {
    const res = await fetch('/api/resend-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ client_id: clientId }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to resend');

    if (notice) {
      notice.textContent = result.sent === 'invite'
        ? 'Invite resent.'
        : 'Sent them a fresh login link.';
      notice.classList.remove('notice-error');
      notice.classList.add('notice-success');
    }
  } catch (err) {
    console.error(err);
    if (notice) {
      notice.textContent = err.message || 'Could not resend.';
      notice.classList.remove('notice-success');
      notice.classList.add('notice-error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

async function saveClient(clientId) {
  const statusSelect = document.getElementById(`status-${clientId}`);
  const periodEndInput = document.getElementById(`period-end-${clientId}`);
  const notice = document.getElementById(`client-notice-${clientId}`);

  const { error } = await supabase
    .from('clients')
    .update({
      subscription_status: statusSelect.value,
      current_period_end: periodEndInput.value || null,
    })
    .eq('id', clientId);

  if (error) {
    console.error(error);
    notice.textContent = 'Could not save changes.';
    notice.classList.add('notice-error');
    return;
  }

  notice.textContent = 'Saved.';
  notice.classList.remove('notice-error');
  notice.classList.add('notice-success');
}

// =============================================================
// Submissions — grouped by client, newest first
// =============================================================
async function loadSubmissions(clients) {
  const clientNameById = {};
  clients.forEach((c) => { clientNameById[c.id] = c.business_name || 'Unnamed client'; });

  const { data, error } = await supabase
    .from('submissions')
    .select('id, client_id, content_type, requested_date, requested_time, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    submissionsGroups.innerHTML = '<div class="empty-state">Could not load submissions.</div>';
    return;
  }

  submissionsCount.textContent = `${data.length} total`;

  if (!data.length) {
    submissionsGroups.innerHTML = '<div class="empty-state">No submissions yet.</div>';
    return;
  }

  const groups = new Map();
  data.forEach((s) => {
    if (!groups.has(s.client_id)) groups.set(s.client_id, []);
    groups.get(s.client_id).push(s);
  });

  const orderedClientIds = [...groups.keys()].sort((a, b) => {
    const aLatest = groups.get(a)[0]?.created_at || '';
    const bLatest = groups.get(b)[0]?.created_at || '';
    return bLatest.localeCompare(aLatest);
  });

  submissionsGroups.innerHTML = orderedClientIds.map((clientId) => {
    const items = groups.get(clientId);
    const name = clientNameById[clientId] || 'Former client';
    return `
      <div class="client-group">
        <div class="client-group-head">${escapeHtml(name)}</div>
        <div class="record-list">
          ${items.map((s) => `
            <div class="record-card">
              <div class="record-top">
                <span class="record-title">${escapeHtml(s.content_type)}</span>
                <span class="record-meta">${formatDate(s.created_at)}</span>
              </div>
              <div class="record-meta">${[s.requested_date, s.requested_time].filter(Boolean).join(' at ') || 'No date requested'}</div>
              ${s.notes ? `<p class="record-body">${escapeHtml(s.notes)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

init();
