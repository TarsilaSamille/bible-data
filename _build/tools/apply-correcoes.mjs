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
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_DATA_ROOT = join(__dirname, '..', '..');
const WEB_ROOT_FROM_SUBMODULE = join(REPO_DATA_ROOT, '..', '..');
const BIBLE_READER_WEB_ROOT = existsSync(join(WEB_ROOT_FROM_SUBMODULE, '.git'))
  ? WEB_ROOT_FROM_SUBMODULE
  : join(REPO_DATA_ROOT, '..', 'bible-reader-web');
const MESTRADO_ROOT = join(BIBLE_READER_WEB_ROOT, '..');
const DICT_REVIEW_DIR = join(MESTRADO_ROOT, 'dict review');

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
  coreano: 'ko',

  it: 'it',
  ita: 'it',
  italian: 'it',
  italiano: 'it'
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
  ko: ['KRV'],
  it: ['NR06']
};

// Chave de lookup EXATA (QA v5): NFC + apóstrofo tipográfico unificado,
// SEM remover acentos, niqqud, tashkeel, espíritos gregos nem apóstrofos.
// Só se remove pontuação COLADA no fim da forma ("," em ru, "]" em id,
// ";" em grc, "…" em fr, "?"/"؟" em ar) — nunca no meio da palavra.
const normCache = new Map();
function lookupKey(word, lang) {
  if (!word || typeof word !== 'string') return '';
  const cacheKey = `${lang}:${word}`;
  const cached = normCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const res = word
    .normalize('NFC')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u037E;.,\]…?؟]+$/u, '')
    .trim();

  normCache.set(cacheKey, res);
  return res;
}

/** 2º nível de fallback: diferencia maiúsculas/minúsculas mas PRESERVA
 *  diacríticos e apóstrofos. Nunca existe fallback "removendo marcas". */
function foldKey(key) {
  return key.toLowerCase();
}

/**
 * `/` separa classes contextuais alternativas; `+` é FUSÃO de clítico na mesma
 * palavra. Correções antigas gravaram fusões reais com `/` — fr `d’Abraham`
 * (ADP/PROPN), id `oleh-Nya` (ADP/PRON), bju `mun-e` (ADP/NOUN) — e isso
 * reaparecia no .txt como (ADP/PROPN) em vez de (ADP+PROPN).
 *
 * Regra conservadora:
 *  - se algum segmento já tem `+`, o `/` separa alternativas fundidas
 *    (fr `c’était` = PRON+AUX/PRON+VERB) e NÃO é mexido;
 *  - sem `+`, converte apenas quando a forma tem apóstrofo de elisão ou sufixo
 *    clítico conhecido da língua. Compostos/reduplicações legítimos
 *    (fr `au-dessus`, `c'est-à-dire`, id `bernyala-nyala`) ficam com `/`.
 */
const CLITIC_SUFFIX = {
  id: /(?:-nya|-Nya|-ku|-mu|-kah|-lah|-pun)$/,
  bju: /(?:-e|-ꞌe)$/,
  pt: /-(?:me|te|se|lhe|lo|la|os|as|nos|vos|o|a)(?:-|$)/,
};
const APOSTROPHE = /['’ʼ]/;

function normalizePosForFusion(lang, key, pos) {
  if (typeof pos !== 'string' || !pos.includes('/') || pos.includes('+')) return pos;
  const k = String(key).normalize('NFC');
  if ((k.match(/-/g) || []).length >= 2 && APOSTROPHE.test(k)) return pos; // expressão lexicalizada
  const fusion = APOSTROPHE.test(k) || CLITIC_SUFFIX[lang]?.test(k);
  return fusion ? pos.replace(/\//g, '+') : pos;
}

// Varredura completa dos dicionários: node apply-correcoes.mjs --normalize-pos
if (process.argv.includes('--normalize-pos')) {
  let arquivos = 0, chaves = 0;
  const langs = [...new Set(Object.values(SUFFIX_TO_LANG))];
  for (const lang of langs) {
    const dir = join(REPO_DATA_ROOT, 'dict', lang);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => /^\d+\.json$/.test(f))) {
      const p = join(dir, f);
      const d = JSON.parse(readFileSync(p, 'utf8'));
      let n = 0;
      for (const [k, v] of Object.entries(d)) {
        if (!v || typeof v !== 'object' || typeof v.pos !== 'string') continue;
        const np = normalizePosForFusion(lang, k, v.pos);
        if (np !== v.pos) { v.pos = np; n++; }
      }
      if (n) { writeFileSync(p, JSON.stringify(d, null, 2), 'utf8'); arquivos++; chaves += n; }
    }
  }
  console.log(`normalize-pos: ${chaves} chaves em ${arquivos} arquivos ajustadas (fusão +).`);
  process.exit(0);
}

