// 일본 실내 예제(tiledata/jp-city/interior/examples/places2.json 의 가게·공공·집 보강)를 **조수 도구 그대로**(build_hand_interior_room) 지어 본다.
// preview.py 「문제 0」은 근거가 아니다 — 도구 오류(탁상 4층·옆문 자리·한 줄 탁자)와 경고(닿지 못하는 바닥·쓸 수 없는 가구)는 이 검사로만 보인다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/check-interior-examples.mts [파일 이름 …]
// 출력: 예제마다 OK(경고 없음) · WARN(경고 전부) · FAIL(오류 전부). 종료 코드 = WARN+FAIL 수.
// 빈 바닥 수치(엔진 통행 판정): sq = 걸을 수 있는 칸만으로 된 가장 큰 정사각형 변(2 = 통로 폭, 4 이상 = 빈 마당),
//   e3 = 3×3 이 전부 걸음 칸인 창이 덮는 칸 수(빈 바닥 넓이), walk = 걸음 칸 수. 가게 목표 sq ≤ 2.
// w2·cut·hid = 통로 폭·가려진 1줄 통로(아래 주석). SAME = 같은 틀 반복(아래 ①②).
import { readFileSync, readdirSync } from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isPassable } from "@/project/collision";
const EX = "tiledata/jp-city/interior/examples";
const HOME_KINDS = new Set(["mansion", "mokuchin", "hiraya"]);
const SPEC = JSON.parse(readFileSync("src/assets/jpInteriorSpec.json", "utf8")).objects as Record<string, { w?: number; h?: number; up?: number; kind?: string }>;
const GRID = process.argv.includes("--grid");
// --places <파일> = 예제 표 하나만(작업자는 자기 표 places3-<블록>.json). 기본 = places2.json + places3*.json 전부.
// 한 장소가 여러 맵(maps: 1층·2층·옥상 …)이면 맵마다 따로 잰다.
const placesAt = process.argv.indexOf("--places");
const PLACES_FILES = placesAt > 0 ? [process.argv[placesAt + 1]!] : ["places2.json", ...readdirSync(EX).filter((f) => /^places[3-9].*\.json$/.test(f)).sort()].map((f) => `${EX}/${f}`);
const only = process.argv.slice(2).filter((a, i, all) => a !== "--grid" && a !== "--places" && all[i - 1] !== "--places");
type Place = { file: string; maps?: string[]; placeId: string; kind?: string; dungeon?: boolean; rules?: string[] };
const places = PLACES_FILES.flatMap((pf) => JSON.parse(readFileSync(pf, "utf8")) as Place[])
  .flatMap((p) => (p.maps ?? [p.file]).map((f) => ({ ...p, file: f })))
  .filter((p) => !only.length || only.includes(p.file));
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
    // inner:true = 거리 문과 잇지 않는 안쪽 맵(위층·옥상·전철 차내 — 계단·이동으로만 들어온다): 출구 검사를 빼고 도달은 start 칸에서 잰다.
    const inner = ex.inner === true;
    const exitCell = inner ? { x: ex.start[0] as number, y: ex.start[1] as number } : (() => { for (let x = 0; x < m.width; x++) if (ok(x, m.height - 1)) return { x, y: m.height - 1 }; return null; })();
    const reach = (block: number) => { if (!exitCell) return 0; const s0 = exitCell.y * m.width + exitCell.x; if (s0 === block) return 0; const seen = new Set([s0]); const q = [s0];
      while (q.length) { const c = q.pop()!; const cx = c % m.width, cy = (c - cx) / m.width; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx!, ny = cy + dy!, n = ny * m.width + nx; if (n !== block && !seen.has(n) && ok(nx, ny)) { seen.add(n); q.push(n); } } }
      return seen.size; };
    const all = reach(-1); const cuts: string[] = [];
    const in2 = (x: number, y: number) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => ok(x + dx!, y + dy!) && ok(x + dx! + 1, y + dy!) && ok(x + dx!, y + dy! + 1) && ok(x + dx! + 1, y + dy! + 1));
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (ok(x, y) && all - 1 - reach(y * m.width + x) >= 4) cuts.push(`${x},${y}`);
    // 막다른 1칸 통로: 칸 하나를 막으면 끊기는 쪽이 전부 1칸 폭(2×2 덩이 밖)이고 4칸 이상 — 규칙 ③(3칸까지). 직원 길이면 사람이 판단한다.
    // 문 칸: 문·옆문·노렌(걸이 문 포함) 조각의 칸과 그 아래 두 줄(벽면을 지나는 길).
    const doorCells: number[] = [];
    for (const o of (ex.objects ?? []) as { id: string; x: number; y: number }[]) {
      const d = SPEC[o.id]; if (!(d?.kind === "door" || d?.kind === "sidedoor" || /noren|door/.test(o.id))) continue;
      for (let dy = 0; dy <= 3; dy++) doorCells.push((o.y + dy) * m.width + o.x);
    }
    // 밝힌 좁은 곳: 예제 JSON narrow:[{x0,y0,x1,y1,why}] — 1칸이 맞는 곳(직원 길·카운터석 뒤·계산 레인·집 복도). 출력에 그대로 찍어 사람·관문이 판정한다.
    const staff = (ex.narrow ?? []) as { x0: number; y0: number; x1: number; y1: number; why: string }[];
    const inStaff = (x: number, y: number) => staff.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    const doorSet = new Set(doorCells);
    const nearDoor = (c: number) => { const cx = c % m.width, cy = Math.floor(c / m.width); return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => doorSet.has((cy + dy!) * m.width + cx + dx!)); };
    const deadEnds: string[] = [];
    // 1칸 목: 병목(cut)인데 2×2 덩이 밖 — 문 칸·문 옆·직원 구역·출구(맨 아래 줄과 그 바로 위)는 원래 병목이라 뺀다.
    const necks = cuts.filter((k) => { const [x, y] = k.split(",").map(Number) as [number, number];
      return !in2(x, y) && !nearDoor(y * m.width + x) && !inStaff(x, y) && (inner || y < m.height - 2) && !(inner && x === exitCell!.x && y === exitCell!.y); });
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (!ok(x, y) || in2(x, y) || inStaff(x, y)) continue;
      const block = y * m.width + x; const s0 = exitCell ? exitCell.y * m.width + exitCell.x : -1; if (s0 < 0 || s0 === block) continue;
      const seen = new Set([s0]); const q = [s0];
      while (q.length) { const c = q.pop()!; const cx = c % m.width, cy = (c - cx) / m.width; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx!, ny = cy + dy!, n = ny * m.width + nx; if (n !== block && !seen.has(n) && ok(nx, ny)) { seen.add(n); q.push(n); } } }
      const cut: number[] = []; for (let yy = 0; yy < m.height; yy++) for (let xx = 0; xx < m.width; xx++) if (ok(xx, yy) && yy * m.width + xx !== block && !seen.has(yy * m.width + xx)) cut.push(yy * m.width + xx);
      const cutSet = new Set(cut);
      if (nearDoor(block) || doorCells.some((c) => cutSet.has(c))) continue; // 문 너머 방(화장실·욕실·침실)은 작아도 된다
      if (cut.every((c) => inStaff(c % m.width, Math.floor(c / m.width)))) continue; // 예제가 밝힌 직원 구역
      if (cut.length >= 3 && cut.every((c) => !in2(c % m.width, Math.floor(c / m.width)))) deadEnds.push(`${x},${y}+${cut.length}`);
    }
    // 계산대 앞 2줄: 금전기·계산 레인·접수 칸의 손님 쪽 두 칸이 걸음 칸.
    const counterFront: string[] = [];
    for (const o of (ex.objects ?? []) as { id: string; x: number; y: number }[]) {
      if (!/register|checkout|reception/.test(o.id)) continue;
      const h = SPEC[o.id]?.h ?? 1;
      // 손님 쪽: 남쪽 첫 칸이 걸음 칸이면 남쪽이 손님 쪽(두 칸이어야 한다). 아니면 서·동·북 중 두 칸 비어 있는 쪽.
      const two = (dx: number, dy: number, base: { x: number; y: number }) => ok(base.x + dx, base.y + dy) && ok(base.x + 2 * dx, base.y + 2 * dy);
      const good = ok(o.x, o.y + h) ? two(0, 1, { x: o.x, y: o.y + h - 1 }) : (two(-1, 0, o) || two(1, 0, o) || two(0, -1, o) || two(-1, 0, { x: o.x, y: o.y + h - 1 }) || two(1, 0, { x: o.x, y: o.y + h - 1 }));
      if (!good) counterFront.push(`${o.id}@${o.x},${o.y}`);
    }
    if (GRID) { // . 걸음 · # 막힘 · x 병목(cut) · ^ 가려진 1줄(hid) · ~ 남쪽 가구 윗부분이 덮는 걸음 칸
      const cs = new Set(cuts), hs = new Set(hid);
      console.log("    " + Array.from({ length: m.width }, (_, x) => x % 10).join(""));
      for (let y = 0; y < m.height; y++) console.log(String(y).padStart(3) + " " + Array.from({ length: m.width }, (_, x) => !ok(x, y) ? "#" : hs.has(`${x},${y}`) ? "^" : cs.has(`${x},${y}`) ? "x" : over.has(y * m.width + x) ? "~" : ".").join(""));
    }
    if (hid.length) w.push(`가려진 1줄 통로 ${hid.join(" ")} — 남쪽 가구 윗부분이 덮는다`);
    // open = 일부러 트인 바닥(체육관 코트·콘코스·옥상) — 그 안의 3×3 빈 바닥은 경고하지 않는다. 그 밖은 집이 아니면 0 이어야 한다.
    const open = (ex.open ?? []) as { x0: number; y0: number; x1: number; y1: number; why: string }[];
    const e3loose = [...cover].filter((c) => { const x = c % m.width, y = (c - x) / m.width; return !open.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1); });
    // 던전(4묶음 — 지하철 터널·하수도·폐병원 …, 장소 표 dungeon:true): 통로 폭·막다른 길·빈 바닥·계산대 규칙을 빼고 길이(가장 먼 칸까지 걸음 수)·잠긴 문(locks)을 본다.
    const dungeon = p.dungeon === true;
    if (e3loose.length && !HOME_KINDS.has(p.kind ?? "") && !dungeon) w.push(`3×3 빈 바닥 ${e3loose.length}칸(예: ${e3loose.slice(0, 3).map((c) => `${c % m.width},${Math.floor(c / m.width)}`).join(" ")}) — 맵을 줄이거나 가구로 쓰임을 주거나, 원래 트인 곳이면 open 으로 밝힌다`);
    const openNote = open.length ? ` open ${open.map((r) => `${r.why}@${r.x0},${r.y0}-${r.x1},${r.y1}`).join("; ")}` : "";
    const narrowNoteExtra: string[] = [];
    const narrowNote = openNote + (staff.length ? ` narrow ${staff.map((r) => `${r.why}@${r.x0},${r.y0}-${r.x1},${r.y1}`).join("; ")}` : "");
    // 집(맨션·목조 아파트·옛집)은 규칙 「가게·공공 실내」 통로 폭 절 밖이다 — 작은 다다미방·복도의 1칸은 흔하다. 가려진 통로·계산대만 본다.
    const home = HOME_KINDS.has((p as { kind?: string }).kind ?? "");
    if (home || dungeon) { necks.length = 0; deadEnds.length = 0; }
    if (dungeon) {
      counterFront.length = 0;
      // far = 출발 칸에서 가장 먼 걸음 칸까지 걸음 수(던전은 길어야 한다 — 맵 둘레 반 이상 권장).
      if (exitCell) { const d0 = new Map([[exitCell.y * m.width + exitCell.x, 0]]); const q = [exitCell.y * m.width + exitCell.x]; let far = 0;
        while (q.length) { const c = q.shift()!; const cx = c % m.width, cy = (c - cx) / m.width; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx!, ny = cy + dy!, n = ny * m.width + nx; if (!d0.has(n) && ok(nx, ny)) { d0.set(n, d0.get(c)! + 1); far = Math.max(far, d0.get(n)!); q.push(n); } } }
        narrowNoteExtra.push(` far ${far}`); }
      // locks = [{x,y,key,why}] 잠긴 문 — 그 칸은 걸을 수 있는 문이어야 한다(잠금은 조수가 이벤트로 단다).
      for (const l of (ex.locks ?? []) as { x: number; y: number; key: string }[]) if (!ok(l.x, l.y)) w.push(`잠긴 문 (${l.x},${l.y}) 이 걸음 칸이 아니다 — 문 틈 칸을 준다(잠금은 이벤트)`);
      if ((ex.locks ?? []).length) narrowNoteExtra.push(` locks ${(ex.locks as { x: number; y: number; key: string }[]).map((l) => `${l.key}@${l.x},${l.y}`).join(" ")}`);
    }
    if (necks.length) w.push(`주 동선 1칸 목 ${necks.join(" ")} — 2칸으로 넓히거나, 1칸이 맞는 곳이면 narrow 로 밝힌다`);
    if (deadEnds.length) w.push(`막다른 1칸 통로(칸+끊기는 칸 수) ${deadEnds.join(" ")} — 직원 길이 아니면 3칸까지`);
    if (counterFront.length) w.push(`계산대 앞 손님 자리가 2줄이 아니다 ${counterFront.join(" ")}`);
    // 정문 하나: 맨 아래 줄 걸음 칸 덩이가 정확히 1(link_jp_city_interior 가 그 덩이만 출구로 본다).
    let runs = 0; for (let x = 0; x < m.width; x++) if (ok(x, m.height - 1) && !ok(x - 1, m.height - 1)) runs++;
    if (runs !== 1 && !inner) w.push(`맨 아래 줄 걸음 칸 덩이 ${runs}군데 — 출입구 틈은 한 군데여야 한다`);
    // 안내 문장의 장소 id 는 지금 placeId 와 같아야 한다(게시하면 조수가 그 id 로 부른다).
    for (const id of (p.rules ?? []).join(" ").match(/jp-city-[a-z0-9-]+-\d+x\d+/g) ?? []) if (id !== p.placeId) w.push(`rules 의 장소 id ${id} ≠ placeId ${p.placeId}`);
    if (w.length && !(r.warnings ?? []).length) bad++;
    console.log(w.length ? "WARN" : "OK  ", p.file.padEnd(13), `${m.width}x${m.height} walk ${walk} sq ${sq} e3 ${cover.size} (${Math.round(100 * cover.size / Math.max(1, walk))}%) w2 ${Math.round(100 * w2 / Math.max(1, walk))}% cut ${cuts.length ? cuts.join(" ") : "-"} hid ${hid.length ? hid.join(" ") : "-"}${narrowNote}${narrowNoteExtra.join("")}`, w.join("\n      "));
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
