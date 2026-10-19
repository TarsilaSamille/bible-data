/**
 * Derivação de lema por idioma.
 *
 * O `root` das entradas é a CHAVE de superfície (`criou`, `disse`, `and`).
 * O que o app mostra e agrupa é o LEMA (`criar`, `dizer`, `be`): é o que
 * permite tocar numa forma conjugada e ver a família inteira.
 *
 * Três classes de idioma, porque a linguística não é uniforme:
 *
 *   1. EXATO — o lema está nos dados (`grc`: índice de radiais; `heb`: a forma
 *      sem pontos É o lema, por convenção). Nada a adivinhar.
 *   2. IDENTIDADE — o idioma não flexiona o que está na chave (`zh`, `ja`, `ko`)
 *      ou a citação já é o lema (`la`: `dixit`, `terra`, `autem`).
 *   3. REGRAS — línguas modernas com sufixos (`en`, `pt`, `es`, `id`, `it`,
 *      `fr`, `de`). Aqui há heurística involved, e a heurística erra; por isso
 *      `report-lemma.mjs` mede e publica a cobertura, em vez de esconder o
 *      palpite dentro do dado.
 *
 * REGRA DE OURO: quando a derivação não tem confiança, devolve a própria chave.
 * Um lema errado agrupa palavras que não são da mesma família, o que é pior do
 * que não agrupar.
 */

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/**
 * Pontuação hebraica: cantillation (0591–05AF), sinais de vogal e metafonia
 * (05B0–05C7). O maqaf (05BE) fica de fora de propósito: é separador de
 * composto, não pontuação, e o lema precisa preservá-lo.
 */
const HEB_POINTS = /[ְ-ׇ]/g;

const stripPoints = (s) => s.replace(HEB_POINTS, '');

/**
 * Grego: acentos e diacríticos fora, para casar com as chaves do
 * `grc-index.json` (que são justamente sem acento).
 */
const stripGreek = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[᾽-῿]/g, (c) => {
      // As maiúsculas acentuadas do grego polytônico (᾿ etc.) decompõem mal em
      // NFD; o fallback é o próprio caractere, que o índice também guarda.
      return c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    })
    .toLowerCase();

/* ------------------------------------------------------------------ */
/* 1. Grego — lema exato via índice de radiais                          */
/* ------------------------------------------------------------------ */

/**
 * @param {string} surface
 * @param {Map<string,string>} indice  `grc-index.json`: forma sem acento → lema
 */
export function lemaGrego(surface, indice) {
  if (!indice) return surface;
  return indice.get(stripGreek(surface)) ?? surface;
}

/* ------------------------------------------------------------------ */
/* 2. Hebraico — o lema é a forma sem pontos                            */
/* ------------------------------------------------------------------ */

export function lemaHebraico(surface) {
  const sem = stripPoints(surface);
  return sem || surface;
}

/* ------------------------------------------------------------------ */
/* 3. Identidade                                                        */
/* ------------------------------------------------------------------ */

const IDENTIDADE = new Set(['la', 'zh', 'ja', 'ko', 'gn']);

/* ------------------------------------------------------------------ */
/* 4. Línguas modernas — regras de sufixo                               */
/* ------------------------------------------------------------------ */

/**
 * Verbos irregulares que nenhum padrão de sufixo alcança. A forma citada é a
 * 1ª pessoa do presente (`sou`, `vou`) ou a forma mais comum no texto; o lema é
 * o infinitivo. Só entra aqui o que a regra não pega.
 */
