// Viver Bem – painel da equipe (admin.html)
// Entrar, ver os produtos, criar/editar/apagar, marcar disponível e enviar fotos.

const $ = (seletor) => document.querySelector(seletor);
const BUCKET = "produtos";
const TAMANHO_MAX_FOTO = 1200; // pixels no lado maior

let banco = null;
let produtos = [];
let categorias = [];
let editandoCategoria = null; // null = categoria nova
let fotoCategoria = null;     // endereço da foto da categoria em edição (null = sem foto)
let editandoId = null;   // null = produto novo
let fotos = [];          // endereços das fotos do produto no formulário

/* ---------- Ajuda ---------- */

function aviso(texto, erro) {
  const caixa = $("#admin-aviso");
  caixa.textContent = texto || "";
  caixa.hidden = !texto;
  caixa.style.background = erro === false ? "#e6f2d9" : "";
  if (texto) caixa.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function mostrar(...ids) {
  ["#admin-sem-config", "#admin-login", "#admin-lista", "#admin-form", "#admin-categorias", "#admin-form-categoria", "#admin-pedidos", "#admin-pedido"].forEach((id) => {
    $(id).hidden = !ids.includes(id);
  });
  // As abas só aparecem nas duas listas
  const naLista = ids.includes("#admin-lista") || ids.includes("#admin-categorias") || ids.includes("#admin-pedidos");
  $("#admin-abas").hidden = !naLista;
  $("#aba-produtos").classList.toggle("ativa", ids.includes("#admin-lista"));
  $("#aba-categorias").classList.toggle("ativa", ids.includes("#admin-categorias"));
  $("#aba-pedidos").classList.toggle("ativa", ids.includes("#admin-pedidos"));
}

// "Chá de Camomila" -> "cha-de-camomila"
function criarId(nome) {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function numeroOuNulo(valor) {
  if (valor === "" || valor === null || valor === undefined) return null;
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* ---------- Entrada ---------- */

async function iniciar() {
  if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    mostrar("#admin-sem-config");
    return;
  }
  banco = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data } = await banco.auth.getSession();
  await aoMudarSessao(data.session);
  // Importante: dentro desta função não se espera (await) outras chamadas ao Supabase,
  // senão o login trava. Por isso o setTimeout. Eventos repetidos são ignorados.
  banco.auth.onAuthStateChange((evento, sessao) => {
    if (evento === "INITIAL_SESSION" || evento === "TOKEN_REFRESHED") return;
    setTimeout(() => aoMudarSessao(sessao), 0);
  });
}

let usuarioAtual = null;

async function aoMudarSessao(sessao) {
  const usuario = $("#admin-usuario");
  const sair = $("#botao-sair");
  // Mesmo usuário já na tela (ex.: voltou para a aba): não recarrega nem fecha o formulário aberto
  if (sessao && usuarioAtual === sessao.user.id) return;
  usuarioAtual = sessao ? sessao.user.id : null;
  if (!sessao) {
    usuario.hidden = true;
    sair.hidden = true;
    mostrar("#admin-login");
    return;
  }
  usuario.textContent = sessao.user.email;
  usuario.hidden = false;
  sair.hidden = false;
  await carregarLista();
}

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  aviso("");
  const { error } = await banco.auth.signInWithPassword({
    email: $("#login-email").value.trim(),
    password: $("#login-senha").value,
  });
  if (error) aviso("Não foi possível entrar. Confira o e-mail e a senha.");
  else $("#login-senha").value = "";
});

$("#botao-sair").addEventListener("click", async () => {
  aviso("");
  try {
    // Espera no máximo 3 segundos; depois encerra só neste navegador
    await Promise.race([banco.auth.signOut(), new Promise((_, rejeitar) => setTimeout(rejeitar, 3000))]);
  } catch (erro) {
    try { await banco.auth.signOut({ scope: "local" }); } catch (e) { /* segue para a tela de login */ }
  }
  aoMudarSessao(null);
});

/* ---------- Lista ---------- */

