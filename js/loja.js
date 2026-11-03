// Viver Bem – monta as páginas a partir de data/produtos.json
// Cada página avisa quem ela é pelo atributo data-pagina do <body>:
//   "home" (Destaques), "catalogo" (lista + filtro), "produto" (um produto) e "carrinho".
// As funções de ajuda (criar, formatarPreco, Carrinho...) ficam em js/carrinho.js.

// Número do WhatsApp da loja (com 55 + DDD), usado no "Finalizar pelo WhatsApp"
const WHATSAPP = "5577981286097";

const ICONE_CHECK =
  '<svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
  '<path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- Ajuda ---------- */

function mostrarErro(mensagem) {
  const aviso = document.querySelector("#aviso-erro");
  if (aviso) {
    aviso.textContent =
      mensagem ||
      "Não consegui carregar os produtos. Abra o site pelo Live Server e confira se data/produtos.json está correto.";
    aviso.hidden = false;
  }
  const conteudo = document.querySelector("#produto-conteudo");
  if (conteudo) conteudo.hidden = true;
}

// Foto do produto: usa a imagem se existir, senão o espaço reservado
function criarFoto(produto, classeImagem, classeEspaco, textoEspaco) {
  if (produto.imagens && produto.imagens.length) {
    const imagem = criar("img", classeImagem);
    imagem.src = produto.imagens[0];
    imagem.alt = produto.nome;
    imagem.loading = "lazy";
    return imagem;
  }
  const espaco = criar("div", "ph " + classeEspaco, textoEspaco);
  espaco.setAttribute("role", "img");
  espaco.setAttribute("aria-label", "Foto do produto");
  return espaco;
}

// Card do produto (usado na Home, no catálogo e em "Você também pode gostar")
function criarCard(produto) {
  const card = criar("a", "card-produto");
  card.href = "produto.html?id=" + encodeURIComponent(produto.id);
  card.dataset.categoria = produto.categoria;
  if (!produto.disponivel) card.classList.add("indisponivel");

  card.append(
    criarFoto(produto, "foto-produto", "ph-produto", "[foto do produto]"),
    criar("p", "card-categoria", nomeCategoria(produto.categoria)),
    criar("h3", null, produto.nome)
  );

  const preco = textoPreco(produto);
  if (preco) card.append(criar("p", "preco", preco));
  if (!produto.disponivel) card.append(criar("p", "etiqueta", "Indisponível"));

  return card;
}

/* ---------- Home: Destaques ---------- */

function paginaHome(produtos, categorias) {
  const cats = document.querySelector("#lista-categorias");
  if (cats) {
    categorias.forEach((c) => {
      const cartao = criar("a", "categoria");
      cartao.href = "produtos.html?categoria=" + encodeURIComponent(c.slug);
      let foto;
      if (c.imagem) {
        foto = criar("img", "foto-categoria");
        foto.src = c.imagem;
        foto.alt = "Foto de " + c.nome;
        foto.loading = "lazy";
      } else {
        foto = criar("div", "ph", "[foto]");
        foto.setAttribute("role", "img");
        foto.setAttribute("aria-label", "Foto de " + c.nome);
      }
      cartao.append(foto, criar("h3", null, c.nome), criar("span", "link-suave", "Ver produtos"));
      cats.append(cartao);
    });
    iniciarCarrossel(cats, "#categorias-anterior", "#categorias-proximo", ".categoria");
  }
  const lista = document.querySelector("#lista-destaques");
  if (!lista) return;
  produtos
    .filter((p) => p.destaque && p.disponivel)
    .slice(0, 12)
    .forEach((p) => lista.append(criarCard(p)));
  iniciarCarrossel(lista, "#destaques-anterior", "#destaques-proximo", ".card-produto");
}

