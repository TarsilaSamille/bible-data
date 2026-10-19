/**
 * Forma canônica de uma entrada do dicionário.
 *
 * A CHAVE é sempre a forma de superfície como aparece no texto bíblico
 * (`criou`, `βλαστάνω`, `בְּרֵאשִׁית`). O `root` é o radical/lema que amarra a
 * família. Nenhum consumidor deve precisar conhecer a diferença: o web usa o
 * pacote como está, o mobile lê `def`/`root`/`translit`, e os dois recebem o
 * mesmo arquivo daqui.
 *
 * Campos e quem usa cada um:
 *
 *   root       lema/radical. Web (agrupamento, glossas cruzadas) e mobile
 *              (`extractDictionaryEntry` usa como glosa de último recurso).
 *   en         definição em inglês. Web (coluna de estudo) e mobile (glosa
 *              quando o pacote é de outro idioma).
 *   pt         glosa em português. Idem.
 *   es, id     glosas em espanhol e indonésio, quando existem.
 *   translit   pronúncia romanizada. Mobile (`pickTranslit`) e web.
 *   pinyin     pronúncia do chinês — tem prioridade sobre `translit` no mobile.
 *   pos        classe gramatical (tagset UD).
 *   verses     em que versículos a forma aparece (só em pt/en).
 *   pos_counts distribuição de `pos` no corpus inteiro da palavra.
 *   proper     nome próprio.
 *   variants   grafias alternativas (chinês).
 *   radical    radical kanji (chinês) + `radical_char`, `radical_en`.
 *
 * Regra de ouro deste arquivo: NÃO inventar campo. Se o dado não existe no
 * pacote de origem, o campo não é escrito. Um `en: ""` é pior que a ausência —
 * o mobile trata string vazia como "sem tradução" e cai no tradutor online, e o
 * `glossOf` do dicionário trata vazio como ausente.
 */

/**
 * Campos que valem a pena levar para o pacote do mobile.
 *
 * O mobile mostra definição, radical e pronúncia; `verses` e `pos_counts` são
 * volume morto para ele (ninguém em `bible-app-mobile` os lê) e custam MB no
 * APK quando embutidos. Por isso o build do mobile os descarta — e por isso
 * esta lista existe: ela é a fronteira entre "fonte da verdade" e "o que o
 * mobile precisa".
 */
export const CAMPOS_MOBILE = [
  'root',
  'en',
  'pt',
  'es',
  'id',
  'translit',
  'pinyin',
  'pos',
];

/** Campos que o mobile sabe ler como glosa, em ordem de prioridade. */
const ORDEM_GLOSA = ["pt", "es", "id", "en"];

/**
 * Glosa que o mobile mostra para uma entrada de um pacote de idioma `lang`.
 *
 * A prioridade NÃO é "o próprio idioma primeiro", e isso custou um bug:
 *
 *   entrada: {en: "God", pt: "Deus"}   no pacote `en`
 *   → "o próprio idioma" (en) = "God". Correto.
 *
 *   entrada: {root:"god", en:"God"}     no pacote `pt`
 *   → "o próprio idioma" (pt) = ausente, cai no `en` = "God".
 *     Mas quem lê em português quer "Deus", e o que o mobile mostra é a glosa.
 *
 * A regra real é: **a glosa no idioma de INTERFACE** (pt, o idioma padrão do
 * app) quando existir, senão a definição em inglês. Para o resto dos idiomas é
 * a definição em inglês, que é o que o pacote traz — e `en` é justamente o
 * idioma em que o campo `en` é a definição, não uma tradução.
 *
 * @param {Record<string, any>} entrada
 * @param {string} lang
 * @param {string} [idiomaGlosa]  idioma de interface (padrão: `pt`)
 * @returns {string}
 */
