// bbox-ramps.scenario.mjs 의 픽스처 — bbox 언덕 마을(lay.mts 가 쓴 project.json) 여러 장을 한 프로젝트로 묶고,
// 남향 절벽 깎은 길(경사로·계단, 겹친 계단 포함)마다 「아래 입구 → 위 출구」 걷기 좌표를 옆 JSON 에 적는다.
// 조각 그림은 번들 rampArt.json 의 것(굽기 뒤)을 플레이어가 그대로 쓴다 — 실험용 설치(ramps/install.mts)는 여기 안 탄다.
//
//   bun scripts/qa/runtime/bbox-ramps-fixture.mts --out /tmp/bbox-ramps/hill.json <run dir>...   (run dir = layout.json + project.json)
//   QA_RECORD_VIDEO=/tmp/bbox-ramps/video RUNTIME_QA_POINTS=/tmp/bbox-ramps/hill.json.points.json \
//     npm run qa:runtime -- --scenario bbox-ramps --project /tmp/bbox-ramps/hill.json --out verify-shots/bbox-ramps
import fs from "node:fs";
import { serializePretty } from "../../../src/project/io.ts";
import type { Project } from "../../../src/project/types.ts";

const args = process.argv.slice(2);
const oi = args.indexOf("--out"); const OUT = oi >= 0 ? args[oi + 1]! : "/tmp/bbox-ramps/hill.json";
const runs = args.filter((a, i) => a !== "--out" && i !== oi + 1);
let project: Project | null = null;
const walks: { mapId: string; x: number; from: number; to: number; id: string }[] = [];
for (const [k, run] of runs.entries()) {
  const { project: p, mapId } = JSON.parse(fs.readFileSync(`${run}/project.json`, "utf8")) as { project: Project; mapId: string };
  const L = JSON.parse(fs.readFileSync(`${run}/layout.json`, "utf8")) as { cuts?: { id: string; x: number; y: number; dir: string }[] };
  const id = `bbox-hill-${k + 1}`;
  const map = { ...p.maps[mapId]!, id, name: `${run.split("/").slice(-2, -1)[0]} hill` };
  if (!project) { project = p; project.maps = {}; }
  project.maps[id] = map;
  // 남향 깎은 길: 발치 y, 아래 입구 y+1 → 위 출구 y-1 (겹친 계단은 위 계단 발치가 아래 계단 출구 줄 → 맨 위 출구까지 한 번에)
  const cuts = (L.cuts ?? []).filter((c) => c.dir === "north");
  const tops = new Set(cuts.map((c) => `${c.x},${c.y}`));
  for (const c of cuts) {
    if (tops.has(`${c.x},${c.y + 1}`)) continue;                       // 겹친 계단의 위 계단 — 아래 것에서 함께 걷는다
    let top = c.y - 1; while (tops.has(`${c.x},${top}`)) top -= 1;
    walks.push({ mapId: id, x: c.x, from: c.y + 1, to: top, id: `${c.id}@${c.x},${c.y}${top < c.y - 1 ? " (stacked)" : ""}` });
  }
}
if (!project) throw new Error("run dir 가 없다");
if (project.system.opening) project.system.opening.enabled = false;
const first = walks[0]!; project.startMapId = first.mapId; project.startPos = { x: first.x, y: first.from };
const used = new Set(Object.values(project.maps).map((m) => m.tilesetId));
for (const id of Object.keys(project.tilesets)) if (!used.has(id)) delete project.tilesets[id];
for (const t of Object.values(project.tilesets)) delete (t as { referenceDocuments?: unknown }).referenceDocuments;
fs.mkdirSync(OUT.replace(/\/[^/]+$/u, ""), { recursive: true });
fs.writeFileSync(OUT, serializePretty(project));
fs.writeFileSync(`${OUT}.points.json`, JSON.stringify(walks, null, 1));
console.log("->", OUT, walks.length, "walks:", walks.map((w) => `${w.mapId} ${w.id}`).join(" | "));
