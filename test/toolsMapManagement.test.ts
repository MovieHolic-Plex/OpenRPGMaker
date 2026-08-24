// 맵 관리·조회 툴 확장 계약(2026-07-05): get_event / set_map_properties / resize_map
// / remove_map(파괴적) / rename_variable.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

function ctxWithMap(width = 12, height = 12): { context: ToolContext; mapId: string } {
  const context: ToolContext = { project: createBlankProject() };
  const created = runTool(context, "create_map", { name: "관리 테스트", width, height, id: "map_mgmt" });
  expect(created.ok, created.summary).toBe(true);
  return { context, mapId: "map_mgmt" };
}

describe("get_event", () => {
  it("이벤트 전체 정의를 돌려주고, 없으면 보유 목록을 안내한다", () => {
    const { context, mapId } = ctxWithMap();
    expect(runTool(context, "place_npc", { mapId, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_npc" }).ok).toBe(true);
    const result = runTool(context, "get_event", { mapId, eventId: "ev_npc" });
    expect(result.ok, result.summary).toBe(true);
    const event = (result.data as { event: { id: string; pages: unknown[] } }).event;
    expect(event.id).toBe("ev_npc");
    expect(event.pages.length).toBeGreaterThan(0);
    const missing = runTool(context, "get_event", { mapId, eventId: "ghost" });
    expect(missing.ok).toBe(false);
    expect(missing.summary).toContain("ev_npc");
  });

  it("place_npc가 런타임 지원 제한 페이지 명령 warning을 ToolResult.issues에 담는다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "place_npc", {
      mapId,
      x: 3,
      y: 3,
      name: "기록자",
      pages: [{ lines: ["메모를 남긴다."], commands: [{ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "메모" } }] }],
      id: "ev_comment_npc",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.issues?.some((issue) => issue.severity === "warning" && issue.code === "runtime-support:m2-088-comment")).toBe(true);
  });

  it("upsert_event가 런타임 지원 제한 페이지 명령 warning과 요약 count를 담는다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "upsert_event", {
      mapId,
      event: {
        id: "ev_comment_direct",
        x: 4,
        y: 4,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "본문",
            conditions: [],
            graphic: { transparent: true },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            trigger: { kind: "action" },
            commands: [{ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "메모" } }],
          },
        ],
      },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("미지원 커맨드 1건");
    expect(result.data).toMatchObject({ unsupportedCommands: 1 });
    expect(result.issues?.some((issue) => issue.severity === "warning" && issue.code === "runtime-support:m2-088-comment")).toBe(true);
  });

  it("upsert_event pages[].commands 단수 객체 입력은 배열로 승격하고 warning을 남긴다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "upsert_event", {
      mapId,
      event: {
        id: "ev_single_command",
        x: 4,
        y: 4,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "본문",
            conditions: [],
            graphic: { transparent: true },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            trigger: { kind: "action" },
            commands: { kind: "text", body: "단수 커맨드" },
          },
        ],
      },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings.join("\n")).toContain("ev_single_command.p1.commands 단일 커맨드 객체를 Command[] 배열로 감쌌습니다");
    const event = context.project.maps[mapId].events.find((entry) => entry.id === "ev_single_command");
    expect(event?.pages?.[0]?.commands).toEqual([{ kind: "text", body: "단수 커맨드" }]);
  });

  it("upsert_event 부분 수정은 기존 NPC의 대사·그래픽·위치를 보존한다", () => {
    const { context, mapId } = ctxWithMap();
    const created = runTool(context, "make_villager", {
      mapId,
      id: "ev_guard_luke",
      characterId: "luke_guard",
      name: "경비병 루크",
      home: { x: 3, y: 4 },
      dialogue: [{ text: "북문은 제가 지키겠습니다." }],
    });
    expect(created.ok, created.summary).toBe(true);
    const originalPageCount = context.project.maps[mapId].events.find((entry) => entry.id === "ev_guard_luke")?.pages?.length;

    // Regression: a schedule-only AI patch used to replace the entire GameEvent,
    // deleting pages, graphic and characterId.
    const patched = runTool(context, "upsert_event", {
      mapId,
      event: {
        id: "ev_guard_luke",
        schedule: [
          { when: { hourRange: [6, 18] }, at: { mapId, x: 7, y: 4 }, activity: "patrol" },
        ],
      },
    });

    expect(patched.ok, patched.summary).toBe(true);
    const event = context.project.maps[mapId].events.find((entry) => entry.id === "ev_guard_luke");
    expect(event).toMatchObject({ x: 3, y: 4, characterId: "luke_guard" });
    expect(event?.pages).toHaveLength(originalPageCount);
    expect(JSON.stringify(event?.pages)).toContain("북문은 제가 지키겠습니다.");
    expect(event?.pages?.[0]?.graphic).toBeDefined();
    expect(event?.schedule).toHaveLength(1);
  });

  it("upsert_event 후속 수정은 place_chest의 50G 보상 페이지를 보존한다", () => {
    const { context, mapId } = ctxWithMap();
    const created = runTool(context, "place_chest", {
      mapId,
      id: "ev_south_chest",
      x: 6,
      y: 8,
      contents: { gold: 50 },
    });
    expect(created.ok, created.summary).toBe(true);

    // Regression: a later low-level edit used to turn this into a hollow event.
    const patched = runTool(context, "upsert_event", {
      mapId,
      event: { id: "ev_south_chest", trigger: { kind: "action" }, commands: [] },
    });

    expect(patched.ok, patched.summary).toBe(true);
    const event = context.project.maps[mapId].events.find((entry) => entry.id === "ev_south_chest");
    expect(event).toMatchObject({ x: 6, y: 8 });
    expect(event?.pages).toHaveLength(2);
    expect(event?.pages?.[0]?.commands).toContainEqual({ kind: "changeGold", op: "+=", amount: 50 });
    expect(event?.pages?.[0]?.commands).toContainEqual({ kind: "setSelfSwitch", key: "A", value: true });
  });

  it("upsert_event commands kind 오류는 인덱스와 기대 형식을 invalid-args에 담는다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "upsert_event", {
      mapId,
      event: {
        id: "ev_bad_kind",
        x: 4,
        y: 4,
        trigger: { kind: "action" },
        commands: [
          { kind: { command: "text" }, body: "객체 kind" },
          { body: "kind 없음" },
        ],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    const message = result.issues?.[0]?.message ?? "";
    expect(message).toContain("ev_bad_kind.commands[0].kind");
    expect(message).toContain("ev_bad_kind.commands[1].kind");
    expect(message).toContain("기대 형식 string");
    expect(message).toContain("커맨드 kind는 문자열");
    expect(message).toContain("올바른 1커맨드 예시 JSON");
    expect(context.project.maps[mapId].events.some((event) => event.id === "ev_bad_kind")).toBe(false);
  });

  it("upsert_event 인자 누락은 NPC 배치용 place_npc 힌트를 돌려준다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "upsert_event", { mapId });

    expect(result.ok).toBe(false);
    expect(result.summary).toBe("'upsert_event' 인자 검증 실패");
    expect(result.issues?.[0]?.message).toContain("필수 인자 누락: event");
    expect(result.issues?.[0]?.message).toContain("NPC 배치가 목적이면 place_npc {mapId,x,y,name,pages}를 사용하세요");
  });
});

