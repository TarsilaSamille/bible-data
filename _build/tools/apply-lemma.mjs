#!/usr/bin/env node
/**
 * Reescreve o `root` de cada entrada com o lema derivado.
 *
 * `--pack` reescreve a fonte (o que os dois apps consomem). Sem ele, é só
 * relatório.
 *
 * ESCOPO DELIBERADO, e por quê:
 *
 *   grc, heb   lema exato (índice de radiais / forma sem pontos). Dado, não
 *              palpite — é o caso em que o agrupamento por família realmente
 *              funciona, porque o grego e o hebraico Radicais são a unidade
 *              lexical do texto bíblico.
 *
 *   la, zh,    identidade. `la` já vem em forma de citação (`dixit`, `terra`),
 *   ja, ko, gn e os outros idiomas não flexionam a chave, ou flexionam de um
 *              jeito que a heurística erra mais do que acerta.
 *
 *   pt, en     regras de sufixo + portão de `pos`, COM MEDIÇÃO (report-lemma).
 *              ~70% em pt, ~90% em en no padrão de ouro. Acionado porque a
 *              fonte (`en`) a glosa por verbo tem o lema certo em boa parte
 *              dos casos, e o dano de um lema errado é restrito ao agrupamento
 *              — que é opcional na UI, não a tradução que o usuário lê.
 *
 * NÃO ativar `es`, `id`, `de`, `fr`, `it`, `ar`, `ru`: a heurística foi escrita
 * para PT e EN, e aplicar em pacote sem medição seria publicar palpite como
 * dado. Para ligar cada um: rodar report-lemma, anotar o padrão de ouro
 * (--amostra), iterar até passar, e só então incluir aqui.
 */

import { join } from 'node:path';
import { RAIZ, DICT_DIR, pacotes, livrosDo, lerJson, escreverJson } from './lib/io.mjs';
import { lema, estrategia } from './lib/lemmatize.mjs';

/** @type {Record<string, 'exato'|'identidade'|'regras'>} */
const MODO = {
  grc: 'exato',       // índice de radiais
  heb: 'exato',       // forma sem pontos
  la: 'identidade',   // forma de citação
  zh: 'identidade',   // sem flexão
  ja: 'identidade',
  ko: 'identidade',
  gn: 'identidade',
  pt: 'regras',       // com medição
  en: 'regras',       // com medição
};

/** Idiomas que não são tocados, com o motivo — para o relatório ser explícito. */
const NAO_FEITO = {
  es: 'sem medição: heurística escrita para pt/en',
  id: 'sem medição',
  de: 'sem medição',
  fr: 'sem medição',
  it: 'sem medição',
  ar: 'sem medição; pacote de definição (radical é o radical)',
  ru: 'sem medição',
};

function indiceGrc(raiz) {
  try {
    return new Map(Object.entries(lerJson(join(raiz, 'grc-index.json'))));
  } catch {
    return null;
  }
}

function posPorForma(lang, raiz) {
  const mapa = new Map();
  const dir = join(raiz, lang);
  let tem = false;
  for (const livro of livrosDo(dir)) {
    for (const [k, v] of Object.entries(lerJson(join(dir, livro)))) {
      if (v && typeof v === 'object' && typeof v.pos === 'string') {
        mapa.set(k, v.pos);
        tem = true;
      }
    }
  }
  return tem ? mapa : null;
}

/**
 * @param {{pack?: boolean, langs?: string[]}} [opcoes]
 */
export function aplicarLemas(opcoes = {}) {
  const { pack = false, langs } = opcoes;
  const indice = indiceGrc(RAIZ);
  const resultados = [];

  for (const lang of langs ?? pacotes()) {
    const modo = MODO[lang];
    if (!modo) {
      resultados.push({ lang, modo: 'não tocado', motivo: NAO_FEITO[lang] ?? 'fora do escopo' });
      continue;
    }
    const dir = join(DICT_DIR, lang);
    const vocab = new Set();
    for (const livro of livrosDo(dir)) {
      for (const k of Object.keys(lerJson(join(dir, livro)))) vocab.add(k);
    }
    const poses = modo === 'regras' ? posPorForma(lang, DICT_DIR) : null;

    let mudadas = 0;
    let total = 0;
    for (const livro of livrosDo(dir)) {
      const caminho = join(dir, livro);
      const entradas = lerJson(caminho);
      let mudouLivro = false;
      for (const [surface, bruta] of Object.entries(entradas)) {
        if (!bruta || typeof bruta !== 'object') continue;
        total++;
        const ctx =
          modo === 'exato'
            ? { grcIndex: indice, vocab }
            : { vocab, pos: poses?.get(surface) ?? null };
        const novo = lema(surface, lang, ctx);
        // Escreve quando o lema DIFERENTE do que está gravado, inclusive quando
        // o novo lema é a própria forma.
        //
        // A guarda anterior exigia `novo !== surface`, e isso impedia a correção:
        // uma entrada com root corrompido (`δαν` gravado como `δα`) não era
        // reescrita porque o lema correto É a superfície. O resultado era que
        // rodar de novo não limpava nada — a ferramenta só ia em frente, nunca
        // voltava. É o defeito que fez a corrupção parecer irrecuperável.
        if (novo && novo !== bruta.root) {
          bruta.root = novo;
          mudouLivro = true;
          mudadas++;
        }
      }
      if (pack && mudouLivro) escreverJson(caminho, entradas);
    }
    resultados.push({ lang, modo, estrategia: estrategia(lang), total, mudadas });
  }

  return resultados;
}

if (process.argv[1] && process.argv[1].endsWith('apply-lemma.mjs')) {
  const pack = process.argv.includes('--pack');
  const langs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  console.log(pack ? 'reescrevendo root…' : 'simulação (nada escrito) — use --pack para gravar');
  for (const r of aplicarLemas(langs.length ? { pack, langs } : { pack })) {
    if (r.modo === 'não tocado') {
      console.log(`  ${r.lang.padEnd(4)} —            ${r.motivo}`);
    } else {
      console.log(
        `  ${r.lang.padEnd(4)} ${String(r.mudadas).padStart(7)}/${String(r.total).padEnd(8)} root → lema  (${r.estrategia})`,
      );
    }
  }
}
