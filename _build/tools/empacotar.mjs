#!/usr/bin/env node
/**
 * Empacota os pacotes de dicionário para distribuição.
 *
 * Dois formatos, porque há dois consumidores com requisitos opostos:
 *
 *   dict-source-<lang>.zip   a fonte da verdade, campo a campo. É o que o web
 *                            serve e o que outra ferramenta pode consumir.
 *
 *   dict-mobile-<lang>.zip   o que o `DictPackStore` baixa e descompacta em
 *                            `filesDir/dict/<lang>/`.derivado de
 *                            `dict-source`, sem `verses` nem `pos_counts` (que
 *                            ocupam MB e o mobile não lê), com `def` preenchido
 *                            com a glosa do próprio idioma.
 *
 * O glossário PT vai na RAIZ de cada pacote mobile: o `DictPackStore.open()`
 * procura `dict/<arquivo>` em todos os pacotes instalados quando o caminho não
 * tem pasta de idioma, e é assim que uma tradução de glosa grega aparece sem o
 * pacote `pt` estar instalado.
 */

import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { availableParallelism } from 'node:os';
import { copyFileSync } from 'node:fs';
import { RAIZ, DICT_DIR, pacotes, livrosDo, lerJson, escreverJson } from './lib/io.mjs';
import { entradaMobile, glosaUtil } from './lib/schema.mjs';

const execFileAsync = promisify(execFile);

/** Cópia binária de um JSON: preserva byte a byte, sem passar por parse. */
const copiarJson = (de, para) => copyFileSync(de, para);

/**
 * Saída do empacotamento.
 *
 * Fica dentro de `_build/` e não na raiz porque a raiz deste repositório é
 * servida publicamente (o web entra com ele como submódulo em
 * `public/data/dict/`): um `dist/` na raiz viraria `/data/dict/dist/`.
 */
const DIST = join(RAIZ, '_build', 'dist');

/**
 * Pacotes que o mobile consome em runtime.
 *
 * Derivado do que a fonte tem, e não da lista de idiomas do web: `it` é
 * listado como idioma do dicionário no web mas nunca teve pacote gerado, e
 * incluí-lo aqui só produz `ENOENT` no meio do build. `grc` e `heb` não entram
 * porque vão embutidos no APK (ver `BUNDLED_LANGS` do `DictPackStore`).
 */
export const PACOTES_MOBILE = ['ar', 'de', 'en', 'es', 'fr', 'gn', 'id', 'ja', 'ko', 'la', 'pt', 'ru', 'zh'];

/**
 * Pacote mobile de um idioma: os mesmos livros, com o formato enxuto.
 *
 * @param {string} lang
 * @param {string} [saidaDir]
 * @returns {{livros: number, entradas: number}}
 */
export function pacoteMobile(lang, saidaDir = join(DIST, 'mobile', lang)) {
  const origem = join(DICT_DIR, lang);
  rmSync(saidaDir, { recursive: true, force: true });
  mkdirSync(saidaDir, { recursive: true });

  let entradas = 0;
  const livros = livrosDo(origem);
  for (const livro of livros) {
    const brutas = lerJson(join(origem, livro));
    const saida = {};
    for (const [surface, bruta] of Object.entries(brutas)) {
      // Entrada sem glosa nenhuma não serve para nada no mobile: o `glossOf`
      // dele a trata como ausente e a tela cai no tradutor online. Melhor não
      // escrever do que escrever um objeto que a UI lê como "dicionário vazio".
      const e = entradaMobile(bruta, lang);
      if (!glosaUtil(e.def)) continue;
      saida[surface] = e;
      entradas++;
    }
    escreverJson(join(saidaDir, livro), saida);
  }

  // `master.json`: união dos livros já no formato mobile, para a busca sem
  // contexto de livro não precisar abrir 66 arquivos.
  const master = {};
  for (const livro of livros) {
    for (const [surface, e] of Object.entries(lerJson(join(saidaDir, livro)))) {
      if (master[surface] === undefined) master[surface] = e.def;
    }
  }
  escreverJson(join(saidaDir, 'master.json'), master);

  // Índices e glossas temáticas do grego/hebraico: o `OfflineDictManager` os
  // abre por caminho (`dict/grc/lemma_master.json`), então precisam viajar.
  // O grc-index é o mesmo arquivo para todos os idiomas que o usam, então vai
  // na raiz do pacote em vez de dentro de `<lang>/`.
  for (const extra of extrasDo(origem)) {
    copiarJson(join(origem, extra), join(saidaDir, extra));
  }
  const indice = join(RAIZ, 'grc-index.json');
  if (existsSync(indice)) copiarJson(indice, join(saidaDir, 'grc-index.json'));

  return { livros: livros.length, entradas };
}

