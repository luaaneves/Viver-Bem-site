# 🌿 Viver Bem — site de loja de produtos naturais

Site de uma loja real de produtos naturais (suplementos, chás, granel e cosméticos), com catálogo online, carrinho e pedidos finalizados pelo WhatsApp. A equipe da loja tem um painel próprio para cuidar dos produtos e acompanhar os pedidos.

🔗 **Site no ar:** [viverbem-naturais.netlify.app](https://viverbem-naturais.netlify.app)

---

## ✨ Funcionalidades

**Para o cliente**
- Catálogo de produtos separado por categorias
- Página de detalhe de cada produto, com fotos, descrição e benefícios
- Carrinho de compras, com escolha de quantidade em gramas para produtos a granel
- Finalização do pedido pelo WhatsApp, com a mensagem já montada e o número do pedido

**Para a equipe da loja (painel administrativo)**
- Login da equipe
- Cadastro, edição e remoção de produtos e categorias, com envio de fotos
- Lista de pedidos com número, itens, total e status (novo, combinado, entregue, cancelado)

---

## 🗄️ Banco de dados e segurança

O banco é PostgreSQL, hospedado no Supabase.

- **Regras de acesso (RLS):** qualquer pessoa pode ver produtos e categorias, mas só a equipe logada pode alterar. Os pedidos não ficam visíveis para o público.
- **Preço calculado no servidor:** ao finalizar a compra, o site chama a função `criar_pedido`, que confere os produtos e calcula os preços no banco. Assim, o cliente não consegue enviar um preço falso.
- **Pedido numerado:** cada pedido recebe um número sequencial (1, 2, 3...), que vai na mensagem do WhatsApp para a equipe achar a conversa certa.
- **A venda não para:** se o registro do pedido falhar, o WhatsApp abre do mesmo jeito.

Os scripts do banco estão na pasta [`supabase/`](supabase/).

---

## 🛠️ Tecnologias

`HTML` `CSS` `JavaScript` `Supabase` `PostgreSQL` `Netlify`

---

## 📁 Estrutura

```
├── index.html        # página inicial
├── produtos.html     # catálogo
├── produto.html      # detalhe do produto
├── carrinho.html     # carrinho e finalização pelo WhatsApp
├── admin.html        # painel da equipe
├── css/              # estilos
├── js/               # lógica do site, do carrinho e do painel
├── data/             # dados de exemplo (usados quando o Supabase não está configurado)
├── supabase/         # scripts SQL do banco
└── assets/           # logos, ícones e fotos
```

---

Desenvolvido por **Luana Almeida Neves** · [LinkedIn](https://www.linkedin.com/in/luana-neves-15767a447)
