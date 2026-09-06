// ── Listar títulos (com filtro e busca) ──────────────────────────────────────
async function listarTitulos() {
    const busca = document.getElementById("busca").value;
    const tipo  = document.getElementById("filtroTipo").value;

    const params = new URLSearchParams();
    if (busca) params.append("busca", busca);
    if (tipo)  params.append("tipo", tipo);

    try {
        // CORREÇÃO
        const resposta = await fetch(`http://localhost:3000/titulos?${params}`);
        const dados    = await resposta.json();

        const lista = document.getElementById("lista");
        lista.innerHTML = "";

        if (dados.length === 0) {
            lista.innerHTML = `<p class="msg-vazia">Nenhum título encontrado.</p>`;
            return;
        }

        dados.forEach(titulo => {
            const status       = titulo.status || "Quero Assistir";
            const statusClasse = status === "Assistido" ? "assistido" : "quero-assistir";

            const card = document.createElement("div");
            card.className = "card";
            card.id = `item-${titulo._id}`;

            
            card.innerHTML = `
            <div class="card-info">
                <span class="card-titulo">${titulo.titulo}</span>
                <span class="badge-tipo">${titulo.tipo}</span>
                <span class="badge-nota">${titulo.nota}</span>
                <span class="badge-status ${statusClasse}">${status}</span>
                <div class="card-acoes">
                    <button class="btn-editar"
                        data-id="${titulo._id}"
                        data-titulo="${titulo.titulo.replace(/"/g, '&quot;')}"
                        data-tipo="${titulo.tipo}"
                        data-nota="${titulo.nota}"
                        data-status="${status}">Editar</button>
                    <button class="btn-excluir" data-id="${titulo._id}">Excluir</button>
                </div>
            </div>

            <div class="form-edicao" id="form-edicao-${titulo._id}" style="display:none;">
                <input id="edit-titulo-${titulo._id}"  type="text"   placeholder="Título" />
                <select id="edit-tipo-${titulo._id}">
                    <option value="Filme">Filme</option>
                    <option value="Série">Série</option>
                </select>
                <input id="edit-nota-${titulo._id}"    type="number" placeholder="Nota (0-10)" min="0" max="10" step="0.1" />
                <select id="edit-status-${titulo._id}">
                    <option value="Assistido">Assistido</option>
                    <option value="Quero Assistir">Quero Assistir</option>
                </select>
                <button class="btn-confirmar" data-id="${titulo._id}" data-action="salvar">Salvar</button>
                <button class="btn-cancelar"  data-id="${titulo._id}" data-action="cancelar">Cancelar</button>
            </div>
            `;

            lista.appendChild(card);

            // Eventos via addEventListener — sem onclick inline
            card.querySelector(".btn-editar").addEventListener("click", (e) => {
                const btn = e.currentTarget;
                mostrarEdicao(btn.dataset.id, btn.dataset.titulo, btn.dataset.tipo, btn.dataset.nota, btn.dataset.status);
            });

            card.querySelector(".btn-excluir").addEventListener("click", (e) => {
                excluir(e.currentTarget.dataset.id);
            });

            card.querySelector("[data-action='salvar']").addEventListener("click", (e) => {
                salvarEdicao(e.currentTarget.dataset.id);
            });

            card.querySelector("[data-action='cancelar']").addEventListener("click", (e) => {
                cancelarEdicao(e.currentTarget.dataset.id);
            });
        });

    } catch (err) {
        alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
    }
}

// ── Validação de nota ─────────────────────────────────────────────────────────
function validarNota(nota) {
    if (isNaN(nota)) {
        alert("Por favor, insira uma nota válida.");
        return false;
    }
    if (nota < 0) {
        alert("A nota não pode ser negativa.");
        return false;
    }
    if (nota > 10) {
        alert("A nota não pode ser maior que 10.");
        return false;
    }
    return true;
}

// ── Adicionar ────────────────────────────────────────────────────────────────
async function adicionar() {
    try {
        const titulo = formatarTexto(document.getElementById("titulo").value);
        const tipo   = document.getElementById("tipo").value;
        const nota   = parseFloat(document.getElementById("nota").value);
        const status = document.getElementById("status").value;

        if (!validarNota(nota)) return;

        const resposta = await fetch("http://localhost:3000/titulos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titulo, tipo, nota, status })
        });

        if (resposta.status === 409) {
            const dados = await resposta.json();
            alert(dados.erro);
            return;
        }

        if (resposta.status === 400) {
            const dados = await resposta.json();
            alert(dados.erro);
            return;
        }

        document.getElementById("titulo").value = "";
        document.getElementById("nota").value   = "";
        document.getElementById("tipo").value   = "Filme";
        document.getElementById("status").value = "Quero Assistir";

        listarTitulos();
    } catch (err) {
        alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
    }
}

// ── Editar ───────────────────────────────────────────────────────────────────
function mostrarEdicao(id, titulo, tipo, nota, status) {
    document.getElementById(`form-edicao-${id}`).style.display = "grid";
    document.getElementById(`edit-titulo-${id}`).value  = titulo;
    document.getElementById(`edit-tipo-${id}`).value    = tipo;
    document.getElementById(`edit-nota-${id}`).value    = nota;
    document.getElementById(`edit-status-${id}`).value  = status;
}

function cancelarEdicao(id) {
    document.getElementById(`form-edicao-${id}`).style.display = "none";
}

async function salvarEdicao(id) {
    try {
        const titulo = formatarTexto(document.getElementById(`edit-titulo-${id}`).value);
        const tipo   = document.getElementById(`edit-tipo-${id}`).value;
        const nota   = parseFloat(document.getElementById(`edit-nota-${id}`).value);
        const status = document.getElementById(`edit-status-${id}`).value;

        if (!validarNota(nota)) return;

        const resposta = await fetch(`http://localhost:3000/titulos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ titulo, tipo, nota, status })
        });

        if (resposta.status === 409) {
            const dados = await resposta.json();
            alert(dados.erro);
            return;
        }

        if (resposta.status === 400) {
            const dados = await resposta.json();
            alert(dados.erro);
            return;
        }

        listarTitulos();
    } catch (err) {
        alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
    }
}

// ── Excluir ──────────────────────────────────────────────────────────────────
async function excluir(id) {
    try {
        await fetch(`http://localhost:3000/titulos/${id}`, { method: "DELETE" });
        listarTitulos();
    } catch (err) {
        alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
    }
}

// ── Utilitários ──────────────────────────────────────────────────────────────
function formatarTexto(texto) {
    return texto
        .toLowerCase()
        .split(" ")
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

listarTitulos();
