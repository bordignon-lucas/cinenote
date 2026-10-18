# CineNote

CineNote é uma lista pessoal de filmes e séries: cada pessoa cria uma conta e
só vê a própria lista, cadastra o que já assistiu ou ainda quer assistir, dá
uma nota, marca favoritos e pode deixar um comentário sobre cada título. Ao
digitar o nome de um filme ou série, o próprio sistema já sugere o pôster,
ano, gênero e diretor, usando a API do TMDb.

**Aplicação publicada:** https://cinenote-brda.onrender.com
**Portfólio do projeto (GitHub Pages):** https://bordignon-lucas.github.io/cinenote/

## Funcionalidades

- Conta individual: cada pessoa cria seu próprio login e só vê os próprios títulos
- Cadastro de filmes e séries com nota, tipo e status (assistido / quero assistir)
- Autocomplete com pôster, ano, gênero e diretor preenchidos automaticamente (TMDb)
- Favoritos em destaque, num carrossel separado da lista principal
- Busca e filtro por tipo, e ordenação por nome ou ano
- Página de detalhes com sinopse e um campo de comentário pessoal
- Edição e exclusão de títulos, com confirmação antes de excluir
- Contador de quantos títulos já foram assistidos
- Testes automatizados (59 testes) cobrindo a API e funções do front-end

## Estrutura do projeto

```
cinenote/
├── package.json          # dependências e scripts (start, test)
├── .env.example           # modelo do arquivo de configuração
├── docs/
│   └── index.html          # página do GitHub Pages
├── backend/
│   ├── server.js            # API (Express) — também serve o front-end
│   ├── models/               # Usuario e Titulo (Mongoose)
│   ├── middleware/
│   │   └── auth.js            # confere o login (JWT) nas rotas protegidas
│   └── tests/                # testes automatizados (Jest + Supertest)
└── frontend-refinado/        # telas da aplicação (HTML, CSS e JS)
```

## Como rodar localmente

```bash
git clone https://github.com/bordignon-lucas/cinenote.git
cd cinenote
npm install
cp .env.example .env   # depois preencha com suas chaves (veja abaixo)
npm start
```

Com o servidor rodando, acesse **http://localhost:3000** no navegador.

### Variáveis de ambiente (arquivo `.env`)

| Variável | Para que serve | Onde conseguir |
|---|---|---|
| `MONGODB_URI` | endereço de conexão do banco de dados | crie um banco gratuito em [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) |
| `TMDB_API_KEY` | chave da API do TMDb, usada nas sugestões de filmes | crie uma conta grátis em [themoviedb.org](https://www.themoviedb.org/signup) e gere a chave em Configurações > API |
| `JWT_SECRET` | texto aleatório usado para validar o login de cada pessoa | qualquer texto longo; pode gerar um com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Sem o `MONGODB_URI` configurado, o projeto tenta usar um MongoDB local
(`mongodb://localhost:27017/cinenote`). Sem o `TMDB_API_KEY`, o autocomplete
simplesmente não mostra sugestões — o cadastro manual continua funcionando.

## Como rodar os testes

```bash
npm test
```

Os testes usam Jest e Supertest, e não precisam de um banco de dados
rodando — os dados do banco são simulados (mock), então os 59 testes rodam
rápido e sem depender de internet ou de uma conta no MongoDB Atlas.

## Hospedagem

A aplicação está hospedada gratuitamente no [Render](https://render.com),
com o banco de dados no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
Pra publicar uma cópia própria:

1. Suba o código para um repositório no GitHub
2. Crie um cluster gratuito no MongoDB Atlas e copie a connection string
3. No Render, crie um **Web Service** apontando pro repositório, com:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Em **Environment Variables**, configure `MONGODB_URI`, `TMDB_API_KEY` e
   `JWT_SECRET` (os mesmos três do `.env`, com valores de produção)
5. O Render publica uma nova versão automaticamente a cada `git push` na
   branch `main`

> No plano gratuito, o serviço "dorme" depois de alguns minutos sem uso, e a
> primeira requisição depois disso demora de 20 a 30 segundos pra responder
> — é esperado, não é um erro.

A página do GitHub Pages fica em `docs/index.html` e é publicada a partir da
mesma branch, em **Settings > Pages** (source: branch `main`, pasta `/docs`).

## Tecnologias

Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Jest, Supertest, HTML/CSS/JS
e a API do TMDb.

---

Projeto acadêmico desenvolvido por Lucas Bordignon para a disciplina de
Extensão.
