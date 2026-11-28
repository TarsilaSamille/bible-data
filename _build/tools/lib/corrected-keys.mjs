// Chaves que vieram dos JSONs de correção v5. Ferramentas de curadoria,
// etimologia (PROPN) e lemas NÃO podem sobrescrever nada que o JSON trouxe.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

function findDictReview(start) {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const cand = join(dir, 'dict review');
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return null;
}

/** Conjunto de superfícies corrigidas para `lang` (NFC + minúsculas). */
export function correctedKeysFor(lang, raiz = process.cwd()) {
  const out = new Set();
  const dir = findDictReview(raiz);
  if (!dir) return out;
  let names = [];
  try {
    names = readdirSync(dir).filter(
      (f) => f === `correcao-bible-data-${lang}.json` || /^correcao-bible-data.*\.json$/i.test(f),
    );
  } catch {
    return out;
  }
  for (const f of names) {
    // Só o arquivo do idioma pedido (ou o legado sem sufixo, quando vazio).
    if (f !== `correcao-bible-data-${lang}.json` && f !== 'correcao-bible-data.json') continue;
    try {
      const raw = readFileSync(join(dir, f), 'utf8').trim();
      if (!raw || raw === '{}') continue;
      const data = JSON.parse(raw);
      for (const k of Object.keys(data)) {
        const nfc = k.normalize('NFC');
        out.add(nfc);
        out.add(nfc.toLowerCase());
      }
    } catch {}
  }
  return out;
}

export const isCorrected = (keys, surface) =>
  keys.has(surface.normalize('NFC')) || keys.has(surface.toLowerCase());
