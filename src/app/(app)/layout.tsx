import { Suspense } from "react";
import { HeaderView, SiteHeader } from "@/components/SiteHeader";

/**
 * The header looks at the session cookie, so it streams in behind Suspense;
 * the rest of the page shell stays static.
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
