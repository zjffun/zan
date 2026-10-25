import "server-only";
import { isAllowedImageUrl } from "../links/hosts";
import { fetchJson } from "../server/http";
import { SharedCache } from "../server/cache";
import type { TagKind } from "../types";
import type { WorkCandidate, WorkRecord } from "./types";

const API = "https://api.bgm.tv";

function headers(): Record<string, string> {
  const token = process.env.BANGUMI_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Bangumi subject type -> our kinds. 1 book, 2 anime, 3 music, 4 game, 6 live action. */
export function bangumiKind(type: unknown, platform: unknown): TagKind {
  switch (type) {
    case 1:
      return platform === "漫画" ? "manga" : "book";
    case 2:
      return "anime";
    case 4:
      return "game";
    case 6:
      return "film";
    default:
      return "other";
  }
}

interface BangumiSubject {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  name_cn?: unknown;
  date?: unknown;
  platform?: unknown;
  images?: { common?: unknown; large?: unknown } | null;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function cover(subject: BangumiSubject): string | null {
  const url = str(subject.images?.common) || str(subject.images?.large);
  return url && isAllowedImageUrl(url) ? url : null;
}

function toRecord(subject: BangumiSubject): WorkRecord | null {
  const id = Number(subject.id);
  const original = str(subject.name);
  const chinese = str(subject.name_cn);
  const title = chinese || original;
  if (!Number.isInteger(id) || id <= 0 || !title) return null;
  return {
    kind: bangumiKind(subject.type, subject.platform),
    title,
    title_original: chinese && original && chinese !== original ? original : null,
    cover_url: cover(subject),
    external: { bangumi: String(id) },
  };
}

const searchCache = new SharedCache<WorkCandidate[]>("bangumi-search", 10 * 60_000);

/** Searches anime, books/manga, games, live action (and music, as "other"). */
export async function searchBangumi(keyword: string, limit = 10): Promise<WorkCandidate[]> {
  const key = `${limit}:${keyword.toLowerCase()}`;
  return searchCache.memo(key, async () => {
    const { status, json } = await fetchJson(`${API}/v0/search/subjects?limit=${limit}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ keyword, sort: "match", filter: { type: [1, 2, 3, 4, 6] } }),
    });
    if (status !== 200 || typeof json !== "object" || json === null) {
      throw new Error(`Bangumi search failed (${status})`);
    }
    const data = (json as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];
    return data.flatMap((subject: BangumiSubject) => {
      const record = toRecord(subject);
      if (!record) return [];
      const year = str(subject.date).slice(0, 4);
      const platform = str(subject.platform);
      return [
        {
          origin: "bangumi" as const,
          id: record.external.bangumi,
          kind: record.kind,
          title: record.title,
          title_original: record.title_original,
          cover_url: record.cover_url,
          subtitle: [year, platform].filter(Boolean).join(" · "),
        },
      ];
    });
  });
}

/** Canonical record for a subject id, straight from Bangumi. null = not found. */
export async function getBangumiWork(id: string): Promise<WorkRecord | null> {
  const { status, json } = await fetchJson(`${API}/v0/subjects/${encodeURIComponent(id)}`, {
    headers: headers(),
  });
  if (status === 404) return null;
  if (status !== 200 || typeof json !== "object" || json === null) {
    throw new Error(`Bangumi lookup failed (${status})`);
  }
  return toRecord(json as BangumiSubject);
}

export interface BangumiEpisode {
  id: number;
  /** number within the main series */
  ep: number;
  title: string;
  airdate: string | null;
  duration: number | null;
}

/** One page of main-series episodes (type 0) of a subject. */
export async function getBangumiEpisodes(
  subjectId: string,
  offset = 0,
  limit = 100,
): Promise<{ total: number; episodes: BangumiEpisode[] }> {
  const { status, json } = await fetchJson(
    `${API}/v0/episodes?subject_id=${encodeURIComponent(subjectId)}&type=0&limit=${limit}&offset=${offset}`,
    { headers: headers() },
  );
  if (status !== 200 || typeof json !== "object" || json === null) {
    throw new Error(`Bangumi episodes failed (${status})`);
  }
  const body = json as { total?: unknown; data?: unknown };
  const rows = Array.isArray(body.data) ? body.data : [];
  const episodes = rows.flatMap((row: Record<string, unknown>) => {
    const id = Number(row.id);
    const ep = Number(row.sort ?? row.ep);
    if (!Number.isInteger(id) || !Number.isFinite(ep) || ep < 0 || ep > 9999) return [];
    const title = [str(row.name_cn) || str(row.name)].filter(Boolean)[0] ?? "";
    const duration = Number(row.duration_seconds);
    return [
      {
        id,
        ep: Math.floor(ep),
        title,
        airdate: str(row.airdate) || null,
        duration: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : null,
      },
    ];
  });
  return { total: Number(body.total) || episodes.length, episodes };
}
