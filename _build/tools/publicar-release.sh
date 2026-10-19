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
cd "$(dirname "$0")/.."

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
# mobile; sem ele, a tradução de uma palavra grega some sem internet.
if [ ! -f pt_master_glossary.json ]; then
  echo "ERRO: pt_master_glossary.json ausente — rode 'npm run glossary'" >&2
  exit 2
fi

node tools/verificar.mjs

echo ""
echo "Empacotando…"
node tools/empacotar.mjs

ASSETS=()
while IFS= read -r z; do ASSETS+=("$z"); done < <(find dist -name '*.zip' -type f | sort)
if [ ${#ASSETS[@]} -eq 0 ]; then
  echo "ERRO: nenhum zip gerado" >&2
  exit 2
fi

echo ""
echo "Publicando $TAG com ${#ASSETS[@]} asset(s)…"
gh release create "$TAG" "${ASSETS[@]}" \
  --title "Dict packs $TAG" \
  --notes "Pacotes de dicionário. Consumido pelo Scriptorium Android em runtime e pelo web via submódulo." \
  --clobber

echo ""
echo "Publicado: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$TAG"
