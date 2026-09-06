# CineNote — projeto + testes (consolidado)

Esta pasta junta em um único lugar o **código corrigido** do projeto (que estava
em `EXT6/EXT6/cinenoteCORRIGIDO`) com a **suíte de testes automatizados** (que
estava na pasta `cinenote-tests`), prontos para rodar juntos.

## Estrutura

```
CineNote-completo/
├── package.json          # dependências + scripts (start, test, test:backend, test:frontend)
├── .env.example          # modelo do arquivo de configuração (chave do TMDb + MongoDB)
├── docs/
│   └── index.html        # página do GitHub Pages (sobre o projeto, funcionalidades, arquitetura)
├── backend/
│   ├── server.js             # API Express (também serve o frontend-refinado como estático)
│   ├── models/
│   │   ├── Titulo.js         # schema Mongoose (cada título pertence a um usuarioId)
│   │   └── Usuario.js        # schema Mongoose (conta de cada pessoa)
│   ├── middleware/
│   │   └── auth.js           # valida o token de login (JWT) nas rotas protegidas
│   └── tests/
│       ├── server.test.js    # testes de API (supertest + mocks dos models)
│       └── app.test.js       # testes do front-end (jsdom, funções utilitárias)
├── frontend/             # versão corrigida original
│   ├── index.html
│   ├── app.js
│   └── style.css
└── frontend-refinado/    # versão com melhorias de UX, login e página de detalhes
    ├── index.html
    ├── app.js
    ├── login.html        # tela de entrar / criar conta
    ├── login.js
    ├── detalhe.html      # página de detalhes de um título (gênero, diretor, sinopse, comentário)
    ├── detalhe.js
    └── style.css
```

## Como rodar o projeto

```bash
npm install
cp .env.example .env   # depois cole sua chave do TMDb (veja a seção abaixo)
# subir um MongoDB local (ex.: mongod) antes de iniciar
npm start
```

O backend também serve o `frontend-refinado` como arquivos estáticos, então
depois de rodar `npm start` dá pra abrir **http://localhost:3000** direto no
navegador. Também é possível abrir `frontend/index.html` ou
`frontend-refinado/index.html` direto do disco (duplo clique) — nesse caso o
front-end continua indo buscar a API em `http://localhost:3000` normalmente.

## Autocomplete de filmes/séries com pôster (TMDb)

O `frontend-refinado` sugere títulos com pôster enquanto a pessoa digita,
usando a API gratuita do [TMDb](https://www.themoviedb.org). O backend expõe
uma rota própria (`GET /buscar-filme?q=...`) que funciona como *proxy* para a
TMDb — a chave da API fica só no servidor, nunca é exposta no navegador.

Para ativar:

1. Crie uma conta grátis em https://www.themoviedb.org/signup
2. Gere uma chave em https://www.themoviedb.org/settings/api (tipo "Developer"
   já é suficiente) e copie a **API Key (v3 auth)**.
3. Copie `.env.example` para `.env` e cole a chave na variável `TMDB_API_KEY`.
4. Reinicie o servidor (`npm start`).

Sem a chave configurada, a rota simplesmente devolve uma lista vazia — o
cadastro manual continua funcionando normalmente, só sem sugestões.

## Login (cada pessoa com sua própria lista)

O CineNote tem conta de usuário: cada pessoa cria um cadastro (nome, e-mail,
senha) e só enxerga/edita os próprios títulos — não existe mais uma lista
única compartilhada por todo mundo que acessa o link.

Como funciona por baixo dos panos:

1. `POST /auth/registrar` cria a conta (a senha é guardada com hash via
   `bcryptjs`, nunca em texto puro) e já devolve um token de sessão (JWT).
2. `POST /auth/login` confere e-mail/senha e devolve o mesmo tipo de token.
3. O front-end guarda esse token no `localStorage` do navegador e manda ele
   em todas as chamadas à API (cabeçalho `Authorization: Bearer <token>`).
4. O backend usa esse token pra saber de quem é cada requisição
   (`backend/middleware/auth.js`) e filtra os títulos pelo dono
   (`usuarioId`) em todas as rotas de `/titulos`.
5. Sem token válido, o front-end manda a pessoa de volta pra
   `login.html` automaticamente.

Isso precisa de uma variável extra, `JWT_SECRET` (veja `.env.example`) — uma
string aleatória usada para assinar os tokens. Sem ela configurada, o
servidor usa um valor padrão só para desenvolvimento local; **em produção
(Render) é obrigatório configurar a sua própria**, senão qualquer pessoa que
souber o valor padrão poderia forjar um token válido.

## Como rodar os testes

```bash
npm install
npm test              # roda tudo
npm run test:backend  # só os testes de API
npm run test:frontend # só os testes de front-end
```

Os testes de backend **mockam** o model `Titulo`, então não precisam de um
MongoDB rodando.

## Hospedagem (colocar a aplicação no ar)

A aplicação foi pensada pra rodar como **um único serviço**: o próprio
Express (`backend/server.js`) serve tanto a API quanto os arquivos do
`frontend-refinado` (via `express.static`). Isso significa que só é preciso
hospedar o backend — não precisa de um serviço separado pro front-end.

