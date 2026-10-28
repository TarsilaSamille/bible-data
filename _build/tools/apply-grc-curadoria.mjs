#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const CURADORIA = '/Users/macbook/GitHub/mestrado/bible-reader-web/docs/referencia/curadoria/grc';

async function loadJson(p) { return JSON.parse(await readFile(p, 'utf8')); }

async function main() {
  const lookup = new Map();
  const curadosFile = join(CURADORIA, 'CURADOS.JSON');
  if (existsSync(curadosFile)) {
    const d = await loadJson(curadosFile);
    for (const it of d.itens ?? []) {
      if (it.estado === 'curado' && it.curadoria) lookup.set(it.palavra, it.curadoria);
    }
  }
  for (let p = 1; p <= 7; p++) {
    const f = join(CURADORIA, `CURADORIA-GRC-part${String(p).padStart(2,'0')}.json`);
    if (!existsSync(f)) continue;
    const d = await loadJson(f);
    for (const it of d.itens ?? []) {
      if (it.estado === 'curado' && it.curadoria && !lookup.has(it.palavra)) lookup.set(it.palavra, it.curadoria);
    }
  }
  console.log(`Curated lookup: ${lookup.size} words`);

  let applied = 0, files = 0;
  for (let b = 1; b <= 66; b++) {
    const path = join(RAIZ, 'dict', 'grc', `${b}.json`);
    if (!existsSync(path)) continue;
    const data = await loadJson(path);
    let changed = false;
    for (const [surface, entry] of Object.entries(data)) {
      if (!entry || typeof entry !== 'object') continue;
      const cur = lookup.get(surface);
      if (!cur) continue;
      let touched = false;
      for (const k of ['pt','es','id','en']) {
        const v = cur[k];
        if (typeof v === 'string' && v.trim() && !v.startsWith('[')) { entry[k] = v; touched = true; }
      }
      if (touched) { applied++; changed = true; }
    }
    if (changed) { await writeFile(path, JSON.stringify(data), 'utf8'); files++; }
  }

  const allKeys = new Set();
  for (let b = 1; b <= 66; b++) {
    const path = join(RAIZ, 'dict', 'grc', `${b}.json`);
    if (!existsSync(path)) continue;
    const data = await loadJson(path);
    for (const k of Object.keys(data)) allKeys.add(k);
  }
  const missing = [...lookup.keys()].filter(w => !allKeys.has(w));
  console.log(`Applied: ${applied} entries across ${files} files`);
  console.log(`Curated words not found in any grc book: ${missing.length}`);
  if (missing.length) console.log('Sample missing:', missing.slice(0,20));
}

main().catch(e => { console.error(e); process.exit(1); });