async function carregarLista() {
  const respCategorias = await banco.from("categorias").select("*").order("ordem", { ascending: true }).order("nome", { ascending: true });
  if (respCategorias.error) {
    aviso("Erro ao carregar as categorias: " + respCategorias.error.message + " (rodou o schema.sql atualizado?)");
    return;
  }
  categorias = respCategorias.data;
  CATEGORIAS = {};
  categorias.forEach((c) => { CATEGORIAS[c.slug] = c.nome; });
  preencherSelectCategorias();
  desenharCategorias();

  const { data, error } = await banco
    .from("produtos").select("*").order("ordem", { ascending: true }).order("nome", { ascending: true });
  if (error) {
    aviso("Erro ao carregar os produtos: " + error.message);
    return;
  }
  produtos = data;
  desenharLista();
  atualizarContadorPedidos();
  mostrar(abaAtual === "categorias" ? "#admin-categorias" : abaAtual === "pedidos" ? "#admin-pedidos" : "#admin-lista");
}

let abaAtual = "produtos";
$("#aba-produtos").addEventListener("click", () => { abaAtual = "produtos"; aviso(""); mostrar("#admin-lista"); });
$("#aba-categorias").addEventListener("click", () => { abaAtual = "categorias"; aviso(""); mostrar("#admin-categorias"); });
$("#aba-pedidos").addEventListener("click", async () => { abaAtual = "pedidos"; aviso(""); await carregarPedidos(); mostrar("#admin-pedidos"); });

/* ---------- Pedidos ---------- */

const NOMES_ESTADO = { novo: "Novo", combinado: "Combinado", entregue: "Entregue", cancelado: "Cancelado" };
let pedidos = [];
let pedidoAberto = null;

