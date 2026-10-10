// Import service: parse the "Mangas" sheet and upsert by (titulo, fuente).
// Never touches notes, schedules, tipo, or covers already chosen.
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Series } from "./data";

export const COLUMNS = {
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

export interface ImportRow {
  titulo: string;
  categoria: string | null;
  fuente: string;
  estado: string | null;
  ultimo_cap_leido: number;
  ultimo_cap_nombre: string | null;
  caps_leidos: number | null;
  caps_totales: number | null;
  sin_leer: number | null;
  ultimo_cap_disponible: number | null;
  ultimo_cap_tracker: number | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};
const int = (v: unknown) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

export function parseWorkbook(buf: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets["Mangas"];
  if (!sheet) throw new Error('No se encontró la hoja "Mangas" en el archivo.');
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const rows: ImportRow[] = [];
  for (const r of raw) {
    const titulo = str(r[COLUMNS.titulo]);
    if (!titulo) continue;
    rows.push({
      titulo,
      categoria: str(r[COLUMNS.categoria]),
      fuente: str(r[COLUMNS.fuente]) ?? "",
      estado: str(r[COLUMNS.estado]),
      ultimo_cap_leido: num(r[COLUMNS.ultimo_cap_leido]) ?? 0,
      ultimo_cap_nombre: str(r[COLUMNS.ultimo_cap_nombre]),
      caps_leidos: int(r[COLUMNS.caps_leidos]),
      caps_totales: int(r[COLUMNS.caps_totales]),
      sin_leer: int(r[COLUMNS.sin_leer]),
      ultimo_cap_disponible: num(r[COLUMNS.ultimo_cap_disponible]),
      ultimo_cap_tracker: num(r[COLUMNS.ultimo_cap_tracker]),
    });
  }
  return rows;
}

const key = (t: string, f: string) => `${t.trim().toLowerCase()}|${f.trim().toLowerCase()}`;
const FIELDS = Object.keys(COLUMNS) as (keyof ImportRow)[];

export interface ImportPlan {
  nuevas: ImportRow[];
  actualizadas: { row: ImportRow; existing: Series }[];
  sinCambios: number;
  total: number;
}

export function planImport(rows: ImportRow[], existing: Series[]): ImportPlan {
  const map = new Map(existing.map((s) => [key(s.titulo, s.fuente), s]));
  const seen = new Set<string>();
  const plan: ImportPlan = { nuevas: [], actualizadas: [], sinCambios: 0, total: 0 };
  for (const row of rows) {
    const k = key(row.titulo, row.fuente);
    if (seen.has(k)) continue;
    seen.add(k);
    plan.total++;
    const ex = map.get(k);
    if (!ex) plan.nuevas.push(row);
    else {
      const changed = FIELDS.some((f) => {
        if (f === "titulo" || f === "fuente") return false;
        const a = row[f] as unknown, b = (ex as any)[f];
        return (a ?? null) !== null && String(a) !== String(b ?? "")
          ? true
          : a == null && b != null
            ? false
            : false;
      });
      if (changed) plan.actualizadas.push({ row, existing: ex });
      else plan.sinCambios++;
    }
  }
  return plan;
}

export async function applyImport(plan: ImportPlan, archivo: string) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown>[] = [
    ...plan.nuevas.map((r) => ({ ...r })),
    ...plan.actualizadas.map(({ row, existing }) => {
      const p: Record<string, unknown> = { titulo: existing.titulo, fuente: existing.fuente };
      for (const f of FIELDS) {
        if (f === "titulo" || f === "fuente") continue;
        if (row[f] != null) p[f] = row[f];
      }
      if (row.ultimo_cap_leido > Number(existing.ultimo_cap_leido)) p.last_read_at = now;
      return p;
    }),
  ];
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await supabase
      .from("series")
      .upsert(payload.slice(i, i + 200) as any, {
        onConflict: "user_id,titulo,fuente",
        defaultToNull: false,
      });
    if (error) throw error;
  }
  const { error } = await supabase.from("import_logs").insert({
    archivo,
    total: plan.total,
    nuevas: plan.nuevas.length,
    actualizadas: plan.actualizadas.length,
  });
  if (error) throw error;
}
