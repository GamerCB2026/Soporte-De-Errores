-- Soporte de errores — setup de Supabase (plan gratis)
-- Pega este archivo completo en: SQL Editor → New query → Run
-- Puedes ejecutarlo más de una vez sin romper nada.

-- 1) Tabla de mensajes
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  category text not null,
  description text not null,
  attachments jsonb not null default '[]'::jsonb,
  constraint messages_name_len check (char_length(trim(name)) between 1 and 60),
  constraint messages_desc_len check (char_length(trim(description)) between 1 and 4000),
  constraint messages_category_ok check (category in (
    'Problemas Chart Editor GCD',
    'Problemas FNF Packer',
    'Problemas Chart Convert',
    'Problemas Stage Convert',
    'Problema FNF Test Song Chart Editor GCD'
  )),
  constraint messages_attachments_array check (jsonb_typeof(attachments) = 'array'),
  constraint messages_attachments_max check (jsonb_array_length(attachments) <= 8)
);

create index if not exists messages_created_at_idx on public.messages (created_at);

alter table public.messages enable row level security;

drop policy if exists "anon_select_messages" on public.messages;
create policy "anon_select_messages"
  on public.messages
  for select
  to anon
  using (true);

drop policy if exists "anon_insert_messages" on public.messages;
create policy "anon_insert_messages"
  on public.messages
  for insert
  to anon
  with check (
    char_length(trim(name)) between 1 and 60
    and char_length(trim(description)) between 1 and 4000
    and category in (
      'Problemas Chart Editor GCD',
      'Problemas FNF Packer',
      'Problemas Chart Convert',
      'Problemas Stage Convert',
      'Problema FNF Test Song Chart Editor GCD'
    )
    and jsonb_typeof(attachments) = 'array'
    and jsonb_array_length(attachments) <= 8
  );

-- Los visitantes no pueden editar ni borrar mensajes.

-- 2) Chat en vivo (Realtime)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- 3) Carpeta pública para fotos y videos (hasta 100 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'soporte-adjuntos',
  'soporte-adjuntos',
  true,
  104857600,
  array['image/*', 'video/*']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon_read_adjuntos" on storage.objects;
create policy "anon_read_adjuntos"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'soporte-adjuntos');

drop policy if exists "anon_upload_adjuntos" on storage.objects;
create policy "anon_upload_adjuntos"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'soporte-adjuntos');
-- Los tipos image/* y video/* y el tope de 100 MB se aplican en el bucket
-- (allowed_mime_types y file_size_limit). La página también lo valida.

-- Listo. Ahora copia la Project URL y la clave anon public a js/config.js