const IRREGULARES = {
  pt: {
    sou: 'ser', és: 'ser', é: 'ser', era: 'ser', eram: 'ser', fui: 'ser', fomos: 'ser',
    fora: 'ser', foram: 'ser', serei: 'ser', está: 'estar', estou: 'estar', estamos: 'estar',
    estão: 'estar', estava: 'estar', foram: 'ser', vou: 'ir', vai: 'ir', went: 'ir',
    vamos: 'ir', vão: 'ir', ia: 'ir', íamos: 'ir', vou: 'ir', hei: 'haver', há: 'haver',
    havia: 'haver', fazem: 'fazer', fez: 'fazer', faço: 'fazer', far: 'fazer',
    digo: 'dizer', diz: 'dizer', disse: 'dizer', dizem: 'dizer', dizer: 'dizer',
    posso: 'poder', pode: 'poder', podem: 'poder', podia: 'poder',
    vi: 'ver', vejo: 'ver', viu: 'ver', vê: 'ver', vemos: 'ver',
    dou: 'dar', dá: 'dar', deu: 'dar', dão: 'dar',
    sei: 'saber', sabe: 'saber', sabem: 'saber', soube: 'saber',
    quero: 'querer', quer: 'querer', querem: 'querer', quis: 'querer',
    tenho: 'ter', tem: 'ter', têm: 'ter', tinha: 'ter', teve: 'ter', tinham: 'ter',
    tenho: 'ter', pôde: 'poder', pôr: 'pôr', ponho: 'pôr', pôs: 'pôr',
    vou: 'ir', vem: 'viver', vem: 'vir', viu: 'vir', vindo: 'vir',
    vou: 'ir', vai: 'ir', vens: 'vir', tenho: 'ter', tem: 'ter',
    ouvi: 'ouvir', ouve: 'ouvir', ouviu: 'ouvir',
    perdi: 'perder', perde: 'perder', perdeu: 'perder',
    vivi: 'viver', vive: 'viver', viveu: 'viver',
    deixei: 'deixar', deixa: 'deixar', deixou: 'deixar',
    li: 'ler', lê: 'ler', leu: 'ler', lemos: 'ler',
    cai: 'cair', caiu: 'cair', caem: 'cair',
    fui: 'ir', foste: 'ir', foi: 'ir', fomos: 'ir', for: 'ir', forem: 'ir',
  },
  es: {
    soy: 'ser', eres: 'ser', es: 'ser', era: 'ser', fue: 'ser', fueron: 'ser',
    estoy: 'estar', está: 'estar', están: 'estar', estaba: 'estar',
    voy: 'ir', va: 'ir', vas: 'ir', va: 'ir', íbamos: 'ir',
    he: 'haber', hay: 'haber', ha: 'haber', han: 'haber', había: 'haber',
    hago: 'hacer', hace: 'hacer', hizo: 'hacer', hacen: 'hacer',
    digo: 'decir', dice: 'decir', dijo: 'decir', dicen: 'decir',
    puedo: 'poder', puede: 'poder', pueden: 'poder', podía: 'poder',
    veo: 'ver', ve: 'ver', vio: 'ver', ven: 'ver',
    doy: 'dar', da: 'dar', dio: 'dar', dan: 'dar',
    sé: 'saber', sabe: 'saber', saben: 'saber',
    quiero: 'querer', quiere: 'querer', quieren: 'querer', quiso: 'querer',
    tengo: 'tener', tiene: 'tener', tienen: 'tener', tenía: 'tener', tuvo: 'tener',
    tengo: 'tener', voy: 'ir', puse: 'poner', pone: 'poner', puso: 'poner',
    oí: 'oír', oye: 'oír', oyó: 'oír',
    perdí: 'perder', pierde: 'perder', perdió: 'perder',
    viví: 'vivir', vive: 'vivir', vivió: 'vivir',
    leí: 'leer', lee: 'leer', leyó: 'leer',
    vine: 'venir', viene: 'venir', vino: 'venir',
    cuido: 'cuidar', cuida: 'cuidar', cuidar: 'cuidar',
  },
  id: {
    // `ada` cobre quase tudo o que é verbo estático em indonésio; o resto são
    // as formas que nenhum sufixo alcança.
    aku: 'ada', adalah: 'ada', adanya: 'ada', adapun: 'ada',
    menjadi: 'jadi', jadilah: 'jadi', jadikan: 'jadi',
    possui: 'punya', punya: 'punya', memiliki: 'punya',
    mendapat: 'dapat', dapat: 'dapat', diperoleh: 'dapat',
    memberikan: 'beri', memberi: 'beri', diberikan: 'beri',
    mengambil: 'ambil', ambil: 'ambil', diambil: 'ambil',
    kepada: 'kepada', kepadanya: 'kepada', kepadamu: 'kepada',
    terhadap: 'terhadap', therein: 'di', therein2: 'di',  },
  it: {
    sono: 'essere', sei: 'essere', è: 'essere', era: 'essere', stati: 'essere',
    vado: 'andare', vai: 'andare', va: 'andare', andiamo: 'andare',
    ho: 'avere', ha: 'avere', hai: 'avere', hanno: 'avere', aveva: 'avere',
    faccio: 'fare', fa: 'fare', fai: 'fare', fanno: 'fare',
    dico: 'dire', dice: 'dire', disse: 'dire', dicono: 'dire',
    posso: 'potere', può: 'potere', possono: 'potere',
    vedo: 'vedere', vede: 'vedere', vide: 'vedere', vedono: 'vedere',
    do: 'dare', dà: 'dare', diede: 'dare', danno: 'dare',
    so: 'sapere', sa: 'sapere', sanno: 'sapere',
    voglio: 'volere', vuole: 'volere', vollero: 'volere',
    tengo: 'tenere', tiene: 'tenere', tennero: 'tenere',
  },
  fr: {
    suis: 'être', es: 'être', est: 'être', était: 'être', sont: 'être',
    vais: 'aller', va: 'aller', vont: 'aller', allaient: 'aller',
    ai: 'avoir', a: 'avoir', ont: 'avoir', avait: 'avoir',
    fais: 'faire', fait: 'faire', font: 'faire',
    dis: 'dire', dit: 'dire', disent: 'dire',
    peux: 'pouvoir', peut: 'pouvoir', peuvent: 'pouvoir',
    vois: 'voir', voit: 'voir', voient: 'voir',
    donne: 'donner', donné: 'donner', donnent: 'donner',
    sais: 'savoir', sait: 'savoir', savent: 'savoir',
    veux: 'vouloir', veut: 'vouloir', veulent: 'vouloir',
    ai: 'avoir', avez: 'avoir', avons: 'avoir', aient: 'avoir',
  },
  de: {
    bin: 'sein', bist: 'sein', ist: 'sein', sind: 'sein', war: 'sein',
    habe: 'haben', hast: 'haben', hat: 'haben', haben: 'haben', hatte: 'haben',
    werde: 'werden', wird: 'werden', werden: 'werden',
    mache: 'machen', macht: 'machen', machen: 'machen',
    sage: 'sagen', sagt: 'sagen', sagen: 'sagen',
  },
  en: {
    am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
    have: 'have', has: 'have', had: 'have', having: 'have',
    do: 'do', does: 'do', did: 'do', done: 'do', doing: 'do',
    go: 'go', goes: 'go', went: 'go', gone: 'go', going: 'go',
    say: 'say', says: 'say', said: 'say', saying: 'say',
    make: 'make', makes: 'make', made: 'make', making: 'make',
    give: 'give', gives: 'give', gave: 'give', given: 'give', giving: 'give',
    take: 'take', takes: 'take', took: 'take', taken: 'take', taking: 'take',
    come: 'come', comes: 'come', came: 'come', coming: 'come',
    see: 'see', sees: 'see', saw: 'see', seen: 'see', seeing: 'see',
    know: 'know', knows: 'know', knew: 'know', known: 'know', knowing: 'know',
    get: 'get', gets: 'get', got: 'get', gotten: 'get', getting: 'get',
    give: 'give', tell: 'tell', told: 'tell', think: 'think', thought: 'think',
    bring: 'bring', brought: 'bring', find: 'find', found: 'find',
    gave: 'give', stood: 'stand', heard: 'hear', let: 'let', mean: 'mean',
    felt: 'feel', put: 'put', kept: 'keep', began: 'begin', seemed: 'seem',
    left: 'leave', called: 'call', asked: 'ask', turned: 'turn',
    became: 'become', wanted: 'want', showed: 'show', heard: 'hear',
    ran: 'run', came: 'come', looked: 'look', used: 'use',
  },
};

