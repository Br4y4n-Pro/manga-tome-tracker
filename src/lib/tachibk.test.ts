import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { parseTachibk } from "./tachibk";

// Minimal protobuf encoder for building backups in tests.
const varint = (n: bigint | number) => {
  let v = BigInt(n);
  const out: number[] = [];
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return out;
};
const int = (f: number, v: bigint | number) => [...varint(f << 3), ...varint(v)];
const bytes = (f: number, b: number[]) => [...varint((f << 3) | 2), ...varint(b.length), ...b];
const str = (f: number, s: string) => bytes(f, [...new TextEncoder().encode(s)]);
const float = (f: number, v: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  return [...varint((f << 3) | 5), ...b];
};

const chapter = (num: number, read: boolean, order: number) =>
  bytes(16, [
    ...str(2, `Cap ${num}`),
    ...int(4, read ? 1 : 0),
    ...float(9, num),
    ...int(10, order),
  ]);

const SOURCE_ID = 1598762687295904337n; // larger than Number.MAX_SAFE_INTEGER

function backup() {
  const manga = [
    ...int(1, SOURCE_ID),
    ...str(3, "Dekisokonai"),
    ...str(5, "Autor"),
    ...str(6, "Sinopsis en español"),
    ...str(7, "Action"),
    ...int(8, 6),
    ...int(13, 1677552456101),
    ...chapter(1, true, 2),
    ...chapter(2, true, 1),
    ...chapter(3, false, 0),
    ...int(17, 2),
    ...bytes(18, [...int(1, 2), ...float(6, 31), ...int(100, 145383)]),
    ...bytes(104, [...str(1, "/cap-2/"), ...int(2, 1782051379508)]),
  ];
  const removed = [...int(1, SOURCE_ID), ...str(3, "Viejo"), ...int(100, 0)];
  return new Uint8Array([
    ...bytes(1, manga),
    ...bytes(1, removed),
    ...bytes(2, [...str(1, "MANGAS AL DIA"), ...int(2, 2)]),
    ...bytes(101, [...str(1, "BokugenTranslation"), ...int(2, SOURCE_ID)]),
  ]);
}

describe("parseTachibk", () => {
  it("reads library entries from a gzipped backup", async () => {
    const gz = gzipSync(backup());
    const [m, old] = await parseTachibk(
      gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
    );
    expect(m).toMatchObject({
      titulo: "Dekisokonai",
      fuente: "BokugenTranslation",
      estado: "En hiatus",
      categorias: ["MANGAS AL DIA"],
      autor: "Autor",
      generos: ["Action"],
      favorito: true,
      ultimoLeido: 2,
      ultimoLeidoNombre: "Cap 2",
      capsLeidos: 2,
      capsTotales: 3,
      ultimoDisponible: 3,
      ultimoTracker: 31,
      anilistId: 145383,
      fechaAgregado: "2023-02-28T02:47:36.101Z",
      ultimaLectura: "2026-06-21T14:16:19.508Z",
    });
    expect(old).toMatchObject({ titulo: "Viejo", favorito: false });
  });

  it("rejects truncated data", async () => {
    const b = backup().slice(0, 30);
    await expect(parseTachibk(b.buffer)).rejects.toThrow(/dañado/);
  });
});
