// 일본 집 청사진(src/editor/handInterior/jpHouseBlueprint.ts)을 조수 도구 그대로(build_hand_interior_room({tileset:"jp_city", layout:{program, seed}})) 지어 본다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/jp-house-blueprint.mts [--seeds 1-40] [--render 1,2,3] [--out DIR]
// 씨앗마다 1층·2층을 짓고 오류·경고·빈 바닥(measureLayoutQuality.empty, 기준 ≤30)·계단 칸 걸음 도달을 잰다.
// --render 씨앗은 DIR/jp-house-<층>-s<씨앗>.map.json 을 남긴다(그림은 maps/render.py). 종료 코드 = 문제 있는 씨앗 수.
import fs from "node:fs";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "@/editor/tools/handInteriorTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { canMove } from "@/project/collision";
import { measureLayoutQuality } from "@/ai/piAgent/layoutQuality";
import { composeJpHouseBlueprint } from "@/editor/handInterior/jpHouseBlueprint";
import { JP_INTERIOR_SPEC } from "@/editor/handInterior/builder";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1]! : d; };
const [s0, s1] = arg("--seeds", "1-40").split("-").map(Number) as [number, number];
const RENDER = new Set(arg("--render", "").split(",").filter(Boolean).map(Number));
const OUT = arg("--out", "/tmp/jp-house-blueprint");
fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
for (let seed = s0; seed <= (s1 ?? s0); seed++) {
  const project = createEmptyToolProject("jph");
  const lines: string[] = [];
  let fail = false;
  for (const floor of [1, 2] as const) {
    const program = `jp-house-${floor}f`;
    const mapId = `jph-${floor}f`;
    const bp = composeJpHouseBlueprint(program, JP_INTERIOR_SPEC, seed)!;
    try {
      const r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "jp_city", mapId, name: floor === 1 ? "일본 집 1층" : "일본 집 2층", layout: { program, seed } });
      const m = project.maps[mapId]!;
      const q = measureLayoutQuality(project, m)!;
      const start = floor === 1 ? (() => { for (let x = 0; x < m.width; x++) if (canMove(project, m, x, m.height - 1, x, m.height - 2)) return { x, y: m.height - 1 }; return { x: 0, y: m.height - 1 }; })() : bp.start![0]!;
      const seen = new Set([`${start.x},${start.y}`]); const st = [start];
      while (st.length) { const c = st.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = c.x + dx, ny = c.y + dy; if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(`${nx},${ny}`) || !canMove(project, m, c.x, c.y, nx, ny)) continue; seen.add(`${nx},${ny}`); st.push({ x: nx, y: ny }); } }
      const stairsOk = bp.stairs.from.every((p) => seen.has(`${p.x},${p.y}`));
      // 위층은 바깥 출구가 없어야 한다(noExteriorExit — 남쪽 문·현관 매트·맨 아래 줄 걸음 칸 0). 예전 이름 house-2f 로 불러도 같은 청사진을 타는지도 본다.
      let exitBad = "";
      if (floor === 2) {
        const bottom = Array.from({ length: m.width }, (_, x) => x).filter((x) => [[0, -1], [-1, 0], [1, 0]].some(([dx, dy]) => canMove(project, m, x, m.height - 1, x + dx!, m.height - 1 + dy!)));
        const southDoor = bp.objects.filter((o) => /^genkan-|door-main|entrance/u.test(o.id) || o.y >= m.height - 2 && /door|mat/u.test(o.id) && !/toilet/u.test(o.id));
        const alias = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "jp_city", mapId: `${mapId}-alias`, name: "일본 단독주택 2층", layout: { program: "house-2f", seed } });
        const am = project.maps[`${mapId}-alias`]!;
        const aliasBottom = Array.from({ length: am.width }, (_, x) => x).filter((x) => canMove(project, am, x, am.height - 1, x, am.height - 2) || canMove(project, am, x, am.height - 2, x, am.height - 1));
        if (bottom.length || southDoor.length || aliasBottom.length || !/청사진/u.test(alias.summary + (alias.warnings ?? []).join(" "))) exitBad = `EXIT bottom=${bottom} south=${southDoor.map((o) => o.id)} alias=${aliasBottom}`;
      }
      const warnings = (r.warnings ?? []).filter((w) => !/^청사진|^자동 맞춤|^평면이 참고 예제/u.test(w));
      const problem = warnings.length > 0 || q.empty > 30 || !stairsOk || !!exitBad;
      if (problem) fail = true;
      lines.push(`${floor}F ${m.width}x${m.height} empty ${q.empty}% sq ${q.square} reach ${seen.size} stairs ${stairsOk ? "ok" : "UNREACHED"}${floor === 2 ? (exitBad ? ` ${exitBad}` : " no-exit ok") : ""}${warnings.length ? `\n     ${warnings.join("\n     ")}` : ""}`);
      if (RENDER.has(seed)) fs.writeFileSync(`${OUT}/jp-house-${floor}f-s${seed}.map.json`, JSON.stringify(m));
    } catch (e) { fail = true; lines.push(`${floor}F FAIL ${(e as Error).message}`); }
  }
  if (fail) bad++;
  console.log(`${fail ? "BAD " : "OK  "} seed ${seed}: ${lines.join(" | ")}`);
}
process.exit(bad);
