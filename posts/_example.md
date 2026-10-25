---
# Reference template. Files starting with "_" are never published.
# Copy it, or run: npm run new -- "Post title"
title: "Post title"                       # required
description: "One or two lines. Used under the title, in link previews and on the homepage."
date: 2026-10-25                          # required, YYYY-MM-DD
tags: [routing, research]                 # optional
image: images/example-cover.png           # optional cover + social preview image, relative to posts/
image_alt: "What the cover image shows"   # optional
cover: false                              # optional; keep `image` for link previews but don't show it on top
author: SNDRN                             # optional (default SNDRN)
slug: custom-url                          # optional; default is the file name -> /posts/<slug>/
draft: true                               # optional; drafts are skipped unless you build with --drafts
---

Body text in Markdown. **Bold**, *italic*, `inline code`, and [links](https://example.com).
External links open in a new tab.

## Headings get anchor links

Images live in `posts/images/` and are referenced relative to `posts/`:

![Alt text describing the image](images/example.png "Optional caption shown under the image")

> Block quotes for pull-quotes.

- Lists
- work as usual

| Tables | work too |
|---|---|
| a | b |

Raw HTML is passed through, so embeds (e.g. an `<iframe>`) are possible.
Note: relative paths inside raw HTML are resolved from the post URL (`/posts/<slug>/`), so use `../images/...`.
