// Builds the public site into _site/: copies the homepage and public assets,
// renders posts/*.md into /posts/<slug>/, and writes the posts index, feed and sitemap.
// Usage: node scripts/build.mjs [--drafts]
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked, Renderer } from 'marked';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const POSTS_DIR = path.join(ROOT, 'posts');
const SITE = { url: 'https://sndrn.com', name: 'SNDRN', email: 'i@sndrn.com' };
// Only these paths are published. Everything else in the repo (scripts, docs, workflows) stays private.
const PUBLIC = ['index.html', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og.png', 'brand'];
const WITH_DRAFTS = process.argv.includes('--drafts');
const HOME_LIMIT = 6;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const isRelative = (u) => !!u && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(u);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
const shortDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, '.');

function fail(msg) {
  console.error(`build: ${msg}`);
  process.exit(1);
}

function splitFrontMatter(src, file) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!m) return { data: {}, body: src };
  try {
    return { data: YAML.parse(m[1]) || {}, body: src.slice(m[0].length) };
  } catch (e) {
    fail(`${file}: invalid front matter (${e.message})`);
  }
}

// Markdown renderer. `prefix` rewrites relative links/images so they resolve from the
// post's output URL (/posts/<slug>/) back to the posts/ folder the .md file lives in.
function markdown(prefix) {
  const md = new Marked({ gfm: true });
  md.use({
    walkTokens(token) {
      if ((token.type === 'link' || token.type === 'image') && isRelative(token.href)) token.href = prefix + token.href;
    },
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const id = slugify(inner);
        return `<h${depth} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//i.test(href) && !href.startsWith(SITE.url);
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
      },
      image({ href, title, text }) {
        const img = `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy" decoding="async">`;
        return title ? `<figure>${img}<figcaption>${esc(title)}</figcaption></figure>` : img;
      },
      paragraph({ tokens }) {
        const inner = this.parser.parseInline(tokens);
        if (tokens.length === 1 && tokens[0].type === 'image') return `${inner}\n`;
        return `<p>${inner}</p>\n`;
      },
      table(token) {
        return `<div class="table">${Renderer.prototype.table.call(this, token)}</div>\n`;
      },
    },
  });
  return md;
}

function plainText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function absoluteFromPosts(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return SITE.url + u;
  return `${SITE.url}/posts/${u}`;
}

