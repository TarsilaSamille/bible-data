#!/usr/bin/env node
/**
 * Reconstrói `grc-index.json` a partir das chaves dos próprios pacotes.
 *
 * O índice que veio do web está corrompido: em 10.724 das 26.621 entradas o
 * VALOR corta a última letra do radical (`αἰσχύνω` → `αισχυν`, `γραφω` →
 * `γράφ`, `δεινος` → `δειν`). Cortar a sílaba final é pior que não agrupar: o
 * lema exibido não existe como palavra grega.
 *
 * A reconstrução usa o que é dado e não palpite: para cada forma normalizada
 * (sem acento, minúscula — a chave do índice), o lema é a forma ACENTUADA que
 * aparece no pacote, escolhida por frequência. As entradas 2.886 que tinham
 * duas grafias voltam a ter uma só, que é o que o agrupamento precisa.
 *
 * O que o índice NÃO faz, e continua não fazendo: flexão grega. `λόγος`,
 * `λόγου` e `λόγῳ` são lemas diferentes neste índice, porque flexionar grego
 * precisa de morphological analyzer (6 declinações, 4 conjugações). Isso é
 * limitação conhecida, não defeito — está no README.
 *
 *   node _build/tools/gerar-grc-index.mjs [--dry-run]
 */

import { join } from 'node:path';
import { RAIZ, livrosDo, lerJson, escreverJson } from './lib/io.mjs';

/** Grego sem acento e em minúsculas — a forma da chave do índice. */
const semAcento = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/**
 * @param {string} [raiz]
 * @returns {{chaves: number, porForma: Map<string, Map<string, number>>}}
 */
export function construirIndice(raiz = RAIZ) {
  /** forma normalizada → contagem por grafia real vista no pacote */
  const porForma = new Map();
  const dir = join(raiz, 'grc');
  for (const livro of livrosDo(dir)) {
    for (const surface of Object.keys(lerJson(join(dir, livro)))) {
      const norm = semAcento(surface);
      if (!norm) continue;
      let variantes = porForma.get(norm);
      if (!variantes) porForma.set(norm, (variantes = new Map()));
      variantes.set(surface, (variantes.get(surface) ?? 0) + 1);
    }
  }
  return { chaves: porForma.size, porForma };
}

/** Grafia mais frequente de uma forma normalizada. */
function maisFrequente(variantes) {
  let melhor = null;
  let melhorContagem = -1;
  for (const [grafia, contagem] of variantes) {
    if (contagem > melhorContagem) {
      melhor = grafia;
      melhorContagem = contagem;
    }
  }
  return melhor;
}

if (process.argv[1] && process.argv[1].endsWith('gerar-grc-index.mjs')) {
  const dry = process.argv.includes('--dry-run');
  const { porForma } = construirIndice();
  const saida = {};
  for (const norm of [...porForma.keys()].sort()) {
    saida[norm] = maisFrequente(porForma.get(norm));
  }

  // Comparar com o índice atual é o que dá confiança no resultado: o número de
  // divergências é a medida do dano que se está corrigindo.
  const anterior = lerJson(join(RAIZ, 'grc-index.json'));
  let iguais = 0;
  let cortados = 0;
  for (const [norm, novo] of Object.entries(saida)) {
    const velho = anterior[norm];
    if (velho === novo) iguais++;
    if (velho && semAcento(velho).length < norm.length) cortados++;
  }

  console.log(`grc-index: ${Object.keys(saida).length} chaves`);
  console.log(`  ${iguais} iguais ao índice atual`);
  console.log(`  ${cortados} corrigem corte de sílaba final`);
  console.log(`  ${Object.keys(saida).length - iguais} mudam`);

  if (dry) {
    console.log('\n(dry-run: nada escrito)');
  } else {
    escreverJson(join(RAIZ, 'grc-index.json'), saida);
    console.log('\nescrito em grc-index.json');
    console.log('roda `npm run apply:lemma` para propagar aos pacotes');
  }
}
