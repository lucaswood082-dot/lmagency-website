// =============================================================
// LMagency — /apply form handling
// =============================================================
import { supabase } from './supabase-client.js';

const form = document.getElementById('apply-form');
const notice = document.getElementById('apply-notice');
const submitBtn = document.getElementById('apply-submit');

function setNotice(message, kind) {
  notice.textContent = message;
  notice.classList.remove('notice-info', 'notice-success', 'notice-error');
  if (kind) notice.classList.add(`notice-${kind}`);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitBtn.disabled = true;
  setNotice('Submitting…', 'info');

  const payload = {
    business_name: form.business_name.value.trim(),
    contact_email: form.contact_email.value.trim(),
    instagram_handle: form.instagram_handle.value.trim() || null,
    message: form.message.value.trim() || null,
  };

  const { error } = await supabase.from('applications').insert(payload);

  if (error) {
    console.error(error);
    setNotice("Something went wrong submitting your application. Please try again or email us directly.", 'error');
    submitBtn.disabled = false;
    return;
  }

  form.reset();
  document.getElementById('apply-fields').hidden = true;
  setNotice("Thanks — we've received your application and will be in touch within a couple of business days.", 'success');
});
