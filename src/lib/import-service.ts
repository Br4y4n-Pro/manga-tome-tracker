// Import service: read a Komikku backup or an Excel file, plan the changes against
// the library (merging duplicates already stored) and apply them.
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { Series } from "./data";
import {
  analyzeAnimeNames,
  analyzeBackup,
  analyzeExcel,
  type Analysis,
  type ImportRow,
} from "./normalizer";
import { parseTachibk, type BackupEntry } from "./tachibk";
import { workKey } from "./titles";

export type ImportSource = "komikku" | "excel-mangas" | "excel-anime";

export interface ParsedFile {
  source: ImportSource;
  analysis: Analysis;
  /** Raw backup entries, kept to re-analyze when toggling "include entries outside the library". */
  backup?: BackupEntry[];
}

type SeriesRecord = TablesInsert<"series">;

export interface DbFusion {
  keep: Series;
  remove: Series[];
}

export interface ImportPlan {
  nuevas: SeriesRecord[];
  actualizadas: { existing: Series; record: SeriesRecord & { id: string } }[];
  sinCambios: number;
  /** Duplicates already stored in the library that will be merged into one series. */
  fusiones: DbFusion[];
  /** Reading series not present in a full-library backup (deleted only if the user opts in). */
  huerfanas: Series[];
  total: number;
}

const ANIME_COLUMNS = ["anime", "titulo", "título", "nombre", "title"];

export async function readImportFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  if (/\.(tachibk|proto\.gz)$/i.test(file.name)) {
    const backup = await parseTachibk(buf);
    if (!backup.length) throw new Error("El respaldo no tiene mangas.");
    return { source: "komikku", analysis: analyzeBackup(backup), backup };
  }

  const wb = XLSX.read(buf, { type: "array" });
  const mangas = wb.Sheets["Mangas"];
  if (mangas) {
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(mangas, { defval: null });
    return { source: "excel-mangas", analysis: analyzeExcel(raw) };
  }
  for (const name of wb.SheetNames) {
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]!, {
      defval: null,
    });
    const col = Object.keys(raw[0] ?? {}).find((k) =>
      ANIME_COLUMNS.includes(k.trim().toLowerCase()),
    );
    if (col) {
      const names = raw
        .map((r) => r[col])
        .filter((v): v is string | number => v != null && v !== "");
      return { source: "excel-anime", analysis: analyzeAnimeNames(names.map(String)) };
    }
  }
  throw new Error(
    'No reconozco el archivo: usa un respaldo .tachibk, un Excel con la hoja "Mangas" o una lista con la columna "Anime".',
  );
}

// ---------- Planning ----------

const progress = (s: Pick<Series, "ultimo_cap_leido">) => Number(s.ultimo_cap_leido) || 0;
const union = (...lists: (string[] | null | undefined)[]) => [
  ...new Set(lists.flatMap((l) => l ?? [])),
];
const maxNum = (...vals: (number | null | undefined)[]) => {
  const ns = vals.filter((v): v is number => v != null).map(Number);
  return ns.length ? Math.max(...ns) : null;
};
const minDate = (...d: (string | null | undefined)[]) =>
  d.filter((x): x is string => !!x).sort()[0] ?? null;
const maxDate = (...d: (string | null | undefined)[]) =>
  d
    .filter((x): x is string => !!x)
    .sort()
    .at(-1) ?? null;

/** The series that survives a merge: most progress, then the one already linked, then the oldest. */
function pickKeeper(group: Series[]): Series {
  return [...group].sort(
    (a, b) =>
      progress(b) - progress(a) ||
      Number(!!b.anilist_id) - Number(!!a.anilist_id) ||
      a.created_at.localeCompare(b.created_at),
  )[0]!;
}

/** Values of a stored group of duplicates combined into its keeper. */
function combineGroup(keep: Series, group: Series[]): Series {
  if (group.length === 1) return keep;
  const top = group.reduce((a, b) => (progress(b) > progress(a) ? b : a));
  return {
    ...keep,
    ultimo_cap_leido: top.ultimo_cap_leido,
    ultimo_cap_nombre: top.ultimo_cap_nombre,
    caps_leidos: maxNum(...group.map((s) => s.caps_leidos)),
    caps_totales: maxNum(...group.map((s) => s.caps_totales)),
    ultimo_cap_disponible: maxNum(...group.map((s) => s.ultimo_cap_disponible)),
    fuentes: union(...group.map((s) => s.fuentes), group.map((s) => s.fuente).filter(Boolean)),
    categorias: union(...group.map((s) => s.categorias)),
    cover_url: keep.cover_url ?? group.find((s) => s.cover_url)?.cover_url ?? null,
    anilist_id: keep.anilist_id ?? group.find((s) => s.anilist_id)?.anilist_id ?? null,
    last_read_at: maxDate(...group.map((s) => s.last_read_at)),
  };
}

