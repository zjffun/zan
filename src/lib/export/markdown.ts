import { anchorLabel, compareAnchors, type Anchor } from "../anchor";
import { docToMarkdown, escapeMarkdown } from "../doc/markdown";
import { PROVIDER_LABEL, anchorUrl, sourceTitle, sourceUrl } from "../sources";
import { formatTimestamp } from "../time";
import { WORK_KIND_LABEL, type Source, type Work } from "../types";
import { workLinks } from "../works/external";

export interface ExportSource extends Pick<Source, "id" | "provider" | "ref" | "meta"> {
  status?: Source["status"];
}

export interface ExportNote {
  source_id: string | null;
  anchor: Anchor | null;
  body: unknown;
  created_at?: string;
}

export interface ExportInput {
  work: Pick<Work, "kind" | "title" | "title_original" | "external">;
  sources: ExportSource[];
  notes: ExportNote[];
  /** ISO date shown in the footer; injected so output is deterministic in tests. */
  exportedAt?: string;
}

const STRUCTURAL_START = /^(?:[-*+]\s|\d+[.)]\s|>|```|---$)/;

function indent(text: string, pad = "  "): string {
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function renderNote(note: ExportNote, source: ExportSource | undefined): string {
  const anchor = note.anchor;
  const label = anchor ? anchorLabel(anchor) : "";
  const href = anchorUrl(source, anchor);
  const head = label ? (href ? `**[${label}](${href})**` : `**${escapeMarkdown(label)}**`) : "";

  const body = docToMarkdown(note.body, {
    chipHref: (chip) => anchorUrl(source, chip),
  });
  const quote = anchor?.quote
    ? anchor.quote
        .split(/\r?\n/)
        .map((line) => `> ${escapeMarkdown(line)}`)
        .join("\n")
    : "";

  const blocks: string[] = [];
  if (quote) blocks.push(quote);
  if (body) blocks.push(body);

  if (blocks.length === 0) return `- ${head || "（空）"}`;
  if (!head) return `- ${indent(blocks.join("\n\n")).trimStart()}`;
  // a plain paragraph can follow the label on the same line
  if (!quote && !STRUCTURAL_START.test(body)) {
    const [first, ...rest] = body.split("\n");
    return [`- ${head} ${first}`, ...(rest.length ? [indent(rest.join("\n"))] : [])].join("\n");
  }
  return `- ${head}\n\n${indent(blocks.join("\n\n"))}`;
}

function describeSource(source: ExportSource): string {
  const title = escapeMarkdown(sourceTitle(source));
  const url = sourceUrl(source);
  const bits: string[] = [PROVIDER_LABEL[source.provider]];
  if (source.meta?.author) bits.push(escapeMarkdown(source.meta.author));
  if (source.meta?.duration) bits.push(formatTimestamp(source.meta.duration));
  if (source.status === "dead") bits.push("已失效");
  return `- ${url ? `[${title}](${url})` : title} — ${bits.join(" · ")}`;
}

/**
 * Markdown export of one jar: sources as links, notes grouped by source, time
 * anchors as deep links (youtu.be/ID?t=754, bilibili.com/video/BV…?t=754) and
 * page anchors as "p.132". The user can always take their data away.
 */
export function exportJarMarkdown(input: ExportInput): string {
  const { work, sources, notes } = input;
  const lines: string[] = [`# ${escapeMarkdown(work.title)}`, ""];

  const sub = [work.title_original ? escapeMarkdown(work.title_original) : null, WORK_KIND_LABEL[work.kind]]
    .filter(Boolean)
    .join(" · ");
  const links = workLinks(work)
    .map((l) => `[${l.label}](${l.url})`)
    .join(" · ");
  lines.push(`_${sub}_${links ? ` — ${links}` : ""}`, "");

  if (sources.length > 0) {
    lines.push("## 资源", "", ...sources.map(describeSource), "");
  }

  const byId = new Map(sources.map((s) => [s.id, s]));
  const groups: { title: string; source?: ExportSource; notes: ExportNote[] }[] = sources.map((source) => ({
    title: sourceTitle(source),
    source,
    notes: notes.filter((n) => n.source_id === source.id),
  }));
  const loose = notes.filter((n) => !n.source_id || !byId.has(n.source_id));
  if (loose.length > 0) groups.push({ title: "未关联资源", notes: loose });

  const nonEmpty = groups.filter((g) => g.notes.length > 0);
  if (nonEmpty.length > 0) {
    lines.push("## 笔记", "");
    for (const group of nonEmpty) {
      lines.push(`### ${escapeMarkdown(group.title)}`, "");
      // stable sort: anchored notes in watch/read order, the rest in writing order
      const sorted = [...group.notes].sort((a, b) => compareAnchors(a.anchor, b.anchor));
      for (const note of sorted) lines.push(renderNote(note, group.source));
      lines.push("");
    }
  }

  if (input.exportedAt) lines.push("---", "", `导出自 zan · ${input.exportedAt}`, "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
