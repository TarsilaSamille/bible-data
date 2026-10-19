#!/usr/bin/env bash
# Empacota os pacotes e publica como assets de uma release no GitHub.
#
#   npm run build                    # só gera dist/
#   PUBLISH_TAG=v2026.01.18 npm run release
#
# A tag é o que amarra o app à versão dos dados: o `DictPackStore` aponta para
# `releases/latest/download`, então publicar uma tag nova é o que faz o app
# passar a baixar o dicionário novo — sem precisar publicar o APK.
set -euo pipefail

# Este script mora em `<repo>/_build/tools/`, então a raiz do repositório de
# dados são dois níveis acima. O `cd` errado aqui foi o que fez a checagem do
# glossário procurar o arquivo em `_build/pt_master_glossary.json` e abortar a
# publicação mesmo com o arquivo gerado na raiz.
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RAIZ"

TAG="${PUBLISH_TAG:-}"
if [ -z "$TAG" ]; then
  echo "uso: PUBLISH_TAG=vYYYY.MM.DD npm run release" >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERRO: gh (GitHub CLI) não encontrado" >&2
  exit 2
fi

# O glossário PT é lido pelo mobile em runtime e mora na raiz de cada pacote
# mobile; sem ele, a tradução de uma palavra grega some sem internet. O caminho
# é absoluto porque este script mora em `_build/tools/`, e a checagem já falhou
# uma vez procurando `pt_master_glossary.json` a partir daqui.

if [ ! -f "$RAIZ/pt_master_glossary.json" ]; then
  echo "ERRO: pt_master_glossary.json ausente — rode 'npm run glossary'" >&2
  exit 2
fi

node _build/tools/verificar.mjs

echo ""
echo "Empacotando…"
node _build/tools/empacotar.mjs

ASSETS=()
while IFS= read -r z; do ASSETS+=("$z"); done < <(find _build/dist -name '*.zip' -type f | sort)
if [ ${#ASSETS[@]} -eq 0 ]; then
  echo "ERRO: nenhum zip gerado" >&2
  exit 2
fi

echo ""
echo "Publicando $TAG com ${#ASSETS[@]} asset(s)…"

# Republicar a MESMA tag tem que substituir os assets, senão o `latest/download`
# do Android continua servindo o pacote velho — que é a falha mais cara
# possível aqui, porque ninguém percebe até alguém-studar com dicionário errado.
# `--clobber` foi removido do gh (2.96), então a substituição é explícita:
# deleta os assets de mesmo nome antes de subir.
if gh release view "$TAG" >/dev/null 2>&1; then
  for z in "${ASSETS[@]}"; do
    nome="$(basename "$z")"
    gh release delete-asset "$TAG" "$nome" --yes >/dev/null 2>&1 || true
  done
  gh release upload "$TAG" "${ASSETS[@]}" --clobber
else
  gh release create "$TAG" "${ASSETS[@]}" \
    --title "Dict packs $TAG" \
    --notes "Pacotes de dicionário. Consumido pelo Scriptorium Android em runtime e pelo web via submódulo."
fi

echo ""
echo "Publicado: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$TAG"