// Carrossel dos destaques: arrastar/rolar de lado + setas
function iniciarCarrossel(trilho, seletorAnterior, seletorProximo, seletorCartao) {
  const anterior = document.querySelector(seletorAnterior);
  const proximo = document.querySelector(seletorProximo);
  const carrossel = trilho.closest(".carrossel");

  function atualizar() {
    const sobra = trilho.scrollWidth - trilho.clientWidth;
    carrossel.classList.toggle("sem-rolagem", sobra <= 2);
    anterior.disabled = trilho.scrollLeft <= 2;
    proximo.disabled = trilho.scrollLeft >= sobra - 2;
  }
  function rolar(direcao) {
    const cartao = trilho.querySelector(seletorCartao);
    const passo = cartao ? cartao.getBoundingClientRect().width + 16 : trilho.clientWidth;
    trilho.scrollBy({ left: direcao * passo * (window.innerWidth >= 768 ? 2 : 1), behavior: "smooth" });
  }

  anterior.addEventListener("click", () => rolar(-1));
  proximo.addEventListener("click", () => rolar(1));
  trilho.addEventListener("scroll", atualizar, { passive: true });
  window.addEventListener("resize", atualizar);
  atualizar();
}

/* ---------- Catálogo: lista + filtro por categoria ---------- */

function paginaCatalogo(produtos, categorias) {
  const lista = document.querySelector("#lista-produtos");
  const barra = document.querySelector("#filtros");
  if (barra) {
    categorias.forEach((c) => {
      const chip = criar("a", "chip", c.nome);
      chip.href = "produtos.html?categoria=" + encodeURIComponent(c.slug);
      chip.dataset.filtro = c.slug;
      barra.append(chip);
    });
  }
  const filtros = document.querySelectorAll(".chip[data-filtro]");
  const aviso = document.querySelector("#sem-produtos");
  if (!lista) return;

  produtos.forEach((p) => lista.append(criarCard(p)));
  const cartoes = lista.querySelectorAll(".card-produto");

  function aplicarFiltro(categoria) {
    filtros.forEach((chip) => {
      const ativo = chip.dataset.filtro === categoria;
      chip.classList.toggle("ativo", ativo);
      if (ativo) chip.setAttribute("aria-current", "true");
      else chip.removeAttribute("aria-current");
    });

    let visiveis = 0;
    cartoes.forEach((cartao) => {
      const mostrar = categoria === "todos" || cartao.dataset.categoria === categoria;
      cartao.hidden = !mostrar;
      if (mostrar) visiveis++;
    });
    if (aviso) aviso.hidden = visiveis > 0;
  }

  // Categoria que veio no link (produtos.html?categoria=chas)
  const inicial = new URLSearchParams(window.location.search).get("categoria") || "todos";
  aplicarFiltro(inicial);

  filtros.forEach((chip) => {
    chip.addEventListener("click", (evento) => {
      evento.preventDefault();
      aplicarFiltro(chip.dataset.filtro);
      try {
        window.history.replaceState(null, "", chip.getAttribute("href"));
      } catch (erro) {
        /* alguns navegadores bloqueiam isso em arquivo local; o filtro segue funcionando */
      }
    });
  });
}

/* ---------- Página de um produto ---------- */

