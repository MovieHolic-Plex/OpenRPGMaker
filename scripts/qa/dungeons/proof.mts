// 던전 조수 도구 증명(2026-10-22): author_dungeon 을 실제 도구 레지스트리로 돌려(중첩 도구 포함) 층 PNG·이벤트·린트를 쏟는다.
//   bun scripts/qa/dungeons/proof.mts <outDir>
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { applyGenrePreset } from "../../../src/project/genrePresets.ts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { store } from "../../../src/project/store.ts";
import { projectLint as lintProject } from "../../../src/project/lint/projectLint.ts";
import { measureSpace } from "./space.mts";

const out = process.argv[2] ?? "/tmp/dg-proof2";
fs.mkdirSync(out, { recursive: true });
const CASES: Record<string, Record<string, unknown>> = {
  // 2026-10-23 dg2-r3 실조수 호출 인자 그대로(시드가 이름·크기에서 나오므로 같은 판이 나온다). troops 는 조수가 만든 그룹이라 뺐다.
  "small-cave": { type: "cave", size: "small", name: "작은 동굴" },
  "tower3": { type: "castle", floors: 3, direction: "up", size: "medium", genre: "rpg", name: "탑" },
  "tower3t": { type: "temple", floors: 3, direction: "up", name: "탑" },
  "catacomb": { type: "catacomb", name: "지하 묘지", rooms: [{ id: "entrance", kind: "entrance" }, { id: "hall", kind: "hall" }, { id: "crypt1", kind: "crypt", from: "hall" }, { id: "crypt2", kind: "crypt", from: "hall" }, { id: "crypt3", kind: "crypt", from: "crypt1" }, { id: "vault", kind: "vault", from: "crypt3" }] },
  "catacomb2": { type: "catacomb", floors: 2, name: "지하 묘지" },
  "flooded-temple": { type: "temple", flooded: true, name: "물에 잠긴 옛 신전" },
  "lava": { type: "volcano", name: "화산 동굴" },
  "den": { type: "cave", lair: true, genre: "rpg", size: "medium", name: "고블린 굴" },
  "puzzle": { puzzle: "lever", name: "레버의 지하 감옥", size: "medium" },
  "boss-run": { type: "catacomb", genre: "rpg", name: "지하 던전", size: "medium" },
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
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ summary: res.summary, warnings: res.warnings, events, issues: issues.map((i) => `${i.severity} ${i.code} ${i.message}`) }, null, 1));
    console.log(`== ${name} ${ms}ms floors=${floors.length} start=${project.startMapId}@${project.startPos.x},${project.startPos.y}`);
    for (const f of events) { const m = measureSpace(project, project.maps[f.id]!); console.log(" ", f.id, f.name, f.size, f.events.length, "events", `void ${m.voidPct}% screen≤${m.worstScreenVoidPct}%(avg ${m.meanScreenVoidPct}) v+b≤${m.worstScreenVoidOrBarePct}%@${m.worstScreenVoidOrBareAt.x},${m.worstScreenVoidOrBareAt.y} bare ${m.bareFloorPct}% rect ${m.maxBareRect.w}x${m.maxBareRect.h}`); }
    console.log("  lint:", issues.filter((i) => i.severity !== "info").map((i) => i.code).join(",") || "0");
    if (res.warnings?.length) console.log("  warn:", res.warnings.slice(0, 6).join(" | ").slice(0, 600));
  } catch (e) { console.log(`== ${name} ERR`, (e as Error).message.slice(0, 400)); }
}
