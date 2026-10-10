// Library normalizer: turns any import source (Komikku backup, Excel, anime name list)
// into clean rows, merges duplicates of the same work and reports what it changed.
import type { BackupEntry } from "./tachibk";
import { normalizeTitle, workKey } from "./titles";

export interface ImportRow {
  titulo: string;
  tipo: string;
  fuente: string;
  fuentes: string[];
  categorias: string[];
  estado: string | null;
  ultimo_cap_leido: number;
  ultimo_cap_nombre: string | null;
  caps_leidos: number | null;
  caps_totales: number | null;
  sin_leer: number | null;
  ultimo_cap_disponible: number | null;
  ultimo_cap_tracker: number | null;
  autor: string | null;
  artista: string | null;
  sinopsis: string | null;
  generos: string[];
  cover_url: string | null;
  anilist_id: number | null;
  mal_id: number | null;
  fecha_agregado: string | null;
  last_read_at: string | null;
}

export interface Fusion {
  titulo: string;
  variantes: { titulo: string; fuente: string; ultimo: number }[];
}

export interface Analysis {
  rows: ImportRow[];
  leidas: number;
  /** Backup entries skipped because they are not in the library. */
  excluidas: number;
  fusiones: Fusion[];
  titulosLimpiados: number;
  generosUnificados: number;
  porTipo: Record<string, number>;
  porEstado: Record<string, number>;
}

const SIN_CATEGORIA = "(sin categoría)";

// English and accent-less variants found in sources → one Spanish name.
const GENEROS: Record<string, string> = {
  action: "Acción",
  accion: "Acción",
  adventure: "Aventura",
  aventura: "Aventura",
  comedy: "Comedia",
  comedia: "Comedia",
  drama: "Drama",
  fantasy: "Fantasía",
  fantasia: "Fantasía",
  romance: "Romance",
  harem: "Harem",
  isekai: "Isekai",
  magic: "Magia",
  magia: "Magia",
  ecchi: "Ecchi",
  shounen: "Shōnen",
  shonen: "Shōnen",
  seinen: "Seinen",
  shoujo: "Shōjo",
  shojo: "Shōjo",
  josei: "Josei",
  "school life": "Vida escolar",
  "vida escolar": "Vida escolar",
  "slice of life": "Recuentos de la vida",
  "recuentos de la vida": "Recuentos de la vida",
  supernatural: "Sobrenatural",
  sobrenatural: "Sobrenatural",
  demons: "Demonios",
  demonios: "Demonios",
  monsters: "Monstruos",
  monstruos: "Monstruos",
  "monster girls": "Chicas monstruo",
  psychological: "Psicológico",
  psicologico: "Psicológico",
  "martial arts": "Artes marciales",
  "artes marciales": "Artes marciales",
  reincarnation: "Reencarnación",
  reencarnacion: "Reencarnación",
  mystery: "Misterio",
  misterio: "Misterio",
  horror: "Terror",
  terror: "Terror",
  "sci fi": "Ciencia ficción",
  "science fiction": "Ciencia ficción",
  "ciencia ficcion": "Ciencia ficción",
  sports: "Deportes",
  deportes: "Deportes",
  tragedy: "Tragedia",
  tragedia: "Tragedia",
  historical: "Histórico",
  historico: "Histórico",
  military: "Militar",
  militar: "Militar",
  music: "Música",
  musica: "Música",
  thriller: "Suspenso",
  suspenso: "Suspenso",
  survival: "Supervivencia",
  supervivencia: "Supervivencia",
  cooking: "Cocina",
  cocina: "Cocina",
  "time travel": "Viajes en el tiempo",
  "gender bender": "Cambio de género",
  mecha: "Mecha",
  yuri: "Yuri",
  yaoi: "Yaoi",
  "boys love": "Yaoi",
  "girls love": "Yuri",
  aventuras: "Aventura",
  haren: "Harem",
  escolar: "Vida escolar",
  adult: "Adulto",
  adulto: "Adulto",
  "15": "+15",
  "18": "+18",
  genderswap: "Cambio de género",
  ghosts: "Fantasmas",
  vampires: "Vampiros",
  vampiros: "Vampiros",
  zombies: "Zombis",
  zombis: "Zombis",
  "video games": "Videojuegos",
  videojuegos: "Videojuegos",
  "traditional games": "Juegos tradicionales",
  superhero: "Superhéroes",
  superheroes: "Superhéroes",
  police: "Policial",
  policial: "Policial",
  "office workers": "Oficina",
  animals: "Animales",
  animales: "Animales",
  medico: "Médico",
  medical: "Médico",
  regresion: "Regresión",
  regression: "Regresión",
  evolucion: "Evolución",
  historia: "Histórico",
  crime: "Crimen",
  family: "Familia",
  war: "Guerra",
  system: "Sistema",
};

