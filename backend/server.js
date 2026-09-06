const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

// Essa linha faz o próprio servidor entregar as páginas do site (HTML, CSS
// e JS). Assim não precisa hospedar o site e a API em lugares diferentes.
app.use(express.static(path.join(__dirname, "..", "frontend-refinado")));

// Deixa a URL da página de detalhes mais bonita: "/detalhe/<código>" em vez
// de "/detalhe.html?id=...". O arquivo servido é sempre o mesmo — quem lê o
// código na URL é o detalhe.js.
app.get("/detalhe/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend-refinado", "detalhe.html"));
});

const Titulo = require("./models/Titulo");
const Usuario = require("./models/Usuario");
const { autenticar, JWT_SECRET } = require("./middleware/auth");

function formatarTexto(texto) {
    if (!texto) return texto;
    return texto
        .toLowerCase()
        .split(" ")
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

// Cria um código curto e aleatório pra usar na URL da página de detalhes,
// em vez de mostrar o id de verdade do banco de dados. Antes de usar,
// confere se esse código já não existe (é bem raro repetir, mas não custa
// checar).
async function gerarCodigoUrlUnico() {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
        const codigo = crypto.randomBytes(6).toString("base64url");
        const existente = await Titulo.findOne({ codigoUrl: codigo });
        if (!existente) return codigo;
    }
    return crypto.randomBytes(8).toString("base64url");
}

function validarNota(nota) {
    const n = parseFloat(nota);
    if (isNaN(n) || n < 0 || n > 10) return false;
    return true;
}

// ── Sugestões de filmes e séries (TMDb) ───────────────────────────────────────
// Essa rota busca as sugestões na TMDb por trás dos panos, então a chave da
// API fica só aqui no servidor e nunca aparece no navegador. Se a chave não
// estiver configurada, simplesmente não mostra sugestões — o cadastro manual
// continua funcionando do mesmo jeito.
app.get("/buscar-filme", async (req, res) => {
    try {
        const termo = (req.query.q || "").trim();
        if (termo.length < 2) {
            return res.json([]);
        }

        if (!process.env.TMDB_API_KEY) {
            console.warn("TMDB_API_KEY não configurada — autocomplete de filmes desativado (veja o README).");
            return res.json([]);
        }

        const url = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}` +
                    `&query=${encodeURIComponent(termo)}&language=pt-BR&include_adult=false`;

        const respostaTmdb = await fetch(url);
        const dados = await respostaTmdb.json();

        const sugestoes = (dados.results || [])
            .filter(item => item.media_type === "movie" || item.media_type === "tv")
            .slice(0, 6)
            .map(item => ({
                tmdbId: item.id,
                titulo: item.media_type === "movie" ? item.title : item.name,
                tipo:   item.media_type === "movie" ? "Filme" : "Série",
                ano:    (item.release_date || item.first_air_date || "").slice(0, 4),
                poster:       item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}`  : null,
                posterGrande: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null
            }));

        res.json(sugestoes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro ao buscar sugestões de filmes." });
    }
});

// Busca sinopse, gênero e diretor de um filme ou série na TMDb. É chamado
// só uma vez, quando a pessoa escolhe uma sugestão, e o resultado fica
// salvo junto com o título.
app.get("/detalhes-filme", async (req, res) => {
    try {
        const { tmdbId, tipo } = req.query;

        if (!tmdbId || !tipo) {
            return res.status(400).json({ erro: "Parâmetros tmdbId e tipo são obrigatórios." });
        }

        if (!process.env.TMDB_API_KEY) {
            return res.json({ descricao: null, genero: null, diretor: null });
        }

        const caminho = tipo === "Filme" ? "movie" : "tv";
        const url = `https://api.themoviedb.org/3/${caminho}/${encodeURIComponent(tmdbId)}` +
                    `?api_key=${process.env.TMDB_API_KEY}&language=pt-BR&append_to_response=credits`;

        const respostaTmdb = await fetch(url);
        const dados = await respostaTmdb.json();

        const genero = (dados.genres || []).map(g => g.name).join(", ") || null;

        let diretor = null;
        if (caminho === "movie") {
            const encontrado = (dados.credits?.crew || []).find(c => c.job === "Director");
            diretor = encontrado ? encontrado.name : null;
        } else {
            diretor = (dados.created_by || []).map(c => c.name).join(", ") || null;
        }

        res.json({
            descricao: dados.overview || null,
            genero,
            diretor
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro ao buscar detalhes do título." });
    }
});

// ── Login e cadastro ───────────────────────────────────────────────────────────
// Cada pessoa tem a própria conta e a própria lista. A senha nunca é
// guardada do jeito que a pessoa digitou — só uma versão criptografada dela
// (isso é o que o bcrypt faz).
app.post("/auth/registrar", async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios." });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
        }

        const emailNormalizado = email.toLowerCase().trim();
        const existente = await Usuario.findOne({ email: emailNormalizado });
        if (existente) {
            return res.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const usuario = await Usuario.create({ nome: nome.trim(), email: emailNormalizado, senhaHash });

        const token = jwt.sign({ usuarioId: usuario._id }, JWT_SECRET, { expiresIn: "30d" });
        res.status(201).json({ token, nome: usuario.nome, email: usuario.email });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao criar conta." });
    }
});

