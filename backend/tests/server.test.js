const request = require("supertest");
const mongoose = require("mongoose");

// ── Mock do modelo Titulo ─────────────────────────────────────────────────────
jest.mock("../models/Titulo");
const Titulo = require("../models/Titulo");
const app = require("../server");

afterEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

// ────────────────────────────────────────────────────────────────────────────
// POST /titulos
// ────────────────────────────────────────────────────────────────────────────
describe("POST /titulos", () => {
    test("deve adicionar um título com sucesso", async () => {
        Titulo.findOne.mockResolvedValue(null);
        Titulo.prototype.save = jest.fn().mockResolvedValue();
        Titulo.mockImplementation((data) => ({ ...data, _id: "abc123", save: jest.fn().mockResolvedValue() }));

        const res = await request(app)
            .post("/titulos")
            .send({ titulo: "Inception", tipo: "Filme", nota: 9, status: "Assistido" });

        expect(res.status).toBe(200);
        expect(res.body.titulo).toBe("Inception");
    });

    test("deve rejeitar nota maior que 10", async () => {
        const res = await request(app)
            .post("/titulos")
            .send({ titulo: "Teste", tipo: "Filme", nota: 11, status: "Assistido" });

        expect(res.status).toBe(400);
        expect(res.body.erro).toBeDefined();
    });

    test("deve rejeitar nota negativa", async () => {
        const res = await request(app)
            .post("/titulos")
            .send({ titulo: "Teste", tipo: "Filme", nota: -1, status: "Assistido" });

        expect(res.status).toBe(400);
        expect(res.body.erro).toBeDefined();
    });

    test("deve rejeitar nota NaN", async () => {
        const res = await request(app)
            .post("/titulos")
            .send({ titulo: "Teste", tipo: "Filme", nota: "abc", status: "Assistido" });

        expect(res.status).toBe(400);
    });

    test("deve rejeitar título duplicado", async () => {
        Titulo.findOne.mockResolvedValue({ titulo: "Avatar" });

        const res = await request(app)
            .post("/titulos")
            .send({ titulo: "Avatar", tipo: "Filme", nota: 8, status: "Assistido" });

        expect(res.status).toBe(409);
        expect(res.body.erro).toContain("Avatar");
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(app)
            .post("/titulos")
            .send({ titulo: "Teste", tipo: "Filme", nota: 8, status: "Assistido" });

        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /titulos
// ────────────────────────────────────────────────────────────────────────────
describe("GET /titulos", () => {
    test("deve listar todos os títulos", async () => {
        const mock = [
            { _id: "1", titulo: "Inception", tipo: "Filme", nota: 9 },
            { _id: "2", titulo: "Breaking Bad", tipo: "Série", nota: 10 }
        ];
        Titulo.find.mockResolvedValue(mock);

        const res = await request(app).get("/titulos");

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    test("deve aplicar filtro por tipo", async () => {
        Titulo.find.mockResolvedValue([{ _id: "1", titulo: "Inception", tipo: "Filme", nota: 9 }]);

        const res = await request(app).get("/titulos?tipo=Filme");

        expect(res.status).toBe(200);
        expect(Titulo.find).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: expect.objectContaining({ $regex: "^Filme$" }) })
        );
    });

    test("deve aplicar filtro por busca", async () => {
        Titulo.find.mockResolvedValue([{ _id: "1", titulo: "Inception", tipo: "Filme", nota: 9 }]);

        const res = await request(app).get("/titulos?busca=inc");

        expect(res.status).toBe(200);
        expect(Titulo.find).toHaveBeenCalledWith(
            expect.objectContaining({ titulo: expect.objectContaining({ $regex: "inc" }) })
        );
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.find.mockRejectedValue(new Error("DB error"));

        const res = await request(app).get("/titulos");
        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /titulos/:id
// ────────────────────────────────────────────────────────────────────────────
describe("GET /titulos/:id", () => {
    test("deve retornar um único título", async () => {
        Titulo.findById.mockResolvedValue({ _id: "123", titulo: "Duna", tipo: "Filme", nota: 9 });

        const res = await request(app).get("/titulos/123");

        expect(res.status).toBe(200);
        expect(res.body.titulo).toBe("Duna");
    });

    test("deve retornar 404 se o título não existir", async () => {
        Titulo.findById.mockResolvedValue(null);

        const res = await request(app).get("/titulos/000");

        expect(res.status).toBe(404);
        expect(res.body.erro).toBeDefined();
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findById.mockRejectedValue(new Error("DB error"));

        const res = await request(app).get("/titulos/123");
        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// PUT /titulos/:id
// ────────────────────────────────────────────────────────────────────────────
describe("PUT /titulos/:id", () => {
    test("deve editar título com sucesso", async () => {
        Titulo.findOne.mockResolvedValue(null);
        Titulo.findByIdAndUpdate.mockResolvedValue({ _id: "123", titulo: "Inception", nota: 10 });

        const res = await request(app)
            .put("/titulos/123")
            .send({ titulo: "Inception", tipo: "Filme", nota: 10, status: "Assistido" });

        expect(res.status).toBe(200);
        expect(res.body.nota).toBe(10);
    });

    test("deve rejeitar nota inválida na edição", async () => {
        const res = await request(app)
            .put("/titulos/123")
            .send({ titulo: "Inception", tipo: "Filme", nota: 15, status: "Assistido" });

        expect(res.status).toBe(400);
    });

    test("deve rejeitar duplicata na edição", async () => {
        Titulo.findOne.mockResolvedValue({ _id: "outro", titulo: "Avatar" });

        const res = await request(app)
            .put("/titulos/123")
            .send({ titulo: "Avatar", tipo: "Filme", nota: 8, status: "Assistido" });

        expect(res.status).toBe(409);
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(app)
            .put("/titulos/123")
            .send({ titulo: "Inception", tipo: "Filme", nota: 9, status: "Assistido" });

        expect(res.status).toBe(500);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /titulos/:id
// ────────────────────────────────────────────────────────────────────────────
describe("DELETE /titulos/:id", () => {
    test("deve remover título com sucesso", async () => {
        Titulo.findByIdAndDelete.mockResolvedValue({ _id: "123" });

        const res = await request(app).delete("/titulos/123");

        expect(res.status).toBe(200);
        expect(res.body.mensagem).toBe("Título removido");
    });

    test("deve retornar 500 em erro interno", async () => {
        Titulo.findByIdAndDelete.mockRejectedValue(new Error("DB error"));

        const res = await request(app).delete("/titulos/123");
        expect(res.status).toBe(500);
    });
});