/** Arquivos que não são livro mas são lidos pelo dicionário. */
function extrasDo(dir) {
  return readdirSync(dir).filter((n) => !/^[0-9]{1,2}\.json$/.test(n) && n !== 'README.md');
}

/**
 * Zipa um diretório de forma assíncrona. A raiz do zip são os ARQUIVOS do pacote (sem a pasta do
 * idioma dentro): o `DictPackStore` descompacta direto em `filesDir/dict/<lang>/`.
 */
export async function zipar(dir, destino) {
  rmSync(destino, { force: true });
  await execFileAsync('zip', ['-qr', destino, '.'], { cwd: dir, stdio: 'pipe' });
  return destino;
}

/**
 * Utilitário para executar tarefas assíncronas com concorrência limitada.
 */
async function asyncPool(limit, items, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

/**
 * @param {{source?: boolean, mobile?: boolean, langs?: string[]}} [opcoes]
 */
export async function empacotar(opcoes = {}) {
  const { source = true, mobile = true, langs } = opcoes;
  const todos = pacotes(DICT_DIR);
  const alvos = langs ?? todos;
  if (!langs) {
    rmSync(DIST, { recursive: true, force: true });
  }
  mkdirSync(DIST, { recursive: true });

  const concurrency = Math.max(1, availableParallelism ? availableParallelism() : 4);
  const tarefas = [];

  // 1. Pacotes source (dict-source-<lang>.zip) - consumido por web e legado
  if (source) {
    for (const lang of alvos) {
      tarefas.push(async () => {
        const zip = await zipar(join(DICT_DIR, lang), join(DIST, `dict-source-${lang}.zip`));
        return { lang, tipo: 'source', zip };
      });
    }
  }

  // 2. Pacotes mobile enxutos (dict-mobile-<lang>.zip) - adicional seguro
  if (mobile) {
    const alvosMobile = alvos.filter((l) => PACOTES_MOBILE.includes(l));
    for (const lang of alvosMobile) {
      tarefas.push(async () => {
        const mobileDir = join(DIST, 'mobile', lang);
        const res = pacoteMobile(lang, mobileDir);
        const zip = await zipar(mobileDir, join(DIST, `dict-mobile-${lang}.zip`));
        return { lang, tipo: 'mobile', zip, entradas: res?.entradas };
      });
    }
  }

  const feitos = await asyncPool(concurrency, tarefas, (task) => task());
  return feitos;
}

if (process.argv[1] && process.argv[1].endsWith('empacotar.mjs')) {
  const langs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const t0 = Date.now();
  empacotar(langs.length ? { langs } : {})
    .then((feitos) => {
      console.log(`${feitos.length} pacote(s) em dist/ em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      for (const f of feitos) {
        const extra = f.entradas ? `${f.entradas} entradas` : '';
        console.log(`  ${f.zip.split('/').pop().padEnd(26)} ${extra}`);
      }
    })
    .catch((err) => {
      console.error('Erro ao empacotar:', err);
      process.exit(1);
    });
}
