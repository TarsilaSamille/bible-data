#!/usr/bin/env node
/**
 * Gera `pt_master_glossary.json`: o índice radical → glosa em português.
 *
 * Para que serve: o dicionário de um idioma X (grego, latim, aramaico) não tem
 * glosa em português — a chave é a palavra estrangeira e a definição é em inglês.
 * Quando a pessoa está lendo em português e toca numa palavra grega, o app não
 * tem o que mostrar em PT sem internet. Este arquivo é essa tradução, e é
 * indexado por RADICAL: `λόγος`, `λόγου`, `λόγῳ` caem todos no mesmo radical e
 * mostram a mesma glosa.
 *
 * De onde vem a glosa: dos próprios pacotes, que já trazem `pt` quando a
 * tradução existe (foi preenchida no pipeline do web). Quando o radical não tem
 * glosa própria mas sua FORMA tem, a forma serve — é melhor mostrar a tradução
 * de `λόγου` do que nada.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { RAIZ, pacotes, livrosDo, lerJson, escreverJson } from './lib/io.mjs';
import { glosaUtil } from './lib/schema.mjs';

const SAIDA = join(RAIZ, 'pt_master_glossary.json');

/** Chaves de metadado que o leitor Android ignora ao carregar o glossário. */
const RESERVADAS = ['generated_at', 'model', 'total_translated'];

/**
 * Definições em português extraídas de fonte externa, por forma.
 *
 * O arquivo é opcional: sem ele, o glossário sai só com o campo `pt` dos
 * pacotes, que é o que existia antes. A ausência é um aviso, não um erro —
 * quem não tem o arquivo ainda tem um glossário, só que menor.
 *
 * @param {string} raiz
 * @returns {Map<string,string>}
 */
function carregarGlossasExternas(raiz) {
  const caminho = join(raiz, 'gloss-pt.json');
  if (!existsSync(caminho)) {
    console.warn(
      `gloss-pt.json ausente — o glossário sai só com o campo 'pt' dos pacotes.\n` +
        '  Gere com: python3 _build/tools/extrair-glossas.py',
    );
    return new Map();
  }
  const bruto = lerJson(caminho);
  const saida = new Map();
  for (const [forma, glosa] of Object.entries(bruto)) {
    if (typeof glosa === 'string' && glosa.trim()) saida.set(forma, glosa.trim());
  }
  return saida;
}

/**
 * @param {string} [raiz]
 * @returns {{radicais: number, dePacotes: Record<string, number>}}
 */
export function gerarGlossarioPt(raiz = RAIZ) {
  /** radical → glosa */
  const porRadical = new Map();
  /** forma → glosa (fallback quando o radical não tem) */
  const porForma = new Map();
  const dePacotes = {};

  // Definições externas em português, por FORMA (`gloss-pt.json`).
  //
  // Sem elas o glossário sai quase vazio para o português: 89% das entradas do
  // pacote `pt` não tem campo `pt`, porque o texto bíblico em português já é a
  // palavra — o que falta é o SENTIDO, e ele não estava em lugar nenhum do
  // projeto. O arquivo é produzido por extração do Wiktionary
  // (`_build/tools/extrair-glossas.py`) e entra aqui indexado por radical, que
  // é como o `OfflineDictManager` consulta (`lookupPtGlossary(root)`).
  const externas = carregarGlossasExternas(raiz);

  for (const lang of pacotes(raiz)) {
    const dir = join(raiz, lang);
    let glosas = 0;
    for (const livro of livrosDo(dir)) {
      for (const [surface, bruta] of Object.entries(lerJson(join(dir, livro)))) {
        if (typeof bruta !== 'object' || bruta === null) continue;
        const root = typeof bruta.root === 'string' && bruta.root ? bruta.root : surface;

        // 1) Campo `pt` do próprio pacote: é a fonte mais confiável, existe
        //    onde a tradução foi feita, e a primeira que vale.
        const pt = bruta.pt;
        if (glosaUtil(pt)) {
          glosas++;
          if (!porRadical.has(root)) porRadical.set(root, pt);
          if (!porForma.has(surface)) porForma.set(surface, pt);
          continue;
        }

        // 2) Definição externa por forma.
        const externa = externas.get(surface) ?? externas.get(root);
        if (glosaUtil(externa)) {
          glosas++;
          if (!porRadical.has(root)) porRadical.set(root, externa);
          if (!porForma.has(surface)) porForma.set(surface, externa);
        }
      }
    }
    if (glosas) dePacotes[lang] = glosas;
  }

  // Segundo passe: forma que tem glosa mas cujo radical não tem.
  for (const [forma, glosa] of porForma) {
    if (!porRadical.has(forma)) porRadical.set(forma, glosa);
  }

  const saida = {};
  for (const chave of [...porRadical.keys()].sort()) saida[chave] = porRadical.get(chave);

  // O `OfflineDictManager` (Android) pula estas três chaves ao carregar o
  // glossário. Uma delas ser um radical real faria a glosa daquele radical sumir
  // — em silêncio, porque a glosa do resto continuaria aparecendo. Hoje
  // nenhuma colide (verificado), mas a checagem custa uma linha e a consequência
  // de errar é uma tradução que não aparece para uma pessoa que a esperava.
  for (const reservada of RESERVADAS) {
    if (Object.hasOwn(saida, reservada)) {
      throw new Error(
        `pt_master_glossary.json: "${reservada}" é um radical e também uma chave ` +
          'reservada pelo leitor do Android. Renomeie o radical na fonte.',
      );
    }
  }

  escreverJson(SAIDA, saida);
  return { radicais: Object.keys(saida).length, dePacotes };
}

if (process.argv[1] && process.argv[1].endsWith('gen-pt-glossary.mjs')) {
  const { radicais, dePacotes } = gerarGlossarioPt();
  console.log(`pt_master_glossary.json — ${radicais} radicais`);
  for (const [lang, n] of Object.entries(dePacotes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang.padEnd(4)} ${String(n).padStart(7)} glosas`);
  }
}
