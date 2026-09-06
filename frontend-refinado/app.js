// ── Endereço da API ────────────────────────────────────────────────────────────
// Se a página for aberta direto do computador (arquivo local), usa o
// servidor rodando em localhost. Se estiver hospedada (como no Render), usa
// o mesmo endereço do site — não precisa trocar nada na mão.
const API_URL = location.protocol === "file:" ? "http://localhost:3000" : "";

// Monta o link da página de detalhes: URL bonita ("/detalhe/<código>")
// quando o site está rodando num servidor; formato antigo ("?id=...")
// quando o arquivo é aberto direto do computador, sem servidor por trás.
function linkDetalhe(id) {
    return location.protocol === "file:" ? `detalhe.html?id=${id}` : `/detalhe/${id}`;
}

// ── Login ──────────────────────────────────────────────────────────────────────
// Cada pessoa tem a própria conta. Sem um login salvo, não tem lista pra
// mostrar — então manda direto pra tela de entrar.
const TOKEN_KEY = "cinenote_token";
const NOME_KEY  = "cinenote_nome";
const tokenSalvo = localStorage.getItem(TOKEN_KEY);

if (!tokenSalvo) {
    window.location.href = "login.html";
}

document.getElementById("nome-usuario").textContent = localStorage.getItem(NOME_KEY)
    ? `Olá, ${localStorage.getItem(NOME_KEY)}`
    : "";

document.getElementById("btn-sair").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NOME_KEY);
    window.location.href = "login.html";
});

function cabecalhosAuth() {
    return { "Authorization": `Bearer ${localStorage.getItem(TOKEN_KEY)}` };
}

// Uma versão do fetch que já manda o token de login junto. Se o servidor
// disser que a sessão expirou, manda a pessoa de volta pra tela de entrar,
// em vez de deixar a tela travada sem explicação.
async function fetchAutenticado(url, opcoes = {}) {
    const resposta = await fetch(url, {
        ...opcoes,
        headers: { ...cabecalhosAuth(), ...(opcoes.headers || {}) }
    });

    if (resposta.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(NOME_KEY);
        window.location.href = "login.html";
        throw new Error("Sessão expirada.");
    }

    return resposta;
}

// ── Sugestões de filmes e séries ──────────────────────────────────────────────
// Guarda o pôster, ano e outros detalhes da sugestão escolhida, até a
// pessoa clicar em "Salvar". Se ela mudar o texto do título na mão, essa
// seleção é descartada.
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

    // Busca sinopse, gênero e diretor por trás dos panos — não trava o
    // formulário, só preenche esses campos quando a resposta chegar.
    descricaoSelecionada = null;
    generoSelecionado = null;
    diretorSelecionado = null;

    if (s.tmdbId) {
        buscarDetalhesFilme(s.tmdbId, s.tipo);
    }
}

// ── Preenchimento automático sem usar as sugestões ───────────────────────────
// Se a pessoa digitar o nome inteiro e clicar direto em Salvar (sem
// escolher uma sugestão), faz essa busca por trás dos panos e só usa o
// resultado se o nome bater exatamente — assim não gruda o pôster de um
// filme errado.
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
        // Isso é só um extra — se falhar, o título ainda é salvo
        // normalmente, só sem pôster e sinopse.
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
        // Também é só um extra — se falhar, o título é salvo do mesmo
        // jeito, só sem essas informações a mais.
    }
}

// ── Ordena a lista (feito aqui no navegador, depois do filtro e da busca) ────
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

// ── Mostra a lista de títulos (com filtro, busca e ordenação) ────────────────
async function listarTitulos() {
    const busca = document.getElementById("busca").value;
    const tipo  = document.getElementById("filtroTipo").value;
    const ordem = document.getElementById("ordenarPor").value;

    const params = new URLSearchParams();
    if (busca) params.append("busca", busca);
    if (tipo)  params.append("tipo", tipo);

    try {
        const resposta = await fetchAutenticado(`${API_URL}/titulos?${params}`);
        let dados = await resposta.json();
        dados = ordenarTitulos(dados, ordem);

        atualizarStats(dados);

        // Favoritar não tira o título da lista — ele continua aparecendo
        // normalmente aqui embaixo, só ganha também uma cópia lá em cima,
        // no carrossel de destaque.
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
                <span class="card-titulo"><a href="${linkDetalhe(titulo.codigoUrl || titulo._id)}">${titulo.titulo}</a>${titulo.ano ? ` <span class="card-ano">(${titulo.ano})</span>` : ""}</span>
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

            // Liga os cliques dos botões (sem usar onclick direto no HTML)
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
                <span class="favorito-card-titulo"><a href="${linkDetalhe(titulo.codigoUrl || titulo._id)}">${titulo.titulo}</a></span>
                <span class="favorito-card-nota">${titulo.ano ? titulo.ano + " · " : ""}★ ${titulo.nota}</span>
            </div>
        </div>
    `).join("");

    secao.hidden = false;
}

async function marcarFavorito(id, valor) {
    try {
        await fetchAutenticado(`${API_URL}/titulos/${id}/favorito`, {
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

    // Ignora o clique se a pessoa acabou de arrastar o carrossel — assim
    // não remove um favorito sem querer só por estar navegando.
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

        // Se a pessoa digitou o título na mão (sem escolher uma sugestão),
        // tenta preencher pôster, ano e sinopse sozinho antes de salvar.
        if (!tmdbIdSelecionado) {
            await tentarPreencherAutomaticamente(titulo, tipo);
        }

        const resposta = await fetchAutenticado(`${API_URL}/titulos`, {
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

        const resposta = await fetchAutenticado(`${API_URL}/titulos/${id}`, {
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
        await fetchAutenticado(`${API_URL}/titulos/${id}`, { method: "DELETE" });
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

if (tokenSalvo) {
    listarTitulos();
}
