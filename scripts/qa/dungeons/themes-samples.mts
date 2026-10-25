// 던전 주제 견본(2026-10-24 dungeon-themes): 주제마다 author_dungeon 한 번씩 한 프로젝트에 지어 정본 SQLite 폴더에 저장 → 다시 열어
// 맵이 같은지 대조하고, **다시 연 사본**에서 층 PNG 를 그린다(viz 는 이 PNG 를 쓴다).
//   bun scripts/qa/dungeons/themes-samples.mts <projectDir(새 폴더)> <outDir> [seeds e.g. 1,2]
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { applyGenrePreset } from "../../../src/project/genrePresets.ts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { store } from "../../../src/project/store.ts";
import { projectLint as lintProject } from "../../../src/project/lint/projectLint.ts";
import { initLocalProjectStore, openLocalProjectStore } from "../../../electron/local-store/store.ts";
import type { Project } from "../../../src/project/types.ts";

const [dir, out = "/tmp/dt-samples", seedsArg = ""] = process.argv.slice(2);
// 시드 목록(쉼표) — 주면 주제마다 시드별로 따로 지어 `<theme>@<seed>-<층>.png` 로 그린다(시드 변주 대조)
const SEEDS: (number | undefined)[] = seedsArg ? seedsArg.split(",").map(Number) : [undefined];
if (!dir) throw Error("projectDir 필요");
if (fs.existsSync(path.join(dir, "project.sqlite"))) throw Error("기존 정본 프로젝트를 덮어쓰지 않는다: " + dir);
fs.mkdirSync(out, { recursive: true });
const THEMES: [string, Record<string, unknown>][] = [
  ["forest", { type: "forest", name: "길 잃은 숲" }], ["cave", { type: "cave", name: "박쥐 동굴" }], ["ruins", { type: "temple", name: "덩굴 덮인 신전" }],
  ["castle", { type: "castle", name: "흑기사의 요새" }], ["catacomb", { type: "catacomb", name: "지하묘지", inspiration: "엘든링" }],
  ["mine", { type: "mine", name: "나르쉐 광산", inspiration: "FF6" }], ["swamp", { type: "swamp", name: "독 늪" }], ["volcano", { type: "volcano", name: "화산 동굴" }],
  ["ice", { type: "ice", name: "얼음 동굴" }], ["pyramid", { type: "pyramid", name: "파라오의 피라미드" }],
  ["tower", { type: "tower", name: "현자의 탑", inspiration: "크로노 트리거" }], ["otherworld", { type: "otherworld", name: "마왕의 이세계" }],
];
const project = createBlankProject();
applyGenrePreset(project, "adventure-jrpg");
store.loadProject?.(project);
const made: { theme: string; floors: string[]; summary: string; gimmick: string }[] = [];
for (const [theme0, args] of THEMES) for (const seed of SEEDS) {
  const theme = seed === undefined ? theme0 : `${theme0}@${seed}`;
  const host = `dt_${theme0}${seed === undefined ? "" : "_s" + seed}`;
  // 주제마다 빈 맵 하나를 새로 만들어 그 자리에 짓는다(시작 맵을 덮지 않게)
  const base = project.maps[project.startMapId]!;
  project.maps[host] = { ...structuredClone(base), id: host, name: String(args.name), events: [] };
  project.mapTree.children.push({ mapId: host, children: [] });
  const res = getTool("author_dungeon")!.run(project, { ...args, mapId: host, ...(seed === undefined ? {} : { seed }) }) as { summary: string; data: any };
  made.push({ theme, floors: res.data.floors, summary: res.summary.slice(0, 200), gimmick: res.data.gimmick });
}
const lint = (lintProject(project) as any[]).filter((i) => i.severity === "error");
const st = await initLocalProjectStore({ projectDir: dir });
const projectId = st.info().projectId;
const saved = await st.saveProject(project);
if (saved.kind !== "saved") throw Error("정본 저장 충돌");
st.close();
const st2 = await openLocalProjectStore({ projectDir: dir });
const re = st2.loadSnapshot()!.project as Project;
st2.close();
const mismatch: string[] = [];
for (const m of made) for (const id of m.floors) {
  const a = project.maps[id]!, b = re.maps[id];
  if (!b || JSON.stringify(a.lowerTiles) !== JSON.stringify(b.lowerTiles) || JSON.stringify(a.upperTiles) !== JSON.stringify(b.upperTiles) || a.events.length !== b.events.length) mismatch.push(id);
}
store.loadProject?.(re);
for (const m of made) m.floors.forEach((id, i) => fs.writeFileSync(path.join(out, `${m.theme}-${i}.png`), renderMapPng(re, re.maps[id]!).png));
const report = { projectId, dir, saved: true, reopened: true, mismatch, lintErrors: lint.map((i) => i.code), themes: made.map((m) => ({ ...m, sizes: m.floors.map((id) => `${re.maps[id]!.width}x${re.maps[id]!.height}`), events: m.floors.map((id) => re.maps[id]!.events.length) })) };
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ projectId, mismatch, lintErrors: report.lintErrors.length, themes: made.map((m) => `${m.theme}:${m.floors.length}`) }));