Passo a passo usando [Render](https://render.com) (gratuito) e
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratuito):

### 1. Subir o código pro GitHub

O repositório https://github.com/bordignon-lucas/cinenote já existe, mas
ainda está vazio. No terminal, dentro da pasta `CineNote-completo`:

```bash
git init
git add .
git commit -m "Versão inicial do CineNote"
git branch -M main
git remote add origin https://github.com/bordignon-lucas/cinenote.git
git push -u origin main
```

Se o Git pedir login, ele abre o navegador pra você autorizar — é o jeito
normal do Git se autenticar com o GitHub, não precisa configurar nada extra.
(O `.gitignore` já exclui `node_modules/` e `.env`, então nenhum dado
sensível é enviado.)

### 2. Criar o banco de dados no MongoDB Atlas

1. Crie uma conta grátis em https://www.mongodb.com/cloud/atlas/register
2. Crie um cluster gratuito (opção **M0 Free**).
3. Em **Database Access**, crie um usuário com senha (anote os dois).
4. Em **Network Access**, adicione `0.0.0.0/0` (permite acesso de qualquer
   lugar — necessário porque o Render não tem um IP fixo no plano grátis).
5. Em **Database > Connect > Drivers**, copie a connection string. Ela se
   parece com:
   ```
   mongodb+srv://<usuario>:<senha>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Troque `<usuario>` e `<senha>` pelos valores reais, e adicione `cinenote`
   como nome do banco antes do `?`:
   ```
   mongodb+srv://usuario:senha@cluster0.xxxxx.mongodb.net/cinenote?retryWrites=true&w=majority
   ```
   Essa string completa é o valor de `MONGODB_URI`.

### 3. Publicar o backend no Render

1. Crie uma conta grátis em https://render.com (dá pra entrar direto com o
   GitHub).
2. No painel, clique em **New > Web Service** e escolha o repositório
   `bordignon-lucas/cinenote`.
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Em **Environment Variables**, adicione:
   - `MONGODB_URI` → a connection string do Atlas (passo anterior)
   - `TMDB_API_KEY` → sua chave da TMDb (a mesma do `.env` local)
   - `JWT_SECRET` → uma string aleatória própria de produção (dá pra gerar
     com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
     usada para assinar os tokens de login — **não reaproveite** um valor de
     teste/exemplo aqui.
5. Clique em **Create Web Service**. O Render instala as dependências e
   inicia o servidor — a URL pública aparece no topo da página (algo como
   `https://cinenote.onrender.com`).

> No plano gratuito, o serviço "dorme" depois de alguns minutos sem uso, e a
> primeira requisição depois disso demora ~30 segundos pra responder — é
> normal, não é bug.

Depois de publicado, atualize os links `https://cinenote.onrender.com` em
`docs/index.html` com a URL real que o Render gerou, e envie a mudança
(`git add`, `git commit`, `git push`) — o Render publica de novo
automaticamente a cada push na branch `main`.

### 4. Ativar o GitHub Pages

1. No GitHub, abra o repositório e vá em **Settings > Pages**.
2. Em **Source**, escolha a branch `main` e a pasta `/docs`.
3. Salve. Depois de alguns minutos a página fica disponível em
   `https://bordignon-lucas.github.io/cinenote/`.

## O que foi ajustado na junção

- `backend/server.js` veio da versão de `cinenote-tests/server.js`: é o mesmo
  código corrigido (validação de nota 0–10, filtro por tipo/busca, checagem de
  título duplicado, tratamento de erro 500 em cada rota), só que exporta o
  `app` (`module.exports = app`) e só chama `app.listen` quando o arquivo é
  executado diretamente — isso é o que permite o `supertest` importar o app
  nos testes sem precisar subir a porta 3000.
- `backend/models/Titulo.js` veio da versão corrigida (com mensagens de erro
  customizadas em `min`/`max` da nota).
- O front-end (`frontend/`) é a versão corrigida (select fixo de tipo, busca e
  filtro em tempo real, edição inline, validação de nota no cliente).
- `package.json` combina as dependências de produção do projeto corrigido
  (`express`, `mongoose`, `cors`) com as `devDependencies` de teste
  (`jest`, `jest-environment-jsdom`, `supertest`, `mongodb-memory-server`).

## Refinamento de interface (`frontend-refinado/`)

Cópia do `frontend/` com melhorias de UX, mantida separada até ser aprovada
para substituir a versão original:

- URL da API numa constante (`API_URL`) em vez de espalhada pelo código —
  fica fácil trocar quando o backend for hospedado.
- Confirmação antes de excluir um título.
- Rótulos visíveis em todos os campos do formulário.
- Botão "Salvar" mostra "Salvando..." e fica desabilitado durante a
  requisição (evita clique duplo).
- Contador "X títulos · Y assistidos" no topo da lista.
- Autocomplete de título com pôster via TMDb (ver seção acima), com o pôster
  exibido depois nos cards da lista (maior que antes: 56×84px).
