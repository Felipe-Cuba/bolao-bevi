# Bolão Bevi 🏆⚽

Aplicação web de **entretenimento** para acompanhar a Copa do Mundo 2026 e brincar de
bolão entre amigos — palpitar placares, somar pontos e comparar resultados. Não tem
qualquer fim comercial nem vínculo oficial com a FIFA ou com a competição; é um projeto
pessoal, só pela diversão.

## ✨ O que faz

- **Destaques** — jogo ao vivo, próximo e último, com listas de resultados e próximos
  jogos por fase, e um ranking de artilheiros.
- **Jogos** — todas as partidas, filtráveis por status e grupo.
- **Classificação** — tabela da fase de grupos, calculada a partir dos jogos encerrados.
- **Artilheiros** — pódio do top 3 e ranking completo de goleadores.
- **Bolão** — palpites de placar com pontuação (placar exato, resultado certo, erro),
  modo individual (localStorage) ou em grupo compartilhado.

## 🛠️ Tecnologias

**Frontend**
- [Angular 22](https://angular.dev/) (standalone components, zoneless, signals)
- [TanStack Query (Angular)](https://tanstack.com/query) — cache e estado das requisições
- [@angular/fire](https://github.com/angular/angularfire) + Cloud Firestore
- [Lucide](https://lucide.dev/) — ícones
- CSS puro (tema dark próprio, sem framework de UI)

**Backend**
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions) (Node 22) com
  [Express](https://expressjs.com/) — API REST que faz proxy da API externa, com cache
  no Firestore e *rate limiting* (gate de 30s)
- [Firebase Hosting](https://firebase.google.com/docs/hosting) — deploy do front + rewrite
  da API

**Ferramentas**
- [Bun](https://bun.sh/) — gerenciador de pacotes e runner de scripts

## 🔌 APIs

- [football-data.org](https://www.football-data.org/) (v4) — partidas, classificação e
  artilharia da Copa. O token fica **apenas** na Cloud Function (server-side); o cliente
  nunca o vê. As respostas são particionadas por fase/rodada e cacheadas no Firestore para
  reduzir transferência e respeitar o limite de requisições da API.

## 🚀 Rodando localmente

> Requer [Bun](https://bun.sh/) e a [Firebase CLI](https://firebase.google.com/docs/cli).

```bash
bun install
```

Copie os arquivos de exemplo e preencha com os dados do seu projeto Firebase:

```bash
cp .firebaserc.example .firebaserc
cp proxy.conf.json.example proxy.conf.json
cp src/environments/firebase.config.example.ts src/environments/firebase.config.ts
```

### Variáveis de ambiente das Functions (`.env`)

A API (Cloud Function) precisa do token da [football-data.org](https://www.football-data.org/client/register).
**Atenção ao nome do arquivo:** o Firebase carrega automaticamente o
`.env.<firebase-project-id>` — **não** o `.env` comum. O sufixo tem que ser exatamente o
*project id* do seu `.firebaserc`.

```bash
# substitua SEU_PROJECT_ID pelo id do projeto (o mesmo do .firebaserc)
cp functions/.env.example functions/.env.SEU_PROJECT_ID
```

Depois edite o arquivo e preencha o token:

```dotenv
FOOTBALL_DATA_TOKEN=seu_token_aqui
```

> Exemplo: se o seu projeto é `meu-bolao-123`, o arquivo deve se chamar
> `functions/.env.meu-bolao-123`. Todos os `functions/.env*` são ignorados pelo git
> (exceto o `.env.example`), então o token nunca é versionado.

Front (dados locais, sem API):

```bash
bun run start
```

Front + API real via emulador de Functions:

```bash
bun --cwd functions run serve   # sobe o emulador de Functions
bun run start:api               # serve o front apontando para o emulador
```

Build de produção:

```bash
bun run build
```

## 🤖 Sobre a construção

Este projeto foi feito **inteiramente com _vibe coding_** — desenvolvido em parceria com a
IA **Claude Opus 4.8** (Anthropic), via Claude Code. Da arquitetura ao CSS, passando pela
modelagem de dados, Cloud Functions e refinamentos de UI, tudo foi conversado e iterado
com o modelo. É também um experimento de até onde dá para levar um produto real
programando assim. 🚀
