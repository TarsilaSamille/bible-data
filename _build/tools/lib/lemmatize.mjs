/**
 * Derivação de lema por idioma.
 *
 * O `root` de uma entrada é a CHAVE de superfície (`criou`, `disse`, `and`).
 * O que o app mostra e agrupa é o LEMA (`criar`, `dizer`, `be`): é o que
 * permite tocar numa forma conjugada e ver a família inteira.
 *
 * TRÊS CLASSES DE IDIOMA, porque a linguística não é uniforme:
 *
 *   1. EXATO — o lema está nos dados. Grego: o índice de radiais
 *      (`grc-index.json`) mapeia forma → lema, e é dado, não palpite.
 *      Hebraico: a forma sem pontos É o lema, por convenção.
 *   2. IDENTIDADE — o idioma não flexiona o que está na chave (`zh`, `ja`,
 *      `ko`) ou a citação já é o lema (`la`: `dixit`, `terra`, `autem`).
 *   3. REGRAS + DADO — línguas modernas com sufixos (`en`, `pt`, `es`, `id`,
 *      `it`, `fr`, `de`). Aqui há heurística e ela erra; por isso `pos` (quando
 *      existe) e o vocabulário do pacote são usados como PORTÕES, e
 *      `report-lemma.mjs` mede tudo contra o padrão de ouro.
 *
 * REGRA DE OURO: quando a derivação não tem dado nem regra que sustente, devolve
 * a própria chave. Um lema errado agrupa palavras de famílias diferentes — pior
 * do que não agrupar — e aparece na palavra mais comum da Bíblia.
 */

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/**
 * Remove toda marca hebraica, preservando o maqaf (U+05BE).
 *
 * Usa `\p{M}` (marcas combinatórias) em vez de faixas de caracteres literais.
 * Faixa literal em bloco hebraico é traiçoeiro e custou dois bugs: escrever
 * `[ְ-ׇ]` parece cobrir só pontuação, mas o intervalo U+05D0–U+05EA — onde
 * estão as LETRAS — também entrava, e o lema virava um pontinho
 * (`בְּרֵאשִׁ֖ית` → `֖`). E as faixas之间 deixavam buraco: U+0596 (tipo de
 * *canting*) sobrevivia e o lema saía `בראש֖ית`.
 *
 * O maqaf é a única pontuação hebraica que NÃO é marca combinatória — é
 * separador de composto —, e por isso sobrevive a `\p{M}`. É o comportamento
 * desejado: `אֶת־יִצְחָק` precisa continuar composto para o dicionário abrir os
 * dois segmentos.
 */
const HEB_PONTOS = /\p{M}|\u0591-\u05BD|\u05BF-\u05C2|\u05C4-\u05C7/gu;

const stripPoints = (s) => s.replace(HEB_PONTOS, '');

/** Grego: sem acento e em minúsculas, para casar com `grc-index.json`. */
const stripGreek = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/* ------------------------------------------------------------------ */
/* 1. Grego — lema exato via índice de radiais                          */
/* ------------------------------------------------------------------ */

/**
 * Lema grego via índice de radiais.
 *
 * O índice é chaveado pela forma NORMALIZADA (sem acento, minúscula), que é o
 * que `stripGreek` produz — mas o VALOR também pode vir normalizado, e usá-lo
 * como lema cortava a sílaba final: `αὐξάνω` virava `αὐξάν`. A verificação é
 * o que separa os dois casos: um lema real é mais longo ou igual à forma
 * normalizada, nunca mais curto por perda de letra.
 *
 * @param {string} surface
 * @param {Map<string,string>} indice  forma sem acento → lema
 * @returns {string}
 */
