import { describe, expect, it } from "vitest";
import { MAP_CREATING_TOOLS, createdMapIdFrom, verifyTargetMapChanged } from "@/ai/workItemOutcome";

describe("대상 맵 변경 게이트", () => {
  it("대상 맵이 없으면 검사하지 않는다", () => {
    expect(verifyTargetMapChanged(undefined, [], ["map_new"]).ok).toBe(true);
  });

  it("대상 맵이 바뀌었으면 통과", () => {
    expect(verifyTargetMapChanged("map_town", ["map_town"], ["map_new"]).ok).toBe(true);
  });

  it("대상 맵이 안 바뀌었고 새 맵도 없으면 통과(DB·퀘스트 항목 오탐 방지)", () => {
    expect(verifyTargetMapChanged("map_town", [], []).ok).toBe(true);
  });

  it("대상 맵은 그대로인데 새 맵만 생겼으면 막는다", () => {
    const verdict = verifyTargetMapChanged("map_town", [], ["map_new_room"]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("map_town");
    expect(verdict.reason).toContain("map_new_room");
    expect(verdict.reason).toContain("skip_work_item");
  });

  it("대상 맵 자신을 만든 것은 대체가 아니다", () => {
    expect(verifyTargetMapChanged("map_town", [], ["map_town"]).ok).toBe(true);
  });
});

describe("맵 생성 툴 추적", () => {
  // 방 하네스 세션 시작은 이름만 세션이고 실제로 맵을 등록한다 — 추적에서 빠지면
  // "대상 맵은 그대로인데 새 실내 맵이 생겼다"는 정확히 그 패턴을 게이트가 못 본다.
  it.each([
    "start_interior_room_session",
    "start_dungeon_room_session",
    "run_dungeon_room_pipeline",
    "run_interior_room_pipeline",
    "create_map",
    "duplicate_map",
  ])("맵 생성 툴로 센다: %s", (name) => {
    expect(MAP_CREATING_TOOLS.has(name)).toBe(true);
  });

  it("data.mapId 를 우선하고 args.mapId 로 폴백한다", () => {
    expect(createdMapIdFrom("start_interior_room_session", { mapId: "map_a" }, { mapId: "map_b" })).toBe("map_b");
    expect(createdMapIdFrom("start_interior_room_session", { mapId: "map_a" }, {})).toBe("map_a");
    expect(createdMapIdFrom("paint_tiles", { mapId: "map_a" }, {})).toBeNull();
  });
});
