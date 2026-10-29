// 설계한 던전(dungeonDesign)을 지금 빌더로 지어 1배 그림·고친 것 목록을 뽑는다(모델 없음).
//   bun scripts/qa/assistant-v2/dungeonDesign.mts <out dir> [theme...]
// 예시 설계 넷 × 테마 + 설계 없는 판(옛 함수 배치) 하나. 결과 out/<theme>-<example>.png, out/report.json.
// DD_DESIGN=<설계 json 파일> 이면 그 설계 하나를 DD_TRIES(기본 6)개 씨앗(variety)으로 짓는다 — 실조수 판에서 실패한 설계 재현용.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/builders/index.ts";
import { DUNGEON_DESIGN_EXAMPLES } from "../../../src/ai/v2/dungeonParts.ts";
import type { PlaceSpec } from "../../../src/ai/v2/types.ts";

const [out, ...themes] = process.argv.slice(2);
if (!out) throw Error("dungeonDesign <out dir> [theme...]");
fs.mkdirSync(out, { recursive: true });
const rows: Record<string, unknown>[] = [];
for (const theme of themes.length ? themes : ["cave"]) {
  const one = process.env.DD_DESIGN ? JSON.parse(fs.readFileSync(process.env.DD_DESIGN, "utf8")) : undefined;
  const list = one ? Array.from({ length: Number(process.env.DD_TRIES ?? 6) }, (_, i) => ({ name: `given${i}`, ko: "주어진 설계", design: one })) : [...DUNGEON_DESIGN_EXAMPLES, { name: "nodesign", ko: "설계 없음", design: undefined }];
  for (const ex of list) {
    const project = createBlankProject();
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true } as never as { project: typeof project; currentMapId: string };
    const spec = { type: theme === "cave" ? "cave" : "dungeon", name: `${theme} ${ex.name}`, theme, variety: `qa|${theme}|${ex.name}`, ...(ex.design ? { dungeonDesign: ex.design } : {}) } as PlaceSpec;
    const t0 = Date.now();
    let res;
    try { res = builderFor(spec)!.build(createBuildRun(ctx as never), spec); } catch (e) { rows.push({ theme, ex: ex.name, error: String(e).slice(0, 300) }); console.log(theme, ex.name, "THROW", String(e).slice(0, 200)); continue; }
    const ms = Date.now() - t0;
    const fixes = res.warnings.filter((w) => /고침:/u.test(w));
    const m = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
    if (m) fs.writeFileSync(path.join(out, `${theme}-${ex.name}.png`), renderMapPng(ctx.project, m).png);
    rows.push({ theme, ex: ex.name, ok: res.ok, size: m ? `${m.width}x${m.height}` : "", ms, summary: res.summary.slice(0, 200), fixes, other: res.warnings.filter((w) => !fixes.includes(w)).slice(0, 8) });
    console.log(theme.padEnd(10), ex.name.padEnd(14), res.ok, m ? `${m.width}x${m.height}` : "-", `${ms}ms`, `fixes=${fixes.length}`, res.ok ? "" : res.summary.slice(0, 200));
  }
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(rows, null, 1));
