// AniList cover lookup with a rate-limited queue and retries.
import { supabase } from "@/integrations/supabase/client";

export interface CoverResult {
  id: number;
  title: string;
  cover: string;
  format: string | null;
}

const QUERY = `query ($s: String) { Page(perPage: 8) { media(search: $s, sort: SEARCH_MATCH) { id format title { romaji english } coverImage { large } } } }`;

const MIN_GAP_MS = 900; // AniList allows ~90 req/min; stay well under
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rawSearch(title: string, attempt = 0): Promise<CoverResult[]> {
  const wait = Math.max(0, lastCall + MIN_GAP_MS - Date.now());
  if (wait) await sleep(wait);
  lastCall = Date.now();
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { s: title } }),
  });
  if (res.status === 429 && attempt < 4) {
    const after = Number(res.headers.get("Retry-After") ?? "5");
    await sleep((after || 5) * 1000);
    return rawSearch(title, attempt + 1);
  }
  if (!res.ok) {
    if (attempt < 2) {
      await sleep(1500 * (attempt + 1));
      return rawSearch(title, attempt + 1);
    }
    throw new Error(`AniList ${res.status}`);
  }
  const json = await res.json();
  const media = json?.data?.Page?.media ?? [];
  return media
    .filter((m: any) => m?.coverImage?.large)
    .map((m: any) => ({
      id: m.id,
      title: m.title.english || m.title.romaji,
      cover: m.coverImage.large,
      format: m.format,
    }));
}

/** Queued search: requests run one at a time. */
export function searchCovers(title: string): Promise<CoverResult[]> {
  const p = chain.then(() => rawSearch(title));
  chain = p.catch(() => undefined);
  return p;
}

const inflight = new Set<string>();

/** Auto-find and persist a cover once per series. */
export async function autoFetchCover(seriesId: string, title: string): Promise<string | null> {
  if (inflight.has(seriesId)) return null;
  inflight.add(seriesId);
  try {
    const results = await searchCovers(title);
    const url = results[0]?.cover ?? null;
    await supabase.from("series").update({ cover_url: url, cover_checked: true }).eq("id", seriesId);
    return url;
  } catch {
    return null;
  } finally {
    inflight.delete(seriesId);
  }
}
