-- Images in posts live in a public Storage bucket.
--
--   * Reading: the app serves them from /media/<owner id>/<file>, which next.config.ts rewrites
--     to this bucket's public URL. A public bucket needs no policy for that.
--   * Writing: only the app's server writes, with the service role (it checks the session, the
--     rate limit and the file's real type first), which bypasses row level security. There is
--     deliberately NO insert/update/delete policy on storage.objects, so a signed-in user cannot
--     upload to the bucket directly with their own token and skip those checks.
--   * The bucket itself also refuses anything that is not a small picture.
--
-- Supabase has the `storage` schema; the plain Postgres used for local development and the SQL
-- tests does not, so there this migration does nothing (scripts/dev/mock-supabase.mjs fakes
-- the storage API instead).

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('post-images', 'post-images', true, 3145728, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
