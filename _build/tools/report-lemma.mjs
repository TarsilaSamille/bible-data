#!/usr/bin/env node
/**
 * Mede o lemmatizer contra o padrão de ouro, e sorteia amostras para anotar.
 *
 *   node _build/tools/report-lemma.mjs              # mede
 *   node _build/tools/report-lemma.mjs --amostra    # sorteia 60 verbos p/ anotar
 *
 * Por que isto existe: um lemmatizer é um sistema de heurísticas, e heurística
 * sem medida é palpite. A pergunta "está melhor?" só tem resposta se houver um
 * conjunto de casos com resposta CONHECIDA — daí o padrão de ouro em `lib/ouro.mjs`,
 * anotado à mão.
 *
 * O número que decide é a precisão no padrão de ouro. A cobertura (quantas
 * entradas mudam) é informação, não nota: mudar mais não é melhor, é só mais
 * palpável.
 */

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { RAIZ, pacotes, livrosDo, lerJson } from './lib/io.mjs';
import { lema, estrategia } from './lib/lemmatize.mjs';
import { MEDICOES } from './lib/ouro.mjs';

/** Vocabulário completo de um idioma: todas as chaves dos 66 livros. */
function vocabulario(lang, raiz = RAIZ) {
  const set = new Set();
  for (const livro of livrosDo(join(raiz, lang))) {
    for (const k of Object.keys(lerJson(join(raiz, lang, livro)))) set.add(k);
  }
  return set;
}

/** Índice de radiais do grego, se existir. */
function indiceGrc(raiz = RAIZ) {
  try {
    const bruto = lerJson(join(raiz, 'grc-index.json'));
    return new Map(Object.entries(bruto));
  } catch {
    return null;
  }
}

/**
 * `pos` por forma, para os idiomas que trazem a classe gramatical.
 *
 * Só `pt` e `en` têm, e é por isso que a medição do português é a mais forte:
 * o portão de `pos` é o que impede substantivo de virar verbo, e ele só existe
 * onde o pacote traz o campo. Nos demais idiomas a heurística roda sem esse
 * portão, e a precisão medida aqui NÃO se aplica a eles.
 */
function posPorForma(lang, raiz = RAIZ) {
  const mapa = new Map();
  const dir = join(raiz, lang);
  let temPos = false;
  for (const livro of livrosDo(dir)) {
    for (const [k, v] of Object.entries(lerJson(join(dir, livro)))) {
      if (v && typeof v === 'object' && typeof v.pos === 'string') {
        mapa.set(k, v.pos);
        temPos = true;
      }
    }
  }
  return temPos ? mapa : null;
}

/**
 * @param {string[]} langs
 */
export function medir(langs = ['pt', 'en']) {
  const indice = indiceGrc();
  const vocabs = new Map();
  const poses = new Map();
  for (const lang of langs) {
    vocabs.set(lang, vocabulario(lang));
    poses.set(lang, posPorForma(lang));
  }

  const medicoes = [];
  for (const { lang, bloco, dados, critico } of MEDICOES) {
    const ctxBase = { vocab: vocabs.get(lang), grcIndex: indice };
    const pos = poses.get(lang);
    let acertos = 0;
    const erros = [];
    for (const [forma, esperado] of Object.entries(dados)) {
      const obtido = lema(forma, lang, { ...ctxBase, pos: pos?.get(forma) ?? null });
      const ok = esperado === null ? obtido === forma : obtido === esperado;
      if (ok) acertos++;
      else erros.push({ forma, esperado: esperado ?? '(a própria forma)', obtido });
    }
    // `critico` precisa ser propagado: sem isso o bloco de substantivos — que é
    // justamente o que bloqueia — nunca foi lido como bloqueio, e `report-lemma`
    // saiu com código 0 mesmo reprovando 16 de 37.
    medicoes.push({
      lang,
      bloco,
      dados,
      critico: critico === true,
      total: Object.keys(dados).length,
      acertos,
      erros,
    });
  }

  // As armadilhas são o critério de bloqueio: acertar a amostra e quebrar `terra`
  // continua inapto, porque o erro aparece na palavra mais comum da Bíblia.
  const armadilhaRes = [];
  for (const { lang, armadilhas } of MEDICOES) {
    if (!armadilhas) continue;
    const ctxBase = { vocab: vocabs.get(lang), grcIndex: indice };
    const pos = poses.get(lang);
    const erros = [];
    for (const [forma, esperado] of Object.entries(armadilhas)) {
      const obtido = lema(forma, lang, { ...ctxBase, pos: pos?.get(forma) ?? null });
      const ok = esperado === null ? obtido === forma : obtido === esperado;
      if (!ok) erros.push({ forma, esperado: esperado ?? '(a própria forma)', obtido });
    }
    armadilhaRes.push({ lang, total: Object.keys(armadilhas).length, erros });
  }

  // Cobertura: quantas entradas do pacote mudariam de root.
  const cobertura = [];
  for (const lang of langs) {
    const vocab = vocabs.get(lang);
    let mudam = 0;
    const pos = poses.get(lang);
    const amostra = [...vocab].slice(0, 20000);
    for (const f of amostra) {
      if (lema(f, lang, { vocab, grcIndex: indice, pos: pos?.get(f) ?? null }) !== f) mudam++;
    }
    cobertura.push({
      lang,
      estrategia: estrategia(lang),
      chaves: vocab.size,
      amostra: amostra.length,
      mudam,
      pct: (mudam / amostra.length) * 100,
    });
  }

  return { medicoes, armadilhas: armadilhaRes, cobertura };
}

