import { describe, expect, it } from "vitest";
import type { Series } from "./data";
import { cleanDescription, infoPatch, rankCandidates, type AniListMedia } from "./anilist";

const media = (over: Partial<AniListMedia>): AniListMedia => ({
  id: 1,
  idMal: null,
  type: "MANGA",
  format: "MANGA",
  status: "RELEASING",
  countryOfOrigin: "JP",
  chapters: null,
  episodes: null,
  averageScore: 80,
  genres: ["Action"],
  description: null,
  siteUrl: "https://anilist.co/manga/1",
  title: { romaji: null, english: null, native: null },
  synonyms: [],
  coverImage: { large: "l.jpg", extraLarge: "xl.jpg" },
  nextAiringEpisode: null,
  startDate: null,
  ...over,
});

describe("rankCandidates", () => {
  it("prefers the exact title over AniList's first result", () => {
    const novel = media({
      id: 105664,
      title: { romaji: "Temppal", english: null, native: null },
      synonyms: ["Overgeared"],
    });
    const webtoon = media({
      id: 117460,
      title: { romaji: "Temppal", english: "Overgeared", native: null },
    });
    const other = media({
      id: 3,
      title: { romaji: "Something else", english: null, native: null },
    });
    const ranked = rankCandidates([other, novel, webtoon], "El Chetado (Overgeared)");
    expect(ranked[0]!.quality).toBe("exacta");
    expect(ranked.at(-1)!.media.id).toBe(3);
    expect(ranked.at(-1)!.quality).toBe("dudosa");
  });

  it("tolerates typos in hand-written names", () => {
    const m = media({ title: { romaji: "Deadman Wonderland", english: null, native: null } });
    expect(rankCandidates([m], "Deadman wordenland")[0]!.quality).toBe("parecida");
  });

  it("drops repeated results from different search variants", () => {
    const m = media({ title: { romaji: "Ajin", english: null, native: null } });
    expect(rankCandidates([m, m], "Ajin")).toHaveLength(1);
  });
});

describe("infoPatch", () => {
  const base = {
    tipo: "manga",
    sinopsis: null,
    generos: [],
    cover_url: null,
    mal_id: null,
    estado: null,
    ultimo_cap_leido: 0,
  } as unknown as Series;

  it("keeps the Spanish synopsis and the chosen cover", () => {
    const s = { ...base, sinopsis: "En español", cover_url: "mine.jpg" } as Series;
    const p = infoPatch(media({ description: "In English" }), s);
    expect(p.sinopsis).toBeUndefined();
    expect(p.cover_url).toBeUndefined();
    expect(infoPatch(media({}), s, { replaceCover: true }).cover_url).toBe("xl.jpg");
  });

  it("detects manhwa from the country of origin", () => {
    expect(infoPatch(media({ countryOfOrigin: "KR" }), base).tipo).toBe("manhwa");
  });

  it("marks a watched anime as complete once the episode count is known", () => {
    const s = { ...base, tipo: "anime", estado: "Visto" } as Series;
    const p = infoPatch(media({ type: "ANIME", episodes: 24 }), s);
    expect(p).toMatchObject({ ultimo_cap_leido: 24, caps_totales: 24, sin_leer: 0, total_api: 24 });
  });
});

it("cleans AniList descriptions without rendering HTML", () => {
  expect(cleanDescription("A<br><br>B &amp; <i>C</i>")).toBe("A\n\nB & C");
});
