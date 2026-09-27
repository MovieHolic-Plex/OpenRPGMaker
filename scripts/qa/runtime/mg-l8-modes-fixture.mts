// mg-l8-modes 런타임 QA 픽스처 — 옆보기 맵(중력·낙하 피해)과 전술 격자 전투(tacticsBattle).
//   node node_modules/vite-node/vite-node.mjs --script scripts/qa/runtime/mg-l8-modes-fixture.mts > project.json
// 시작 맵: (10,9) 조사 이벤트가 tacticsBattle(트룹 1마리, 4칸 너비 격자 — 세로는 최소 2칸으로 올라간다, 승리 시 플래그 tactics_won).
// 옆보기 맵(map_side, 8×12): 바닥 y=11 벽, 나머지 풀밭. (3,1) 에 세우면 중력으로 (3,10) 까지 떨어진다(9칸 → 낙하 피해).
// 엔진 계약 픽스처이며 데모 콘텐츠로 출하하지 않는다.
import { createBlankMap, createBlankProject, TILE } from "../../../src/project/defaults";
import { normalizeEnemyRecord } from "../../../src/project/databaseEnemyTroopRecordModel";
import { deserialize, serialize } from "../../../src/project/io";

const project = createBlankProject();
project.meta.title = "mg-l8 modes contract";
const start = project.maps[project.startMapId]!;
project.database.enemies.push(normalizeEnemyRecord({
  id: "grid_slime", name: "격자 슬라임",
  stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, mind: 0, agility: 1 },
  rewards: { exp: 0, gold: 0, dropRatePercent: 0 },
}));
project.database.troops.push({ id: "grid_troop", name: "격자", enemyIds: ["grid_slime"], autoAlign: true, battleEventPages: [] });
start.events.push({
  id: "ev_tactics", name: "전술 교관", x: 10, y: 9, trigger: { kind: "action" },
  commands: [{
    kind: "tacticsBattle", troopId: "grid_troop", width: 4, height: 1, canLose: true,
    victoryBranch: [{ kind: "setFlag", flag: "tactics_won", value: true }],
    defeatBranch: [],
  }],
});

const side = createBlankMap("옆보기", 8, 12, start.tilesetId);
side.id = "map_side";
side.lowerTiles.fill(TILE.GRASS);
for (let x = 0; x < side.width; x += 1) side.lowerTiles[11 * side.width + x] = TILE.WALL;
side.sideView = true;
side.sideViewFallTiles = 4;
side.sideViewFallDamage = 3;
project.maps[side.id] = side;

const json = serialize(project);
const reloaded = deserialize(json);
if (reloaded.maps.map_side?.sideView !== true) { console.error("sideView lost on reload"); process.exit(1); }
process.stdout.write(json);