export function lemaGrego(surface, indice) {
  if (!indice) return surface;
  const bruto = indice.get(stripGreek(surface));
  if (typeof bruto !== 'string' || !bruto) return surface;
  // O valor normalizado (perdemos o acento) ainda é melhor que a forma de
  // superfície, desde que não seja um prefixo — corte de sílaba é pior que
  // não agrupar.
  if (bruto.length < stripGreek(surface).length) return surface;
  return bruto;
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
/* 4. Línguas modernas                                                  */
/* ------------------------------------------------------------------ */

/**
 * Verbos irregulares: a forma mais comum no texto → o infinitivo. Só entra o
 * que nenhuma regra de sufixo alcança. `ser`/`estar`/`ir` aparecem várias
 * vezes porque as formas são ambíguas entre si (`vai` é de ir, `vou` de ir).
 */
export const IRREGULARES = {
  pt: {
    // SER. `fui` e `fomos` estão aqui como `ser`, e não como `ir`: no texto
    // bíblico "e foi" é quase sempre ser, não ir. Uma versão anterior deste
    // mapa tinha `fui: 'ser'` na linha 9 e `fui: 'ir'` na linha 25 — objeto JS
    // resolve duplicata silenciosamente, e a segunda vencia, então o lema de
    // `fui` era `ir`. Nenhum teste pegou, porque o padrão de ouro não cobria.
    sou: 'ser', és: 'ser', é: 'ser', era: 'ser', eram: 'ser',
    fui: 'ser', fomos: 'ser', fora: 'ser', foram: 'ser', serei: 'ser',
    sejamos: 'ser', são: 'ser', sejais: 'ser', serei: 'ser',
    está: 'estar', estou: 'estar', estamos: 'estar', estão: 'estar',
    estava: 'estar', estavam: 'estar', estejam: 'estar', estejamos: 'estar',
    // IR.
    vou: 'ir', vai: 'ir', íamos: 'ir', iam: 'ir', vá: 'ir', ide: 'ir',
    fosse: 'ir', fossem: 'ir', foste: 'ir', fostes: 'ir', foi: 'ir',
    foram: 'ir', íamos: 'ir',
    // HAVER.
    hei: 'haver', há: 'haver', havia: 'haver', houvesse: 'haver',
    houvessem: 'haver', houver: 'haver', houvera: 'haver',
    // FAZER, DIGER, PODER.
    faço: 'fazer', faz: 'fazer', fez: 'fazer', fazem: 'fazer', far: 'fazer',
    farás: 'fazer', fez: 'fazer', façamos: 'fazer',
    digo: 'dizer', diz: 'dizer', disse: 'dizer', dizem: 'dizer',
    dizer: 'dizer', direi: 'dizer', diria: 'dizer',
    posso: 'poder', pode: 'poder', podem: 'poder', podia: 'poder',
    puderam: 'poder', pôde: 'poder', puder: 'poder', pudera: 'poder',
    pudessem: 'poder', pudesses: 'poder', pudestes: 'poder', pôde: 'poder',
    // VER, DAR, SABER, QUERER.
    vi: 'ver', vejo: 'ver', viu: 'ver', vê: 'ver', vemos: 'ver',
    viu: 'ver', virem: 'ver', viu: 'ver',
    dou: 'dar', dá: 'dar', deu: 'dar', dão: 'dar', dareis: 'dar',
    dava: 'dar', deram: 'dar', dariam: 'dar',
    sei: 'saber', sabe: 'saber', sabem: 'saber', soube: 'saber',
    saibam: 'saber', saiba: 'saber', sei: 'saber',
    quero: 'querer', quer: 'querer', querem: 'querer', quis: 'querer',
    queira: 'querer', queiram: 'querer', quer: 'querer',
    // TER, PÔR, VIR.
    tenho: 'ter', tem: 'ter', têm: 'ter', tinha: 'ter', teve: 'ter',
    tinham: 'ter', tive: 'ter', tenhamos: 'ter', tenham: 'ter', teu: 'ter',
    ponho: 'pôr', pôs: 'pôr', puseram: 'pôr', ponde: 'pôr', põe: 'pôr',
    puseram: 'pôr',
    vem: 'vir', vens: 'vir', veio: 'vir', vieram: 'vir', vinde: 'vir',
    viemos: 'vir', venha: 'vir', vi: 'vir',
    // OUVIR, PERDER, VIVER, DEIXAR, LER.
    ouvi: 'ouvir', ouve: 'ouvir', ouviu: 'ouvir', ouviram: 'ouvir',
    perdi: 'perder', perde: 'perder', perdeu: 'perder', perderam: 'perder',
    vivi: 'viver', vive: 'viver', viveu: 'viver', viveram: 'viver',
    deixei: 'deixar', deixa: 'deixar', deixou: 'deixar', deixaram: 'deixar',
    li: 'ler', lê: 'ler', leu: 'ler', lemos: 'ler', leram: 'ler',
    // CAIR, ABRIR, CORRER, DORMIR, NASCER, MORRER.
    caí: 'cair', cai: 'cair', caiu: 'cair', caem: 'cair', caíram: 'cair',
    abriste: 'abrir', abriu: 'abrir', abriram: 'abrir', abrirei: 'abrir',
    correu: 'correr', corremos: 'correr', corre: 'correr', correram: 'correr',
    dormiu: 'dormir', dorme: 'dormir', dormiram: 'dormir',
    nasceu: 'nascer', nascem: 'nascer', nasceram: 'nascer',
    morreu: 'morrer', morrem: 'morrer', morreram: 'morrer',
    // TRANSACIONAL E DE RESPOSTA: ALTAMENTE FREQUENTES NO TEXTO BÍBLICO.
    comprou: 'comprar', compra: 'comprar', compraram: 'comprar',
    compraram: 'comprar', comprasse: 'comprar', comprou: 'comprar',
    vendeu: 'vender', vende: 'vender', venderam: 'vender',
    pediu: 'pedir', pede: 'pedir', pediram: 'pedir', pedi: 'pedir',
    respondeu: 'responder', responde: 'responder', responderam: 'responder',
    respondeu: 'responder',
    adormeceu: 'adormecer',
    reconheceu: 'reconhecer', reconhece: 'reconhecer', reconheceram: 'reconhecer',
  },
  es: {
    soy: 'ser', eres: 'ser', es: 'ser', era: 'ser', fue: 'ser', fueron: 'ser',
    estoy: 'estar', está: 'estar', están: 'estar', estaba: 'estar', estaban: 'estar',
    voy: 'ir', va: 'ir', vas: 'ir', íbamos: 'ir', iban: 'ir', vaya: 'ir',
    he: 'haber', hay: 'haber', ha: 'haber', han: 'haber', había: 'haber', habían: 'haber',
    hago: 'hacer', hace: 'hacer', hizo: 'hacer', hacen: 'hacer', hacía: 'hacer',
    digo: 'decir', dice: 'decir', dijo: 'decir', dicen: 'decir', decía: 'decir',
    puedo: 'poder', puede: 'poder', pueden: 'poder', podía: 'poder', podían: 'poder',
    veo: 'ver', ve: 'ver', vio: 'ver', ven: 'ver', veía: 'ver',
    doy: 'dar', da: 'dar', dio: 'dar', dan: 'dar', daba: 'dar',
    sé: 'saber', sabe: 'saber', saben: 'saber', sabía: 'saber',
    quiero: 'querer', quiere: 'querer', quieren: 'querer', quiso: 'querer', quería: 'querer',
    tengo: 'tener', tiene: 'tener', tienen: 'tener', tenía: 'tener', tuvo: 'tener',
    puse: 'poner', pone: 'poner', puso: 'poner', ponen: 'poner',
    oí: 'oír', oye: 'oír', oyó: 'oír', oyen: 'oír',
    perdí: 'perder', pierde: 'perder', perdió: 'perder', pierden: 'perder',
    viví: 'vivir', vive: 'vivir', vivió: 'vivir', viven: 'vivir',
    leí: 'leer', lee: 'leer', leyó: 'leer', leen: 'leer',
    vine: 'venir', viene: 'venir', vino: 'venir', vienen: 'venir',
  },
  en: {
    am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
    have: 'have', has: 'have', had: 'have', having: 'have',
    do: 'do', does: 'do', did: 'do', done: 'do', doing: 'do',
    went: 'go', gone: 'go', going: 'go',
    said: 'say', saying: 'say',
    made: 'make', making: 'make',
    gave: 'give', given: 'give', giving: 'give',
    took: 'take', taken: 'take', taking: 'take',
    came: 'come', coming: 'come',
    saw: 'see', seen: 'see', seeing: 'see',
    knew: 'know', known: 'know', knowing: 'know',
    got: 'get', gotten: 'get', getting: 'get',
    told: 'tell', thought: 'think', brought: 'bring', found: 'find',
    stood: 'stand', heard: 'hear', let: 'let', meant: 'mean',
    felt: 'feel', kept: 'keep', began: 'begin', seemed: 'seem',
    left: 'leave', called: 'call', asked: 'ask', turned: 'turn',
    became: 'become', wanted: 'want', showed: 'show',
    ran: 'run', looked: 'look', used: 'use', wanted: 'want',
  },
  id: {
    aku: 'ada', adalah: 'ada', adanya: 'ada',
    menjadi: 'jadi', jadilah: 'jadi', jadikan: 'jadi',
    memiliki: 'punya', punya: 'punya',
    mendapat: 'dapat', dapat: 'dapat', diperoleh: 'dapat',
    memberikan: 'beri', memberi: 'beri', diberikan: 'beri',
    mengambil: 'ambil', ambil: 'ambil', diambil: 'ambil',
  },
  it: {
    sono: 'essere', sei: 'essere', era: 'essere', stati: 'essere',
    vado: 'andare', va: 'andare', andiamo: 'andare',
    ho: 'avere', ha: 'avere', hai: 'avere', hanno: 'avere', aveva: 'avere',
    faccio: 'fare', fa: 'fare', fai: 'fare', fanno: 'fare',
    dico: 'dire', dice: 'dire', disse: 'dire', dicono: 'dire',
    posso: 'potere', può: 'potere', possono: 'potere',
    vedo: 'vedere', vede: 'vedere', vide: 'vedere', vedono: 'vedere',
    do: 'dare', diede: 'dare', danno: 'dare',
    so: 'sapere', sa: 'sapere', sanno: 'sapere',
    voglio: 'volere', vuole: 'volere',
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
  },
  de: {
    bin: 'sein', bist: 'sein', ist: 'sein', sind: 'sein', war: 'sein',
    habe: 'haben', hast: 'haben', hat: 'haben', haben: 'haben', hatte: 'haben',
    werde: 'werden', wird: 'werden', werden: 'werden',
    mache: 'machen', macht: 'machen', machen: 'machen',
    sage: 'sagen', sagt: 'sagen', sagen: 'sagen',
  },
};

/**
 * Pronomes enclíticos do português e do espanhol.
 *
 * O texto bíblico translators usa muito (`diz-me`, `disse-lhes`, `dávam-lhe`).
 * Sem tirar o clítico antes das regras de sufixo, a forma sai errada quase
 * sempre — `disse-lhes` viraria `disse-l`.
 */
/**
 * `to` e `o` NÃO são clíticos: aparecem como terminação verbal (`falo`,
 * `manifesto`) e tratá-los como pronome cortava `manifesto` em `manifes`,
 * que não é palavra nenhuma em português. `mo`/`to` pronominais exigem
 * `dar-te`/`vô-lo`, com hífen, e o hífen é tratado à parte.
 */
const CLITICOS_PT = ['me', 'te', 'se', 'lhe', 'lhes', 'nos', 'vos', 'mo'];
const CLITICOS_ES = ['me', 'te', 'se', 'le', 'les', 'nos', 'os', 'as', 'lo', 'la'];

/** Remove um clítico final (PT/ES). Devolve [base, tinhaClitico]. */
/**
 * Remove um clítico final (PT/ES).
 *
 * A remoção SÓ vale se o que sobra é palavra de verdade: um substantivo
 * terminado em `-te`/`-mo`/`-se` produz um radical que não existe
 * (`noite` → `noi`, `abismo` → `abis`, `vinte` → `vin`). Por isso o corte é
 * validado contra o vocabulário do pacote: `disseram-les` sobrevive porque
 * `disseram` é chave do dicionário, e `noite` não sobrevive porque `noi` não é.
 *
 * @returns {[string, boolean]} a base (ou a palavra intacta) e se havia clítico
 */
function tiraClitico(palavra, cliticos, vocab) {
  for (const c of cliticos) {
    if (palavra.length <= c.length + 2) continue;
    if (!palavra.endsWith(c)) continue;
    const base = palavra.slice(0, -c.length);
    if (base.length < 2) continue;
    // Sem vocabulário não há como validar o corte, e o corte sem validação é o
    // que corrompeu 3 mil raízes. Nesses casos a palavra fica intacta.
    if (!vocab || !vocab.size || vocab.has(base)) return [base, true];
  }
  return [palavra, false];
}

/**
 * Sufixos derivacionais: plural, gerúndio, particípio, etc.
 *
 * Diferente dos verbais (que precisam voltar ao infinitivo), estes são só
 * removidos. A lista é por idioma e a aplicação é iterativa com limite.
 */
export const SUFIXOS = {
  // Sem repetição: elemento duplicado em array não muda o resultado (o `break`
  // sai no primeiro), mas esconde revisão. `check-tabelas.mjs` reprova.
  pt: [
    'aram', 'eram', 'iram', 'ados', 'adas', 'idos', 'idas',
    'ando', 'endo', 'indo',
    'aria', 'eria', 'iria',
    'asse', 'esse', 'isse',
  ],
  es: ['aron', 'ieron', 'ando', 'iendo', 'ado', 'ida', 'ados', 'idas', 'aba', 'ía', 'ian', 'eron'],
  it: ['ando', 'endo', 'ato', 'ito', 'ata', 'ita', 'ano', 'ono'],
  fr: ['ant', 'ent', 'ons', 'ais', 'ait', 'aient'],
  de: ['est', 'et', 'en', 'er', 'em'],
  en: ['ing', 'ings', 'ed', 'es', 's', 'ies', 'ied', 'ier', 'iest', 'iness', 'edly'],
  id: ['nya', 'kan', 'lah', 'kah', 'pun'],
};

/**
 * Terminação de forma conjugada → finais de infinitivo CANDIDATOS.
 *
 * A tabela de sufixos sozinha erra o fundamental: `criou` termina em `ou`, e
 * apagar `ou` deixa `cri`, que não é palavra em português. O verbo tem que
 * voltar ao infinitivo (`criar`) — mas o terminal do infinitivo não é dedutível
 * do sufixo, porque `falo` é `falar` e `come` é `comer`. Por isso a terminação
 * vira CANDIDATOS, e a escolha é feita contra o vocabulário do pacote.
 *
 * Um array pode ter mais de um final para o mesmo sufixo (PT `a` pode dar `ar`
 * ou `er`); a ordem dos candidatos importa quando o vocabulário não decide.
 */
export const INF = {
  pt: {
    // Gerúndio: `destruindo` -> `destruir`. O `-ndo` vira o final do
    // infinitivo, e `indo` é o caso de `destruindo` (radical `destru` + `indo`),
    // coberto pelo corte em `indo`.
    arando: ['ar'], erando: ['er'], irando: ['ir'],
    ando: ['ar'], endo: ['er'], indo: ['ir'],
    // Imperfecto do indicativo e do subjuntivo: `entrava`, `havia`, `amasse`.
    // O `-ia` do português é duplo (imperfeito de `ar` e de `er`), então o
    // candidato lista os dois finais e a escolha vai contra o vocabulário.
    ava: ['ar'], ía: ['ar'], ievam: ['ar'], avam: ['ar'],
    íamos: ['ar', 'er', 'ir'],
    asse: ['ar'], esses: ['ar'], íssemos: ['er'], issem: ['er'],
    // Pretérito perfeito: `entraram`, `conheceram`, `serviram`.
    aram: ['ar'], eram: ['er'], iram: ['ir'],
    // Pretérito mais-que-perfeito: `fizera`, `tivera`.
    ara: ['ar'], era: ['er'], ira: ['ir'],
    // Plural do particípio: `acabados`, `criados`.
    ados: ['ar'], idos: ['er', 'ir'], adas: ['ar'], idas: ['er', 'ir'],
    // Particípio em -ado de verbo em -er e -ir (`notado`, `partido`) é
    // indistinguível de particípio em -ar; a lista cobre os três.
    // Futuro do indicativo e do subjuntivo: `guardarei`, `estabelecei`.
    // O futuro é o sufixo mais improdutivo do português — `arei` tanto pode
    // dar `ar` (`guardar`) quanto `er` (`comer`) —, então vira candidato e a
    // escolha vai contra o vocabulário.
    arei: ['ar', 'er', 'ir'], errei: ['er', 'ir'], irei: ['ir'],
    arás: ['ar'], erás: ['er'], irás: ['ir'],
    ará: ['ar'], erá: ['er'], irá: ['ir'],
    arão: ['ar'], erão: ['er'], irão: ['ir'],
    // Formas solver: 1ª e 3ª pessoa do presente, e o subjuntivo.
    // `-o` NÃO entra: `manifesto` -> `manifest` + `ar` = `manifestar`, que é
    // verbete real de dicionário e por isso passaria na validação por
    // vocabulário. A 1ª pessoa do singular (`falo`, `parto`) se perde em troca
    // de não converter substantivo em verbo — que é o erro que aparece na
    // tela.
    ou: ['ar'], eu: ['er'], iu: ['ir'],
    // `-a` e `-o` NÃO entram: `manifesto` -> `manifest` + `ar` = `manifestar`,
    // que é verbete real de dicionário e por isso passa na validação por
    // vocabulário. As formas em `-a`/`-o` do português (1ª e 3ª pessoa) se
    // perdem em troca de não converter substantivo em verbo — o `-a` de
    // `vazia`, `terra` e `palavra` é o caso que mais aparece na tela.
    e: ['er'], i: ['ir'],
    em: ['ar'], am: ['ar'], ia: ['ar'], ie: ['ar'],
    // Subjuntivo: `sejam` (ser), `contemple`, `busquem`, `amem`.
    ejam: ['er'], eis: ['er'],
    arem: ['ar'], erem: ['er'], irem: ['ir'],
  },
  es: { aron: ['ar'], ieron: ['er', 'ir'], ando: ['ar'], iendo: ['er', 'ir'], o: ['ar'], a: ['ar'], e: ['er'], i: ['ir'] },
  it: { o: ['are'], a: ['are'], e: ['ere'], i: ['ire'] },
  fr: { e: ['er'], a: ['er'], i: ['ir'] },
  de: { e: ['en'], t: ['en'] },
  en: { ed: [''], ing: [''], es: [''], s: [''] },
  id: { kan: ['kan'], i: ['i'] },
};

/** Valores de `pos` que são verbo — só verbos passam pelas regras verbais. */
const POS_VERBO = new Set(['VERB', 'VERBAL', 'AUX']);

/**
 * Escolhe o primeiro candidato que existe no vocabulário do pacote.
 *
 * Este passo é o que valida a heurística: o dicionário é indexado por forma de
 * superfície, então o infinitivo também é chave em algum livro. `criar` existe
 * no corpusa; `cri` não existe em lugar nenhum.
 */
function escolheCandidato(candidatos, vocab) {
  if (!candidatos.length) return null;
  if (vocab && vocab.size) {
    for (const c of candidatos) if (vocab.has(c)) return c;
  }
  return null;
}

/**
 * Prefixo mais longo que também é chave do dicionário, com o resto na lista de
 * restos de flexão.
 *
 * O critério do RESTO é o que separa um corte legítimo de um corte por
 * coincidência: `animais → animal` tem resto `is` (plural conhecido), mas
 * `terra → ter` tem resto `ra`, que não é flexão nenhuma. A versão anterior
 * aceitava qualquer resto e produzia `earth → ear`.
 */
export const RESTOS = {
  // Português: só plural e particípio. `'em'`, `'ou'`, `'eu'` e `'iu'` SAÍRAM:
  // são terminações verbais ambíguas que o backoff não pode resolver, e
  // produziam `marido → mar` (resto `ido`, que é particípio mas também
  // terminações de `morar`/`mor`), `comeste → com` (resto `este`, que casa
  // com pronome) e `morada → mor` (resto `ada`, que é particípio mas
  // também substantivo). O que sobra é o plural, que é o caso comum e
  // inequívoco; o particípio fica para o caminho verbal, que tem portão de
  // `pos`.
  pt: ['s', 'es', 'is', 'as', 'ns', 'ão', 'ões', 'ais', 'éis'],
  es: ['s', 'es', 'as', 'os', 'n', 'ado', 'ida', 'idos', 'adas'],
  it: ['i', 'e', 'he', 'hi', 'ti', 'si', 'no', 'ne'],
  fr: ['s', 'x', 'ent', 'ant', 'é', 'ée', 'és', 'ons'],
  de: ['n', 'en', 'er', 't', 'es'],
  en: ['s', 'es', 'ing', 'ed', 'd', 'er', 'est', 'y', 'ies'],
  id: ['kan', 'nya', 'pun', 'lah', 'kah'],
};

/**
 * Menor resto de flexão aceito por idioma.
 *
 * inglês e alemão flexionam por sufixo curto (`created`, `ginge`), português e
 * espanhol por terminação — e cortar uma letra só em português produz
 * `manifes`.
 */
const RESTO_MINIMO = { en: 1, de: 1, pt: 2, es: 2, it: 2, fr: 2, id: 2 };

function prefixoNoVocabulario(palavra, vocab, lang) {
  if (!vocab || !vocab.size) return null;
  const permitidos = new Set(RESTOS[lang] ?? []);
  if (!permitidos.size) return null;
  for (let corte = palavra.length - 1; corte >= 3; corte--) {
    const resto = palavra.slice(corte);
    if (!permitidos.has(resto)) continue;
    const minimo = RESTO_MINIMO[lang] ?? 2;
    if (resto.length < minimo) continue;
    const prefixo = palavra.slice(0, corte);
    if (vocab.has(prefixo)) return prefixo;
  }
  return null;
}

/**
 * @param {string} palavra
 * @param {string} lang
 * @param {Set<string>} vocab
 * @param {string|null} pos  classe gramatical, quando o pacote tem
 * @returns {string}
 */
function lemaRegras(palavra, lang, vocab, pos) {
  if (!palavra) return palavra;
  if (palavra.length <= 2) return palavra; // partícula, preposição, abreviação
  if (IRREDUTIVEIS.has(palavra)) return palavra;

  // Irregular primeiro: `disse`, `fez`, `viu` são as formas mais frequentes do
  // texto bíblico e nenhuma regra de sufixo as alcança.
  const tabela = IRREGULARES[lang];
  if (tabela && tabela[palavra]) return tabela[palavra];

  let base = palavra;
  let hadClitico = false;
  // PORTÃO DE POS primeiro: clítico só faz sentido em verbo. `corte` é
  // substantivo e termina em `-te`, mas cortar o `te` daria `cor` — que É
  // palavra do dicionário, então a validação por vocabulário sozinha não
  // segura. O portão de `pos` é o que segura.
  const eVerbo = !pos || POS_VERBO.has(pos);
  if (eVerbo && (lang === 'pt' || lang === 'es')) {
    [base, hadClitico] = tiraClitico(base, lang === 'pt' ? CLITICOS_PT : CLITICOS_ES, vocab);
    while (base.endsWith('-')) base = base.slice(0, -1);
  }
  if (base.length <= 2) return hadClitico ? base : palavra;

  // 1) Terminação verbal → infinitivo, validado no vocabulário.
  if (eVerbo) {
    const inf = INF[lang];
    const candidatos = [];
    for (const [sufixo, finais] of Object.entries(inf)) {
      if (!base.endsWith(sufixo)) continue;
      const radical = base.slice(0, -sufixo.length);
      if (radical.length < 2) continue;
      for (const fim of finais) candidatos.push(radical + fim);
    }
    const escolhido = escolheCandidato(candidatos, vocab);
    if (escolhido) return escolhido;
  }

  // 2) Sufixos derivacionais, com resto conhecido.
  //
  // Só para verbo: os sufixos desta lista são quase todos verbais (`ando`,
  // `ados`, `aram`) e aplicá-los a substantivo produz radical falso —
  // `corte` menos `te` é `cor`, que é palavra, então a validação por
  // vocabulário não segura.
  if (!eVerbo) {
    // Substantivo, adjetivo e nome próprio seguem só o backoff por plural,
    // que valida o resto contra a lista de flexões.
    const porPrefixo = prefixoNoVocabulario(base, vocab, lang);
    return porPrefixo ?? (hadClitico ? base : palavra);
  }

  const sufixos = SUFIXOS[lang] ?? [];
  let atual = base;
  for (let passo = 0; passo < 2; passo++) {
    let mudou = false;
    for (const s of sufixos) {
      if (atual.length - s.length >= 3 && atual.endsWith(s)) {
        const proximo = atual.slice(0, -s.length);
        if (proximo.length >= 3 && (!vocab || !vocab.size || vocab.has(proximo))) {
          atual = proximo;
          mudou = true;
          break;
        }
      }
    }
    if (!mudou) break;
  }
  if (atual !== base && atual.length >= 3 && (!vocab || !vocab.size || vocab.has(atual))) {
    return atual;
  }

  // 3) Backoff por prefixo no vocabulário (plurais, etc.).
  const porPrefixo = prefixoNoVocabulario(base, vocab, lang);
  if (porPrefixo) return porPrefixo;

  // 4) Sobreviver: mantém o que se tinha (clítico removido, se era o caso).
  return hadClitico ? base : palavra;
}

/** Palavras que são a própria forma: partícula, preposição, nome próprio. */
const IRREDUTIVEIS = new Set([
  // PT
  'de', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'e', 'ou', 'mas', 'que',
  'não', 'sim', 'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'me', 'te', 'se', 'lhe',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sobre', 'sob',
  'entre', 'até', 'desde', 'depois', 'antes', 'quando', 'onde', 'como',
  'isto', 'isso', 'aquilo', 'este', 'esse', 'aquele', 'esta', 'essa', 'aquela',
  'meu', 'minha', 'teu', 'tua', 'seu', 'sua', 'nosso', 'nossa', 'vosso', 'vossa',
  'dele', 'dela', 'deles', 'delas', 'deus', 'jesus', 'havia',
  // EN
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'with', 'at',
  'by', 'from', 'as', 'is', 'was', 'it', 'he', 'she', 'they', 'them', 'this',
  'that', 'these', 'those', 'who', 'what', 'when', 'where', 'why', 'how',
  'all', 'every', 'each', 'both', 'not', 'no', 'yes', 'so', 'than', 'then',
  'his', 'her', 'their', 'its', 'our', 'your', 'my', 'me', 'him', 'us',
  'god', 'lord', 'jesus', 'christ',
  // ES
  'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'no', 'sí',
  'yo', 'tú', 'él', 'ella', 'me', 'te', 'se', 'le', 'en', 'del', 'al', 'por',
  'para', 'con', 'sin', 'sobre', 'entre', 'su', 'sus', 'mi', 'tu', 'es', 'son',
]);

/* ------------------------------------------------------------------ */
/* Entrada pública                                                     */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{ grcIndex?: Map<string,string>, vocab?: Set<string>, pos?: string|null }} Contexto
 */

/**
 * Lema de uma superfície.
 *
 * @param {string} surface
 * @param {string} lang
 * @param {Contexto} [ctx]
 * @returns {string}
 */
export function lema(surface, lang, ctx = {}) {
  if (!surface) return surface;
  if (lang === 'grc') return lemaGrego(surface, ctx.grcIndex);
  if (lang === 'heb') return lemaHebraico(surface);
  if (IDENTIDADE.has(lang)) return surface;
  return lemaRegras(surface, lang, ctx.vocab, ctx.pos ?? null);
}

/** A estratégia do idioma, para o relatório de cobertura. */
export function estrategia(lang) {
  if (lang === 'grc') return 'exato (índice de radiais)';
  if (lang === 'heb') return 'exato (forma sem pontos)';
  if (IDENTIDADE.has(lang)) return 'identidade';
  return 'regras de sufixo + portão de pos';
}
