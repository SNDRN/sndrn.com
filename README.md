# sndrn.com

Website for **SNDRN** — Superintelligence, Discovery & New Ventures.

A static, single-page site. `index.html` is self-contained (the logo, partner marks and the
halftone figure data are inlined); the only external requests are Google Fonts. There is no
build step — open `index.html` in a browser to preview it.

## Contents

| Path | What it is |
|---|---|
| `index.html` | The landing page |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Browser and iOS icons |
| `og.png` | 1200×630 social preview card (referenced as `https://sndrn.com/og.png`) |
| `brand/` | Logo kit, SVG + PNG (see below) |

## Brand kit (`brand/`)

Vectorized from the SNDRN visual identity panel. Every asset ships as SVG and as a
transparent PNG, in a white (for dark backgrounds) and a black (for light backgrounds) version.

| File | Use |
|---|---|
| `sndrn-mark-{white,black}` | The ribbon "S" mark on its own |
| `sndrn-wordmark-{white,black}` | The SNDRN wordmark |
| `sndrn-logo-{white,black}` | Primary horizontal lockup: mark + wordmark + tagline |
| `sndrn-logo-stacked-{white,black}` | Stacked lockup |
| `sndrn-icon.svg`, `sndrn-icon-{512,1024}.png` | App icon / avatar (white mark on black) |

The tagline is set in Montserrat (SIL Open Font License) and converted to outlines, so the
files need no fonts installed.

## Deploy

Any static host works (GitHub Pages, Vercel, Netlify, Cloudflare Pages): serve the repository
root as-is.

---

SNDRN LTDA · CNPJ 59.021.241/0001-60 · [i@sndrn.com](mailto:i@sndrn.com)
