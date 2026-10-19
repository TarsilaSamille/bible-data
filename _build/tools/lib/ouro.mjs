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

/**
 * Substantivos: a classe que a heurística DESTRUI.
 *
 * O bloco de verbos acima mede onde a heurística funciona (irregulares e
 * cliticizados). Este mede onde ela ERR A, e é o bloco que estava faltando:
 * sem ele, um lemmatizer que transforma `noite` em `noi` e `abismo` em `abis`
 * ainda passa em 100% da amostra de verbos, e o número de 70% parece bom.
 *
 * O lema esperado é o SINGULAR (`mulheres` → `mulher`), não a própria forma.
 * A primeira versão deste bloco usava `null` para tudo, com o argumento de que
 * "o lema não existe no corpus". Isso estava errado: a medição passou a
 * reprovar `mulheres → mulher` e `dores → dor` como erro, quando são exatamente
 * o comportamento desejado — é o agrupamento que faz a pessoa tocar em
 * `mulheres` e ver `mulher`. Anotar a expectativa errada é pior que não
 * anotar: faz o relatório mentir sobre o próprio sistema.
 *
 * O que NÃO entra aqui é substantivo que a heurística destrói (`noite`,
 * `abismo`), porque o lema correto delas É a própria forma.
 */
export const OURO_PT_SUBSTANTIVOS = {
  // Plural regular: o lema é o singular.
  mãos: 'mão',
  olhos: 'olho',
  aves: 'ave',
  dores: 'dor',
  bens: 'bem',
  vasilhas: 'vasilha',
  visões: 'visão',
  rostos: 'rosto',
  qualidades: 'qualidade',
  pecadores: 'pecador',
  animais: 'animal',
  homens: 'homem',
  mulheres: 'mulher',
  pessoas: 'pessoa',
  janelas: 'janela',
  cidades: 'cidade',
  irmãos: 'irmão',
  filhos: 'filho',
  // Terminados em -te, -mo, -se: onde o corte de clítico produzia radical falso.
  // O lema é a própria forma; se voltar `noi`, `abis` ou `eli`, é bug.
  noite: null,
  abismo: null,
  semente: null,
  vinte: null,
  gente: null,
  mente: null,
  corte: null,
  parte: null,
  elite: null,
  frente: null,
  fonte: null,
  sorte: null,
  norte: null,
  // Monossilábicos e nominais: intocáveis.
  terra: null,
  paz: null,
  lei: null,
  luz: null,
  fé: null,
  voz: null,
};

export const OURO_EN_SUBSTANTIVOS = {
  waters: 'water',
  darkness: 'darkness',
  fowl: null,
  cattle: null,
  whales: 'whale',
  nights: 'night',
  hands: 'hand',
  eyes: 'eye',
  birds: 'bird',
  pains: 'pain',
  vessels: 'vessel',
  faces: 'face',
  cities: 'city',
  brothers: 'brother',
  sons: 'son',
  mothers: 'mother',
  gates: 'gate',
  sayings: 'saying',
  earth: null,
  fire: null,
  house: null,
  water: null,
  bread: null,
  book: null,
  star: null,
  stars: 'star',
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
  {
    lang: 'pt',
    bloco: 'substantivos',
    dados: OURO_PT_SUBSTANTIVOS,
    armadilhas: ARMADILHAS_PT,
    // Bloqueio por natureza: qualquer erro aqui significa radical falso em
    // substantivo, que é o defeito que corrompeu 3 mil raízes.
    critico: true,
  },
  { lang: 'en', bloco: 'substantivos_seed11', dados: OURO_EN.substantivos_seed11, armadilhas: ARMADILHAS_EN },
  {
    lang: 'en',
    bloco: 'substantivos',
    dados: OURO_EN_SUBSTANTIVOS,
    armadilhas: ARMADILHAS_EN,
    critico: true,
  },
  { lang: 'en', bloco: 'verbos_seed11', dados: OURO_EN.verbos_seed11, armadilhas: ARMADILHAS_EN },
];
