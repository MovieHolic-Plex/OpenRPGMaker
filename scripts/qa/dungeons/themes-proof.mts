// 던전 주제 열둘 증명(2026-10-23 dungeon-themes, proof.mts 와 같은 길): author_dungeon 을 실제 도구 레지스트리로 돌려(중첩 도구 포함) 층 PNG·이벤트·린트를 쏟는다.
//   bun scripts/qa/dungeons/themes-proof.mts <outDir> [case...]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { applyGenrePreset } from "../../../src/project/genrePresets.ts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { store } from "../../../src/project/store.ts";
import { projectLint as lintProject } from "../../../src/project/lint/projectLint.ts";
import { measureSpace } from "./space.mts";

const out = process.argv[2] ?? "/tmp/dg-themes";
fs.mkdirSync(out, { recursive: true });
// 2026-10-23 dungeon-themes: 열두 주제 × 두 요청(배치 가족·시드가 달라야 한다 — 복사본 금지).
const CASES: Record<string, Record<string, unknown>> = {
  "forest-a": { type: "forest", name: "길 잃은 숲" }, "forest-b": { type: "forest", name: "세계수의 숲", size: "large", layout: "loop" },
  "cave-a": { type: "cave", name: "박쥐 동굴" }, "cave-b": { type: "cave", name: "지하 호수 동굴", layout: "loop", size: "large" },
  "ruins-a": { type: "temple", name: "고대 유적" }, "ruins-b": { type: "temple", name: "덩굴 덮인 신전", size: "large" },
  "castle-a": { type: "castle", name: "왕성", layout: "hub" }, "castle-b": { type: "castle", name: "흑기사의 요새", layout: "linear", size: "large" },
  "catacomb-a": { type: "catacomb", name: "지하묘지", inspiration: "엘든링" }, "catacomb-b": { type: "catacomb", name: "납골당", layout: "hub", floors: 2 },
  "mine-a": { type: "mine", name: "나르쉐 광산", inspiration: "FF6" }, "mine-b": { type: "mine", name: "버려진 갱도", size: "large", layout: "loop" },
  "swamp-a": { type: "swamp", name: "독 늪" }, "swamp-b": { type: "swamp", name: "맹그로브 습지", size: "large", layout: "linear" },
  "volcano-a": { type: "volcano", name: "화산 동굴" }, "volcano-b": { type: "volcano", name: "용암 신전", layout: "loop", size: "large" },
  "ice-a": { type: "ice", name: "얼음 동굴" }, "ice-b": { type: "ice", name: "설산의 빙굴", size: "large", layout: "linear" },
  "pyramid-a": { type: "pyramid", name: "파라오의 피라미드" }, "pyramid-b": { type: "pyramid", name: "모래 왕묘", layout: "hub", size: "large" },
  "tower-a": { type: "tower", name: "마법탑", floors: 3, direction: "up" }, "tower-b": { type: "tower", name: "현자의 탑", inspiration: "크로노 트리거" },
  "otherworld-a": { type: "otherworld", name: "마계" }, "otherworld-b": { type: "otherworld", name: "마왕의 이세계", size: "large", layout: "loop" },
};
const only = process.argv.slice(3);
for (const [name, args] of Object.entries(CASES)) {
  if (only.length && !only.includes(name)) continue;
  const project = createBlankProject();
  applyGenrePreset(project, "adventure-jrpg");
  store.loadProject?.(project);
  try {
    const t0 = performance.now();
    const res = getTool("author_dungeon")!.run(project, { ...args, mapId: project.startMapId }) as { summary: string; data: any; warnings?: string[] };
    const ms = Math.round(performance.now() - t0);
    const floors: string[] = res.data.floors;
    for (const id of floors) fs.writeFileSync(path.join(out, `${name}-${id}.png`), renderMapPng(project, project.maps[id]!).png);
    const issues = (lintProject(project) as any[]).filter((i) => floors.includes(i.mapId));
    const events = floors.map((id) => ({ id, name: project.maps[id]!.name, size: `${project.maps[id]!.width}x${project.maps[id]!.height}`,
      events: project.maps[id]!.events.map((e) => `${e.id}@${e.x},${e.y}${JSON.stringify(e.pages?.[0]?.commands ?? []).includes('"transfer"') ? "→" + JSON.stringify((e.pages![0]!.commands as any[]).find((c) => c.kind === "transfer")) : ""}`) }));
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ summary: res.summary, warnings: res.warnings, events, issues: issues.map((i) => `${i.severity} ${i.code} ${i.message}`), ...(process.env.DT_DUMP ? { maps: floors.map((id) => ({ id, w: project.maps[id]!.width, lower: project.maps[id]!.lowerTiles, upper: project.maps[id]!.upperTiles })) } : {}) }, null, 1));
    console.log(`== ${name} ${ms}ms floors=${floors.length} start=${project.startMapId}@${project.startPos.x},${project.startPos.y}`);
    for (const f of events) { const m = measureSpace(project, project.maps[f.id]!); console.log(" ", f.id, f.name, f.size, f.events.length, "events", `void ${m.voidPct}% screen≤${m.worstScreenVoidPct}%(avg ${m.meanScreenVoidPct}) v+b≤${m.worstScreenVoidOrBarePct}%@${m.worstScreenVoidOrBareAt.x},${m.worstScreenVoidOrBareAt.y} bare ${m.bareFloorPct}% rect ${m.maxBareRect.w}x${m.maxBareRect.h}`); }
    console.log("  lint:", issues.filter((i) => i.severity !== "info").map((i) => i.code + (process.env.DT_DEBUG ? ":" + i.message : "")).join(" | ") || "0");
    console.log("  gimmick:", res.data.gimmick, (res.summary.match(/(순간이동[^—]*|광차 정거장[^—]*|얼음 미끄럼길[^—]*|[가-힣]+ 함정:[^—]*|레버 퍼즐:[^.]*|[가-힣]+ 다리 장치:[^.]*)/) ?? [""])[0].slice(0, 160));
    if (res.warnings?.length) console.log("  warn:", res.warnings.slice(0, 6).join(" | ").slice(0, 600));
  } catch (e) { console.log(`== ${name} ERR`, (e as Error).message.slice(0, 400)); }
}
