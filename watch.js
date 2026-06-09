import { watch } from 'node:fs';
import { build } from './build.js';

const DIRS = ['src', 'recipes'];
let timer = null;

function schedule(label) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    console.log(`rebuilding (${label})…`);
    try {
      await build();
    } catch (e) {
      console.error(e);
    }
  }, 80);
}

await build().catch(e => console.error(e));

for (const dir of DIRS) {
  watch(dir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (filename.startsWith('.') || filename.includes('/.')) return;
    schedule(`${dir}/${filename}`);
  });
}

console.log('watching src/ and recipes/ — Ctrl+C to stop');
