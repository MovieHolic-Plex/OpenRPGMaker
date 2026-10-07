// 일본 실내 예제(tiledata/jp-city/interior/examples/places2.json 의 가게·공공·집 보강)를 **조수 도구 그대로**(build_hand_interior_room) 지어 본다.
// preview.py 「문제 0」은 근거가 아니다 — 도구 오류(탁상 4층·옆문 자리·한 줄 탁자)와 경고(닿지 못하는 바닥·쓸 수 없는 가구)는 이 검사로만 보인다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/check-interior-examples.mts [파일 이름 …]
// 출력: 예제마다 OK(경고 없음) · WARN(경고 전부) · FAIL(오류 전부). 종료 코드 = WARN+FAIL 수.
// 빈 바닥 수치(엔진 통행 판정): sq = 걸을 수 있는 칸만으로 된 가장 큰 정사각형 변(2 = 통로 폭, 4 이상 = 빈 마당),
//   e3 = 3×3 이 전부 걸음 칸인 창이 덮는 칸 수(빈 바닥 넓이), walk = 걸음 칸 수. 가게 목표 sq ≤ 3, e3 ≤ 걸음 칸의 15%.
import { readFileSync } from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isPassable } from "@/project/collision";
const EX = "tiledata/jp-city/interior/examples";
const only = process.argv.slice(2);
const places = JSON.parse(readFileSync(`${EX}/places2.json`, "utf8")).filter((p: { file: string }) => !only.length || only.includes(p.file));
let bad = 0;
const project = createEmptyToolProject("chk");
for (const p of places) {
  const ex = JSON.parse(readFileSync(`${EX}/${p.file}.json`, "utf8"));
  try {
    const r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "jp_city", mapId: `chk-${p.file}`, name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], start: [{ x: ex.start[0], y: ex.start[1] }], links: [] });
    const w = r.warnings ?? [];
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
    console.log(w.length ? "WARN" : "OK  ", p.file.padEnd(13), `${m.width}x${m.height} walk ${walk} sq ${sq} e3 ${cover.size} (${Math.round(100 * cover.size / Math.max(1, walk))}%)`, w.join("\n      "));
  } catch (e) { bad++; console.log("FAIL", p.file, String((e as Error).message)); }
}
process.exit(bad);
