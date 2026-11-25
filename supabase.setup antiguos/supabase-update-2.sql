-- Soporte de errores — actualización 2
-- Pega este archivo completo en: SQL Editor → New query → Run
-- Es seguro ejecutarlo más de una vez.
-- Añade la columna "page" (las 5 páginas web), rellena los mensajes viejos
-- y permite que el admin borre reportes.

-- 1) Columna page
alter table public.messages
  add column if not exists page text;

-- 2) Rellenar mensajes antiguos: si la categoría vieja nombraba una página, se usa esa;
--    si no hay página, queda en "Chart Editor GCD".
update public.messages
set page = case
  when page in (
    'Chart Editor GCD',
    'FNF Packer',
    'Chart Convert',
    'Stage Convert',
    'FNF Test Song Chart Editor GCD'
  ) then page
  when category = 'Problemas Chart Editor GCD' then 'Chart Editor GCD'
  when category = 'Problemas FNF Packer' then 'FNF Packer'
  when category = 'Problemas Chart Convert' then 'Chart Convert'
  when category = 'Problemas Stage Convert' then 'Stage Convert'
  when category = 'Problema FNF Test Song Chart Editor GCD' then 'FNF Test Song Chart Editor GCD'
  else 'Chart Editor GCD'
end
where page is null
   or page not in (
    'Chart Editor GCD',
    'FNF Packer',
    'Chart Convert',
    'Stage Convert',
    'FNF Test Song Chart Editor GCD'
  );

alter table public.messages
  alter column page set default 'Chart Editor GCD';

alter table public.messages
  alter column page set not null;

alter table public.messages drop constraint if exists messages_page_ok;
alter table public.messages add constraint messages_page_ok check (page in (
  'Chart Editor GCD',
  'FNF Packer',
  'Chart Convert',
  'Stage Convert',
  'FNF Test Song Chart Editor GCD'
));

-- 3) Política de inserción: página y tipo de error obligatorios (valores nuevos)
drop policy if exists "anon_insert_messages" on public.messages;
drop policy if exists "insert_messages" on public.messages;
create policy "insert_messages"
  on public.messages
  for insert
  to anon, authenticated
  with check (
    char_length(trim(name)) between 1 and 60
    and char_length(trim(description)) between 1 and 4000
    and page in (
      'Chart Editor GCD',
      'FNF Packer',
      'Chart Convert',
      'Stage Convert',
      'FNF Test Song Chart Editor GCD'
    )
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

-- 4) Solo el admin (correo del JWT) puede borrar mensajes
drop policy if exists "admin_delete_messages" on public.messages;
create policy "admin_delete_messages"
  on public.messages
  for delete
  to authenticated
  using (public.is_soporte_admin());

grant delete on public.messages to authenticated;

-- Para que el chat en vivo reciba el borrado completo
alter table public.messages replica identity full;


-- 5) El admin también puede borrar de Storage los adjuntos del reporte
drop policy if exists "admin_delete_adjuntos" on storage.objects;
create policy "admin_delete_adjuntos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'soporte-adjuntos'
    and public.is_soporte_admin()
  );

-- Listo. Recarga la página con Ctrl+F5.
