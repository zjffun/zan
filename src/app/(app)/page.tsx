import Link from "next/link";

const FEATURES = [
  {
    title: "视频时间点",
    body: "YouTube 一键记下当前时间，B 站粘贴带 ?t= 的链接或手打 12:34。点击时间戳，播放器直接跳过去。",
  },
  {
    title: "书的页码与摘录",
    body: "页码加一句你自己摘的短句（200 字以内），始终是引用，不是转载。番剧记“第几集 + 时间码”。",
  },
  {
    title: "默认私人",
    body: "罐子、资源和笔记只有你自己看得到，权限落在数据库层。想分享时，一键发布一份快照页。",
  },
  {
    title: "随时带走",
    body: "导出 Markdown：时间锚点是 youtu.be/ID?t=754 这样的链接，页码锚点是 p.132。",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
      <section className="max-w-2xl">
        <p className="mb-3 text-sm font-medium text-accent">只存引用，不存内容</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          给每一部作品
          <br />
          一个研究罐子
        </h1>
        <p className="mt-5 text-lg text-muted">
          站点只保存作品、视频 ID、时间点、页码和你写的笔记。视频一律用官方播放器嵌入或外链打开，书只记页码和你自己摘的短句。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary">
            开始使用
          </Link>
          <a href="https://github.com/zjffun/zan" className="btn" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card p-5">
            <h2 className="font-semibold">{feature.title}</h2>
            <p className="mt-1.5 text-sm text-muted">{feature.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
