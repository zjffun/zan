-- Comment authors may correct their own comments. Post authors can still remove
-- other people's comments, but cannot rewrite them.

create policy comments_update on public.comments for update to authenticated
  using (
    author = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
  )
  with check (
    author = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
  );

-- Column grants keep identity, thread placement and creation time immutable.
grant update (body, doc) on public.comments to authenticated;
