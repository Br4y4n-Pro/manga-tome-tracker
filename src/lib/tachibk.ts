// Reader for Tachiyomi/Mihon/Komikku backups (.tachibk): gzip-compressed protobuf.
// Only the fields the app uses are decoded; field numbers follow Mihon's Backup*.kt models.

/** Mihon's SManga status codes. */
export const ESTADOS_BACKUP: Record<number, string> = {
  0: "Desconocido",
  1: "En emisión",
  2: "Finalizado",
  3: "Licenciado",
  4: "Publicación terminada",
  5: "Cancelado",
  6: "En hiatus",
};

const TRACKER_MAL = 1;
const TRACKER_ANILIST = 2;

export interface BackupEntry {
  titulo: string;
  fuente: string;
  estado: string;
  categorias: string[];
  autor: string | null;
  artista: string | null;
  sinopsis: string | null;
  generos: string[];
  portada: string | null;
  /** false = not in the library (migrated, removed or only opened once). */
  favorito: boolean;
  fechaAgregado: string | null;
  ultimaLectura: string | null;
  ultimoLeido: number | null;
  ultimoLeidoNombre: string | null;
  capsLeidos: number;
  capsTotales: number;
  ultimoDisponible: number | null;
  ultimoTracker: number | null;
  anilistId: number | null;
  malId: number | null;
}

type Field = { n: number; wire: number; int: bigint; bytes: Uint8Array };

function readVarint(b: Uint8Array, i: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  for (;;) {
    if (i >= b.length) throw new Error("Respaldo dañado: varint incompleto");
    const c = b[i++]!;
    result |= BigInt(c & 0x7f) << shift;
    if (!(c & 0x80)) return [result, i];
    shift += 7n;
  }
}

function readFields(b: Uint8Array): Field[] {
  const out: Field[] = [];
  let i = 0;
  while (i < b.length) {
    const [key, next] = readVarint(b, i);
    i = next;
    const n = Number(key >> 3n);
    const wire = Number(key & 7n);
    let int = 0n;
    let bytes: Uint8Array = new Uint8Array();
    const take = (start: number, len: number) => {
      if (start + len > b.length) throw new Error("Respaldo dañado: el archivo está incompleto");
      bytes = b.subarray(start, start + len);
      i = start + len;
    };
    if (wire === 0) [int, i] = readVarint(b, i);
    else if (wire === 1) take(i, 8);
    else if (wire === 2) {
      const [len, start] = readVarint(b, i);
      take(start, Number(len));
    } else if (wire === 5) take(i, 4);
    else throw new Error(`Respaldo dañado: tipo de campo ${wire} no soportado`);
    out.push({ n, wire, int, bytes });
  }
  return out;
}

const utf8 = new TextDecoder();
const text = (f: Field | undefined) => (f ? utf8.decode(f.bytes) : "");
const float32 = (f: Field) =>
  new DataView(f.bytes.buffer, f.bytes.byteOffset, 4).getFloat32(0, true);
const first = (fs: Field[], n: number) => fs.find((f) => f.n === n);
const all = (fs: Field[], n: number) => fs.filter((f) => f.n === n);
const round2 = (n: number) => Math.round(n * 100) / 100;
const isoFromMs = (f: Field | undefined) =>
  f && f.int > 0n ? new Date(Number(f.int)).toISOString() : null;

