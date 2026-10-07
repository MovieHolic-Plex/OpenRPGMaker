// 일본 실내 예제(tiledata/jp-city/interior/examples/places2.json 의 가게·공공·집 보강)를 **조수 도구 그대로**(build_hand_interior_room) 지어 본다.
// preview.py 「문제 0」은 근거가 아니다 — 도구 오류(탁상 4층·옆문 자리·한 줄 탁자)와 경고(닿지 못하는 바닥·쓸 수 없는 가구)는 이 검사로만 보인다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/check-interior-examples.mts [파일 이름 …]
// 출력: 예제마다 OK(경고 없음) · WARN(경고 전부) · FAIL(오류 전부). 종료 코드 = WARN+FAIL 수.
import { readFileSync } from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
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
    console.log(w.length ? "WARN" : "OK  ", p.file, w.join("\n      "));
  } catch (e) { bad++; console.log("FAIL", p.file, String((e as Error).message)); }
}
process.exit(bad);
