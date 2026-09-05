// =============================================================
// LMagency — /admin: agency dashboard (applications, clients, submissions)
// =============================================================
import { supabase, getCurrentUser, isAgencyAdmin, signOut } from './supabase-client.js';

const loadingShell = document.getElementById('loading-shell');
const dashboardContent = document.getElementById('dashboard-content');
const dashboardSubnav = document.getElementById('dashboard-subnav');

const applicationsList = document.getElementById('applications-list');
const applicationsCount = document.getElementById('applications-count');
const clientsList = document.getElementById('clients-list');
const clientsCount = document.getElementById('clients-count');
const submissionsGroups = document.getElementById('submissions-groups');
const submissionsCount = document.getElementById('submissions-count');

const CONTENT_TYPES = ['Transformation', 'Educational', 'Promo', 'Community'];

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
  dashboardSubnav.hidden = false;
  dashboardContent.hidden = false;

  await refreshAll();
}

// =============================================================
// Custom confirmation modal (replaces native confirm())
// =============================================================
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');
const confirmModalConfirm = document.getElementById('confirm-modal-confirm');

function confirmDialog(message, { title = 'Are you sure?', confirmLabel = 'Delete' } = {}) {
  return new Promise((resolve) => {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModalConfirm.textContent = confirmLabel;
    confirmModal.hidden = false;

    const cleanup = (result) => {
      confirmModal.hidden = true;
      confirmModalCancel.removeEventListener('click', onCancel);
      confirmModalConfirm.removeEventListener('click', onConfirm);
      confirmModal.removeEventListener('click', onOverlayClick);
      resolve(result);
    };
    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onOverlayClick = (event) => {
      if (event.target === confirmModal) cleanup(false);
    };

    confirmModalCancel.addEventListener('click', onCancel);
    confirmModalConfirm.addEventListener('click', onConfirm);
    confirmModal.addEventListener('click', onOverlayClick);
  });
}

// =============================================================
// Shared helper for the admin-only /api endpoints
// =============================================================
async function callAdminApi(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || 'Request failed');
  return result;
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
    btn.addEventListener('click', () => acceptApplication(btn.dataset.accept, btn));
  });
  applicationsList.querySelectorAll('[data-decline]').forEach((btn) => {
    btn.addEventListener('click', () => declineApplication(btn.dataset.decline, btn));
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
      // Shouldn't normally happen — accepting now creates the client
      // atomically — but leave a way to recover if it ever does.
      statusAction = `<span class="badge badge-declined">Accepted, but no client record — contact support</span>`;
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
  const ok = await confirmDialog('Delete this application? This cannot be undone.', { title: 'Delete application?' });
  if (!ok) return;

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

async function acceptApplication(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Accepting…';
  const notice = document.getElementById(`app-notice-${id}`);

  try {
    const result = await callAdminApi('/api/accept-application', { application_id: id });
    if (notice) {
      notice.textContent = result.emailSent
        ? 'Accepted — invite and notification email sent.'
        : 'Accepted and invited, but the notification email failed to send.';
      notice.classList.add(result.emailSent ? 'notice-success' : 'notice-error');
    }
    await refreshAll();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Accept';
    if (notice) {
      notice.textContent = err.message || 'Could not accept application.';
      notice.classList.add('notice-error');
    }
  }
}

async function declineApplication(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Declining…';
  const notice = document.getElementById(`app-notice-${id}`);

  try {
    await callAdminApi('/api/decline-application', { application_id: id });
    if (notice) {
      notice.textContent = 'Declined.';
      notice.classList.add('notice-success');
    }
    await loadApplications();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Decline';
    if (notice) {
      notice.textContent = err.message || 'Could not decline application.';
      notice.classList.add('notice-error');
    }
  }
}

// =============================================================
// Clients + Submissions + Content calendar (loaded together)
// =============================================================
let calendarByClientId = {};

async function loadClientsAndSubmissions() {
  const [{ data: clients, error: clientsError }, { data: applications }, { data: calendarRows }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, business_name, instagram_handle, timezone, weekly_allocation, subscription_status, current_period_end, onboarding_sent_at, application_id, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('applications').select('id, contact_email'),
    supabase
      .from('content_calendar')
      .select('id, client_id, content_type, scheduled_date, scheduled_time, caption, media_url, status, created_at')
      .order('scheduled_date', { ascending: true }),
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

  calendarByClientId = {};
  (calendarRows || []).forEach((row) => {
    if (!calendarByClientId[row.client_id]) calendarByClientId[row.client_id] = [];
    calendarByClientId[row.client_id].push(row);
  });

  clientsCount.textContent = `${clients.length} total`;

  if (!clients.length) {
    clientsList.innerHTML = '<div class="empty-state">No clients yet — accept an application above to invite one.</div>';
  } else {
    clientsList.innerHTML = clients
      .map((c) => renderClientCard(c, contactEmailByApplicationId[c.application_id], calendarByClientId[c.id] || []))
      .join('');

    clientsList.querySelectorAll('[data-save-client]').forEach((btn) => {
      btn.addEventListener('click', () => saveClient(btn.dataset.saveClient));
    });
    clientsList.querySelectorAll('[data-resend-invite]').forEach((btn) => {
      btn.addEventListener('click', () => resendInvite(btn.dataset.resendInvite, btn));
    });
    clientsList.querySelectorAll('[data-send-onboarding]').forEach((btn) => {
      btn.addEventListener('click', () => sendOnboarding(btn.dataset.sendOnboarding, btn));
    });
    clientsList.querySelectorAll('[data-activate-client]').forEach((btn) => {
      btn.addEventListener('click', () => activateClient(btn.dataset.activateClient, btn));
    });
    clientsList.querySelectorAll('[data-calendar-form]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        addCalendarItem(form.dataset.calendarForm, form);
      });
    });
    clientsList.querySelectorAll('[data-delete-calendar-item]').forEach((btn) => {
      btn.addEventListener('click', () => deleteCalendarItem(btn.dataset.deleteCalendarItem));
    });
  }

  await loadSubmissions(clients || []);
}

