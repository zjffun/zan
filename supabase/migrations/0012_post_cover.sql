-- A feed card shows the first picture of a post (when the post has no video to show instead).
--
-- posts.cover_image is the key of that picture (see lib/image.ts: "<author id>/<id>.<ext>"), set by the
-- application whenever it saves a post, so that a card does not have to load the whole text of every post
-- to find it. It is only a copy of what the text says: the text stays the truth.
--
-- This migration only ADDS a column, so the application can be deployed before or after it
-- (a deployment from before simply leaves it empty).

alter table public.posts
  add column cover_image text
    check (cover_image is null
           or cover_image ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|gif)$');

-- the posts that are there: the first picture of the text, in reading order, as the application finds it
create function public.first_image_key(node jsonb) returns text
language plpgsql immutable as $$
declare
  child jsonb;
  found text;
begin
  if node ->> 'type' = 'image' then
    return node -> 'attrs' ->> 'key';
  end if;
  if jsonb_typeof(node -> 'content') = 'array' then
    for child in select value from jsonb_array_elements(node -> 'content') loop
      found := public.first_image_key(child);
      if found is not null then
        return found;
      end if;
    end loop;
  end if;
  return null;
end
$$;

-- (a key that does not look like one of ours, which the application never lets through, is left out)
update public.posts
set cover_image = public.first_image_key(body)
where public.first_image_key(body) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|gif)$';

drop function public.first_image_key(jsonb);

-- the same right as the other columns of a post: its author writes it, nobody else
grant insert (cover_image) on public.posts to authenticated;
grant update (cover_image) on public.posts to authenticated;
