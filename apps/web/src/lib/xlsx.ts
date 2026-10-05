import { strFromU8, unzipSync } from "fflate";

/**
 * Minimal .xlsx / .csv reader for importing a khata spreadsheet.
 * Reads cached cell values (formula results included), turns date-formatted
 * numbers into "yyyy-MM-dd", and needs no DOM so it can be unit-tested in Bun.
 */

export type Cell = string | number | boolean | null;
export type Sheet = { name: string; rows: Cell[][] };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decode(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#")
      return String.fromCodePoint(
        e[1] === "x" || e[1] === "X"
          ? Number.parseInt(e.slice(2), 16)
          : Number(e.slice(1)),
      );
    return ENTITIES[e] ?? m;
  });
}

const attr = (attrs: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

const texts = (xml: string) =>
  [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((m) => decode(m[1] ?? ""))
    .join("");

/** Excel serial day → yyyy-MM-dd (1900 date system). */
export function serialToDate(serial: number) {
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

function isDateFormat(code: string) {
  const plain = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
  return /[dy]/i.test(plain) || /m{3,}/i.test(plain);
}

const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57,
]);

function colIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readXlsx(data: Uint8Array): Sheet[] {
  const files = unzipSync(data);
  const read = (p: string) => {
    const f = files[p];
    return f ? strFromU8(f) : "";
  };

  const shared = [
    ...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((m) => texts(m[1] ?? ""));

  const styles = read("xl/styles.xml");
  const customFormats = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const id = Number(attr(m[1] ?? "", "numFmtId"));
    customFormats.set(id, decode(attr(m[1] ?? "", "formatCode") ?? ""));
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  const dateStyles = [...cellXfs.matchAll(/<xf\b([^>]*)/g)].map((m) => {
    const id = Number(attr(m[1] ?? "", "numFmtId") ?? 0);
    const custom = customFormats.get(id);
    return custom ? isDateFormat(custom) : BUILTIN_DATE_FORMATS.has(id);
  });

  const rels = new Map(
    [
      ...read("xl/_rels/workbook.xml.rels").matchAll(
        /<Relationship\b([^>]*)\/?>/g,
      ),
    ].map((m) => [attr(m[1] ?? "", "Id"), attr(m[1] ?? "", "Target") ?? ""]),
  );

  return [...read("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)].map(
    (m) => {
      const a = m[1] ?? "";
      const name = decode(attr(a, "name") ?? "Sheet");
      const target = rels.get(attr(a, "r:id")) ?? "";
      const path = target.startsWith("/")
        ? target.slice(1)
        : `xl/${target.replace(/^\.\//, "")}`;
      const xml = read(path);

      const rows: Cell[][] = [];
      for (const row of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
        const r = Number(attr(row[1] ?? "", "r")) - 1;
        const cells: Cell[] = [];
        for (const c of (row[2] ?? "").matchAll(
          /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
        )) {
          const ca = c[1] ?? "";
          const body = c[2] ?? "";
          const ref = attr(ca, "r");
          const idx = ref ? colIndex(ref) : cells.length;
          const type = attr(ca, "t");
          const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
          let v: Cell = null;
          if (type === "inlineStr") v = texts(body);
          else if (raw === undefined) v = null;
          else if (type === "s") v = shared[Number(raw)] ?? "";
          else if (type === "b") v = raw === "1";
          else if (type === "str" || type === "e") v = decode(raw);
          else {
            const n = Number(raw);
            v = dateStyles[Number(attr(ca, "s") ?? 0)] ? serialToDate(n) : n;
          }
          cells[idx] = v;
        }
        rows[Number.isFinite(r) ? r : rows.length] = Array.from(
          cells,
          (x) => x ?? null,
        );
      }
      return { name, rows: Array.from(rows, (x) => x ?? []) };
    },
  );
}

/** RFC 4180-ish CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => (c === "" ? null : c)));
}

export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv")
    return [
      {
        name: file.name.replace(/\.csv$/i, ""),
        rows: parseCsv(await file.text()),
      },
    ];
  return readXlsxBytes(new Uint8Array(await file.arrayBuffer()));
}

export function readXlsxBytes(data: Uint8Array) {
  try {
    return readXlsx(data);
  } catch {
    throw new Error(
      "Could not read this file. Save it as .xlsx or .csv and try again.",
    );
  }
}