describe("set_map_properties", () => {
  it("이름/인카운트율/트룹을 설정하고, 없는 트룹은 거부한다", () => {
    const { context, mapId } = ctxWithMap();
    const troopId = context.project.database.troops[0]?.id;
    expect(troopId).toBeDefined();
    const result = runTool(context, "set_map_properties", { mapId, name: "안개 골짜기", encounterRate: 3, troopIds: [troopId] });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    expect(map.name).toBe("안개 골짜기");
    expect(map.encounterRate).toBe(3);
    expect(map.troopIds).toEqual([troopId]);
    expect(runTool(context, "set_map_properties", { mapId, troopIds: ["troop_ghost"] }).ok).toBe(false);
  });
});

describe("resize_map", () => {
  it("확장부는 잔디로 채우고 기존 타일은 보존한다", () => {
    const { context, mapId } = ctxWithMap(8, 8);
    runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.WATER, cells: [{ x: 2, y: 2 }] });
    const result = runTool(context, "resize_map", { mapId, width: 14, height: 10 });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    expect(map.width).toBe(14);
    expect(map.lowerTiles[2 * 14 + 2]).toBe(TILE.WATER); // 기존 타일 보존.
    expect(map.lowerTiles[5 * 14 + 12]).toBe(TILE.GRASS); // 확장부 잔디.
  });

  it("축소로 이벤트가 밖에 나가면 거부한다", () => {
    const { context, mapId } = ctxWithMap(12, 12);
    expect(runTool(context, "place_npc", { mapId, x: 9, y: 9, name: "구석 주민", pages: [{ lines: ["!"] }], id: "ev_corner" }).ok).toBe(true);
    const result = runTool(context, "resize_map", { mapId, width: 6, height: 6 });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("ev_corner");
  });

  it("256x256 초과 확장은 거부하고 분할 맵 대안을 안내한다", () => {
    const { context, mapId } = ctxWithMap(12, 12);
    const result = runTool(context, "resize_map", { mapId, width: 257, height: 12 });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("최대 256×256");
    expect(result.summary).toContain("여러 맵");
  });
});