async function loadPosts() {
  let files = [];
  try {
    files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('.'));
  } catch {
    return [];
  }
  const posts = [];
  const seen = new Map();
  for (const file of files) {
    const src = await readFile(path.join(POSTS_DIR, file), 'utf8');
    const { data, body } = splitFrontMatter(src, file);
    if (data.draft === true && !WITH_DRAFTS) continue;
    const base = file.replace(/\.md$/, '');
    const dated = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    const slug = slugify(data.slug || (dated ? dated[2] : base));
    if (!slug) fail(`${file}: could not derive a slug`);
    if (seen.has(slug)) fail(`${file}: slug "${slug}" is also used by ${seen.get(slug)}`);
    seen.set(slug, file);
    if (!data.title) fail(`${file}: front matter needs a title`);
    const rawDate = data.date ?? (dated && dated[1]);
    const date = rawDate ? new Date(rawDate instanceof Date ? rawDate : String(rawDate)) : null;
    if (!date || Number.isNaN(date.getTime())) fail(`${file}: front matter needs a valid date (YYYY-MM-DD)`);
    const html = markdown('../').parse(body);
    const feedHtml = markdown(`${SITE.url}/posts/`).parse(body);
    const text = plainText(html);
    const description = data.description || (text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, '')}…` : text);
    posts.push({
      file, slug, date, html, feedHtml, description,
      title: String(data.title),
      author: data.author || SITE.name,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : data.tags ? [String(data.tags)] : [],
      image: data.image || '',
      imageAlt: data.image_alt || '',
      showCover: data.cover !== false,
      draft: data.draft === true,
      lang: data.lang || 'en',
      minutes: Math.max(1, Math.round(text.split(' ').length / 230)),
      url: `${SITE.url}/posts/${slug}/`,
    });
  }
  return posts.sort((a, b) => b.date - a.date);
}

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter+Tight:wght@400..700&display=swap">';

const CSS = `
:root{--bg:#000;--fg:#f2f2ef;--fg2:rgba(242,242,239,.72);--fg3:rgba(242,242,239,.5);--line:rgba(242,242,239,.14);--chip:#191919;--g:clamp(16px,3.3vw,48px);
--sans:"Inter Tight",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--ease:cubic-bezier(.16,.84,.24,1);color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:400 17px/1.55 var(--sans);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;overflow-x:clip}
a{color:inherit}
::selection{background:var(--fg);color:#000}
:focus-visible{outline:2px solid var(--fg);outline-offset:3px}
.wrap{max-width:1440px;margin:0 auto;padding:0 var(--g)}
.mono{font-family:var(--mono);font-size:12px;font-weight:400;line-height:1.5;letter-spacing:.06em;text-transform:uppercase}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.top{display:flex;justify-content:space-between;align-items:center;gap:24px;padding-top:clamp(20px,3vw,40px)}
.top a{text-decoration:none}
.brand{display:block;height:clamp(30px,3vw,40px);width:auto}
.top .mono{color:var(--fg3)}
.top .mono:hover{color:var(--fg)}
.chip{display:inline-flex;align-items:center;height:32px;padding:0 11px;background:var(--chip);color:var(--fg);font:500 14px/1 var(--sans);letter-spacing:-.005em;white-space:nowrap;text-decoration:none;border:0;cursor:pointer;transition:background-color .18s,color .18s}
.chip:hover{background:var(--fg);color:#000}
.share{display:grid;gap:8px}
.share-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.share-l{width:72px;color:var(--fg3)}
.post{max-width:760px;margin:0 auto;padding:clamp(56px,9vw,120px) 0 0}
.post-h .meta{color:var(--fg3)}
.post h1{margin:18px 0 0;font-weight:500;font-size:clamp(2.25rem,5.4vw,4rem);line-height:1;letter-spacing:-.045em;text-wrap:balance}
.dek{margin:20px 0 0;font-size:clamp(1.125rem,1.7vw,1.375rem);line-height:1.45;color:var(--fg2);text-wrap:pretty}
.post-h .share{margin-top:32px;padding-top:20px;border-top:1px solid var(--line)}
.cover{margin:40px 0 0}
.cover img{display:block;width:100%;height:auto}
.prose{margin-top:clamp(40px,6vw,64px);font-size:clamp(1.0625rem,1.25vw,1.1875rem);line-height:1.7;color:var(--fg2)}
.prose>*{margin:0 0 1.15em}
.prose h2,.prose h3,.prose h4{position:relative;color:var(--fg);font-weight:500;letter-spacing:-.03em;line-height:1.15;margin:2em 0 .7em;text-wrap:balance}
.prose h2{font-size:clamp(1.5rem,2.4vw,2rem)}
.prose h3{font-size:clamp(1.25rem,1.8vw,1.5rem)}
.prose h4{font-size:1.125rem}
.anchor{margin-left:.35em;color:var(--fg3);text-decoration:none;opacity:0;transition:opacity .2s}
.prose :is(h2,h3,h4):hover .anchor{opacity:1}
.prose strong{color:var(--fg);font-weight:600}
.prose a{color:var(--fg);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.18em;text-decoration-color:var(--fg3)}
.prose a:hover{text-decoration-color:var(--fg)}
.prose ul,.prose ol{padding-left:1.25em}
.prose li{margin:.35em 0}
.prose li::marker{color:var(--fg3)}
.prose img{display:block;max-width:100%;height:auto;margin:2em 0}
.prose figure{margin:2em 0}
.prose figure img{margin:0}
.prose figcaption{margin-top:10px;font:400 12px/1.5 var(--mono);letter-spacing:.04em;color:var(--fg3)}
.prose blockquote{margin:1.6em 0;padding:2px 0 2px 20px;border-left:1px solid var(--fg);color:var(--fg)}
.prose blockquote>*:last-child{margin-bottom:0}
.prose hr{border:0;border-top:1px solid var(--line);margin:2.4em 0}
.prose code{font-family:var(--mono);font-size:.86em;background:#121212;padding:.12em .36em}
.prose pre{background:#0c0c0c;border:1px solid var(--line);padding:18px 20px;overflow-x:auto;line-height:1.55}
.prose pre code{background:none;padding:0;font-size:.82em;color:var(--fg)}
.prose .table{overflow-x:auto}
.prose table{width:100%;border-collapse:collapse;font-size:.92em}
.prose th,.prose td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.prose th{font:500 12px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--fg3)}
.prose sup a,.prose .footnotes a{text-decoration:none}
.post-f{margin-top:clamp(48px,7vw,80px);padding-top:20px;border-top:1px solid var(--line)}
.list{max-width:960px;margin:0 auto;padding:clamp(56px,9vw,120px) 0 0}
.list h1{margin:0 0 clamp(28px,4vw,48px);font-weight:500;font-size:clamp(2.25rem,5.4vw,4rem);letter-spacing:-.045em;line-height:1}
.list ol{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.list a{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px 28px;padding:24px 0;border-bottom:1px solid var(--line);text-decoration:none}
.list .t{font-weight:500;font-size:clamp(1.375rem,2.4vw,2rem);line-height:1.1;letter-spacing:-.032em}
.list .d{grid-column:2;color:var(--fg3)}
.list .mono{padding-top:7px;color:var(--fg3)}
.list a:hover .t{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.12em}
.foot{margin-top:clamp(80px,10vw,140px);border-top:1px solid var(--line);padding:clamp(40px,6vw,72px) 0 clamp(48px,7vw,88px)}
.ct-mail{display:inline-block;padding-bottom:.04em;font-weight:500;font-size:clamp(2.6rem,9vw,8rem);line-height:.92;letter-spacing:-.055em;text-decoration:none;background:linear-gradient(currentColor,currentColor) 0 100%/0 2px no-repeat;transition:background-size .5s var(--ease)}
.ct-mail:hover{background-size:100% 2px}
@media (max-width:600px){.share-l{width:100%}.list a{grid-template-columns:1fr}.list .d{grid-column:1}.list .mono{padding-top:0}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:.001ms!important}}
`;

const SHARE_JS = `<script>
document.querySelectorAll('[data-copy]').forEach(function (b) {
  b.addEventListener('click', function () {
    var v = b.getAttribute('data-copy'), old = b.textContent;
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = old; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done);
    else { var t = document.createElement('textarea'); t.value = v; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); done(); }
  });
});
if (navigator.share) document.querySelectorAll('[data-native]').forEach(function (b) {
  b.hidden = false;
  b.addEventListener('click', function () { navigator.share({ title: b.getAttribute('data-title'), url: b.getAttribute('data-url') }).catch(function () {}); });
});
</script>`;

function shareBlock(p) {
  const u = encodeURIComponent(p.url);
  const t = encodeURIComponent(p.title);
  const ask = encodeURIComponent(`Read this article from SNDRN and summarize the key ideas, then help me apply them to my own product: ${p.url}`);
  const ext = 'target="_blank" rel="noopener"';
  return `<div class="share">
  <div class="share-row"><span class="mono share-l">Share</span>
    <a class="chip" ${ext} href="https://twitter.com/intent/tweet?text=${t}&amp;url=${u}">X</a>
    <a class="chip" ${ext} href="https://www.linkedin.com/sharing/share-offsite/?url=${u}">LinkedIn</a>
    <a class="chip" ${ext} href="https://wa.me/?text=${t}%20${u}">WhatsApp</a>
    <a class="chip" href="mailto:?subject=${t}&amp;body=${u}">Email</a>
    <button class="chip" type="button" data-copy="${esc(p.url)}">Copy link</button>
    <button class="chip" type="button" data-native data-title="${esc(p.title)}" data-url="${esc(p.url)}" hidden>Share…</button>
  </div>
  <div class="share-row"><span class="mono share-l">Ask AI</span>
    <a class="chip" ${ext} href="https://chatgpt.com/?q=${ask}">ChatGPT</a>
    <a class="chip" ${ext} href="https://claude.ai/new?q=${ask}">Claude</a>
    <a class="chip" ${ext} href="https://www.perplexity.ai/search?q=${ask}">Perplexity</a>
    <a class="chip" ${ext} href="https://grok.com/?q=${ask}">Grok</a>
  </div>
</div>`;
}

function head({ title, description, url, image, root, type = 'website', extra = '' }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="SNDRN">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="icon" href="${root}favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">
<link rel="alternate" type="application/atom+xml" title="SNDRN — Posts" href="${root}feed.xml">
${FONTS}
${extra}<style>${CSS}</style>`;
}

