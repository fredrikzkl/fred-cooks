import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.resolve('.');
const RECIPES_DIR = path.join(ROOT, 'recipes');
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    return value;
  }
  const d = new Date(value);
  if (isNaN(d)) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function statusLabel(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function groupIngredients(ingredients) {
  if (!ingredients?.length) return [];
  if (!ingredients.some(i => i.section)) {
    return [{ section: null, items: ingredients }];
  }
  const unsectioned = [];
  const sectionMap = new Map();
  for (const ing of ingredients) {
    if (!ing.section) {
      unsectioned.push(ing);
    } else {
      if (!sectionMap.has(ing.section)) sectionMap.set(ing.section, []);
      sectionMap.get(ing.section).push(ing);
    }
  }
  const groups = [];
  if (unsectioned.length) groups.push({ section: null, items: unsectioned });
  for (const [section, items] of sectionMap) groups.push({ section, items });
  return groups;
}

function recipePage(recipe, depth) {
  const up = '../'.repeat(depth);
  const { title, prep_time, total_time, servings, tags, ingredients, sides, status, bodyHtml } = recipe;
  const meta = [
    prep_time && `Forberedelse: ${esc(prep_time)}`,
    total_time && `Totalt: ${esc(total_time)}`,
    servings && `${esc(servings)} porsjoner`,
  ].filter(Boolean).join(' &middot; ');

  return `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — fred cooks</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="${up}assets/style.css">
</head>
<body class="recipe-page">
  <main>
    <a class="back" href="${up}index.html">&larr; Tilbake</a>
    ${status ? `<p class="status-row"><span class="status status-${esc(status)}">${esc(statusLabel(status))}</span></p>` : ''}
    <h1>${esc(title)}</h1>
    ${meta ? `<p class="meta">${meta}</p>` : ''}
    ${tags?.length ? `<ul class="tags">${tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${ingredients?.length ? `
    <section>
      <h2>Ingredienser</h2>
      ${groupIngredients(ingredients).map(g => `
        ${g.section ? `<h3 class="ing-section">${esc(g.section)}</h3>` : ''}
        <ul class="ingredients-list">
          ${g.items.map(i => `<li><span class="ing-name">${esc(i.name)}</span><span class="ing-amount">${esc(i.amount ?? '')}</span></li>`).join('')}
        </ul>`).join('')}
    </section>` : ''}
    ${sides?.length ? `
    <section class="sides">
      <details>
        <summary>Tilbehør</summary>
        <ul class="sides-list">
          ${sides.map(s => `<li>${esc(s)}</li>`).join('')}
        </ul>
      </details>
    </section>` : ''}
    <section class="instructions">
      <h2>Fremgangsmåte</h2>
      ${bodyHtml}
    </section>
    ${recipe.updated ? `<p class="updated">Oppdatert ${esc(recipe.updated)}</p>` : ''}
  </main>
</body>
</html>`;
}

export async function build() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  await fs.cp(path.join(SRC_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));
  await fs.cp(path.join(SRC_DIR, 'assets'), path.join(DIST_DIR, 'assets'), { recursive: true });

  const files = await walk(RECIPES_DIR);
  const index = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const { data, content } = matter(raw);

    const rel = path.relative(RECIPES_DIR, file);
    const parts = rel.split(path.sep);
    const folderSlugs = parts.slice(0, -1).map(slugify);
    const baseName = parts[parts.length - 1].replace(/\.md$/, '');
    const slug = slugify(baseName);
    const urlPath = [...folderSlugs, slug + '.html'].join('/');

    const allTags = data.tags ?? [];

    const sides = data.sides ?? [];
    const status = data.status ? String(data.status).toLowerCase() : null;
    const updated = formatDate(data.updated);

    const recipe = {
      title: data.title ?? baseName,
      prep_time: data.prep_time,
      total_time: data.total_time,
      servings: data.servings,
      tags: allTags,
      ingredients: data.ingredients ?? [],
      sides,
      status,
      updated,
      bodyHtml: marked.parse(content),
    };

    const outPath = path.join(DIST_DIR, 'recipes', urlPath);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const depth = folderSlugs.length + 1;
    await fs.writeFile(outPath, recipePage(recipe, depth));

    index.push({
      url: `recipes/${urlPath}`,
      title: recipe.title,
      tags: allTags,
      ingredients: recipe.ingredients.map(i => i.name),
      sides,
      status,
      updated,
      prep_time: recipe.prep_time ?? null,
      total_time: recipe.total_time ?? null,
      servings: recipe.servings ?? null,
    });
  }

  index.sort((a, b) => a.title.localeCompare(b.title));
  await fs.writeFile(
    path.join(DIST_DIR, 'search-index.json'),
    JSON.stringify(index, null, 2),
  );

  console.log(`built ${index.length} recipes -> ${path.relative(ROOT, DIST_DIR)}/`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  build().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
