// Scaffolds a draft post: npm run new -- "Post title"
import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('usage: npm run new -- "Post title"');
  process.exit(1);
}
const slug = title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'posts', `${slug}.md`);
try {
  await access(file);
  console.error(`posts/${slug}.md already exists`);
  process.exit(1);
} catch { /* free */ }
const today = new Date().toISOString().slice(0, 10);
await writeFile(file, `---
title: "${title.replace(/"/g, '\\"')}"
description: ""
date: ${today}
tags: []
draft: true
---

Write the post here.
`);
console.log(`created posts/${slug}.md (draft: true; set draft: false to publish)`);
