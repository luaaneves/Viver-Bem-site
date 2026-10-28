# Guia: ligar o site ao Supabase (banco + painel)

Tempo: uns 20 minutos. Custa R$ 0 no plano gratuito.

Enquanto o `js/config.js` estiver vazio, o site continua funcionando com o `data/produtos.json`. Nada quebra.

## 1. Criar o projeto
1. Entre em supabase.com e crie uma conta (pode ser com o GitHub).
2. **New project**. Nome: `viver-bem`. Crie uma senha forte para o banco e guarde. Região: South America (São Paulo).
3. Espere uns 2 minutos até o projeto ficar pronto.

## 2. Criar as tabelas e as regras de segurança
1. No menu da esquerda: **SQL Editor** > **New query**.
2. Abra o arquivo `supabase/schema.sql`, copie tudo, cole lá e clique em **Run**.
3. Deve aparecer "Success". Isso cria as tabelas `categorias` (já com as 4 atuais) e `produtos`, a pasta de fotos `produtos` e as regras:
   - qualquer pessoa **vê** os produtos e as fotos (o site precisa disso);
   - só quem **fez login** cria, altera ou apaga.

## 3. Criar o login da equipe
1. **Authentication** > **Users** > **Add user** > **Create new user**.
2. Coloque o e-mail e a senha da funcionária (e o seu). Marque **Auto Confirm User**.
3. **Authentication** > **Sign In / Providers** (ou **Settings**): **desligue "Allow new users to sign up"**. Assim ninguém de fora cria conta. Este passo é importante: qualquer pessoa logada consegue editar os produtos.

## 4. Copiar o endereço e a chave para o site
1. **Project Settings** (engrenagem) > **API** (ou **Data API**).
2. Copie o **Project URL** e a chave **anon / public**.
3. Cole no `js/config.js`:
   ```js
   const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...";
   ```
4. A chave **anon** pode ficar no site, porque as regras do passo 2 protegem os dados. **Nunca** coloque a chave `service_role`.

## 5. Primeiro acesso ao painel
1. Abra `admin.html` pelo Live Server e entre com o e-mail e a senha criados.
2. Se a lista estiver vazia, clique em **Importar os produtos de exemplo**.
3. Abra a Home e a página Produtos: agora os dados vêm do banco.
4. Teste: crie um produto com foto, marque e desmarque "Disponível" e veja no site.

## Pedidos
- Rode o arquivo `supabase/pedidos.sql` uma vez no SQL Editor (se você rodou o `schema.sql` novo inteiro, já está incluído).
- Quando o cliente clica em "Finalizar pelo WhatsApp", o pedido é gravado com um **número** (1, 2, 3...) e a mensagem do WhatsApp já vai com "pedido nº X".
- No painel, aba **Pedidos**: lista, filtro por estado (Novo, Combinado, Entregue, Cancelado), detalhes dos itens, anotações da equipe. O número vermelho na aba mostra quantos pedidos novos existem.
- Os preços do pedido são calculados no servidor, então o cliente não consegue mandar preço falso.
- Se o registro falhar (internet, por exemplo), o WhatsApp abre do mesmo jeito, sem número, para não perder a venda.

## Como a funcionária usa o painel
- **Abas Produtos e Categorias**: no topo do painel.
- **Categoria nova**: aba Categorias > Nova categoria. Ela aparece sozinha na Home, nos filtros do catálogo e na hora de cadastrar produto.
- **Esconder uma categoria**: desmarque "Ativa". A categoria e os produtos dela somem do site, sem apagar nada.
- **Apagar categoria**: só funciona se ela não tiver produtos.
- **Novo produto**: preencha, adicione fotos e clique em Salvar. As fotos são reduzidas sozinhas.
- **Produto acabou**: desmarque "Disponível" na lista. Ele continua no catálogo, marcado como indisponível, e não pode ser comprado.
- **Granel**: em "Como é vendido" escolha "Por peso". Preço = valor para X gramas (ex.: R$ 12,50 a cada 100 g), com passo de 50 g.
- **Destaque**: marca o que aparece na Home (até 12; na Home eles rolam de lado).

## Ao publicar o site
- O `admin.html` fica no ar, mas sem login ninguém altera nada. Se quiser esconder o endereço, renomeie o arquivo (ex.: `painel-vb.html`).
- Em Authentication > URL Configuration, coloque o endereço final do site.
- O plano gratuito pausa projetos sem uso por 7 dias. Como o site vai ser acessado, isso costuma não ser problema, mas fique de olho.

## O que ainda fica para depois
- Cadastro/login de **clientes** e histórico de pedidos (hoje o pedido sai pelo WhatsApp).
- Controle de **estoque** em quantidade (hoje é só disponível ou indisponível).
