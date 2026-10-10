// AniList client: rate-limited queue, batched lookups and title matching.
// AniList allows 30 requests/min (X-RateLimit-Limit), so lookups are grouped into
// a few GraphQL requests using aliases instead of one request per series.
import { supabase } from "@/integrations/supabase/client";
import type { Series } from "./data";
import { normalizeGenres, type ImportRow } from "./normalizer";
import { normalizeTitle, searchVariants, similarity, stripSeasonNotes } from "./titles";

export type MediaType = "ANIME" | "MANGA";
export const mediaTypeOf = (tipo: string): MediaType => (tipo === "anime" ? "ANIME" : "MANGA");

export interface AniListMedia {
  id: number;
  idMal: number | null;
  type: MediaType;
  format: string | null;
  status: string | null;
  countryOfOrigin: string | null;
  chapters: number | null;
  episodes: number | null;
  averageScore: number | null;
  genres: string[];
  description: string | null;
  siteUrl: string;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  coverImage: { large: string | null; extraLarge: string | null } | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  startDate: { year: number | null } | null;
}

export type MatchQuality = "exacta" | "parecida" | "dudosa";

export interface Candidate {
  media: AniListMedia;
  quality: MatchQuality;
}

export class AniListError extends Error {
  constructor(
    readonly reason: "rate_limit" | "network" | "server",
    message: string,
  ) {
    super(message);
  }
}

export const ESTADOS_ANILIST: Record<string, string> = {
  FINISHED: "Finalizado",
  RELEASING: "En emisión",
  NOT_YET_RELEASED: "Próximamente",
  CANCELLED: "Cancelado",
  HIATUS: "En hiatus",
};

const ENDPOINT = "https://graphql.anilist.co";
const MIN_GAP_MS = 2100; // 30 req/min with a small margin
const MAX_ATTEMPTS = 4;
const FIELDS = `id idMal type format status countryOfOrigin chapters episodes averageScore genres
  description(asHtml: false) siteUrl title { romaji english native } synonyms
  coverImage { large extraLarge } nextAiringEpisode { episode airingAt } startDate { year }`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Transport ----------

let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();

/** All requests go through one queue so the rate limit is shared app-wide. */
function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const run = chain.then(() => send<T>(query, variables, 0));
  chain = run.catch(() => undefined);
  return run;
}

async function send<T>(
  query: string,
  variables: Record<string, unknown>,
  attempt: number,
): Promise<T> {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    if (attempt < MAX_ATTEMPTS) {
      await sleep(2000 * (attempt + 1));
      return send(query, variables, attempt + 1);
    }
    throw new AniListError("network", "No hay conexión con AniList. Revisa tu internet.");
  }

  if (res.status === 429) {
    if (attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 60;
      await sleep(retryAfter * 1000);
      return send(query, variables, attempt + 1);
    }
    throw new AniListError("rate_limit", "AniList está limitando las búsquedas. Espera un minuto.");
  }
  if (res.status >= 500 && attempt < 2) {
    await sleep(3000 * (attempt + 1));
    return send(query, variables, attempt + 1);
  }

  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || !json.data) {
    throw new AniListError(
      "server",
      `AniList respondió con un error (${json.errors?.[0]?.message ?? res.status}).`,
    );
  }
  return json.data;
}

export function aniListErrorMessage(e: unknown): string {
  return e instanceof AniListError ? e.message : "No se pudo consultar AniList.";
}

// ---------- Batching ----------

/** Collects calls made close together and resolves them with a single request. */
function batcher<K, V>(size: number, delayMs: number, run: (keys: K[]) => Promise<V[]>) {
  let pending: { key: K; resolve: (v: V) => void; reject: (e: unknown) => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    clearTimeout(timer);
    timer = undefined;
    const batch = pending.slice(0, size);
    pending = pending.slice(size);
    if (pending.length) timer = setTimeout(flush, delayMs);
    run(batch.map((p) => p.key)).then(
      (values) => batch.forEach((p, i) => p.resolve(values[i]!)),
      (e) => batch.forEach((p) => p.reject(e)),
    );
  }

  return (key: K) =>
    new Promise<V>((resolve, reject) => {
      pending.push({ key, resolve, reject });
      if (pending.length >= size) flush();
      else timer ??= setTimeout(flush, delayMs);
    });
}

const VARIANTS_PER_TITLE = 2;

