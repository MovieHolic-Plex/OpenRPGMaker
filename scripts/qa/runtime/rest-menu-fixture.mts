// ESC 「쉬기」 + 시간대 필드 스폰 QA 픽스처. stdout = 프로젝트 JSON.
//   시간 시스템 켬(아침 6시 시작), restMenu 켬. 시작 칸 둘레에 「밤에만」 나오는 필드 스폰 하나(추격 없음).
//   쉬기 → 자정: 밤이 되어 무리가 나온다. 쉬기 → 아침: 무리가 사라진다.
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/rest-menu-fixture.mts > /tmp/hs/rest-menu.json
import { serialize } from "../../../src/project/io";
import type { Project } from "../../../src/project/types";

const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
const project: Project = await createProjectStartSeed("adventure-jrpg" as never, "쉬기", "example", "wide");
project.system.playResolution = { width: 480, height: 270 };
delete (project.system as { cameraZoom?: number }).cameraZoom;
project.system.timeSystem = { enabled: true, minutesPerRealSecond: 1, dayStartHour: 6, dayEndHour: 26, restMenu: { enabled: true } };
delete (project.meta as { oprnFieldMenu?: unknown }).oprnFieldMenu;

const map = project.maps[project.startMapId];
const troop = project.database.troops[0];
if (!troop) throw new Error("seed has no troop");
map.encounterRate = 0;
const { x, y } = project.startPos;
const area = { x: Math.max(0, x - 5), y: Math.max(0, y - 3), w: 11, h: 7 };
area.w = Math.min(area.w, map.width - area.x);
area.h = Math.min(area.h, map.height - area.y);
map.fieldSpawns = [{ id: "night_pack", troopId: troop.id, area, maxAlive: 4, respawnSec: 5, chase: false, timePhases: ["night"] }];
process.stdout.write(serialize(project));
