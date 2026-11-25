-- Soporte de errores — actualización 3
-- Pega este archivo completo en: SQL Editor → New query → Run
-- Es seguro ejecutarlo más de una vez.
-- Editar noticias, varios adjuntos (fotos y videos) y reacciones con emojis.

-- 1) Noticias: fecha de edición y lista de adjuntos
alter table public.news
  add column if not exists updated_at timestamptz;

alter table public.news
  add column if not exists attachments jsonb not null default '[]'::jsonb;

update public.news
set attachments = jsonb_build_array(
  jsonb_build_object('url', image_url, 'type', 'image/*', 'name', 'imagen')
)
where (attachments is null or attachments = '[]'::jsonb)
  and image_url is not null
  and image_url ~* '^https?://';

alter table public.news drop constraint if exists news_attachments_array;
alter table public.news add constraint news_attachments_array
  check (jsonb_typeof(attachments) = 'array');

alter table public.news drop constraint if exists news_attachments_max;
alter table public.news add constraint news_attachments_max
  check (jsonb_array_length(attachments) <= 8);

create or replace function public.news_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists news_set_updated_at on public.news;
create trigger news_set_updated_at
  before update on public.news
  for each row
  execute procedure public.news_set_updated_at();

drop policy if exists "admin_update_news" on public.news;
create policy "admin_update_news"
  on public.news
  for update
  to authenticated
  using (public.is_soporte_admin())
  with check (
    public.is_soporte_admin()
    and char_length(trim(title)) between 1 and 120
    and char_length(trim(body)) between 1 and 8000
    and jsonb_typeof(attachments) = 'array'
    and jsonb_array_length(attachments) <= 8
  );

grant update on public.news to authenticated;

alter table public.news replica identity full;

-- 2) Reacciones (noticias y reportes). Un emoji por dispositivo; se puede quitar.
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  target_type text not null,
  target_id uuid not null,
  emoji text not null,
  device_id text not null,
  constraint reactions_target_type_ok check (target_type in ('news', 'message')),
  constraint reactions_emoji_ok check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏')),
  constraint reactions_device_len check (char_length(device_id) between 8 and 80)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reactions_unique'
      and conrelid = 'public.reactions'::regclass
  ) then
    alter table public.reactions
      add constraint reactions_unique unique (target_type, target_id, emoji, device_id);
  end if;
end $$;

create index if not exists reactions_target_idx
  on public.reactions (target_type, target_id);

alter table public.reactions enable row level security;
alter table public.reactions replica identity full;

drop policy if exists "select_reactions" on public.reactions;
create policy "select_reactions"
  on public.reactions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "insert_reactions" on public.reactions;
create policy "insert_reactions"
  on public.reactions
  for insert
  to anon, authenticated
  with check (
    target_type in ('news', 'message')
    and emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏')
    and char_length(device_id) between 8 and 80
  );

-- El cliente siempre filtra por su device_id al borrar (aceptable en este uso).
drop policy if exists "delete_reactions" on public.reactions;
create policy "delete_reactions"
  on public.reactions
  for delete
  to anon, authenticated
  using (true);

grant select, insert, delete on public.reactions to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.reactions';
  end if;
end $$;

-- Listo. Recarga la página con Ctrl+F5.
