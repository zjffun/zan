import type { Visibility } from "@/lib/types";

const LABEL: Record<Visibility, string> = {
  private: "私人",
  unlisted: "仅链接可见",
  public: "公开",
};

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <span className={`chip ${visibility === "private" ? "" : "!bg-accent-soft !text-accent"}`}>{LABEL[visibility]}</span>
  );
}