describe("create_map", () => {
  it("기본 생성은 돌벽 테두리 없이 잔디 평지로 만든다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "create_map", { name: "평지", width: 5, height: 4, id: "map_plain" });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.map_plain;
    expect(map.lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
  });

  it("border:'wall'을 지정하면 기존처럼 외곽을 돌벽으로 두른다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "create_map", { name: "벽 평지", width: 5, height: 4, id: "map_walled", border: "wall" });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.map_walled;
    for (let x = 0; x < map.width; x += 1) {
      expect(map.lowerTiles[x]).toBe(TILE.WALL);
      expect(map.lowerTiles[(map.height - 1) * map.width + x]).toBe(TILE.WALL);
    }
    for (let y = 0; y < map.height; y += 1) {
      expect(map.lowerTiles[y * map.width]).toBe(TILE.WALL);
      expect(map.lowerTiles[y * map.width + map.width - 1]).toBe(TILE.WALL);
    }
    expect(map.lowerTiles[1 * map.width + 1]).toBe(TILE.GRASS);
  });

  it("256x256 초과 생성은 거부한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "create_map", { name: "초대형", width: 500, height: 500, id: "map_huge" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("최대 256×256");
    expect(context.project.maps.map_huge).toBeUndefined();
  });
});

describe("remove_map", () => {
  it("일반 맵은 삭제되고 맵 트리에서도 사라진다", () => {
    const { context } = ctxWithMap();
    runTool(context, "create_map", { name: "지울 맵", width: 6, height: 6, id: "map_doomed" });
    const result = runTool(context, "remove_map", { mapId: "map_doomed" });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps.map_doomed).toBeUndefined();
    expect(JSON.stringify(context.project.mapTree)).not.toContain("map_doomed");
  });

  it("시작 맵은 삭제를 거부한다", () => {
    const { context } = ctxWithMap();
    const startMapId = context.project.startMapId;
    const result = runTool(context, "remove_map", { mapId: startMapId });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("시작 맵");
  });
});

describe("rename_variable", () => {
  it("정의·세션·커맨드·조건의 변수 참조를 일괄 치환한다", () => {
    const { context, mapId } = ctxWithMap();
    const oldId = context.project.variables[0].id;
    context.project.variables[0].name = "용사 명성";
    // setVariable + fork 변수 조건 + 피연산자 참조를 가진 이벤트.
    expect(
      runTool(context, "upsert_event", {
        mapId,
        event: {
          id: "ev_var",
          x: 4,
          y: 4,
          pages: [
            {
              id: "p1",
              name: "본문",
              conditions: [],
              graphic: {},
              priority: "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
              trigger: { kind: "action" },
              commands: [
                { kind: "setVariable", variableId: oldId, op: "+=", value: { kind: "var", id: oldId } },
                { kind: "fork", condition: { kind: "variable", variableId: oldId, op: ">=", value: 5 }, then: [], else: [] },
              ],
            },
          ],
        },
      }).ok
    ).toBe(true);
    const result = runTool(context, "rename_variable", { fromName: "용사 명성", to: "var_fame" });
    expect(result.ok, result.summary).toBe(true);
    const replaced = (result.data as { replaced: number }).replaced;
    expect(replaced).toBeGreaterThanOrEqual(4); // 정의+세션+setVariable+피연산자+조건.
    const page = context.project.maps[mapId].events.find((event) => event.id === "ev_var")?.pages?.[0];
    const json = JSON.stringify(page);
    expect(json).toContain("var_fame");
    expect(json).not.toContain(`"${oldId}"`);
  });
});
