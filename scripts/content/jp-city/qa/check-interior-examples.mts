// 일본 실내 예제(tiledata/jp-city/interior/examples/places2.json 의 가게·공공·집 보강)를 **조수 도구 그대로**(build_hand_interior_room) 지어 본다.
// preview.py 「문제 0」은 근거가 아니다 — 도구 오류(탁상 4층·옆문 자리·한 줄 탁자)와 경고(닿지 못하는 바닥·쓸 수 없는 가구)는 이 검사로만 보인다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/check-interior-examples.mts [파일 이름 …]
// 출력: 예제마다 OK(경고 없음) · WARN(경고 전부) · FAIL(오류 전부). 종료 코드 = WARN+FAIL 수.
// 빈 바닥 수치(엔진 통행 판정): sq = 걸을 수 있는 칸만으로 된 가장 큰 정사각형 변(2 = 통로 폭, 4 이상 = 빈 마당),
//   e3 = 3×3 이 전부 걸음 칸인 창이 덮는 칸 수(빈 바닥 넓이), walk = 걸음 칸 수. 가게 목표 sq ≤ 2.
// w2·cut·hid = 통로 폭·가려진 1줄 통로(아래 주석). SAME = 같은 틀 반복(아래 ①②).
import { readFileSync } from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isPassable } from "@/project/collision";
const EX = "tiledata/jp-city/interior/examples";
const SPEC = JSON.parse(readFileSync("src/assets/jpInteriorSpec.json", "utf8")).objects as Record<string, { w?: number; up?: number; kind?: string }>;
const GRID = process.argv.includes("--grid");
const only = process.argv.slice(2).filter((a) => a !== "--grid");
const places = JSON.parse(readFileSync(`${EX}/places2.json`, "utf8")).filter((p: { file: string }) => !only.length || only.includes(p.file)) as { file: string; placeId: string; rules?: string[] }[];
let bad = 0;
const project = createEmptyToolProject("chk");
for (const p of places) {
  const ex = JSON.parse(readFileSync(`${EX}/${p.file}.json`, "utf8"));
  try {
    const r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "jp_city", mapId: `chk-${p.file}`, name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], ...(ex.exitWidth ? { exitWidth: ex.exitWidth } : {}), start: [{ x: ex.start[0], y: ex.start[1] }], links: [] });
    const w = [...(r.warnings ?? [])];
    if (w.length) bad++;
    const m = project.maps[`chk-${p.file}`]!;
    const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && isPassable(project, m, x, y);
    let walk = 0, sq = 0; const cover = new Set<number>();
    const dp: number[][] = Array.from({ length: m.height }, () => Array(m.width).fill(0));
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (!ok(x, y)) continue; walk++;
      dp[y]![x] = 1 + Math.min(y ? dp[y - 1]![x]! : 0, x ? dp[y]![x - 1]! : 0, x && y ? dp[y - 1]![x - 1]! : 0);
      sq = Math.max(sq, dp[y]![x]!);
      if (dp[y]![x]! >= 3) for (let yy = y - 2; yy <= y; yy++) for (let xx = x - 2; xx <= x; xx++) cover.add(yy * m.width + xx);
    }
    // w2 = 걸음 칸 중 2×2 걸음 덩이에 속한 칸 비율(낮을수록 1칸 통로가 많다).
    // cut = 그 칸 하나를 막으면 출입구에서 걸음 칸 4개 이상이 끊기는 1칸 병목(방문·노렌 틈은 원래 병목이다 — 목록으로 사람이 본다).
    let w2 = 0;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (ok(x, y) && [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => ok(x + dx!, y + dy!) && ok(x + dx! + 1, y + dy!) && ok(x + dx!, y + dy! + 1) && ok(x + dx! + 1, y + dy! + 1))) w2++;
    // hid = 1줄 통로(북쪽이 막힘, 가로 2칸 이상)인데 바로 남쪽 가구의 윗부분(up ≥ 16)이 덮어 바닥이 안 보이는 걸음 칸.
    const over = new Set<number>();
    for (const o of (ex.objects ?? []) as { id: string; x: number; y: number }[]) {
      const d = SPEC[o.id]; if (!d || (d.up ?? 0) < 16 || d.kind === "hang" || d.kind === "door" || d.kind === "sidedoor") continue;
      for (let dx = 0; dx < (d.w ?? 1); dx++) over.add((o.y - 1) * m.width + o.x + dx);
    }
    const hid: string[] = [];
    const hid1 = (x: number, y: number) => ok(x, y) && over.has(y * m.width + x) && !ok(x, y - 1);
    // 한 칸짜리(의자·화분 하나 뒤)는 통로가 아니다 — 가로로 2칸 이상 이어진 것만 센다.
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (hid1(x, y) && (hid1(x - 1, y) || hid1(x + 1, y))) hid.push(`${x},${y}`);
    const exitCell = (() => { for (let x = 0; x < m.width; x++) if (ok(x, m.height - 1)) return { x, y: m.height - 1 }; return null; })();
    const reach = (block: number) => { if (!exitCell) return 0; const s0 = exitCell.y * m.width + exitCell.x; if (s0 === block) return 0; const seen = new Set([s0]); const q = [s0];
      while (q.length) { const c = q.pop()!; const cx = c % m.width, cy = (c - cx) / m.width; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx!, ny = cy + dy!, n = ny * m.width + nx; if (n !== block && !seen.has(n) && ok(nx, ny)) { seen.add(n); q.push(n); } } }
      return seen.size; };
    const all = reach(-1); const cuts: string[] = [];
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (ok(x, y) && all - 1 - reach(y * m.width + x) >= 4) cuts.push(`${x},${y}`);
    if (GRID) { // . 걸음 · # 막힘 · x 병목(cut) · ^ 가려진 1줄(hid) · ~ 남쪽 가구 윗부분이 덮는 걸음 칸
      const cs = new Set(cuts), hs = new Set(hid);
      console.log("    " + Array.from({ length: m.width }, (_, x) => x % 10).join(""));
      for (let y = 0; y < m.height; y++) console.log(String(y).padStart(3) + " " + Array.from({ length: m.width }, (_, x) => !ok(x, y) ? "#" : hs.has(`${x},${y}`) ? "^" : cs.has(`${x},${y}`) ? "x" : over.has(y * m.width + x) ? "~" : ".").join(""));
    }
    // 정문 하나: 맨 아래 줄 걸음 칸 덩이가 정확히 1(link_jp_city_interior 가 그 덩이만 출구로 본다).
    let runs = 0; for (let x = 0; x < m.width; x++) if (ok(x, m.height - 1) && !ok(x - 1, m.height - 1)) runs++;
    if (runs !== 1) w.push(`맨 아래 줄 걸음 칸 덩이 ${runs}군데 — 출입구 틈은 한 군데여야 한다`);
    // 안내 문장의 장소 id 는 지금 placeId 와 같아야 한다(게시하면 조수가 그 id 로 부른다).
    for (const id of (p.rules ?? []).join(" ").match(/jp-city-[a-z0-9-]+-\d+x\d+/g) ?? []) if (id !== p.placeId) w.push(`rules 의 장소 id ${id} ≠ placeId ${p.placeId}`);
    if (w.length && !(r.warnings ?? []).length) bad++;
    console.log(w.length ? "WARN" : "OK  ", p.file.padEnd(13), `${m.width}x${m.height} walk ${walk} sq ${sq} e3 ${cover.size} (${Math.round(100 * cover.size / Math.max(1, walk))}%) w2 ${Math.round(100 * w2 / Math.max(1, walk))}% cut ${cuts.length ? cuts.join(" ") : "-"} hid ${hid.length ? hid.join(" ") : "-"}`, w.join("\n      "));
  } catch (e) { bad++; console.log("FAIL", p.file, String((e as Error).message)); }
}
// 같은 틀 반복 두 가지:
//   ① 크기가 같은 두 예제(같은 평면 틀)의 가구·탁자 자리(x,y) 겹침 / 적은 쪽 수 > 50% — 그림만 바꾼 평면.
//   ② 크기와 무관하게 같은 가구를 같은 자리에 둔 것(id,x,y) 겹침 / 적은 쪽 수 > 35% — 같은 뼈대(주방 줄·카운터·스툴 줄) 복사.
type Seat = { size: string; pos: Set<string>; trip: Set<string> };
const seats = new Map<string, Seat>();
for (const p of places) {
  const ex = JSON.parse(readFileSync(`${EX}/${p.file}.json`, "utf8"));
  const items = [...(ex.objects ?? []), ...(ex.tables ?? [])] as { id: string; x: number; y: number }[];
  seats.set(p.file, { size: `${ex.plan[0].length}x${ex.plan.length}`, pos: new Set(items.map((o) => `${o.x},${o.y}`)), trip: new Set(items.map((o) => `${o.id}@${o.x},${o.y}`)) });
}
const names = [...seats.keys()];
const overlap = (a: Set<string>, b: Set<string>) => { const s = [...a].filter((k) => b.has(k)).length, base = Math.min(a.size, b.size); return { s, base, r: base ? s / base : 0 }; };
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const A = seats.get(names[i]!)!, B = seats.get(names[j]!)!;
  const pos = overlap(A.pos, B.pos), trip = overlap(A.trip, B.trip);
  if (A.size === B.size && pos.r > 0.5) { bad++; console.log("SAME", `${names[i]} ↔ ${names[j]} (${A.size}): 가구 자리 ${pos.s}/${pos.base} 겹침 — 업종별로 계산대·진열·문 틈 자리를 바꾼다`); }
  else if (trip.r > 0.35) { bad++; console.log("SAME", `${names[i]} ↔ ${names[j]}: 같은 가구·같은 자리 ${trip.s}/${trip.base} — 업종별 뼈대(주방·카운터·좌석 자리)를 바꾼다`); }
}
process.exit(bad);
