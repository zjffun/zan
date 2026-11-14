/** How much a post and a comment may hold. Plain numbers, so that pages and forms can show them without loading the checks (zod). */
export const MAX_POST_TAGS = 5;
/** Characters of text in a comment. The column's check (`comments_body_check`, migration 0013) has to say the same number. */
export const MAX_COMMENT_LENGTH = 5000;
/** Characters of text in a post (see `plainTextLength`); the column `posts.plain_text` refuses more than 20000. */
export const MAX_PLAIN_TEXT = 20_000;
