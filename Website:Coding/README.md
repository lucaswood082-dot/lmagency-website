# LMagency Website

A single-page, static site. No build step, no framework — open `index.html` in a browser to view it, or upload the whole folder to any static host (Netlify, Vercel, GitHub Pages, etc.).

## Files

- `index.html` — all page content and structure
- `css/styles.css` — all styling (colors/fonts are set once at the top as variables)
- `js/main.js` — mobile menu, sticky header, contact form handling
- `assets/images/`, `assets/video/` — put real photos/videos here

## Swapping in real content (no coding required)

Open `index.html` in any text editor and search for the word **PLACEHOLDER** — every spot that needs real content is marked with a comment like:

```html
<!-- PLACEHOLDER MEDIA — replace this div with a real <video> or <img> -->
```

Specifically:

- **Service media (Reels / Photos / Carousels)** — in the "Services" section, replace each `<div class="media-placeholder">...</div>` block with a real `<img src="assets/images/your-photo.jpg" alt="...">` or `<video src="assets/video/your-clip.mp4" autoplay muted loop playsinline></video>`. Drop your files into `assets/images/` or `assets/video/` first.
- **Testimonials** — in the "Testimonials" section, edit the quote text, name, and business name for each `<blockquote class="testimonial-card">`. Leave the surrounding HTML tags as they are.
- **Contact form submissions** — the form currently only shows a "thanks" message in the browser; it does not email anyone yet. To start receiving real leads, connect it to a free form service like Formspree or Netlify Forms (point the form's `action` attribute at the service's URL), or wire it to a backend of your choice.
- **Colors/fonts** — at the top of `css/styles.css`, the `:root { ... }` block lists every color and font used site-wide. Changing a value there updates it everywhere.
- **Logo/favicon** — the site currently uses the text "LMagency" as the logo. To use an image logo or a browser tab icon, add the file to `assets/images/` and update the commented-out favicon line in the `<head>` of `index.html`.

## Deploying

Any static host works. The simplest options:

- **Netlify / Vercel**: drag-and-drop the whole project folder into their dashboard.
- **GitHub Pages**: push the folder to a repo and enable Pages in the repo settings.

No environment variables, no `npm install`, no server required.
