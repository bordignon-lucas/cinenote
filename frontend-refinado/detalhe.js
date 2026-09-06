// ── Configuração da API ────────────────────────────────────────────────────────
// Mesma lógica do app.js: file:// (dev local) usa localhost:3000, servido
// pelo próprio backend (produção) usa a mesma origem.
const API_URL = location.protocol === "file:" ? "http://localhost:3000" : "";

// ── Sessão / login ─────────────────────────────────────────────────────────────
const TOKEN_KEY = "cinenote_token";
const NOME_KEY  = "cinenote_nome";
const tokenSalvo = localStorage.getItem(TOKEN_KEY);

if (!tokenSalvo) {
    window.location.href = location.protocol === "file:" ? "login.html" : "/login.html";
}

function cabecalhosAuth() {
    return { "Authorization": `Bearer ${localStorage.getItem(TOKEN_KEY)}` };
}

async function fetchAutenticado(url, opcoes = {}) {
    const resposta = await fetch(url, {
        ...opcoes,
        headers: { ...cabecalhosAuth(), ...(opcoes.headers || {}) }
    });

    if (resposta.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(NOME_KEY);
        window.location.href = location.protocol === "file:" ? "login.html" : "/login.html";
        throw new Error("Sessão expirada.");
    }

    return resposta;
}

// ── Id do título: lido da URL limpa ("/detalhe/<id>", em produção) ou do
// formato antigo ("detalhe.html?id=<id>", usado ao abrir o arquivo direto do
// disco em desenvolvimento local) — o que existir primeiro é usado.
const params = new URLSearchParams(window.location.search);
let id = params.get("id");
if (!id) {
    const partesCaminho = window.location.pathname.split("/").filter(Boolean);
    const ultimaParte = partesCaminho[partesCaminho.length - 1];
    if (ultimaParte && ultimaParte !== "detalhe.html" && ultimaParte !== "detalhe") {
        id = ultimaParte;
    }
}

const secao = document.getElementById("secao-detalhe");

// ── Carregar o título pelo id da URL (?id=...) ────────────────────────────────
async function carregarDetalhe() {
    if (!id) {
        secao.innerHTML = `<p class="msg-vazia">Título não informado.</p>`;
        return;
    }

    try {
        const resposta = await fetchAutenticado(`${API_URL}/titulos/${id}`);

        if (resposta.status === 404) {
            secao.innerHTML = `<p class="msg-vazia">Título não encontrado.</p>`;
            return;
        }

        const titulo = await resposta.json();
        renderizarDetalhe(titulo);
    } catch (err) {
        secao.innerHTML = `<p class="msg-vazia">Erro ao conectar com o servidor. Verifique se ele está rodando.</p>`;
    }
}

