// =============================================================
// LMagency — homepage "contact" section is a real application form
// (same applications table as /apply). See js/apply.js for the
// standalone-page version of this same submission logic.
// =============================================================
import { supabase } from './supabase-client.js';

const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');

if (form && status) {
  const submitBtn = document.getElementById('contact-form-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitBtn.disabled = true;
    status.textContent = 'Submitting…';

    const payload = {
      business_name: form.business_name.value.trim(),
      contact_email: form.contact_email.value.trim(),
      instagram_handle: form.instagram_handle.value.trim() || null,
      message: form.message.value.trim() || null,
    };

    const { error } = await supabase.from('applications').insert(payload);

    if (error) {
      console.error(error);
      status.textContent = 'Something went wrong submitting your application. Please try again or email us directly.';
      submitBtn.disabled = false;
      return;
    }

    form.reset();
    document.getElementById('contact-form-fields').hidden = true;
    status.textContent = "Thanks — we've received your application and will be in touch within a couple of business days.";
  });
}
