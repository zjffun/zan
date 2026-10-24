import { describe, expect, it } from "vitest";
import { sanitizeDoc, sanitizeDocOrEmpty, DocError, type DocNode } from "@/lib/doc/schema";
import { renderDocHtml } from "@/lib/doc/render";
import { docToPlainText } from "@/lib/doc/text";
import { docToMarkdown } from "@/lib/doc/markdown";

const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });
const p = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const text = (value: string, marks?: DocNode["marks"]): DocNode => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const chip = (attrs: Record<string, number>): DocNode => ({ type: "anchorChip", attrs });

describe("sanitizeDoc", () => {
  it("keeps a normal note intact", () => {
    const input = doc(p(text("开场很妙 "), chip({ t: 754 })), { type: "bulletList", content: [{ type: "listItem", content: [p(text("x"))] }] });
    expect(sanitizeDoc(input)).toEqual(input);
  });

  it("drops unknown nodes, marks and attributes", () => {
    const dirty = {
      type: "doc",
      content: [
        { type: "script", content: [text("alert(1)")] },
        { type: "image", attrs: { src: "javascript:alert(1)" } },
        {
          type: "paragraph",
          attrs: { onclick: "evil()" },
          content: [
            { type: "text", text: "hi", marks: [{ type: "bold", attrs: { onmouseover: "x" } }, { type: "textStyle", attrs: { color: "red" } }] },
            { type: "iframe", attrs: { src: "https://evil.example" } },
          ],
        },
      ],
    };
    expect(sanitizeDoc(dirty)).toEqual(doc(p({ type: "text", text: "hi", marks: [{ type: "bold" }] })));
  });

  it("only keeps safe link schemes", () => {
    const link = (href: string) => doc(p(text("x", [{ type: "link", attrs: { href } }])));
    const marksOf = (d: DocNode) => d.content?.[0].content?.[0].marks;
    expect(marksOf(sanitizeDoc(link("https://example.com/a")))).toEqual([{ type: "link", attrs: { href: "https://example.com/a" } }]);
    expect(marksOf(sanitizeDoc(link("mailto:a@example.com")))?.[0].type).toBe("link");
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "//evil.example", "/relative", " javascript:alert(1)"]) {
      expect(marksOf(sanitizeDoc(link(bad)))).toBeUndefined();
    }
  });

  it("validates anchor chips", () => {
    expect(sanitizeDoc(doc(p(chip({ t: 5 })))).content?.[0].content).toHaveLength(1);
    expect(sanitizeDoc(doc(p(chip({ t: -1 })))).content?.[0].content).toBeUndefined();
    expect(sanitizeDoc(doc(p(chip({})))).content?.[0].content).toBeUndefined();
    expect(sanitizeDoc(doc(p({ type: "anchorChip", attrs: { t: "5" } }))).content?.[0].content).toBeUndefined();
    expect(sanitizeDoc(doc(p({ type: "anchorChip", attrs: { t: 5, href: "javascript:x", class: "x" } }))).content?.[0].content?.[0].attrs).toEqual({ t: 5 });
  });

  it("enforces the content model", () => {
    // a list directly inside a paragraph, text directly inside the doc: dropped
    expect(sanitizeDoc(doc(text("loose") as DocNode, p({ type: "bulletList", content: [] })))).toEqual(doc({ type: "paragraph" }));
    // empty list items/lists are removed because ProseMirror would reject them
    expect(sanitizeDoc(doc({ type: "bulletList", content: [{ type: "listItem", content: [] }] }))).toEqual(doc());
  });

  it("rejects non-documents and bombs", () => {
    expect(() => sanitizeDoc(null)).toThrow(DocError);
    expect(() => sanitizeDoc({ type: "paragraph" })).toThrow(DocError);
    expect(() => sanitizeDoc("<script>")).toThrow(DocError);

    let deep: DocNode = p(text("x"));
    for (let i = 0; i < 40; i++) deep = { type: "blockquote", content: [deep] };
    expect(() => sanitizeDoc(doc(deep))).toThrow(/deeply/);

    const wide = doc(...Array.from({ length: 6000 }, () => p(text("x"))));
    expect(() => sanitizeDoc(wide)).toThrow(/large/);
    expect(sanitizeDocOrEmpty(wide)).toEqual(doc());
  });

  it("clamps heading levels", () => {
    expect(sanitizeDoc(doc({ type: "heading", attrs: { level: 99 }, content: [text("h")] })).content?.[0].attrs).toEqual({ level: 1 });
  });
});

