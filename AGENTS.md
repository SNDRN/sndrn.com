# AGENTS.md — sndrn.com

Source of the public website **https://sndrn.com** (SNDRN LTDA): a static homepage plus
Markdown posts. `npm run build` writes the public site to `_site/`, and the GitHub Pages
workflow (`.github/workflows/static.yml`) builds and deploys it on every push to `main`.

## Rules

- **Public info only.** This repository and the site are both public: every file and every
  commit is visible on the open internet. Never commit secrets, credentials, private company
  documents (bank, legal, contracts), customer data or internal notes. Commit with the GitHub
  noreply email (set locally in this repo), not a personal address.
- **Only allowlisted files are published:** `index.html`, the icons, `og.png`, `brand/`, and
  the generated posts, feed, sitemap and robots.txt. To publish a new root-level asset, add it to
  `PUBLIC` in `scripts/build.mjs`. Scripts, docs and workflows are never deployed.
- **Pushing to `main` deploys to production.** Preview first with `npm run preview`.
- Don't hand-edit `_site/` (generated, gitignored).
- Keep the design minimal: black background, Inter Tight + IBM Plex Mono, no nav header on the
  homepage, few words.

## Commands

```sh
npm ci                       # install (marked, yaml)
npm run build                # build _site/ (published posts only)
npm run preview              # build including drafts, serve at http://localhost:4321
npm run new -- "Post title"  # scaffold posts/<slug>.md as a draft
```

## Posts

- One file per post: `posts/<slug>.md` → `https://sndrn.com/posts/<slug>/`.
- Front matter: `title` and `date` (YYYY-MM-DD) are required; optional `description`, `tags`,
  `image` (cover + social preview), `image_alt`, `cover: false` (use `image` only for link
  previews), `author`, `slug`, `draft`, `lang`.
  `posts/_example.md` is the reference template (files starting with `_` are never published).
- Images go in `posts/images/` and are referenced relative to `posts/` (`images/chart.png`).
- `draft: true` keeps a post off the site; `npm run preview` still shows it.
- Every post gets Open Graph/Twitter tags, JSON-LD, share buttons (X, LinkedIn, WhatsApp,
  email, copy link, native share), "Ask AI" links (ChatGPT, Claude, Perplexity, Grok), and is
  listed on the homepage (latest 6), `/posts/`, `feed.xml` and `sitemap.xml`.
- Cite sources with links and verify every number and claim before publishing.

## Homepage (`index.html`)

- Hand-maintained and self-contained. Two long lines are generated data, not code to edit:
  the inline SVG sprite (SNDRN logo and team logos) and the halftone PNG (base64) in the
  script. If the logo changes, regenerate them from `brand/`.
- The posts list is injected between `<!-- posts:start -->` and `<!-- posts:end -->` at build
  time; keep both markers.
- Links with `data-post="<slug>"` (e.g. the R.02 title) only render as links once that post is
  published; until then the build turns them into plain text.
- Sections: hero (halftone S only) · What we do (title + R.01/R.02, no "Results" label) · Team ·
  Posts (when any exist) · footer (email only). Show only public info: no CNPJ, no domain names
  as link text (titles link instead).

## Brand

`brand/` is the logo kit, vectorized from the SNDRN identity panel: mark, wordmark, horizontal
and stacked lockups, mark+wordmark lockup and app icon, as SVG and transparent PNG, in white
(dark backgrounds) and black (light backgrounds). The tagline is Montserrat, outlined.