/**
 * Pronomes enclíticos do português e do espanhol. O texto bíblico translators
 * usa muito (`diz-me`, `disse-lhes`, `dávam-lhe`): sem tirar o clítico antes das
 * regras de sufixo, a forma sai errada quase sempre.
 */
const CLITICOS_PT = [
  'lhelo', 'lhes', 'lhe', 'nos', 'vos',
  'me', 'te', 'se', 'mo', 'to',
];
const CLITICOS_ES = ['selo', 'sela', 'les', 'me', 'te', 'se', 'nos', 'os', 'as', 'lo', 'la'];

/** Remove um clítico final (PT/ES). Devolve [base, tinhaClitico]. */
function tiraClitico(palavra, cliticos) {
  for (const c of cliticos) {
    if (palavra.length > c.length + 2 && palavra.endsWith(c)) {
      const base = palavra.slice(0, -c.length);
      // Só é clítico se o que sobra ainda parece palavra (não só uma vogal).
      if (base.length >= 2) return [base, true];
    }
  }
  return [palavra, false];
}

/**
 * Sufixos de verbo por idioma, do mais longo para o mais curto. A aplicação é
 * iterativa com limite: `cantávamos` → `cantar`, mas `cantar` não pode virar
 * `cant` só porque `ar` também está na lista.
 */
