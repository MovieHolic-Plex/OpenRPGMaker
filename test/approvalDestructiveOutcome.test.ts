// test/approvalDestructiveOutcome.test.ts
// 결과 기반 파괴성 판정 — 2026-08-29 modify 진단 근본원인 9 회귀 가드.
//
// 옛 판정은 툴 **이름 목록**뿐이라, 승인 마찰이 정직한 수정에만 걸렸다:
//   "지우고 제대로 다시 놓는다"(remove_event 포함) → 체크박스 재승인 벽
//   "새 맵을 만들어 거기 짓는다"(기존 맵을 통째로 교체) → 마찰 0으로 즉시 적용

import { describe, expect, it } from "vitest";
import { classifyApproval, isDestructiveOutcome } from "@/ai/approvalPolicy";
import type { ProposedCall } from "@/ai/assistantSession";
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

describe("classifyApproval — 결과 기반 파괴성이 승인 경로에 반영된다", () => {
  it("기존 맵을 교체한 호출은 이름이 생성계여도 재승인 벽에 걸린다", () => {
    const verdict = classifyApproval(
      [call("run_interior_room_pipeline", { destructive: isDestructiveOutcome("run_interior_room_pipeline", {}, diff({ eventsRemoved: 5 })) })],
      { autoApproveEnabled: true },
    );
    expect(verdict.decision).toBe("require_approval");
    expect(verdict.requiresUserConfirm).toBe(true);
    expect(verdict.reason).toContain("기존 맵 교체");
  });

  it("소실 없는 수정 제안은 자동 승인을 유지한다", () => {
    const calls = [
      call("tile_erase", { destructive: isDestructiveOutcome("tile_erase", {}, diff({ tilesChanged: 12 })) }),
      call("paint_tiles", { destructive: isDestructiveOutcome("paint_tiles", {}, diff({ tilesChanged: 12 })) }),
    ];
    expect(classifyApproval(calls, { autoApproveEnabled: true }).decision).toBe("auto");
  });
});
