# sndrn.com

Website for **SNDRN.com** — building foundation products for the next AI-native companies.

A static homepage plus Markdown posts. `npm run build` writes the public site to `_site/`;
GitHub Pages builds and deploys it on every push to `main`
(`.github/workflows/static.yml`). Only the public site is published, never the scripts or docs.
Agent and contributor rules are in [`AGENTS.md`](AGENTS.md).

## Write a post

```sh
npm ci                              # once
npm run new -- "My post title"      # creates posts/my-post-title.md (draft)
npm run preview                     # http://localhost:4321, drafts included
```

Edit the front matter (`title`, `description`, `date`, `tags`, `image`, …), write Markdown
below it, put images in `posts/images/`, then set `draft: false` and push to `main`.
`posts/_example.md` shows every field and supported feature.

Each post is published at `/posts/<slug>/` with social preview tags, share buttons (X,
LinkedIn, WhatsApp, email, copy link) and "Ask AI" links (ChatGPT, Claude, Perplexity, Grok),
and is listed on the homepage, `/posts/`, `feed.xml` and `sitemap.xml`.

## Contents

| Path | What it is |
|---|---|
| `index.html` | Homepage (self-contained; the posts list is injected at build time) |
| `posts/` | Posts (`<slug>.md`) and their images |
| `brand/` | Logo kit, SVG + PNG (see below) |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Browser and iOS icons |
| `og.png` | 1200×630 social preview card |
| `scripts/` | `build.mjs` (site build), `serve.mjs` (local preview), `new-post.mjs` |

## Brand kit (`brand/`)

Vectorized from the SNDRN visual identity panel. Every asset ships as SVG and as a
transparent PNG, in white (for dark backgrounds) and black (for light backgrounds).

| File | Use |
|---|---|
| `sndrn-mark-{white,black}` | The ribbon "S" mark on its own |
| `sndrn-wordmark-{white,black}` | The SNDRN wordmark |
| `sndrn-logo-{white,black}` | Primary horizontal lockup: mark + wordmark + tagline |
| `sndrn-logo-stacked-{white,black}` | Stacked lockup |
| `sndrn-lockup-{white,black}.svg` | Mark + wordmark, no tagline |
| `sndrn-icon.svg`, `sndrn-icon-{512,1024}.png` | App icon / avatar (white mark on black) |

The tagline is set in Montserrat (SIL Open Font License) and converted to outlines, so the
files need no fonts installed.

---

SNDRN · [i@sndrn.com](mailto:i@sndrn.com)
