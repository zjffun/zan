-- A comment may now hold 5000 characters of text (it was 1000).
--
-- The number lives in two places that must agree: MAX_COMMENT_LENGTH in src/lib/post-limits.ts (what the form
-- counts and the server checks) and this check on the plain text of the comment. comments.doc, the document, is
-- limited by its size (comments_doc_check, 50000 bytes), which 5000 characters stay well under.
--
-- This migration only LOOSENS a check, so the application from before it keeps working: run it BEFORE deploying
-- the version that allows more. It can be run again.

-- in one transaction, so that there is no moment without the check
begin;

alter table public.comments drop constraint if exists comments_body_check;

alter table public.comments
  add constraint comments_body_check
    check (char_length(public.trim_blanks(body)) between 1 and 5000);

commit;