function dataCurta(texto) {
  return new Date(texto).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function textoTotal(pedido) {
  return pedido.total === null ? "a combinar" : formatarPreco(Number(pedido.total));
}

async function atualizarContadorPedidos() {
  const { count } = await banco.from("pedidos").select("numero", { count: "exact", head: true }).eq("status", "novo");
  const marca = $("#pedidos-novos");
  marca.textContent = String(count || 0);
  marca.hidden = !count;
}

async function carregarPedidos() {
  const { data, error } = await banco.from("pedidos").select("*").order("numero", { ascending: false }).limit(500);
  if (error) {
    aviso("Erro ao carregar os pedidos: " + error.message + " (rodou o pedidos.sql?)");
    return;
  }
  pedidos = data;
  desenharPedidos();
  atualizarContadorPedidos();
}

function desenharPedidos() {
  const filtro = $("#filtro-status").value;
  const corpo = $("#tabela-pedidos tbody");
  corpo.replaceChildren();
  const lista = pedidos.filter((p) => !filtro || p.status === filtro);
  $("#pedidos-vazio").hidden = lista.length > 0;

  lista.forEach((p) => {
    const tr = document.createElement("tr");
    const numero = document.createElement("td");
    numero.className = "num";
    numero.textContent = "#" + p.numero;
    const data = document.createElement("td");
    data.textContent = dataCurta(p.criado_em);
    const nome = document.createElement("td");
    nome.textContent = p.nome || "–";
    const total = document.createElement("td");
    total.textContent = textoTotal(p);
    const estado = document.createElement("td");
    const etiqueta = document.createElement("span");
    etiqueta.className = "estado estado-" + p.status;
    etiqueta.textContent = NOMES_ESTADO[p.status] || p.status;
    estado.append(etiqueta);
    const acoes = document.createElement("td");
    const ver = document.createElement("button");
    ver.type = "button";
    ver.className = "btn-mini";
    ver.textContent = "Ver detalhes";
    ver.addEventListener("click", () => abrirPedido(p));
    acoes.append(ver);
    tr.append(numero, data, nome, total, estado, acoes);
    corpo.append(tr);
  });
}

function abrirPedido(p) {
  aviso("");
  pedidoAberto = p;
  $("#pedido-titulo").textContent = "Pedido nº " + p.numero;
  $("#pedido-data").textContent = "Feito em " + dataCurta(p.criado_em);
  $("#pedido-nome-cliente").textContent = p.nome || "não informado (veja na conversa do WhatsApp)";
  const lista = $("#pedido-itens");
  lista.replaceChildren();
  (p.itens || []).forEach((i) => {
    const li = document.createElement("li");
    const esquerda = document.createElement("span");
    const quantidade = i.unidade === "g" ? rotuloQuantidade({ unidade: "g" }, Number(i.qtd)) : Number(i.qtd) + "x";
    esquerda.textContent = quantidade + (i.unidade === "g" ? " de " : " ") + i.nome;
    const direita = document.createElement("strong");
    direita.textContent = i.subtotal === null || i.subtotal === undefined ? "a combinar" : formatarPreco(Number(i.subtotal));
    li.append(esquerda, direita);
    lista.append(li);
  });
  $("#pedido-total").textContent = textoTotal(p);
  $("#pedido-status-select").value = p.status;
  $("#pedido-observacao").value = p.observacao || "";
  mostrar("#admin-pedido");
  window.scrollTo({ top: 0 });
}

$("#filtro-status").addEventListener("change", desenharPedidos);
$("#botao-atualizar-pedidos").addEventListener("click", carregarPedidos);
$("#botao-voltar-pedidos").addEventListener("click", () => { aviso(""); mostrar("#admin-pedidos"); });

$("#botao-salvar-pedido").addEventListener("click", async () => {
  const botao = $("#botao-salvar-pedido");
  botao.disabled = true;
  const { error } = await banco.from("pedidos")
    .update({ status: $("#pedido-status-select").value, observacao: $("#pedido-observacao").value.trim() })
    .eq("numero", pedidoAberto.numero);
  botao.disabled = false;
  if (error) { aviso("Não consegui salvar: " + error.message); return; }
  await carregarPedidos();
  mostrar("#admin-pedidos");
  aviso("Pedido nº " + pedidoAberto.numero + " salvo.", false);
});

$("#botao-apagar-pedido").addEventListener("click", async () => {
  if (!window.confirm("Apagar o pedido nº " + pedidoAberto.numero + " de vez? Para só encerrar, mude o estado para Cancelado.")) return;
  const { error } = await banco.from("pedidos").delete().eq("numero", pedidoAberto.numero);
  if (error) { aviso("Não consegui apagar: " + error.message); return; }
  await carregarPedidos();
  mostrar("#admin-pedidos");
  aviso("Pedido apagado.", false);
});

/* ---------- Categorias ---------- */

function preencherSelectCategorias() {
  const select = $("#f-categoria");
  const atual = select.value;
  select.replaceChildren();
  categorias.forEach((c) => {
    const opcao = document.createElement("option");
    opcao.value = c.slug;
    opcao.textContent = c.nome + (c.ativa ? "" : " (desativada)");
    select.append(opcao);
  });
  if (atual) select.value = atual;
}

function desenharCategorias() {
  const corpo = $("#tabela-categorias tbody");
  corpo.replaceChildren();
  categorias.forEach((c) => {
    const tr = document.createElement("tr");
    const nome = document.createElement("td");
    nome.textContent = c.nome;
    nome.style.fontWeight = "700";
    const ordem = document.createElement("td");
    ordem.textContent = String(c.ordem);

    const ativa = document.createElement("td");
    const caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.checked = c.ativa;
    caixa.setAttribute("aria-label", "Ativa: " + c.nome);
    caixa.addEventListener("change", async () => {
      caixa.disabled = true;
      const { error } = await banco.from("categorias").update({ ativa: caixa.checked }).eq("slug", c.slug);
      caixa.disabled = false;
      if (error) { caixa.checked = !caixa.checked; aviso("Não consegui salvar: " + error.message); }
      else { c.ativa = caixa.checked; preencherSelectCategorias(); aviso(""); }
    });
    ativa.append(caixa);

    const acoes = document.createElement("td");
    acoes.className = "acoes";
    const editar = document.createElement("button");
    editar.type = "button"; editar.className = "btn-mini"; editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirFormularioCategoria(c));
    const apagar = document.createElement("button");
    apagar.type = "button"; apagar.className = "btn-mini perigo"; apagar.textContent = "Apagar";
    apagar.addEventListener("click", () => apagarCategoria(c));
    acoes.append(editar, apagar);

    tr.append(nome, ordem, ativa, acoes);
    corpo.append(tr);
  });
}

