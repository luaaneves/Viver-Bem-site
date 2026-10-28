// Viver Bem – JavaScript comum a todas as páginas
// (os produtos, o filtro e a página de produto ficam em js/loja.js)

// 1. Menu do celular (abre e fecha ao clicar no ícone de três linhas)
const botaoMenu = document.querySelector(".menu-toggle");
const menu = document.querySelector("#menu-principal");

if (botaoMenu && menu) {
  botaoMenu.addEventListener("click", () => {
    const abriu = menu.classList.toggle("aberto");
    botaoMenu.setAttribute("aria-expanded", String(abriu));
    botaoMenu.setAttribute("aria-label", abriu ? "Fechar menu" : "Abrir menu");
  });

  // Fecha o menu ao escolher um item (útil nos links que rolam a própria página)
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("aberto");
      botaoMenu.setAttribute("aria-expanded", "false");
      botaoMenu.setAttribute("aria-label", "Abrir menu");
    });
  });
}

// 2. Ano do rodapé sempre atualizado
const ano = document.querySelector("#ano");
if (ano) ano.textContent = new Date().getFullYear();
