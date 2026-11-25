-- Soporte de errores — actualización 4
-- Roles de administradores (tabla admins), respuestas a reportes y
-- confirmación del correo de Panchito si hace falta.
-- Idempotente: se puede ejecutar más de una vez.
-- Ejecuta antes supabase-setup.sql, supabase-update.sql,
-- supabase-update-2.sql y supabase-update-3.sql.

-- 1) Tabla de administradores.
--    role = 'super' puede todo; role = 'page' solo en allowed_pages.
create table if not exists public.admins (
  email text primary key,
  display_name text not null,
  role text not null,
  allowed_pages text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint admins_email_ok check (email = lower(email) and position('@' in email) > 1),
  constraint admins_name_len check (char_length(trim(display_name)) between 1 and 60),
  constraint admins_role_ok check (role in ('super', 'page')),
  constraint admins_pages_ok check (
    role = 'super'
    or (allowed_pages is not null and cardinality(allowed_pages) >= 1)
  )
);

alter table public.admins enable row level security;

drop policy if exists "admin_select_self" on public.admins;
create policy "admin_select_self"
  on public.admins
  for select
  to authenticated
  using (email = lower(coalesce(auth.jwt()->>'email', '')));

grant select on public.admins to authenticated;

-- No se pisa un display_name que ya se hubiera cambiado a mano.
insert into public.admins (email, display_name, role, allowed_pages)
values
  (
    'deibyrt107cali@gmail.com',
    'GamerCB',
    'super',
    array[
      'Chart Editor GCD',
      'FNF Packer',
      'Chart Convert',
      'Stage Convert',
      'FNF Test Song Chart Editor GCD'
    ]
  ),
  (
    'panchitomanriquez09@gmail.com',
    'Panchito',
    'page',
    array['Chart Convert', 'Stage Convert']
  )
on conflict (email) do update set
  role = excluded.role,
  allowed_pages = excluded.allowed_pages;


-- 2) Funciones de autorización (siempre leen la tabla admins, no el cliente).
create or replace function public.is_soporte_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where email = lower(coalesce(auth.jwt()->>'email', ''))
      and role = 'super'
  );
$$;

create or replace function public.admin_can_page(p_page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where a.email = lower(coalesce(auth.jwt()->>'email', ''))
      and (a.role = 'super' or p_page = any (a.allowed_pages))
  );
$$;

revoke all on function public.is_soporte_admin() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.admin_can_page(text) from public;
grant execute on function public.is_soporte_admin() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.admin_can_page(text) to anon, authenticated;


-- 3) Al insertar un mensaje, is_admin y el nombre salen de la tabla admins.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adm public.admins;
begin
  select * into adm
    from public.admins
   where email = lower(coalesce(auth.jwt()->>'email', ''))
   limit 1;
  if adm.email is not null then
    new.is_admin := true;
    new.name := adm.display_name;
  else
    new.is_admin := false;
  end if;
  new.solved := false;
  return new;
end;
$$;


-- 4) Marcar resuelto: solo un admin con derecho sobre la página del reporte.
create or replace function public.set_message_solved(p_id uuid, p_solved boolean)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.messages;
begin
  select * into rec from public.messages where id = p_id;
  if rec.id is null then
    raise exception 'Mensaje no encontrado';
  end if;
  if not public.admin_can_page(rec.page) then
    raise exception 'No autorizado';
  end if;
  update public.messages
     set solved = p_solved
   where id = p_id
   returning * into rec;
  return rec;
end;
$$;

revoke all on function public.set_message_solved(uuid, boolean) from public;
grant execute on function public.set_message_solved(uuid, boolean) to anon, authenticated;


-- 5) Borrar reportes: el admin de esa página (o el super).
drop policy if exists "admin_delete_messages" on public.messages;
create policy "admin_delete_messages"
  on public.messages
  for delete
  to authenticated
  using (public.admin_can_page(page));


