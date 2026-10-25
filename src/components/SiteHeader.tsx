import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getCurrentProfile } from "@/lib/dal";
import { Avatar } from "./Avatar";
import { PlusIcon, SearchIcon } from "./icons";
import { Menu, menuItemClass } from "./Menu";

export interface HeaderUser {
  id: string;
  nickname: string;
}

/** Pure presentation: no cookie access, so it can be part of the static shell. */
export function HeaderView({ user }: { user: HeaderUser | null | "loading" }) {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          zan
        </Link>

        <form action="/search" role="search" className="relative ml-1 hidden max-w-xs flex-1 sm:block">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            className="input !min-h-8 !rounded-full !py-1 !pl-8 text-sm"
            type="search"
            name="q"
            placeholder="搜索内容和标签"
            aria-label="搜索"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1.5 text-sm">
          {/* Phones only (the search box is hidden there). The wrapper carries `sm:hidden`: `.btn` sets
              its own display, which would win over a utility on the link itself. */}
          <span className="sm:hidden">
            <Link href="/search" className="btn btn-quiet btn-sm" aria-label="搜索">
              <SearchIcon className="size-4" />
            </Link>
          </span>
          <Link href="/tags" className="btn btn-quiet btn-sm">
            标签
          </Link>

          {user === "loading" ? null : (
            <>
              {/* tags are made where they are used (the tag picker of a post) and on the tags page, not from here */}
              <Link href="/new/post" className="btn btn-primary btn-sm">
                <PlusIcon className="size-4" />
                新建
              </Link>

              {user ? (
                <Menu
                  buttonClassName="btn btn-quiet btn-sm !px-1.5"
                  label={
                    <>
                      <Avatar id={user.id} name={user.nickname} size="sm" />
                      <span className="hidden max-w-24 truncate sm:inline">{user.nickname}</span>
                    </>
                  }
                >
                  <Link href={`/u/${user.id}`} className={menuItemClass} role="menuitem">
                    我的主页
                  </Link>
                  <Link href="/favorites" className={menuItemClass} role="menuitem">
                    我的收藏
                  </Link>
                  <Link href="/settings" className={menuItemClass} role="menuitem">
                    设置
                  </Link>
                  <form action={signOut}>
                    <button type="submit" className={menuItemClass} role="menuitem">
                      退出登录
                    </button>
                  </form>
                </Menu>
              ) : (
                <Link href="/login" className="btn btn-sm">
                  登录
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/** Reads the session cookie: render inside <Suspense>. */
export async function SiteHeader() {
  const profile = await getCurrentProfile();
  return <HeaderView user={profile ? { id: profile.id, nickname: profile.nickname } : null} />;
}
