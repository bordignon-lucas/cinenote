const jwt = require("jsonwebtoken");

// Em produção (Render) o JWT_SECRET deve vir das variáveis de ambiente.
// O valor abaixo é só uma rede de segurança para desenvolvimento local, caso
// alguém esqueça de configurar o .env — nunca deve ser usado em produção.
const JWT_SECRET = process.env.JWT_SECRET || "cinenote_segredo_dev_trocar_em_producao";

// Protege rotas que só fazem sentido para quem está logado (a lista de
// títulos de cada pessoa). Espera um cabeçalho "Authorization: Bearer <token>",
// gerado no login/registro. Se o token for válido, guarda o id do usuário em
// req.usuarioId para as rotas usarem no filtro dos dados.
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