const SUFIXOS = {
  pt: [
    'aríamos', 'eríamos', 'iríamos', 'aríeis', 'eríeis', 'iríeis', 'aríam', 'eríam', 'iríam',
    'ássemos', 'êsseis', 'íssemos', 'ardes', 'erdes', 'irdes', 'aria', 'eria', 'iria',
    'ara', 'era', 'ira', 'avam', 'avam', 'emos', 'astes', 'estes', 'ardes',
    'aria', 'asse', 'esse', 'isse', 'astes', 'istes',
    'ando', 'endo', 'indo', 'ados', 'idos', 'adas', 'idas', 'amos', 'emos', 'imos',
    'ável', 'ível', 'ador', 'edor', 'idor', 'ada', 'ido', 'ada', 'ida', 'ara',
    'ava', 'era', 'iam', 'ara', 'ei', 'as', 'es', 'eu', 'ou', 'iu',
    'a', 'o', 'as', 'os', 'e', 'i',
  ],
  es: [
    'aríamos', 'eríamos', 'iríamos', 'arían', 'erían', 'irían',
    'aste', 'aste', 'ieron', 'iendo', 'ando', 'endo',
    'aron', 'ieron', 'ado', 'ido', 'ada', 'ida',
    'aba', 'ía', 'ara', 'era', 'ían', 'emos',
    'aste', 'iste', 'aron', 'eron', 'an', 'as', 'en', 'es',
    'ar', 'er', 'ir', 'o', 'a', 's',
  ],
  id: [
    'kannya', 'nya', 'lah', 'kah', 'pun',
    'meng', 'mem', 'men', 'meng', 'nya',
    'i', 'kan', 'an',
  ],
  it: [
    'erebbero', 'irebbero', 'eremmo', 'eremo', 'ereste', 'eresti',
    'erei', 'erà', 'eranno', 'ereste', 'erete',
    'ando', 'endo', 'endo', 'ato', 'ito', 'ata', 'ita',
    'ava', 'eva', 'iva', 'ono', 'ano', 'ano',
    'ai', 'ei', 'ì', 'o', 'a', 'e', 'i',
  ],
  fr: [
    'eraient', 'eraient', 'iraient', 'assions', 'issions', 'issions',
    'erions', 'irions', 'assent', 'issent', 'èrent', 'irent',
    'erais', 'irais', 'erons', 'irons', 'erai', 'irai',
    'ant', 'ent', 'ons', 'ez', 'ai', 'as', 'és', 'é',
    'e', 'a', 's',
  ],
  de: [
    'est', 'et', 'en', 'er', 'em',
    'st', 'te', 'ten', 'tet',
    'e', 'n', 't', 's',
  ],
  en: [
    'iness', 'ingly', 'edly',
    'ies', 'ied', 'ier', 'iest', 'iest',
    'sses', 'ssed', 'sser', 'ssing',
    'ing', 'ings',
    'ed', 'er', 'est',
    'es', 's',
  ],
};

