import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SLUG_PATTERN } from "@/lib/public";

export const metadata: Metadata = { title: "举报", robots: { index: false, follow: false } };

async function ReportBody({ searchParams }: Pick<PageProps<"/report">, "searchParams">) {
  const params = await searchParams;
  const raw = Array.isArray(params.page) ? params.page[0] : params.page;
  const slug = raw && SLUG_PATTERN.test(raw) ? raw : null;
  const email = process.env.REPORT_EMAIL;
  const subject = `举报 zan 页面${slug ? ` /p/${slug}` : ""}`;
  const body = [
    slug ? `页面：/p/${slug}` : "页面：",
    "你的身份（权利人 / 授权代表 / 其他）：",
    "涉嫌侵权或违规的内容：",
    "原作品或权利证明的链接：",
  ].join("\n");

  return (
    <>
      <p className="mt-2 text-sm text-muted">
        {slug ? (
          <>
            被举报页面：<code className="rounded bg-sunken px-1">/p/{slug}</code>
          </>
        ) : (
          "请写明被举报页面的地址。"
        )}
      </p>
      {email ? (
        <a
          className="btn btn-primary mt-5"
          href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        >
          发邮件举报
        </a>
      ) : (
        <p className="mt-5 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-ink">
          运营者还没有配置举报邮箱（环境变量 REPORT_EMAIL）。请通过项目主页联系运营者。
        </p>
      )}
      <p className="mt-6 text-sm text-muted">
        处理流程见 <Link className="underline" href="/terms">服务条款与下架流程</Link>。
      </p>
    </>
  );
}

export default function ReportPage(props: PageProps<"/report">) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">举报页面</h1>
      <Suspense fallback={null}>
        <ReportBody searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
