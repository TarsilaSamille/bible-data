# bible-dict-data

Dicionário bíblico multilingue — fonte única para o **Scriptorium web** e o
**Scriptorium Android**.

O texto bíblico é o mesmo nos dois apps; a diferença estava em como cada um
guardava o dicionário. O web tinha os dados richest (com `verses`, `pos`,
glosas em vários idiomas) dentro do próprio repositório, e o mobile tinha uma
cópia mais pobre, gerada por um pipeline à parte, que precisava ser
reempacotada e publicada a cada correção. Duas fontes, dois formatos, e
divergência silenciosa.

Aqui os dois leem o mesmo arquivo.

## O que tem aqui

Um diretório por idioma, com um `N.json` por livro bíblico (1 a 66):

```
pt/1.json … pt/66.json     pt/master.json
grc/1.json … grc/66.json   grc/master.json, grc/lemma_master.json, …
heb/…
en/ es/ id/ de/ fr/ it/ ja/ ko/ la/ ar/ ru/ zh/ gn/
grc-index.json             índice de radiais do grego (superfície → lema)
pt_master_glossary.json    radical → glosa em português
tools/                     build, índices e empacotamento
```

## Como entra uma entrada

A chave é sempre a **forma de superfície**, exatamente como aparece no texto:

```json
"criou": {
  "root": "criar",
  "en": "to create, to put into existence",
  "pt": "criou",
  "es": "creó",
  "id": "menciptakan",
  "translit": "",
  "pos": "VERB"
}
```

`root` é o **lema**, e amarra a família — é o que permite tocar numa forma
conjugada e ver as demais.

## O lema por idioma

Nem todo idioma tem lema exato, e fingir que tem é pior do que não ter:

| Idioma | Estratégia | Precisão | O que é |
|---|---|---|---|
| `grc` | índice de radiais | exata | dado (`grc-index.json`), agrupa acentuada/sem-acento |
| `heb` | forma sem pontos | exata | dado, por convenção da gramática |
| `la` | identidade | — | a citação já é o lema (`dixit`, `terra`) |
| `zh` `ja` `ko` `gn` | identidade | — | o idioma não flexiona a chave |
| `pt` | regras + portão de `pos` | ~70% | heurística, medida |
| `en` | regras + portão de `pos` | ~90% | heurística, medida |
| `es` `id` `de` `fr` `it` `ar` `ru` | **não tocado** | — | falta padrão de ouro |

"Não tocado" é decisão, não omissão: a heurística foi escrita e medida para pt/en,
e aplicá-la onde não há medição seria publicar palpite como dado.

```bash
node _build/tools/report-lemma.mjs           # mede contra o padrão de ouro
node _build/tools/report-lemma.mjs --amostra  # sorteia casos p/ anotar
node _build/tools/apply-lemma.mjs            # simulação
node _build/tools/apply-lemma.mjs --pack     # grava
```

O padrão de ouro (`_build/tools/lib/ouro.mjs`) é anotado à mão. Sem ele,
"melhorou" não é uma afirmação verificável.

## Como os dois apps consomem

| Consumidor | Como |
|---|---|
| **Web** | submódulo em `public/data/dict/` — o mesmo caminho de sempre, zero mudança no código |
| **Mobile** | baixa `dict-mobile-<lang>.zip` das releases, descompacta em `filesDir/dict/<lang>/` |

O formato que o mobile recebe é derivado do daqui (`tools/empacotar.mjs`): sem
`verses` nem `pos_counts`, que ocupam MB e o Android não lê, e com `def`
preenchido com a glosa do idioma.

## Build

```bash
node _build/tools/gen-master.mjs         # master.json por idioma (união dos 66 livros)
node _build/tools/gen-pt-glossary.mjs    # radical → glosa PT
node _build/tools/verificar.mjs          # falha o build se um pacote tem entrada sem glosa
node _build/tools/empacotar.mjs          # _build/dist/*.zip
```

`npm run build` faz os quatro em sequência.

Publicar: `PUBLISH_TAG=vAAAAMMDD npm run release` empacota e cria a release no
GitHub, de onde o app baixa.

## O que ainda falta

Medido, não adivinhado:

- **Lema em 7 idiomas** (`es`, `id`, `de`, `fr`, `it`, `ar`, `ru`). Cada um
  precisa de padrão de ouro anotado e iteração até passar.
- **~30% de erro em português.** O que falta é irregular e clítico
  (`escreveu` → `escrever`, `sejam` → `ser`), que regra de sufixo não alcança.
  A saída é um dicionário de lemas, não mais uma tabela.
- **Flexão grega além de acento.** O índice agrupa `γῆ`/`γη`, mas `λόγος`/
  `λόγου`/`λόγῳ` ainda não — precisa de um morphological analyzer grego.
- **20 chaves de sigla de capítulo** no pacote `en` (`i.`, `1.ch.11.11`):
  problema de tokenização na origem, relatado pelo verificador, não corrigido.
- **Glosa PT ausente** onde o glossário antigo só tinha `en` (o `criou` do
  pacote `pt` mostra a definição em inglês).

## Idioma que é pacote de definição vs. de tradução

`grc`, `heb`, `la`, `ar`, `zh`, `ja`, `ko`, `ru` entregam a **definição** (o
infinitivo ou o sentido) em inglês — o campo `en` é a definição, não uma
tradução. Nos demais, `en` é a tradução para o inglês e `pt`/`es`/`id` são as
outras traduções. `tools/lib/schema.mjs` decide qual mostrar, e é por isso que
o mesmo código de build produz pacote correto para os dois tipos.

## Regras

- **Nenhum campo inventado.** Se o dado não existe na origem, o campo não é
  escrito. String vazia é pior que ausência: o mobile trata vazio como
  "sem tradução" e cai no tradutor online.
- **Semant definido.** `master.json` é a união dos 66 livros; na colisão entre
  livros vence a primeira ocorrência.
- **Ferramentas sem dependência.** Node puro, sem `npm install` — o build roda
  em qualquer máquina e no CI sem setup.
