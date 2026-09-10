// 구역 드나듦 트리거의 **최소 엔진 계약 픽스처**. 출하 데모 콘텐츠가 아니고 원격에 저장하지 않는다
// (AGENTS.md 하드 룰의 좁은 예외: 순수 엔진 변경 + 단위/계약용 최소 픽스처).
//
// Run: npx vite-node --script scripts/qa/runtime/loc-transition-fixture.mts --out /tmp/loc-transition.json
// 또는 npx tsx scripts/qa/runtime/loc-transition-fixture.mts > /tmp/loc-transition.json
//
// 기하 (map_blank_start, 20×15, 시작 (10,8)):
//
//        x=10  11   12  13  14  15  16   17
//   y=8   시작  ·  ┌────────────────┐  ·        ← 광장 loc1 = (12,6) 5×5 → x 12..16, y 6..10
//   y=10   문        └────────────────┘
//
//   · 시작 (10,8) 은 광장 **밖**이다 — 부팅만으로 enter 가 나지 않는 것을 먼저 본다.
//   · 오른쪽으로 두 칸 걸으면 (12,8) 에서 광장 enter 가 난다.
//   · 다시 왼쪽으로 두 칸이면 (11,8) 에서 광장 leave 가 난다.
//   · (10,10) 의 문(playerTouch)은 **같은 맵 안** (14,8) 로 장소 이동한다 —
//     중간 걸음 없이 광장 안에 떨어지므로 순간이동 enter 가 난다.
//
// 이벤트 셋은 셀프 스위치로 «한 번만» 을 만들지 않는다. 재진입이 다시 발동하는 것도
// 계약이므로 매번 대사를 띄우고, 시나리오가 대사 글자로 어느 사건이 났는지 구분한다.
import { createBlankProject } from "../../../src/project/defaults";
import { deserialize, serialize } from "../../../src/project/io";
import { addMapLocation } from "../../../src/project/mapNamedLocations";
import type { Command, EventPage, Trigger } from "../../../src/project/types";

const project = createBlankProject();
project.meta.title = "구역 드나듦 계약";
project.startPos = { x: 10, y: 8 };
if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";

const map = project.maps[project.startMapId]!;
const plaza = addMapLocation(map, { name: "정문 광장", x: 12, y: 6, w: 5, h: 5 });
if (!plaza.ok) throw new Error(`픽스처 로케이션 생성 실패: ${plaza.error}`);
const plazaId = plaza.location.id;

/** 구역 트리거 이벤트. 그림 없이 아래 층에 둬 통행과 조사 발동을 방해하지 않는다. */
function zoneEvent(id: string, x: number, y: number, transition: "enter" | "leave", body: string) {
  const trigger: Trigger = { kind: "locationTransition", locationId: plazaId, transition };
  const commands: Command[] = [{ kind: "text", body }];
  const page: EventPage = {
    id: `${id}_p1`,
    name: transition === "enter" ? "구역 진입" : "구역 이탈",
    conditions: [],
    graphic: { transparent: true },
    trigger,
    priority: "below",
    overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "action" } as Trigger, commands: [], pages: [page] };
}

const doorCommands: Command[] = [
  // 같은 맵 안 (14,8) — 광장 한가운데. 중간 걸음이 없다.
  { kind: "transfer", mapId: map.id, x: 14, y: 8, fade: "none" },
];

map.events = [
  // 본문은 평범한 저작 문장이다(제어문자 없음). 시나리오가 타자기 진행을 기다리는 대신
  // 결정 키 한 번으로 페이지를 완성시킨다(`consumeRemainingPage` — RM 관례이고 출하 입력 경로다).
  zoneEvent("ev_plaza_enter", 1, 1, "enter", "광장에 들어섰다."),
  zoneEvent("ev_plaza_leave", 2, 1, "leave", "광장을 나섰다."),
  {
    id: "ev_plaza_door",
    x: 10,
    y: 10,
    trigger: { kind: "playerTouch" },
    commands: doorCommands,
    pages: [{
      id: "ev_plaza_door_p1",
      name: "광장으로 순간이동",
      conditions: [],
      graphic: { transparent: true },
      trigger: { kind: "playerTouch" },
      priority: "below",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: doorCommands,
    }],
  },
];

const json = serialize(project);
// 브라우저 부팅 타임아웃이 아니라 픽스처 생성 시점에 실패하게 한다.
deserialize(json);
process.stdout.write(json);