function recordFromRow(row: ImportRow): SeriesRecord {
  return {
    ...row,
    categoria: row.categorias.join(", ") || null,
    cover_checked: false,
    info_checked: false,
  };
}

/** Import data wins for reading state; choices made in the app (cover, type, AniList link) are kept. */
function mergedRecord(e: Series, row: ImportRow): SeriesRecord & { id: string } {
  const rowAhead = row.ultimo_cap_leido >= progress(e);
  const categorias = row.categorias.length ? row.categorias : e.categorias;
  return {
    id: e.id,
    titulo: row.titulo,
    tipo: e.tipo !== "manga" ? e.tipo : row.tipo,
    fuente: row.fuente || e.fuente,
    fuentes: union(row.fuentes, e.fuentes),
    categorias,
    categoria: categorias.join(", ") || null,
    estado: row.estado ?? e.estado,
    ultimo_cap_leido: rowAhead ? row.ultimo_cap_leido : progress(e),
    ultimo_cap_nombre: rowAhead ? row.ultimo_cap_nombre : e.ultimo_cap_nombre,
    caps_leidos: row.caps_leidos ?? e.caps_leidos,
    caps_totales: row.caps_totales ?? e.caps_totales,
    sin_leer: row.sin_leer ?? e.sin_leer,
    ultimo_cap_disponible: row.ultimo_cap_disponible ?? e.ultimo_cap_disponible,
    ultimo_cap_tracker: row.ultimo_cap_tracker ?? e.ultimo_cap_tracker,
    autor: row.autor ?? e.autor,
    artista: row.artista ?? e.artista,
    sinopsis: row.sinopsis ?? e.sinopsis,
    generos: row.generos.length ? row.generos : e.generos,
    cover_url: e.cover_url ?? row.cover_url,
    anilist_id: e.anilist_id ?? row.anilist_id,
    mal_id: e.mal_id ?? row.mal_id,
    fecha_agregado: minDate(e.fecha_agregado, row.fecha_agregado),
    last_read_at: maxDate(e.last_read_at, row.last_read_at),
  };
}

function changed(record: SeriesRecord, e: Series): boolean {
  const stored = e as unknown as Record<string, unknown>;
  return Object.entries(record).some(
    ([k, v]) => JSON.stringify(v ?? null) !== JSON.stringify(stored[k] ?? null),
  );
}

export function planImport(
  rows: ImportRow[],
  existing: Series[],
  opts: { fullLibrary: boolean },
): ImportPlan {
  const groups = new Map<string, Series[]>();
  for (const s of existing) {
    const k = workKey(s.titulo, s.tipo);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const keepers = new Map<string, Series>();
  const fusiones: DbFusion[] = [];
  const byAnilist = new Map<number, string>();
  for (const [k, group] of groups) {
    const keep = pickKeeper(group);
    keepers.set(k, combineGroup(keep, group));
    if (group.length > 1) fusiones.push({ keep, remove: group.filter((s) => s !== keep) });
    for (const s of group) if (s.anilist_id) byAnilist.set(s.anilist_id, k);
  }

  const plan: ImportPlan = {
    nuevas: [],
    actualizadas: [],
    sinCambios: 0,
    fusiones,
    huerfanas: [],
    total: rows.length,
  };
  const matched = new Set<string>();
  for (const row of rows) {
    let k = workKey(row.titulo, row.tipo);
    if (!keepers.has(k) && row.anilist_id && byAnilist.has(row.anilist_id))
      k = byAnilist.get(row.anilist_id)!;
    const e = keepers.get(k);
    if (!e) {
      plan.nuevas.push(recordFromRow(row));
      continue;
    }
    if (matched.has(k)) continue;
    matched.add(k);
    const record = mergedRecord(e, row);
    const isFused = (groups.get(k)?.length ?? 0) > 1;
    if (isFused || changed(record, e)) plan.actualizadas.push({ existing: e, record });
    else plan.sinCambios++;
  }

  if (opts.fullLibrary) {
    plan.huerfanas = [...keepers.entries()]
      .filter(([k, s]) => !matched.has(k) && s.tipo !== "anime")
      .map(([k]) => pickKeeper(groups.get(k)!));
  }
  return plan;
}

// ---------- Applying ----------

const CHUNK = 200;

async function inChunks<T>(items: T[], fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += CHUNK) await fn(items.slice(i, i + CHUNK));
}

