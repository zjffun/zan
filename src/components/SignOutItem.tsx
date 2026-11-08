"use client";

import { useEffect } from "react";
import { markSignedOut, signedOutSince } from "@/lib/sign-out-mark";
import { menuItemClass } from "./Menu";

/** This browser's storage, or null when it does not allow it (blocked site data). */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * "Sign out" in the account menu: a plain form that posts to /auth/signout and ends up on a new page, so that
 * the browser lets go of the page it was on (a Server Action would leave it, and every page it was holding on
 * to, in the browser).
 *
 * That is not enough on its own. The browser may keep the page we leave in its back/forward cache and put it
 * back as it was when Back is pressed: signed in, with the posts only the signed-in person could see. So the
 * form writes down that somebody signed out, and a page that is put back reloads when that happened after it
 * was shown. Without a sign-out in between a page is put back as before, with what was typed in it.
 */
export function SignOutItem() {
  useEffect(() => {
    let shown = Date.now();
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return; // a page that has just been loaded is what the server said
      if (signedOutSince(storage(), shown)) {
        document.documentElement.style.visibility = "hidden"; // not even for the moment the reload takes
        location.reload();
      } else {
        shown = Date.now();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <form method="post" action="/auth/signout" onSubmit={() => markSignedOut(storage())}>
      <button type="submit" className={menuItemClass} role="menuitem">
        退出登录
      </button>
    </form>
  );
}