function paginaProduto(produtos) {
  const id = new URLSearchParams(window.location.search).get("id");
  // Se abrir produto.html sem ?id=, mostra o primeiro produto (bom para testar o visual)
  const produto = id ? produtos.find((p) => p.id === id) : produtos[0];

  if (!produto) {
    mostrarErro("Produto não encontrado. Volte para a página de produtos e escolha outro.");
    return;
  }

  const texto = (seletor, valor) => {
    const elemento = document.querySelector(seletor);
    if (elemento) elemento.textContent = valor;
  };

  // Título da aba e descrição para o Google
  document.title = produto.nome + " – Viver Bem";
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", produto.descricao);

  // Caminho (breadcrumb)
  const linkCategoria = document.querySelector("#caminho-categoria");
  linkCategoria.textContent = nomeCategoria(produto.categoria);
  linkCategoria.href = "produtos.html?categoria=" + encodeURIComponent(produto.categoria);
  texto("#caminho-nome", produto.nome);

  // Textos
  texto("#produto-categoria", nomeCategoria(produto.categoria));
  texto("#produto-nome", produto.nome);
  texto("#produto-preco", textoPreco(produto));
  texto("#produto-condicoes", produto.condicoes || "");
  texto("#produto-descricao", produto.descricao);
  texto("#produto-descricao-completa", produto.descricao_completa || produto.descricao);

  // Benefícios
  const listaBeneficios = document.querySelector("#produto-beneficios");
  (produto.beneficios || []).forEach((beneficio) => {
    const item = criar("li");
    item.insertAdjacentHTML("afterbegin", ICONE_CHECK);
    item.append(beneficio);
    listaBeneficios.append(item);
  });

  // Galeria: imagem principal + miniaturas que trocam a principal
  const principal = document.querySelector("#galeria-principal");
  const miniaturas = document.querySelector("#miniaturas");
  const imagens = produto.imagens || [];

  function mostrarImagem(indice) {
    const imagem = criar("img", "foto-principal");
    imagem.src = imagens[indice];
    imagem.alt = produto.nome;
    principal.replaceChildren(imagem);
    miniaturas.querySelectorAll(".mini").forEach((botao, i) => {
      if (i === indice) botao.setAttribute("aria-current", "true");
      else botao.removeAttribute("aria-current");
    });
  }

  if (imagens.length) {
    if (imagens.length > 1) {
      imagens.forEach((url, indice) => {
        const botao = criar("button", "mini");
        botao.type = "button";
        botao.setAttribute("aria-label", "Ver foto " + (indice + 1));
        const miniatura = criar("img");
        miniatura.src = url;
        miniatura.alt = "";
        botao.append(miniatura);
        botao.addEventListener("click", () => mostrarImagem(indice));
        miniaturas.append(botao);
      });
    }
    mostrarImagem(0);
  } else {
    const espaco = criar("div", "ph ph-principal", "[IMAGEM PRINCIPAL DO PRODUTO]");
    espaco.setAttribute("role", "img");
    espaco.setAttribute("aria-label", "Imagem do produto");
    principal.replaceChildren(espaco);
  }

  // Quantidade + botão "Adicionar ao carrinho"
  const botaoAdicionar = document.querySelector("#botao-adicionar");
  const blocoQuantidade = document.querySelector("#bloco-quantidade");

  if (!produto.disponivel) {
    blocoQuantidade.hidden = true;
    botaoAdicionar.disabled = true;
    botaoAdicionar.classList.add("desativado");
    botaoAdicionar.textContent = "Indisponível no momento";
  } else {
    const cfg = configQuantidade(produto);
    let quantidade = cfg.minimo;

    const valor = document.querySelector("#qtd-valor");
    const total = document.querySelector("#qtd-total");
    const menos = document.querySelector("#qtd-menos");
    const mais = document.querySelector("#qtd-mais");
    texto(
      "#rotulo-quantidade",
      cfg.peso ? "Quantidade (de " + cfg.passo + " em " + cfg.passo + " g)" : "Quantidade"
    );

    function atualizarQuantidade() {
      valor.textContent = rotuloQuantidade(produto, quantidade);
      const parcial = subtotal(produto, quantidade);
      total.textContent = parcial === null ? "" : formatarPreco(parcial);
      menos.disabled = quantidade <= cfg.minimo;
      mais.disabled = quantidade >= cfg.max;
    }

    menos.addEventListener("click", () => {
      quantidade = Math.max(cfg.minimo, quantidade - cfg.passo);
      atualizarQuantidade();
    });
    mais.addEventListener("click", () => {
      quantidade = Math.min(cfg.max, quantidade + cfg.passo);
      atualizarQuantidade();
    });
    atualizarQuantidade();

    botaoAdicionar.addEventListener("click", () => {
      Carrinho.adicionar(produto.id, quantidade);
      document.querySelector("#status-carrinho").hidden = false;
    });
  }

  // Você também pode gostar: primeiro da mesma categoria, depois os demais
  const outros = produtos.filter((p) => p.id !== produto.id && p.disponivel);
  const mesmaCategoria = outros.filter((p) => p.categoria === produto.categoria);
  const demais = outros.filter((p) => p.categoria !== produto.categoria);
  const relacionados = document.querySelector("#lista-relacionados");
  mesmaCategoria
    .concat(demais)
    .slice(0, 4)
    .forEach((p) => relacionados.append(criarCard(p)));
}

