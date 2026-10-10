// Title helpers shared by the importer (duplicate detection) and the AniList lookup.

/** Case-, accent- and punctuation-insensitive form used to detect the same work. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** 0..1 edit-distance similarity of two normalized titles, to tolerate typos. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[b.length]! / Math.max(a.length, b.length);
}

/** Anime and reading entries with the same name are different works. */
export function workKey(titulo: string, tipo: string): string {
  return `${tipo === "anime" ? "anime" : "lectura"}|${normalizeTitle(titulo)}`;
}

/**
 * Drops the season/progress notes people add to hand-written lists:
 * "Attack of Titan TEMP 1" → "Attack of Titan", "Date a Live I , II , III" → "Date a Live",
 * "Bungou stary dogs s3" → "Bungou stary dogs", "Fairy Tail Finaln serie" → "Fairy Tail".
 */
export function stripSeasonNotes(title: string): string {
  return title
    .replace(/\?+/g, " ")
    .replace(/\b(temp(orada)?|season|s)\s*\d+(\s*[,y&-]\s*\d+)*/gi, " ")
    .replace(/\bfinal?n?\s+serie\b|\bfin\b/gi, " ")
    .replace(/(\s*,?\s*\b[IVX]{1,4}\b)+\s*$/, " ")
    .replace(/[\s,.:;-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Search variants for a library title, best first:
 * "El Chetado (Overgeared)" → ["El Chetado (Overgeared)", "Overgeared", "El Chetado"]
 * "Foo: Bar. (2020)"        → ["Foo: Bar. (2020)", "Foo: Bar."]
 * "Mob physco temp 1,2"     → ["Mob physco temp 1,2", "Mob physco"]
 */
export function searchVariants(title: string): string[] {
  const clean = title.trim();
  const inParens = [...clean.matchAll(/\(([^)]+)\)/g)]
    .map((m) => m[1]!.trim())
    .filter((t) => !/^\d{4}$/.test(t));
  const withoutParens = clean.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const out = [clean, stripSeasonNotes(clean), ...inParens, withoutParens].filter(
    (t) => t.length >= 2,
  );
  return [...new Set(out)];
}