function abrirFormularioCategoria(c) {
  aviso("");
  editandoCategoria = c ? c.slug : null;
  $("#form-categoria-titulo").textContent = c ? "Editar categoria" : "Nova categoria";
  $("#c-nome").value = c ? c.nome : "";
  $("#c-ordem").value = c ? c.ordem : categorias.length;
  $("#c-ativa").checked = c ? c.ativa : true;
  fotoCategoria = c && c.imagem ? c.imagem : null;
  desenharFotoCategoria();
  mostrar("#admin-form-categoria");
  window.scrollTo({ top: 0 });
}
function desenharFotoCategoria() {
  const previa = $("#c-foto-previa");
  previa.hidden = !fotoCategoria;
  if (fotoCategoria) previa.src = fotoCategoria; else previa.removeAttribute("src");
  $("#c-foto-remover").hidden = !fotoCategoria;
  $("#c-foto-botao").firstChild.textContent = fotoCategoria ? "Trocar foto" : "Escolher foto";
}
$("#c-foto-remover").addEventListener("click", () => { fotoCategoria = null; desenharFotoCategoria(); });
$("#c-foto").addEventListener("change", async (e) => {
  const arquivo = e.target.files[0];
  e.target.value = "";
  if (!arquivo) return;
  aviso("Enviando foto...", false);
  try {
    const blob = await reduzirFoto(arquivo);
    const base = editandoCategoria || criarId($("#c-nome").value) || "categoria";
    const caminho = "categorias/" + base + "-" + Date.now() + ".jpg";
    const { error } = await banco.storage.from(BUCKET).upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) throw error;
    fotoCategoria = banco.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
    desenharFotoCategoria();
    aviso("Foto enviada. Lembre de clicar em Salvar.", false);
  } catch (erro) {
    aviso("Erro ao enviar foto: " + (erro.message || erro));
  }
});
$("#botao-nova-categoria").addEventListener("click", () => abrirFormularioCategoria(null));
$("#botao-cancelar-categoria").addEventListener("click", () => { aviso(""); mostrar("#admin-categorias"); });

$("#form-categoria").addEventListener("submit", async (e) => {
  e.preventDefault();
  const botao = $("#botao-salvar-categoria");
  botao.disabled = true;
  aviso("");
  const nome = $("#c-nome").value.trim();
  const slug = editandoCategoria || criarId(nome);
  if (!slug) { aviso("Dê um nome à categoria."); botao.disabled = false; return; }
  const linha = { slug, nome, ordem: parseInt($("#c-ordem").value, 10) || 0, ativa: $("#c-ativa").checked, imagem: fotoCategoria };
  const consulta = editandoCategoria
    ? banco.from("categorias").update(linha).eq("slug", editandoCategoria)
    : banco.from("categorias").insert(linha);
  const { error } = await consulta;
  botao.disabled = false;
  if (error) {
    aviso(error.code === "23505" ? "Já existe uma categoria com esse nome."
      : /imagem/.test(error.message) ? "Falta rodar no Supabase o SQL da foto da categoria (arquivo supabase/categoria-foto.sql)."
      : "Não consegui salvar: " + error.message);
    return;
  }
  abaAtual = "categorias";
  await carregarLista();
  aviso('Categoria "' + nome + '" salva.', false);
});

async function apagarCategoria(c) {
  if (!window.confirm('Apagar a categoria "' + c.nome + '"? Para só esconder do site, desmarque "Ativa".')) return;
  const { error } = await banco.from("categorias").delete().eq("slug", c.slug);
  if (error) {
    aviso(error.code === "23503"
      ? 'Ainda há produtos em "' + c.nome + '". Mude a categoria deles primeiro, ou desmarque "Ativa" para esconder.'
      : "Não consegui apagar: " + error.message);
    return;
  }
  await carregarLista();
  aviso('Categoria "' + c.nome + '" apagada.', false);
}

function celulaCheck(produto, campo, rotulo) {
  const td = document.createElement("td");
  const caixa = document.createElement("input");
  caixa.type = "checkbox";
  caixa.checked = !!produto[campo];
  caixa.setAttribute("aria-label", rotulo + ": " + produto.nome);
  caixa.addEventListener("change", async () => {
    caixa.disabled = true;
    const { error } = await banco.from("produtos").update({ [campo]: caixa.checked }).eq("id", produto.id);
    caixa.disabled = false;
    if (error) {
      caixa.checked = !caixa.checked;
      aviso("Não consegui salvar: " + error.message);
    } else {
      produto[campo] = caixa.checked;
      aviso("");
    }
  });
  td.append(caixa);
  return td;
}

