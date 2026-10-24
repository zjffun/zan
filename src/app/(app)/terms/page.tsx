import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "服务条款与下架流程" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">服务条款与下架流程</h1>
      <p className="mt-2 text-sm text-muted">
        这是随代码附带的模板，运营者上线前应按所在地区法律修改，并补充联系方式（环境变量 REPORT_EMAIL）。
      </p>

      <div className="mt-6 space-y-6 leading-7 [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
        <section>
          <h2>zan 存什么</h2>
          <p>
            zan 只保存作品信息、视频 ID、时间点、页码，以及用户自己写的笔记和自己摘录的短句（每条不超过 200 字）。视频一律通过官方播放器嵌入或外链打开，zan
            不托管、不转存任何视频、音频或书籍内容。
          </p>
        </section>
        <section>
          <h2>内容责任</h2>
          <ul>
            <li>用户对自己发布的笔记和摘录负责，应保证拥有发布权利，且不侵犯他人的著作权、隐私或其他权利。</li>
            <li>摘录仅限用于评论、研究和引用，不得用于转载整章或整段作品。</li>
            <li>你攒的内容默认私人。只有在你点击“发布”后，快照才会公开；“仅链接可见”的页面不会被搜索引擎收录。</li>
            <li>zan 有权在收到有效投诉或发现违法内容时下架页面，必要时停用账号。</li>
          </ul>
        </section>
        <section>
          <h2>举报与下架</h2>
          <ol className="list-decimal pl-6">
            <li>
              在任意公开页底部点击“举报此页”，或通过 <Link className="underline" href="/report">举报页面</Link> 联系我们，写明页面地址、权利人身份和涉嫌侵权的内容。
            </li>
            <li>我们会尽快核实，并在确认后撤下对应页面（删除其公开快照，私人笔记不受影响）。</li>
            <li>被下架页面的作者会收到通知，可以提出异议或修改后重新发布。</li>
            <li>对重复侵权的账号，我们会停用其发布功能。</li>
          </ol>
        </section>
        <section>
          <h2>嵌入的第三方内容</h2>
          <p>
            YouTube、哔哩哔哩等平台的视频由其官方播放器提供，受各平台自己的条款约束。上传者关闭外嵌或删除视频后，页面会显示“视频已失效”，并保留你当时记录的标题等信息。
          </p>
        </section>
      </div>
    </main>
  );
}
