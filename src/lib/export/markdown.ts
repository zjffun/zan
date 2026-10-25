import { anchorLabel, type Anchor } from "../anchor";
import { docToMarkdown, escapeMarkdown } from "../doc/markdown";
import { excerptOf } from "../feed";
import { mediaPath } from "../image";
import { PROVIDER_LABEL, anchorUrl, sourceTitle, sourceUrl } from "../sources";
import { formatTimestamp } from "../time";
import type { PostSource, Visibility } from "../types";

export interface ExportPost {
  created_at: string;
  visibility: Visibility;
  tags: { name: string }[];
  source: PostSource | null;
  source_status?: "ok" | "dead";
  anchors: Anchor[];
  body: unknown;
  plain_text: string;
}

export interface ExportInput {
  posts: ExportPost[];
  /** ISO date shown in the footer; injected so output is deterministic in tests. */
  exportedAt?: string;
  /** The site's origin (https://example.com): lets images in the file point at the site, not at a relative path. */
  origin?: string;
}

function describeSource(source: PostSource, dead: boolean): string {
  const title = escapeMarkdown(sourceTitle(source));
  const url = sourceUrl(source);
  const bits: string[] = [PROVIDER_LABEL[source.provider]];
  if (source.meta?.author) bits.push(escapeMarkdown(source.meta.author));
  if (source.meta?.duration) bits.push(formatTimestamp(source.meta.duration));
  if (dead) bits.push("已失效");
  return `${url ? `[${title}](${url})` : title} — ${bits.join(" · ")}`;
}

function renderPost(post: ExportPost, origin: string): string {
  const heading = post.source ? sourceTitle(post.source) : excerptOf(post.plain_text, 30) || "（无标题）";
  const lines: string[] = [`## ${escapeMarkdown(heading)}`, ""];

  const meta = [post.created_at.slice(0, 10), post.visibility === "private" ? "仅自己可见" : null].filter(Boolean).join(" · ");
  lines.push(`_${meta}_`, "");
  if (post.tags.length > 0) lines.push(post.tags.map((tag) => `#${escapeMarkdown(tag.name.replace(/\s+/g, "_"))}`).join(" "), "");
  if (post.source) lines.push(`来源：${describeSource(post.source, post.source_status === "dead")}`, "");

  if (post.anchors.length > 0) {
    for (const anchor of post.anchors) {
      const label = anchorLabel(anchor);
      const href = anchorUrl(post.source, anchor);
      const where = href ? `**[${label}](${href})**` : `**${escapeMarkdown(label)}**`;
      // one line per position; a note with line breaks is folded into one line so that the list stays a list
      const note = anchor.note?.replace(/\s+/g, " ").trim();
      lines.push(note ? `- ${where} ${escapeMarkdown(note)}` : `- ${where}`);
    }
    lines.push("");
  }

  const body = docToMarkdown(post.body, {
    chipHref: (chip) => anchorUrl(post.source, chip),
    imageHref: (key) => `${origin}${mediaPath(key)}`,
  });
  if (body) lines.push(body, "");
  return lines.join("\n");
}

/**
 * Markdown export of a person's posts: each post with its tags, its video as
 * a link, time anchors as deep links (youtu.be/ID?t=754,
 * bilibili.com/video/BV…?t=754) and page anchors as "p.132". The user can
 * always take their data away.
 */
export function exportPostsMarkdown(input: ExportInput): string {
  const lines: string[] = ["# 我在 zan 攒下的内容", ""];
  const origin = (input.origin ?? "").replace(/\/+$/, "");
  for (const post of input.posts) lines.push(renderPost(post, origin));
  if (input.exportedAt) lines.push("---", "", `导出自 zan · ${input.exportedAt}`, "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
