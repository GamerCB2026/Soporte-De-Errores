-- Soporte de errores — actualización
-- Pega este archivo completo en: SQL Editor → New query → Run
-- Es seguro ejecutarlo más de una vez.
-- Necesario para las categorías nuevas, el estado resuelto, el admin y las noticias.

-- 1) Columnas nuevas en mensajes
alter table public.messages
  add column if not exists solved boolean not null default false;

alter table public.messages
  add column if not exists is_admin boolean not null default false;

-- 2) Categorías nuevas (se mantienen las antiguas para no romper mensajes ya enviados)
alter table public.messages drop constraint if exists messages_category_ok;

alter table public.messages add constraint messages_category_ok check (category in (
  'Error de imagen',
  'Error de carga',
  'Error de descarga',
  'Error de video',
  'Error de procesamiento',
  'Otro',
  'Problemas Chart Editor GCD',
  'Problemas FNF Packer',
  'Problemas Chart Convert',
  'Problemas Stage Convert',
  'Problema FNF Test Song Chart Editor GCD'
));

-- 3) Quién es admin: solo este correo, leído del JWT (nunca desde el cliente)
create or replace function public.is_soporte_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'deibyrt107cali@gmail.com';
$$;

-- 4) Al insertar un mensaje: is_admin y solved los pone el servidor.
--    Si el admin está conectado, el nombre queda en GamerCB.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_soporte_admin() then
    new.is_admin := true;
    new.name := 'GamerCB';
  else
    new.is_admin := false;
  end if;
  new.solved := false;
  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert
  before insert on public.messages
  for each row
  execute procedure public.messages_before_insert();

-- 5) Políticas de mensajes: lectura para todos; insertar solo con las categorías nuevas
drop policy if exists "anon_select_messages" on public.messages;
drop policy if exists "select_messages" on public.messages;
create policy "select_messages"
  on public.messages
  for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_insert_messages" on public.messages;
drop policy if exists "insert_messages" on public.messages;
create policy "insert_messages"
  on public.messages
  for insert
  to anon, authenticated
  with check (
    char_length(trim(name)) between 1 and 60
    and char_length(trim(description)) between 1 and 4000
    and category in (
      'Error de imagen',
      'Error de carga',
      'Error de descarga',
      'Error de video',
      'Error de procesamiento',
      'Otro'
    )
    and jsonb_typeof(attachments) = 'array'
    and jsonb_array_length(attachments) <= 8
  );

-- Nadie actualiza ni borra mensajes por la API, salvo el RPC de abajo.

-- 6) Solo el admin puede marcar un error como resuelto o pendiente
create or replace function public.set_message_solved(p_id uuid, p_solved boolean)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.messages;
begin
  if not public.is_soporte_admin() then
    raise exception 'No autorizado';
  end if;
  update public.messages
     set solved = p_solved
   where id = p_id
   returning * into rec;
  if rec.id is null then
    raise exception 'Mensaje no encontrado';
  end if;
  return rec;
end;
$$;

revoke all on function public.set_message_solved(uuid, boolean) from public;
grant execute on function public.set_message_solved(uuid, boolean) to anon, authenticated;
grant execute on function public.is_soporte_admin() to anon, authenticated;

alter table public.messages replica identity full;

-- 7) Tabla de noticias
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  body text not null,
  image_url text,
  constraint news_title_len check (char_length(trim(title)) between 1 and 120),
  constraint news_body_len check (char_length(trim(body)) between 1 and 8000),
  constraint news_image_url_ok check (image_url is null or image_url ~* '^https?://')
);

create index if not exists news_created_at_idx on public.news (created_at desc);

alter table public.news enable row level security;
alter table public.news replica identity full;

drop policy if exists "select_news" on public.news;
create policy "select_news"
  on public.news
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin_insert_news" on public.news;
create policy "admin_insert_news"
  on public.news
  for insert
  to authenticated
  with check (
    public.is_soporte_admin()
    and char_length(trim(title)) between 1 and 120
    and char_length(trim(body)) between 1 and 8000
  );

drop policy if exists "admin_delete_news" on public.news;
create policy "admin_delete_news"
  on public.news
  for delete
  to authenticated
  using (public.is_soporte_admin());

-- 8) Realtime para noticias (y se mantienen los mensajes)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'news'
  ) then
    execute 'alter publication supabase_realtime add table public.news';
  end if;
end $$;

-- 9) Storage: cualquiera sube adjuntos de errores; solo el admin sube/borra fotos de noticias
drop policy if exists "anon_read_adjuntos" on storage.objects;
create policy "anon_read_adjuntos"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'soporte-adjuntos');

drop policy if exists "anon_upload_adjuntos" on storage.objects;
create policy "anon_upload_adjuntos"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'soporte-adjuntos'
    and coalesce((storage.foldername(name))[1], '') is distinct from 'noticias'
  );

drop policy if exists "admin_upload_noticias" on storage.objects;
create policy "admin_upload_noticias"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'soporte-adjuntos'
    and coalesce((storage.foldername(name))[1], '') = 'noticias'
    and public.is_soporte_admin()
  );

drop policy if exists "admin_delete_noticias" on storage.objects;
create policy "admin_delete_noticias"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'soporte-adjuntos'
    and coalesce((storage.foldername(name))[1], '') = 'noticias'
    and public.is_soporte_admin()
  );


grant select, insert on public.messages to anon, authenticated;
grant select on public.news to anon, authenticated;
grant insert, delete on public.news to authenticated;
grant usage on schema public to anon, authenticated;

-- Listo. Recarga la página con Ctrl+F5.