const IRREGULARES_EN = IRREGULARES.en;

/**
 * O verbo em inglês quase sempre é reconhecido pela terminação; o substantivo,
 * não. A distinção decide o quanto se apaga: substantivo plural (-s) e
 * adjetivo comparativo (-er) são inhibited porque produzem substantivos novos.
 */
const IRREGULARES_PT = IRREGULARES.pt;
const IRREGULARES_ES = IRREGULARES.es;
const IRREGULARES_ID = IRREGULARES.id;
const IRREGULARES_IT = IRREGULARES.it;
const IRREGULARES_FR = IRREGULARES.fr;
const IRREGULARES_DE = IRREGULARES.de;

/** Stopwords: a palavra já é a forma canônica. Não há o que derivar. */
const IRREDUTIVEIS = new Set([
  // PT
  'de', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'e', 'ou', 'mas', 'que',
  'não', 'sim', 'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'me', 'te', 'se', 'lhe',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sobre', 'sob',
  'entre', 'até', 'desde', 'depois', 'antes', 'quando', 'onde', 'se', 'como',
  'isto', 'isso', 'aquilo', 'este', 'esse', 'aquele', 'esta', 'esta', 'essa',
  'aquela', 'meu', 'minha', 'teu', 'tua', 'seu', 'sua', 'nosso', 'nossa',
  'vosso', 'vossa', 'dele', 'dela', 'deles', 'delas', 'deus', 'jesus',
  'é', 'são', 'foi', 'foram', 'ser', 'há', 'ha', 'vai', 'vão', 'vem',
  'sedei', 'tu', 'vós', 'à', 'às', 'ao', 'aos',
  // EN
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'with', 'at',
  'by', 'from', 'as', 'is', 'was', 'it', 'he', 'she', 'they', 'them', 'this',
  'that', 'these', 'those', 'who', 'what', 'when', 'where', 'why', 'how',
  'all', 'every', 'each', 'both', 'not', 'no', 'yes', 'so', 'than', 'then',
  'his', 'her', 'their', 'its', 'our', 'your', 'my', 'me', 'him', 'us',
  'god', 'lord', 'jesus', 'christ',
  // ES
  'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'que', 'no', 'sí',
  'yo', 'tú', 'él', 'ella', 'nosotros', 'me', 'te', 'se', 'le', 'en', 'del',
  'al', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'su', 'sus', 'mi', 'tu',
  'es', 'son', 'fue', 'fue', 'ha', 'han',
]);

/**
 * Terminação de forma conjugada → terminais de infinitivo candidatos.
 *
 * A tabela de sufixos sozinha erra o fundamental: `criou` termina em `ou`, e
 * apagar `ou` deixa `cri`, que não é palavra nenhuma em português. O verbo tem
 * que voltar ao infinitivo (`criar`) — mas o terminal do infinitivo não é
 * dedutível do sufixo, porque `falo` é `falar` e `come` é `comer`. Por isso a
 * terminação vira CANDIDATOS, e a escolha é feita contra o vocabulário do
 * próprio pacote (ver `escolheCandidato`).
 *
 * A ordem dos candidatos importa quando o vocabulário não decide: as formas
 * mais frequentes na Bíblia vêm primeiro.
 */
const INF = {
  pt: { ou: ['ar'], eu: ['er'], iu: ['ir'], a: ['ar'], e: ['er'], o: ['ar'], i: ['ir'] },
  es: { o: ['ar'], a: ['ar'], e: ['er'], i: ['ir'] },
  it: { o: ['are'], a: ['are'], e: ['ere'], i: ['ire'] },
  fr: { e: ['er'], a: ['er'], i: ['ir'], s: ['er'] },
  de: { e: ['en'], t: ['en'], te: ['ten'] },
  en: { ed: [''], ing: [''], es: [''], s: [''] },
  id: { kan: ['kan'], i: ['i'] },
};