/* ---------- Página do carrinho ---------- */

function paginaCarrinho(produtos) {
  const lista = document.querySelector("#carrinho-lista");
  const conteudo = document.querySelector("#carrinho-conteudo");
  const vazio = document.querySelector("#carrinho-vazio");
  const totalTexto = document.querySelector("#carrinho-total");
  const botaoWhatsapp = document.querySelector("#botao-whatsapp");
  const aviso = document.querySelector("#aviso-erro");

  // Junta cada item do carrinho com os dados atuais do produto.
  // Produto que saiu do catálogo ou ficou indisponível é removido.
  function itensValidos() {
    const guardados = Carrinho.ler();
    const itens = guardados
      .map((i) => ({ id: i.id, qtd: i.qtd, produto: produtos.find((p) => p.id === i.id) }))
      .filter((i) => i.produto && i.produto.disponivel);
    if (itens.length !== guardados.length) {
      Carrinho.salvar(itens.map((i) => ({ id: i.id, qtd: i.qtd })));
      aviso.textContent = "Alguns produtos não estão mais disponíveis e foram retirados do carrinho.";
      aviso.hidden = false;
    }
    return itens;
  }

  function mensagemWhatsapp(itens, numero, nome) {
    let total = 0;
    let semPreco = false;
    const linhas = itens.map((i) => {
      const cfg = configQuantidade(i.produto);
      const parcial = subtotal(i.produto, i.qtd);
      if (parcial === null) semPreco = true;
      else total += parcial;
      const descricao = cfg.peso
        ? rotuloQuantidade(i.produto, i.qtd) + " de " + i.produto.nome
        : i.qtd + "x " + i.produto.nome;
      return "• " + descricao + (parcial === null ? "" : " – " + formatarPreco(parcial));
    });
    return (
      "Olá! Quero fazer o pedido" + (numero ? " nº " + numero : "") + " pelo site da Viver Bem:\n\n" +
      linhas.join("\n") +
      "\n\nTotal: " +
      (semPreco ? "a combinar" : formatarPreco(total)) +
      "\n\nNome: " + (nome || "") + "\nEntrega ou retirada:"
    );
  }

  function criarStepper(item) {
    const cfg = configQuantidade(item.produto);
    const grupo = criar("div", "stepper");
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Quantidade de " + item.produto.nome);

    const menos = criar("button", null, "−");
    menos.type = "button";
    menos.setAttribute("aria-label", "Diminuir quantidade");
    menos.disabled = item.qtd <= cfg.minimo;
    menos.addEventListener("click", () => {
      Carrinho.definir(item.id, Math.max(cfg.minimo, item.qtd - cfg.passo));
      desenhar();
    });

    const valor = criar("output", null, rotuloQuantidade(item.produto, item.qtd));
    valor.setAttribute("aria-live", "polite");

    const mais = criar("button", null, "+");
    mais.type = "button";
    mais.setAttribute("aria-label", "Aumentar quantidade");
    mais.disabled = item.qtd >= cfg.max;
    mais.addEventListener("click", () => {
      Carrinho.definir(item.id, Math.min(cfg.max, item.qtd + cfg.passo));
      desenhar();
    });

    grupo.append(menos, valor, mais);
    return grupo;
  }

  function desenhar() {
    const itens = itensValidos();
    lista.replaceChildren();

    if (itens.length === 0) {
      conteudo.hidden = true;
      vazio.hidden = false;
      return;
    }
    vazio.hidden = true;
    conteudo.hidden = false;

    let total = 0;
    let semPreco = false;

    itens.forEach((item) => {
      const produto = item.produto;
      const parcial = subtotal(produto, item.qtd);
      if (parcial === null) semPreco = true;
      else total += parcial;

      const linha = criar("li", "item-carrinho");

      const info = criar("div", "item-info");
      const nome = criar("a", "item-nome", produto.nome);
      nome.href = "produto.html?id=" + encodeURIComponent(produto.id);
      info.append(nome);
      const precoUnitario = textoPreco(produto);
      if (precoUnitario) info.append(criar("p", "nota", precoUnitario));

      const preco = criar("p", "item-total", parcial === null ? "" : formatarPreco(parcial));

      const remover = criar("button", "link-botao", "Remover");
      remover.type = "button";
      remover.setAttribute("aria-label", "Remover " + produto.nome + " do carrinho");
      remover.addEventListener("click", () => {
        Carrinho.remover(item.id);
        desenhar();
      });

      linha.append(info, criarStepper(item), preco, remover);
      lista.append(linha);
    });

    totalTexto.textContent = semPreco ? "a combinar" : formatarPreco(total);
    botaoWhatsapp.href = linkWhatsapp(itens, null);
  }

  const campoNome = document.querySelector("#pedido-nome");
  const statusPedido = document.querySelector("#pedido-status");

  function linkWhatsapp(itens, numero) {
    const nome = campoNome ? campoNome.value.trim() : "";
    return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(mensagemWhatsapp(itens, numero, nome));
  }

  // Grava o pedido no Supabase (se estiver configurado) e devolve o número, ou null
  async function registrarPedido(itens) {
    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    const corpo = {
      p_nome: campoNome ? campoNome.value.trim() : "",
      p_itens: itens.map((i) => ({ id: i.id, qtd: i.qtd })),
    };
    const resposta = await fetch(SUPABASE_URL + "/rest/v1/rpc/criar_pedido", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, cabecalhosSupabase()),
      body: JSON.stringify(corpo),
    });
    if (!resposta.ok) throw new Error("Pedido: erro " + resposta.status);
    const numero = await resposta.json();
    return Number.isFinite(numero) ? numero : null;
  }

  let enviando = false;
  botaoWhatsapp.addEventListener("click", async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    const itens = itensValidos();
    if (itens.length === 0) return;
    enviando = true;
    statusPedido.textContent = "Registrando seu pedido...";
    statusPedido.hidden = false;

    let numero = null;
    try {
      numero = await registrarPedido(itens);
    } catch (erro) {
      // Se não conseguir registrar, a venda NÃO pode parar: abre o WhatsApp mesmo assim
      console.error(erro);
    }
    const destino = linkWhatsapp(itens, numero);
    if (numero) Carrinho.limpar();
    enviando = false;
    window.location.href = destino;
  });

  document.querySelector("#botao-limpar").addEventListener("click", () => {
    Carrinho.limpar();
    desenhar();
  });

  desenhar();

  // Se a pessoa voltar do WhatsApp pelo botão "voltar", mostra o carrinho atualizado
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      statusPedido.hidden = true;
      desenhar();
    }
  });
}

/* ---------- Início ---------- */

async function iniciar() {
  const pagina = document.body.dataset.pagina;
  if (!pagina) return;

  try {
    const [todos, categorias] = await Promise.all([carregarProdutos(), carregarCategorias()]);
    // Produtos de categorias desativadas não aparecem na Home nem no catálogo
    const ativas = new Set(categorias.map((c) => c.slug));
    const produtos = pagina === "home" || pagina === "catalogo" ? todos.filter((p) => ativas.has(p.categoria)) : todos;
    if (pagina === "home") paginaHome(produtos, categorias);
    if (pagina === "catalogo") paginaCatalogo(produtos, categorias);
    if (pagina === "produto") paginaProduto(produtos);
    if (pagina === "carrinho") paginaCarrinho(produtos);
  } catch (erro) {
    console.error(erro);
    mostrarErro();
  }
}

iniciar();
