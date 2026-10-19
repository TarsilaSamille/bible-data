#!/usr/bin/env node
/**
 * Confere a integridade dos pacotes antes de publicar.
 *
 * Um pacote com `def` vazio ou com chave faltando não quebra o build: quebra
 * em SILÊNCIO, na tela de quem está usando o dicionário, que é o pior lugar
 * para descobrir que faltou dado. Aqui o build falha antes.
 */

import { join } from 'node:path';
import { RAIZ, pacotes, livrosDo, lerJson } from './lib/io.mjs';
import { entradaMobile, glosaUtil, ehAbreviacao, IDIOMAS_DEFINICAO } from './lib/schema.mjs';

const MINIMO_LIBROS = 66;

/**
 * @param {string} [raiz]
 * @returns {{erros: string[], avisos: string[], pacotes: number}}
 */
export function verificar(raiz = RAIZ) {
  const erros = [];
  const avisos = [];
  const alvos = pacotes(raiz);
  if (!alvos.length) erros.push('nenhum pacote encontrado');

  for (const lang of alvos) {
    const dir = join(raiz, lang);
    const livros = livrosDo(dir);
    if (livros.length < MINIMO_LIBROS) {
      erros.push(`${lang}: ${livros.length} livros (esperado ${MINIMO_LIBROS})`);
    }

    let chaves = 0;
    let semGlosa = 0;
    let semRoot = 0;
    const abrev = new Set();
    const vistos = new Set();

    for (const livro of livros) {
      const entradas = lerJson(join(dir, livro));
      if (!entradas || typeof entradas !== 'object') {
        erros.push(`${lang}/${livro}: não é um objeto`);
        continue;
      }
      for (const [surface, bruta] of Object.entries(entradas)) {
        chaves++;
        if (surface === '') erros.push(`${lang}/${livro}: chave vazia`);
        vistos.add(surface);
        if (!bruta || typeof bruta !== 'object') {
          erros.push(`${lang}/${livro}/${surface}: valor não é objeto`);
          continue;
        }
        if (ehAbreviacao(surface)) abrev.add(surface);
        if (!bruta.root) semRoot++;
        const e = entradaMobile(bruta, lang);
        if (!glosaUtil(e.def)) semGlosa++;
      }
    }

    const pctSemGlosa = chaves ? (semGlosa / chaves) * 100 : 0;
    const pctSemRoot = chaves ? (semRoot / chaves) * 100 : 0;

    if (semRoot > 0) avisos.push(`${lang}: ${semRoot} entradas sem root`);
    if (abrev.size) {
      avisos.push(
        `${lang}: ${abrev.size} chaves que são sigla de referência, não palavra ` +
          `(${[...abrev].slice(0, 3).join(', ')}${abrev.size > 3 ? ', …' : ''})`,
      );
    }
    if (pctSemGlosa > 5) {
      erros.push(`${lang}: ${pctSemGlosa.toFixed(1)}% das entradas sem glosa (${semGlosa}/${chaves})`);
    }

    const tipo = IDIOMAS_DEFINICAO.has(lang) ? 'definição' : 'tradução';
    console.log(
      `  ${lang.padEnd(4)} ${String(chaves).padStart(8)} entradas  ` +
        `${livros.length} livros  ${tipo}  ` +
        `${pctSemGlosa.toFixed(1)}% sem glosa`,
    );
  }

  return { erros, avisos, pacotes: alvos.length };
}

if (process.argv[1] && process.argv[1].endsWith('verificar.mjs')) {
  console.log('verificação dos pacotes');
  const { erros, avisos, pacotes: n } = verificar();
  for (const a of avisos) console.log(`  aviso: ${a}`);
  if (erros.length) {
    for (const e of erros) console.error(`  ERRO: ${e}`);
    console.error(`\n${erros.length} problema(s) em ${n} pacote(s)`);
    process.exit(1);
  }
  console.log(`\nok — ${n} pacote(s)`);
}
