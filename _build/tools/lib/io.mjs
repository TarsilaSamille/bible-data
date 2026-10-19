/**
 * Utilidades de I/O dos pacotes de dicionário.
 *
 * Os pacotes são grandes (o japonês sozinho passa de 1 milhão de chaves) e são
 * lidos muitas vezes durante um build, então carregar e serializar com
 * `JSON.parse`/`JSON.stringify` é aceitável, mas ler o diretório e descobrir o
 * que existe precisa ser feito uma vez só.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Raiz do repositório de dados.
 *
 * `tools/` fica dentro de `_build/`, que é a única pasta do repo que NÃO é
 * dicionário. O motivo é o consumidor web: este repositório entra lá como
 * submódulo em `public/data/dict/`, e qualquer arquivo na raiz acaba sendo
 * SERVIDO junto com os dados — inclusive `package.json` e os scripts, que viram
 * URLs públicas e fazem o web contar diretórios que não são idiomas (o teste
 * de "quantos idiomas têm dicionário" passou a ver 17 em vez de 15 por causa
 * de `tools/` e `.github/`).
 */
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Nomes de livro bíblico: 1 a 66, em qualquer ordem. */
export const LIVROS = (() => {
  const out = [];
  for (let i = 1; i <= 66; i++) out.push(String(i));
  return out;
})();

/** Um nome de livro é `N.json`? */
export function ehLivro(nome) {
  return /^[0-9]{1,2}\.json$/.test(nome);
}

/** Os `N.json` de um pacote, ordenados pelo número do livro. */
export function livrosDo(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(ehLivro)
    .map((n) => Number(n.replace('.json', '')))
    .sort((a, b) => a - b)
    .map((n) => `${n}.json`);
}

/**
 * Todos os pacotes (diretórios de idioma) na raiz do repo.
 *
 * O critério é TER LIVROS: um diretório só é pacote se tiver algum `N.json`.
 * Filtrar por nome seria frágil (`.github`, `dist` e `node_modules` não são
 * dicionários, mas um nome novo não avisaria), e o custo do teste é um
 * `readdir` por diretório — uma vez por build.
 */
export function pacotes(raiz = RAIZ) {
  return readdirSync(raiz)
    .filter((n) => {
      const p = join(raiz, n);
      if (!statSync(p).isDirectory()) return false;
      return readdirSync(p).some(ehLivro);
    })
    .sort();
}

/** Lê e parseia um JSON. */
export function lerJson(caminho) {
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

/**
 * Escreve JSON sem formatação: um pacote de 375 KB por livro, em 66 livros, é
 * 25 MB por idioma — indentado, vira 60 MB e o git demora em cada diff.
 */
export function escreverJson(caminho, dados) {
  writeFileSync(caminho, JSON.stringify(dados));
}

/** Número de entradas de um pacote inteiro. */
export function contarEntradas(dir) {
  let total = 0;
  for (const livro of livrosDo(dir)) {
    total += Object.keys(lerJson(join(dir, livro))).length;
  }
  return total;
}
