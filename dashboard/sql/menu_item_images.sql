-- Imágenes de productos del menú (WebP en Storage + rutas en menu_items).
-- Ejecutar en Supabase SQL Editor después del esquema base.

alter table public.menu_items
  add column if not exists image_thumb_path text,
  add column if not exists image_full_path text;

comment on column public.menu_items.image_thumb_path is
  'Ruta en bucket menu-images (miniatura WebP, ~96px).';
comment on column public.menu_items.image_full_path is
  'Ruta en bucket menu-images (imagen WebP optimizada, ancho máx. ~800px).';

-- Bucket público para lectura en QR menú, carta y panel mozo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura pública (clientes / mozo / menú QR).
drop policy if exists "menu_images_public_read" on storage.objects;
create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

-- Escritura desde el panel (anon/authenticated con service key o políticas amplias).
drop policy if exists "menu_images_insert" on storage.objects;
create policy "menu_images_insert"
  on storage.objects for insert
  with check (bucket_id = 'menu-images');

drop policy if exists "menu_images_update" on storage.objects;
create policy "menu_images_update"
  on storage.objects for update
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

drop policy if exists "menu_images_delete" on storage.objects;
create policy "menu_images_delete"
  on storage.objects for delete
  using (bucket_id = 'menu-images');
