// 명령 팔레트(44 버튼) 전체가 저장 왕복을 통과하는지 본다.
//
// 왜 필요한가: 저작면은 버튼을 눌러 커맨드를 만들지만, 그 커맨드가 스키마 검증을 통과하는지는
// 저장 시점에야 드러난다. 하나라도 통과하지 못하면 `deserialize` 가 던지고 — 편집창에는 아무
// 오류도 안 뜨는 채로 — 그 이벤트가 프로젝트에서 사라진다. 그래서 팔레트에 새 원시 명령을
// 추가할 때 여기가 먼저 빨개져야 한다.
import { describe, expect, it } from "vitest";
import {
  MOVE_ROUTE_COMMAND_ROWS,
  defaultRouteSoundId,
  type MoveRouteCommandContext,
} from "@/editor/panels/eventEditor/moveRouteCommandCatalog";
import { createBlankProject } from "@/project/defaults";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { deserialize, serialize } from "@/project/io/serialize";
import type { EventPage, GameEvent, MoveCommand, Project } from "@/project/types";

/**
 * "이 단계 값" 패널이 채워진 상태. 비워 두면 `createCommand` 가 `null` 을 반환하는 버튼이
 * 4 개(스위치 ON/OFF · 모습 변경 · 효과음 재생) 있어 팔레트 전체를 볼 수 없다.
 * 참조 실재 여부는 `serialize`/`deserialize` 가 보지 않는다(형태 검증만) — 그래서 임의 id 로 충분하다.
 */
function filledContext(project: Project): MoveRouteCommandContext {
  return {
    switchId: "sw_catalog_sweep",
    spriteId: "tex_easyrpg_charset_people1",
    soundId: "se_cursor",
    npcTargetMapId: project.startMapId,
    npcTargetX: 0,
    npcTargetY: 0,
    npcTargetDirection: "down",
    hopDx: 0,
    hopDy: 0,
    hopHeightPx: 0,
    hopDurationMs: 0,
  };
}

function projectWithRoute(moves: readonly MoveCommand[]): Project {
  const project = createBlankProject();
  const page: EventPage = {
    id: "page_catalog_sweep",
    name: "팔레트 왕복 테스트 페이지",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "custom", speed: 3, frequency: 3, route: { moves: [...moves], repeat: false } },
    commands: [],
  };
  const event: GameEvent = {
    id: "ev_catalog_sweep",
    characterId: "char_catalog_sweep",
    x: 0,
    y: 0,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project has no start map");
  map.events = [...map.events, event];
  return project;
}

function catalogCommands(project: Project): readonly { readonly testId: string; readonly command: MoveCommand }[] {
  const context = filledContext(project);
  return MOVE_ROUTE_COMMAND_ROWS.flat().flatMap((button) => {
    const command = button.createCommand(context);
    return command === null ? [] : [{ testId: button.testId, command }];
  });
}

describe("이동 경로 팔레트 persistence", () => {
  it("BREAK: 「효과음 재생」 기본값이 실재하는 리소스다 — 없는 id 면 이벤트 저장이 통째로 막힌다", () => {
    // 예전 기본값은 `"se_route_chime"` 이었다. 어느 카탈로그에도 없는 문자열이라, 효과음 칸을
    // 손대지 않고 버튼만 누른 사용자는 「적용」에서 "오류 1개" 토스트만 보고 이벤트를 잃었다.
    // 여기서 보는 집합은 편집기 검증기(`eventDraftValidator`)가 참조 실재를 판정할 때 쓰는 것과 같다.
    expect(collectResourceIds(createBlankProject()).has(defaultRouteSoundId())).toBe(true);
  });

  it("BREAK: 팔레트의 모든 명령이 하나씩 serialize→deserialize 를 통과한다", () => {
    const built = catalogCommands(createBlankProject());
    // 한 번에 다 넣으면 어느 버튼이 범인인지 모른다 — 하나씩 돌려서 testId 를 이름에 싣는다.
    const broken: string[] = [];
    for (const { testId, command } of built) {
      try {
        const restored = deserialize(serialize(projectWithRoute([command])));
        const moves = restored.maps[restored.startMapId]?.events.at(-1)?.pages?.[0]?.movement.route?.moves;
        expect(moves).toEqual([command]);
      } catch (error) {
        broken.push(`${testId}: ${String(error).slice(0, 160)}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("BREAK: 팔레트를 통째로 담은 경로도 왕복한다 — 44 개를 한 이벤트에 다 넣는 e2e 스윕과 같은 모양", () => {
    const built = catalogCommands(createBlankProject());
    // 팔레트가 줄어들면(버튼 삭제) 여기서 눈에 띄게 한다.
    expect(built.length).toBeGreaterThanOrEqual(44);
    const moves = built.map((entry) => entry.command);
    const restored = deserialize(serialize(projectWithRoute(moves)));
    expect(restored.maps[restored.startMapId]?.events.at(-1)?.pages?.[0]?.movement.route?.moves).toEqual(moves);
  });
});