function topBar(root, link) {
  return `<div class="wrap top"><a href="${root}" aria-label="SNDRN — home"><img class="brand" src="${root}brand/sndrn-lockup-white.svg" alt="SNDRN" width="130" height="40"></a>${link}</div>`;
}

const FOOT = `<footer class="foot"><div class="wrap"><a class="ct-mail" href="mailto:${SITE.email}">${SITE.email}</a></div></footer>`;

function postPage(p) {
  const root = '../../';
  const iso = p.date.toISOString();
  const ogImage = p.image ? absoluteFromPosts(p.image) : `${SITE.url}/og.png`;
  const coverSrc = p.image && p.showCover ? (/^https?:\/\//i.test(p.image) ? p.image : p.image.startsWith('/') ? `${root}${p.image.slice(1)}` : `../${p.image}`) : '';
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description,
    datePublished: iso, dateModified: iso, url: p.url, mainEntityOfPage: p.url, image: ogImage,
    author: { '@type': 'Organization', name: p.author, url: SITE.url },
    publisher: { '@type': 'Organization', name: 'SNDRN', url: SITE.url, logo: { '@type': 'ImageObject', url: `${SITE.url}/brand/sndrn-icon-512.png` } },
    keywords: p.tags.join(', '),
  };
  const extra = `<meta property="article:published_time" content="${iso}">\n${p.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">\n`).join('')}<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n`;
  return `<!doctype html>