// Noise some sources put in the genre list: statuses, ratings and media formats.
const NO_GENERO = /^(content rating.*|en emision|finalizado|anime|novela|novel|one shot|oneshot)$/;

// Format "genres" some sources add; used to detect the type, never kept as genres.
const FORMATOS: Record<string, string> = {
  manga: "manga",
  manhwa: "manhwa",
  webtoon: "manhwa",
  manhua: "manhua",
};

export function cleanTitle(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

export function normalizeGenres(raw: string[]): { generos: string[]; formatos: string[] } {
  const generos = new Set<string>();
  const formatos: string[] = [];
  for (const g of raw) {
    const key = normalizeTitle(g.replace(/^\s*tags?\s*:\s*/i, ""));
    if (!key || NO_GENERO.test(key)) continue;
    if (FORMATOS[key]) formatos.push(FORMATOS[key]);
    else
      generos.add(
        GENEROS[key] ??
          cleanTitle(g.replace(/^\s*tags?\s*:\s*/i, "")).replace(/^\p{Ll}/u, (c) =>
            c.toUpperCase(),
          ),
      );
  }
  return { generos: [...generos].sort((a, b) => a.localeCompare(b, "es")), formatos };
}

/** manhwa/manhua from category names ("MANWHAS AL DIA") or format genres, else manga. */
export function detectTipo(categorias: string[], formatos: string[]): string {
  const cats = normalizeTitle(categorias.join(" "));
  if (/\bman(hwa|wha)s?\b/.test(cats)) return "manhwa"; // "manwha" is a common misspelling
  if (/\bmanhuas?\b/.test(cats)) return "manhua";
  return formatos.find((f) => f !== "manga") ?? "manga";
}

function emptyRow(titulo: string, tipo: string): ImportRow {
  return {
    titulo,
    tipo,
    fuente: "",
    fuentes: [],
    categorias: [],
    estado: null,
    ultimo_cap_leido: 0,
    ultimo_cap_nombre: null,
    caps_leidos: null,
    caps_totales: null,
    sin_leer: null,
    ultimo_cap_disponible: null,
    ultimo_cap_tracker: null,
    autor: null,
    artista: null,
    sinopsis: null,
    generos: [],
    cover_url: null,
    anilist_id: null,
    mal_id: null,
    fecha_agregado: null,
    last_read_at: null,
  };
}

interface Counters {
  titulosLimpiados: number;
  generosUnificados: number;
}

export function rowFromBackup(e: BackupEntry, c: Counters): ImportRow {
  const titulo = cleanTitle(e.titulo);
  if (titulo !== e.titulo) c.titulosLimpiados++;
  const { generos, formatos } = normalizeGenres(e.generos);
  if (generos.length + formatos.length !== e.generos.length) c.generosUnificados++;
  return {
    ...emptyRow(titulo, detectTipo(e.categorias, formatos)),
    fuente: e.fuente,
    fuentes: e.fuente ? [e.fuente] : [],
    categorias: e.categorias,
    estado: e.estado,
    ultimo_cap_leido: e.ultimoLeido ?? 0,
    ultimo_cap_nombre: e.ultimoLeidoNombre,
    caps_leidos: e.capsLeidos,
    caps_totales: e.capsTotales,
    sin_leer: Math.max(0, e.capsTotales - e.capsLeidos),
    ultimo_cap_disponible: e.ultimoDisponible,
    ultimo_cap_tracker: e.ultimoTracker,
    autor: e.autor?.trim() || null,
    artista: e.artista?.trim() || null,
    sinopsis: e.sinopsis?.trim() || null,
    generos,
    cover_url: e.portada,
    anilist_id: e.anilistId,
    mal_id: e.malId,
    fecha_agregado: e.fechaAgregado,
    last_read_at: e.ultimaLectura,
  };
}

const COL = {
  titulo: "Título",
  categoria: "Categoría",
  fuente: "Fuente",
  estado: "Estado",
  ultimo_cap_leido: "Último cap. leído (nº)",
  ultimo_cap_nombre: "Último cap. leído (nombre)",
  caps_leidos: "Caps. leídos",
  caps_totales: "Caps. totales",
  sin_leer: "Sin leer",
  ultimo_cap_disponible: "Último cap. disponible",
  ultimo_cap_tracker: "Último cap. en tracker",
} as const;

export const EXCEL_COLUMNS = Object.values(COL);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => {
  const s = v == null ? "" : cleanTitle(String(v));
  return s || null;
};
const int = (v: unknown) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

export function rowFromExcel(r: Record<string, unknown>, c: Counters): ImportRow | null {
  const raw = r[COL.titulo];
  const titulo = str(raw);
  if (!titulo) return null;
  if (titulo !== raw) c.titulosLimpiados++;
  const categorias = (str(r[COL.categoria]) ?? "")
    .split(", ")
    .map((x) => x.trim())
    .filter((x) => x && x !== SIN_CATEGORIA);
  const fuente = str(r[COL.fuente]) ?? "";
  return {
    ...emptyRow(titulo, detectTipo(categorias, [])),
    fuente,
    fuentes: fuente ? [fuente] : [],
    categorias,
    estado: str(r[COL.estado]),
    ultimo_cap_leido: num(r[COL.ultimo_cap_leido]) ?? 0,
    ultimo_cap_nombre: str(r[COL.ultimo_cap_nombre]),
    caps_leidos: int(r[COL.caps_leidos]),
    caps_totales: int(r[COL.caps_totales]),
    sin_leer: int(r[COL.sin_leer]),
    ultimo_cap_disponible: num(r[COL.ultimo_cap_disponible]),
    ultimo_cap_tracker: num(r[COL.ultimo_cap_tracker]),
  };
}

export function rowFromAnimeName(name: string, c: Counters): ImportRow | null {
  const titulo = cleanTitle(name);
  if (!titulo) return null;
  if (titulo !== name) c.titulosLimpiados++;
  return { ...emptyRow(titulo, "anime"), estado: "Visto", categorias: ["Vistos"] };
}

const maxOf = (vals: (number | null)[]) => {
  const ns = vals.filter((v): v is number => v != null);
  return ns.length ? Math.max(...ns) : null;
};
const union = (lists: string[][]) => [...new Set(lists.flat())];
const firstSet = <T>(vals: (T | null)[]) => vals.find((v) => v != null && v !== "") ?? null;

/** The entry with the most progress represents the merged work. */
function primaryOf(rows: ImportRow[]): ImportRow {
  return rows.reduce((best, r) => {
    const d = r.ultimo_cap_leido - best.ultimo_cap_leido;
    if (d !== 0) return d > 0 ? r : best;
    const dl = (r.caps_leidos ?? 0) - (best.caps_leidos ?? 0);
    if (dl !== 0) return dl > 0 ? r : best;
    return !best.fuente && r.fuente ? r : best;
  });
}

export function mergeRows(rows: ImportRow[]): ImportRow {
  if (rows.length === 1) return rows[0]!;
  const p = primaryOf(rows);
  const others = [p, ...rows.filter((r) => r !== p)];
  const dates = (k: "fecha_agregado" | "last_read_at") =>
    rows
      .map((r) => r[k])
      .filter((d): d is string => !!d)
      .sort();
  return {
    ...p,
    // A copy filed under "MANWHAS AL DIA" tells us the type even if the primary copy doesn't.
    tipo: rows.find((r) => r.tipo !== "manga")?.tipo ?? p.tipo,
    fuentes: union(others.map((r) => r.fuentes)),
    categorias: union(others.map((r) => r.categorias)),
    generos: union(others.map((r) => r.generos)).sort((a, b) => a.localeCompare(b, "es")),
    caps_totales: maxOf(rows.map((r) => r.caps_totales)),
    ultimo_cap_disponible: maxOf(rows.map((r) => r.ultimo_cap_disponible)),
    ultimo_cap_tracker: maxOf(rows.map((r) => r.ultimo_cap_tracker)),
    estado: firstSet(others.map((r) => r.estado)),
    autor: firstSet(others.map((r) => r.autor)),
    artista: firstSet(others.map((r) => r.artista)),
    sinopsis: firstSet(others.map((r) => r.sinopsis)),
    cover_url: firstSet(others.map((r) => r.cover_url)),
    anilist_id: firstSet(others.map((r) => r.anilist_id)),
    mal_id: firstSet(others.map((r) => r.mal_id)),
    fecha_agregado: dates("fecha_agregado")[0] ?? null,
    last_read_at: dates("last_read_at").at(-1) ?? null,
  };
}

function countBy(rows: ImportRow[], k: (r: ImportRow) => string) {
  const out: Record<string, number> = {};
  for (const r of rows) out[k(r)] = (out[k(r)] ?? 0) + 1;
  return out;
}

function finish(rows: ImportRow[], leidas: number, excluidas: number, c: Counters): Analysis {
  const groups = new Map<string, ImportRow[]>();
  for (const r of rows) {
    const k = workKey(r.titulo, r.tipo);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const merged: ImportRow[] = [];
  const fusiones: Fusion[] = [];
  for (const g of groups.values()) {
    const m = mergeRows(g);
    merged.push(m);
    if (g.length > 1) {
      fusiones.push({
        titulo: m.titulo,
        variantes: g.map((r) => ({
          titulo: r.titulo,
          fuente: r.fuente,
          ultimo: r.ultimo_cap_leido,
        })),
      });
    }
  }
  merged.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  return {
    rows: merged,
    leidas,
    excluidas,
    fusiones,
    ...c,
    porTipo: countBy(merged, (r) => r.tipo),
    porEstado: countBy(merged, (r) => r.estado ?? "Sin estado"),
  };
}

export function analyzeBackup(entries: BackupEntry[], incluirFueraDeBiblioteca = false): Analysis {
  const c: Counters = { titulosLimpiados: 0, generosUnificados: 0 };
  const kept = entries.filter((e) => incluirFueraDeBiblioteca || e.favorito);
  return finish(
    kept.map((e) => rowFromBackup(e, c)),
    entries.length,
    entries.length - kept.length,
    c,
  );
}

export function analyzeExcel(raw: Record<string, unknown>[]): Analysis {
  const c: Counters = { titulosLimpiados: 0, generosUnificados: 0 };
  const rows = raw.map((r) => rowFromExcel(r, c)).filter((r): r is ImportRow => !!r);
  return finish(rows, raw.length, 0, c);
}

export function analyzeAnimeNames(names: string[]): Analysis {
  const c: Counters = { titulosLimpiados: 0, generosUnificados: 0 };
  const rows = names.map((n) => rowFromAnimeName(n, c)).filter((r): r is ImportRow => !!r);
  return finish(rows, names.length, 0, c);
}

/** Re-run the duplicate merge after anime names were resolved to canonical AniList titles. */
export function remergeRows(rows: ImportRow[], base: Analysis): Analysis {
  const byId = new Map<number, ImportRow[]>();
  const rest: ImportRow[] = [];
  for (const r of rows) {
    if (r.anilist_id) byId.set(r.anilist_id, [...(byId.get(r.anilist_id) ?? []), r]);
    else rest.push(r);
  }
  const fusiones = [...base.fusiones];
  const merged = [...rest];
  for (const g of byId.values()) {
    merged.push(mergeRows(g));
    if (g.length > 1) {
      fusiones.push({
        titulo: g[0]!.titulo,
        variantes: g.map((r) => ({
          titulo: r.titulo,
          fuente: r.fuente,
          ultimo: r.ultimo_cap_leido,
        })),
      });
    }
  }
  const again = finish(merged, base.leidas, base.excluidas, {
    titulosLimpiados: base.titulosLimpiados,
    generosUnificados: base.generosUnificados,
  });
  return { ...again, fusiones: [...fusiones, ...again.fusiones] };
}
