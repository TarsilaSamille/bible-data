#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
curate-en-es.py
Curadoria sistemática dos dicionários de Espanhol (dict/es/) e Inglês (dict/en/).
Corrige:
1. Verbos no passado/imperfeito que estavam no infinitivo em ES e EN.
2. Falsos cognatos grotescos (ex: lampiño -> lampião; oso -> dar à luz; sacado -> desenhar; derrama -> fora; banco -> bench; caos -> Cao).
3. Polissemia arcaica da KJV (ex: bear -> urso misturado com dar à luz; train -> trem; spring -> primavera; corn -> milho; locks -> fechaduras; carriage -> carruagem; prevent -> impedir).
4. Limpeza de campos poluídos e vazamentos.
"""

import glob
import json
import os
import re

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Livros onde ocorrem ursos como animal (1 Sm 17, 2 Sm 17, 2 Rs 2, Pv 17, 28, Is 11, 59, Lm 3, Os 13, Am 5, Ap 13)
BEAR_ANIMAL_BOOKS = {'9', '10', '12', '20', '23', '25', '28', '30', '66'}

# Livros onde banks se refere a margem de rio (Gn, Js, 2 Rs, Ez, Dn)
RIVER_BANK_BOOKS = {'1', '6', '12', '26', '27'}

def curate_spanish_dictionary():
    print("=== Curating Spanish Dictionary (dict/es/) ===")
    es_files = sorted(glob.glob(os.path.join(BASE_DIR, "dict", "es", "[0-9]*.json")),
                      key=lambda x: int(os.path.basename(x).split('.')[0]))
    
    # 1. Mapa fixo de correções léxicas e falsos cognatos em Espanhol
    ES_LEXICAL_FIXES = {
        "lampiño": {
            "pt": "imberbe / sem pelos",
            "en": "hairless / smooth-skinned",
            "id": "licin / tidak berbulu"
        },
        "oso": {
            "pt": "urso",
            "en": "bear",
            "id": "beruang"
        },
        "osas": {
            "pt": "ursas",
            "en": "she-bears / female bears",
            "id": "beruang betina"
        },
        "arco": {
            "pt": "arco",
            "en": "bow",
            "id": "busur"
        },
        "sacado": {
            "pt": "tirado / extraído",
            "en": "drawn out / taken out",
            "id": "dikeluarkan"
        },
        "sacar": {
            "pt": "tirar / extrair",
            "en": "to draw out / to take out",
            "id": "mengeluarkan"
        },
        "derrama": {
            "pt": "derrama",
            "en": "pours out",
            "id": "mencurahkan"
        },
        "derramar": {
            "pt": "derramar",
            "en": "to pour out",
            "id": "mencurahkan"
        },
        "banco": {
            "pt": "banco / mesa de câmbio",
            "en": "bank / money-table",
            "id": "bank"
        },
        "caos": {
            "pt": "caos",
            "en": "chaos",
            "id": "kekacauan"
        },
        "arriba": {
            "pt": "acima / para cima",
            "en": "above / upward",
            "id": "ke atas"
        },
        "abajo": {
            "pt": "abaixo / para baixo",
            "en": "below / downward",
            "id": "ke bawah"
        },
        "luz": {
            "pt": "luz",
            "en": "light",
            "id": "terang"
        },
        "tienda": {
            "pt": "tenda / tabernáculo",
            "en": "tent / tabernacle",
            "id": "kemah"
        },
        "tiendas": {
            "pt": "tendas / tabernáculos",
            "en": "tents",
            "id": "kemah-kemah"
        },
        "silla": {
            "pt": "cadeira / assento",
            "en": "chair / seat",
            "id": "kursi"
        },
        "quitar": {
            "pt": "tirar / remover",
            "en": "to remove / to take away",
            "id": "menyingkirkan"
        },
        "embarazada": {
            "pt": "grávida",
            "en": "pregnant",
            "id": "hamil"
        },
        "pretender": {
            "pt": "pretender / tentar",
            "en": "to attempt / to seek",
            "id": "berusaha"
        },
        "éxito": {
            "pt": "sucesso / prosperidade",
            "en": "success / prosperity",
            "id": "keberhasilan"
        },
        "sale": {
            "pt": "sai / brota / sai fora",
            "en": "goes out / comes out",
            "id": "keluar"
        },
        "salen": {
            "pt": "saem / brotam",
            "en": "go out / come out",
            "id": "keluar"
        },
        "salía": {
            "pt": "saía",
            "en": "went out / was coming out",
            "id": "sedang keluar"
        },
        "salían": {
            "pt": "saíam",
            "en": "went out / were coming out",
            "id": "keluar"
        },
        "salga": {
            "pt": "saia / venha para fora",
            "en": "may go out / come forth",
            "id": "keluar"
        },
        "salgan": {
            "pt": "saiam / venham para fora",
            "en": "may go out / come forth",
            "id": "keluar"
        },
        "red": {
            "pt": "rede",
            "en": "net",
            "id": "jaring"
        },
        "ten": {
            "pt": "tem / tenha tu",
            "en": "have! / hold!",
            "id": "miliki"
        }
    }

    # 2. Conjugação verbal no pretérito perfeito 3ª sg em Espanhol (-ó, -ió, irregulares)
    ES_PAST_3SG = {
        "creó": ("criou", "created"),
        "dijo": ("disse", "said"),
        "habló": ("falou", "spoke"),
        "separó": ("separou", "separated"),
        "llamó": ("chamou", "called"),
        "hizo": ("fez", "made / did"),
        "vio": ("viu", "saw"),
        "oyó": ("ouviu", "heard"),
        "bendijo": ("abençoou", "blessed"),
        "acabó": ("acabou", "finished"),
        "reposó": ("descansou", "rested"),
        "santificó": ("santificou", "sanctified"),
        "formó": ("formou", "formed"),
        "plantó": ("plantou", "planted"),
        "puso": ("pôs", "put"),
        "tomó": ("tomou", "took"),
        "mandó": ("ordenou", "commanded"),
        "anduvo": ("andou", "walked"),
        "engendró": ("gerou", "begot"),
        "murió": ("morreu", "died"),
        "edificó": ("edificou / construiu", "built"),
        "halló": ("achou / encontrou", "found"),
        "envió": ("enviou", "sent"),
        "sucedió": ("sucedeu / aconteceu", "happened"),
        "vino": ("veio", "came"),
        "fue": ("foi", "was / went"),
        "dio": ("deu", "gave"),
        "conoció": ("conheceu", "knew"),
        "cayó": ("caiu", "fell"),
        "levantó": ("levantou", "raised / lifted"),
        "moró": ("habitou", "dwelt"),
        "lloró": ("chorou", "wept"),
        "buscó": ("buscou", "sought"),
        "peleó": ("lutou", "fought"),
        "trajo": ("trouxe", "brought"),
        "pensó": ("pensou", "thought"),
        "compró": ("comprou", "bought"),
        "vendió": ("vendeu", "sold"),
        "comió": ("comeu", "ate"),
        "bebió": ("bebeu", "drank"),
        "sentó": ("sentou", "sat"),
        "huyó": ("fugiu", "fled"),
        "guió": ("guiou", "guided / led"),
        "hirió": ("feriu", "struck / smote"),
        "mató": ("matou", "killed / slew"),
        "maldijo": ("amaldiçoou", "cursed"),
        "respondió": ("respondeu", "answered"),
        "clamó": ("clamou", "cried out"),
        "oró": ("orou", "prayed"),
        "reinó": ("reinou", "reigned"),
        "repartió": ("repartiu / dividiu", "divided"),
        "juntó": ("ajuntou / reuniu", "gathered"),
        "entró": ("entrou", "entered"),
        "salió": ("saiu", "went out"),
        "subió": ("subiu", "went up / climbed"),
        "bajó": ("desceu", "went down"),
        "nació": ("nasceu", "was born"),
        "vivió": ("viveu", "lived"),
        "volvió": ("voltou", "returned"),
        "pasó": ("passou", "passed"),
        "quedó": ("ficou", "remained"),
        "oyeron": ("ouviram", "heard"),
        "dijeron": ("disseram", "said"),
        "fueron": ("foram", "were / went"),
        "vinieron": ("vieram", "came"),
        "hicieron": ("fizeram", "made / did"),
        "vieron": ("viram", "saw"),
        "dieron": ("deram", "gave"),
        "pusieron": ("puseram", "put"),
        "tomaron": ("tomaram", "took"),
        "hablaron": ("falaram", "spoke"),
        "anduvieron": ("andaram", "walked"),
        "murieron": ("morreram", "died"),
        "crearon": ("criaram", "created"),
        "cubrían": ("cobriam", "covered / were covering"),
        "moraban": ("habitavam", "dwelt / were dwelling"),
        "tenían": ("tinham", "had"),
        "veían": ("viam", "saw / were seeing"),
        "decían": ("diziam", "said / were saying")
    }

    total_es_updated = 0
    for fpath in es_files:
        with open(fpath, "r", encoding="utf-8") as f:
            d = json.load(f)
        
        modified = False
        for k, v in d.items():
            if not isinstance(v, dict):
                continue
            
            # Limpar auto-tradução errônea "es" dentro de dict/es
            if "es" in v:
                del v["es"]
                modified = True

            # 1. Lexical fixes
            if k in ES_LEXICAL_FIXES:
                fix = ES_LEXICAL_FIXES[k]
                v["pt"] = fix["pt"]
                v["en"] = fix["en"]
                if "id" in fix and fix["id"]:
                    v["id"] = fix["id"]
                modified = True
                total_es_updated += 1
                continue

            # 2. Conjugação verbal
            if k in ES_PAST_3SG:
                pt_conj, en_conj = ES_PAST_3SG[k]
                # Se estava no infinitivo ou substantivo incorreto
                v["pt"] = pt_conj
                v["en"] = en_conj
                modified = True
                total_es_updated += 1
                continue

            # 3. Padrão genérico de Pretérito -ó em espanhol onde PT está no infinitivo (-ar)
            if k.endswith('ó') and len(k) > 3:
                pt_curr = v.get('pt', '')
                en_curr = v.get('en', '')
                if pt_curr.endswith('ar') and len(pt_curr) > 3:
                    # converter amar -> amou
                    pt_new = pt_curr[:-2] + 'ou'
                    v['pt'] = pt_new
                    if en_curr.startswith('to ') or not en_curr.endswith('ed'):
                        base_en = en_curr.replace('to ', '').strip()
                        if base_en.endswith('e'):
                            v['en'] = base_en + 'd'
                        elif base_en and not base_en.endswith('ed'):
                            v['en'] = base_en + 'ed'
                    modified = True
                    total_es_updated += 1

            # 4. Padrão genérico de Pretérito -ió em espanhol onde PT está no infinitivo (-er/-ir)
            if k.endswith('ió') and len(k) > 3:
                pt_curr = v.get('pt', '')
                if (pt_curr.endswith('er') or pt_curr.endswith('ir')) and len(pt_curr) > 3:
                    pt_new = pt_curr[:-2] + 'eu' if pt_curr.endswith('er') else pt_curr[:-2] + 'iu'
                    v['pt'] = pt_new
                    modified = True
                    total_es_updated += 1

        if modified:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, indent=2)

    print(f"Total Spanish entries updated: {total_es_updated}")


def curate_english_dictionary():
    print("=== Curating English Dictionary (dict/en/) ===")
    en_files = sorted(glob.glob(os.path.join(BASE_DIR, "dict", "en", "[0-9]*.json")),
                      key=lambda x: int(os.path.basename(x).split('.')[0]))

    # Regras léxicas universais da KJV / Inglês Bíblico
    EN_UNIVERSAL_FIXES = {
        "train": {
            "pt": "cortejo / comitiva / séquito / cauda",
            "es": "séquito / comitiva / faldas"
        },
        "spring": {
            "pt": "fonte / nascente / manancial",
            "es": "fuente / manantial"
        },
        "springs": {
            "pt": "fontes / mananciais",
            "es": "fuentes / manantiales"
        },
        "corn": {
            "pt": "grão / cereal / trigo",
            "es": "grano / cereal / trigo"
        },
        "meat": {
            "pt": "alimento / mantimento / comida",
            "es": "alimento / comida"
        },
        "locks": {
            "pt": "cachos / mechas / tranças",
            "es": "mechones / trenzas / cabellos"
        },
        "carriage": {
            "pt": "bagagem / provisões",
            "es": "bagaje / equipaje"
        },
        "carriages": {
            "pt": "bagagens / provisões",
            "es": "bagajes / equipajes"
        },
        "conversation": {
            "pt": "conduta / procedimento",
            "es": "conducta / manera de vivir"
        },
        "prevent": {
            "pt": "antecipar / preceder / vir ao encontro",
            "es": "preceder / salir al encuentro"
        },
        "prevented": {
            "pt": "antecipou / precedeu / veio ao encontro",
            "es": "precedió / salió al encuentro"
        },
        "halt": {
            "pt": "coxear / hesitar / claudicar",
            "es": "claudicar / vacilar"
        },
        "subtil": {
            "pt": "astuto / prudente",
            "es": "astuto"
        },
        "draw": {
            "pt": "tirar / extrair / puxar / aproximar",
            "es": "sacar / tirar / acercar"
        },
        "drew": {
            "pt": "tirou / puxou / aproximou-se",
            "es": "sacó / tiró / se acercó"
        },
        "drawn": {
            "pt": "tirado / extraído / puxado",
            "es": "sacado / extraído"
        },
        "kine": {
            "pt": "vacas",
            "es": "vacas"
        },
        "flea": {
            "pt": "pulga",
            "es": "pulga",
            "id": "kutu"
        },
        "descent": {
            "pt": "descida",
            "es": "bajada / descenso"
        },
        "spake": {
            "pt": "falou",
            "es": "habló"
        },
        "begat": {
            "pt": "gerou",
            "es": "engendró"
        },
        "saith": {
            "pt": "diz",
            "es": "dice"
        },
        "hath": {
            "pt": "tem",
            "es": "tiene / ha"
        },
        "doth": {
            "pt": "faz",
            "es": "hace"
        },
        "wist": {
            "pt": "sabia",
            "es": "sabía"
        },
        "wot": {
            "pt": "sabe",
            "es": "sabe"
        },
        "sold": {
            "pt": "vendeu / vendido",
            "es": "vendió / vendido"
        },
        "bought": {
            "pt": "comprou / comprado",
            "es": "compró / comprado"
        },
        "sat": {
            "pt": "sentou-se",
            "es": "se sentó"
        },
        "led": {
            "pt": "guiou / conduziu",
            "es": "guió / condujo"
        },
        "born": {
            "pt": "nascido / nasceu",
            "es": "nacido / nació"
        },
        "straightway": {
            "pt": "imediatamente / logo",
            "es": "inmediatamente / luego"
        },
        "anon": {
            "pt": "logo / em seguida",
            "es": "en seguida"
        },
        "shew": {
            "pt": "mostrar",
            "es": "mostrar"
        },
        "shewed": {
            "pt": "mostrou",
            "es": "mostró"
        }
    }

    total_en_updated = 0
    for fpath in en_files:
        book_num = os.path.basename(fpath).split('.')[0]
        with open(fpath, "r", encoding="utf-8") as f:
            d = json.load(f)

        modified = False
        
        # Limpar chaves poluídas (espanhol/gramatical residual)
        for dirty_key in ["asegúrense", "fem", "masc"]:
            if dirty_key in d:
                del d[dirty_key]
                modified = True

        for k, v in d.items():
            if not isinstance(v, dict):
                continue

            # 1. Bear / Bears distinção
            if k == "bear":
                if book_num in BEAR_ANIMAL_BOOKS:
                    v["pt"] = "urso / dar à luz / suportar"
                    v["es"] = "oso / dar a luz / soportar"
                else:
                    v["pt"] = "dar à luz / suportar / carregar"
                    v["es"] = "dar a luz / soportar / llevar"
                modified = True
                total_en_updated += 1
                continue

            if k == "bears":
                if book_num in BEAR_ANIMAL_BOOKS:
                    v["pt"] = "ursos / ursas"
                    v["es"] = "osos / osas"
                else:
                    v["pt"] = "leva / dá à luz"
                    v["es"] = "lleva / da a luz"
                modified = True
                total_en_updated += 1
                continue

            # 2. Bank / Banks distinção (margem de rio em livros de narrativa/geografia)
            if k in ("bank", "banks"):
                if book_num in RIVER_BANK_BOOKS:
                    if k == "bank":
                        v["pt"] = "margem / beira"
                        v["es"] = "orilla / ribera"
                    else:
                        v["pt"] = "margens / beiras"
                        v["es"] = "orillas / riberas"
                    modified = True
                    total_en_updated += 1
                    continue

            # 3. Universal fixes
            if k in EN_UNIVERSAL_FIXES:
                fix = EN_UNIVERSAL_FIXES[k]
                v["pt"] = fix["pt"]
                v["es"] = fix["es"]
                if "id" in fix:
                    v["id"] = fix["id"]
                modified = True
                total_en_updated += 1
                continue

        if modified:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, indent=2)

    print(f"Total English entries updated: {total_en_updated}")

if __name__ == "__main__":
    curate_spanish_dictionary()
    curate_english_dictionary()

