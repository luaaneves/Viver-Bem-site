// Viver Bem – funções compartilhadas e carrinho de compras
// Este arquivo carrega em todas as páginas, antes do js/loja.js.

/* ---------- Dados e textos ---------- */

let CATEGORIAS = {
  suplementos: "Suplementos",
  chas: "Chás",
  granel: "Granel",
  cosmeticos: "Cosméticos",
};

// Cria um elemento: criar("p", "classe", "texto")
function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function nomeCategoria(slug) {
  return CATEGORIAS[slug] || slug;
}

function formatarPreco(valor) {
  if (typeof valor !== "number") return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Cabeçalhos da API do Supabase (a chave "sb_publishable_..." vai só em apikey; a "eyJ..." também em Authorization)
function cabecalhosSupabase() {
  const h = { apikey: SUPABASE_ANON_KEY };
  if (SUPABASE_ANON_KEY.startsWith("eyJ")) h.Authorization = "Bearer " + SUPABASE_ANON_KEY;
  return h;
}

// Categorias: do Supabase (tabela "categorias") ou de data/categorias.json.
// Atualiza os nomes usados em nomeCategoria() e devolve só as categorias ativas, em ordem.
async function carregarCategorias() {
  let lista;
  try {
    if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const resposta = await fetch(SUPABASE_URL + "/rest/v1/categorias?select=*&order=ordem.asc,nome.asc", {
        headers: cabecalhosSupabase(),
      });
      if (!resposta.ok) throw new Error("Supabase: erro " + resposta.status);
      lista = await resposta.json();
    } else {
      const resposta = await fetch("data/categorias.json");
      if (!resposta.ok) throw new Error("Erro " + resposta.status);
      lista = await resposta.json();
    }
  } catch (erro) {
    console.error(erro);
    lista = Object.keys(CATEGORIAS).map((slug) => ({ slug, nome: CATEGORIAS[slug], ativa: true }));
  }
  lista.forEach((c) => { CATEGORIAS[c.slug] = c.nome; });
  return lista.filter((c) => c.ativa !== false);
}

// Converte uma linha do banco (colunas) para o formato usado pelo site
function linhaParaProduto(l) {
  return {
    id: l.id,
    nome: l.nome,
    categoria: l.categoria,
    preco: l.preco === null || l.preco === undefined ? undefined : Number(l.preco),
    unidade: l.unidade || "un",
    preco_por: l.preco_por || undefined,
    passo: l.passo || undefined,
    minimo: l.minimo || undefined,
    condicoes: l.condicoes || "",
    descricao: l.descricao || "",
    beneficios: Array.isArray(l.beneficios) ? l.beneficios : [],
    descricao_completa: l.descricao_completa || "",
    imagens: Array.isArray(l.imagens) ? l.imagens : [],
    disponivel: l.disponivel !== false,
    destaque: l.destaque === true,
  };
}

// Com Supabase configurado (js/config.js) lê do banco; senão lê data/produtos.json
async function carregarProdutos() {
  if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const resposta = await fetch(SUPABASE_URL + "/rest/v1/produtos?select=*&order=ordem.asc,nome.asc", {
      headers: cabecalhosSupabase(),
    });
    if (!resposta.ok) throw new Error("Supabase: erro " + resposta.status);
    return (await resposta.json()).map(linhaParaProduto);
  }
  const resposta = await fetch("data/produtos.json");
  if (!resposta.ok) throw new Error("Erro " + resposta.status);
  return resposta.json();
}

/* ---------- Quantidade e preço ----------
   Produto por unidade:  { "unidade": "un" } (ou sem o campo)  -> 1, 2, 3...
   Produto por peso:     { "unidade": "g", "preco_por": 100, "passo": 50, "minimo": 50 }
                         o "preco" vale para "preco_por" gramas; o cliente escolhe de "passo" em "passo" gramas. */

function configQuantidade(produto) {
  if (produto.unidade === "g") {
    return {
      peso: true,
      por: produto.preco_por || 100,
      passo: produto.passo || 50,
      minimo: produto.minimo || 50,
      max: 5000,
    };
  }
  return { peso: false, por: 1, passo: 1, minimo: 1, max: 99 };
}

// Quanto custa essa quantidade (ou null se o produto não tem preço)
function subtotal(produto, quantidade) {
  if (typeof produto.preco !== "number") return null;
  const cfg = configQuantidade(produto);
  return Math.round(produto.preco * (quantidade / cfg.por) * 100) / 100;
}

// "R$ 12,50" ou "R$ 12,50 / 100 g"
function textoPreco(produto) {
  const preco = formatarPreco(produto.preco);
  if (!preco) return "";
  const cfg = configQuantidade(produto);
  return cfg.peso ? preco + " / " + cfg.por + " g" : preco;
}

// "250 g", "1,5 kg" ou só o número, para produtos por unidade
function rotuloQuantidade(produto, quantidade) {
  if (!configQuantidade(produto).peso) return String(quantidade);
  if (quantidade >= 1000) {
    return (quantidade / 1000).toLocaleString("pt-BR") + " kg";
  }
  return quantidade + " g";
}

/* ---------- Carrinho (guardado no navegador do cliente) ---------- */

const Carrinho = {
  chave: "viverbem-carrinho",

  // Lista de itens: [{ id: "cha-1", qtd: 2 }, ...]
  ler() {
    try {
      const dados = JSON.parse(localStorage.getItem(this.chave) || "[]");
      if (!Array.isArray(dados)) return [];
      return dados.filter((i) => i && typeof i.id === "string" && Number.isFinite(i.qtd) && i.qtd > 0);
    } catch (erro) {
      return [];
    }
  },

  salvar(itens) {
    try {
      localStorage.setItem(this.chave, JSON.stringify(itens));
    } catch (erro) {
      /* navegador bloqueou o armazenamento: o carrinho não será lembrado */
    }
    atualizarContador();
  },

  // Soma a quantidade se o produto já estiver no carrinho
  adicionar(id, quantidade) {
    const itens = this.ler();
    const existente = itens.find((i) => i.id === id);
    if (existente) existente.qtd += quantidade;
    else itens.push({ id, qtd: quantidade });
    this.salvar(itens);
  },

  definir(id, quantidade) {
    const itens = this.ler();
    const item = itens.find((i) => i.id === id);
    if (item) item.qtd = quantidade;
    this.salvar(itens);
  },

  remover(id) {
    this.salvar(this.ler().filter((i) => i.id !== id));
  },

  limpar() {
    this.salvar([]);
  },
};

// Número no ícone do carrinho (quantos produtos diferentes)
function atualizarContador() {
  const total = Carrinho.ler().length;
  document.querySelectorAll(".carrinho-link").forEach((link) => {
    const marca = link.querySelector(".carrinho-qtd");
    if (marca) {
      marca.textContent = String(total);
      marca.hidden = total === 0;
    }
    link.setAttribute(
      "aria-label",
      total === 0 ? "Carrinho vazio" : "Carrinho, " + total + (total === 1 ? " produto" : " produtos")
    );
  });
}

// Se o carrinho mudar em outra aba, atualiza aqui também
window.addEventListener("storage", atualizarContador);
atualizarContador();