function renderClientCard(client, contactEmail, calendarItems) {
  const statusOptions = ['pending_payment', 'active', 'expired', 'cancelled'];
  const isActive = client.subscription_status === 'active';

  const onboardingAction = client.onboarding_sent_at
    ? `<span class="hint">Onboarding sent ${formatDate(client.onboarding_sent_at)}</span>`
    : `<button class="btn-tiny" data-send-onboarding="${client.id}">Send Onboarding</button>`;

  const activateAction = !isActive
    ? `<button class="btn-tiny is-primary" data-activate-client="${client.id}">Activate Client</button>`
    : '';

  return `
    <div class="record-card">
      <div class="record-top">
        <span class="record-title">${escapeHtml(client.business_name || 'Unnamed client')}</span>
        <span class="badge badge-${client.subscription_status}">${escapeHtml(client.subscription_status.replace('_', ' '))}</span>
      </div>
      <div class="record-meta">
        ${contactEmail ? `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a> · ` : ''}
        ${client.instagram_handle ? `${escapeHtml(client.instagram_handle)} · ` : ''}
        Client since ${formatDate(client.created_at)}
      </div>
      <div class="inline-edit-row">
        <label class="hint" for="status-${client.id}">Status</label>
        <select id="status-${client.id}">
          ${statusOptions.map((s) => `<option value="${s}" ${s === client.subscription_status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
        </select>
        <label class="hint" for="period-end-${client.id}">Renews / ends</label>
        <input type="date" id="period-end-${client.id}" value="${client.current_period_end || ''}">
        <button class="btn-tiny is-primary" data-save-client="${client.id}">Save</button>
        <button class="btn-tiny" data-resend-invite="${client.id}">Resend invite</button>
        ${activateAction}
        ${onboardingAction}
      </div>
      <p class="notice" id="client-notice-${client.id}"></p>
      ${isActive ? renderCalendarSection(client.id, calendarItems) : ''}
    </div>
  `;
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
  await loadClientsAndSubmissions();
}

function onePeriodFromToday() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

async function activateClient(clientId, btn) {
  btn.disabled = true;
  const notice = document.getElementById(`client-notice-${clientId}`);

  const { error } = await supabase
    .from('clients')
    .update({ subscription_status: 'active', current_period_end: onePeriodFromToday() })
    .eq('id', clientId);

  btn.disabled = false;

  if (error) {
    console.error(error);
    if (notice) {
      notice.textContent = 'Could not activate client.';
      notice.classList.add('notice-error');
    }
    return;
  }

  await loadClientsAndSubmissions();
}

async function sendOnboarding(clientId, btn) {
  btn.disabled = true;
  btn.textContent = 'Sending…';
  const notice = document.getElementById(`client-notice-${clientId}`);

  try {
    await callAdminApi('/api/send-onboarding', { client_id: clientId });
    if (notice) {
      notice.textContent = 'Onboarding email sent.';
      notice.classList.remove('notice-error');
      notice.classList.add('notice-success');
    }
    await loadClientsAndSubmissions();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Send Onboarding';
    if (notice) {
      notice.textContent = err.message || 'Could not send onboarding email.';
      notice.classList.remove('notice-success');
      notice.classList.add('notice-error');
    }
  }
}

async function resendInvite(clientId, btn) {
  const notice = document.getElementById(`client-notice-${clientId}`) || document.getElementById(`app-notice-${clientId}`);
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Sending…';

  try {
    const result = await callAdminApi('/api/resend-invite', { client_id: clientId });
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

// =============================================================
// Content calendar — admin add-form + list, per active client
// =============================================================
function renderCalendarSection(clientId, items) {
  return `
    <div class="calendar-section">
      <p class="calendar-section-label">Content calendar</p>
      <form class="calendar-add-form" data-calendar-form="${clientId}">
        <select name="content_type" required>
          <option value="" disabled selected>Content type…</option>
          ${CONTENT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <div class="field-grid-2">
          <input type="date" name="scheduled_date" placeholder="Date">
          <input type="time" name="scheduled_time" placeholder="Time">
        </div>
        <textarea name="caption" rows="2" placeholder="Caption"></textarea>
        <input type="url" name="media_url" placeholder="Media URL (optional)">
        <div class="form-actions">
          <button type="submit" class="btn-tiny is-primary">Add to calendar</button>
        </div>
        <p class="notice" id="calendar-notice-${clientId}"></p>
      </form>
      <div class="calendar-list">
        ${items.length ? items.map(renderCalendarItem).join('') : '<p class="hint">Nothing scheduled yet.</p>'}
      </div>
    </div>
  `;
}

function renderCalendarItem(item) {
  const when = [item.scheduled_date, item.scheduled_time].filter(Boolean).join(' at ') || 'No date set';
  return `
    <div class="calendar-item">
      <div class="calendar-item-main">
        <span><strong>${escapeHtml(item.content_type)}</strong> — ${escapeHtml(item.caption || '(no caption)')}</span>
        <span class="calendar-item-when">${escapeHtml(when)}${item.media_url ? ` · <a href="${escapeHtml(item.media_url)}" target="_blank" rel="noopener">media</a>` : ''}</span>
      </div>
      <span class="badge badge-${item.status}">${escapeHtml(item.status.replace('_', ' '))}</span>
      <button class="btn-tiny is-danger" data-delete-calendar-item="${item.id}">Delete</button>
    </div>
  `;
}

async function addCalendarItem(clientId, form) {
  const notice = document.getElementById(`calendar-notice-${clientId}`);
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const payload = {
    client_id: clientId,
    content_type: form.content_type.value,
    scheduled_date: form.scheduled_date.value || null,
    scheduled_time: form.scheduled_time.value || null,
    caption: form.caption.value.trim() || null,
    media_url: form.media_url.value.trim() || null,
  };

  const { error } = await supabase.from('content_calendar').insert(payload);
  submitBtn.disabled = false;

  if (error) {
    console.error(error);
    if (notice) {
      notice.textContent = 'Could not add to calendar.';
      notice.classList.add('notice-error');
    }
    return;
  }

  await loadClientsAndSubmissions();
}

async function deleteCalendarItem(id) {
  const ok = await confirmDialog('Remove this calendar entry?', { title: 'Delete calendar entry?' });
  if (!ok) return;

  const { error } = await supabase.from('content_calendar').delete().eq('id', id);
  if (error) {
    console.error(error);
    return;
  }
  await loadClientsAndSubmissions();
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