function desenharLista() {
  const corpo = $("#tabela-produtos tbody");
  corpo.replaceChildren();

  produtos.forEach((p) => {
    const tr = document.createElement("tr");

    const nome = document.createElement("td");
    nome.textContent = p.nome;
    nome.style.fontWeight = "700";

    const categoria = document.createElement("td");
    categoria.textContent = nomeCategoria(p.categoria);

    const preco = document.createElement("td");
    preco.textContent = p.preco === null ? "–" : formatarPreco(Number(p.preco)) + (p.unidade === "g" ? " / " + (p.preco_por || 100) + " g" : "");

    const acoes = document.createElement("td");
    acoes.className = "acoes";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "btn-mini";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => abrirFormulario(p));
    const apagar = document.createElement("button");
    apagar.type = "button";
    apagar.className = "btn-mini perigo";
    apagar.textContent = "Apagar";
    apagar.addEventListener("click", () => apagarProduto(p));
    acoes.append(editar, apagar);

    tr.append(nome, categoria, preco, celulaCheck(p, "disponivel", "Disponível"), celulaCheck(p, "destaque", "Destaque"), acoes);
    corpo.append(tr);
  });

  // Botão de importar só aparece quando o banco está vazio
  $("#botao-importar").hidden = produtos.length > 0;
}

async function apagarProduto(p) {
  if (!window.confirm('Apagar "' + p.nome + '" de vez? Para só esconder, desmarque "Disponível".')) return;
  const { error } = await banco.from("produtos").delete().eq("id", p.id);
  if (error) aviso("Não consegui apagar: " + error.message);
  else {
    aviso('"' + p.nome + '" foi apagado.', false);
    await carregarLista();
  }
}

$("#botao-importar").addEventListener("click", async () => {
  try {
    const resposta = await fetch("data/produtos.json");
    const lista = await resposta.json();
    const linhas = lista.map((p, i) => ({
      id: p.id, nome: p.nome, categoria: p.categoria,
      preco: p.preco ?? null,
      unidade: p.unidade || "un", preco_por: p.preco_por || null, passo: p.passo || null, minimo: p.minimo || null,
      condicoes: p.condicoes || "", descricao: p.descricao || "",
      beneficios: p.beneficios || [], descricao_completa: p.descricao_completa || "",
      imagens: p.imagens || [], disponivel: p.disponivel !== false, destaque: !!p.destaque, ordem: i,
    }));
    const { error } = await banco.from("produtos").insert(linhas);
    if (error) throw error;
    aviso("Produtos de exemplo importados.", false);
    await carregarLista();
  } catch (erro) {
    aviso("Não consegui importar: " + (erro.message || erro));
  }
});

/* ---------- Formulário ---------- */

function atualizarCamposPeso() {
  const peso = $("#f-unidade").value === "g";
  $("#campos-peso").hidden = !peso;
  $("#dica-preco").textContent = peso ? "(preço para a quantidade em gramas informada abaixo)" : "";
}
$("#f-unidade").addEventListener("change", atualizarCamposPeso);

function abrirFormulario(produto) {
  aviso("");
  abaAtual = "produtos";
  editandoId = produto ? produto.id : null;
  $("#form-titulo").textContent = produto ? "Editar produto" : "Novo produto";
  const p = produto || {};
  $("#f-nome").value = p.nome || "";
  $("#f-categoria").value = p.categoria || (categorias[0] && categorias[0].slug) || "";
  $("#f-unidade").value = p.unidade || "un";
  $("#f-preco").value = p.preco ?? "";
  $("#f-preco-por").value = p.preco_por || 100;
  $("#f-passo").value = p.passo || 50;
  $("#f-minimo").value = p.minimo || 50;
  $("#f-condicoes").value = p.condicoes || "";
  $("#f-descricao").value = p.descricao || "";
  $("#f-beneficios").value = (p.beneficios || []).join("\n");
  $("#f-descricao-completa").value = p.descricao_completa || "";
  $("#f-disponivel").checked = produto ? p.disponivel : true;
  $("#f-destaque").checked = !!p.destaque;
  $("#f-ordem").value = p.ordem ?? produtos.length;
  fotos = Array.isArray(p.imagens) ? p.imagens.slice() : [];
  desenharFotos();
  atualizarCamposPeso();
  mostrar("#admin-form");
  window.scrollTo({ top: 0 });
}

$("#botao-novo").addEventListener("click", () => abrirFormulario(null));
$("#botao-cancelar").addEventListener("click", () => {
  aviso("");
  mostrar("#admin-lista");
});

/* ---------- Fotos ---------- */

function desenharFotos() {
  const lista = $("#fotos-lista");
  lista.replaceChildren();
  fotos.forEach((url, i) => {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Foto " + (i + 1) + (i === 0 ? " (principal)" : "");
    const acoes = document.createElement("div");
    acoes.className = "acoes";

    const botao = (texto, aoClicar, classe) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-mini" + (classe ? " " + classe : "");
      b.textContent = texto;
      b.addEventListener("click", aoClicar);
      return b;
    };
    if (i > 0) acoes.append(botao("Tornar principal", () => {
      fotos.unshift(fotos.splice(i, 1)[0]);
      desenharFotos();
    }));
    acoes.append(botao("Remover", () => {
      fotos.splice(i, 1);
      desenharFotos();
    }, "perigo"));
    li.append(img, acoes);
    lista.append(li);
  });
}

