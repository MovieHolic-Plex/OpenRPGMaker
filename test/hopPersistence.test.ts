// 체공(점프·낙하) 저작값의 저장 왕복.
//
// `shapeCommandFields` 는 커맨드를 다시 만들지 않고 제자리에서 검증만 하므로 낙관적으로는
// 무조건 통과할 것 같지만, 여기서 잠그는 건 그 구현이 아니라 **계약**이다: 보스 강림 높이를
// 편집창에서 128px 로 잡아 놓고 저장 후 다시 열었을 때 기본값으로 돌아가면 플레이테스트까지
// 가서야 알게 된다(에디터 화면에는 아무 오류도 안 뜬다).
//
// 두 저작면을 모두 본다 — `moveEvent` 커맨드 경로(commandBodyRoute)와 페이지 자율 이동
// 경로(moveRouteDialog).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import type { Command, EventPage, GameEvent, MoveCommand } from "@/project/types";

const AUTHORED_MOVES: readonly MoveCommand[] = [
  // 두 칸 건너뛰는 점프 + 높이·시간 저작. dx/dy 는 음수도 실려야 한다.
  { kind: "jump", dx: 2, dy: -1, heightPx: 48, durationMs: 1200 },
  // 보스 강림: 8칸(128px) 위에서 1.5 초 낙하.
  { kind: "dropIn", heightPx: 128, durationMs: 1500 },
  // 옵션을 생략한 형태도 그대로 남아야 한다(런타임 기본값을 따르는 저작 의도).
  { kind: "jump", dx: 0, dy: 0 },
  { kind: "dropIn" },
];

function projectWithHopRoute(): ReturnType<typeof createBlankProject> {
  const project = createBlankProject();
  const commands: Command[] = [
    { kind: "moveEvent", eventId: "ev_boss", route: { moves: [...AUTHORED_MOVES], repeat: false, wait: true } },
  ];
  const page: EventPage = {
    id: "page_hop_roundtrip",
    name: "체공 왕복 테스트 페이지",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    // 페이지 자율 이동 경로(사용자 정의)에도 같은 저작값을 싣는다.
    movement: { type: "custom", speed: 3, frequency: 3, route: { moves: [...AUTHORED_MOVES], repeat: true } },
    commands,
  };
  const event: GameEvent = {
    id: "ev_boss",
    characterId: "char_hop_roundtrip",
    x: 0,
    y: 0,
    trigger: { kind: "action" },
    commands,
    pages: [page],
  };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project has no start map");
  map.events = [...map.events, event];
  return project;
}

describe("체공 저작값 persistence", () => {
  it("BREAK: heightPx/durationMs/dx/dy 가 serialize→deserialize 를 그대로 통과한다", () => {
    // 프로젝트 전체 toEqual 은 쓰지 않는다 — 타일셋 지식의 `undefined` 필드가 JSON 왕복에서
    // 사라지는 무관한 비대칭이 있다. 여기서 볼 것은 경로 저작값이다.
    const restored = deserialize(serialize(projectWithHopRoute()));
    // 두 번째 왕복도 같은 값 — 첫 왕복에서 기본값이 채워져 굳는 경로가 없다는 뜻.
    const twice = deserialize(serialize(restored));

    for (const project of [restored, twice]) {
      const event = project.maps[project.startMapId]?.events.at(-1);
      const command = event?.pages?.[0]?.commands[0];
      if (command?.kind !== "moveEvent") throw new Error("moveEvent command missing after round trip");
      expect(command.route.moves).toEqual(AUTHORED_MOVES);
      expect(event?.pages?.[0]?.movement.route?.moves).toEqual(AUTHORED_MOVES);
    }
  });

  it("BREAK: 체공 옵션의 타입을 검증한다 — 문자열 높이는 조용히 통과하지 않는다", () => {
    const raw = JSON.parse(serialize(projectWithHopRoute())) as {
      maps: Record<string, { events: { pages: { commands: { route: { moves: Record<string, unknown>[] } }[] }[] }[] }>;
      startMapId: string;
    };
    const moves = raw.maps[raw.startMapId]?.events.at(-1)?.pages[0]?.commands[0]?.route.moves;
    if (!moves?.[1]) throw new Error("dropIn move missing in serialized payload");
    moves[1].heightPx = "128";
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/heightPx/);
  });
});
