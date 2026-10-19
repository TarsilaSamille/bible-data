#!/usr/bin/env node
/**
 * Gera o índice `master.json` de um pacote: a união das chaves de todos os 66
 * livros, com a glosa de cada palavra.
 *
 * Por que isso existe: `OfflineDictManager.lookupAnyBook` (mobile) e a busca
 * sem contexto de livro (web) precisam responder "esta palavra tem glosa?" sem
 * abrir 66 arquivos. O master responde isso em uma leitura.
 *
 * Colisão entre livros é a regra, não a exceção: `deus` aparece em Gn 1 e em
 * dozens de outros livros, e cada ocorrência traz uma glosa ligeiramente
 * diferente. A primeira ocorrência vence — os pacotes são lidos em ordem de
 * livro, e o primeiro uso é quase sempre o canônico (o verbo `disse` em Gn 2 é
 * a forma de sentido mais genérico).
 */

import { join } from 'node:path';
import { RAIZ, pacotes, livrosDo, lerJson, escreverJson } from './lib/io.mjs';
import { glosaDe, glosaUtil } from './lib/schema.mjs';

/**
 * @param {string} lang
 * @param {string} [raiz]
 * @returns {{total: number, colisoes: number}}
 */
export function gerarMaster(lang, raiz = RAIZ) {
  const dir = join(raiz, lang);
  const master = {};
  let colisoes = 0;
  for (const livro of livrosDo(dir)) {
    const entradas = lerJson(join(dir, livro));
    for (const [surface, bruta] of Object.entries(entradas)) {
      const existente = master[surface];
      if (existente !== undefined) {
        colisoes++;
        // Só troca se a nova glosa for aproveitável e a guardada não for.
        if (!glosaUtil(existente) && glosaUtil(bruta)) master[surface] = glosaDe(bruta, lang);
        continue;
      }
      master[surface] = glosaDe(bruta, lang);
    }
  }
  escreverJson(join(dir, 'master.json'), master);
  return { total: Object.keys(master).length, colisoes };
}

const CLICADO = process.argv[2];
const alvos = CLICADO ? [CLICADO] : pacotes();
console.log(`master.json — ${alvos.length} pacote(s)`);
for (const lang of alvos) {
  const { total, colisoes } = gerarMaster(lang);
  console.log(`  ${lang.padEnd(4)} ${String(total).padStart(7)} chaves  (${colisoes} colisões entre livros)`);
}
