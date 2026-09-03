// =============================================================
// LMagency — /portal: client content-submission portal
// =============================================================
import { supabase, getCurrentUser, signOut } from './supabase-client.js';

const loadingShell = document.getElementById('loading-shell');
const portalContent = document.getElementById('portal-content');
const clientLabel = document.getElementById('client-label');
const expiredGate = document.getElementById('expired-gate');
const activeArea = document.getElementById('active-area');
const portalHeading = document.getElementById('portal-heading');

const passwordPanel = document.getElementById('password-panel');
const passwordForm = document.getElementById('password-form');
const passwordNotice = document.getElementById('password-notice');
const dismissPasswordBtn = document.getElementById('dismiss-password-btn');

const submissionForm = document.getElementById('submission-form');
const submissionNotice = document.getElementById('submission-notice');
const submissionSubmit = document.getElementById('submission-submit');
const submissionsList = document.getElementById('submissions-list');

document.getElementById('sign-out-btn').addEventListener('click', signOut);

function setNotice(el, message, kind) {
  el.textContent = message;
  el.classList.remove('notice-info', 'notice-success', 'notice-error');
  if (kind) el.classList.add(`notice-${kind}`);
}

function passwordPromptKey(userId) {
  return `lm_pw_prompt_dismissed_${userId}`;
}

async function init() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login';
    return;
  }

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, business_name, subscription_status, current_period_end')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
  }

  if (!client) {
    loadingShell.innerHTML = '<p class="loading-text">No client record found for this account. Please get in touch with LMagency.</p>';
    return;
  }

  clientLabel.textContent = client.business_name || 'Client portal';
  portalHeading.textContent = client.business_name
    ? `Request your next post, ${client.business_name}.`
    : 'Request your next post.';

  loadingShell.hidden = true;
  portalContent.hidden = false;

  if (!localStorage.getItem(passwordPromptKey(user.id))) {
    passwordPanel.hidden = false;
  }

  const today = new Date().toISOString().slice(0, 10);
  const isActive = client.subscription_status === 'active'
    && (!client.current_period_end || client.current_period_end >= today);

  if (isActive) {
    activeArea.hidden = false;
    loadSubmissions(user.id);
  } else {
    expiredGate.hidden = false;
  }

  dismissPasswordBtn.addEventListener('click', () => {
    localStorage.setItem(passwordPromptKey(user.id), '1');
    passwordPanel.hidden = true;
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pw = passwordForm.new_password.value;
    const confirm = passwordForm.confirm_password.value;

    if (pw.length < 8) {
      setNotice(passwordNotice, 'Password must be at least 8 characters.', 'error');
      return;
    }
    if (pw !== confirm) {
      setNotice(passwordNotice, 'Passwords do not match.', 'error');
      return;
    }

    setNotice(passwordNotice, 'Saving…', 'info');
    const { error: pwError } = await supabase.auth.updateUser({ password: pw });

    if (pwError) {
      console.error(pwError);
      setNotice(passwordNotice, 'Could not set password. Please try again.', 'error');
      return;
    }

    localStorage.setItem(passwordPromptKey(user.id), '1');
    setNotice(passwordNotice, 'Password set — you can use it next time you log in.', 'success');
    setTimeout(() => { passwordPanel.hidden = true; }, 1800);
  });

  submissionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!submissionForm.checkValidity()) {
      submissionForm.reportValidity();
      return;
    }

    submissionSubmit.disabled = true;
    setNotice(submissionNotice, 'Submitting…', 'info');

    const payload = {
      client_id: user.id,
      content_type: submissionForm.content_type.value,
      requested_date: submissionForm.requested_date.value || null,
      requested_time: submissionForm.requested_time.value || null,
      notes: submissionForm.notes.value.trim() || null,
    };

    const { error: subError } = await supabase.from('submissions').insert(payload);

    submissionSubmit.disabled = false;

    if (subError) {
      console.error(subError);
      setNotice(submissionNotice, 'Something went wrong submitting your request. Please try again.', 'error');
      return;
    }

    submissionForm.reset();
    setNotice(submissionNotice, 'Request submitted!', 'success');
    loadSubmissions(user.id);
  });
}

async function loadSubmissions(clientId) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, content_type, requested_date, requested_time, notes, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    submissionsList.innerHTML = '<p class="loading-text">Could not load your requests.</p>';
    return;
  }

  if (!data.length) {
    submissionsList.innerHTML = '<div class="empty-state">No requests yet — submit your first one above.</div>';
    return;
  }

  submissionsList.innerHTML = data.map((s) => `
    <div class="record-card">
      <div class="record-top">
        <span class="record-title">${escapeHtml(s.content_type)}</span>
        <span class="record-meta">${formatWhen(s.requested_date, s.requested_time)}</span>
      </div>
      ${s.notes ? `<p class="record-body">${escapeHtml(s.notes)}</p>` : ''}
    </div>
  `).join('');
}

function formatWhen(date, time) {
  if (!date && !time) return 'No date requested';
  return [date, time].filter(Boolean).join(' at ');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
