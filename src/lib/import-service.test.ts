import { describe, expect, it } from "vitest";
import type { Series } from "./data";
import { planImport } from "./import-service";
import { analyzeAnimeNames, analyzeExcel } from "./normalizer";

let n = 0;
const series = (over: Partial<Series>): Series => ({
  id: `id-${++n}`,
  user_id: "u",
  titulo: "Hectopascal",
  tipo: "manga",
  fuente: "",
  fuentes: [],
  categoria: null,
  categorias: [],
  estado: null,
  cover_url: null,
  cover_checked: false,
  info_checked: false,
  ultimo_cap_leido: 0,
  ultimo_cap_nombre: null,
  caps_leidos: null,
  caps_totales: null,
  sin_leer: null,
  ultimo_cap_disponible: null,
  ultimo_cap_tracker: null,
  nota_general: null,
  last_read_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  autor: null,
  artista: null,
  sinopsis: null,
  generos: [],
  anilist_id: null,
  mal_id: null,
  anilist_url: null,
  total_api: null,
  puntuacion: null,
  estado_api: null,
  proximo_ep: null,
  proximo_ep_at: null,
  fecha_agregado: null,
  ...over,
});

const excel = (titulo: string, cap: number) =>
  analyzeExcel([{ Título: titulo, "Último cap. leído (nº)": cap }]).rows;

describe("planImport", () => {
  it("merges duplicates already stored, keeping the one with most progress", () => {
    const a = series({ titulo: "Hectopascal", fuente: "A", ultimo_cap_leido: 3 });
    const b = series({ titulo: "hectopascal", fuente: "B", ultimo_cap_leido: 8 });
    const plan = planImport([], [a, b], { fullLibrary: false });
    expect(plan.fusiones).toHaveLength(1);
    expect(plan.fusiones[0]!.keep.id).toBe(b.id);
    expect(plan.fusiones[0]!.remove.map((s) => s.id)).toEqual([a.id]);
  });

  it("never lowers progress made in the app", () => {
    const e = series({ ultimo_cap_leido: 12, ultimo_cap_nombre: "Cap 12" });
    const plan = planImport(excel("Hectopascal", 10), [e], { fullLibrary: false });
    expect(plan.actualizadas[0]?.record.ultimo_cap_leido ?? 12).toBe(12);
  });

  it("keeps the cover and type chosen in the app", () => {
    const e = series({ cover_url: "mine.jpg", tipo: "manhwa", ultimo_cap_leido: 1 });
    const plan = planImport(excel("Hectopascal", 5), [e], { fullLibrary: false });
    expect(plan.actualizadas[0]!.record).toMatchObject({
      cover_url: "mine.jpg",
      tipo: "manhwa",
      ultimo_cap_leido: 5,
    });
  });

  it("reports unchanged rows instead of rewriting them", () => {
    const first = planImport(excel("Hectopascal", 5), [], { fullLibrary: false }).nuevas[0]!;
    const stored = series({ ...(first as Partial<Series>), id: "x" });
    const plan = planImport(excel("Hectopascal", 5), [stored], { fullLibrary: false });
    expect(plan.sinCambios).toBe(1);
    expect(plan.actualizadas).toHaveLength(0);
  });

  it("lists reading series missing from a full backup, never anime", () => {
    const kept = series({ titulo: "Hectopascal" });
    const gone = series({ titulo: "Old manga" });
    const anime = series({ titulo: "Ajin", tipo: "anime" });
    const plan = planImport(excel("Hectopascal", 1), [kept, gone, anime], { fullLibrary: true });
    expect(plan.huerfanas.map((s) => s.titulo)).toEqual(["Old manga"]);
  });

  it("does not match an anime with a manga of the same name", () => {
    const manga = series({ titulo: "Ajin", tipo: "manga" });
    const plan = planImport(analyzeAnimeNames(["Ajin"]).rows, [manga], { fullLibrary: false });
    expect(plan.nuevas).toHaveLength(1);
    expect(plan.nuevas[0]!.tipo).toBe("anime");
  });
});
