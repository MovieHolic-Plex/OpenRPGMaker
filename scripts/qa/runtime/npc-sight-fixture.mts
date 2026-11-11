// 시선 조건(eventSeesPlayer) 상자 시연 픽스처. stdout = 프로젝트 JSON.
//   시작 맵 왼쪽 빈터(x0~13, y22~31)를 풀밭으로 비우고 네 기둥을 세운다. 경비는 맨 위에서 아래(기본 방향)를 본다.
//   주인공은 경비 아래에 서서 바로 밑 상자를 연다. 경비가 보면 꾸중, 못 보면 은화 10.
//     x2 시야 안(4칸) · x5 벽 뒤(y24 벽 칸) · x8 어둠(체크포인트가 조명을 어둡게) · x11 사거리 밖(7칸)
//   NPC_SIGHT_NEW=1 이면 어둠 기둥 상자 조건에 darkness:{dark:2} 를 단다(새 선택 칸). 없으면 옛 칸만 — origin/main 에서도 열린다.
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/npc-sight-fixture.mts > /tmp/npc-sight.json
import { serialize } from "../../../src/project/io";
import { isSightWallTile } from "../../../src/project/sightBlockers";
import type { Command, Condition, Project } from "../../../src/project/types";

const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
const project: Project = await createProjectStartSeed("adventure-jrpg" as never, "시선 시연", "example", "wide");
project.system.playResolution = { width: 480, height: 270 };
delete (project.system as { cameraZoom?: number }).cameraZoom;
project.session.gold = 0;
const map = project.maps[project.startMapId]!;
const tileset = project.tilesets[map.tilesetId];
const used = [...new Set(map.lowerTiles)].filter((tile) => tile >= 0);
const wallTile = used.find((tile) => isSightWallTile(tileset, tile)) ?? Array.from({ length: 4096 }, (_, i) => i).find((tile) => isSightWallTile(tileset, tile));
if (wallTile === undefined) throw new Error("시선을 막는 벽 타일을 찾지 못했다");
const grass = map.lowerTiles[23 * map.width + 0]!;
for (let y = 22; y <= 31; y++) for (let x = 0; x <= 13; x++) {
  const i = y * map.width + x;
  map.lowerTiles[i] = grass;
  for (const layer of [map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles]) if (layer) layer[i] = -1;
}
map.lowerTiles[24 * map.width + 5] = wallTile;
map.events = map.events.filter((event) => !(event.x <= 13 && event.y >= 22 && event.y <= 31));
const sprite = Object.values(project.maps).flatMap((m) => m.events).flatMap((event) => event.pages ?? []).map((page) => page.graphic).find((graphic) => graphic?.sprite);
const page = (id: string, commands: Command[]) => ({
  id, name: "기본", conditions: [], graphic: { ...(sprite ?? {}), direction: "down" }, trigger: { kind: "action" }, priority: "same",
  movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
});
const stations = [
  { key: "sight", x: 2, chestY: 28 },
  { key: "wall", x: 5, chestY: 28 },
  { key: "dark", x: 8, chestY: 28 },
  { key: "far", x: 11, chestY: 31 },
];
for (const s of stations) {
  const guard = `ev_guard_${s.key}`;
  const condition = { kind: "eventSeesPlayer", eventId: guard, range: 5, ...(s.key === "dark" && process.env.NPC_SIGHT_NEW === "1" ? { darkness: { dark: 2 } } : {}) } as Condition;
  map.events.push({ id: guard, name: `경비 ${s.key}`, x: s.x, y: 23, trigger: { kind: "action" }, commands: [], pages: [page(`${guard}_p`, [{ kind: "text", speaker: "경비", body: "근무 중이다." }])] } as never);
  map.events.push({
    id: `ev_chest_${s.key}`, name: `상자 ${s.key}`, x: s.x, y: s.chestY, trigger: { kind: "action" }, commands: [],
    pages: [page(`ev_chest_${s.key}_p`, [{
      kind: "fork", condition,
      then: [{ kind: "text", speaker: "경비", body: "거기 손대지 마! 다 보인다." }],
      else: [{ kind: "changeGold", op: "+=", amount: 10 }, { kind: "text", body: "아무도 못 봤다. 은화 10 을 챙겼다." }],
    } as Command])],
  } as never);
}
process.stdout.write(serialize(project));
