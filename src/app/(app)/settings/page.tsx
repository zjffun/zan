import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSettings } from "@/components/AccountSettings";
import { ProfileForm } from "@/components/ProfileForm";
import { getCurrentEmail, getCurrentProfile, requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "设置", robots: { index: false, follow: false } };

async function Settings() {
  await requireUser("/settings");
  const profile = await getCurrentProfile();
  if (!profile) return <p className="mt-6 text-sm text-muted">找不到你的资料，请重新登录。</p>;
  return (
    <>
      <ProfileForm nickname={profile.nickname} bio={profile.bio} />
      <AccountSettings email={await getCurrentEmail()} />
    </>
  );
}

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">设置</h1>
      <p className="mt-1 text-sm text-muted">别人在内容、评论和主页上看到的就是这里的昵称和简介。</p>
      <Suspense fallback={<div className="mt-6 h-48 animate-pulse rounded-xl bg-sunken" />}>
        <Settings />
      </Suspense>
    </main>
  );
}
