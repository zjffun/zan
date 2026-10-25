-- The positions of a post (12:34, p.132, E5 12:34 …) used to live in a list of their own
-- (posts.anchors, and posts.anchor before that). The editor no longer has that list: a position is a
-- line of text, and a time in it is a label that can be clicked. This moves what is left in the lists
-- to the top of the text of its post, one line per position, the way the application did when its
-- author opened such a post to edit it:
--
--   a time            -> a time label (with the episode or page written out in front, if it had one)
--   a time range, a page, an episode, a chapter, a percentage -> plain text ("12:34–12:40", "p.132", "ch.3", "41%")
--   its description   -> after it, in the same line
--
-- The lists are emptied; the columns are dropped by the next migration, once nothing reads them
-- any more (this one only changes data, so the application can be deployed before or after it).
-- It is not an edit by the author: updated_at stays.

create function public.legacy_clock(seconds numeric) returns text
language sql immutable as $$
  select case
    when floor(seconds) >= 3600
      then (floor(seconds) / 3600)::int::text || ':' || lpad(((floor(seconds)::int % 3600) / 60)::text, 2, '0') || ':' || lpad((floor(seconds)::int % 60)::text, 2, '0')
    else ((floor(seconds)::int % 3600) / 60)::text || ':' || lpad((floor(seconds)::int % 60)::text, 2, '0')
  end
$$;

-- "E5 12:34", "12:34–12:40", "p.132", "ch.3", "41%": the label that anchorLabel() in the application makes
create function public.legacy_label(a jsonb) returns text
language sql immutable as $$
  select concat_ws(' ',
    case when a ? 'ep' then 'E' || (a ->> 'ep') end,
    case when a ? 't' then
      case when a ? 't_end' and (a ->> 't_end')::numeric <> (a ->> 't')::numeric
        then public.legacy_clock((a ->> 't')::numeric) || '–' || public.legacy_clock((a ->> 't_end')::numeric)
        else public.legacy_clock((a ->> 't')::numeric)
      end
    end,
    case when a ? 'page' then 'p.' || (a ->> 'page') end,
    case when a ? 'chapter' and not a ? 'page' then 'ch.' || (a ->> 'chapter') end,
    case when a ? 'percent' and not a ? 'page' then trim_scale(round((a ->> 'percent')::numeric * 10) / 10)::text || '%' end
  )
$$;

-- the words of that paragraph before its description (a time label counts as its time)
create function public.legacy_text(a jsonb) returns text
language sql immutable as $$
  select case
    when a ? 't' and not a ? 't_end' and not a ? 'chapter' and not a ? 'percent'
      then concat_ws(' ', nullif(public.legacy_label(a - 't' - 't_end'), ''), public.legacy_clock((a ->> 't')::numeric))
    else public.legacy_label(a)
  end
$$;

-- one position as a paragraph of the document
create function public.legacy_paragraph(a jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object('type', 'paragraph', 'content',
    (
      case
        -- only a plain time is a label that can be clicked
        when a ? 't' and not a ? 't_end' and not a ? 'chapter' and not a ? 'percent'
          then (
            case when a ? 'ep' or a ? 'page'
              then jsonb_build_array(jsonb_build_object('type', 'text', 'text', public.legacy_label(a - 't' - 't_end') || ' '))
              else '[]'::jsonb
            end
            || jsonb_build_array(jsonb_build_object('type', 'anchorChip', 'attrs', jsonb_build_object('t', floor((a ->> 't')::numeric)::int)))
          )
        else jsonb_build_array(jsonb_build_object('type', 'text', 'text', public.legacy_label(a)))
      end
      || case when coalesce(a ->> 'note', '') <> ''
           then jsonb_build_array(jsonb_build_object('type', 'text', 'text', ' ' || (a ->> 'note')))
           else '[]'::jsonb
         end
    ))
$$;

alter table public.posts disable trigger posts_touch;

with legacy as (
  select
    p.id,
    -- the list; or, for a post from before the list, its one old position (whose "quote" is its note)
    case
      when jsonb_array_length(p.anchors) > 0 then p.anchors
      else jsonb_build_array(
        case when p.anchor ? 'quote' and not p.anchor ? 'note'
          then (p.anchor - 'quote') || jsonb_build_object('note', p.anchor -> 'quote')
          else p.anchor
        end)
    end as positions
  from public.posts p
  where jsonb_array_length(p.anchors) > 0 or p.anchor is not null
),
parts as (
  select
    l.id,
    l.positions,
    (select jsonb_agg(public.legacy_paragraph(x.item) order by x.n) from jsonb_array_elements(l.positions) with ordinality as x(item, n)) as paragraphs,
    -- the text of those paragraphs, one per line (what search indexes)
    (select string_agg(btrim(concat_ws(' ', public.legacy_text(x.item), x.item ->> 'note')), E'\n' order by x.n)
       from jsonb_array_elements(l.positions) with ordinality as x(item, n)) as lines,
    -- the descriptions, which the old plain_text carried at its end after the text of the post
    (select string_agg(x.item ->> 'note', E'\n' order by x.n)
       from jsonb_array_elements(l.positions) with ordinality as x(item, n)
      where coalesce(x.item ->> 'note', '') <> '') as notes
  from legacy l
)
update public.posts p
set body = jsonb_build_object('type', 'doc', 'content', parts.paragraphs || coalesce(p.body -> 'content', '[]'::jsonb)),
    plain_text = left(
      concat_ws(E'\n',
        nullif(parts.lines, ''),
        nullif(
          case
            when parts.notes is null then p.plain_text
            when p.plain_text = parts.notes then ''
            when right(p.plain_text, length(parts.notes) + 1) = E'\n' || parts.notes then left(p.plain_text, length(p.plain_text) - length(parts.notes) - 1)
            else p.plain_text
          end, '')),
      20000),
    anchors = '[]'::jsonb,
    anchor = null
from parts
where p.id = parts.id;

alter table public.posts enable trigger posts_touch;

drop function public.legacy_paragraph(jsonb);
drop function public.legacy_text(jsonb);
drop function public.legacy_label(jsonb);
drop function public.legacy_clock(numeric);
