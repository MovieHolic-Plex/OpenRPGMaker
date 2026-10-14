// 던전 라우팅·거절 프로브(2026-10-15): 프로젝트 종류 × 요청 → 어댑터·종류·거절을 표로 쏟는다. 저장하지 않는다.
//   bun scripts/content/dungeon-route-probe.mts
import { createBlankProject } from "../../src/project/defaults/blankProject.ts";
import { createExpeditionSeed } from "../../src/project/examples/monsterExpedition/seed.ts";
import { applyGenrePreset } from "../../src/project/genrePresets.ts";
import { routeDungeon } from "../../src/editor/dungeonKit/route.ts";
import { DungeonComposeError } from "../../src/editor/dungeonKit/errors.ts";

const beodeulProject = createBlankProject();
const monsterProject = createBlankProject(); applyGenrePreset(monsterProject, "monster-collect");
const expedition = createExpeditionSeed();
const rows: [string, ReturnType<typeof createBlankProject>, Record<string, unknown>][] = [
  ["버들항·기본", beodeulProject, {}],
  ["버들항·광산", beodeulProject, { type: "mine" }],
  ["버들항·얼음", beodeulProject, { type: "ice" }],
  ["몬스터 수집 프리셋·기본", monsterProject, {}],
  ["몬스터 수집 프리셋·동굴 wet", monsterProject, { type: "cave", variant: "wet" }],
  ["몬스터 수집 프리셋·광산", monsterProject, { type: "mine" }],
  ["몬스터 수집 프리셋·카타콤", monsterProject, { type: "catacomb" }],
  ["몬스터 수집 프리셋·얼음", monsterProject, { type: "ice" }],
  ["몬스터 수집 프리셋·genre=rpg 기본", monsterProject, { genre: "rpg" }],
  ["몬스터 원정 시드·화산", expedition, { type: "volcano" }],
];
for (const [name, project, args] of rows) {
  try {
    const r = routeDungeon(project as never, args);
    console.log(name.padEnd(30), "->", r.adapter, r.genre, r.type, r.variant ?? "-", r.tilesetId, r.addTileset ? "(번들에서 시트 추가)" : "", r.notes.join(" "));
  } catch (e) { console.log(name.padEnd(30), "-> 거절", e instanceof DungeonComposeError ? e.code : "?", (e as Error).message); }
}
