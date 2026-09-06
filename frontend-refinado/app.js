// ── Configuração da API ────────────────────────────────────────────────────────
// Quando a página é aberta direto do disco (file://), assume que o backend
// está rodando local na porta 3000 — fluxo de desenvolvimento de sempre.
// Quando a página é servida pelo próprio backend (produção, ex: Render, já
// que o Express também serve esses arquivos estáticos), usa a mesma origem
// — não precisa trocar essa URL manualmente ao hospedar.
const API_URL = location.protocol === "file:" ? "http://localhost:3000" : "";

// ── Autocomplete de filmes/séries (TMDb) ──────────────────────────────────────
// Pôster, ano e detalhes (sinopse/gênero/diretor) escolhidos no autocomplete,
// aguardando ser enviados junto do próximo "Salvar". Qualquer edição manual
// no campo Título invalida a seleção.
let posterSelecionado = null;
let anoSelecionado = null;
let descricaoSelecionada = null;
let generoSelecionado = null;
let diretorSelecionado = null;
let tmdbIdSelecionado = null;
let debounceBusca;

document.getElementById("titulo").addEventListener("input", (e) => {
    posterSelecionado = null;
    anoSelecionado = null;
    descricaoSelecionada = null;
    generoSelecionado = null;
    diretorSelecionado = null;
    tmdbIdSelecionado = null;
    const termo = e.target.value.trim();
    const caixa = document.getElementById("sugestoes");

    clearTimeout(debounceBusca);

    if (termo.length < 2) {
        caixa.innerHTML = "";
        return;
    }

    debounceBusca = setTimeout(async () => {
        try {
            const resposta   = await fetch(`${API_URL}/buscar-filme?q=${encodeURIComponent(termo)}`);
            const sugestoes  = await resposta.json();
            renderizarSugestoes(sugestoes);
        } catch (err) {
            caixa.innerHTML = "";
        }
    }, 400);
});

// Fecha a lista de sugestões ao clicar fora dela
document.addEventListener("click", (e) => {
    if (!e.target.closest(".campo-titulo")) {
        document.getElementById("sugestoes").innerHTML = "";
    }
});

function renderizarSugestoes(sugestoes) {
    const caixa = document.getElementById("sugestoes");

    if (!sugestoes || sugestoes.length === 0) {
        caixa.innerHTML = "";
        return;
    }

    caixa.innerHTML = sugestoes.map((s, i) => `
        <div class="sugestao-item" data-index="${i}">
            ${s.poster
                ? `<img src="${s.poster}" alt="">`
                : `<div class="sugestao-sem-poster">🎬</div>`}
            <div class="sugestao-info">
                <span class="sugestao-titulo">${s.titulo}</span>
                <span class="sugestao-meta">${s.tipo}${s.ano ? " · " + s.ano : ""}</span>
            </div>
        </div>
    `).join("");

    caixa.querySelectorAll(".sugestao-item").forEach((el, i) => {
        el.addEventListener("click", () => selecionarSugestao(sugestoes[i]));
    });
}

function selecionarSugestao(s) {
    document.getElementById("titulo").value = s.titulo;
    document.getElementById("tipo").value    = s.tipo;
    posterSelecionado = s.posterGrande || s.poster || null;
    anoSelecionado    = s.ano || null;
    tmdbIdSelecionado = s.tmdbId || null;
    document.getElementById("sugestoes").innerHTML = "";

    // Busca sinopse/gênero/diretor em segundo plano — não trava o formulário,
    // só preenche esses campos quando a resposta chegar (o usuário ainda
    // está escolhendo nota/status nesse meio-tempo).
    descricaoSelecionada = null;
    generoSelecionado = null;
    diretorSelecionado = null;

    if (s.tmdbId) {
        buscarDetalhesFilme(s.tmdbId, s.tipo);
    }
}

// ── Preenchimento automático quando o título é digitado sem usar o
// autocomplete (ex: a pessoa digita o nome inteiro e aperta Salvar direto).
// Faz a mesma busca que o autocomplete faria, usando o texto já digitado,
// e só aplica o resultado se casar exatamente com o título — evita colar
// pôster/sinopse de um filme errado num título parecido mas diferente.
async function tentarPreencherAutomaticamente(titulo, tipo) {
    try {
        const resposta  = await fetch(`${API_URL}/buscar-filme?q=${encodeURIComponent(titulo)}`);
        const sugestoes = await resposta.json();
        if (!sugestoes || sugestoes.length === 0) return;

        const correspondencia =
            sugestoes.find(s => s.titulo.toLowerCase() === titulo.toLowerCase() && s.tipo === tipo) ||
            sugestoes.find(s => s.titulo.toLowerCase() === titulo.toLowerCase());

        if (!correspondencia) return;

        posterSelecionado = correspondencia.posterGrande || correspondencia.poster || null;
        anoSelecionado    = correspondencia.ano || null;
        tmdbIdSelecionado = correspondencia.tmdbId || null;

        if (correspondencia.tmdbId) {
            await buscarDetalhesFilme(correspondencia.tmdbId, correspondencia.tipo);
        }
    } catch (err) {
        // Preenchimento automático é complementar — se falhar, o título
        // ainda é salvo normalmente, só sem pôster/sinopse/gênero/diretor.
    }
}

