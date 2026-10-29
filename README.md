# Scriptorium Bible Data (`bible-data`)

Repositório central de dados léxicos, dicionários bíblicos multilíngues, corpora e índices de busca do Scriptorium.

Este repositório é consumido de duas formas:
1. **Web (`bible-reader-web`):** como submódulo git em `public/data/`.
2. **Android (`bible-app-mobile`):** via assets `.zip` baixados em runtime a partir das **Releases do GitHub**.

---

## ⚠️ REGRA MANDATÓRIA: Sempre Publicar Tag de Release

> [!IMPORTANT]
> **NUNCA DEIXE APENAS UM PUSH NA BRANCH `main` SEM TAG DE RELEASE!**
> 
> O aplicativo Android verifica atualizações de dicionário consultando:
> `https://api.github.com/repos/TarsilaSamille/bible-data/releases/latest`
> 
> O workflow do GitHub Actions (`.github/workflows/publicar.yml`) **SÓ É DISPARADO POR TAGS `v*`**.
> Se você apenas fizer `git commit` e `git push origin main`:
> - O site web até verá os arquivos novos (se o submódulo for atualizado).
> - **O aplicativo mobile NUNCA detectará a atualização** ao tocar no botão "Verificar atualizações", pois a API de releases continuará apontando para a tag antiga.

### Passo a passo obrigatório após qualquer correção ou curadoria:

```bash
# 1. Comitar as alterações
git add dict/ ...
git commit -m "fix(dict): descrição detalhada das correções"

# 2. Enviar para a branch main
git push origin main

# 3. CRIAR E PUBLICAR A TAG DE RELEASE (Formato: vYYYY.MM.DD ou vYYYY.MM.DD.N)
git tag v2026.10.29.12 -m "v2026.10.29.12: descrição do que mudou"
git push origin v2026.10.29.12
```

Assim que a tag for enviada:
1. O GitHub Actions executará `npm run build` (rodando gates de integridade, índices e empacotamento em `_build/dist/`).
2. O workflow criará automaticamente a Release com os pacotes `dict-source-*.zip` e `bolls-index.json`.
3. A URL `releases/latest` do GitHub será atualizada para a nova tag.
4. Qualquer usuário do mobile que tocar em "Verificar atualizações" baixará o dicionário novo instantaneamente.

---

## Estrutura de Diretórios

* `dict/`: Dicionários por idioma e por livro bíblico (1.json até 66.json + master.json) para Hebraico (`heb`), Grego (`grc`), Português (`pt`), Espanhol (`es`), Inglês (`en`), Francês (`fr`), Russo (`ru`), Japonês (`ja`), Coreano (`ko`), Alemão (`de`), Árabe (`ar`), etc.
* `bolls/`: Texto bíblico por tradução e capítulo.
* `bolls-index.json`: Índice consolidado das traduções com contagem de versículos e tamanhos.
* `_build/`: Scripts de validação (gates), geração de índices e ferramentas de empacotamento.

