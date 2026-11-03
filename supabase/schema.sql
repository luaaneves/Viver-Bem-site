-- Viver Bem – estrutura do banco (Supabase)
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run.

-- 0) Categorias (a equipe cria, renomeia e desativa pelo painel)
create table if not exists public.categorias (
  slug  text primary key,          -- ex.: "chas" (vai no endereço: produtos.html?categoria=chas)
  nome  text not null,             -- ex.: "Chás"
  ordem integer not null default 0,
  ativa boolean not null default true
);

insert into public.categorias (slug, nome, ordem) values
  ('suplementos', 'Suplementos', 0),
  ('chas',        'Chás',        1),
  ('granel',      'Granel',      2),
  ('cosmeticos',  'Cosméticos',  3)
on conflict (slug) do nothing;

-- (foto da categoria: aparece no cartão da Home)
alter table public.categorias add column if not exists imagem text;

-- 1) Tabela de produtos (cada coluna = um campo do antigo produtos.json)
create table if not exists public.produtos (
  id                 text primary key,            -- ex.: "cha-camomila" (vira o ?id= do link)
  nome               text not null,
  categoria          text not null references public.categorias(slug) on update cascade,
  preco              numeric(10,2),               -- preço normal, ou preço por "preco_por" gramas no granel
  unidade            text not null default 'un' check (unidade in ('un','g')),
  preco_por          integer,                     -- só granel: o preço vale para quantas gramas (ex.: 100)
  passo              integer,                     -- só granel: de quantas em quantas gramas (ex.: 50)
  minimo             integer,                     -- só granel: quantidade mínima em gramas
  condicoes          text,
  descricao          text,
  beneficios         jsonb not null default '[]'::jsonb,   -- lista de textos
  descricao_completa text,
  imagens            jsonb not null default '[]'::jsonb,   -- lista de endereços das fotos
  disponivel         boolean not null default true,
  destaque           boolean not null default false,
  ordem              integer not null default 0,
  atualizado_em      timestamptz not null default now()
);

-- (se a tabela já existia com a lista fixa de categorias, solta essa trava e liga à tabela nova)
alter table public.produtos drop constraint if exists produtos_categoria_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_categoria_fkey') then
    alter table public.produtos add constraint produtos_categoria_fkey
      foreign key (categoria) references public.categorias(slug) on update cascade;
  end if;
end $$;

create or replace function public.marcar_atualizacao() returns trigger
language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists produtos_atualizacao on public.produtos;
create trigger produtos_atualizacao before update on public.produtos
for each row execute function public.marcar_atualizacao();

-- 2) Segurança (RLS): qualquer pessoa LÊ; só quem fez login ESCREVE
alter table public.produtos enable row level security;
alter table public.categorias enable row level security;

drop policy if exists "todos leem categorias" on public.categorias;
create policy "todos leem categorias" on public.categorias for select using (true);
drop policy if exists "equipe cria categorias" on public.categorias;
create policy "equipe cria categorias" on public.categorias for insert to authenticated with check (true);
drop policy if exists "equipe altera categorias" on public.categorias;
create policy "equipe altera categorias" on public.categorias for update to authenticated using (true) with check (true);
drop policy if exists "equipe apaga categorias" on public.categorias;
create policy "equipe apaga categorias" on public.categorias for delete to authenticated using (true);

drop policy if exists "todos leem produtos" on public.produtos;
create policy "todos leem produtos" on public.produtos
  for select using (true);

drop policy if exists "equipe cria produtos" on public.produtos;
create policy "equipe cria produtos" on public.produtos
  for insert to authenticated with check (true);

drop policy if exists "equipe altera produtos" on public.produtos;
create policy "equipe altera produtos" on public.produtos
  for update to authenticated using (true) with check (true);

drop policy if exists "equipe apaga produtos" on public.produtos;
create policy "equipe apaga produtos" on public.produtos
  for delete to authenticated using (true);

-- 3) Pasta de fotos (Storage): pública para ver, só a equipe envia
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