-- 6) Tabla de respuestas (solo cuentas admin, hilo bajo el reporte).
create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id uuid not null references public.messages(id) on delete cascade,
  author_email text not null,
  name text not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  is_admin boolean not null default true,
  constraint replies_body_len check (char_length(trim(body)) between 1 and 4000),
  constraint replies_name_len check (char_length(trim(name)) between 1 and 60),
  constraint replies_attachments_array check (jsonb_typeof(attachments) = 'array'),
  constraint replies_attachments_max check (jsonb_array_length(attachments) <= 8)
);

create index if not exists replies_message_idx
  on public.replies (message_id, created_at);

alter table public.replies enable row level security;
alter table public.replies replica identity full;

create or replace function public.replies_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adm public.admins;
  msg_page text;
begin
  select * into adm
    from public.admins
   where email = lower(coalesce(auth.jwt()->>'email', ''))
   limit 1;
  if adm.email is null then
    raise exception 'No autorizado';
  end if;
  select page into msg_page from public.messages where id = new.message_id;
  if msg_page is null then
    raise exception 'Mensaje no encontrado';
  end if;
  if not (adm.role = 'super' or msg_page = any (adm.allowed_pages)) then
    raise exception 'No autorizado';
  end if;
  new.author_email := adm.email;
  new.name := adm.display_name;
  new.is_admin := true;
  new.body := trim(new.body);
  if new.attachments is null then
    new.attachments := '[]'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists replies_before_insert on public.replies;
create trigger replies_before_insert
  before insert on public.replies
  for each row
  execute procedure public.replies_before_insert();

drop policy if exists "select_replies" on public.replies;
create policy "select_replies"
  on public.replies
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admin_insert_replies" on public.replies;
create policy "admin_insert_replies"
  on public.replies
  for insert
  to authenticated
  with check (
    public.admin_can_page((select m.page from public.messages m where m.id = message_id))
    and char_length(trim(body)) between 1 and 4000
    and jsonb_typeof(coalesce(attachments, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(attachments, '[]'::jsonb)) <= 8
  );

drop policy if exists "admin_delete_replies" on public.replies;
create policy "admin_delete_replies"
  on public.replies
  for delete
  to authenticated
  using (
    public.is_super_admin()
    or (
      author_email = lower(coalesce(auth.jwt()->>'email', ''))
      and public.is_soporte_admin()
    )
  );

grant select on public.replies to anon, authenticated;
grant insert, delete on public.replies to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'replies'
  ) then
    execute 'alter publication supabase_realtime add table public.replies';
  end if;
end $$;


-- 7) Reacciones también en las respuestas.
alter table public.reactions drop constraint if exists reactions_target_type_ok;
alter table public.reactions
  add constraint reactions_target_type_ok
  check (target_type in ('news', 'message', 'reply'));

drop policy if exists "insert_reactions" on public.reactions;
create policy "insert_reactions"
  on public.reactions
  for insert
  to anon, authenticated
  with check (
    target_type in ('news', 'message', 'reply')
    and emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏')
    and char_length(device_id) between 8 and 80
  );


-- 8) Storage: solo un admin sube adjuntos de respuestas.
drop policy if exists "anon_upload_adjuntos" on storage.objects;
create policy "anon_upload_adjuntos"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'soporte-adjuntos'
    and coalesce((storage.foldername(name))[1], '') is distinct from 'noticias'
    and coalesce((storage.foldername(name))[1], '') is distinct from 'respuestas'
  );

drop policy if exists "admin_upload_respuestas" on storage.objects;
create policy "admin_upload_respuestas"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'soporte-adjuntos'
    and coalesce((storage.foldername(name))[1], '') = 'respuestas'
    and public.is_soporte_admin()
  );


-- 9) Si la cuenta de Panchito quedó sin confirmar el correo, confírmala.
--    Si el usuario aún no existe, este update no cambia nada.
update auth.users
   set email_confirmed_at = now()
 where email = 'panchitomanriquez09@gmail.com'
   and email_confirmed_at is null;

-- Listo. Recarga la página con Ctrl+F5.
