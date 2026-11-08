/** How much a post and a comment may hold. Plain numbers, so that pages and forms can show them without loading the checks (zod). */
export const MAX_POST_TAGS = 5;
export const MAX_COMMENT_LENGTH = 1000;
/** Characters of text in a post (see `plainTextLength`); the column `posts.plain_text` refuses more than 20000. */
export const MAX_PLAIN_TEXT = 20_000;