<html lang="${esc(p.lang)}">
<head>
${head({ title: `${p.title} — SNDRN`, description: p.description, url: p.url, image: ogImage, root, type: 'article', extra })}
</head>
<body>
${topBar(root, `<a class="mono" href="${root}posts/">All posts</a>`)}
<main class="wrap">
  <article class="post">
    <header class="post-h">
      <p class="mono meta"><time datetime="${iso}">${longDate(p.date)}</time> · ${p.minutes} min read${p.tags.length ? ` · ${p.tags.map(esc).join(' · ')}` : ''}${p.draft ? ' · Draft' : ''}</p>
      <h1>${esc(p.title)}</h1>
      ${p.description ? `<p class="dek">${esc(p.description)}</p>` : ''}
      ${shareBlock(p)}
    </header>
    ${coverSrc ? `<figure class="cover"><img src="${esc(coverSrc)}" alt="${esc(p.imageAlt)}"></figure>` : ''}
    <div class="prose">
${p.html}
    </div>
    <footer class="post-f">${shareBlock(p)}</footer>
  </article>
</main>
${FOOT}
${SHARE_JS}
</body>
</html>
`;
}

function listPage(posts) {
  const root = '../';
  const rows = posts.map((p) => `<li><a href="${p.slug}/"><span class="mono">${shortDate(p.date)}</span><span class="t">${esc(p.title)}</span><span class="mono d">${esc(p.description)}</span></a></li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
${head({ title: 'Posts — SNDRN', description: 'Notes and research from SNDRN.', url: `${SITE.url}/posts/`, image: `${SITE.url}/og.png`, root })}
</head>
<body>
${topBar(root, '')}
<main class="wrap">
  <section class="list">
    <h1>Posts</h1>
    <ol>
