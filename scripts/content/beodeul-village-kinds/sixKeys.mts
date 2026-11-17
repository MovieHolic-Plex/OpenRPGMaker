// 같은 마을 요청을 게임 열쇠 여섯으로(진짜 v2 빌더 — builderFor → author_beodeul_town): 어느 종류가 나왔고 어떤 장면이 섰나. 한 게임의 마을 셋도 본다.
//   bun scripts/content/beodeul-village-kinds/sixKeys.mts <결과 폴더> [--theme river|coast] [--salt N]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { villageKindOfMap, villageScenesOfMap } from "../../../src/project/villageKindPlan.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv[0] && !argv[0].startsWith("--") ? argv[0] : "";
if (!out) throw new Error("sixKeys.mts <결과 폴더> [--theme river|coast] [--salt N]");
const theme = opt("theme", "river"), salt = Number(opt("salt", "4242"));
fs.mkdirSync(out, { recursive: true });
const NAMES = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"];
const REQUEST: Record<string, { name: string; task: string; hints: Record<string, unknown> }> = {
  river: { name: "버들 마을", task: "강가에 작은 마을을 만들어 줘", hints: {} },
  coast: { name: "갈매기 포구", task: "바닷가에 포구 마을을 만들어 줘", hints: { theme: "coast" } },
};
const req = REQUEST[theme]!;
const rows: Record<string, unknown>[] = [];
for (const [n, name] of NAMES.entries()) {
  const key = JSON.stringify(["project", `variety-${name}`]);
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key } as ToolContext;
  const run = createBuildRun(ctx);
  const spec = { type: "village", name: req.name, salt, variety: `${key}|${req.task}`, ...(Object.keys(req.hints).length ? { hints: req.hints } : {}) } as PlaceSpec;
  const res = builderFor(spec)!.build(run, spec);
  const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
  if (!res.ok || !map) { console.log(`${n} ${name}: 짓기 실패 — ${res.summary.slice(0, 200)}`); rows.push({ n, name, ok: false }); continue; }
  fs.writeFileSync(path.join(out, `six-${theme}-${n}.png`), renderMapPng(ctx.project, map).png);
  const kind = villageKindOfMap(map), scenes = villageScenesOfMap(map).map((r) => r.label);
  rows.push({ n, name, ok: true, kind, scenes, size: `${map.width}x${map.height}`, summary: res.summary });
  console.log(`${n} ${name} ${map.width}x${map.height} → ${kind} · 장면 ${scenes.join(" · ") || "없음"}`);
  if (n === 0) console.log(`  요약: ${res.summary.slice(0, 520)}`);
}
// 한 게임의 마을 셋: 같은 열쇠·다른 씨앗으로 세 맵을 차례로 — 세 종류여야 한다.
{
  const key = JSON.stringify(["project", "variety-ashvale"]);
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: key } as ToolContext;
  const kinds: (string | undefined)[] = [];
  for (const [i, nm] of ["첫 마을", "둘째 마을", "셋째 마을"].entries()) {
    const run = createBuildRun(ctx);
    const spec = { type: "village", name: nm, salt: salt + i * 17, mapId: i === 0 ? undefined : `map_three_${i}`, variety: `${key}|${nm}`, ...(Object.keys(req.hints).length ? { hints: req.hints } : {}) } as PlaceSpec;
    if (i > 0) delete (spec as { mapId?: string }).mapId;
    (ctx as { currentMapId?: string }).currentMapId = i === 0 ? project.startMapId : undefined;
    const res = builderFor(spec)!.build(run, spec);
    const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
    kinds.push(map ? villageKindOfMap(map) : `실패: ${res.summary.slice(0, 80)}`);
  }
  console.log(`한 게임(ashvale)의 마을 셋 → ${kinds.join(" · ")} (서로 다른 종류 ${new Set(kinds).size})`);
  rows.push({ three: kinds });
}
fs.writeFileSync(path.join(out, `six-${theme}.json`), JSON.stringify({ theme, salt, request: req, rows }, null, 1));
const ok = rows.filter((r) => r.ok) as { kind?: string }[];
console.log(`여섯 열쇠 — 종류 ${new Set(ok.map((r) => r.kind)).size}가지: ${ok.map((r) => r.kind).join(", ")}`);
