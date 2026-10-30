#!/usr/bin/env node
/**
 * Script universal para aplicar correções multilingues de dicionário em `bible-data`.
 * Suporta qualquer idioma bastando adicionar o sufixo da língua no nome do arquivo:
 *
 * Exemplos de arquivos suportados:
 *   - correcao-bible-data-heb.json  -> Hebraico (dict/heb)
 *   - correcao-bible-data-grc.json  -> Grego (dict/grc)
 *   - correcao-bible-data-la.json   -> Latim (dict/la)
 *   - correcao-bible-data-bju.json  -> Bidayuh (dict/bju)
 *   - correcao-bible-data-pt.json   -> Português (dict/pt)
 *   - correcao-bible-data-en.json   -> Inglês (dict/en)
 *   - correcao-bible-data-es.json   -> Espanhol (dict/es)
 *   - correcao-bible-data.json      -> Grego por padrão ou auto-detectado
 *
 * Uso:
 *   mise run apply-correcoes
 * Ou:
 *   node _build/tools/apply-correcoes.mjs [arquivo_ou_idioma]
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_DATA_ROOT = join(__dirname, '..', '..');
const BIBLE_READER_WEB_ROOT = join(REPO_DATA_ROOT, '..', '..');
const MESTRADO_ROOT = join(REPO_DATA_ROOT, '..', '..', '..');

// Mapeamento de sufixos/nomes para código canônico de pasta em dict/
const SUFFIX_TO_LANG = {
  grc: 'grc',
  el: 'grc',
  greek: 'grc',
  grego: 'grc',

  heb: 'heb',
  he: 'heb',
  hebrew: 'heb',
  hebraico: 'heb',

  la: 'la',
  lat: 'la',
  latin: 'la',
  latim: 'la',

  bju: 'bju',
  bidayuh: 'bju',

  pt: 'pt',
  por: 'pt',
  portugues: 'pt',

  en: 'en',
  eng: 'en',
  ingles: 'en',

  es: 'es',
  spa: 'es',
  espanhol: 'es',

  id: 'id',
  ind: 'id',
  indonesio: 'id',

  gn: 'gn',
  gun: 'gn',
  guarani: 'gn',

  ar: 'ar',
  ara: 'ar',
  arabe: 'ar',

  de: 'de',
  deu: 'de',
  ger: 'de',
  alemao: 'de',

  fr: 'fr',
  fra: 'fr',
  fre: 'fr',
  frances: 'fr',

  ru: 'ru',
  rus: 'ru',
  russo: 'ru',

  zh: 'zh',
  zho: 'zh',
  chi: 'zh',
  chines: 'zh',

  ja: 'ja',
  jpn: 'ja',
  japones: 'ja',

  ko: 'ko',
  kor: 'ko',
  coreano: 'ko'
};

// Textos canônicos de referência em bolls/ para cada língua
const CANONICAL_TEXTS = {
  grc: ['NA28', 'LXX'],
  heb: ['WLC'],
  la: ['VULG'],
  pt: ['ARA', 'NAA', 'NVT'],
  en: ['KJV', 'ESV'],
  es: ['RV1960'],
  id: ['TB'],
  gn: ['GUN'],
  bju: ['BJB'],
  de: ['LUT'],
  fr: ['LSG', 'FRLSG'],
  ar: ['SVD'],
  ru: ['SYNOD'],
  zh: ['CUV'],
  ja: ['JPNICT'],
  ko: ['KRV']
};

// Normalização de chaves por língua
function normalizeWord(word, lang) {
  if (!word || typeof word !== 'string') return '';
  if (lang === 'grc') {
    return word
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\.,;:·!·\?\'"«»\(\)\[\]⸂⸃⸀⸁°¹²\s\u2019\u0027]/g, '');
  }
  if (lang === 'heb') {
    return word
      .replace(/[\u0591-\u05C7\u200B-\u200D\uFEFF]/g, '')
      .normalize('NFD')
      .replace(/[שׂשׁ]/g, 'ש')
      .replace(/ך/g, 'כ')
      .replace(/ם/g, 'מ')
      .replace(/ן/g, 'נ')
      .replace(/ף/g, 'פ')
      .replace(/ץ/g, 'צ')
      .replace(/[\.,;:·!·\?\'"«»\(\)\[\]\s־\u05BE]/g, '');
  }
  if (lang === 'ar') {
    return word
      .replace(/[\u064B-\u065F\u0670\u06DF-\u06ED\u0610-\u061A\u0640]/g, '')
      .replace(/[آأإٱ]/g, 'ا')
      .toLowerCase()
      .trim();
  }
  if (lang === 'gn') {
    return word
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
  return word
    .toLowerCase()
    .replace(/[.,;:!?\(\)\[\]"'\u2019\s]/g, '')
    .trim();
}

// Detecta língua pelo nome do arquivo ou conteúdo
function detectLanguage(filePath, contentObj) {
  const name = basename(filePath);
  const match = name.match(/correcao-bible-data(?:-|_)([a-zA-Z]+)\.json$/i);
  if (match) {
    const raw = match[1].toLowerCase();
    if (SUFFIX_TO_LANG[raw]) return SUFFIX_TO_LANG[raw];
  }

  // Se não tem sufixo específico, analisa os caracteres das chaves
  const keys = Object.keys(contentObj);
  if (keys.length > 0) {
    const sample = keys.slice(0, 10).join(' ');
    if (/[\u0590-\u05FF]/.test(sample)) return 'heb';
    if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(sample)) return 'grc';
    if (/[\u0600-\u06FF]/.test(sample)) return 'ar';
    if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(sample)) return 'ja';
    if (/[\uAC00-\uD7AF]/.test(sample)) return 'ko';
    if (/[\u4E00-\u9FFF]/.test(sample)) return 'zh';
  }

  return 'grc'; // padrão
}

// 1. Descobrir arquivos a processar
console.log(`\n=== APLICAR CORREÇÕES MULTILINGUES EM BIBLE-DATA ===`);

const arg = process.argv[2];
const filesToProcess = [];

const searchDirs = [
  MESTRADO_ROOT,
  BIBLE_READER_WEB_ROOT,
  REPO_DATA_ROOT,
  '/Users/macbook/GitHub/mestrado',
  process.cwd(),
  join(process.cwd(), '..')
];
const seenFiles = new Set();

if (arg) {
  // Argumento explícito: pode ser caminho ou código de idioma (ex: heb -> correcao-bible-data-heb.json)
  if (existsSync(arg)) {
    filesToProcess.push(arg);
  } else if (SUFFIX_TO_LANG[arg.toLowerCase()]) {
    const l = SUFFIX_TO_LANG[arg.toLowerCase()];
    const candidateNames = [`correcao-bible-data-${l}.json`, `correcao-bible-data-${arg}.json`];
    for (const d of searchDirs) {
      for (const cn of candidateNames) {
        const full = join(d, cn);
        if (existsSync(full) && !seenFiles.has(full)) {
          filesToProcess.push(full);
          seenFiles.add(full);
        }
      }
    }
  }
} else {
  // Varre a raiz e o repositório por correcao-bible-data*.json
  for (const d of searchDirs) {
    if (!existsSync(d)) continue;
    try {
      for (const f of readdirSync(d)) {
        if (/^correcao-bible-data.*\.json$/i.test(f)) {
          const full = join(d, f);
          if (statSync(full).isFile() && !seenFiles.has(full)) {
            filesToProcess.push(full);
            seenFiles.add(full);
          }
        }
      }
    } catch {}
  }
}

if (filesToProcess.length === 0) {
  console.log(`Nenhum arquivo 'correcao-bible-data*.json' encontrado. Nada a fazer.`);
  process.exit(0);
}

const languagesModified = new Set();
const processedFiles = [];
let totalEntriesApplied = 0;

for (const filePath of filesToProcess) {
  const raw = readFileSync(filePath, 'utf8').trim();
  if (!raw || raw === '{}') {
    console.log(`- ${basename(filePath)}: vazio ({}). Ignorando.`);
    continue;
  }

  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.warn(`- ${basename(filePath)}: erro ao parsear JSON (${err.message}). Ignorando.`);
    continue;
  }

  const entriesCount = Object.keys(data).length;
  if (entriesCount === 0) {
    console.log(`- ${basename(filePath)}: 0 entradas. Ignorando.`);
    continue;
  }

  const lang = detectLanguage(filePath, data);
  const dictLangDir = join(REPO_DATA_ROOT, 'dict', lang);
  if (!existsSync(dictLangDir)) {
    console.warn(`- ${basename(filePath)}: diretório dict/${lang} não encontrado. Ignorando.`);
    continue;
  }

  console.log(`\nProcessando ${basename(filePath)} -> idioma: [${lang.toUpperCase()}] (${entriesCount} palavras)`);

  // Mapear palavras para formas normalizadas
  const wordsMap = new Map();
  for (const [palavra, dados] of Object.entries(data)) {
    const n = normalizeWord(palavra, lang);
    if (!wordsMap.has(n)) wordsMap.set(n, []);
    wordsMap.get(n).push({ original: palavra, dados });
  }

  // Identificar em quais livros bíblicos as palavras ocorrem
  console.log(`  Identificando livros bíblicos para [${lang}]...`);
  const wordToBooks = new Map();

  // 1) Escanear livros existentes em dict/<lang>/*.json
  try {
    const bookFiles = readdirSync(dictLangDir).filter(f => /^\d+\.json$/.test(f));
    for (const bf of bookFiles) {
      const bNum = parseInt(bf.replace('.json', ''), 10);
      try {
        const bData = JSON.parse(readFileSync(join(dictLangDir, bf), 'utf8'));
        for (const k of Object.keys(bData)) {
          const nk = normalizeWord(k, lang);
          if (wordsMap.has(nk)) {
            if (!wordToBooks.has(nk)) wordToBooks.set(nk, new Set());
            wordToBooks.get(nk).add(bNum);
          }
        }
      } catch {}
    }
  } catch {}

  // 2) Escanear textos bíblicos correspondentes em bolls/
  const textNames = CANONICAL_TEXTS[lang] || [];
  for (const tName of textNames) {
    const tDir = join(REPO_DATA_ROOT, 'bolls', tName);
    if (!existsSync(tDir)) continue;
    try {
      const bookDirs = readdirSync(tDir).filter(d => /^\d+$/.test(d));
      for (const bd of bookDirs) {
        const bNum = parseInt(bd, 10);
        const bPath = join(tDir, bd);
        for (const vf of readdirSync(bPath)) {
          if (!vf.endsWith('.json')) continue;
          const verses = JSON.parse(readFileSync(join(bPath, vf), 'utf8'));
          for (const v of verses) {
            if (!v.text) continue;
            const tokens = v.text.split(/\s+/);
            for (const t of tokens) {
              const nt = normalizeWord(t, lang);
              if (wordsMap.has(nt)) {
                if (!wordToBooks.has(nt)) wordToBooks.set(nt, new Set());
                wordToBooks.get(nt).add(bNum);
              }
            }
          }
        }
      }
    } catch {}
  }

  // Livro de fallback para palavras não localizadas diretamente no scan
  const fallbackBook = lang === 'heb' ? 19 : (lang === 'grc' ? 59 : 1);
  for (const normKey of wordsMap.keys()) {
    if (!wordToBooks.has(normKey) || wordToBooks.get(normKey).size === 0) {
      wordToBooks.set(normKey, new Set([fallbackBook]));
    }
  }

  // Aplicar alterações nos arquivos de cada livro
  const targetBooks = new Set();
  for (const set of wordToBooks.values()) {
    for (const b of set) targetBooks.add(b);
  }

  console.log(`  Aplicando correções em ${targetBooks.size} livros do idioma [${lang}]...`);
  let fileModCount = 0;

  for (const b of [...targetBooks].sort((a, b) => a - b)) {
    const bookPath = join(dictLangDir, `${b}.json`);
    let bookData = {};
    if (existsSync(bookPath)) {
      try {
        bookData = JSON.parse(readFileSync(bookPath, 'utf8'));
      } catch {
        bookData = {};
      }
    }

    let modified = false;

    for (const [palavra, dados] of Object.entries(data)) {
      const normKey = normalizeWord(palavra, lang);
      const bSet = wordToBooks.get(normKey);
      if (!bSet || !bSet.has(b)) continue;

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
        modified = true;
        totalEntriesApplied++;
      }
    }

    if (modified) {
      writeFileSync(bookPath, JSON.stringify(bookData, null, 2), 'utf8');
      fileModCount++;
    }
  }

  console.log(`  Sucesso: ${fileModCount} livros atualizados em dict/${lang}.`);
  languagesModified.add(lang);
  processedFiles.push(filePath);
}

if (languagesModified.size === 0) {
  console.log(`\nNenhuma alteração a ser aplicada.`);
  process.exit(0);
}

// 2. Regenerar índices e artefatos necessários
console.log(`\n=== REGENERANDO ÍNDICES DE BIBLE-DATA ===`);
if (languagesModified.has('grc')) {
  console.log(`- Regenerando grc-index.json...`);
  execSync(`node _build/tools/gerar-grc-index.mjs`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
}

for (const lang of languagesModified) {
  console.log(`- Regenerando master.json para [${lang}]...`);
  execSync(`node _build/tools/gen-master.mjs ${lang}`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
}

console.log(`- Regenerando pt_master_glossary.json...`);
execSync(`node _build/tools/gen-pt-glossary.mjs`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });

console.log(`- Empacotando arquivos zip para [${[...languagesModified].join(', ')}]...`);
const langsArgs = [...languagesModified].join(' ');
execSync(`node _build/tools/empacotar.mjs ${langsArgs}`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });

// 3. Invalidação de Cache no Web/PWA
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
      console.log(`\nCache invalidado no Web: google-word-glosses-v${newVer}`);
    }
  } catch (err) {
    console.warn(`Aviso ao atualizar versão de cache:`, err.message);
  }
}

// 4. Git, Tag e Release
console.log(`\n=== PUBLICANDO ALTERAÇÕES ===`);
try {
  execSync(`git add .`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  const status = execSync(`git status --porcelain`, { cwd: REPO_DATA_ROOT, encoding: 'utf8' }).trim();
  const langListStr = [...languagesModified].join(', ');
  if (status) {
    execSync(`git commit -m "feat(dict): aplica correções léxicas [${langListStr}] e atualiza índices"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
    execSync(`git push origin main`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  }

  // Próxima tag vYYYY.MM.DD.XX
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
  execSync(`git tag -a "${newTag}" -m "Release ${newTag} [${langListStr}]"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
  execSync(`git push origin "${newTag}"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });

  try {
    const assetsDist = join(REPO_DATA_ROOT, '_build', 'dist');
    const zipFiles = existsSync(assetsDist) ? readdirSync(assetsDist).filter(f => f.endsWith('.zip')).map(f => join(assetsDist, f)) : [];
    if (zipFiles.length > 0) {
      console.log(`Publicando release com ${zipFiles.length} zip(s) via gh release...`);
      execSync(`gh release create "${newTag}" ${zipFiles.map(z => `"${z}"`).join(' ')} --repo TarsilaSamille/bible-data --title "${newTag}" --notes "Atualização multilingue de dicionários (${langListStr}) - ${newTag}"`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });
    }
  } catch {
    console.log(`Nota: GitHub Actions publicará os assets automaticamente a partir da tag ${newTag}.`);
  }

  console.log(`\nTag ${newTag} publicada com sucesso!`);
} catch (gitErr) {
  console.error(`ERRO no git:`, gitErr.message);
  process.exit(1);
}

// 5. Esvaziar os arquivos de correções processados
console.log(`\nEsvaziando arquivos de correções processados...`);
for (const p of processedFiles) {
  writeFileSync(p, '{}\n', 'utf8');
  console.log(`- ${basename(p)} -> esvaziado ({})`);
}

console.log(`\n=== CONCLUÍDO COM SUCESSO! Total de entradas aplicadas: ${totalEntriesApplied} ===\n`);
