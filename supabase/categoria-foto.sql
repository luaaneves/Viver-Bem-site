-- Viver Bem – foto da categoria
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run. (Rodar só uma vez; pode rodar de novo sem problema.)
alter table public.categorias add column if not exists imagem text;