${rows || '<li class="mono" style="padding:24px 0;color:var(--fg3)">No posts yet.</li>'}
    </ol>
  </section>
</main>
${FOOT}
</body>
</html>
`;
}

function homeSection(posts) {
  if (!posts.length) return '';
  const rows = posts.slice(0, HOME_LIMIT).map((p) => `        <li data-r><a class="post-row" href="posts/${p.slug}/"><span class="mono idx">${shortDate(p.date)}</span><span class="pr-main"><span class="row-h">${esc(p.title)}</span><span class="mono row-m">${esc(p.description)}</span></span><span class="mono pr-go">Read →</span></a></li>`).join('\n');
  const more = posts.length > HOME_LIMIT ? '\n      <a class="link all" href="posts/">All posts</a>' : '';
  return `
  <section class="sec" aria-labelledby="posts-h">
    <div class="wrap">
      <h2 class="mono lab" id="posts-h" data-r>Posts</h2>
      <ol class="posts">
${rows}
      </ol>${more}
    </div>
  </section>
`;
}

function feed(posts) {
  const updated = (posts[0]?.date || new Date()).toISOString();
  const entries = posts.map((p) => `  <entry>
    <title>${esc(p.title)}</title>
    <link href="${p.url}"/>
    <id>${p.url}</id>
    <published>${p.date.toISOString()}</published>
    <updated>${p.date.toISOString()}</updated>
    <summary>${esc(p.description)}</summary>
    <content type="html">${esc(p.feedHtml)}</content>
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>SNDRN — Posts</title>
  <link href="${SITE.url}/"/>
  <link rel="self" href="${SITE.url}/feed.xml"/>
  <id>${SITE.url}/</id>
  <updated>${updated}</updated>
  <author><name>SNDRN</name><email>${SITE.email}</email></author>
${entries}
</feed>
`;
}

function sitemap(posts) {
  const urls = [`${SITE.url}/`, `${SITE.url}/posts/`, ...posts.map((p) => p.url)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
}

async function copyPostAssets(dir, rel = '') {
  for (const name of await readdir(dir)) {
    if (name.startsWith('.') || name.startsWith('_')) continue;
    const src = path.join(dir, name);
    const dest = path.join(OUT, 'posts', rel, name);
    if ((await stat(src)).isDirectory()) {
      await mkdir(dest, { recursive: true });
      await copyPostAssets(src, path.join(rel, name));
    } else if (!name.endsWith('.md')) {
      await cp(src, dest);
    }
  }
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'posts'), { recursive: true });
  for (const p of PUBLIC) await cp(path.join(ROOT, p), path.join(OUT, p), { recursive: true });

  const posts = await loadPosts();
  for (const p of posts) {
    await mkdir(path.join(OUT, 'posts', p.slug), { recursive: true });
    await writeFile(path.join(OUT, 'posts', p.slug, 'index.html'), postPage(p));
  }
  try { await copyPostAssets(POSTS_DIR); } catch { /* no posts folder */ }
  await writeFile(path.join(OUT, 'posts', 'index.html'), listPage(posts));

  const home = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const marker = /<!-- posts:start -->[\s\S]*?<!-- posts:end -->/;
  if (!marker.test(home)) fail('index.html is missing the <!-- posts:start --><!-- posts:end --> markers');
  await writeFile(path.join(OUT, 'index.html'), home.replace(marker, `<!-- posts:start -->${homeSection(posts)}<!-- posts:end -->`));

  await writeFile(path.join(OUT, 'feed.xml'), feed(posts));
  await writeFile(path.join(OUT, 'sitemap.xml'), sitemap(posts));
  await writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

  console.log(`build: ${posts.length} post${posts.length === 1 ? '' : 's'}${WITH_DRAFTS ? ' (drafts included)' : ''} → _site/`);
  for (const p of posts) console.log(`  /posts/${p.slug}/  ${shortDate(p.date)}  ${p.title}${p.draft ? '  [draft]' : ''}`);
}

main().catch((e) => fail(e.stack || e.message));
