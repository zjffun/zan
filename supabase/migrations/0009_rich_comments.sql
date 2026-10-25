-- Comments are written in the same editor as posts (bold, links, quotes, lists, code, time labels).
--
-- comments.doc holds the document (TipTap JSON, always cleaned by the server first: paragraphs,
-- quotes, lists, code and links only). comments.body stays: it is the same comment in plain text, which is what the
-- 1–1000 characters are counted on, and what shows for comments written before this (doc is null).
--
-- This migration only ADDS a column, so the application can be deployed before or after it.

alter table public.comments
  add column doc jsonb
    check (doc is null or (jsonb_typeof(doc) = 'object' and pg_column_size(doc) < 50000));

-- the same right as the other columns of a comment: whoever writes it, and nobody else
grant insert (doc) on public.comments to authenticated;
