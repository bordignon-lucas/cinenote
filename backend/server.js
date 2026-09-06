const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

// Serve o front-end refinado como arquivos estáticos — assim um único
// serviço hospedado (ex: Render) cobre API e interface ao mesmo tempo,
// sem precisar de dois hosts separados. Em desenvolvimento local isso não
// atrapalha quem abre o index.html direto no navegador (file://).
app.use(express.static(path.join(__dirname, "..", "frontend-refinado")));

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

function validarNota(nota) {
    const n = parseFloat(nota);
    if (isNaN(n) || n < 0 || n > 10) return false;
    return true;
}

// ── Sugestões de filmes/séries (TMDb) para autocompletar o título ────────────
// Proxy para a API do TMDb: a chave fica só aqui no backend (variável de
// ambiente TMDB_API_KEY), nunca exposta no front-end. Veja o README para
// configurar. Se a chave não estiver configurada, devolve uma lista vazia em
// vez de quebrar — o cadastro manual continua funcionando normalmente.
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

// ── Detalhes de um filme/série (sinopse, gênero, diretor) para a página de
// detalhes — chamado uma vez, no momento em que o usuário escolhe uma
// sugestão do autocomplete, e o resultado é salvo junto com o título.
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

// ── Autenticação ──────────────────────────────────────────────────────────────
// Cada pessoa passa a ter sua própria conta e sua própria lista de títulos.
// A senha nunca é guardada em texto puro — só o hash gerado pelo bcrypt.
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

// ── Rotas de títulos (todas exigem login, a partir daqui) ───────────────────
// A partir deste ponto, toda rota abaixo passa pelo middleware "autenticar" e
// só enxerga/edita os títulos que pertencem à pessoa logada (req.usuarioId).
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
        res.json(titulos);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar títulos." });
    }
});

// ── Buscar um único título (usado pela página de detalhes) ───────────────────
app.get("/titulos/:id", autenticar, async (req, res) => {
    try {
        const titulo = await Titulo.findOne({ _id: req.params.id, usuarioId: req.usuarioId });
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

// ── Marcar/desmarcar favorito (pode ter vários ao mesmo tempo) ────────────────
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

// Exporta o app para os testes (sem chamar listen aqui)
module.exports = app;

// Só sobe o servidor se for chamado diretamente
if (require.main === module) {
    // MONGODB_URI vem do .env (ou das variáveis de ambiente do serviço de
    // hospedagem, ex: Render). Sem ela, cai no MongoDB local — mantém o
    // fluxo de desenvolvimento de sempre funcionando sem configurar nada.
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/cinenote";
    const porta    = process.env.PORT || 3000;

    mongoose.connect(mongoUri)
        .then(() => {
            console.log("MongoDB conectado");
            app.listen(porta, () => console.log(`Servidor rodando na porta ${porta}`));
        })
        .catch(err => console.log(err));
}