const searchBatch = batcher<{ title: string; type: MediaType }, Candidate[]>(
  8,
  250,
  async (items) => {
    const vars: Record<string, string> = {};
    const decl: string[] = [];
    const parts: string[] = [];
    const aliases = items.map((item, i) =>
      searchVariants(item.title)
        .slice(0, VARIANTS_PER_TITLE)
        .map((v, j) => {
          const name = `q${i}_${j}`;
          vars[name] = v;
          decl.push(`$${name}: String`);
          parts.push(
            `${name}: Page(perPage: 5) { media(search: $${name}, type: ${item.type}, sort: SEARCH_MATCH) { ...f } }`,
          );
          return name;
        }),
    );
    const data = await request<Record<string, { media: AniListMedia[] }>>(
      `query (${decl.join(", ")}) { ${parts.join(" ")} } fragment f on Media { ${FIELDS} }`,
      vars,
    );
    return items.map((item, i) =>
      rankCandidates(
        aliases[i]!.flatMap((a) => data[a]?.media ?? []),
        item.title,
      ),
    );
  },
);

const idBatch = batcher<number, AniListMedia | null>(50, 250, async (ids) => {
  const data = await request<{ Page: { media: AniListMedia[] } }>(
    `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids) { ${FIELDS} } } }`,
    { ids },
  );
  const byId = new Map(data.Page.media.map((m) => [m.id, m]));
  return ids.map((id) => byId.get(id) ?? null);
});

const malBatch = batcher<{ idMal: number; type: MediaType }, AniListMedia | null>(
  25,
  250,
  async (items) => {
    const result: (AniListMedia | null)[] = [];
    for (const type of ["MANGA", "ANIME"] as const) {
      const ids = items.filter((x) => x.type === type).map((x) => x.idMal);
      if (!ids.length) continue;
      const data = await request<{ Page: { media: AniListMedia[] } }>(
        `query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ${type}) { ${FIELDS} } } }`,
        { ids },
      );
      const byMal = new Map(data.Page.media.map((m) => [m.idMal, m]));
      items.forEach((x, i) => {
        if (x.type === type) result[i] = byMal.get(x.idMal) ?? null;
      });
    }
    return items.map((_, i) => result[i] ?? null);
  },
);

// ---------- Matching ----------

function titlesOf(m: AniListMedia): string[] {
  return [m.title.romaji, m.title.english, m.title.native, ...m.synonyms]
    .filter((t): t is string => !!t)
    .map(normalizeTitle);
}

function words(t: string) {
  return new Set(t.split(" ").filter((w) => w.length > 1));
}

/** 3 = same title, 2 = contained or near-identical, 1 = most words shared, 0 = unrelated. */
export function matchScore(m: AniListMedia, title: string): number {
  const wanted = searchVariants(title).map(normalizeTitle);
  let best = 0;
  for (const t of titlesOf(m)) {
    for (const w of wanted) {
      if (t === w) return 3;
      const [short, long] = t.length < w.length ? [t, w] : [w, t];
      if (short.length >= 5 && long.includes(short)) best = Math.max(best, 2);
      if (similarity(t, w) >= 0.85) best = Math.max(best, 2); // typos: "deadman wordenland"
      const a = words(t);
      const b = words(w);
      const shared = [...a].filter((x) => b.has(x)).length;
      if (shared / Math.max(a.size, b.size, 1) >= 0.6) best = Math.max(best, 1);
    }
  }
  return best;
}

export function rankCandidates(results: AniListMedia[], title: string): Candidate[] {
  const seen = new Set<number>();
  return results
    .filter((m) => !seen.has(m.id) && seen.add(m.id))
    .map((media, order) => ({ media, order, score: matchScore(media, title) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ media, score }) => ({
      media,
      quality: score === 3 ? "exacta" : score === 2 ? "parecida" : "dudosa",
    }));
}

// ---------- Public API ----------

/** Free-text search for the "link with AniList" dialog. */
export async function searchMedia(query: string, type: MediaType): Promise<AniListMedia[]> {
  const data = await request<{ Page: { media: AniListMedia[] } }>(
    `query ($q: String) { Page(perPage: 12) { media(search: $q, type: ${type}, sort: SEARCH_MATCH) { ${FIELDS} } } }`,
    { q: query },
  );
  return data.Page.media;
}

/**
 * Ranked candidates for a library title (batched with other calls made at the same time).
 * AniList search does not forgive typos ("Kaguya-sama wa kakurasetai"), so titles with no
 * results are searched again by their first words; those candidates rank as "dudosa".
 */
export async function findCandidates(title: string, tipo: string): Promise<Candidate[]> {
  const type = mediaTypeOf(tipo);
  const found = await searchBatch({ title, type });
  if (found.length) return found;
  const words = stripSeasonNotes(title).split(" ");
  const loose = [...new Set([words.slice(0, 2).join(" "), words[0] ?? ""])].filter(
    (q) => q.length >= 4 && normalizeTitle(q) !== normalizeTitle(title),
  );
  const more = await Promise.all(loose.map((q) => searchBatch({ title: q, type })));
  return rankCandidates(
    more.flat().map((c) => c.media),
    title,
  );
}

