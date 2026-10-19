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

`root` é o lema, e amarra a família — é o que permite tocar numa forma
conjugada e ver as demais.

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
node tools/gen-master.mjs         # master.json por idioma (união dos 66 livros)
node tools/gen-pt-glossary.mjs    # radical → glosa PT
node tools/empacotar.mjs          # dist/*.zip  (ou `empacotar.mjs pt en` só alguns)
```

`npm run build` faz os três em sequência.

Publicar: `PUBLISH_TAG=v2026.01.18 npm run release` empacota e cria a release no
GitHub, de onde o app baixa.

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