function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

async function applyFusion(f: DbFusion) {
  const ids = f.remove.map((s) => s.id);
  // Notes move to the surviving series.
  check(await supabase.from("chapter_notes").update({ series_id: f.keep.id }).in("series_id", ids));
  // One schedule per series: keep the survivor's, otherwise adopt one from a duplicate.
  const { data: schedules } = check(
    await supabase
      .from("release_schedules")
      .select("id, series_id")
      .in("series_id", [f.keep.id, ...ids]),
  );
  const adopt = schedules?.find((s) => s.series_id !== f.keep.id);
  if (adopt && !schedules?.some((s) => s.series_id === f.keep.id)) {
    check(
      await supabase.from("release_schedules").update({ series_id: f.keep.id }).eq("id", adopt.id),
    );
  }
  const group = [f.keep, ...f.remove];
  const notas = [...new Set(group.map((s) => s.nota_general?.trim()).filter(Boolean))];
  const combined = combineGroup(f.keep, group);
  check(
    await supabase
      .from("series")
      .update({
        ultimo_cap_leido: combined.ultimo_cap_leido,
        ultimo_cap_nombre: combined.ultimo_cap_nombre,
        caps_leidos: combined.caps_leidos,
        caps_totales: combined.caps_totales,
        ultimo_cap_disponible: combined.ultimo_cap_disponible,
        fuentes: combined.fuentes,
        categorias: combined.categorias,
        cover_url: combined.cover_url,
        anilist_id: combined.anilist_id,
        last_read_at: combined.last_read_at,
        nota_general: notas.join("\n\n") || null,
      })
      .eq("id", f.keep.id),
  );
  check(await supabase.from("series").delete().in("id", ids));
}

/** Series with notes or a schedule are never deleted automatically. */
async function protectedIds(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  await inChunks(ids, async (chunk) => {
    const notes = check(
      await supabase.from("chapter_notes").select("series_id").in("series_id", chunk),
    );
    const sched = check(
      await supabase.from("release_schedules").select("series_id").in("series_id", chunk),
    );
    for (const r of [...(notes.data ?? []), ...(sched.data ?? [])]) out.add(r.series_id);
  });
  return out;
}

export interface ImportResult {
  nuevas: number;
  actualizadas: number;
  fusionadas: number;
  eliminadas: number;
  protegidas: number;
}

export async function applyImport(
  plan: ImportPlan,
  archivo: string,
  opts: { borrarHuerfanas: boolean },
): Promise<ImportResult> {
  for (const f of plan.fusiones) await applyFusion(f);

  // Every record in a batch has the same keys, so the upsert never resets a column to its default.
  await inChunks(plan.actualizadas, async (chunk) => {
    check(
      await supabase.from("series").upsert(
        chunk.map((u) => u.record),
        { onConflict: "id" },
      ),
    );
  });
  await inChunks(plan.nuevas, async (chunk) => {
    check(await supabase.from("series").insert(chunk));
  });

  let eliminadas = 0;
  let protegidas = 0;
  if (opts.borrarHuerfanas && plan.huerfanas.length) {
    const ids = plan.huerfanas.map((s) => s.id);
    const keep = await protectedIds(ids);
    const toDelete = ids.filter((id) => !keep.has(id));
    await inChunks(toDelete, async (chunk) => {
      check(await supabase.from("series").delete().in("id", chunk));
    });
    eliminadas = toDelete.length;
    protegidas = keep.size;
  }

  check(
    await supabase.from("import_logs").insert({
      archivo,
      total: plan.total,
      nuevas: plan.nuevas.length,
      actualizadas: plan.actualizadas.length,
    }),
  );
  return {
    nuevas: plan.nuevas.length,
    actualizadas: plan.actualizadas.length,
    fusionadas: plan.fusiones.reduce((n, f) => n + f.remove.length, 0),
    eliminadas,
    protegidas,
  };
}