// Reduz a foto no navegador antes de enviar (fotos de celular são pesadas)
function reduzirFoto(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não consegui ler " + arquivo.name));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(arquivo.name + " não parece ser uma imagem."));
      img.onload = () => {
        const escala = Math.min(1, TAMANHO_MAX_FOTO / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao reduzir a foto."))), "image/jpeg", 0.85);
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

$("#f-fotos").addEventListener("change", async (e) => {
  const arquivos = Array.from(e.target.files);
  e.target.value = "";
  if (!arquivos.length) return;
  aviso("Enviando fotos...", false);
  try {
    const base = criarId($("#f-nome").value) || "produto";
    for (const arquivo of arquivos) {
      const blob = await reduzirFoto(arquivo);
      const caminho = base + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + ".jpg";
      const { error } = await banco.storage.from(BUCKET).upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      fotos.push(banco.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl);
    }
    desenharFotos();
    aviso("Fotos enviadas. Lembre de clicar em Salvar.", false);
  } catch (erro) {
    aviso("Erro ao enviar foto: " + (erro.message || erro));
  }
});

/* ---------- Salvar ---------- */

$("#form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const botao = $("#botao-salvar");
  botao.disabled = true;
  aviso("");

  const nome = $("#f-nome").value.trim();
  const peso = $("#f-unidade").value === "g";
  const id = editandoId || criarId(nome);
  if (!id) {
    aviso("Dê um nome ao produto.");
    botao.disabled = false;
    return;
  }

  const linha = {
    id,
    nome,
    categoria: $("#f-categoria").value,
    unidade: peso ? "g" : "un",
    preco: numeroOuNulo($("#f-preco").value),
    preco_por: peso ? numeroOuNulo($("#f-preco-por").value) : null,
    passo: peso ? numeroOuNulo($("#f-passo").value) : null,
    minimo: peso ? numeroOuNulo($("#f-minimo").value) : null,
    condicoes: $("#f-condicoes").value.trim(),
    descricao: $("#f-descricao").value.trim(),
    beneficios: $("#f-beneficios").value.split("\n").map((t) => t.trim()).filter(Boolean),
    descricao_completa: $("#f-descricao-completa").value.trim(),
    imagens: fotos,
    disponivel: $("#f-disponivel").checked,
    destaque: $("#f-destaque").checked,
    ordem: parseInt($("#f-ordem").value, 10) || 0,
  };

  const consulta = editandoId
    ? banco.from("produtos").update(linha).eq("id", editandoId)
    : banco.from("produtos").insert(linha);
  const { error } = await consulta;
  botao.disabled = false;

  if (error) {
    aviso(error.code === "23505"
      ? "Já existe um produto com esse nome. Mude um pouco o nome."
      : "Não consegui salvar: " + error.message);
    return;
  }
  await carregarLista();
  aviso('"' + nome + '" foi salvo.', false);
  window.scrollTo({ top: 0 });
});

/* ---------- Voltar para a lista ---------- */

// Volta para a lista da aba em que a pessoa estava (Produtos, Categorias ou Pedidos)
function voltarParaLista() {
  aviso("");
  mostrar(abaAtual === "categorias" ? "#admin-categorias" : abaAtual === "pedidos" ? "#admin-pedidos" : "#admin-lista");
  window.scrollTo({ top: 0 });
}
document.querySelectorAll("[data-voltar-lista]").forEach((b) => b.addEventListener("click", voltarParaLista));

/* ---------- Navegação ---------- */

// Clicar na logo ou em "Painel da loja" volta para o painel central (lista de produtos)
function irParaInicio(evento) {
  evento.preventDefault();
  if (!banco || $("#admin-login").hidden === false || !usuarioAtual) return;
  abaAtual = "produtos";
  aviso("");
  mostrar("#admin-lista");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$("#titulo-painel").addEventListener("click", irParaInicio);
$("#logo-painel").addEventListener("click", irParaInicio);

iniciar().catch((erro) => aviso("Erro ao iniciar o painel: " + (erro.message || erro)));