/** Repeated int64 fields may come packed (wire 2) or one per entry (wire 0). */
function ints(fs: Field[], n: number): bigint[] {
  return all(fs, n).flatMap((f) => {
    if (f.wire === 0) return [f.int];
    const out: bigint[] = [];
    for (let i = 0; i < f.bytes.length;) {
      const [v, next] = readVarint(f.bytes, i);
      out.push(v);
      i = next;
    }
    return out;
  });
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(bytes as BlobPart).body!.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function parseTachibk(buf: ArrayBuffer): Promise<BackupEntry[]> {
  let raw: Uint8Array = new Uint8Array(buf);
  if (raw[0] === 0x1f && raw[1] === 0x8b) raw = await gunzip(raw);
  const top = readFields(raw);

  // Mangas reference categories by their "order" value.
  const categorias = new Map<bigint, string>();
  for (const f of all(top, 2)) {
    const c = readFields(f.bytes);
    categorias.set(first(c, 2)?.int ?? 0n, text(first(c, 1)).trim());
  }
  const fuentes = new Map<bigint, string>();
  for (const f of all(top, 101)) {
    const s = readFields(f.bytes);
    fuentes.set(first(s, 2)?.int ?? 0n, text(first(s, 1)).trim());
  }

  return all(top, 1).map((f) => parseManga(readFields(f.bytes), categorias, fuentes));
}

function parseManga(
  m: Field[],
  categorias: Map<bigint, string>,
  fuentes: Map<bigint, string>,
): BackupEntry {
  const caps = all(m, 16).map((f) => {
    const c = readFields(f.bytes);
    const num = first(c, 9);
    return {
      nombre: text(first(c, 2)),
      leido: (first(c, 4)?.int ?? 0n) !== 0n,
      num: num ? round2(float32(num)) : -1,
      orden: Number(first(c, 10)?.int ?? 0n),
    };
  });
  const leidos = caps.filter((c) => c.leido);
  const numerados = leidos.filter((c) => c.num >= 0);
  const ultimo = numerados.length
    ? numerados.reduce((a, b) => (b.num > a.num ? b : a))
    : leidos.length
      ? leidos.reduce((a, b) => (b.orden < a.orden ? b : a)) // newest has the lowest source order
      : null;
  const disponibles = caps.filter((c) => c.num >= 0).map((c) => c.num);

  let anilistId: number | null = null;
  let malId: number | null = null;
  const trackerCaps: number[] = [];
  for (const f of all(m, 18)) {
    const t = readFields(f.bytes);
    const sync = Number(first(t, 1)?.int ?? 0n);
    const mediaId = Number(first(t, 100)?.int ?? first(t, 3)?.int ?? 0n) || null;
    if (sync === TRACKER_ANILIST) anilistId = mediaId;
    if (sync === TRACKER_MAL) malId = mediaId;
    const last = first(t, 6);
    if (last) trackerCaps.push(round2(float32(last)));
  }

  const historial = all(m, 104).map((f) => first(readFields(f.bytes), 2)?.int ?? 0n);
  const ultimaLecturaMs = historial.reduce((a, b) => (b > a ? b : a), 0n);
  const fuenteId = first(m, 1)?.int ?? 0n;
  const favorito = first(m, 100);

  return {
    titulo: text(first(m, 3)),
    fuente: fuentes.get(fuenteId) ?? (fuenteId === 0n ? "Local" : ""),
    estado: ESTADOS_BACKUP[Number(first(m, 8)?.int ?? 0n)] ?? "Desconocido",
    categorias: ints(m, 17)
      .map((c) => categorias.get(c))
      .filter((c): c is string => !!c),
    autor: text(first(m, 5)) || null,
    artista: text(first(m, 4)) || null,
    sinopsis: text(first(m, 6)) || null,
    generos: all(m, 7).map((g) => utf8.decode(g.bytes)),
    portada: text(first(m, 9)) || null,
    favorito: favorito ? favorito.int !== 0n : true, // proto default is true
    fechaAgregado: isoFromMs(first(m, 13)),
    ultimaLectura: ultimaLecturaMs > 0n ? new Date(Number(ultimaLecturaMs)).toISOString() : null,
    ultimoLeido: ultimo && ultimo.num >= 0 ? ultimo.num : null,
    ultimoLeidoNombre: ultimo?.nombre ?? null,
    capsLeidos: leidos.length,
    capsTotales: caps.length,
    ultimoDisponible: disponibles.length ? Math.max(...disponibles) : null,
    ultimoTracker: trackerCaps.filter(Boolean).length ? Math.max(...trackerCaps) : null,
    anilistId,
    malId,
  };
}
