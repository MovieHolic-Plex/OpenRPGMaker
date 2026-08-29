// test/approvalDestructiveOutcome.test.ts
// 결과 기반 파괴성 판정 — 2026-08-29 modify 진단 근본원인 9 회귀 가드.
//
// 옛 판정은 툴 **이름 목록**뿐이라, 승인 마찰이 정직한 수정에만 걸렸다:
//   "지우고 제대로 다시 놓는다"(remove_event 포함) → 체크박스 재승인 벽
//   "새 맵을 만들어 거기 짓는다"(기존 맵을 통째로 교체) → 마찰 0으로 즉시 적용

import { describe, expect, it } from "vitest";
import { isDestructiveOutcome } from "@/ai/approvalPolicy";
import type { ChangeSummary } from "@/project/types";

function diff(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function call(name: string, overrides: Partial<ProposedCall> = {}): ProposedCall {
  return {
    name,
    args: {},
    summary: `${name} summary`,
    result: { ok: true, summary: `${name} summary` },
    destructive: false,
    ...overrides,
  };
}

describe("isDestructiveOutcome", () => {
  it("이름 목록은 종전대로 파괴로 본다", () => {
    for (const name of ["remove_event", "remove_map", "clear_region", "reset_project", "delete_resource", "delete_database_record"]) {
      expect(isDestructiveOutcome(name, {}, diff()), name).toBe(true);
    }
  });

  it("이름이 무해해도 diff 가 소실을 보고하면 파괴다", () => {
    expect(isDestructiveOutcome("run_interior_room_pipeline", {}, diff({ eventsRemoved: 3 }))).toBe(true);
    expect(isDestructiveOutcome("author_village", {}, diff({ mapsRemoved: 1 }))).toBe(true);
  });

  it("replaceExisting 옵트인은 diff 없이도 파괴다", () => {
    expect(isDestructiveOutcome("start_interior_room_session", { replaceExisting: true }, undefined)).toBe(true);
    // 플래그가 꺼져 있거나 없으면 판정에 영향이 없다.
    expect(isDestructiveOutcome("start_interior_room_session", { replaceExisting: false }, diff())).toBe(false);
    expect(isDestructiveOutcome("start_interior_room_session", {}, diff())).toBe(false);
  });

  it("추가만 하는 변경은 파괴가 아니다", () => {
    expect(isDestructiveOutcome("paint_tiles", {}, diff({ tilesChanged: 400 }))).toBe(false);
    expect(isDestructiveOutcome("place_npc", {}, diff({ eventsAdded: 2 }))).toBe(false);
    expect(isDestructiveOutcome("create_map", {}, diff({ mapsAdded: 1 }))).toBe(false);
  });

  it("diff 가 없으면(조회 툴 등) 파괴가 아니다", () => {
    expect(isDestructiveOutcome("get_map_region", {}, undefined)).toBe(false);
  });
});

// classifyApproval 블록은 지웠다 — main 에는 승인 게이트가 없다(감독 지시 2026-08-28로
// 폐기, `approvalPolicy.ts` 머리말 참조). 적용은 즉시 반영되고 복구는 되돌리기다. 결과 기반
// 파괴성 판정 자체는 위 블록이 지키고, 그 값은 변경 카드의 파괴 라벨과 경고에 쓰인다.
