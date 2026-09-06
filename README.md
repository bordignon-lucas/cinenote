# CineNote

CineNote é uma lista pessoal de filmes e séries: cada pessoa cria uma conta,
cadastra o que já assistiu ou ainda quer assistir, dá uma nota, marca
favoritos e pode deixar um comentário sobre cada título. Ao digitar o nome,
o próprio sistema já sugere o pôster, ano, gênero e diretor (usando a API do
TMDb).

Aplicação publicada em: https://cinenote-brda.onrender.com

## Estrutura do projeto

```
CineNote-completo/
├── package.json          # dependências e scripts (start, test)
├── .env.example          # modelo do arquivo de configuração
├── docs/
│   └── index.html        # página do GitHub Pages
├── backend/
│   ├── server.js          # API (Express) — também serve o front-end
│   ├── models/            # Usuario e Titulo (Mongoose)
│   ├── middleware/
│   │   └── auth.js        # confere o login (JWT) nas rotas protegidas
│   └── tests/             # testes automatizados (Jest + Supertest)
└── frontend-refinado/     # telas da aplicação (HTML, CSS e JS)
```

## Como rodar localmente

```bash
npm install
cp .env.example .env   # depois preencha com suas chaves (veja abaixo)
npm start
```

Com o servidor rodando, acesse **http://localhost:3000** no navegador.

### Variáveis de ambiente (arquivo `.env`)

| Variável        | Para que serve                                             |
|-----------------|-------------------------------------------------------------|
| `MONGODB_URI`   | endereço de conexão do banco de dados (MongoDB)             |
| `TMDB_API_KEY`  | chave gratuita da API do TMDb, para as sugestões de filmes  |
| `JWT_SECRET`    | texto aleatório usado para validar o login de cada pessoa   |

## Como rodar os testes

```bash
npm test
```

Os testes usam Jest e Supertest, e não precisam de um banco de dados
rodando (os dados são simulados).

## Hospedagem

A aplicação está hospedada no [Render](https://render.com), com o banco de
dados no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas). O próprio
Render publica uma nova versão automaticamente a cada `git push` na branch
`main`.

A página do GitHub Pages, com informações gerais sobre o projeto, fica em
`docs/index.html` e é publicada a partir da mesma branch.

---

*Documentação mais detalhada será adicionada na entrega final do projeto.*
