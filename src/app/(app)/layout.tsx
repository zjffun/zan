import { Suspense } from "react";
import { HeaderView, SiteHeader } from "@/components/SiteHeader";

/**
 * Everything except the public snapshot pages. The header looks at the session
 * cookie, so it streams in behind Suspense; public pages (/p/…) live outside
 * this group so that they stay fully static and cacheable.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderView user="loading" />}>
        <SiteHeader />
      </Suspense>
      {children}
    </>
  );
}