function renderizarDetalhe(titulo) {
    const status        = titulo.status || "Quero Assistir";
    const statusClasse  = status === "Assistido" ? "assistido" : "quero-assistir";
    const rotuloDiretor = titulo.tipo === "Série" ? "Criador(es)" : "Diretor";
    const semDadosTmdb  = !titulo.genero && !titulo.diretor && !titulo.descricao;

    secao.innerHTML = `
        <div class="detalhe-topo">
            ${titulo.poster
                ? `<img class="detalhe-poster" src="${titulo.poster}" alt="">`
                : `<div class="detalhe-poster-vazio">🎬</div>`}

            <div class="detalhe-info">
                <div class="detalhe-titulo-linha">
                    <h1>${titulo.titulo}</h1>
                    ${titulo.ano ? `<span class="detalhe-ano">(${titulo.ano})</span>` : ""}
                </div>

                <div class="detalhe-badges">
                    <span class="badge-tipo">${titulo.tipo}</span>
                    <span class="badge-nota">${titulo.nota}</span>
                    <span class="badge-status ${statusClasse}">${status}</span>
                </div>

                <div class="detalhe-campo">
                    <strong>Gênero</strong>
                    ${titulo.genero || "Não disponível"}
                </div>

                <div class="detalhe-campo">
                    <strong>${rotuloDiretor}</strong>
                    ${titulo.diretor || "Não disponível"}
                </div>

                ${semDadosTmdb ? `
                <div class="detalhe-buscar-tmdb">
                    <button class="btn-editar" id="btn-buscar-tmdb">🔍 Buscar informações na TMDb</button>
                    <span class="msg-comentario-salvo" id="msg-buscar-tmdb" hidden></span>
                </div>` : ""}

                <div class="detalhe-acoes">
                    <button class="btn-favorito ${titulo.favorito ? "ativo" : ""}" id="btn-favorito-detalhe"
                        title="${titulo.favorito ? "Remover dos favoritos" : "Marcar como favorito"}">${titulo.favorito ? "★" : "☆"}</button>
                    <button class="btn-excluir" id="btn-excluir-detalhe">Excluir</button>
                </div>
            </div>
        </div>

        <p class="detalhe-sinopse">${titulo.descricao ||
            "Sinopse não disponível — este título foi adicionado sem usar o autocomplete, ou a chave da TMDb não estava configurada no momento do cadastro."}</p>

        <div class="detalhe-comentario">
            <label for="comentario">Seu comentário</label>
            <textarea id="comentario" placeholder="Anote o que quiser sobre este título...">${titulo.comentario || ""}</textarea>
            <button class="btn-confirmar" id="btn-salvar-comentario">Salvar comentário</button>
            <span class="msg-comentario-salvo" id="msg-comentario-salvo" hidden>Salvo!</span>
        </div>
    `;

    const btnBuscarTmdb = document.getElementById("btn-buscar-tmdb");
    if (btnBuscarTmdb) {
        btnBuscarTmdb.addEventListener("click", async () => {
            const msg = document.getElementById("msg-buscar-tmdb");

            btnBuscarTmdb.disabled = true;
            btnBuscarTmdb.textContent = "Buscando...";

            try {
                const respostaBusca = await fetch(`${API_URL}/buscar-filme?q=${encodeURIComponent(titulo.titulo)}`);
                const sugestoes = await respostaBusca.json();

                const correspondencia =
                    sugestoes.find(s => s.titulo.toLowerCase() === titulo.titulo.toLowerCase() && s.tipo === titulo.tipo) ||
                    sugestoes.find(s => s.titulo.toLowerCase() === titulo.titulo.toLowerCase()) ||
                    sugestoes[0];

                if (!correspondencia) {
                    msg.textContent = "Nenhuma informação encontrada para este título.";
                    msg.style.color = "var(--text-muted)";
                    msg.hidden = false;
                    btnBuscarTmdb.disabled = false;
                    btnBuscarTmdb.textContent = "🔍 Buscar informações na TMDb";
                    return;
                }

                const respostaDetalhes = await fetch(
                    `${API_URL}/detalhes-filme?tmdbId=${correspondencia.tmdbId}&tipo=${encodeURIComponent(correspondencia.tipo)}`
                );
                const detalhes = await respostaDetalhes.json();

                const atualizacao = {
                    titulo: titulo.titulo,
                    tipo: titulo.tipo,
                    nota: titulo.nota,
                    status: titulo.status,
                    poster: titulo.poster || correspondencia.posterGrande || correspondencia.poster || null,
                    ano: titulo.ano || correspondencia.ano || null,
                    descricao: detalhes.descricao,
                    genero: detalhes.genero,
                    diretor: detalhes.diretor
                };

                await fetchAutenticado(`${API_URL}/titulos/${titulo._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(atualizacao)
                });

                Object.assign(titulo, atualizacao);
                renderizarDetalhe(titulo);
            } catch (err) {
                alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
                btnBuscarTmdb.disabled = false;
                btnBuscarTmdb.textContent = "🔍 Buscar informações na TMDb";
            }
        });
    }

    document.getElementById("btn-favorito-detalhe").addEventListener("click", async () => {
        const novoValor = !titulo.favorito;
        try {
            await fetchAutenticado(`${API_URL}/titulos/${titulo._id}/favorito`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ favorito: novoValor })
            });
            titulo.favorito = novoValor;
            renderizarDetalhe(titulo);
        } catch (err) {
            alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
        }
    });

    document.getElementById("btn-excluir-detalhe").addEventListener("click", async () => {
        if (!confirm("Tem certeza que deseja excluir este título? Essa ação não pode ser desfeita.")) {
            return;
        }
        try {
            await fetchAutenticado(`${API_URL}/titulos/${titulo._id}`, { method: "DELETE" });
            window.location.href = "/";
        } catch (err) {
            alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
        }
    });

    document.getElementById("btn-salvar-comentario").addEventListener("click", async () => {
        const btn        = document.getElementById("btn-salvar-comentario");
        const comentario = document.getElementById("comentario").value;
        const msg        = document.getElementById("msg-comentario-salvo");

        btn.disabled = true;
        btn.textContent = "Salvando...";

        try {
            await fetchAutenticado(`${API_URL}/titulos/${titulo._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    titulo: titulo.titulo,
                    tipo: titulo.tipo,
                    nota: titulo.nota,
                    status: titulo.status,
                    comentario
                })
            });
            titulo.comentario = comentario;
            msg.hidden = false;
            setTimeout(() => { msg.hidden = true; }, 2000);
        } catch (err) {
            alert("Erro ao conectar com o servidor. Verifique se ele está rodando.");
        } finally {
            btn.disabled = false;
            btn.textContent = "Salvar comentário";
        }
    });
}

if (tokenSalvo) {
    carregarDetalhe();
}
