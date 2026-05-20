-- db/storage_avatars_bucket.sql
-- Run in Supabase SQL Editor: creates the public "avatars" bucket used by /api/auth/profile/upload
-- Object names must match: avatar_<user_uuid>_<timestamp>.<ext> (enforced in RLS for non–service-role clients)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (bucket is public; URLs come from getPublicUrl)
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users may only write files named avatar_<their-uuid>_...
drop policy if exists "Users insert own avatar file" on storage.objects;
create policy "Users insert own avatar file"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and starts_with(name, 'avatar_' || auth.uid()::text || '_')
  );

drop policy if exists "Users update own avatar file" on storage.objects;
create policy "Users update own avatar file"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and starts_with(name, 'avatar_' || auth.uid()::text || '_')
  )
  with check (
    bucket_id = 'avatars'
    and starts_with(name, 'avatar_' || auth.uid()::text || '_')
  );

drop policy if exists "Users delete own avatar file" on storage.objects;
create policy "Users delete own avatar file"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and starts_with(name, 'avatar_' || auth.uid()::text || '_')
  );
