/**
 * Padrão de ouro do lemmatizer: amostras anotadas à mão.
 *
 * Sem isto, "o lemmatizer melhorou" é opinião. Cada entrada é uma FORMA DE
 * SUPERFÍCIE que existe como chave no pacote, e o lema que deveria virar o
 * `root`.
 *
 * `null` como lema significa "a forma JÁ É o lema" — substantivo, partícula,
 * nome próprio, advérbio. Não é a mesma coisa que ausente: ausente é erro do
 * lemmatizer, `null` é resposta certa. A medição trata os dois diferente, e é
 * por isso que `null` aparece tanto — o caso em que um lemmatizer agressivo faz
 * estrago é `terra → ter`, não `criou → cri`.
 *
 * As amostras saíram de `report-lemma.mjs --amostra`, com seed e contagem
 * declarados em cada bloco, para poderem ser reproduzidas depois que o pacote
 * mudar.
 *
 * REGRA DA ANOTAÇÃO: o lema é a forma de dicionário do pacote, com a
 * ortografia dele (o KJV-IRVT escreve `côvado`, não `covado`). Anotar o verbo
 * regular ideal, e não a forma que o dicionário usa, faria a medição premiar o
 * lemmatizer por acertar uma palavra que ele nunca vai encontrar.
 */

/** @typedef {Record<string, string|null>} Amostra */

export const OURO_PT = {
  verbos_seed7: {
    destruindo: 'destruir',
    buscarem: 'buscar',
    entrava: 'entrar',
    aguça: null, // substantivo
    ande: null, // conjunção
    saírem: 'sair',
    intenta: 'intentar',
    apostolado: 'apostolado', // substantivo
    empreendido: 'empreender',
    mandarem: 'mandar',
    aleijado: 'aleijado', // substantivo/adjetivo
    vala: null,
    guardarei: 'guardar',
    conforma: 'conformar',
    adulteram: 'adulterar',
    apascentem: 'apascentar',
    establecei: 'estabelecer',
    escrita: 'escrever',
    amoleça: 'amolecer',
    contou: 'contar',
    espalhar: 'espalhar',
    alijar: 'alijar',
    sejam: 'ser',
    assombrou: 'assombrar',
    olhou: 'olhar',
    oferecerem: 'oferecer',
    mandarão: 'mandar',
    alugada: null, // particípio usado como substantivo
    manifesto: null, // adjetivo
    entregarão: 'entregar',
    ajudará: 'ajudar',
    suscitem: 'suscitar',
    atribuíu: 'atribuir',
    derramase: 'derramar',
    escurecerá: 'escurecer',
    beijou: 'beijar',
    invalidando: 'invalidar',
    assegurado: null,
    libertaram: 'libertar',
    desfeito: 'desfazer',
    lembradas: null,
  },
};

export const OURO_EN = {
  substantivos_seed11: {
    earth: null,
    waters: 'water',
    darkness: 'darkness',
    firmament: null,
    fowl: null,
    cattle: null,
    whales: 'whale',
    evening: 'evening',
  },
  verbos_seed11: {
    created: 'create',
    moved: 'move',
    divided: 'divide',
    gathered: 'gather',
    multiplied: 'multiply',
    // Verbos que não conjugam nada nesta forma: o lema é a própria forma.
    bring: null,
    bear: null,
    have: null,
    increase: null,
    wax: null,
  },
};

/**
 * Entradas que já quebraram um lemmatizer.
 *
 * `terra → ter` e `earth → ear` vinham de um backoff que aceitava qualquer
 * prefixo que também fosse chave do dicionário — e `ter` e `ear` SÃO palavras.
 * Elas ficam aqui porque acertar uma amostra grande e ainda transformar `terra`
 * em verbo continua inapto: o erro é visível na tela, na palavra mais comum do
 * primeiro versículo.
 *
 * Os irregulares de verbos estão aqui pelo mesmo motivo — `disse`, `fez`, `viu`
 * são as formas mais frequentes do texto bíblico, e nenhuma regra de sufixo as
 * alcança.
 */
export const ARMADILHAS_PT = {
  // Substantivo que termina como verbo.
  terra: null,
  // Verbo que existe e que não pode ser o lema de um substantivo.
  ter: null,
  era: 'ser',
  são: 'ser',
  vai: 'ir',
  foi: 'ir',
  está: 'estar',
  // Irregulares frequentes: nenhuma regra de sufixo alcança.
  disse: 'dizer',
  fez: 'fazer',
  viu: 'ver',
  deu: 'dar',
  veio: 'vir',
  pôde: 'poder',
  quis: 'querer',
  soube: 'saber',
  // Partículas: nunca têm lema distinto da própria forma.
  de: null,
  da: null,
  em: null,
  por: null,
  com: null,
  que: null,
  não: null,
  // A palavra que mais aparece na Bíblia, e uma partícula.
  deus: null,
};

export const ARMADILHAS_EN = {
  earth: null,
  ear: null,
  waters: 'water',
  water: null,
  created: 'create',
  create: null,
  said: 'say',
  say: null,
  // Irregulares de alta frequência no texto bíblico.
  came: 'come',
  come: null,
  given: 'give',
  give: null,
  made: 'make',
  make: null,
};

/** Blocos por idioma, para a medição. */
export const MEDICOES = [
  { lang: 'pt', bloco: 'verbos_seed7', dados: OURO_PT.verbos_seed7, armadilhas: ARMADILHAS_PT },
  { lang: 'en', bloco: 'substantivos_seed11', dados: OURO_EN.substantivos_seed11, armadilhas: ARMADILHAS_EN },
  { lang: 'en', bloco: 'verbos_seed11', dados: OURO_EN.verbos_seed11, armadilhas: ARMADILHAS_EN },
];
