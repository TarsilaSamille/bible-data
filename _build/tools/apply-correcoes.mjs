#!/usr/bin/env node
/**
 * Script para aplicar correções do grego de `correcao-bible-data.json` em `bible-data`,
 * regenerar índices e artefatos, comitar, subir tag de versão e esvaziar o arquivo de correções.
 *
 * Pode ser executado diretamente com:
 *   node _build/tools/apply-correcoes.mjs
 * Ou via mise:
 *   mise run apply-correcoes
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_DATA_ROOT = join(__dirname, '..', '..');
const BIBLE_READER_WEB_ROOT = join(REPO_DATA_ROOT, '..');
const MESTRADO_ROOT = join(REPO_DATA_ROOT, '..', '..');

// 1. Localizar arquivo de correções
const CORRECOES_PATH = process.env.CORRECOES_PATH ||
  [
    join(MESTRADO_ROOT, 'correcao-bible-data.json'),
    join(REPO_DATA_ROOT, 'correcao-bible-data.json'),
    '/Users/macbook/GitHub/mestrado/correcao-bible-data.json'
  ].find(p => existsSync(p)) || join(MESTRADO_ROOT, 'correcao-bible-data.json');

console.log(`\n=== APLICAR CORREÇÕES BIBLE-DATA (GREGO) ===`);
console.log(`Arquivo de correções: ${CORRECOES_PATH}`);

if (!existsSync(CORRECOES_PATH)) {
  console.log(`Arquivo não encontrado em: ${CORRECOES_PATH}. Nada a fazer.`);
  process.exit(0);
}

const correcoesRaw = readFileSync(CORRECOES_PATH, 'utf8').trim();
if (!correcoesRaw || correcoesRaw === '{}') {
  console.log(`Arquivo ${CORRECOES_PATH} está vazio ({}). Nada a aplicar.`);
  process.exit(0);
}

let correcoes = {};
try {
  correcoes = JSON.parse(correcoesRaw);
} catch (err) {
  console.error(`ERRO: falha ao interpretar JSON em ${CORRECOES_PATH}:`, err.message);
  process.exit(1);
}

const totalPalavras = Object.keys(correcoes).length;
if (totalPalavras === 0) {
  console.log(`Nenhuma palavra para corrigir. Nada a aplicar.`);
  process.exit(0);
}

console.log(`Total de palavras a aplicar: ${totalPalavras}`);

// Função de normalização grega
function normalizeGreek(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\.,;:·!·\?\'"«»\(\)\[\]⸂⸃⸀⸁°¹²\s\u2019\u0027]/g, '');
}

// 2. Mapear em quais livros do NT (40 a 66) cada palavra ocorre
const na28Dir = join(REPO_DATA_ROOT, 'bolls', 'NA28');
const wordsMap = new Map(); // norm -> Array<{ original, data }>

for (const [palavra, dados] of Object.entries(correcoes)) {
  const n = normalizeGreek(palavra);
  if (!wordsMap.has(n)) wordsMap.set(n, []);
  wordsMap.get(n).push({ original: palavra, dados });
}

console.log(`Escaneando textos do NT (NA28) para localizar livros das palavras...`);
const wordToBooks = new Map(); // norm -> Set(bookNumbers)

for (let b = 40; b <= 66; b++) {
  const bDir = join(na28Dir, String(b));
  if (!existsSync(bDir)) continue;
  try {
    for (const f of readdirSync(bDir)) {
      if (!f.endsWith('.json')) continue;
      const verses = JSON.parse(readFileSync(join(bDir, f), 'utf8'));
      for (const v of verses) {
        if (!v.text) continue;
        const tokens = v.text.split(/\s+/);
        for (const t of tokens) {
          const nt = normalizeGreek(t);
          if (wordsMap.has(nt)) {
            if (!wordToBooks.has(nt)) wordToBooks.set(nt, new Set());
            wordToBooks.get(nt).add(b);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Aviso ao ler NA28 livro ${b}:`, err.message);
  }
}

// Para palavras não mapeadas por texto direto, associar ao livro 59 (Tiago) e livro 40 (Mateus)
for (const [normKey, entries] of wordsMap.entries()) {
  if (!wordToBooks.has(normKey) || wordToBooks.get(normKey).size === 0) {
    wordToBooks.set(normKey, new Set([59, 40]));
  }
}

// 3. Aplicar as alterações nos arquivos dict/grc/<livro>.json
const dictGrcDir = join(REPO_DATA_ROOT, 'dict', 'grc');
const booksToUpdate = new Set();
for (const set of wordToBooks.values()) {
  for (const b of set) booksToUpdate.add(b);
}

console.log(`Aplicando correções em ${booksToUpdate.size} livros do grego...`);
let appliedCount = 0;

for (const b of [...booksToUpdate].sort((a, b) => a - b)) {
  const bookPath = join(dictGrcDir, `${b}.json`);
  let bookData = {};
  if (existsSync(bookPath)) {
    try {
      bookData = JSON.parse(readFileSync(bookPath, 'utf8'));
    } catch {
      bookData = {};
    }
  }

  let bookModified = false;

  for (const [palavra, dados] of Object.entries(correcoes)) {
    const normKey = normalizeGreek(palavra);
    const targetBooks = wordToBooks.get(normKey);
    if (!targetBooks || !targetBooks.has(b)) continue;

    // Chaves a inserir/atualizar: normalizada e original (acentuada)
    const keysToTouch = new Set([normKey]);
    if (palavra !== normKey) keysToTouch.add(palavra);

    for (const k of keysToTouch) {
      const prev = bookData[k] || {};
      bookData[k] = {
        root: dados.root || prev.root || normKey,
        translit: dados.translit || prev.translit || '',
        en: dados.en || prev.en || '',
        pt: dados.pt || prev.pt || '',
        es: dados.es || prev.es || '',
        id: dados.id || prev.id || ''
      };
      bookModified = true;
      appliedCount++;
    }
  }

  if (bookModified) {
    writeFileSync(bookPath, JSON.stringify(bookData, null, 2), 'utf8');
  }
}

console.log(`Entradas atualizadas / inseridas: ${appliedCount}`);

// 4. Regenerar índices e artefatos de bible-data
console.log(`\nRegenerando índices de bible-data...`);
try {
  execSync(`node _build/tools/gerar-grc-index.mjs`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  execSync(`node _build/tools/gen-master.mjs grc`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  execSync(`node _build/tools/gen-pt-glossary.mjs`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  execSync(`node _build/tools/empacotar.mjs`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
} catch (err) {
  console.error(`ERRO na regeneração de índices:`, err.message);
  process.exit(1);
}

// 5. Invalidação de Cache no Web/PWA (Regra 3 do GEMINI.md)
const usePrefPath = join(BIBLE_READER_WEB_ROOT, 'src', 'hooks', 'profile', 'usePreferences.ts');
if (existsSync(usePrefPath)) {
  try {
    let prefContent = readFileSync(usePrefPath, 'utf8');
    const match = prefContent.match(/google-word-glosses-v(\d+)/);
    if (match) {
      const oldVer = parseInt(match[1], 10);
      const newVer = oldVer + 1;
      prefContent = prefContent.replace(`google-word-glosses-v${oldVer}`, `google-word-glosses-v${newVer}`);
      writeFileSync(usePrefPath, prefContent, 'utf8');
      console.log(`Cache invalidado no Web: google-word-glosses-v${newVer}`);
    }
  } catch (err) {
    console.warn(`Aviso ao atualizar versão de cache:`, err.message);
  }
}

// 6. Commit, Tag e Publicação em bible-data
console.log(`\nPublicando alterações no repositório bible-data...`);
try {
  execSync(`git add .`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  const status = execSync(`git status --porcelain`, { cwd: REPO_DATA_ROOT, encoding: 'utf8' }).trim();
  if (status) {
    execSync(`git commit -m "feat(dict/grc): aplica correções léxicas e atualiza índices"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
    execSync(`git push origin main`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  } else {
    console.log(`Nenhuma alteração pendente de commit em bible-data.`);
  }

  // Determinar a nova tag de versão no formato vYYYY.MM.DD.XX
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `v${yyyy}.${mm}.${dd}.`;

  const existingTagsRaw = execSync(`git tag -l "${prefix}*"`, { cwd: REPO_DATA_ROOT, encoding: 'utf8' }).trim();
  let maxSeq = 0;
  if (existingTagsRaw) {
    for (const t of existingTagsRaw.split('\n')) {
      const numPart = t.replace(prefix, '').trim();
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  }
  const nextSeq = maxSeq + 1;
  const newTag = `${prefix}${nextSeq}`;

  console.log(`Criando e enviando nova tag: ${newTag}`);
  execSync(`git tag -a "${newTag}" -m "Release ${newTag}"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  execSync(`git push origin "${newTag}"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });

  // Publicar release com assets caso o gh esteja logado
  try {
    const assetsDist = join(REPO_DATA_ROOT, '_build', 'dist');
    const zipFiles = existsSync(assetsDist) ? readdirSync(assetsDist).filter(f => f.endsWith('.zip')).map(f => join(assetsDist, f)) : [];
    if (zipFiles.length > 0) {
      console.log(`Publicando release com ${zipFiles.length} zip(s) via gh release...`);
      execSync(`gh release create "${newTag}" ${zipFiles.map(z => `"${z}"`).join(' ')} --repo TarsilaSamille/bible-data --title "${newTag}" --notes "Atualização automática de dicionários ${newTag}"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
    }
  } catch (ghErr) {
    console.log(`Nota: GitHub Actions publicará os assets da release automaticamente a partir da tag ${newTag}.`);
  }

  console.log(`\nTag ${newTag} publicada com sucesso!`);
} catch (gitErr) {
  console.error(`ERRO ao publicar no git:`, gitErr.message);
  process.exit(1);
}

// 7. Esvaziar o arquivo de correções
console.log(`\nEsvaziando arquivo de correções ${CORRECOES_PATH}...`);
writeFileSync(CORRECOES_PATH, '{}\n', 'utf8');
console.log(`Arquivo de correções esvaziado com sucesso ({})!`);
console.log(`\n=== CONCLUÍDO COM SUCESSO ===\n`);

