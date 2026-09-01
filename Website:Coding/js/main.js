// =============================================================
// LMagency — site behavior (no external libraries)
// =============================================================

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------
     Sticky header: add a border/background once the page scrolls
     --------------------------------------------------------- */
  const header = document.getElementById('site-header');
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------
     Mobile menu toggle
     --------------------------------------------------------- */
  const navToggle = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  const closeMenu = () => {
    mobileMenu.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
  };
  const openMenu = () => {
    mobileMenu.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close menu');
  };

  navToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.contains('is-open');
    isOpen ? closeMenu() : openMenu();
  });

  // Close the mobile menu whenever a link inside it is tapped
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  /* ---------------------------------------------------------
     Footer year
     --------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Contact form
     -----------------------------------------------------------
     NOTE: There is no backend wired up yet. This just validates
     the form in the browser and shows a confirmation message.

     To actually receive leads, either:
       1) Point the <form action="..."> at a service like Formspree
          or Netlify Forms and delete this preventDefault() block, or
       2) Replace the fetch() call below with a real request to your
          own backend endpoint.
     --------------------------------------------------------- */
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Placeholder "success" state — replace with a real submission.
      status.textContent = "Thanks — we'll be in touch within one business day.";
      form.reset();
    });
  }

});
