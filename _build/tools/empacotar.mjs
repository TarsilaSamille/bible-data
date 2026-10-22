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
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { RAIZ, pacotes, livrosDo, lerJson, escreverJson } from './lib/io.mjs';
import { entradaMobile, glosaUtil } from './lib/schema.mjs';

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
  const origem = join(RAIZ, lang);
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
 * Zipa um diretório. A raiz do zip são os ARQUIVOS do pacote (sem a pasta do
 * idioma dentro): o `DictPackStore` descompacta direto em `filesDir/dict/<lang>/`.
 */
export function zipar(dir, destino) {
  rmSync(destino, { force: true });
  execFileSync('zip', ['-qr', destino, '.'], { cwd: dir, stdio: 'pipe' });
  return destino;
}

/**
 * @param {{source?: boolean, mobile?: boolean, langs?: string[]}} [opcoes]
 */
export function empacotar(opcoes = {}) {
  const { source = true, mobile = true, langs } = opcoes;
  const todos = pacotes();
  const alvos = langs ?? todos;
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const feitos = [];
  // Fonte unica: existe um unico pacote por idioma (dict-source-*.zip).
  // Derivacoes separadas (dict-mobile-*) deixam de ser publicadas.
  if (source || mobile) {
    for (const lang of alvos) {
      const zip = zipar(join(RAIZ, lang), join(DIST, `dict-source-${lang}.zip`));
      feitos.push({ lang, tipo: 'source', zip });
    }
  }
  return feitos;
}

if (process.argv[1] && process.argv[1].endsWith('empacotar.mjs')) {
  const langs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const feitos = empacotar(langs.length ? { langs } : {});
  console.log(`${feitos.length} pacote(s) em dist/`);
  for (const f of feitos) {
    const extra = f.entradas ? `${f.entradas} entradas` : '';
    console.log(`  ${f.zip.split('/').pop().padEnd(26)} ${extra}`);
  }
}
