// 같은 요청을 게임 열쇠 여섯으로 — 어떤 UI 모습 한 벌이 골라지는가(모델 없음).
//
//   bun scripts/qa/assistant-v2/uiLookSeeds.mts [--task "재밌는 게임 만들어 줘."] [--project <풀린 프로젝트.json>] [--out <결과.json>]
//
// 두 표를 낸다:
//  ① 요청 → 세계: 낱말 없는 요청은 게임 열쇠가 세계를 고른다(worldForRequest — v2 가 쓰는 그 함수). 그 세계의 칩셋으로 시작 맵을 두고 턴제 전투 하나를
//     넣은 빈 게임에 끝맺음의 겉모습 채우기(applyLookDefaults)를 돌린다 — 열쇠마다 세계와 모습.
//  ② --project 로 준 지은 게임 하나(세계가 정해진 뒤)에서 겉모습 축을 비우고 같은 여섯 열쇠로 다시 채운다 — 같은 세계 안에서 모습이 갈리는가.
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { applyLookDefaults } from "../../../src/ai/v2/story/shipDefaults.ts";
import { worldForRequest } from "../../../src/ai/v2/request/world.ts";
import { pickUiLook, uiLookById, uiLookFacts } from "../../../src/project/uiLook.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const task = opt("task") ?? "재밌는 게임 만들어 줘.";
export const GAMES = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"].map((name) => JSON.stringify(["project", `variety-${name}`]));

const describe = (p: Project) => { const s = p.system; return { look: s.uiLook, dialogue: s.dialogueStyle ?? "glass", menu: s.menuUiStyle ?? "pixel", battle: s.battleLook?.preset ?? "pixel", logo: s.titleScreen?.logoStyle, titleMenu: s.titleScreen?.menuStyle ?? "window", hudFont: s.fieldHud?.font, hudPanel: s.fieldHud?.panel }; };

const worldRows = GAMES.map((key) => {
  const p = createBlankProject() as Project;
  const world = worldForRequest(p, key, task);
  const map = p.maps[p.startMapId]!;
  if (world) map.tilesetId = world.tilesetId;
  map.encounterRate = 0;
  map.events = [{ id: "ev_foe", name: "적", x: 3, y: 3, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: p.database.troops[0]?.id ?? "troop_1" }] }] } as never];
  const picked = pickUiLook(p, key);
  applyLookDefaults(p, task, key);
  return { key, world: world?.id ?? "(요청이 정한 세계 없음 — 버들항)", facts: picked.facts, pool: picked.pool, ...describe(p) };
});
console.log(`요청 «${task}» — 열쇠 여섯`);
for (const r of worldRows) console.log(`  ${r.key}  세계 ${r.world}  →  ${r.look} (${uiLookById(r.look)?.label})  후보 ${r.pool.join("/")}`);
console.log(`  서로 다른 모습 ${new Set(worldRows.map((r) => r.look)).size}개 · 세계 ${new Set(worldRows.map((r) => r.world)).size}개`);

let gameRows: unknown[] = [];
const file = opt("project");
if (file) {
  const base = JSON.parse(fs.readFileSync(file, "utf8")) as Project;
  gameRows = GAMES.map((key) => {
    const p = { ...base, system: structuredClone(base.system) } as Project;
    const s = p.system;
    delete s.uiLook; delete s.dialogueStyle; delete s.menuUiStyle; delete s.battleLook;
    if (s.titleScreen) { delete s.titleScreen.logoStyle; delete s.titleScreen.menuStyle; }
    if (s.fieldHud) { delete s.fieldHud.font; delete s.fieldHud.panel; delete s.fieldHud.menuStyle; }
    const picked = pickUiLook(p, key);
    return { key, facts: uiLookFacts(p), pool: picked.pool, look: picked.look.id };
  });
  console.log(`지은 게임 «${base.meta?.title ?? file}» — 같은 여섯 열쇠`);
  for (const r of gameRows as { key: string; look: string; pool: string[]; facts: unknown }[]) console.log(`  ${r.key}  →  ${r.look}  후보 ${r.pool.join("/")}  ${JSON.stringify(r.facts)}`);
  console.log(`  서로 다른 모습 ${new Set((gameRows as { look: string }[]).map((r) => r.look)).size}개`);
}
if (opt("out")) fs.writeFileSync(opt("out")!, JSON.stringify({ task, worldRows, gameRows }, null, 1));
