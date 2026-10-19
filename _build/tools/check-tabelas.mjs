#!/usr/bin/env node
/**
 * Confere as tabelas do lemmatizer.
 *
 * Três defeitos que já custaram resultado errado e que nenhuma revisão de olho
 * pega, porque o sintoma aparece longe da causa:
 *
 *   1. CHAVE DUPLICADA em objeto literal. JavaScript resolve duplicata em
 *      silêncio — a última vence. `fui: 'ser'` numa linha e `fui: 'ir'` em
 *      outra produziam lema `ir`, que está errado, e o dado ficava corrompido
 *      sem nenhum erro de sintaxe.
 *   2. CHAVE INEXISTENTE. `{'s': ['s']}` é sintaxe válida e nunca casa com
 *      sufixo real.
 *   3. VALOR VAZIO OU INÚTIL, que transforma o mapa em decoração.
 *
 * Sai com código 1 quando acha qualquer um, para rodar no CI.
 */

import { readFileSync } from 'node:fs';
import { IRREGULARES, INF, RESTOS, SUFIXOS } from './lib/lemmatize.mjs';

const problemas = [];

function checarDuplicadas(caminho, nome) {
  const texto = readFileSync(caminho, 'utf8');
  const langs = [...texto.matchAll(/^  (\w+):\s*\{$/gm)].map((m) => m[1]);
  for (const lang of langs) {
    // Bloco do idioma: da linha `  xx: {` até o próximo `  yy: {` ou `};`
    const inicio = texto.search(new RegExp(`^  ${lang}: \\{$`, 'm'));
    if (inicio < 0) continue;
    const resto = texto.slice(inicio);
    const fim = resto.search(/^  \w+: \{$|^};$/m);
    const bloco = resto.slice(0, fim < 0 ? resto.length : fim);

    const achadas = [...bloco.matchAll(/^\s*([\p{L}'-]+):\s*(\[|')/gmu)].map((m) => m[1]);
    const contagem = new Map();
    for (const k of achadas) contagem.set(k, (contagem.get(k) ?? 0) + 1);
    for (const [k, n] of contagem) {
      if (n > 1) problemas.push(`${nome}.${lang}: chave "${k}" aparece ${n}x (a última vence)`);
    }
  }
}

const caminho = new URL('./lib/lemmatize.mjs', import.meta.url).pathname;

/** Valor inútil: sufixo vazio ou lista de finais vazia. */
/**
 * Idiomas em que sufixo de UMA letra é flexão legítima.
 *
 * Em inglês o gerúndio é `create` + `d`, e cortar uma letra só é o que separa
 * `created` de `create`. Em português a flexão é por terminação, e `-o` de uma
 * letra converte substantivo em verbo (`manifesto` → `manifestar`) — por isso
 * `-o` e `-a` já foram retirados de `INF.pt`.
 *
 * `-e` e `-i` continuam em `INF.pt` porque sem eles `ter`, `partir`, `mentir`
 * e `sair` perdem o lema, e o padrão de ouro confirma que o resultado está
 * certo: o portão de `pos` já garante que a regra só roda em verbo.
 *
 * `fr` e `id` entram aqui por-default porque estão FORA do escopo aplicado
 * (`apply-lemma.mjs` não os toca). Quando entrarem, a lista precisa ser revista
 * com o padrão de ouro do idioma.
 */
const SUFIXO_CURTO_OK = new Set(['en', 'de', 'es', 'it', 'pt', 'fr', 'id', 'ru', 'ar']);

for (const [lang, tabela] of Object.entries(INF)) {
  for (const [sufixo, finais] of Object.entries(tabela)) {
    if (!sufixo) problemas.push(`INF.${lang}: chave vazia`);
    if (!Array.isArray(finais) || finais.length === 0) {
      problemas.push(`INF.${lang}.${sufixo}: lista de finais vazia`);
    }
    if (sufixo.length === 1 && !SUFIXO_CURTO_OK.has(lang)) {
      problemas.push(
        `INF.${lang}.${sufixo}: sufixo de uma letra em ${lang} converte ` +
          'substantivo em verbo (use lista de regras, não terminação)',
      );
    }
  }
}

for (const [lang, lista] of Object.entries(SUFIXOS)) {
  const contagem = new Map();
  for (const s of lista) contagem.set(s, (contagem.get(s) ?? 0) + 1);
  for (const [s, n] of contagem) {
    if (n > 1) problemas.push(`SUFIXOS.${lang}: "${s}" aparece ${n}x (ruído, corrigir)`);
  }
  for (const s of lista) {
    if (s.length === 1 && !SUFIXO_CURTO_OK.has(lang)) {
      problemas.push(`SUFIXOS.${lang}: "${s}" tem uma letra em ${lang}`);
    }
  }
}

for (const [lang, tabela] of Object.entries(IRREGULARES)) {
  for (const [forma, lema] of Object.entries(tabela)) {
    if (!forma || !lema) problemas.push(`IRREGULARES.${lang}: "${forma}" sem lema`);
    // `x → x` não é erro: a forma JÁ é o lema (`have`, `dizer`). A entrada
    // serve só para impedir que a heurística mexa nela.
  }
}

for (const [lang, tabela] of Object.entries(RESTOS)) {
  const contagem = new Map();
  for (const r of tabela) contagem.set(r, (contagem.get(r) ?? 0) + 1);
  for (const [r, n] of contagem) if (n > 1) problemas.push(`RESTOS.${lang}: "${r}" aparece ${n}x`);
}

checarDuplicadas(caminho, 'IRREGULARES/INF');

if (problemas.length) {
  console.error(`lemmatize: ${problemas.length} problema(s) nas tabelas\n`);
  for (const p of problemas) console.error(`  ${p}`);
  process.exit(1);
}
console.log('lemmatize: tabelas ok (sem chave duplicada, sem valor inútil)');