app.post("/auth/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
        }

        const usuario = await Usuario.findOne({ email: email.toLowerCase().trim() });
        if (!usuario) {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }

        const token = jwt.sign({ usuarioId: usuario._id }, JWT_SECRET, { expiresIn: "30d" });
        res.json({ token, nome: usuario.nome, email: usuario.email });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao entrar." });
    }
});

// ── Rotas dos títulos (só funcionam pra quem está logado) ────────────────────
// Toda rota abaixo passa primeiro pelo "autenticar", que confere o login.
// Assim, cada uma só mexe nos títulos da pessoa que está logada.
app.get("/titulos", autenticar, async (req, res) => {
    try {
        const { tipo, busca } = req.query;
        const filtro = { usuarioId: req.usuarioId };

        if (tipo && tipo !== "todos") {
            filtro.tipo = { $regex: `^${tipo}$`, $options: "i" };
        }
        if (busca) {
            filtro.titulo = { $regex: busca, $options: "i" };
        }

        const titulos = await Titulo.find(filtro);

        // Títulos cadastrados antes de existir a URL limpa ainda não têm
        // esse código — aqui a gente cria um pra eles na primeira vez que
        // aparecem, pra o link continuar funcionando.
        for (const titulo of titulos) {
            if (!titulo.codigoUrl) {
                titulo.codigoUrl = await gerarCodigoUrlUnico();
                await titulo.save();
            }
        }

        res.json(titulos);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar títulos." });
    }
});

// ── Busca um único título (usado na página de detalhes) ──────────────────────
// Busca pelo código curto que aparece na URL, não pelo id real do banco de
// dados — assim a URL não mostra esse identificador interno.
app.get("/titulos/:id", autenticar, async (req, res) => {
    try {
        const titulo = await Titulo.findOne({ codigoUrl: req.params.id, usuarioId: req.usuarioId });
        if (!titulo) {
            return res.status(404).json({ erro: "Título não encontrado." });
        }
        res.json(titulo);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar título." });
    }
});

app.post("/titulos", autenticar, async (req, res) => {
    try {
        if (!validarNota(req.body.nota)) {
            return res.status(400).json({ erro: "A nota deve ser um número entre 0 e 10." });
        }

        const body = {
            ...req.body,
            usuarioId: req.usuarioId,
            titulo: formatarTexto(req.body.titulo),
            tipo:   formatarTexto(req.body.tipo),
            nota:   parseFloat(req.body.nota),
            status: req.body.status || "Quero Assistir"
        };

        const duplicado = await Titulo.findOne({ titulo: body.titulo, usuarioId: req.usuarioId });
        if (duplicado) {
            return res.status(409).json({ erro: `"${body.titulo}" já está cadastrado.` });
        }

        body.codigoUrl = await gerarCodigoUrlUnico();

        const novoTitulo = new Titulo(body);
        await novoTitulo.save();
        res.json(novoTitulo);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao adicionar título." });
    }
});

app.put("/titulos/:id", autenticar, async (req, res) => {
    try {
        if (!validarNota(req.body.nota)) {
            return res.status(400).json({ erro: "A nota deve ser um número entre 0 e 10." });
        }

        const body = {
            ...req.body,
            titulo: formatarTexto(req.body.titulo),
            tipo:   formatarTexto(req.body.tipo),
            nota:   parseFloat(req.body.nota)
        };

        const duplicado = await Titulo.findOne({
            titulo: body.titulo,
            usuarioId: req.usuarioId,
            _id: { $ne: req.params.id }
        });
        if (duplicado) {
            return res.status(409).json({ erro: `"${body.titulo}" já está cadastrado.` });
        }

        const atualizado = await Titulo.findOneAndUpdate(
            { _id: req.params.id, usuarioId: req.usuarioId },
            body,
            { new: true }
        );

        if (!atualizado) {
            return res.status(404).json({ erro: "Título não encontrado." });
        }

        res.json(atualizado);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao editar título." });
    }
});

// ── Marcar ou desmarcar como favorito (pode favoritar quantos quiser) ────────
app.patch("/titulos/:id/favorito", autenticar, async (req, res) => {
    try {
        const atualizado = await Titulo.findOneAndUpdate(
            { _id: req.params.id, usuarioId: req.usuarioId },
            { favorito: !!req.body.favorito },
            { new: true }
        );

        if (!atualizado) {
            return res.status(404).json({ erro: "Título não encontrado." });
        }

        res.json(atualizado);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao atualizar favorito." });
    }
});

app.delete("/titulos/:id", autenticar, async (req, res) => {
    try {
        await Titulo.findOneAndDelete({ _id: req.params.id, usuarioId: req.usuarioId });
        res.json({ mensagem: "Título removido" });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao remover título." });
    }
});

// Exporta o app pros testes usarem (sem ligar o servidor aqui)
module.exports = app;

// Só liga o servidor quando o arquivo é executado direto (os testes
// importam o app sem passar por aqui)
if (require.main === module) {
    // O endereço do banco de dados vem do .env (ou das variáveis do
    // Render, em produção). Sem isso configurado, usa o MongoDB do seu
    // computador mesmo.
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/cinenote";
    const porta    = process.env.PORT || 3000;

    mongoose.connect(mongoUri)
        .then(() => {
            console.log("MongoDB conectado");
            app.listen(porta, () => console.log(`Servidor rodando na porta ${porta}`));
        })
        .catch(err => console.log(err));
}
