#!/usr/bin/env node
// Gera o conjunto de chaves que vieram dos JSONs de correção v5.
// O runtime usa esta lista para dar precedência ao verbete corrigido sobre
// o gazetteiro de nomes próprios (etimologia) e sobre o POS legado.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const RAIZ = process.cwd();

function findDictReview(start) {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const cand = join(dir, 'dict review');
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return null;
}

const dir = findDictReview(RAIZ);
if (!dir) {
  console.error('gen-corrected-keys: pasta "dict review" não encontrada');
  process.exit(1);
}

const out = {};
for (const f of readdirSync(dir).sort()) {
  const m = f.match(/^correcao-bible-data-([a-z]{2,3})\.json$/i);
  if (!m) continue;
  const raw = readFileSync(join(dir, f), 'utf8').trim();
  if (!raw || raw === '{}') continue;
  const data = JSON.parse(raw);
  const keys = [...new Set(Object.keys(data).map((k) => k.normalize('NFC')))];
  if (keys.length) out[m[1].toLowerCase()] = keys.sort();
}

const dest = join(RAIZ, '..', '..', 'src', 'lib', 'dictionary', 'corrected-keys.generated.json');
writeFileSync(dest, JSON.stringify(out));
console.log(
  `corrected-keys: ${Object.entries(out).map(([l, ks]) => `${l}=${ks.length}`).join(', ')} → ${dest}`,
);
