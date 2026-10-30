// 탈출 문 자리 증명(모델 없음): 실제 조수 방탈출 맵에서 남쪽 틈을 막다른 길로 만들고(시작 맵으로 가는 이동 칸 제거)
// dressInteriorExits 가 북벽 발치에 문을 세우는지 본다. 북벽 발치 빈 칸을 이벤트로 막은 변형(=꽉 찬 북벽)도 함께.
//   bun scripts/qa/assistant-v2/exitDoorCheck.mts <run-dir> <mapId> [outDir]
import fs from "node:fs";
import path from "node:path";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import { dressInteriorExits } from "../../../src/ai/v2/exitDress.ts";
import type { Project } from "../../../src/project/types.ts";
import { layerTileAt, setLayerTileAt } from "../../../src/project/mapLayers.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const [dir, mapId] = [process.argv[2]!, process.argv[3]!];
const out = process.argv[4] ?? "qa-runs/v2scratch/exit-door";
fs.mkdirSync(out, { recursive: true });
const load = (p: string): Project => { const j = JSON.parse(fs.readFileSync(path.join(dir, p), "utf8")); return (j.project ?? j) as Project; };
const exported = load("play/player.json");
const base = load("session/snapshots/003-before.json");
const project0 = { ...exported, tilesets: base.tilesets, assets: base.assets } as Project;
const hasTransfer = (n: unknown): boolean => JSON.stringify(n ?? null).includes('"kind":"transfer"');

function trial(label: string, mutate: (p: Project) => void) {
  const project = structuredClone(project0);
  // 빈 시작 맵을 치운 상태(mt3 flash 이전 결과): 시작은 이 방, 어디에도 이 방으로 오가는 이동 칸이 없다.
  for (const m of Object.values(project.maps)) m.events = m.events.filter((e) => !hasTransfer(e.pages));
  project.startMapId = mapId;
  project.startPos = { x: 4, y: 5 } as never;
  mutate(project);
  fs.writeFileSync(path.join(out, `${label}-before.png`), renderMapPng(project, project.maps[mapId]!).png);
  const ctx: ToolContext = { project, currentMapId: mapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const res = dressInteriorExits(run, mapId);
  fs.writeFileSync(path.join(out, `${label}-after.png`), renderMapPng(ctx.project, ctx.project.maps[mapId]!).png);
  const ev = ctx.project.maps[mapId]!.events.map((e) => `${e.name ?? e.id}@(${e.x},${e.y})`).join(" ");
  console.log(`== ${label}: ${res.notes.join(" / ") || "(변화 없음)"}\n   이벤트: ${ev}`);
}
trial("as-is", () => {});
// 북벽 발치가 가득 찬 변형: 빈 칸 (4,3) 에 안락의자를 옮겨 놓고((5,4) 의자를 그리로) — 남는 북벽 발치는 둥근 창 아래 (5,3) 하나,
// 그 칸에는 «조사 시작» 반짝이 칸이 서 있다. 걸이 걷기 + 조사 칸 비키기 규칙을 함께 본다.
trial("full-north", (p) => {
  const map = p.maps[mapId]!;
  const from = 4 * map.width + 5, to = 3 * map.width + 4;
  setLayerTileAt(map, 3, to, layerTileAt(map, 3, from));
  setLayerTileAt(map, 3, from, -1);
});
