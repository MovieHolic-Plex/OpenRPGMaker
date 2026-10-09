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

/**
 * 모델이 줄을 고치다 JSON 안에 코드 꼴을 남길 때가 있다 — `"…".replace("а","a")`, `"…"[0:16]`, `"…"[0:16] if False else "…"`
 * (2026-10-07 실측, 고치기 호출의 1/3). 줄을 지우려고 `[0:0]` 을 쓰기도 해서, 빈 글자열 줄은 parseDrawAnswer 가 뺀다.
 * JSON.parse 가 실패했을 때만 이 두 꼴을 값으로 풀어 다시 읽는다. 그 밖의 깨짐은 그대로 고치기 요청으로 간다.
 */
const JSON_STRING = /"(?:[^"\\]|\\.)*"/y;
const STRING_SUFFIX = /^(?:\.replace(?:All)?\(\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")\s*\)|\[\s*(-?\d*)\s*:\s*(-?\d*)\s*\])/;
/** `"A" if False else "B"` — 파이썬 꼴 조건식. 참이면 A, 거짓이면 B. */
const STRING_CONDITION = /^\s+if\s+(True|False)\s+else\s+("(?:[^"\\]|\\.)*")/;
export function repairStringExpressions(json: string): string {
  let out = "";
  let i = 0;
  while (i < json.length) {
    if (json[i] !== '"') { out += json[i]; i += 1; continue; }
    JSON_STRING.lastIndex = i;
    const match = JSON_STRING.exec(json);
    if (!match) return out + json.slice(i);
    let value = JSON.parse(match[0]) as string;
    i += match[0].length;
    for (let rest = STRING_SUFFIX.exec(json.slice(i)); rest; rest = STRING_SUFFIX.exec(json.slice(i))) {
      if (rest[1] !== undefined) value = value.split(JSON.parse(rest[1]) as string).join(JSON.parse(rest[2]!) as string);
      else {
        const chars = [...value];
        value = chars.slice(rest[3] ? Number(rest[3]) : 0, rest[4] ? Number(rest[4]) : chars.length).join("");
      }
      i += rest[0].length;
    }
    const condition = STRING_CONDITION.exec(json.slice(i));
    if (condition) {
      if (condition[1] === "False") value = JSON.parse(condition[2]!) as string;
      i += condition[0].length;
    }
    out += JSON.stringify(value);
  }
  return out;
}

/**
 * 폭이 틀린 줄만 고쳐 받기(2026-10-07): 모델이 16칸 줄을 17칸으로 세는 일이 잦다. 격자 전체를 다시 받으면 호출 하나가 수십 초라,
 * 줄 수가 맞고 틀린 줄이 몇 개뿐이면 그 줄만 다시 받는다. 답을 읽을 수 없으면 null.
 */
export function rowsNeedingFix(text: string, width: number, height: number): { rows: string[]; bad: number[] } | null {
  let raw: unknown;
  try { raw = extractJsonObject(text); } catch {
    try { raw = extractJsonObject(repairStringExpressions(text)); } catch { return null; }
  }
  const rows = (raw as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows) || rows.some((row) => typeof row !== "string")) return null;
  const lines = (rows as string[]).filter((row) => row.length > 0);
  if (lines.length !== height) return null;
  return { rows: lines, bad: lines.flatMap((row, index) => ([...row].length === width ? [] : [index])) };
}

/** 원래 답에 고친 줄({"rows":{"7":"…"}})을 덮어 쓴 전체 답(JSON 글). 고친 줄을 읽을 수 없으면 null. */
export function applyRowFix(text: string, fixText: string): string | null {
  let raw: Record<string, unknown>;
  let fix: unknown;
  try { raw = extractJsonObject(text) as Record<string, unknown>; } catch {
    try { raw = extractJsonObject(repairStringExpressions(text)) as Record<string, unknown>; } catch { return null; }
  }
  try { fix = extractJsonObject(fixText); } catch {
    try { fix = extractJsonObject(repairStringExpressions(fixText)); } catch { return null; }
  }
  const patch = (fix as { rows?: unknown } | null)?.rows;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
  const rows = ((raw.rows as string[]) ?? []).filter((row) => row.length > 0);
  for (const [index, row] of Object.entries(patch as Record<string, unknown>)) {
    const at = Number(index);
    if (!Number.isInteger(at) || at < 0 || at >= rows.length || typeof row !== "string") return null;
    rows[at] = row;
  }
  return JSON.stringify({ ...raw, rows });
}

/** 키릴·그리스 글자 중 라틴 글자와 똑같이 생긴 것. 모델이 legend 의 「o」 대신 키릴 「о」를 쓰는 일이 있다(2026-10-07 실측). */
const LOOKALIKE: Readonly<Record<string, string>> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j", "ѕ": "s",
  "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y",
  "ο": "o", "α": "a", "ν": "v", "Ο": "O", "Α": "A", "Β": "B", "Ε": "E", "Κ": "K", "Μ": "M", "Ν": "N", "Ρ": "P", "Τ": "T", "Χ": "X",
};

export function parseDrawAnswer(text: string, palette: Palette): ParsedDraw {
  let raw: unknown;
  try {
    raw = extractJsonObject(text);
  } catch (error) {
    try {
      raw = extractJsonObject(repairStringExpressions(text));
    } catch {
      return fail(`답을 JSON 으로 읽지 못했다: ${(error as Error).message}`);
    }
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
  // 생김새가 같은 다른 문자(키릴 「о」 ↔ 라틴 「o」)는 legend 에 그 글자가 따로 없을 때만 같은 글자로 읽는다
  for (const [look, latin] of Object.entries(LOOKALIKE)) {
    if (!keys.has(look) && keys.has(latin)) keys.set(look, keys.get(latin)!);
    if (!keys.has(latin) && keys.has(look)) keys.set(latin, keys.get(look)!);
  }
  // 빈 글자열 줄은 모델이 줄을 지운 흔적이다(`"…"[0:0]`). 투명 줄은 「....」로 온다.
  const lines = (rows as string[]).filter((row) => row.length > 0);
  if (lines.length === 0) return fail("rows 가 비었다");
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
