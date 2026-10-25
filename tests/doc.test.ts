import { describe, expect, it } from "vitest";
import { sanitizeDoc, sanitizeDocOrEmpty, DocError, type DocNode } from "@/lib/doc/schema";
import { renderDocHtml } from "@/lib/doc/render";
import { docToPlainText } from "@/lib/doc/text";
import { docToMarkdown } from "@/lib/doc/markdown";

const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });
const p = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const text = (value: string, marks?: DocNode["marks"]): DocNode => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const chip = (attrs: Record<string, number>): DocNode => ({ type: "anchorChip", attrs });
const OWNER = "00000000-0000-4000-8000-0000000000aa";
const KEY = `${OWNER}/11111111-2222-4333-8444-555555555555.webp`;
const image = (attrs: Record<string, unknown> = { key: KEY }): DocNode => ({ type: "image", attrs });

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

describe("position labels written as text", () => {
  const bold = [{ type: "bold" }];
  const labelOf = (node: DocNode) => (node.type === "anchorChip" ? node.attrs : node.text);

  it("turns @4:16 at the start of a bold paragraph into a label and keeps the rest bold", () => {
    const out = sanitizeDoc(doc(p(text("@4:16 身份危机（Identity Crisis）", bold), text("，心理学里常译作"))));
    expect(out).toEqual(
      doc(p({ type: "anchorChip", attrs: { t: 256 } }, text(" 身份危机（Identity Crisis）", bold), text("，心理学里常译作"))),
    );
    expect(docToPlainText(out)).toBe("4:16 身份危机（Identity Crisis），心理学里常译作");
  });

  it("does the same in headings, with the episode form and the full-width colon", () => {
    const out = sanitizeDoc(doc({ type: "heading", attrs: { level: 2 }, content: [text("E5@12：34 开场 @1:00")] }));
    expect(out.content?.[0].content?.map(labelOf)).toEqual([{ ep: 5, t: 754 }, " 开场 ", { t: 60 }]);
  });

  it("renders them as clickable labels and exports them as links", () => {
    const body = doc(p(text("@4:16 开始")));
    expect(renderDocHtml(body)).toContain('<button type="button" class="anchor-chip" data-anchor-chip="" data-t="256" title="跳到 4:16">4:16</button>');
    expect(docToMarkdown(body, { chipHref: (a) => `https://youtu.be/x?t=${a.t}` })).toBe("[4:16](https://youtu.be/x?t=256) 开始");
  });

  it("leaves code, links, code blocks and words like name@4:16 alone", () => {
    const link = [{ type: "link", attrs: { href: "https://example.com" } }];
    for (const input of [
      p(text("@4:16", [{ type: "code" }])),
      p(text("@4:16", link)),
      { type: "codeBlock", content: [text("@4:16")] },
      p(text("name@4:16")),
    ] as DocNode[]) {
      expect(JSON.stringify(sanitizeDoc(doc(input))), JSON.stringify(input)).not.toContain("anchorChip");
    }
  });

  it("is a fixed point: cleaning twice changes nothing", () => {
    const once = sanitizeDoc(doc(p(text("a @1:00 b E2@3:00 c @9:99"))));
    expect(sanitizeDoc(once)).toEqual(once);
  });

  it("counts the labels it makes against the size limit", () => {
    // each text node is under its own limit, but together they would turn into far more than MAX_NODES labels
    const many = "@1:00 ".repeat(3166); // 18 996 characters
    expect(() => sanitizeDoc(doc(p(text(many), text(many), text(many))))).toThrow(DocError);
  });
});

describe("images in a document", () => {
  it("keeps an image that points at one of our files, with its size and alt text", () => {
    const input = doc(p(text("看图")), image({ key: KEY, alt: "封面", width: 800, height: 600 }));
    expect(sanitizeDoc(input)).toEqual(input);
  });

  it("keeps images in quotes and lists, but not inside a paragraph", () => {
    const quoted = doc({ type: "blockquote", content: [image()] }, { type: "bulletList", content: [{ type: "listItem", content: [image()] }] });
    expect(sanitizeDoc(quoted)).toEqual(quoted);
    expect(sanitizeDoc(doc(p(image()))).content?.[0].content).toBeUndefined();
  });

  it("drops anything that is not one of our files: addresses, data URLs, other paths", () => {
    for (const src of ["https://example.com/a.png", "//evil.example/a.png", "data:image/svg+xml,<svg/>", "javascript:alert(1)", "/media/" + KEY, "../x.png", `${OWNER}/x.webp`, ""]) {
      expect(sanitizeDoc(doc(image({ key: src }))), src).toEqual(doc());
      expect(sanitizeDoc(doc(image({ src }))), src).toEqual(doc());
    }
    expect(sanitizeDoc(doc(image({})))).toEqual(doc());
    expect(sanitizeDoc(doc({ type: "image" }))).toEqual(doc());
  });

  it("cleans the optional attributes and drops every other attribute", () => {
    expect(sanitizeDoc(doc(image({ key: KEY, alt: "  很多   空格\n换行 ", width: 10, height: 20, onerror: "x", src: "https://evil.example/x.png", class: "x" }))).content?.[0].attrs).toEqual({
      key: KEY,
      alt: "很多 空格 换行",
      width: 10,
      height: 20,
    });
    // size needs both sides and sensible numbers; null is what the editor gives for "not set"
    expect(sanitizeDoc(doc(image({ key: KEY, alt: null, width: 10, height: null }))).content?.[0].attrs).toEqual({ key: KEY });
    expect(sanitizeDoc(doc(image({ key: KEY, width: -1, height: 5 }))).content?.[0].attrs).toEqual({ key: KEY });
    expect(sanitizeDoc(doc(image({ key: KEY, width: 99999, height: 5 }))).content?.[0].attrs).toEqual({ key: KEY });
    expect(sanitizeDoc(doc(image({ key: KEY, width: 1.5, height: 5 }))).content?.[0].attrs).toEqual({ key: KEY });
    expect((sanitizeDoc(doc(image({ key: KEY, alt: "字".repeat(500) }))).content?.[0].attrs?.alt as string).length).toBe(200);
  });

  it("renders an <img> from the site's own /media path, with escaped alt text", () => {
    expect(renderDocHtml(doc(image({ key: KEY, alt: '"><script>alert(1)</script>', width: 800, height: 600 })))).toBe(
      `<img src="/media/${KEY}" alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;" width="800" height="600" loading="lazy" decoding="async">`,
    );
    expect(renderDocHtml(doc(image()))).toBe(`<img src="/media/${KEY}" alt="" loading="lazy" decoding="async">`);
    expect(renderDocHtml(doc(image({ key: "https://evil.example/x.png" })))).toBe("");
  });

  it("is not part of the searchable text, and becomes Markdown with the alt text", () => {
    expect(docToPlainText(sanitizeDoc(doc(p(text("前")), image({ key: KEY, alt: "封面" }), p(text("后")))))).toBe("前\n后");
    expect(docToMarkdown(doc(p(text("前")), image({ key: KEY, alt: "a [b] c" })))).toBe(`前\n\n![a \\[b\\] c](/media/${KEY})`);
    expect(docToMarkdown(doc(image()), { imageHref: (key) => `https://zan.example/media/${key}` })).toBe(`![](https://zan.example/media/${KEY})`);
    expect(docToMarkdown(doc({ type: "bulletList", content: [{ type: "listItem", content: [p(text("项")), image()] }] }))).toBe(`- 项\n\n  ![](/media/${KEY})`);
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
