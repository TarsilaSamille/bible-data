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
const MINIMO_LIBROS_POR_PACOTE = new Map([["bju", 1]]);

/**
 * Idiomas SEM o gate de radical falso.
 *
 * O gate compara comprimento em caracteres, e isso só é comparável onde a
 * flexão NÃO remove caracteres de outra categoria. Em cada um destes a razão
 * é diferente, e todos produzem falso positivo se o gate rodar:
 *
 *   heb   o lema remove pontuação: `בְּרֵאשִׁ֖ית` → `בראשית` perde 5 caracteres
 *         e é o lema perfeito.
 *   ja    a flexão corta classificador: `銅細工人` → `細工`.
 *   ko    a flexão corta honorífico e auxiliares: `창조하시니라` → `창조`.
 *   ar    o lema remove prefixo `و` e artigo `ال`: `وانتقل` → `نقل` é a raiz
 *         trilateral, e é exatamente o que se quer.
 *   grc   o lema normalizado corta a partícula e o acento: `γαιβηλ` → `γαι`.
 *   gn    o prefixo nasalativo faz parte da forma, não do lema.
 *   zh    sem flexão; o `radical` do kanji é campo à parte.
 *   ru, la sufixos reais, mas o lema é de outra seção do dicionário.
 *
 * O gate entra nesses idiomas quando houver critério que faça sentido para
 * eles — morphological analyzer, não razão de caracteres.
 */
const SEM_GATE_RADICAL = new Set([
  'grc', 'heb', 'ja', 'ko', 'zh', 'ru', 'ar', 'la', 'gn',
]);

/**
 * Idiomas cujo radical encurta por flexão legítima, e não por defeito.
 *
 * Em indonésio, `kesukaannya` tem raiz `suka` — o Wiktionary declara
 * `{{imbuhan ke-an|suka|nya}}` —, `menghasilkan` tem `hasil`,
 * `penghakiman` tem `hakim`. A raiz MORFOLOGICA de uma palavra indonésia é o
 * radical sem os afixos, e é isso que o campo `root` guarda. O gate de
 * comprimento via `kesukaannya → suka` como corrupção, e 11,8% de um livro
 * é praticamente todo o pacote.
 *
 * Confirmado contra o dado: em `id`, 32.858 entradas seguem o padrão
 * `<forma> (<radical>): glosa` e NENHUMA diverge entre o radical declarado e o
 * campo `root`. O radical está certo; o gate é que estava errado.
 *
 * O mesmo vale para `id` estar fora do escopo do lema (`apply-lemma.mjs`), que
 * é a decisão correta: sem um morphological analyzer indonésio, mexer no radical
 * seria pior do que não mexer.
 */
const RADICAL_DE_MIGRACAO = new Set(['id']);

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
    const minimoLivros = MINIMO_LIBROS_POR_PACOTE.get(lang) ?? MINIMO_LIBROS;
    if (livros.length < minimoLivros) {
      erros.push(`${lang}: ${livros.length} livros (esperado ${minimoLivros})`);
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

    // RADICAL FALSO: o gate que faltava.
    //
    // O verificador só olhava se `root` EXISTE, nunca se ele faz sentido — e
    // milhares de entradas com radical impossível (`noite → noi`,
    // `abismo → abis`) passaram por ele sem aviso. A heurística do lemmatizer
    // produz esse defeito em substantivo, e ele só aparece na tela.
    //
    // O critério é de COMPRIMENTO RELATIVO ao resto do pacote, não um número
    // fixo: um lema preserva a maior parte da forma, com folga para flexão
    // legítima (plural, gerúndio, particípio). `foram → ir` e `comeste → com`
    // são candidatos a reprovação por esse critério e são **corretos** — daí o
    // corte em 2% de tolerância, abaixo do qual a lista só gera ruído.
    //
    // O gate só roda onde a flexão é por sufixo latino (`!SEM_GATE_RADICAL`).
    // Em hebraico, japonês, coreano, árabe e grego o comprimento em caracteres
    // não significa nada, e cada um tem um motivo diferente — está na lista.
    //
    // TOLERANCIA em 10% porque flexão legítima encurta a forma muito: `were`
    // → `be`, `going` → `go`, `bâtissaient` → `bâtir`, `dividir` → `dividi`.
    // Abaixo disso o gate só produz falsos positivos, que é o que aconteceu com
    // 2%: ele reprovou `foram → ir` e `went → go`, que são o comportamento
    // desejado. O que o gate precisa pegar é a CORRUPÇÃO em escala — 30% das
    // entradas, que foi o caso de `noite`/`abismo` — não a flexão agressiva.
    const MIN_RADICAL = 0.55;
    const TOLERANCIA_PCT = 10; // até 10% (em pontos percentuais, para casar com pct)
    let radicalCurto = 0;
    const exemplos = [];
    if (!SEM_GATE_RADICAL.has(lang)) {
      // A porcentagem é POR LIVRO, não sobre o pacote inteiro. Corromper um
      // livro só (de 66) dá 2,9% do pacote — abaixo da tolerância — e o gate
      // passava. O defeito real é de granularidade: radical falso é sempre
      // sistêmico dentro de um texto, e nesse caso a proporção por livro é a
      // que denuncia. Era o que faltava para o gate pegar uma corrupção
      // injetada em 3.000 entradas de um único livro.
      let piores = { pct: 0, livro: null };
      for (const livro of livros) {
        const entradas = lerJson(join(dir, livro));
        const total = Object.keys(entradas).length;
        let curtos = 0;
        const exLocal = [];
        for (const [surface, bruta] of Object.entries(entradas)) {
          if (!bruta || typeof bruta !== 'object') continue;
          const r = bruta.root;
          if (!r || r === surface) continue;
          if (surface.length < 4) continue;
          if (r.length >= surface.length * MIN_RADICAL) continue;
          curtos++;
          if (exLocal.length < 4) exLocal.push(`${surface} → ${r}`);
        }
        radicalCurto += curtos;
        if (total) {
          const pctLivro = (curtos / total) * 100;
          if (pctLivro > piores.pct) piores = { pct: pctLivro, livro, exLocal };
        }
      }
      if (piores.pct > TOLERANCIA_PCT && !RADICAL_DE_MIGRACAO.has(lang)) {
        erros.push(
          `${lang}/${piores.livro}: ${piores.pct.toFixed(1)}% dos radicais curtos demais ` +
            `(> ${TOLERANCIA_PCT}%); exemplos: ${piores.exLocal.join(', ')}`,
        );
      } else {
        const pct = (radicalCurto / chaves) * 100;
        if (radicalCurto > 0) {
          const nota = RADICAL_DE_MIGRACAO.has(lang)
            ? ' (radical morfológico: afixos fora, correto)'
            : '';
          avisos.push(
            `${lang}: ${radicalCurto} radical(is) curto (${pct.toFixed(1)}% do pacote, ` +
              `pior livro ${piores.pct.toFixed(1)}%, tolerância ${TOLERANCIA_PCT}%)${nota}`,
          );
        }
      }
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
