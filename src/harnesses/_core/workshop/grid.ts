// src/harnesses/_core/workshop/grid.ts
/**
 * 팔레트 키 격자. 모델에게 pxg 를 쓰게 하지 않는다 — 답은 {"legend":{"a":"wood:6"},"rows":["..aa.."]} 하나다.
 * 「.」은 투명. 색은 팔레트 키만 쓰므로 팔레트 밖 색은 해석 단계에서 걸러진다.
 */
import type { Grid, Palette, PaletteEntry, ParsedDraw, Rgba, RgbaImage } from "./types";

export const TRANSPARENT = ".";
const CHAR_POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$%^&*+=?<>~";

export function colorId([r, g, b, a]: Rgba): string {
  return `${r},${g},${b},${a}`;
}

export function hexOf([r, g, b]: Rgba): string {
  return "#" + [r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function makePalette(entries: readonly PaletteEntry[]): Palette {
  const byKey = new Map<string, PaletteEntry>();
  const byColor = new Map<string, PaletteEntry>();
  for (const entry of entries) {
    if (byKey.has(entry.key)) throw new Error(`팔레트 키 중복: ${entry.key}`);
    byKey.set(entry.key, entry);
    if (!byColor.has(colorId(entry.rgba))) byColor.set(colorId(entry.rgba), entry);
  }
  return { entries, byKey, byColor };
}

export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON 객체가 없다");
  return JSON.parse(body.slice(start, end + 1));
}

const fail = (error: string): ParsedDraw => ({ ok: false, error });

export function parseDrawAnswer(text: string, palette: Palette): ParsedDraw {
  let raw: unknown;
  try {
    raw = extractJsonObject(text);
  } catch (error) {
    return fail(`답을 JSON 으로 읽지 못했다: ${(error as Error).message}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("답이 JSON 객체가 아니다");
  const { legend, rows, note, topRows } = raw as Record<string, unknown>;
  if (!legend || typeof legend !== "object" || Array.isArray(legend)) return fail("legend 가 객체가 아니다");
  if (!Array.isArray(rows) || rows.length === 0 || rows.some((row) => typeof row !== "string")) return fail("rows 가 글자열 배열이 아니다");
  const keys = new Map<string, string>();
  for (const [char, key] of Object.entries(legend as Record<string, unknown>)) {
    if ([...char].length !== 1) return fail(`legend 의 글자 「${char}」는 한 글자가 아니다`);
    if (char === TRANSPARENT) return fail("「.」은 투명 칸이라 legend 에 쓸 수 없다");
    if (typeof key !== "string" || !palette.byKey.has(key)) return fail(`legend 「${char}」의 색 ${String(key)} 은 팔레트에 없다`);
    keys.set(char, key);
  }
  const lines = rows as string[];
  const width = [...lines[0]].length;
  if (width === 0) return fail("rows[0] 이 비었다");
  const cells: (string | null)[] = [];
  for (let y = 0; y < lines.length; y++) {
    const chars = [...lines[y]];
    if (chars.length !== width) return fail(`rows[${y}] 길이 ${chars.length} ≠ 첫 줄 ${width}`);
    for (let x = 0; x < width; x++) {
      const char = chars[x];
      if (char === TRANSPARENT) {
        cells.push(null);
        continue;
      }
      const key = keys.get(char);
      if (!key) return fail(`rows[${y}][${x}] 글자 「${char}」가 legend 에 없다`);
      cells.push(key);
    }
  }
  return {
    ok: true,
    grid: { width, height: lines.length, cells },
    note: typeof note === "string" ? note : "",
    topRows: typeof topRows === "number" && Number.isInteger(topRows) ? topRows : null,
  };
}

/** 격자 → 모델에게 보여 줄 같은 형식(지금 그림·지난 시도). */
export function gridToAnswer(grid: Grid): { legend: Record<string, string>; rows: string[] } {
  const charOf = new Map<string, string>();
  const legend: Record<string, string> = {};
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      const key = grid.cells[y * grid.width + x];
      if (key === null) {
        row += TRANSPARENT;
        continue;
      }
      let char = charOf.get(key);
      if (!char) {
        char = CHAR_POOL[charOf.size];
        if (!char) throw new Error(`격자 색이 ${CHAR_POOL.length}개를 넘는다`);
        charOf.set(key, char);
        legend[char] = key;
      }
      row += char;
    }
    rows.push(row);
  }
  return { legend, rows };
}

export function renderGrid(grid: Grid, palette: Palette): RgbaImage {
  const data = new Uint8ClampedArray(grid.width * grid.height * 4);
  grid.cells.forEach((key, index) => {
    if (key === null) return;
    const entry = palette.byKey.get(key);
    if (entry) data.set(entry.rgba, index * 4);
  });
  return { width: grid.width, height: grid.height, data };
}

export function scaleImage(image: RgbaImage, factor: number): RgbaImage {
  const width = image.width * factor;
  const height = image.height * factor;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((Math.floor(y / factor) * image.width) + Math.floor(x / factor)) * 4;
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** 불투명 배경 위에 얹는다(검수자가 투명을 검게 보지 않게). */
export function onBackground(image: RgbaImage, background: Rgba): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = image.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(image.data[i + c] * alpha + background[c] * (1 - alpha));
    data[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data };
}

export function imageToGrid(image: RgbaImage, palette: Palette): { grid: Grid; unknown: string[] } {
  const cells: (string | null)[] = [];
  const unknown = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) {
    const rgba: Rgba = [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
    if (rgba[3] === 0) {
      cells.push(null);
      continue;
    }
    const entry = palette.byColor.get(colorId(rgba));
    if (!entry) unknown.add(hexOf(rgba));
    cells.push(entry ? entry.key : null);
  }
  return { grid: { width: image.width, height: image.height, cells }, unknown: [...unknown] };
}

export function collectOpaqueColors(image: RgbaImage): Rgba[] {
  const seen = new Map<string, Rgba>();
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] === 0) continue;
    const rgba: Rgba = [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
    if (!seen.has(colorId(rgba))) seen.set(colorId(rgba), rgba);
  }
  return [...seen.values()];
}

/** 칠한 화소의 경계(포함). 비었으면 null. */
export function opaqueBounds(image: RgbaImage): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