async function buscarDetalhesFilme(tmdbId, tipo) {
    try {
        const resposta = await fetch(`${API_URL}/detalhes-filme?tmdbId=${tmdbId}&tipo=${encodeURIComponent(tipo)}`);
        const dados = await resposta.json();
        descricaoSelecionada = dados.descricao || null;
        generoSelecionado    = dados.genero || null;
        diretorSelecionado   = dados.diretor || null;
    } catch (err) {
        // Sinopse/gênero/diretor são complementares — se falhar, o título
        // ainda pode ser salvo normalmente, só sem essas informações extras.
    }
}

// ── Ordenação da lista (aplicada no cliente, depois do filtro/busca) ─────────
function ordenarTitulos(dados, criterio) {
    const lista = [...dados];

    switch (criterio) {
        case "nome-asc":
            return lista.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
        case "nome-desc":
            return lista.sort((a, b) => b.titulo.localeCompare(a.titulo, "pt-BR"));
        case "ano-desc":
            return lista.sort((a, b) => (b.ano || "0") - (a.ano || "0"));
        case "ano-asc":
            return lista.sort((a, b) => (a.ano || "0") - (b.ano || "0"));
        default:
            return lista;
    }
}

// ── Listar títulos (com filtro, busca e ordenação) ───────────────────────────
async function listarTitulos() {
    const busca = document.getElementById("busca").value;
    const tipo  = document.getElementById("filtroTipo").value;
    const ordem = document.getElementById("ordenarPor").value;

    const params = new URLSearchParams();
    if (busca) params.append("busca", busca);
    if (tipo)  params.append("tipo", tipo);

    try {
        const resposta = await fetch(`${API_URL}/titulos?${params}`);
        let dados = await resposta.json();
        dados = ordenarTitulos(dados, ordem);

        atualizarStats(dados);

        // Favoritar é "fixar em destaque", não mover: o título continua
        // aparecendo normalmente aqui embaixo (com editar/excluir/filtro),
        // só ganha também uma cópia no carrossel de destaque acima.
        renderizarDestaque(dados.filter(t => t.favorito));

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
                ${titulo.poster
                    ? `<img class="card-poster" src="${titulo.poster}" alt="">`
                    : `<div class="card-poster card-poster-vazio">🎬</div>`}
                <span class="card-titulo"><a href="detalhe.html?id=${titulo._id}">${titulo.titulo}</a>${titulo.ano ? ` <span class="card-ano">(${titulo.ano})</span>` : ""}</span>
                <span class="badge-tipo">${titulo.tipo}</span>
                <span class="badge-nota">${titulo.nota}</span>
                <span class="badge-status ${statusClasse}">${status}</span>
                <div class="card-acoes">
                    <button class="btn-favorito ${titulo.favorito ? "ativo" : ""}"
                        data-id="${titulo._id}"
                        data-favorito="${!!titulo.favorito}"
                        title="${titulo.favorito ? "Remover dos favoritos" : "Marcar como favorito"}">${titulo.favorito ? "★" : "☆"}</button>
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
                <div class="campo">
                    <label for="edit-titulo-${titulo._id}">Título</label>
                    <input id="edit-titulo-${titulo._id}" type="text" placeholder="Título" />
                </div>
                <div class="campo">
                    <label for="edit-tipo-${titulo._id}">Tipo</label>
                    <select id="edit-tipo-${titulo._id}">
                        <option value="Filme">Filme</option>
                        <option value="Série">Série</option>
                    </select>
                </div>
                <div class="campo">
                    <label for="edit-nota-${titulo._id}">Nota</label>
                    <input id="edit-nota-${titulo._id}" type="number" placeholder="0 a 10" min="0" max="10" step="0.1" />
                </div>
                <div class="campo">
                    <label for="edit-status-${titulo._id}">Status</label>
                    <select id="edit-status-${titulo._id}">
                        <option value="Assistido">Assistido</option>
                        <option value="Quero Assistir">Quero Assistir</option>
                    </select>
                </div>
                <button class="btn-confirmar" data-id="${titulo._id}" data-action="salvar">Salvar</button>
                <button class="btn-cancelar"  data-id="${titulo._id}" data-action="cancelar">Cancelar</button>
            </div>
            `;

            lista.appendChild(card);

            // Eventos via addEventListener — sem onclick inline
            card.querySelector(".btn-favorito").addEventListener("click", (e) => {
                const jaFavorito = e.currentTarget.dataset.favorito === "true";
                marcarFavorito(e.currentTarget.dataset.id, !jaFavorito);
            });

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

// ── Favoritos em destaque (carrossel isolado, arrasta com o mouse) ───────────
function renderizarDestaque(favoritos) {
    const secao   = document.getElementById("secao-destaque");
    const carrossel = document.getElementById("carrossel-favoritos");

    if (!favoritos || favoritos.length === 0) {
        secao.hidden = true;
        carrossel.innerHTML = "";
        return;
    }

    carrossel.innerHTML = favoritos.map(titulo => `
        <div class="favorito-card">
            ${titulo.poster
                ? `<img src="${titulo.poster}" alt="">`
                : `<div class="favorito-poster-vazio">🎬</div>`}
            <button class="btn-remover-favorito-mini" data-id="${titulo._id}" title="Remover dos favoritos">★</button>
            <div class="favorito-card-info">
                <span class="favorito-card-titulo"><a href="detalhe.html?id=${titulo._id}">${titulo.titulo}</a></span>
                <span class="favorito-card-nota">${titulo.ano ? titulo.ano + " · " : ""}★ ${titulo.nota}</span>
            </div>
        </div>
    `).join("");

    secao.hidden = false;
}

async function marcarFavorito(id, valor) {
    try {
        await fetch(`${API_URL}/titulos/${id}/favorito`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ favorito: valor })
        });
        listarTitulos();
    } catch (err) {
        alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
    }
}

// ── Arrastar o carrossel de favoritos com o mouse ─────────────────────────────
(function configurarArrasteCarrossel() {
    const carrossel = document.getElementById("carrossel-favoritos");
    let arrastando = false;
    let arrastou    = false;
    let comecouX    = 0;
    let scrollInicial = 0;

    carrossel.addEventListener("mousedown", (e) => {
        arrastando = true;
        arrastou   = false;
        comecouX   = e.pageX;
        scrollInicial = carrossel.scrollLeft;
        carrossel.classList.add("arrastando");
    });

    window.addEventListener("mousemove", (e) => {
        if (!arrastando) return;
        const delta = e.pageX - comecouX;
        if (Math.abs(delta) > 5) arrastou = true;
        carrossel.scrollLeft = scrollInicial - delta;
    });

    window.addEventListener("mouseup", () => {
        arrastando = false;
        carrossel.classList.remove("arrastando");
    });

    // Clique nos botões (remover dos favoritos) logo após um arraste é ignorado,
    // pra não remover sem querer enquanto o usuário só está navegando no carrossel.
    carrossel.addEventListener("click", (e) => {
        if (arrastou) {
            e.stopPropagation();
            return;
        }
        const btn = e.target.closest(".btn-remover-favorito-mini");
        if (btn) marcarFavorito(btn.dataset.id, false);
    });
})();

// ── Contador de títulos ────────────────────────────────────────────────────────
function atualizarStats(dados) {
    const stats = document.getElementById("stats");
    const total = dados.length;

    if (total === 0) {
        stats.textContent = "Nenhum título cadastrado ainda.";
        return;
    }

    const assistidos = dados.filter(t => t.status === "Assistido").length;
    stats.textContent = `${total} título${total === 1 ? "" : "s"} · ${assistidos} assistido${assistidos === 1 ? "" : "s"}`;
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
    const btn = document.querySelector(".btn-salvar");

    try {
        const titulo = formatarTexto(document.getElementById("titulo").value);
        const tipo   = document.getElementById("tipo").value;
        const nota   = parseFloat(document.getElementById("nota").value);
        const status = document.getElementById("status").value;

        if (!validarNota(nota)) return;

        btn.disabled = true;
        btn.textContent = "Salvando...";

        // Se o título foi digitado à mão (sem escolher uma sugestão do
        // autocomplete), tenta preencher pôster/ano/sinopse/gênero/diretor
        // automaticamente antes de salvar.
        if (!tmdbIdSelecionado) {
            await tentarPreencherAutomaticamente(titulo, tipo);
        }

        const resposta = await fetch(`${API_URL}/titulos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                titulo, tipo, nota, status,
                poster: posterSelecionado,
                ano: anoSelecionado,
                descricao: descricaoSelecionada,
                genero: generoSelecionado,
                diretor: diretorSelecionado
            })
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
        document.getElementById("sugestoes").innerHTML = "";
        posterSelecionado = null;
        anoSelecionado = null;
        descricaoSelecionada = null;
        generoSelecionado = null;
        diretorSelecionado = null;
        tmdbIdSelecionado = null;

        listarTitulos();
    } catch (err) {
        alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar";
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
    const btn = document.querySelector(`#form-edicao-${id} .btn-confirmar`);

    try {
        const titulo = formatarTexto(document.getElementById(`edit-titulo-${id}`).value);
        const tipo   = document.getElementById(`edit-tipo-${id}`).value;
        const nota   = parseFloat(document.getElementById(`edit-nota-${id}`).value);
        const status = document.getElementById(`edit-status-${id}`).value;

        if (!validarNota(nota)) return;

        btn.disabled = true;
        btn.textContent = "Salvando...";

        const resposta = await fetch(`${API_URL}/titulos/${id}`, {
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
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar";
    }
}

// ── Excluir ──────────────────────────────────────────────────────────────────
async function excluir(id) {
    if (!confirm("Tem certeza que deseja excluir este título? Essa ação não pode ser desfeita.")) {
        return;
    }

    try {
        await fetch(`${API_URL}/titulos/${id}`, { method: "DELETE" });
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