export function glosaDe(entrada, lang, idiomaGlosa = 'pt') {
  // Um pacote de definição (grc, heb, la, ar…) entrega o INFINITIVO/DEFINIÇÃO em
  // inglês: essa é a glosa que faz sentido mostrar, e `pt` aqui seria a
  // tradução de apoio para quem está lendo em português.
  const proprio = entrada[lang];
  const ehPacoteDefinicao = IDIOMAS_DEFINICAO.has(lang);
  if (!ehPacoteDefinicao && typeof proprio === 'string' && proprio.trim()) {
    return proprio.trim();
  }
  if (typeof entrada.en === 'string' && entrada.en.trim()) return entrada.en.trim();
  const glosa = entrada[idiomaGlosa];
  if (typeof glosa === 'string' && glosa.trim()) return glosa.trim();
  for (const campo of ORDEM_GLOSA) {
    const v = entrada[campo];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * Entrada no formato do pacote mobile (`def` = glosa a mostrar).
 *
 * @param {Record<string, any>} entrada
 * @param {string} lang
 * @returns {Record<string, any>}
 */
export function entradaMobile(entrada, lang) {
  const glosa = glosaDe(entrada, lang);
  const saida = { root: entrada.root ?? '', def: glosa, translit: entrada.translit ?? '' };
  // `pinyin` só existe no chinês e tem prioridade sobre `translit` no mobile.
  if (entrada.pinyin) saida.pinyin = entrada.pinyin;
  for (const campo of ['pt', 'es', 'id']) {
    if (entrada[campo]) saida[campo] = entrada[campo];
  }
  return saida;
}

/**
 * Entrada canônica, com os campos normalizados e sem vazios.
 *
 * @param {string} surface
 * @param {Record<string, any>} bruta
 * @returns {Record<string, any>}
 */
export function normalizaEntrada(surface, bruta) {
  const e = { root: typeof bruta.root === 'string' ? bruta.root : surface };
  for (const campo of ['en', 'pt', 'es', 'id', 'translit', 'pinyin', 'pos']) {
    const v = bruta[campo];
    if (typeof v === 'string' && v.trim() && v !== e.root) e[campo] = v;
    else if (typeof v === 'string' && v.trim() && campo === 'root') e[campo] = v;
  }
  if (bruta.proper === true) e.proper = true;
  if (Array.isArray(bruta.verses) && bruta.verses.length) e.verses = bruta.verses;
  if (bruta.pos_counts && typeof bruta.pos_counts === 'object') {
    const chaves = Object.keys(bruta.pos_counts);
    if (chaves.length > 1) e.pos_counts = bruta.pos_counts;
  }
  for (const campo of ['variants', 'radical_char', 'radical_en', 'radical', 'gn', 'refs']) {
    const v = bruta[campo];
    if (v !== undefined && v !== null && v !== '') e[campo] = v;
  }
  // Sem `en` nem glosa nenhuma, a entrada não diz nada: o chamador decide.
  return e;
}

/** Um valor é "usável" como glosa: texto que não seja só pontuação. */
export function glosaUtil(valor) {
  return typeof valor === 'string' && /[\p{L}\p{N}]/u.test(valor);
}

/**
 * Pacotes em que o campo de glosa NÃO é a tradução do termo, e sim a definição
 * dele (o infinitivo ou o sentido), em inglês.
 *
 * Neles a chave é uma palavra estrangeira e o que faz sentido mostrar é o que
 * ela significa — `λόγος` em GJn 1:1 é "palavra", não "verbo grego". São
 * também os pacotes que não têm glosa no próprio idioma: escrevê-la seria a
 * tradução de uma palavra por ela mesma.
 *
 * `gn` NÃO está aqui, apesar de ser uma língua: o dicionário guarani traz a
 * glosa no próprio idioma (o texto bíblico está em guarani, e o dicionário é
 * da palavra ao sentido, não da tradução), que é o que o leitor precisa. Foi a
 * classificação errada de `gn` que zerava a verificação inteira do pacote.
 */
export const IDIOMAS_DEFINICAO = new Set(['ar', 'en', 'de', 'fr', 'it', 'ja', 'ko', 'ru', 'zh', 'la']);
