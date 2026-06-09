import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const RECIPES_DIR = path.resolve('recipes');

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

function emitScalar(v) {
  if (v == null) return '';
  const s = String(v);
  const needsQuote =
    s === '' ||
    /[:,\{\}\[\]&*#?|<>=!%@`"\\]/.test(s) ||
    /^[\s\-?:,\[\]\{\}&*#!|>=%@`"'\\]/.test(s) ||
    /\s$/.test(s);
  if (needsQuote) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function formatIngredientItems(items, indent) {
  const nameParts = items.map(o => `name: ${emitScalar(o.name)},`);
  const nameWidth = Math.max(...nameParts.map(s => s.length));
  return items.map((o, i) => {
    const name = nameParts[i].padEnd(nameWidth);
    const amount = `amount: ${emitScalar(o.amount)}`;
    const section = (o.section != null && o.section !== '')
      ? `, section: ${emitScalar(o.section)}`
      : '';
    return `${indent}- { ${name} ${amount}${section} }`;
  }).join('\n');
}

function formatFile(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return text;

  let fmEnd = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { fmEnd = i; break; }
  }
  if (fmEnd === -1) return text;

  let ingStart = -1;
  for (let i = 1; i < fmEnd; i++) {
    if (/^ingredients:\s*$/.test(lines[i])) { ingStart = i; break; }
  }
  if (ingStart === -1) return text;

  let ingEnd = fmEnd;
  for (let i = ingStart + 1; i < fmEnd; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('-')) continue;
    ingEnd = i;
    break;
  }

  const rawBlock = lines.slice(ingStart + 1, ingEnd);
  const items = [];
  const dashIndent = '  ';
  for (const line of rawBlock) {
    if (line.trim() === '') continue;
    const m = line.match(/^\s*-\s*(\{.*\})\s*$/);
    if (!m) return text;
    const body = m[1].replace(/,\s*\}$/, '}');
    let obj;
    try { obj = yaml.load(body); } catch { return text; }
    if (!obj || typeof obj !== 'object') return text;
    items.push(obj);
  }
  if (!items.length) return text;

  const formatted = formatIngredientItems(items, dashIndent);
  const newLines = [
    ...lines.slice(0, ingStart + 1),
    ...formatted.split('\n'),
    ...lines.slice(ingEnd),
  ];
  return newLines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length
    ? args.map(a => path.resolve(a))
    : await walk(RECIPES_DIR);
  let changed = 0;
  for (const file of files) {
    const before = await fs.readFile(file, 'utf8');
    const after = formatFile(before);
    if (after !== before) {
      await fs.writeFile(file, after);
      changed++;
      console.log(`formatted ${path.relative('.', file)}`);
    }
  }
  if (!args.length) console.log(`${changed} file(s) changed`);
}

main().catch(e => { console.error(e); process.exit(1); });
