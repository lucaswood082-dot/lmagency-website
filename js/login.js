// =============================================================
// LMagency — /login: password sign-in, magic-link fallback, and
// routing an already-authenticated user (including one arriving
// via a magic-link redirect) to /admin or /portal.
// =============================================================
import { supabase, routeAfterLogin } from './supabase-client.js';

const checkingSession = document.getElementById('checking-session');
const loginArea = document.getElementById('login-area');
const form = document.getElementById('login-form');
const notice = document.getElementById('login-notice');
const submitBtn = document.getElementById('login-submit');
const magicLinkBtn = document.getElementById('magic-link-btn');

function setNotice(message, kind) {
  notice.textContent = message;
  notice.classList.remove('notice-info', 'notice-success', 'notice-error');
  if (kind) notice.classList.add(`notice-${kind}`);
}

function showLoginForm() {
  checkingSession.hidden = true;
  loginArea.hidden = false;
}

async function checkExistingSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await routeAfterLogin();
    return;
  }
  showLoginForm();
}

// Supabase parses a magic-link token from the URL hash automatically on
// load. If that happens after our initial check, this fires and routes us.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    routeAfterLogin();
  }
});

checkExistingSession();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const email = form.email.value.trim();
  const password = form.password.value;

  if (!password) {
    setNotice('Enter your password, or use "email me a login link instead" below.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setNotice('Logging in…', 'info');

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error(error);
    setNotice('Could not log in with that email and password.', 'error');
    submitBtn.disabled = false;
    return;
  }

  setNotice('Logged in — redirecting…', 'success');
  await routeAfterLogin();
});

magicLinkBtn.addEventListener('click', async () => {
  const email = form.email.value.trim();
  if (!email) {
    setNotice('Enter your email above first.', 'error');
    form.email.focus();
    return;
  }

  magicLinkBtn.disabled = true;
  setNotice('Sending your login link…', 'info');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/login.html` },
  });

  magicLinkBtn.disabled = false;

  if (error) {
    console.error(error);
    setNotice('Could not send a login link. Please try again.', 'error');
    return;
  }

  setNotice('Check your email for a login link.', 'success');
});