describe("renderDocHtml", () => {
  it("escapes text and attributes", () => {
    const html = renderDocHtml(doc(p(text('<img src=x onerror="alert(1)"> & "q"'))));
    expect(html).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;q&quot;</p>");
    expect(html).not.toContain("<img");
  });

  it("renders marks in a stable nesting order", () => {
    const html = renderDocHtml(doc(p(text("a", [{ type: "bold" }, { type: "italic" }, { type: "link", attrs: { href: 'https://e.com/?a=1&b="2"' } }]))));
    expect(html).toBe('<p><a href="https://e.com/?a=1&amp;b=%222%22" target="_blank" rel="noopener noreferrer nofollow ugc"><em><strong>a</strong></em></a></p>');
  });

  it("renders anchor chips as buttons carrying numeric data attributes", () => {
    expect(renderDocHtml(doc(p(chip({ ep: 5, t: 754 }))))).toBe(
      '<p><button type="button" class="anchor-chip" data-anchor-chip="" data-t="754" data-ep="5" title="跳到 12:34">E5 12:34</button></p>',
    );
    expect(renderDocHtml(doc(p(chip({ page: 132 }))))).toContain(">p.132</button>");
  });

  it("never emits script or event handlers, whatever the input", () => {
    const nasty = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
        { type: "html", attrs: { html: "<script>alert(1)</script>" } },
        { type: "paragraph", content: [{ type: "anchorChip", attrs: { t: 1, onclick: "alert(1)" } }] },
      ],
    };
    const html = renderDocHtml(nasty);
    expect(html).not.toMatch(/<script|javascript:|onclick/i);
  });

  it("returns nothing for garbage", () => {
    expect(renderDocHtml("<script>alert(1)</script>")).toBe("");
    expect(renderDocHtml(undefined)).toBe("");
  });

  it("renders lists, quotes and code", () => {
    const html = renderDocHtml(
      doc(
        { type: "blockquote", content: [p(text("q"))] },
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(text("i"))] }] },
        { type: "codeBlock", content: [text("a < b")] },
      ),
    );
    expect(html).toBe("<blockquote><p>q</p></blockquote><ol start=\"3\"><li><p>i</p></li></ol><pre><code>a &lt; b</code></pre>");
  });
});

describe("docToPlainText", () => {
  it("flattens blocks to lines and keeps anchor labels searchable", () => {
    const d = doc(
      p(text("看到 "), chip({ t: 754 }), text(" 才懂")),
      { type: "bulletList", content: [{ type: "listItem", content: [p(text("一"))] }, { type: "listItem", content: [p(text("二"))] }] },
      p(text("a"), { type: "hardBreak" }, text("b")),
    );
    expect(docToPlainText(d)).toBe("看到 12:34 才懂\n一\n二\na\nb");
  });
});

describe("docToMarkdown", () => {
  it("converts marks, links and lists", () => {
    const d = doc(
      p(text("bold", [{ type: "bold" }]), text(" and "), text("link", [{ type: "link", attrs: { href: "https://e.com/a(b)" } }])),
      { type: "bulletList", content: [{ type: "listItem", content: [p(text("x"))] }] },
      { type: "orderedList", content: [{ type: "listItem", content: [p(text("y"))] }] },
      { type: "blockquote", content: [p(text("quoted"))] },
      { type: "heading", attrs: { level: 1 }, content: [text("Title")] },
    );
    expect(docToMarkdown(d)).toBe(
      "**bold** and [link](https://e.com/a%28b%29)\n\n- x\n\n1. y\n\n> quoted\n\n**Title**",
    );
  });

  it("escapes markdown syntax in text", () => {
    expect(docToMarkdown(doc(p(text("1 * 2 [x] <b> # not heading"))))).toBe("1 \\* 2 \\[x\\] \\<b\\> # not heading");
    expect(docToMarkdown(doc(p(text("- not a list"))))).toBe("\\- not a list");
  });

  it("turns anchor chips into links when asked to", () => {
    const d = doc(p(text("see "), chip({ t: 754 }), text(" and "), chip({ page: 3 })));
    const out = docToMarkdown(d, { chipHref: (a) => (a.t !== undefined ? `https://youtu.be/ID?t=${a.t}` : null) });
    expect(out).toBe("see [12:34](https://youtu.be/ID?t=754) and p.3");
  });

  it("fences code blocks safely", () => {
    expect(docToMarkdown(doc({ type: "codeBlock", content: [text("a ``` b")] }))).toBe("````\na ``` b\n````");
  });
});
