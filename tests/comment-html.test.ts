import { describe, expect, it } from "vitest";
import { commentHtml } from "@/lib/comment-html";

describe("commentHtml", () => {
  it("shows a comment from before the editor line by line, with its text escaped", () => {
    expect(commentHtml({ body: "第一行\n\n<b>第三行</b> & co", doc: null }, false)).toBe(
      "<p>第一行</p><p><br></p><p>&lt;b&gt;第三行&lt;/b&gt; &amp; co</p>",
    );
  });

  it("renders the document of a comment", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "粗", marks: [{ type: "bold" }] }] }] };
    expect(commentHtml({ body: "粗", doc }, false)).toBe("<p><strong>粗</strong></p>");
  });

  it("turns a time label into a button only where there is a player to jump", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "anchorChip", attrs: { t: 43 } }] }] };
    expect(commentHtml({ body: "0:43", doc }, true)).toContain('<button type="button" class="anchor-chip anchor-chip--seek"');
    expect(commentHtml({ body: "0:43", doc }, false)).toContain('<span class="anchor-chip anchor-chip--static"');
  });

  it("reads @0:43 in an old comment as a time label too", () => {
    expect(commentHtml({ body: "看 @0:43 这里", doc: null }, true)).toContain('data-t="43"');
  });

  it("never lets a script or a javascript: link through, whatever is in the column", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "点我", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
      ],
    };
    const html = commentHtml({ body: "点我", doc }, false);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("script");
  });
});
