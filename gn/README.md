# Dicionário de Guaraní (Mbyá)

Gerado por `node scripts/build-gn-dict.mjs`. Não edite os arquivos à mão: eles
são reescritos na íntegra a cada build.

## Fontes

| Fonte | Uso | Licença |
| --- | --- | --- |
| `public/data/bolls/GUN/**` — Guaraní (Mbyá 2004), eBible.org / Wycliffe | texto bíblico: define **quais** palavras entram e **onde** | CC BY 4.0 |
| `scripts/data/diccionario-gua.json` — [Ñeerandu](https://github.com/luisagd/neerandu) | lema, classe gramatical e glosa | CC BY-SA (ver `LICENSE` do repositório de origem) |
| `public/data/bolls/ACF11/**` | texto paralelo, só para identificar os nomes próprios | CC BY 4.0 |

O arquivo por livro (`1.json` … `66.json`) é o que o leitor carrega em
`/data/dict/gn/<bookId>.json`, consumido por `loadNormDict` em
`src/hooks/useDictionary.ts`. `_master_gn.json` é a soma de todos, para busca
global e inspeção.

## O que cada verbete carrega

```json
"japo": {
  "root": "japo",
  "def": "verbo: Fazer, executar, fabricar. — Mc. 1:21",
  "pos": "verbo",
  "refs": ["Mc. 1:21", "Mc. 3:29", "Mc. 7:37"]
}
```

- `def` — a glosa do dicionário de palavras, seguida da **primeira ocorrência**
  na Bíblia (mesmo formato do dicionário grego: `… — Mc. 13:26`). É o que o
  popover mostra.
- `refs` — todos os versículos, para o dicionário bíblico. O app ainda não
  renderiza essa lista; ela fica disponível para a busca por versículo.
- `root` — o lema. Para as formas cliticizadas, vem o lema original, e a forma
  vista no texto aparece no fim da glosa (`… [forma ojapo]`).

## Cobertura, e o que ficou de fora

1.894 lemas distintos cobrem **54,6%** dos tokens do texto. As lacunas são
conhecidas e não são bugs do build:

- **Formas cliticizadas.** A Bíblia usa `ojapo`, `ojejapo`, `aipojapo`; o
  dicionário registra o lema `japo`. Os clíticos do guaraní são um conjunto
  fechado, então o build deriva as formas por composição (prefixo + reflexivo
  `je` + lema) e a busca as alcança. O que **não** dá para derivar é a
  nasalização do verbo: `ikoe` (viver) vira `oiko` no texto e `ikoe`→`iko` não é
  o lema, então `oiko` só resolve quando existe verboete próprio.
- **Derivação.** `kuery` (antigo) vem de `kue` + sufixo; `rami` (assim) vem de
  `hína` + `-rami`. São sufixos padrão, mas a regra não é mecânica e preferimos
  não chutar significado.
- **Nomes próprios: resolvidos, e por método.** São as palavras mais frequentes
  do texto — `Senhor` aparece 7.690 vezes, `Nhanderuete` 3.078 — e o dicionário
  de palavras não tem nenhum deles. O build os detecta por caixa-alta no meio da
  frase sem contrapartida em minúscula, e identifica cada um comparando o
  versículo com o **mesmo versículo em português** (ACF11, que já está no
  projeto): 546 nomes saem assim, com a identificação vinda das próprias
  traduções em vez de palpite. Os 40 que a comparação não resolve — porque a
  forma Mbyá não parece com a portuguesa — estão em
  `scripts/data/proprios-gn.json`, conferidos à mão no versículo anotado:
  `Salatiel` é Zorobabel, `Cam` é Cão, `Etiópia` é Cusi, `Mênfis` é Nofe,
  `Nhanderuete` é Deus. Ainda faltam os nomes raros (aparecem menos de 8 vezes)
  e alguns lugares citados só pelo adjetivo.
- **Divergência Mbyá × Jopará.** A Bíblia é Mbyá; o dicionário é guaraní padrão.
  `kue` é o exemplo visível: no Jopará significa "móvel, vacilante" e na Mbyá
  "antigo". A glosa exibida é a do dicionário, e pode não bater.

Cobertura por token é a métrica honesta aqui; contagem de verbetes sem o texto
ao lado não diz nada.

## Busca

`normalizeGuarani` (em `src/lib/utils.ts`) é a forma de comparação dos dois
lados: minúsculas, sem acento, sem apóstrofo. Sem ela, `po'ã`, `poã` e `poa` são
três palavras diferentes e nada é achado.
