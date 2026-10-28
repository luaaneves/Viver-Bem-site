-- Viver Bem – registro de pedidos
-- Rode este arquivo UMA vez no Supabase (SQL Editor > New query > cole tudo > Run).

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