drop policy if exists "todos veem fotos" on storage.objects;
create policy "todos veem fotos" on storage.objects
  for select using (bucket_id = 'produtos');

drop policy if exists "equipe envia fotos" on storage.objects;
create policy "equipe envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos');

drop policy if exists "equipe troca fotos" on storage.objects;
create policy "equipe troca fotos" on storage.objects
  for update to authenticated using (bucket_id = 'produtos');

drop policy if exists "equipe apaga fotos" on storage.objects;
create policy "equipe apaga fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'produtos');

-- 4) Permissões de acesso à API (funciona com "Automatically expose new tables" ligado ou desligado)
grant usage on schema public to anon, authenticated;
grant select on public.produtos, public.categorias to anon, authenticated;
grant insert, update, delete on public.produtos, public.categorias to authenticated;

-- 5) Pedidos (veja também supabase/pedidos.sql)
-- 1) Tabela de pedidos (numero = 1, 2, 3, 4... automático)
create table if not exists public.pedidos (
  numero     bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  status     text not null default 'novo' check (status in ('novo','combinado','entregue','cancelado')),
  nome       text,                    -- opcional, o cliente pode informar no carrinho
  itens      jsonb not null,          -- cópia dos itens, com nome e preço da hora do pedido
  total      numeric(10,2),           -- null = algum item sem preço
  observacao text                     -- anotação da equipe
);

-- 2) Segurança: o público NÃO lê nem altera pedidos; só a equipe logada
alter table public.pedidos enable row level security;

drop policy if exists "equipe ve pedidos" on public.pedidos;
create policy "equipe ve pedidos" on public.pedidos for select to authenticated using (true);
drop policy if exists "equipe altera pedidos" on public.pedidos;
create policy "equipe altera pedidos" on public.pedidos for update to authenticated using (true) with check (true);
drop policy if exists "equipe apaga pedidos" on public.pedidos;
create policy "equipe apaga pedidos" on public.pedidos for delete to authenticated using (true);

grant select, update, delete on public.pedidos to authenticated;

-- 3) Função que o site chama ao clicar em "Finalizar pelo WhatsApp".
--    Ela confere os produtos e CALCULA OS PREÇOS no servidor (o cliente não consegue mandar preço falso)
--    e devolve o número do pedido.
create or replace function public.criar_pedido(p_nome text, p_itens jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  item     jsonb;
  prod     public.produtos%rowtype;
  qtd      numeric;
  sub      numeric;
  total    numeric := 0;
  sem_preco boolean := false;
  lista    jsonb := '[]'::jsonb;
  novo     bigint;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 50 then
    raise exception 'pedido invalido';
  end if;

  for item in select value from jsonb_array_elements(p_itens) loop
    qtd := (item->>'qtd')::numeric;
    if qtd is null or qtd <= 0 or qtd > 100000 then
      raise exception 'quantidade invalida';
    end if;

    select * into prod from public.produtos where id = item->>'id' and disponivel;
    if not found then
      raise exception 'produto indisponivel';
    end if;

    if prod.preco is null then
      sub := null;
      sem_preco := true;
    else
      sub := round(prod.preco * qtd / case when prod.unidade = 'g' then coalesce(prod.preco_por, 100) else 1 end, 2);
      total := total + sub;
    end if;

    lista := lista || jsonb_build_object(
      'id', prod.id,
      'nome', prod.nome,
      'qtd', qtd,
      'unidade', prod.unidade,
      'preco', prod.preco,
      'preco_por', case when prod.unidade = 'g' then coalesce(prod.preco_por, 100) end,
      'subtotal', sub
    );
  end loop;

  insert into public.pedidos (nome, itens, total)
  values (nullif(left(trim(coalesce(p_nome, '')), 80), ''), lista, case when sem_preco then null else total end)
  returning numero into novo;

  return novo;
end $$;

revoke all on function public.criar_pedido(text, jsonb) from public;
grant execute on function public.criar_pedido(text, jsonb) to anon, authenticated;
