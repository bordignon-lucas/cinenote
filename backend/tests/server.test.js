const request = require("supertest");
const jwt = require("jsonwebtoken");

// ── Mock dos modelos ──────────────────────────────────────────────────────────
jest.mock("../models/Titulo");
jest.mock("../models/Usuario");

const Titulo  = require("../models/Titulo");
const Usuario = require("../models/Usuario");
const { JWT_SECRET } = require("../middleware/auth");
const app = require("../server");

afterEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

// ── Token válido para os testes que exigem login ─────────────────────────────
// Todas as rotas de /titulos passaram a exigir autenticação: cada requisição
// simula uma pessoa já logada (usuarioId "usr123"), assinado com o mesmo
// segredo que o middleware usa para validar.
const usuarioIdFalso = "usr123";
const tokenValido = jwt.sign({ usuarioId: usuarioIdFalso }, JWT_SECRET);
const cabecalhoAuth = { Authorization: `Bearer ${tokenValido}` };

// ────────────────────────────────────────────────────────────────────────────
// POST /auth/registrar
// ────────────────────────────────────────────────────────────────────────────
describe("POST /auth/registrar", () => {
    test("deve criar uma conta com sucesso", async () => {
        Usuario.findOne.mockResolvedValue(null);
        Usuario.create.mockResolvedValue({ _id: "novoId", nome: "Lucas", email: "lucas@teste.com" });

        const res = await request(app)
            .post("/auth/registrar")
            .send({ nome: "Lucas", email: "lucas@teste.com", senha: "123456" });

        expect(res.status).toBe(201);
        expect(res.body.token).toBeDefined();
        expect(res.body.nome).toBe("Lucas");
    });

    test("deve rejeitar cadastro sem nome, e-mail ou senha", async () => {
        const res = await request(app)
            .post("/auth/registrar")
            .send({ email: "lucas@teste.com", senha: "123456" });

        expect(res.status).toBe(400);
        expect(res.body.erro).toBeDefined();
    });

    test("deve rejeitar senha com menos de 6 caracteres", async () => {
        const res = await request(app)
            .post("/auth/registrar")
            .send({ nome: "Lucas", email: "lucas@teste.com", senha: "123" });

        expect(res.status).toBe(400);
    });

    test("deve rejeitar e-mail já cadastrado", async () => {
        Usuario.findOne.mockResolvedValue({ _id: "existente", email: "lucas@teste.com" });

        const res = await request(app)
            .post("/auth/registrar")
            .send({ nome: "Lucas", email: "lucas@teste.com", senha: "123456" });

        expect(res.status).toBe(409);
    });

    test("deve retornar 500 em erro interno", async () => {
        Usuario.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(app)
            .post("/auth/registrar")
            .send({ nome: "Lucas", email: "lucas@teste.com", senha: "123456" });

        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// ────────────────────────────────────────────────────────────────────────────
describe("POST /auth/login", () => {
    test("deve entrar com sucesso quando e-mail e senha estão corretos", async () => {
        const bcrypt = require("bcryptjs");
        const senhaHash = await bcrypt.hash("123456", 10);
        Usuario.findOne.mockResolvedValue({ _id: "usr123", nome: "Lucas", email: "lucas@teste.com", senhaHash });

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "lucas@teste.com", senha: "123456" });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    test("deve rejeitar login sem e-mail ou senha", async () => {
        const res = await request(app).post("/auth/login").send({ email: "lucas@teste.com" });
        expect(res.status).toBe(400);
    });

    test("deve rejeitar e-mail não cadastrado", async () => {
        Usuario.findOne.mockResolvedValue(null);

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "naoexiste@teste.com", senha: "123456" });

        expect(res.status).toBe(401);
    });

    test("deve rejeitar senha incorreta", async () => {
        const bcrypt = require("bcryptjs");
        const senhaHash = await bcrypt.hash("senhaCerta", 10);
        Usuario.findOne.mockResolvedValue({ _id: "usr123", nome: "Lucas", email: "lucas@teste.com", senhaHash });

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "lucas@teste.com", senha: "senhaErrada" });

        expect(res.status).toBe(401);
    });

    test("deve retornar 500 em erro interno", async () => {
        Usuario.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "lucas@teste.com", senha: "123456" });

        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Middleware de autenticação — protege as rotas de /titulos
// ────────────────────────────────────────────────────────────────────────────
describe("Proteção das rotas de títulos", () => {
    test("deve rejeitar acesso sem token", async () => {
        const res = await request(app).get("/titulos");
        expect(res.status).toBe(401);
    });

    test("deve rejeitar acesso com token inválido", async () => {
        const res = await request(app).get("/titulos").set("Authorization", "Bearer token-invalido");
        expect(res.status).toBe(401);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /detalhe/:id — URL limpa da página de detalhes (sem .html/?id=)
// ────────────────────────────────────────────────────────────────────────────
describe("GET /detalhe/:id", () => {
    test("deve servir a página de detalhes (não exige login, é HTML estático)", async () => {
        const res = await request(app).get("/detalhe/6a9ceedbcf0619f909229e8d");

        expect(res.status).toBe(200);
        expect(res.type).toBe("text/html");
        expect(res.text).toContain("CineNote");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /titulos
// ────────────────────────────────────────────────────────────────────────────
describe("POST /titulos", () => {
    test("deve adicionar um título com sucesso", async () => {
        Titulo.findOne.mockResolvedValue(null);
        Titulo.mockImplementation((data) => ({ ...data, _id: "abc123", save: jest.fn().mockResolvedValue() }));

        const res = await request(app)
            .post("/titulos")
            .set(cabecalhoAuth)
            .send({ titulo: "Inception", tipo: "Filme", nota: 9, status: "Assistido" });

        expect(res.status).toBe(200);
        expect(res.body.titulo).toBe("Inception");
        expect(res.body.codigoUrl).toBeDefined();
        expect(typeof res.body.codigoUrl).toBe("string");
    });

    test("deve rejeitar nota maior que 10", async () => {
        const res = await request(app)
            .post("/titulos")
            .set(cabecalhoAuth)
            .send({ titulo: "Teste", tipo: "Filme", nota: 11, status: "Assistido" });

        expect(res.status).toBe(400);
        expect(res.body.erro).toBeDefined();
    });

    test("deve rejeitar nota negativa", async () => {
        const res = await request(app)
            .post("/titulos")
            .set(cabecalhoAuth)
            .send({ titulo: "Teste", tipo: "Filme", nota: -1, status: "Assistido" });

        expect(res.status).toBe(400);
        expect(res.body.erro).toBeDefined();
    });

    test("deve rejeitar nota NaN", async () => {
        const res = await request(app)
            .post("/titulos")
            .set(cabecalhoAuth)
            .send({ titulo: "Teste", tipo: "Filme", nota: "abc", status: "Assistido" });

        expect(res.status).toBe(400);
    });

    test("deve rejeitar título duplicado", async () => {
        Titulo.findOne.mockResolvedValue({ titulo: "Avatar" });

        const res = await request(app)
            .post("/titulos")
            .set(cabecalhoAuth)
            .send({ titulo: "Avatar", tipo: "Filme", nota: 8, status: "Assistido" });

        expect(res.status).toBe(409);
        expect(res.body.erro).toContain("Avatar");
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(app)
            .post("/titulos")
            .set(cabecalhoAuth)
            .send({ titulo: "Teste", tipo: "Filme", nota: 8, status: "Assistido" });

        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /titulos
// ────────────────────────────────────────────────────────────────────────────
describe("GET /titulos", () => {
    test("deve listar os títulos da pessoa logada", async () => {
        const mock = [
            { _id: "1", titulo: "Inception", tipo: "Filme", nota: 9, codigoUrl: "cod1" },
            { _id: "2", titulo: "Breaking Bad", tipo: "Série", nota: 10, codigoUrl: "cod2" }
        ];
        Titulo.find.mockResolvedValue(mock);

        const res = await request(app).get("/titulos").set(cabecalhoAuth);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(Titulo.find).toHaveBeenCalledWith(
            expect.objectContaining({ usuarioId: usuarioIdFalso })
        );
    });

    test("deve aplicar filtro por tipo", async () => {
        Titulo.find.mockResolvedValue([{ _id: "1", titulo: "Inception", tipo: "Filme", nota: 9, codigoUrl: "cod1" }]);

        const res = await request(app).get("/titulos?tipo=Filme").set(cabecalhoAuth);

        expect(res.status).toBe(200);
        expect(Titulo.find).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: expect.objectContaining({ $regex: "^Filme$" }) })
        );
    });

    test("deve aplicar filtro por busca", async () => {
        Titulo.find.mockResolvedValue([{ _id: "1", titulo: "Inception", tipo: "Filme", nota: 9, codigoUrl: "cod1" }]);

        const res = await request(app).get("/titulos?busca=inc").set(cabecalhoAuth);

        expect(res.status).toBe(200);
        expect(Titulo.find).toHaveBeenCalledWith(
            expect.objectContaining({ titulo: expect.objectContaining({ $regex: "inc" }) })
        );
    });

    test("deve gerar e salvar codigoUrl em títulos antigos que não têm esse campo", async () => {
        Titulo.findOne.mockResolvedValue(null); // uniqueness check dentro de gerarCodigoUrlUnico
        const salvarMock = jest.fn().mockResolvedValue();
        Titulo.find.mockResolvedValue([
            { _id: "1", titulo: "Título Antigo", tipo: "Filme", nota: 9, codigoUrl: undefined, save: salvarMock }
        ]);

        const res = await request(app).get("/titulos").set(cabecalhoAuth);

        expect(res.status).toBe(200);
        expect(salvarMock).toHaveBeenCalled();
        expect(res.body[0].codigoUrl).toBeDefined();
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.find.mockRejectedValue(new Error("DB error"));

        const res = await request(app).get("/titulos").set(cabecalhoAuth);
        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /titulos/:id
// ────────────────────────────────────────────────────────────────────────────
describe("GET /titulos/:id", () => {
    test("deve retornar um único título", async () => {
        Titulo.findOne.mockResolvedValue({ _id: "123", titulo: "Duna", tipo: "Filme", nota: 9 });

        const res = await request(app).get("/titulos/123").set(cabecalhoAuth);

        expect(res.status).toBe(200);
        expect(res.body.titulo).toBe("Duna");
    });

    test("deve retornar 404 se o título não existir (ou não for da pessoa logada)", async () => {
        Titulo.findOne.mockResolvedValue(null);

        const res = await request(app).get("/titulos/000").set(cabecalhoAuth);

        expect(res.status).toBe(404);
        expect(res.body.erro).toBeDefined();
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(app).get("/titulos/123").set(cabecalhoAuth);
        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// PUT /titulos/:id
// ────────────────────────────────────────────────────────────────────────────
describe("PUT /titulos/:id", () => {
    test("deve editar título com sucesso", async () => {
        Titulo.findOne.mockResolvedValue(null);
        Titulo.findOneAndUpdate.mockResolvedValue({ _id: "123", titulo: "Inception", nota: 10 });

        const res = await request(app)
            .put("/titulos/123")
            .set(cabecalhoAuth)
            .send({ titulo: "Inception", tipo: "Filme", nota: 10, status: "Assistido" });

        expect(res.status).toBe(200);
        expect(res.body.nota).toBe(10);
    });

    test("deve rejeitar nota inválida na edição", async () => {
        const res = await request(app)
            .put("/titulos/123")
            .set(cabecalhoAuth)
            .send({ titulo: "Inception", tipo: "Filme", nota: 15, status: "Assistido" });

        expect(res.status).toBe(400);
    });

    test("deve rejeitar duplicata na edição", async () => {
        Titulo.findOne.mockResolvedValue({ _id: "outro", titulo: "Avatar" });

        const res = await request(app)
            .put("/titulos/123")
            .set(cabecalhoAuth)
            .send({ titulo: "Avatar", tipo: "Filme", nota: 8, status: "Assistido" });

        expect(res.status).toBe(409);
    });

    test("deve retornar 404 se o título não existir (ou não for da pessoa logada)", async () => {
        Titulo.findOne.mockResolvedValue(null);
        Titulo.findOneAndUpdate.mockResolvedValue(null);

        const res = await request(app)
            .put("/titulos/123")
            .set(cabecalhoAuth)
            .send({ titulo: "Inception", tipo: "Filme", nota: 9, status: "Assistido" });

        expect(res.status).toBe(404);
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(app)
            .put("/titulos/123")
            .set(cabecalhoAuth)
            .send({ titulo: "Inception", tipo: "Filme", nota: 9, status: "Assistido" });

        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /titulos/:id/favorito
// ────────────────────────────────────────────────────────────────────────────
describe("PATCH /titulos/:id/favorito", () => {
    test("deve marcar como favorito com sucesso", async () => {
        Titulo.findOneAndUpdate.mockResolvedValue({ _id: "123", favorito: true });

        const res = await request(app)
            .patch("/titulos/123/favorito")
            .set(cabecalhoAuth)
            .send({ favorito: true });

        expect(res.status).toBe(200);
        expect(res.body.favorito).toBe(true);
    });

    test("deve retornar 404 se o título não existir (ou não for da pessoa logada)", async () => {
        Titulo.findOneAndUpdate.mockResolvedValue(null);

        const res = await request(app)
            .patch("/titulos/000/favorito")
            .set(cabecalhoAuth)
            .send({ favorito: true });

        expect(res.status).toBe(404);
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findOneAndUpdate.mockRejectedValue(new Error("DB error"));

        const res = await request(app)
            .patch("/titulos/123/favorito")
            .set(cabecalhoAuth)
            .send({ favorito: true });

        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /titulos/:id
// ────────────────────────────────────────────────────────────────────────────
describe("DELETE /titulos/:id", () => {
    test("deve remover título com sucesso", async () => {
        Titulo.findOneAndDelete.mockResolvedValue({ _id: "123" });

        const res = await request(app).delete("/titulos/123").set(cabecalhoAuth);

        expect(res.status).toBe(200);
        expect(res.body.mensagem).toBe("Título removido");
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findOneAndDelete.mockRejectedValue(new Error("DB error"));

        const res = await request(app).delete("/titulos/123").set(cabecalhoAuth);
        expect(res.status).toBe(500);
    });
});