function imprimir(r) {
  console.log('Padrão de ouro');
  for (const m of r.medicoes) {
    const pct = ((m.acertos / m.total) * 100).toFixed(1);
    const selo = m.critico ? ' [bloqueio]' : '';
    console.log(`  ${m.lang} ${m.bloco.padEnd(18)} ${m.acertos}/${m.total}  ${pct}%${selo}`);
    for (const e of m.erros.slice(0, 12)) {
      console.log(`      ${e.forma.padEnd(14)} esperado ${String(e.esperado).padEnd(16)} obtido ${e.obtido}`);
    }
    if (m.erros.length > 12) console.log(`      … e mais ${m.erros.length - 12}`);
  }

  console.log('\nArmadilhas (bloqueio)');
  for (const a of r.armadilhas) {
    const ok = a.total - a.erros.length;
    console.log(`  ${a.lang} ${ok}/${a.total}`);
    for (const e of a.erros) {
      console.log(`      ${e.forma.padEnd(14)} esperado ${String(e.esperado).padEnd(16)} obtido ${e.obtido}`);
    }
  }

  console.log('\nCobertura');
  for (const c of r.cobertura) {
    console.log(
      `  ${c.lang.padEnd(4)} ${c.pct.toFixed(1).padStart(5)}% das ${c.chaves} chaves mudariam  (${c.estrategia})`,
    );
  }
}

/**
 * Há algo que impede aplicar o lema aos dados?
 *
 * Sem isto o relatório era só impressão: imprimia "21/23" nas armadilhas e
 * saía com código 0, e `npm run build` publicava o pacote assim mesmo. Um
 * número que não bloqueia nada não é um portão.
 *
 * @returns {string[]} as razões do bloqueio
 */
export function bloqueios(r) {
  const motivos = [];
  for (const m of r.medicoes) {
    if (!m.critico) continue;
    if (m.erros.length) {
      motivos.push(
        `${m.lang}/${m.bloco}: ${m.erros.length} erro(s) em substantivo — ` +
          'substantivo com radical falso corrompe o dicionário inteiro',
      );
    }
  }
  for (const a of r.armadilhas) {
    if (a.erros.length) {
      motivos.push(
        `${a.lang}: ${a.erros.length} armadilha(s) quebrada(s): ` +
          a.erros.map((e) => e.forma).join(', '),
      );
    }
  }
  return motivos;
}

/** Sorteia verbos de um idioma para anotação manual. */
function amostrar(lang = 'pt', n = 60, seed = 7) {
  const vocab = [...vocabulario(lang)];
  const dir = join(RAIZ, lang);
  const verbos = new Set();
  for (const livro of livrosDo(dir)) {
    for (const [k, v] of Object.entries(lerJson(join(dir, livro)))) {
      if (v && typeof v === 'object' && v.pos === 'VERB') verbos.add(k);
    }
  }
  const lista = [...verbos].sort();
  // PRNG determinístico: a amostra tem de ser a mesma depois que o pacote
  // mudar, senão o padrão de ouro deixa de ser comparável com a medição.
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out = [];
  for (let i = 0; i < n && lista.length; i++) {
    out.push(lista[Math.floor(rnd() * lista.length)]);
  }
  console.log(`${lang}: ${lista.length} verbos, seed ${seed}, ${out.length} sorteados`);
  console.log(out.join(' '));
  void vocab;
}

if (process.argv[1] && process.argv[1].endsWith('report-lemma.mjs')) {
  if (process.argv.includes('--amostra')) {
    amostrar(process.argv[2] ?? 'pt', Number(process.argv[3]) || 60, Number(process.argv[4]) || 7);
  } else {
    const resultado = medir();
    imprimir(resultado);
    const motivos = bloqueios(resultado);
    if (motivos.length) {
      console.log('\nBLOQUEADO:');
      for (const m of motivos) console.log(`  - ${m}`);
      console.log('\nNão aplique lema aos dados com `apply-lemma.mjs --pack`.');
      process.exit(1);
    }
    console.log('\nsem bloqueios — `apply-lemma.mjs --pack` pode rodar');
  }
}