- Ano de lançamento: ao escolher uma sugestão do autocomplete, o ano vem
  junto e aparece do lado do título (ex.: "The Matrix (1999)"), tanto nos
  cards da lista quanto no carrossel de favoritos.
- Favoritos: clicando na estrela (☆) de um título ele aparece também num
  carrossel "Favoritos" no topo da lista, com pôster maior e arrastável com
  o mouse — mas continua normalmente na lista principal, podendo ser
  editado/excluído/buscado dali como qualquer outro título. Pode ter
  quantos favoritos quiser; a estrela (★) fica destacada em dourado e
  desmarca o favorito tanto pela lista quanto pelo carrossel.
- Ordenação da lista: um segundo seletor ao lado do filtro de tipo permite
  ordenar por nome (A-Z / Z-A) ou por ano de lançamento (mais recente /
  mais antigo). A ordenação é aplicada no navegador, depois do filtro e da
  busca.
- Comentário pessoal: cada título tem um campo de observação livre
  (`comentario`), editável na página de detalhes — útil para anotar por
  que quer assistir, ou uma resenha depois de assistido.
- Página de detalhes: clicando no título (na lista ou no carrossel de
  favoritos) abre `detalhe.html?id=...`, com pôster grande, gênero,
  diretor (ou criador, no caso de séries) e sinopse. A página também
  permite favoritar, excluir e editar o comentário sem precisar voltar
  para a lista.
- Preenchimento automático mesmo sem usar o autocomplete: se a pessoa
  digitar o título inteiro e clicar direto em "Salvar" (sem escolher uma
  sugestão), o backend tenta encontrar esse título na TMDb pelo texto
  digitado e preenche pôster, ano, gênero, diretor e sinopse do mesmo
  jeito — só fica sem essas informações se a TMDb realmente não encontrar
  nada parecido. Para títulos que já estavam cadastrados assim (de antes
  dessa mudança), a página de detalhes mostra um botão "🔍 Buscar
  informações na TMDb" que faz essa mesma busca a qualquer momento.
- Login e conta individual: cada pessoa cria a própria conta
  (`login.html`) e só vê os próprios títulos — ver seção "Login" acima
  para os detalhes técnicos.

Essas mudanças também acrescentaram, no backend compartilhado:

- rota `GET /buscar-filme` (proxy para a TMDb, agora também retorna o
  `tmdbId` de cada sugestão);
- rota `GET /detalhes-filme` (proxy para a TMDb: sinopse, gênero e diretor
  de um título específico, buscado uma vez no momento da seleção);
- rota `POST /auth/registrar` (cria a conta e devolve o token de sessão);
- rota `POST /auth/login` (confere e-mail/senha e devolve o token);
- rota `GET /detalhe/:codigo` (serve a página de detalhes com URL limpa, ex:
  `/detalhe/1kGeNAKl`, em vez de `/detalhe.html?id=...`);
- rota `GET /titulos/:id` (busca um único título da pessoa logada pelo
  `codigoUrl`, usada pela página de detalhes — não é mais buscado pelo `_id`
  real do MongoDB, para não expor o identificador interno do banco na URL);
- rota `PATCH /titulos/:id/favorito` (marca/desmarca favorito);
- todas as rotas de `/titulos` agora exigem login (cabeçalho
  `Authorization: Bearer <token>`) e só enxergam os títulos da pessoa
  logada;
- campo `usuarioId` no model `Titulo` (dono do título, usado para filtrar
  a lista de cada pessoa);
- model `Usuario` (nome, e-mail único, senha guardada como hash);
- campo `poster` no model `Titulo` (opcional, `null` se não vier de nenhuma
  sugestão);
- campo `ano` no model `Titulo` (string com o ano de lançamento, `null` se
  não vier de nenhuma sugestão);
- campo `favorito` no model `Titulo` (booleano, `false` por padrão);
- campos `descricao`, `genero` e `diretor` no model `Titulo` (vêm da TMDb,
  `null` se o título foi cadastrado manualmente);
- campo `comentario` no model `Titulo` (texto livre, editável na página de
  detalhes);
- campo `codigoUrl` no model `Titulo` (código curto e aleatório, gerado ao
  cadastrar, usado só na URL da página de detalhes — títulos cadastrados
  antes dessa mudança recebem um automaticamente na primeira vez que a
  lista é carregada).

Os 59 testes automatizados continuam passando normalmente (41 anteriores +
18 novos para cadastro/login, proteção das rotas de títulos e a URL limpa
da página de detalhes).

## O que ficou de fora (não copiado)

Por serem arquivos grandes e não fazerem parte do código, os itens abaixo
**continuam apenas** na pasta `EXT6` original, para não duplicar dados
desnecessariamente:

- `EXT6/EXT6/cinenote_codigo_projeto/` — a versão **original enviada** (antes
  da correção), mantida como referência/histórico.
- `EXT6/EXT6/appCorrigido.mp4`, `ext6_cine.mp4`, `videoBugs.mp4` — vídeos de
  demonstração/evidência dos bugs.

Se quiser, posso trazer esses vídeos para dentro desta mesma pasta também —
é só pedir.
