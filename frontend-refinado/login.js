// ── Configuração da API ────────────────────────────────────────────────────────
const API_URL = location.protocol === "file:" ? "http://localhost:3000" : "";

const TOKEN_KEY = "cinenote_token";
const NOME_KEY  = "cinenote_nome";

// Se já tiver uma sessão salva, não faz sentido mostrar a tela de login de novo.
if (localStorage.getItem(TOKEN_KEY)) {
    window.location.href = "index.html";
}

const abaEntrar  = document.getElementById("aba-entrar");
const abaCriar   = document.getElementById("aba-criar");
const formEntrar = document.getElementById("form-entrar");
const formCriar  = document.getElementById("form-criar");

abaEntrar.addEventListener("click", () => {
    abaEntrar.classList.add("ativa");
    abaCriar.classList.remove("ativa");
    formEntrar.hidden = false;
    formCriar.hidden  = true;
});

abaCriar.addEventListener("click", () => {
    abaCriar.classList.add("ativa");
    abaEntrar.classList.remove("ativa");
    formCriar.hidden  = false;
    formEntrar.hidden = true;
});

formEntrar.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = document.getElementById("erro-entrar");
    erro.hidden = true;

    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    const btn = formEntrar.querySelector(".btn-login");
    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
        const resposta = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, senha })
        });
        const dados = await resposta.json();

        if (!resposta.ok) {
            erro.textContent = dados.erro || "Não foi possível entrar.";
            erro.hidden = false;
            return;
        }

        localStorage.setItem(TOKEN_KEY, dados.token);
        localStorage.setItem(NOME_KEY, dados.nome);
        window.location.href = "index.html";
    } catch (err) {
        erro.textContent = "Erro ao conectar com o servidor. Verifique se ele está rodando.";
        erro.hidden = false;
    } finally {
        btn.disabled = false;
        btn.textContent = "Entrar";
    }
});

formCriar.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = document.getElementById("erro-criar");
    erro.hidden = true;

    const nome  = document.getElementById("criar-nome").value;
    const email = document.getElementById("criar-email").value;
    const senha = document.getElementById("criar-senha").value;
    const senhaConfirmar = document.getElementById("criar-senha-confirmar").value;

    if (senha !== senhaConfirmar) {
        erro.textContent = "As senhas digitadas não são iguais.";
        erro.hidden = false;
        return;
    }

    const btn = formCriar.querySelector(".btn-login");
    btn.disabled = true;
    btn.textContent = "Criando...";

    try {
        const resposta = await fetch(`${API_URL}/auth/registrar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, senha })
        });
        const dados = await resposta.json();

        if (!resposta.ok) {
            erro.textContent = dados.erro || "Não foi possível criar a conta.";
            erro.hidden = false;
            return;
        }

        localStorage.setItem(TOKEN_KEY, dados.token);
        localStorage.setItem(NOME_KEY, dados.nome);
        window.location.href = "index.html";
    } catch (err) {
        erro.textContent = "Erro ao conectar com o servidor. Verifique se ele está rodando.";
        erro.hidden = false;
    } finally {
        btn.disabled = false;
        btn.textContent = "Criar conta";
    }
});
