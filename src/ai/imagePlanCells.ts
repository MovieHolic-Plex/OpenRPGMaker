// ai/imagePlanCells.ts
// 그림 도안을 칸 지도로 읽는다(2026-11-05 imageplan-follow). 가운데 점 몇 개(옛 imagePlanReadPrompt)로는 도안의 윤곽·단·물·고리가 사라졌다
// (imageplan-honest 10쌍 평균 39%). 긴 변 48칸 격자의 칸마다 글자 하나 + 랜드마크 목록을 받고, 다시 그린 칸 지도를 도안 위에 겹쳐
// 틀린 영역만 한 번 고쳐 읽는다. 이 파일은 순수 함수(글자표·지시문·파싱·고침 덧붙이기·빌더 인자 옮기기)만 둔다 — 호출은 editor/imagePlanMockup.ts.
import type { WidenSubject } from "./vagueWidenCatalog";

export const CELL_LONG_SIDE = 48;

/** 칸 글자: 공통 _ 바깥(허공·하늘·맵 밖) · ~ 물 · = 길·통로 · A-Z 랜드마크 발자국. 야외 0-3 땅 단 · | 폭포 · t 나무 · h 건물. 실내 . 바닥 · # 벽·바위. */
export const CELL_GLYPHS = "_~=0123|th.#";
const LANDMARK = /[A-Z]/u;
const ROW_OK = /^[_~=0123|th.#A-Z]+$/u;

export interface CellLandmark { readonly id: string; readonly kind: string; readonly label?: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface CellMap { readonly cols: number; readonly rows: number; readonly cells: readonly string[]; readonly landmarks: readonly CellLandmark[] }

export function cellGridSize(width: number, height: number): { readonly cols: number; readonly rows: number } {
  const clamp = (v: number) => Math.max(24, Math.min(CELL_LONG_SIDE, Math.round(v)));
  return width >= height ? { cols: CELL_LONG_SIDE, rows: clamp(CELL_LONG_SIDE * height / width) } : { cols: clamp(CELL_LONG_SIDE * width / height), rows: CELL_LONG_SIDE };
}

const indoor = (subject: WidenSubject) => subject === "dungeon" || subject === "castle" || subject === "house";

function glyphLegend(subject: WidenSubject): string {
  return indoor(subject)
    ? "_ 바깥 허공(방·통로 밖 검은 곳) · # 벽·바위·기둥 · . 걷는 바닥(방 안) · = 통로·복도 바닥 · ~ 물·해자·웅덩이 · A~Z 랜드마크가 차지한 칸(아래 목록의 id)"
    : "_ 맵 밖·허공·하늘(섬이면 섬 둘레 바깥) · 0 가장 낮은 땅 · 1 2 3 절벽·돌담으로 갈리는 높은 단(한 단 오를 때마다 +1) · ~ 강·호수·연못·바다 · | 폭포 · = 길·다리·광장 바닥 · t 숲·나무 무리 · h 집·건물 지붕 · A~Z 랜드마크가 차지한 칸(아래 목록의 id)";
}

const LANDMARK_KINDS = "giant_tree stone_ring shrine statue obelisk well plaza fountain bell_tower church rose_window throne altar library armory sawmill windmill waterfall_source pond market hanok gate tower bridge chest stairs other";

/** 칸 지도 읽기 지시문 — 칸마다 글자 하나, 위에서 아래 rows 줄. */
export function cellMapReadPrompt(subject: WidenSubject, cols: number, rows: number): string {
  return [
    `이 그림은 RPG 맵 도안 위에 노란 칸 격자(가로 ${cols}칸 0~${cols - 1}, 세로 ${rows}칸 0~${rows - 1}, 4칸마다 번호)를 그린 것이다. 도안을 칸 지도로 옮겨 JSON 하나만 답하라.`,
    `칸 글자: ${glyphLegend(subject)}.`,
    `{"cells":["${cols}글자 행", … 정확히 ${rows}줄](위에서 아래, 칸마다 그 칸을 가장 많이 덮은 것 한 글자),"landmarks":[{"id":"A","kind":"${LANDMARK_KINDS.split(" ").join("|")}","label":"그림 속 이름 한 줄","x":,"y":,"w":,"h":}](눈에 띄는 큰 물건·건물·장소마다 하나, 칸 번호로 왼쪽 위와 가로·세로 칸 수, cells 안의 같은 글자 칸과 맞춘다)}`,
    "윤곽(둥근 섬·고리 통로·대칭)과 높이 단·물길을 칸 단위로 그대로 옮긴다. 모양을 네모로 단순화하거나 자리를 가운데로 모으지 않는다.",
  ].join("\n");
}

/** 다시 그린 칸 지도를 도안 위에 겹친 그림을 보여 주고 틀린 영역만 고쳐 받는 지시문. */
export function cellMapFixPrompt(subject: WidenSubject, cols: number, rows: number): string {
  return [
    `첫 그림은 격자를 그린 도안, 둘째 그림은 읽은 칸 지도를 색으로 다시 그려 같은 도안 위에 반투명으로 겹친 것이다(격자 ${cols}×${rows}).`,
    `칸 글자: ${glyphLegend(subject)}.`,
    "겹친 색이 도안과 어긋난 영역(빠진 랜드마크·틀린 단·물길·윤곽·통로)을 최대 6곳 찾아, 그 영역만 고친 칸 글자로 다시 적어라. 맞는 곳은 적지 않는다.",
    `JSON 하나만: {"fixes":[{"x":왼쪽 칸,"y":위 칸,"rows":["그 영역 가로 길이만큼의 글자", …](영역 세로 줄 수만큼),"why":"한 줄"}],"landmarks":[빠졌던 랜드마크만 같은 형식 {"id","kind","label","x","y","w","h"}]}. 고칠 곳이 없으면 {"fixes":[]}.`,
  ].join("\n");
}

const int = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };

function readLandmarks(raw: unknown, cols: number, rows: number, taken: readonly string[] = []): CellLandmark[] {
  if (!Array.isArray(raw)) return [];
  const out: CellLandmark[] = [];
  const used = (id: string) => taken.includes(id) || out.some((l) => l.id === id);
  for (const item of raw.slice(0, 26)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const given = typeof o.id === "string" && LANDMARK.test(o.id.trim().slice(0, 1).toUpperCase()) ? o.id.trim().slice(0, 1).toUpperCase() : null;
    // id 없이 온 랜드마크는 빈 글자를 준다("A" 로 두면 중복으로 버려졌다 — AMEND 5)
    const id = given ?? [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !used(c));
    const x = int(o.x), y = int(o.y);
    if (!id || x === null || y === null || (given !== null && used(id))) continue;
    const w = Math.max(1, int(o.w) ?? 1), h = Math.max(1, int(o.h) ?? 1);
    const cx = Math.max(0, Math.min(cols - 1, x)), cy = Math.max(0, Math.min(rows - 1, y));
    out.push({ id, kind: typeof o.kind === "string" && o.kind.trim() ? o.kind.trim().toLowerCase() : "other", ...(typeof o.label === "string" && o.label.trim() ? { label: o.label.trim().slice(0, 40) } : {}), x: cx, y: cy, w: Math.min(w, cols - cx), h: Math.min(h, rows - cy) });
  }
  return out;
}

function fitRow(raw: string, cols: number, fill: string): string {
  const clean = raw.replace(/[^_~=0123|th.#A-Z]/gu, fill);
  return clean.length >= cols ? clean.slice(0, cols) : clean + fill.repeat(cols - clean.length);
}

/** 비전 답 → 칸 지도. 줄 수·길이를 격자에 맞추고(모자라면 바깥 글자로 채움) 내용이 거의 없으면 null. */
export function parseCellMap(data: Record<string, unknown> | null, subject: WidenSubject, cols: number, rows: number): CellMap | null {
  if (!data || !Array.isArray(data.cells)) return null;
  const raw = data.cells.map((r) => String(r ?? ""));
  if (raw.length < Math.round(rows * 0.6)) return null;
  // 바깥(마을·숲)은 모자란 줄을 그 줄 끝 글자로, 빠진 줄은 윗줄로 메운다("_" 는 바다로 읽히므로 — AMEND 4). 실내·던전은 허공("_")으로.
  const outdoor = subject === "village" || subject === "forest";
  const cells: string[] = [];
  for (let y = 0; y < rows; y += 1) {
    const r = raw[y] ?? (outdoor && y > 0 ? cells[y - 1]! : "");
    cells.push(fitRow(r, cols, outdoor && r.length ? r[r.length - 1]!.replace(/[^_~=0123|th.#A-Z]/u, "0") : "_"));
  }
  const filled = cells.join("").replace(/_/gu, "").length;
  if (filled < cols * rows * 0.1) return null;
  const landmarks = readLandmarks(data.landmarks, cols, rows);
  return { cols, rows, cells, landmarks };
}

/** 고침(fixes)을 칸 지도에 덧붙인다 — 영역 밖 글자는 버리고 영역 안만 덮는다. 고친 영역 수를 함께 돌려준다. */
export function applyCellFixes(map: CellMap, data: Record<string, unknown> | null): { readonly map: CellMap; readonly fixed: number } {
  if (!data || !Array.isArray(data.fixes)) return { map, fixed: 0 };
  const grid = map.cells.map((r) => r.split(""));
  let fixed = 0;
  for (const item of data.fixes.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const x0 = int(o.x), y0 = int(o.y);
    if (x0 === null || y0 === null || !Array.isArray(o.rows)) continue;
    let touched = false;
    o.rows.forEach((row, dy) => {
      const y = y0 + dy;
      if (y < 0 || y >= map.rows) return;
      [...String(row ?? "")].forEach((ch, dx) => {
        const x = x0 + dx;
        if (x < 0 || x >= map.cols || !ROW_OK.test(ch)) return;
        grid[y]![x] = ch; touched = true;
      });
    });
    if (touched) fixed += 1;
  }
  const extra = readLandmarks(data.landmarks, map.cols, map.rows, map.landmarks.map((m) => m.id));
  return { map: { ...map, cells: grid.map((r) => r.join("")), landmarks: [...map.landmarks, ...extra] }, fixed };
}

/** 다시 그리기 색(겹쳐 보기) — 글자 → RGB. 랜드마크는 자홍. */
export function cellColor(ch: string): readonly [number, number, number] {
  switch (ch) {
    case "_": return [0, 0, 0];
    case "~": return [40, 110, 230];
    case "|": return [150, 220, 255];
    case "=": return [230, 190, 90];
    case "t": return [20, 110, 40];
    case "h": return [200, 60, 40];
    case ".": return [210, 210, 200];
    case "#": return [90, 80, 80];
    case "0": return [120, 200, 90];
    case "1": return [180, 200, 80];
    case "2": return [200, 160, 70];
    case "3": return [170, 120, 70];
    default: return LANDMARK.test(ch) ? [240, 40, 220] : [128, 128, 128];
  }
}

// ---------------------------------------------------------------- 칸 지도 → 빌더 인자

type Comp = { readonly cells: number[]; x0: number; y0: number; x1: number; y1: number };

function components(map: CellMap, member: (ch: string) => boolean): Comp[] {
  const { cols: W, rows: H } = map;
  const seen = new Uint8Array(W * H);
  const at = (x: number, y: number) => map.cells[y]![x]!;
  const out: Comp[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (seen[y * W + x] || !member(at(x, y))) continue;
    const c: Comp = { cells: [], x0: x, y0: y, x1: x, y1: y };
    const stack = [y * W + x]; seen[y * W + x] = 1;
    while (stack.length) {
      const i = stack.pop()!; const cx = i % W, cy = (i - cx) / W;
      c.cells.push(i); c.x0 = Math.min(c.x0, cx); c.y0 = Math.min(c.y0, cy); c.x1 = Math.max(c.x1, cx); c.y1 = Math.max(c.y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !member(at(nx, ny))) continue;
        seen[ny * W + nx] = 1; stack.push(ny * W + nx);
      }
    }
    out.push(c);
  }
  return out;
}

const BOSS_KINDS = /throne|altar|boss|shrine|statue|rose_window/u;
const TREASURE_KINDS = /chest|treasure|library|armory/u;

/** 도안 칸 → 맵 칸 배율. 자리와 크기를 같은 배율로 옮겨야 고리·대칭이 남는다(옛 읽기는 자리 ×2·크기 ×1.25 라 깨졌다). 맵 상한 80×70 안. */
export function dungeonCellScale(map: CellMap): number {
  return Math.max(1, Math.min(2, 78 / map.cols, 68 / map.rows));
}

/** 문·통로를 바닥(.)으로 그린 도안이 방 둘을 한 덩이로 잇는다(r1 p4 성: 종탑방과 서고가 43×16 한 방) — 가로나 세로 두께가 2칸 이하인 바닥 칸은 통로(=)로 본다. */
function withNecks(map: CellMap): CellMap {
  const { cols: W, rows: H } = map;
  const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && /[.~A-Z=]/u.test(map.cells[y]![x]!);
  const thick = (x: number, y: number, dx: number, dy: number) => { let n = 1; for (let s = 1; s <= 2 && floor(x + dx * s, y + dy * s); s += 1) n += 1; for (let s = 1; s <= 2 && floor(x - dx * s, y - dy * s); s += 1) n += 1; return n; };
  const cells = map.cells.map((row, y) => [...row].map((ch, x) => (ch === "." && (thick(x, y, 0, 1) <= 2 || thick(x, y, 1, 0) <= 2) ? "=" : ch)).join(""));
  return { ...map, cells };
}

/** 칸 지도 → author_dungeon rooms·links. 방 = 바닥(.·~·랜드마크) 덩이의 칸 상자, 자리·크기 모두 같은 배율(dungeonCellScale). 통로 = 덩이 사이 = 칸이 닿는 방끼리. */
export function dungeonPlanFromCells(map: CellMap, scale = dungeonCellScale(map)): { rooms: Array<{ id: string; kind: string; x: number; y: number; w: number; h: number }>; links: Array<{ from: string; to: string; rects: Array<{ x: number; y: number; w: number; h: number }> }>; landmarkSpots: Array<{ id: string; room: string; dx: number; dy: number; w: number; h: number }> } {
  map = withNecks(map);
  const roomish = (ch: string) => ch === "." || ch === "~" || LANDMARK.test(ch);
  // 빌더는 한 층 방 12개까지 — 더 있으면 작은 덩이부터 버린다(버린 덩이에 닿던 통로는 빌더가 잇는다).
  const comps = components(map, roomish).filter((c) => c.cells.length >= 6).sort((a, b) => b.cells.length - a.cells.length).slice(0, 12).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  if (!comps.length) return { rooms: [], links: [], landmarkSpots: [] };
  const W = map.cols;
  const roomOf = new Int16Array(map.cols * map.rows).fill(-1);
  comps.forEach((c, i) => { for (const k of c.cells) roomOf[k] = i; });
  // 입구: 맵 아래 가장자리에 가장 가까운 방(가로 가운데 쪽 우선)
  const entry = comps.map((c, i) => ({ i, score: c.y1 * 4 - Math.abs((c.x0 + c.x1) / 2 - W / 2) })).sort((a, b) => b.score - a.score)[0]!.i;
  const kindOf = (c: Comp, i: number): string => {
    if (i === entry) return "entrance";
    const marks = map.landmarks.filter((l) => l.x + l.w / 2 >= c.x0 && l.x + l.w / 2 <= c.x1 + 1 && l.y + l.h / 2 >= c.y0 && l.y + l.h / 2 <= c.y1 + 1);
    if (marks.some((l) => BOSS_KINDS.test(l.kind))) return "boss";
    if (marks.some((l) => TREASURE_KINDS.test(l.kind))) return "vault";
    return "hall";
  };
  const order = [entry, ...comps.map((_, i) => i).filter((i) => i !== entry)];
  const idOf = new Map<number, string>();
  const rooms = order.map((i, k) => {
    const c = comps[i]!; const id = `r${k + 1}`; idOf.set(i, id);
    const x = Math.round(c.x0 * scale), y = Math.round(c.y0 * scale);
    return { id, kind: kindOf(c, i), x, y, w: Math.round((c.x1 + 1) * scale) - x, h: Math.round((c.y1 + 1) * scale) - y };
  });
  const pairs = new Map<string, Comp[]>();
  const add = (a: number, b: number, corr: Comp) => { if (a === b || a < 0 || b < 0) return; const k = a < b ? `${a}|${b}` : `${b}|${a}`; pairs.set(k, [...(pairs.get(k) ?? []), corr]); };
  for (const corr of components(map, (ch) => ch === "=")) {
    const touch = new Set<number>();
    for (const k of corr.cells) {
      const x = k % W, y = (k - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.rows) continue;
        const r = roomOf[ny * W + nx]!; if (r >= 0) touch.add(r);
      }
    }
    const list = [...touch];
    for (let a = 0; a < list.length; a += 1) for (let b = a + 1; b < list.length; b += 1) add(list[a]!, list[b]!, corr);
  }
  const baseY = rooms.map((r) => r.y);
  // 벽 앞면 자리: 방 위로 4줄(벽 앞면 3 + 천장 1)이 비어야 빌더가 방 하나만 옆으로 밀지 않는다. 모자라면 그 방 줄부터 아래 전부를 같이 내려
  // (한 방만 옮기지 않는다) 고리·대칭·좌우 자리가 그대로 남는다. 바닥 세로는 빌더 최소 5줄.
  const GAP = 4;
  for (const r of rooms) r.h = Math.max(5, r.h);
  for (let guard = 0; guard < 40; guard += 1) {
    let worst: { y: number; need: number } | null = null;
    for (const r of rooms) for (const o of rooms) {
      if (o === r || o.x >= r.x + r.w + 1 || r.x >= o.x + o.w + 1 || o.y >= r.y) continue;
      const need = o.y + o.h + GAP - r.y;
      if (need > 0 && (!worst || r.y < worst.y)) worst = { y: r.y, need };
    }
    if (!worst) break;
    for (const r of rooms) if (r.y >= worst.y) r.y += worst.need;
  }
  // 통로는 도안의 = 칸 그대로(곧은·휘는 길) — 방과 같은 배율·같은 줄 내림으로 옮기고, 가로로 잇닿은 칸은 한 사각형으로 묶는다.
  // 통로 칸은 닿는 두 방 중 가까운 방의 내림 폭만큼 옮긴다(다른 열의 방 내림을 따라가면 방에서 떨어졌다 — ultrabrain AMEND 3).
  const roomIdx = new Map(order.map((i, k) => [i, k] as const));
  const rectsOf = (corrs: readonly Comp[], ka: number, kb: number): Array<{ x: number; y: number; w: number; h: number }> => {
    const ra = rooms[ka]!, rb = rooms[kb]!, da = ra.y - baseY[ka]!, db = rb.y - baseY[kb]!;
    const runs: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
    const cells = new Set(corrs.flatMap((c) => c.cells));
    for (let y = 0; y < map.rows; y += 1) for (let x = 0; x < W; x += 1) {
      if (!cells.has(y * W + x) || (x > 0 && cells.has(y * W + x - 1))) continue;
      let x1 = x; while (x1 + 1 < W && cells.has(y * W + x1 + 1)) x1 += 1;
      // 같은 열 폭으로 바로 위 줄에 이어진 토막은 한 사각형으로(세로 통로가 줄마다 조각나지 않게 — AMEND 2)
      const up = runs.find((r) => r.y1 === y - 1 && r.x0 === x && r.x1 === x1);
      if (up) up.y1 = y; else runs.push({ x0: x, x1, y0: y, y1: y });
    }
    return runs.map((r) => {
      const sy = Math.round(r.y0 * scale), ey = Math.round((r.y1 + 1) * scale);
      const mid = (sy + ey) / 2, near = Math.abs(mid - (baseY[ka]! + ra.h / 2)) <= Math.abs(mid - (baseY[kb]! + rb.h / 2)) ? da : db;
      const top = sy + Math.min(da, db), bottom = ey + Math.max(da, db);
      // 세로 토막은 두 방 내림 차이만큼 늘려 양쪽에 닿게, 가로 토막은 가까운 방 내림으로(두꺼워지지 않게)
      const vertical = r.y1 - r.y0 + 1 > r.x1 - r.x0 + 1;
      const span = da !== db && vertical ? { y: top, h: Math.max(1, bottom - top) } : { y: sy + near, h: Math.max(1, ey - sy) };
      const x = Math.round(r.x0 * scale);
      return { x, y: span.y, w: Math.max(1, Math.round((r.x1 + 1) * scale) - x), h: span.h };
    });
  };
  const links = [...pairs].map(([p, corrs]) => {
    const [ia, ib] = p.split("|").map(Number) as [number, number];
    return { from: idOf.get(ia)!, to: idOf.get(ib)!, rects: rectsOf(corrs, roomIdx.get(ia)!, roomIdx.get(ib)!) };
  });
  // 랜드마크 자리 = 방 id + 방 안 떨어진 칸(방은 배율·줄 내림·원점 이동을 거치므로 도안 칸 좌표는 맵에서 어긋난다 — AMEND 5)
  const landmarkSpots = map.landmarks.flatMap((l) => {
    const room = roomOf[Math.min(map.rows - 1, l.y + Math.floor(l.h / 2)) * W + Math.min(W - 1, l.x + Math.floor(l.w / 2))]!;
    if (room < 0) return [];
    const c = comps[room]!, r = rooms[roomIdx.get(room)!]!;
    return [{ id: l.id, room: r.id, dx: Math.max(0, Math.min(r.w - 1, Math.round((l.x - c.x0) * scale))), dy: Math.max(0, Math.min(r.h - 1, Math.round((l.y - c.y0) * scale))), w: Math.max(1, Math.round(l.w * scale)), h: Math.max(1, Math.round(l.h * scale)) }];
  });
  return { rooms, links, landmarkSpots };
}

/** 칸 지도 → author_beodeul_town 인자. 땅 단·물은 terrainMap 그대로, 집·숲·랜드마크는 덩이 가운데, 맵 크기는 도안 가로세로비. */
export function villageArgsFromCells(map: CellMap, longSide = 56): Record<string, unknown> {
  const width = map.cols >= map.rows ? longSide : Math.max(32, Math.round(longSide * map.cols / map.rows));
  const height = map.cols >= map.rows ? Math.max(32, Math.round(longSide * map.rows / map.cols)) : longSide;
  const sx = width / map.cols, sy = height / map.rows;
  const pt = (x: number, y: number) => ({ x: Math.round((x + 0.5) * sx - 0.5), y: Math.round((y + 0.5) * sy - 0.5) });
  const centre = (c: Comp) => pt((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
  // 땅 단 칸 지도: 길·나무·집·랜드마크·허공 칸은 그 줄에서 가장 가까운 단 글자로 메운다
  // "_"(허공)을 바다로 두는 건 허공이 맵 네 가장자리 중 3곳 이상에 닿을 때(떠 있는 섬)만 — 한두 줄이 비어 있다고 바다 띠가 생기지 않게(ultrabrain AMEND 4).
  const last = map.rows - 1, edgeVoid = [map.cells[0]!.includes("_"), map.cells[last]!.includes("_"), map.cells.some((r) => r[0] === "_"), map.cells.some((r) => r[r.length - 1] === "_")];
  const island = edgeVoid.filter(Boolean).length >= 3;
  const terrain = map.cells.map((row) => {
    const chars = row.split("");
    return chars.map((ch, x) => {
      if (/[0-3~|]/u.test(ch) || (ch === "_" && island)) return ch;
      for (let d = 1; d < chars.length; d += 1) {
        const l = chars[x - d], r = chars[x + d];
        if (l && /[0-3]/u.test(l)) return l;
        if (r && /[0-3]/u.test(r)) return r;
      }
      return "0";
    }).join("");
  });
  const layout: Record<string, unknown> = {};
  const houses = components(map, (ch) => ch === "h").filter((c) => c.cells.length >= 2).slice(0, 24)
    .map((c) => ({ ...centre(c), kind: c.cells.length >= 12 ? "large" : c.cells.length >= 5 ? "medium" : "small" }));
  if (houses.length) layout.houses = houses;
  const forests = components(map, (ch) => ch === "t").filter((c) => c.cells.length >= 6).sort((a, b) => b.cells.length - a.cells.length).slice(0, 8).map(centre);
  if (forests.length) layout.forests = forests;
  const marks = [...map.landmarks].sort((a, b) => b.w * b.h - a.w * a.h);
  const plaza = marks.find((l) => /plaza|well|fountain|market/u.test(l.kind));
  if (plaza) layout.gather = { ...pt(plaza.x + plaza.w / 2 - 0.5, plaza.y + plaza.h / 2 - 0.5), plaza: true };
  const big = marks.find((l) => l !== plaza);
  if (big) layout.landmark = pt(big.x + big.w / 2 - 0.5, big.y + big.h / 2 - 0.5);
  const work = marks.find((l) => /sawmill|windmill|mill|barn/u.test(l.kind));
  if (work) layout.work = pt(work.x + work.w / 2 - 0.5, work.y + work.h / 2 - 0.5);
  const exits: string[] = [];
  const edge = (cells: string) => cells.includes("=");
  if (edge(map.cells[map.rows - 1]!)) exits.push("south");
  if (edge(map.cells[0]!)) exits.push("north");
  if (edge(map.cells.map((r) => r[0]).join(""))) exits.push("west");
  if (edge(map.cells.map((r) => r[map.cols - 1]).join(""))) exits.push("east");
  if (exits.length) layout.exits = exits.slice(0, 2);
  const args: Record<string, unknown> = { width, height, terrainGen: "code", landform: "terraces", terrainMap: terrain, layout };
  if (houses.length >= 3 && houses.length <= 5) args.houseCount = houses.length;
  return args;
}

/** 도안 랜드마크 → 맵 칸 발자국(같은 배율). 짓기 뒤 랜드마크마다 맞는 조각을 찾아 찍고, 없으면 만들게 하는 목록. */
export function landmarkFootprints(map: CellMap, width: number, height: number): Array<{ id: string; kind: string; label: string; x: number; y: number; w: number; h: number }> {
  const sx = width / map.cols, sy = height / map.rows;
  return map.landmarks.map((l) => {
    const x = Math.round(l.x * sx), y = Math.round(l.y * sy);
    return { id: l.id, kind: l.kind, label: l.label ?? l.kind, x, y, w: Math.max(1, Math.round((l.x + l.w) * sx) - x), h: Math.max(1, Math.round((l.y + l.h) * sy) - y) };
  });
}

/** 칸 지도 → author_forest_route designs[0](본길 = 길 글자 칸의 아래·위 끝, 갈림·빈터는 길 덩이·나무 없는 땅). */
export function forestDesignFromCells(map: CellMap): Record<string, unknown> {
  // 랜드마크·다리 칸이 길을 끊으면 본길이 두 토막이 됐다(r1 p3: 석상 B 가 길 한가운데) — 길과 랜드마크를 한 덩이로 본다.
  const path = components(map, (ch) => ch === "=" || LANDMARK.test(ch)).filter((c) => c.cells.some((k) => map.cells[Math.floor(k / map.cols)]![k % map.cols] === "=")).sort((a, b) => b.y1 - b.y0 - (a.y1 - a.y0) || b.cells.length - a.cells.length)[0];
  const design: Record<string, unknown> = {};
  if (path) {
    const W = map.cols;
    const xsAt = (y: number) => path.cells.filter((k) => Math.floor(k / W) === y).map((k) => k % W);
    const bottom = xsAt(path.y1), top = xsAt(path.y0);
    if (bottom.length) design.entryAt = Math.round(100 * (bottom.reduce((a, b) => a + b, 0) / bottom.length) / (W - 1)) / 100;
    if (top.length) design.exitAt = Math.round(100 * (top.reduce((a, b) => a + b, 0) / top.length) / (W - 1)) / 100;
  }
  if (path) {
    // 본길 줄마다 가운데 x(아래→위). 방향이 바뀌는 곳 = 굽이, 줄 폭 = 길 폭, 줄 안 본길에서 떨어진 덩이 = 갈림길(도안 자리 → 진행 위치 0~1).
    const W = map.cols, span = Math.max(1, path.y1 - path.y0);
    const rowsXs: number[][] = [];
    for (let y = path.y1; y >= path.y0; y -= 1) rowsXs.push(path.cells.filter((k) => Math.floor(k / W) === y).map((k) => k % W).sort((a, b) => a - b));
    const mids = rowsXs.map((xs) => (xs.length ? (xs[0]! + xs[xs.length - 1]!) / 2 : NaN)).filter((v) => !Number.isNaN(v));
    let bends = 0, dir = 0;
    for (let i = 3; i < mids.length; i += 3) { const d = Math.sign(Math.round(mids[i]! - mids[i - 3]!)); if (d && d !== dir) { if (dir) bends += 1; dir = d; } }
    design.bends = Math.max(1, Math.min(6, bends + 1));
    const widths = rowsXs.map((xs) => { let run = 0, best = 0; xs.forEach((x, j) => { run = j && x === xs[j - 1]! + 1 ? run + 1 : 1; best = Math.max(best, run); }); return best; }).filter(Boolean).sort((a, b) => a - b);
    const w = widths[Math.floor(widths.length / 2)] ?? 2;
    design.width = w <= 1 ? "narrow" : w >= 4 ? "wide" : "normal";
    const branches: Array<Record<string, unknown>> = [];
    const onPath = new Set(path.cells);
    for (const other of components(map, (ch) => ch === "=")) {
      if (other.cells.some((k) => onPath.has(k)) || other.cells.length < 4 || branches.length >= 4) continue;
      const cy = (other.y0 + other.y1) / 2, cx = (other.x0 + other.x1) / 2;
      const at = Math.max(0, Math.min(1, Math.round(100 * (path.y1 - cy) / span) / 100));
      const near = mids[Math.max(0, Math.min(mids.length - 1, Math.round(at * (mids.length - 1))))] ?? W / 2;
      branches.push({ at, toward: cx < near ? "left" : "right", end: "clearing" });
    }
    // 본길에 붙은 갈림길: 한 줄에서 본길이 두 토막 이상으로 갈라지는 첫 줄(떨어진 덩이만 세면 본길에 닿는 갈림은 빠졌다 — AMEND 7)
    let wasSplit = false;
    rowsXs.forEach((xs, i) => {
      const runs: number[][] = [];
      xs.forEach((x, j) => { if (j && x === xs[j - 1]! + 1) runs[runs.length - 1]!.push(x); else runs.push([x]); });
      const split = runs.length >= 2 && runs.every((r) => r.length >= 1);
      if (split && !wasSplit && branches.length < 4 && i > 0 && i < rowsXs.length - 1) {
        const mid = mids[i] ?? W / 2, far = runs.reduce((a, b) => (Math.abs((b[0]! + b[b.length - 1]!) / 2 - mid) > Math.abs((a[0]! + a[a.length - 1]!) / 2 - mid) ? b : a));
        branches.push({ at: Math.round(100 * i / span) / 100, toward: (far[0]! + far[far.length - 1]!) / 2 < mid ? "left" : "right", end: "clearing" });
      }
      wasSplit = split;
    });
    if (branches.length) design.branches = branches;
    const clearings = map.landmarks.slice(0, 4).map((l) => {
      const at = Math.max(0, Math.min(1, Math.round(100 * (path.y1 - (l.y + l.h / 2)) / span) / 100));
      const near = mids[Math.max(0, Math.min(mids.length - 1, Math.round(at * (mids.length - 1))))] ?? W / 2;
      const lx = l.x + l.w / 2;
      return { at, size: l.w * l.h >= 12 ? "large" : l.w * l.h >= 4 ? "medium" : "small", toward: Math.abs(lx - near) < 3 ? "center" : lx < near ? "left" : "right" };
    });
    if (clearings.length) design.clearings = clearings;
  }
  return design;
}
