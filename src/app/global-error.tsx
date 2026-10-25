"use client";

/**
 * The last resort: the root layout itself failed. It replaces the whole document, and the site's styles are not
 * loaded here (Next.js renders it on its own), so it brings its own, in plain CSS.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : null;
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf8f4", color: "#1f1d18" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "96px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>出错了</h1>
          <p style={{ color: "#6b655a", fontSize: 14 }}>页面没能加载出来。请再试一次，如果一直这样，请稍后再来。</p>
          {digest ? <p style={{ color: "#6b655a", fontSize: 12 }}>错误编号：{digest}</p> : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, padding: "8px 16px", border: 0, borderRadius: 8, background: "#2b6657", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