/** Best AniList entry for a series: exact ids from the backup first, then title search. */
export async function lookupSeries(
  s: Pick<Series, "titulo" | "tipo" | "anilist_id" | "mal_id">,
): Promise<{ media: AniListMedia; confident: boolean } | null> {
  if (s.anilist_id) {
    const m = await idBatch(s.anilist_id);
    if (m) return { media: m, confident: true };
  }
  if (s.mal_id) {
    const m = await malBatch({ idMal: s.mal_id, type: mediaTypeOf(s.tipo) });
    if (m) return { media: m, confident: true };
  }
  const [top] = await findCandidates(s.titulo, s.tipo);
  if (!top) return null;
  return { media: top.media, confident: top.quality !== "dudosa" };
}

export function cleanDescription(d: string | null): string | null {
  if (!d) return null;
  const text = d
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

export const preferredTitle = (m: AniListMedia) =>
  m.title.english || m.title.romaji || m.title.native || "";

/**
 * Columns to store for a linked AniList entry. Data the user already has
 * (Spanish synopsis from the backup, chosen cover, genres) is kept.
 */
export function infoPatch(
  m: AniListMedia,
  s: Series,
  opts: { replaceCover?: boolean } = {},
): Partial<Series> {
  const isAnime = m.type === "ANIME";
  const total = isAnime ? m.episodes : m.chapters;
  const patch: Partial<Series> = {
    anilist_id: m.id,
    mal_id: m.idMal ?? s.mal_id,
    anilist_url: m.siteUrl,
    total_api: total,
    puntuacion: m.averageScore,
    estado_api: m.status ? (ESTADOS_ANILIST[m.status] ?? m.status) : null,
    proximo_ep: m.nextAiringEpisode?.episode ?? null,
    proximo_ep_at: m.nextAiringEpisode
      ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString()
      : null,
    info_checked: true,
    cover_checked: true,
  };
  if (!s.sinopsis) patch.sinopsis = cleanDescription(m.description);
  if (!s.generos?.length) patch.generos = normalizeGenres(m.genres).generos;
  const cover = m.coverImage?.extraLarge ?? m.coverImage?.large ?? null;
  if (cover && (opts.replaceCover || !s.cover_url)) patch.cover_url = cover;
  if (s.tipo === "manga" && m.type === "MANGA") {
    if (m.countryOfOrigin === "KR") patch.tipo = "manhwa";
    if (m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW") patch.tipo = "manhua";
  }
  // Anime imported from a "watched" list: mark every episode as seen once we know the count.
  if (isAnime && s.estado === "Visto" && !Number(s.ultimo_cap_leido) && total) {
    Object.assign(patch, {
      ultimo_cap_leido: total,
      caps_leidos: total,
      caps_totales: total,
      sin_leer: 0,
    });
  }
  return patch;
}

const inflight = new Set<string>();

/** Link a series with AniList once (lazy, when its card becomes visible). */
export async function autoLinkSeries(
  s: Series,
  opts: { replaceCover?: boolean } = {},
): Promise<Partial<Series> | null> {
  if (inflight.has(s.id)) return null;
  inflight.add(s.id);
  try {
    // Network or rate-limit errors throw here, so the series stays unchecked and is retried later.
    const found = await lookupSeries(s);
    let patch: Partial<Series> = { info_checked: true, cover_checked: true };
    if (found?.confident) {
      patch = infoPatch(found.media, s, opts);
    } else if (found && (!s.cover_url || opts.replaceCover)) {
      // Unsure match: borrow the cover only, never the synopsis or ids.
      patch.cover_url =
        found.media.coverImage?.extraLarge ?? found.media.coverImage?.large ?? s.cover_url;
    }
    const { error } = await supabase.from("series").update(patch).eq("id", s.id);
    if (error) throw error;
    return patch;
  } catch (e) {
    console.warn("[anilist] no se pudo enlazar", s.titulo, e);
    return null;
  } finally {
    inflight.delete(s.id);
  }
}

/** An imported row after the user confirmed which AniList entry it is. */
export function rowWithMedia(row: ImportRow, m: AniListMedia): ImportRow {
  const total = m.type === "ANIME" ? m.episodes : m.chapters;
  const watched = row.estado === "Visto" && !row.ultimo_cap_leido && total;
  return {
    ...row,
    titulo: preferredTitle(m) || row.titulo,
    anilist_id: m.id,
    mal_id: m.idMal ?? row.mal_id,
    cover_url: row.cover_url ?? m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    generos: row.generos.length ? row.generos : normalizeGenres(m.genres).generos,
    sinopsis: row.sinopsis ?? cleanDescription(m.description),
    ...(watched
      ? { ultimo_cap_leido: total, caps_leidos: total, caps_totales: total, sin_leer: 0 }
      : {}),
  };
}
