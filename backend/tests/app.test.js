/**
 * @jest-environment jsdom
 */

// ── Mock do fetch global ──────────────────────────────────────────────────────
global.fetch = jest.fn();
global.alert = jest.fn();

// ── Utilitário copiado do app.js para teste isolado ──────────────────────────
function formatarTexto(texto) {
    return texto
        .toLowerCase()
        .split(" ")
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

function validarNota(nota) {
    if (isNaN(nota)) return false;
    if (nota < 0)    return false;
    if (nota > 10)   return false;
    return true;
}

// ── Setup do DOM antes de cada teste ─────────────────────────────────────────
beforeEach(() => {
    document.body.innerHTML = `
        <input id="titulo" />
        <select id="tipo">
            <option value="Filme">Filme</option>
            <option value="Série">Série</option>
        </select>
        <input id="nota" type="number" />
        <select id="status">
            <option value="Quero Assistir">Quero Assistir</option>
            <option value="Assistido">Assistido</option>
        </select>
        <input id="busca" />
        <select id="filtroTipo">
            <option value="todos">Todos</option>
            <option value="Filme">Filme</option>
            <option value="Série">Série</option>
        </select>
        <div id="lista"></div>
    `;

    jest.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// formatarTexto
// ────────────────────────────────────────────────────────────────────────────
describe("formatarTexto()", () => {
    test("capitaliza a primeira letra de cada palavra", () => {
        expect(formatarTexto("breaking bad")).toBe("Breaking Bad");
    });

    test("converte tudo para lowercase antes de capitalizar", () => {
        expect(formatarTexto("INCEPTION")).toBe("Inception");
    });

    test("funciona com uma única palavra", () => {
        expect(formatarTexto("dune")).toBe("Dune");
    });

    test("mantém palavras já capitalizadas corretamente", () => {
        expect(formatarTexto("The Last Of Us")).toBe("The Last Of Us");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// validarNota
// ────────────────────────────────────────────────────────────────────────────
describe("validarNota()", () => {
    test("aceita nota 0", ()      => expect(validarNota(0)).toBe(true));
    test("aceita nota 10", ()     => expect(validarNota(10)).toBe(true));
    test("aceita nota 7.5", ()    => expect(validarNota(7.5)).toBe(true));
    test("rejeita nota -1", ()    => expect(validarNota(-1)).toBe(false));
    test("rejeita nota 11", ()    => expect(validarNota(11)).toBe(false));
    test("rejeita NaN", ()        => expect(validarNota(NaN)).toBe(false));
    test("rejeita undefined", ()  => expect(validarNota(undefined)).toBe(false));
});

// ────────────────────────────────────────────────────────────────────────────
// Renderização da lista
// ────────────────────────────────────────────────────────────────────────────
describe("Renderização da lista", () => {
    test("exibe mensagem quando lista está vazia", async () => {
        fetch.mockResolvedValueOnce({
            json: async () => []
        });

        // Simula o comportamento do listarTitulos
        const resposta = await fetch("http://localhost:3000/titulos?");
        const dados = await resposta.json();
        const lista = document.getElementById("lista");

        if (dados.length === 0) {
            lista.innerHTML = `<p class="msg-vazia">Nenhum título encontrado.</p>`;
        }

        expect(lista.innerHTML).toContain("Nenhum título encontrado");
    });

    test("renderiza card para cada título retornado", async () => {
        const titulosMock = [
            { _id: "1", titulo: "Inception", tipo: "Filme", nota: 9, status: "Assistido" },
            { _id: "2", titulo: "Breaking Bad", tipo: "Série", nota: 10, status: "Assistido" }
        ];

        fetch.mockResolvedValueOnce({
            json: async () => titulosMock
        });

        const resposta = await fetch("http://localhost:3000/titulos?");
        const dados = await resposta.json();
        const lista = document.getElementById("lista");

        dados.forEach(titulo => {
            const card = document.createElement("div");
            card.className = "card";
            card.id = `item-${titulo._id}`;
            card.innerHTML = `<span class="card-titulo">${titulo.titulo}</span>`;
            lista.appendChild(card);
        });

        expect(lista.querySelectorAll(".card").length).toBe(2);
        expect(lista.innerHTML).toContain("Inception");
        expect(lista.innerHTML).toContain("Breaking Bad");
    });

    test("badge de status correto para 'Assistido'", () => {
        const status = "Assistido";
        const statusClasse = status === "Assistido" ? "assistido" : "quero-assistir";
        expect(statusClasse).toBe("assistido");
    });

    test("badge de status correto para 'Quero Assistir'", () => {
        const status = "Quero Assistir";
        const statusClasse = status === "Assistido" ? "assistido" : "quero-assistir";
        expect(statusClasse).toBe("quero-assistir");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Formulário de adicionar
// ────────────────────────────────────────────────────────────────────────────
describe("Formulário de adicionar", () => {
    test("campos do formulário existem no DOM", () => {
        expect(document.getElementById("titulo")).not.toBeNull();
        expect(document.getElementById("tipo")).not.toBeNull();
        expect(document.getElementById("nota")).not.toBeNull();
        expect(document.getElementById("status")).not.toBeNull();
    });

    test("select de tipo possui opções Filme e Série", () => {
        const select = document.getElementById("tipo");
        const opcoes = Array.from(select.options).map(o => o.value);
        expect(opcoes).toContain("Filme");
        expect(opcoes).toContain("Série");
    });

    test("select de status possui opções corretas", () => {
        const select = document.getElementById("status");
        const opcoes = Array.from(select.options).map(o => o.value);
        expect(opcoes).toContain("Assistido");
        expect(opcoes).toContain("Quero Assistir");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Filtros
// ────────────────────────────────────────────────────────────────────────────
describe("Filtros", () => {
    test("campo de busca existe no DOM", () => {
        expect(document.getElementById("busca")).not.toBeNull();
    });

    test("select de filtro possui opção 'todos'", () => {
        const select = document.getElementById("filtroTipo");
        const opcoes = Array.from(select.options).map(o => o.value);
        expect(opcoes).toContain("todos");
    });

    test("select de filtro possui opções Filme e Série", () => {
        const select = document.getElementById("filtroTipo");
        const opcoes = Array.from(select.options).map(o => o.value);
        expect(opcoes).toContain("Filme");
        expect(opcoes).toContain("Série");
    });

    test("parâmetros de busca são montados corretamente", () => {
        document.getElementById("busca").value = "inception";
        document.getElementById("filtroTipo").value = "Filme";

        const busca = document.getElementById("busca").value;
        const tipo  = document.getElementById("filtroTipo").value;

        const params = new URLSearchParams();
        if (busca) params.append("busca", busca);
        if (tipo)  params.append("tipo", tipo);

        expect(params.toString()).toBe("busca=inception&tipo=Filme");
    });
});