/**
 * Restos de flexão aceitos no backoff por prefixo.
 *
 * Este é o ponto onde a heurística anterior produziu `terra → ter` e
 * `earth → ear`: qualquer prefixo que também fosse chave do dicionário era
 * aceito, e `ter`/`ear` SÃO palavras. O que separa um corte legítimo de um
 * corte por coincidência não é o prefixo — é o RESTO. Plural e progressivo são
 * restos conhecidos; `ra` (de `terra`) e `th` (de `earth`) não são.
 */
const RESTOS = {
  pt: ['s', 'es', 'is', 'as', 'ns', 'e', 'em', 'ou', 'eu', 'iu', 'a', 'o', 'ada', 'ado', 'ida', 'ido', 'adas', 'ados', 'idas', 'idos'],
  es: ['s', 'es', 'as', 'os', 'n', 'a', 'o', 'e', 'ado', 'ida', 'idos', 'adas'],
  it: ['i', 'e', 'a', 'o', 'he', 'hi', 'ti', 'si', 'no', 'ne'],
  fr: ['s', 'x', 'ent', 'ant', 'e', 'a', 'é', 'ée', 'és', 'ons', 'ent'],
  de: ['n', 'e', 'en', 'er', 't', 'es'],
  en: ['s', 'es', 'ing', 'ed', 'd', 'er', 'est', 'y', 'ies'],
  id: ['kan', 'nya', 'pun', 'lah', 'kah'],
};

/**
 * Prefixo mais longo da palavra que também é chave do dicionário, com o resto
 * na lista de restos de flexão.
 */
function prefixoNoVocabulario(palavra, vocab, lang) {
  if (!vocab || !vocab.size) return null;
  const permitidos = new Set(RESTOS[lang] ?? []);
  if (!permitidos.size) return null;
  for (let corte = palavra.length - 1; corte >= 3; corte--) {
    const resto = palavra.slice(corte);
    if (!permitidos.has(resto)) continue;
    const prefixo = palavra.slice(0, corte);
    if (vocab.has(prefixo)) return prefixo;
  }
  return null;
}

/**
 * Lema colhido do próprio gloss (`<forma> (pt): <lema> (pt): <glosa>`).
 *
 * O padrão dos pacotes pt traz o infinitivo no meio — `criou (pt): criar (pt): to
 * create` — mas o campo do meio às vezes é a glosa em inglês (`no (pt): in the
 * (masc)`). A diferença é visível na FORMA: um infinitivo português é uma
 * palavra só terminando em `-ar`/`-er`/`-ir`; uma glosa inglesa tem espaço ou
 * não termina nesses finais. Aceitar sem esse teste é o que faria `no` virar
 * lema `in`.
 */
const INF_PT = /(?:^|\s)(?:[a-zá-úàâãéêíóôõúç]+(?:ar|er|ir))\b/i;

export function lemaDoGloss(forma, gloss) {
  if (!gloss) return null;
  const m = INF_PT.exec(gloss);
  if (!m) return null;
  const candidato = m[1];
  // Um infinitivo tem ao menos 4 letras e não pode ser o que já estava lá.
  if (candidato.length < 4) return null;
  if (candidato === forma) return null;
  return candidato;
}

/**
 * Lema inglês a partir da glosa: quase toda glosa verbal do pacote en abre com
 * o infinitivo (`to create, to put into existence`), que é o lema pronto.
 */
const GLOSS_EN = /^\s*to\s+([a-z][a-z-]{2,})\b/i;

export function lemaDoGlossEn(forma, gloss) {
  if (!gloss) return null;
  const m = GLOSS_EN.exec(gloss);
  if (!m) return null;
  const candidato = m[1];
  if (candidato === forma) return null;
  return candidato;
}

/**
 * @param {string} palavra
 * @param {string} lang
 * @param {Set<string>} [vocab]  chaves do próprio pacote
 * @param {Map<string,string>} [colhidos]  lema → forma, colhido do gloss
 * @returns {string}
 */
