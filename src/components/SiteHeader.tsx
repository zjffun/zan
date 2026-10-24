import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser, type CurrentUser } from "@/lib/dal";

/** Pure presentation: no cookie access, so it can be part of the static shell. `"static"` is for cached public pages. */
export function HeaderView({ user }: { user: CurrentUser | null | "loading" | "static" }) {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link
          href={user && typeof user === "object" ? "/jars" : "/"}
          className="flex items-baseline gap-2 font-semibold tracking-tight"
        >
          <span className="text-lg">zan</span>
          <span className="hidden text-xs font-normal text-muted sm:inline">作品研究罐子</span>
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          {user === "loading" ? null : user === "static" ? (
            // public pages are cached and identical for everybody: no session lookup here
            <Link href="/jars" className="btn btn-quiet btn-sm">
              我的罐子
            </Link>
          ) : user ? (
            <>
              <Link href="/search" className="btn btn-quiet btn-sm">
                搜索笔记
              </Link>
              <Link href="/jars" className="btn btn-quiet btn-sm">
                我的罐子
              </Link>
              <form action={signOut}>
                <button className="btn btn-quiet btn-sm" type="submit" title={user.email ?? undefined}>
                  退出
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Reads the session cookie: render inside <Suspense>. */
export async function SiteHeader() {
  return <HeaderView user={await getCurrentUser()} />;
}
