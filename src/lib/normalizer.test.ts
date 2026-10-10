import { describe, expect, it } from "vitest";
import {
  analyzeAnimeNames,
  analyzeBackup,
  analyzeExcel,
  detectTipo,
  normalizeGenres,
} from "./normalizer";
import { normalizeTitle, searchVariants, stripSeasonNotes, workKey } from "./titles";
import type { BackupEntry } from "./tachibk";

const entry = (over: Partial<BackupEntry>): BackupEntry => ({
  titulo: "Solo Leveling",
  fuente: "LeerCapitulo",
  estado: "En emisión",
  categorias: ["MANWHAS AL DIA 👌"],
  autor: null,
  artista: null,
  sinopsis: null,
  generos: [],
  portada: null,
  favorito: true,
  fechaAgregado: null,
  ultimaLectura: null,
  ultimoLeido: 10,
  ultimoLeidoNombre: "Capítulo 10",
  capsLeidos: 10,
  capsTotales: 12,
  ultimoDisponible: 12,
  ultimoTracker: null,
  anilistId: null,
  malId: null,
  ...over,
});

describe("titles", () => {
  it("ignores case, accents, punctuation and extra spaces", () => {
    expect(normalizeTitle("Mi papá es demasiado  fuerte ")).toBe(
      normalizeTitle("mi papa es demasiado fuerte"),
    );
    expect(normalizeTitle("Hectopascal")).toBe(normalizeTitle("hectopascal"));
  });
  it("keeps anime and reading works apart", () => {
    expect(workKey("Ajin", "anime")).not.toBe(workKey("Ajin", "manga"));
    expect(workKey("Ajin", "manhwa")).toBe(workKey("Ajin", "manga"));
  });
  it("drops season notes from hand-written anime names", () => {
    expect(stripSeasonNotes("Attack of Titan TEMP 1")).toBe("Attack of Titan");
    expect(stripSeasonNotes("Mob physco temp 1,2")).toBe("Mob physco");
    expect(stripSeasonNotes("Date a Live I , II , III")).toBe("Date a Live");
    expect(stripSeasonNotes("Bungou stary dogs s3")).toBe("Bungou stary dogs");
    expect(stripSeasonNotes("Damanchi season 2")).toBe("Damanchi");
    expect(stripSeasonNotes("3D kanojo: Real Girl temp 1,2 fin")).toBe("3D kanojo: Real Girl");
    expect(stripSeasonNotes("Fairy Tail Finaln serie")).toBe("Fairy Tail");
    expect(stripSeasonNotes("Sword Art Online ???.????.??. alization")).toBe(
      "Sword Art Online . . . alization",
    );
    expect(stripSeasonNotes("Re:Zero")).toBe("Re:Zero");
    expect(stripSeasonNotes("Steins:gate")).toBe("Steins:gate");
  });

  it("builds search variants from parentheses and drops years", () => {
    expect(searchVariants("El Chetado (Overgeared)")).toEqual([
      "El Chetado (Overgeared)",
      "Overgeared",
      "El Chetado",
    ]);
    expect(searchVariants("Foo (2020)")).toEqual(["Foo (2020)", "Foo"]);
  });
});

describe("normalizer", () => {
  it("unifies genres and pulls out format tags", () => {
    const r = normalizeGenres([
      "Action",
      "Acción",
      "Fantasy",
      "Fantasia",
      "Manhwa",
      "Webtoon",
      "romance",
    ]);
    expect(r.generos).toEqual(["Acción", "Fantasía", "Romance"]);
    expect(
      normalizeGenres([
        "Tags: Action",
        "Aventuras",
        "Harén",
        "Content Rating: Suggestive",
        "En emisión",
      ]).generos,
    ).toEqual(["Acción", "Aventura", "Harem"]);
    expect(r.formatos).toEqual(["manhwa", "manhwa"]);
  });

  it("detects the type from category names, including the 'manwha' typo", () => {
    expect(detectTipo(["MANWHAS AL DIA 👌"], [])).toBe("manhwa");
    expect(detectTipo(["MANHUAS AL DIA 👌👍🆗"], [])).toBe("manhua");
    expect(detectTipo(["LEYENDO ▶️📖📚📈"], ["manhua"])).toBe("manhua");
    expect(detectTipo(["MANGAS AL DIA 🕛⭕"], [])).toBe("manga");
  });

  it("skips backup entries outside the library and merges duplicates keeping the most progress", () => {
    const a = analyzeBackup([
      entry({ fuente: "A", ultimoLeido: 5 }),
      entry({ titulo: "solo leveling ", fuente: "B", ultimoLeido: 20, categorias: ["LEYENDO"] }),
      entry({ fuente: "C", ultimoLeido: 99, favorito: false }),
    ]);
    expect(a.excluidas).toBe(1);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0]).toMatchObject({
      ultimo_cap_leido: 20,
      fuente: "B",
      fuentes: ["B", "A"],
      tipo: "manhwa",
    });
    expect(a.rows[0]!.categorias).toEqual(["LEYENDO", "MANWHAS AL DIA 👌"]);
    expect(a.fusiones).toHaveLength(1);
    expect(a.titulosLimpiados).toBe(1);
  });

  it("reads the Excel export and its '(sin categoría)' placeholder", () => {
    const a = analyzeExcel([
      {
        Título: "Hectopascal",
        Categoría: "(sin categoría)",
        Fuente: null,
        "Último cap. leído (nº)": 3,
      },
      {
        Título: "hectopascal",
        Categoría: "FINALIZADOS 😎",
        Fuente: "Olympus",
        "Último cap. leído (nº)": 9,
      },
      { Título: null },
    ]);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0]).toMatchObject({
      titulo: "hectopascal",
      fuente: "Olympus",
      categorias: ["FINALIZADOS 😎"],
    });
  });

  it("turns an anime name list into watched anime", () => {
    const a = analyzeAnimeNames(["Accel world", " Ajin ", "accel World"]);
    expect(a.rows.map((r) => r.titulo)).toEqual(["Accel world", "Ajin"]);
    expect(a.rows.every((r) => r.tipo === "anime" && r.estado === "Visto")).toBe(true);
  });
});