function lemaRegras(palavra, lang, vocab, colhidos) {
  if (!palavra) return palavra;
  if (IRREDUTIVEIS.has(palavra)) return palavra;
  // 1-2 caracteres são partícula, preposição ou abreviação; não há lema a achar.
  if (palavra.length <= 2) return palavra;

  // 0) Lema colhido do gloss: dado, não palpite. Vem antes de tudo.
  if (colhidos && colhidos.has(palavra)) return colhidos.get(palavra);

  const tabela = {
    pt: IRREGULARES_PT, es: IRREGULARES_ES, id: IRREGULARES_ID,
    it: IRREGULARES_IT, fr: IRREGULARES_FR, de: IRREGULARES_DE, en: IRREGULARES_EN,
  }[lang];
  if (tabela && tabela[palavra]) return tabela[palavra];

  let base = palavra;
  let hadClitico = false;
  if (lang === 'pt' || lang === 'es') {
    const cl = lang === 'pt' ? CLITICOS_PT : CLITICOS_ES;
    [base, hadClitico] = tiraClitico(base, cl);
    // O hífen de composição (`diz-me` → `diz`) não faz parte do lema.
    while (base.endsWith('-')) base = base.slice(0, -1);
  }
  if (base.length <= 2) return hadClitico ? base : palavra;

  // 1) Terminação verbal → candidatos de infinitivo, validados no vocabulário.
  const inf = INF[lang];
  if (inf) {
    const candidatos = [];
    for (const [sufixo, finais] of Object.entries(inf)) {
      if (!base.endsWith(sufixo)) continue;
      const radical = base.slice(0, -sufixo.length);
      if (radical.length < 2) continue;
      for (const fim of finais) candidatos.push(radical + fim);
    }
    // Só aceita candidato que existe como chave no próprio pacote; caso
    // contrário o palpite volta para o fim da cadeia e vira a própria forma.
    for (const c of candidatos) {
      if (!vocab || !vocab.size || vocab.has(c)) return c;
    }
  }

  // 2) Sufixos derivacionais ([os], [as], [ing], [ed]…), com resto conhecido.
  const porPrefixo = prefixoNoVocabulario(base, vocab, lang);
  if (porPrefixo) return porPrefixo;

  // 3) Sobreviver: mantém o que se tinha (clítico removido, se era o caso).
  return hadClitico ? base : palavra;
}

/**
 * Deriva o lema com a estratégia de cada idioma.
 *
 * Este é o ponto único de decisão, e ele é DELIBERADAMENTE conservador: quando
 * a derivação não tem dado nem regra que sustente, devolve a própria forma de
 * superfície. Um lema errado agrupa palavras de famílias diferentes, que é
 * pior do que não agrupar — e é por isso que `report-lemma.mjs` publica a
 * cobertura em vez de deixar o palpite escondido dentro do dado.
 *
 * @param {string} surface
 * @param {string} lang
 * @param {Contexto} [ctx]
 * @returns {string}
 */
export function lemaSeguro(surface, lang, ctx = {}) {
  return lema(surface, lang, ctx);
}
}

/* ------------------------------------------------------------------ */
/* Entrada pública                                                     */
/* ------------------------------------------------------------------ */

/**
 * Lema de uma superfície.
 *
 * @param {string} surface  a chave da entrada
 * @param {string} lang     código do pacote (`pt`, `grc`, `heb`, …)
 * @param {Contexto} [ctx]
 * @returns {string}
 */
export function lema(surface, lang, ctx = {}) {
  if (!surface) return surface;
  if (lang === 'grc') return lemaGrego(surface, ctx.grcIndex);
  if (lang === 'heb') return lemaHebraico(surface);
  if (IDENTIDADE.has(lang)) return surface;
  return lemaRegras(surface, lang, ctx.vocab);
}

/**
 * Contexto de derivação, montado uma vez por pacote.
 *
 * @typedef {{ grcIndex?: Map<string,string>, vocab?: Set<string> }} Contexto
 */

/** A estratégia do idioma, para o relatório de cobertura. */
export function estrategia(lang) {
  if (lang === 'grc') return 'exato (índice de radiais)';
  if (lang === 'heb') return 'exato (forma sem pontos)';
  if (IDENTIDADE.has(lang)) return 'identidade';
  return 'regras de sufixo';
}