// Autoteste rápido da regra de ouro: node apply-correcoes.mjs --self-test
if (process.argv.includes('--self-test')) {
  const pairs = [
    ['fr', 'la', 'l’a'], ['fr', 'deux', 'd’eux'],
    ['en', 'things', "things'"], ['en', 'gods', "God's"],
    ['ar', 'فِي', 'فِيَّ'], ['ar', 'مَنْ', 'مِنْ'],
    ['grc', 'οὐ', 'οὗ'], ['grc', 'εἰ', 'εἶ'],
    ['heb', 'שָׁם', 'שָׂם'], ['heb', 'עֵשָׂו', 'עָשׂוּ'],
  ];
  for (const [lang, a, b] of pairs) {
    assert.notEqual(lookupKey(a, lang), lookupKey(b, lang), `${lang}: ${a} ≠ ${b}`);
  }
  assert.equal(lookupKey('God’s', 'en'), lookupKey("God's", 'en'), 'apóstrofo unificado');
  assert.equal(foldKey(lookupKey('Kepada-Ku', 'id')), foldKey(lookupKey('kepada-ku', 'id')));
  assert.equal(lookupKey('situ.]', 'id'), 'situ', 'pontuação terminal removida');
  assert.equal(lookupKey('ya.', 'ru'), 'ya', 'ponto colado removido');
  assert.equal(lookupKey('فِي؟', 'ar'), 'فِي', '؟ removida');
  // fusão real: `/` era usado indevidamente no lugar de `+`
  assert.equal(normalizePosForFusion('fr', "d’Abraham", 'ADP/PROPN'), 'ADP+PROPN');
  assert.equal(normalizePosForFusion('fr', "d'homme", 'ADP/NOUN'), 'ADP+NOUN');
  assert.equal(normalizePosForFusion('id', 'oleh-Nya', 'ADP/PRON'), 'ADP+PRON');
  assert.equal(normalizePosForFusion('bju', 'mun-e', 'ADP/NOUN'), 'ADP+NOUN');
  assert.equal(normalizePosForFusion('pt', 'ser-vos-ão', 'AUX/VERB'), 'AUX+VERB');
  // alternativas já fundidas e compostos legítimos ficam como estão
  assert.equal(normalizePosForFusion('fr', 'c’était', 'PRON+AUX/PRON+VERB'), 'PRON+AUX/PRON+VERB');
  assert.equal(normalizePosForFusion('fr', 'au-dessus', 'ADP/ADV'), 'ADP/ADV');
  assert.equal(normalizePosForFusion('fr', "c'est-à-dire", 'CCONJ/ADV'), 'CCONJ/ADV');
  assert.equal(normalizePosForFusion('id', 'bernyala-nyala', 'VERB/ADJ'), 'VERB/ADJ');
  console.log('apply-correcoes: chave exata NFC/fallback por caixa e POS de fusão OK');
  process.exit(0);
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
  DICT_REVIEW_DIR,
  MESTRADO_ROOT,
  BIBLE_READER_WEB_ROOT,
  REPO_DATA_ROOT,
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

  // Mapear palavras para chaves EXATAS em NFC. O fallback por caixa é
  // indexado à parte e nunca remove diacríticos/apóstrofos.
  const wordsMap = new Map();
  const ciToExact = new Map();
  for (const [palavra, dados] of Object.entries(data)) {
    const n = lookupKey(palavra, lang);
    if (!wordsMap.has(n)) wordsMap.set(n, []);
    wordsMap.get(n).push({ original: palavra, dados });
    const ci = foldKey(n);
    if (!ciToExact.has(ci)) ciToExact.set(ci, []);
    ciToExact.get(ci).push(n);
  }
  const matchExactKeys = (candidate) => {
    const ek = lookupKey(candidate, lang);
    if (wordsMap.has(ek)) return [ek];
    return ciToExact.get(foldKey(ek)) ?? [];
  };

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
          for (const nk of matchExactKeys(k)) {
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
        if (bNum < 1 || bNum > 66) continue;
        const bPath = join(tDir, bd);
        for (const vf of readdirSync(bPath)) {
          if (!vf.endsWith('.json')) continue;
          const verses = JSON.parse(readFileSync(join(bPath, vf), 'utf8'));
          for (const v of verses) {
            if (!v.text) continue;
            const tokens = v.text.split(/\s+/);
            for (const t of tokens) {
              for (const nt of matchExactKeys(t)) {
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

  // Pre-computar chaves normalizadas das correções
  const entriesWithNorm = Object.entries(data).map(([palavra, dados]) => ({
    palavra,
    dados,
    normKey: lookupKey(palavra, lang)
  }));

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

    // Índice em 2 níveis: chave exata em NFC primeiro; só se não houver
    // exata, chave case-insensitive (com diacríticos/apóstrofos intactos).
    const exactIndex = new Map();
    const ciIndex = new Map();
    for (const existingKey of Object.keys(bookData)) {
      const ek = lookupKey(existingKey, lang);
      const ci = foldKey(ek);
      if (!exactIndex.has(ek)) exactIndex.set(ek, []);
      exactIndex.get(ek).push(existingKey);
      if (!ciIndex.has(ci)) ciIndex.set(ci, []);
      ciIndex.get(ci).push(existingKey);
    }

    let modified = false;

    for (const { palavra, dados, normKey } of entriesWithNorm) {
      const bSet = wordToBooks.get(normKey);
      if (!bSet || !bSet.has(b)) continue;

      const keysToTouch = new Set();
      const exactHits = exactIndex.get(normKey);
      if (exactHits?.length) {
        for (const k of exactHits) keysToTouch.add(k);
      } else {
        const ciHits = ciIndex.get(foldKey(normKey));
        if (ciHits?.length) {
          for (const k of ciHits) keysToTouch.add(k);
        } else {
          // Forma ainda não cadastrada: cria a chave exata do JSON (NFC).
          keysToTouch.add(normKey);
          if (palavra !== normKey) keysToTouch.add(palavra);
        }
      }

      for (const k of keysToTouch) {
        const prev = bookData[k] || {};
        const mesclado = { ...prev };
        // Campos canônicos: a correção vence; se faltar, mantém o que já havia.
        for (const campo of ['root', 'translit', 'en', 'pt', 'es', 'id']) {
          const v = dados[campo] || prev[campo];
          if (campo === 'root' && !v) { mesclado.root = normKey; continue; }
          if (v !== undefined && v !== '') {
            // Pontuação colada na transliteração (ya., situ.], فِي؟) não é
            // parte da forma: limpar antes de gravar evita sujar raw_books.
            mesclado[campo] =
              campo === 'translit'
                ? String(v).replace(/[\u037E;.,\]…?؟]+$/u, '').trim()
                : v;
          }
        }
        // Campos extras (pos, verses, proper, color, ...) não podem sumir.
        for (const [campo, valor] of Object.entries(dados)) {
          if (['root', 'translit', 'en', 'pt', 'es', 'id'].includes(campo)) continue;
          if (valor === undefined || valor === '') continue;
          // `+` é fusão real; `/` é classe dupla. Normaliza antes de gravar.
          mesclado[campo] = campo === 'pos' ? normalizePosForFusion(lang, k, valor) : valor;
        }
        bookData[k] = mesclado;
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

console.log(`- Regenerando corrected-keys.generated.json (precedência do JSON no runtime)...`);
execSync(`node _build/tools/gen-corrected-keys.mjs`, { cwd: REPO_DATA_ROOT, stdio: 'inherit' });

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
  // GitHub recusa qualquer arquivo > 100 MB (GH001) e o pre-receive hook rejeita
  // o push inteiro. Um artefato derivado (ex.: `dict/heb/expanded_heb.json`,
  // 747 MB) entrava no `git add .` e travava a publicação. Fala antes do
  // commit/push, quando ainda é só remover o caminho do .gitignore.
  const LIMITE_MB = 100;
  const staged = execSync(`git diff --cached --name-only -z`, { cwd: REPO_DATA_ROOT, encoding: 'buffer' })
    .toString('utf8').split('\0').filter(Boolean);
  const gigantes = [];
  for (const f of staged) {
    try {
      const sz = statSync(join(REPO_DATA_ROOT, f)).size;
      if (sz > LIMITE_MB * 1024 * 1024) gigantes.push(`${(sz / 1048576).toFixed(1)} MB  ${f}`);
    } catch {}
  }
  if (gigantes.length) {
    console.error(`\nERRO: arquivo(s) acima de ${LIMITE_MB} MB no commit (GitHub recusa > 100 MB):`);
    for (const g of gigantes) console.error(`  - ${g}`);
    console.error(`\nArtefato derivado: adicione o caminho em .gitignore. Nada foi commitado.`);
    process.exit(1);
  }
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

  // 5. Atualizar o submódulo e versão de cache no bible-reader-web (Web/PWA)
  if (existsSync(join(BIBLE_READER_WEB_ROOT, '.git'))) {
    console.log(`\n=== ATUALIZANDO REPOSITÓRIO WEB (bible-reader-web) ===`);
    try {
      execSync(`git add public/data src/hooks/profile/usePreferences.ts`, { cwd: BIBLE_READER_WEB_ROOT, stdio: 'inherit' });
      const webStatus = execSync(`git status --porcelain public/data src/hooks/profile/usePreferences.ts`, { cwd: BIBLE_READER_WEB_ROOT, encoding: 'utf8' }).trim();
      if (webStatus) {
        console.log(`Comitando atualização do submódulo bible-data (${newTag}) e usePreferences.ts no Web...`);
        execSync(`git commit -m "chore(dict): atualiza submódulo bible-data para ${newTag} e invalida cache"`, { cwd: BIBLE_READER_WEB_ROOT, stdio: 'inherit' });
        execSync(`git push origin main`, { cwd: BIBLE_READER_WEB_ROOT, stdio: 'inherit' });
        console.log(`✓ Repositório bible-reader-web atualizado com sucesso (Vercel iniciará o deploy)!`);
      } else {
        console.log(`Nenhuma alteração pendente no repositório bible-reader-web.`);
      }
    } catch (webErr) {
      console.warn(`Aviso ao atualizar repositório bible-reader-web:`, webErr.message);
    }
  }

  // 6. Atualizar o submódulo no bible-app-mobile (dict-src)
  const BIBLE_APP_MOBILE_ROOT = join(MESTRADO_ROOT, 'bible-app-mobile');
  const mobileDictSrc = join(BIBLE_APP_MOBILE_ROOT, 'dict-src');
  if (existsSync(join(mobileDictSrc, '.git'))) {
    console.log(`\n=== ATUALIZANDO SUBMÓDULO DO MOBILE (bible-app-mobile/dict-src) ===`);
    try {
      execSync(`git fetch origin main && git checkout origin/main`, { cwd: mobileDictSrc, stdio: 'inherit' });
      execSync(`git add dict-src`, { cwd: BIBLE_APP_MOBILE_ROOT, stdio: 'inherit' });
      const mobileStatus = execSync(`git status --porcelain dict-src`, { cwd: BIBLE_APP_MOBILE_ROOT, encoding: 'utf8' }).trim();
      if (mobileStatus) {
        console.log(`Comitando atualização do submódulo dict-src (${newTag}) no mobile...`);
        execSync(`git commit -m "chore(dict): atualiza submódulo dict-src para ${newTag}"`, { cwd: BIBLE_APP_MOBILE_ROOT, stdio: 'inherit' });
        execSync(`git push origin main`, { cwd: BIBLE_APP_MOBILE_ROOT, stdio: 'inherit' });
        console.log(`✓ Repositório bible-app-mobile atualizado com sucesso!`);
      } else {
        console.log(`Submódulo dict-src no mobile já está atualizado.`);
      }
    } catch (mobileErr) {
      console.warn(`Aviso ao atualizar submódulo no mobile:`, mobileErr.message);
    }
  }
} catch (gitErr) {
  console.error(`ERRO no git:`, gitErr.message);
  process.exit(1);
}

// 7. Esvaziar os arquivos de correções processados
console.log(`\nEsvaziando arquivos de correções processados...`);
for (const p of processedFiles) {
  writeFileSync(p, '{}\n', 'utf8');
  console.log(`- ${basename(p)} -> esvaziado ({})`);
}

console.log(`\n=== CONCLUÍDO COM SUCESSO! Total de entradas aplicadas: ${totalEntriesApplied} ===\n`);
