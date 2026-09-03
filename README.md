# LMagency Website

A single-page, static site. No build step, no framework — open `index.html` in a browser to view it, or upload the whole folder to any static host (Netlify, Vercel, GitHub Pages, etc.).

## Files

- `index.html` — all page content and structure
- `css/styles.css` — all styling (colors/fonts are set once at the top as variables)
- `js/main.js` — mobile menu, sticky header, contact form handling
- `assets/images/`, `assets/video/` — put real photos/videos here

## Swapping in real content (no coding required)

- **Reel example (video)** — in the "Services" section, find the `<video src="assets/video/reel-example.mp4">` tag and point it at a new file dropped into `assets/video/`. It's click-to-play by default (no autoplay sound), so no other changes are needed.
- **Photo post example** — find `<img src="assets/images/photo-post.jpg">` and swap in a new image dropped into `assets/images/`. Keep it roughly square (1:1) so it fills the frame without stretching.
- **Carousel slides** — the carousel has one `<div class="carousel-slide"><img src="assets/images/carousel-1.jpg" ...></div>` per slide (currently 5, named `carousel-1.jpg` through `carousel-5.jpg`). Replace the image files to update the slides, or copy/delete a `<div class="carousel-slide">` block to add/remove slides. Keep images roughly 4:5 (portrait) so they fill the frame without stretching. The arrows (hover on desktop) and swipe (mobile) work automatically — no JS changes needed.
- **Testimonials** — in the "Testimonials" section, edit the quote text, name, and business name for each `<blockquote class="testimonial-card">`. Leave the surrounding HTML tags as they are.
- **Contact form submissions** — this form is live: submissions save to the `applications` table in Supabase (see `js/apply-inline.js`) and trigger an automatic confirmation email. Review, accept/decline, and invite applicants from `/admin`.
- **Colors/fonts** — at the top of `css/styles.css`, the `:root { ... }` block lists every color and font used site-wide. Changing a value there updates it everywhere.
- **Logo/favicon** — the site uses the text "LMagency" as the logo (no image logo yet). The browser tab icon set (`favicon.ico`, sized PNGs, `apple-touch-icon.png`, Android/PWA icons, `site.webmanifest`) lives at the project root and is linked from every page's `<head>`; swap those files in place to update it.

## Deploying

Any static host works. The simplest options:

- **Netlify / Vercel**: drag-and-drop the whole project folder into their dashboard.
- **GitHub Pages**: push the folder to a repo and enable Pages in the repo settings.

No environment variables, no `npm install`, no server required.
