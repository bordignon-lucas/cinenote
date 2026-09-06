const jwt = require("jsonwebtoken");

// Em produção (Render), o JWT_SECRET tem que vir configurado nas variáveis
// de ambiente. O valor abaixo é só um reserva pra rodar no seu computador
// caso você esqueça de configurar o .env — nunca deve ser usado em produção.
const JWT_SECRET = process.env.JWT_SECRET || "cinenote_segredo_dev_trocar_em_producao";

// Protege as rotas que só fazem sentido pra quem está logado (a lista de
// títulos de cada pessoa). Confere o token que vem no cabeçalho da
// requisição (gerado no login ou cadastro) e, se for válido, guarda o id da
// pessoa em req.usuarioId pras próximas rotas usarem.
function autenticar(req, res, next) {
    const cabecalho = req.headers.authorization;

    if (!cabecalho || !cabecalho.startsWith("Bearer ")) {
        return res.status(401).json({ erro: "É necessário fazer login para acessar isso." });
    }

    const token = cabecalho.split(" ")[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.usuarioId = payload.usuarioId;
        next();
    } catch (err) {
        return res.status(401).json({ erro: "Sessão expirada ou inválida. Faça login novamente." });
    }
}

module.exports = { autenticar, JWT_SECRET };
