// =============================================================
// LMagency — site behavior (no external libraries)
// =============================================================

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------
     Sticky header: add a border/background once the page scrolls
     --------------------------------------------------------- */
  const header = document.getElementById('site-header');
  let scrolled = false;
  let ticking = false;
  const applyScrollState = () => {
    const shouldBeScrolled = window.scrollY > 8;
    if (shouldBeScrolled !== scrolled) {
      scrolled = shouldBeScrolled;
      header.classList.toggle('is-scrolled', scrolled);
    }
    ticking = false;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(applyScrollState);
  };
  applyScrollState();
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

  /* ---------------------------------------------------------
     Click-to-play video (services — reel example)
     --------------------------------------------------------- */
  document.querySelectorAll('[data-video-player]').forEach((wrapper) => {
    const video = wrapper.querySelector('video');
    const playBtn = wrapper.querySelector('.play-btn');
    if (!video || !playBtn) return;

    const startPlayback = () => {
      video.controls = true;
      video.play();
    };

    playBtn.addEventListener('click', startPlayback);
    video.addEventListener('click', () => {
      if (video.paused) startPlayback();
    });
    video.addEventListener('play', () => wrapper.classList.add('is-playing'));
    video.addEventListener('pause', () => wrapper.classList.remove('is-playing'));
  });

  /* ---------------------------------------------------------
     Carousel — hover arrows (desktop) + swipe (touch)
     --------------------------------------------------------- */
  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('[data-carousel-track]');
    const prevBtn = carousel.querySelector('[data-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-carousel-next]');
    const dotsWrap = carousel.querySelector('[data-carousel-dots]');
    const slides = Array.from(track.children);
    if (slides.length === 0) return;

    let index = 0;
    let dragOffsetPercent = 0;

    // Build one dot per slide
    const dots = slides.map((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
      return dot;
    });

    function render(withTransition) {
      track.style.transition = withTransition ? '' : 'none';
      track.style.transform = `translateX(calc(${-index * 100}% + ${dragOffsetPercent}%))`;
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    }

    function goTo(targetIndex) {
      index = (targetIndex + slides.length) % slides.length;
      dragOffsetPercent = 0;
      render(true);
    }

    prevBtn.addEventListener('click', () => goTo(index - 1));
    nextBtn.addEventListener('click', () => goTo(index + 1));

    // Touch swipe
    let startX = 0;
    let isDragging = false;

    track.addEventListener('touchstart', (event) => {
      startX = event.touches[0].clientX;
      isDragging = true;
    }, { passive: true });

    track.addEventListener('touchmove', (event) => {
      if (!isDragging) return;
      const deltaX = event.touches[0].clientX - startX;
      dragOffsetPercent = (deltaX / track.clientWidth) * 100;
      render(false);
    }, { passive: true });

    track.addEventListener('touchend', () => {
      isDragging = false;
      if (dragOffsetPercent < -12) {
        goTo(index + 1);
      } else if (dragOffsetPercent > 12) {
        goTo(index - 1);
      } else {
        dragOffsetPercent = 0;
        render(true);
      }
    });

    render(false);
  });

});
