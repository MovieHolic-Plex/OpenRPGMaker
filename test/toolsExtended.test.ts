// 챗봇 툴 확장(2026-07-04): upsert_skill/equipment/class/state/common_event
// + get_database_records + set_tile_passability.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

describe("DB upsert 확장 툴", () => {
  it("upsert_skill이 스킬을 추가한다", () => {
    const context = ctx();
    const result = runTool(context, "upsert_skill", { skill: { id: "skill_fire", name: "파이어", power: 30 } });
    expect(result.ok, result.summary).toBe(true);
    const record = context.project.database.skills.find((entry) => entry.id === "skill_fire");
    expect(record?.name).toBe("파이어");
    expect(record?.power).toBe(30);
  });

  it("upsert_equipment이 장비를 추가한다", () => {
    const context = ctx();
    const result = runTool(context, "upsert_equipment", { equipment: { id: "eq_sword", name: "청동검", slot: "weapon", price: 120 } });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.database.equipment.some((entry) => entry.id === "eq_sword")).toBe(true);
  });

  it("upsert_class가 클래스를 추가한다", () => {
    const context = ctx();
    const result = runTool(context, "upsert_class", { class: { id: "class_mage", name: "마법사" } });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.database.classes.some((entry) => entry.id === "class_mage")).toBe(true);
  });

  it("upsert_state가 상태를 추가하고 같은 id로 수정한다", () => {
    const context = ctx();
    expect(runTool(context, "upsert_state", { state: { id: "state_burn", name: "화상" } }).ok).toBe(true);
    const modified = runTool(context, "upsert_state", { state: { id: "state_burn", name: "화상", priority: 5 } });
    expect(modified.ok).toBe(true);
    const records = context.project.database.states.filter((entry) => entry.id === "state_burn");
    expect(records).toHaveLength(1);
    expect(records[0].priority).toBe(5);
  });

  it("upsert_common_event가 커먼 이벤트를 추가한다", () => {
    const context = ctx();
    const result = runTool(context, "upsert_common_event", {
      id: "ce_greet",
      name: "인사",
      trigger: "none",
      commands: [{ kind: "text", body: "안녕하세요" }],
    });
    expect(result.ok, result.summary).toBe(true);
    const record = context.project.commonEvents.find((entry) => entry.id === "ce_greet");
    expect(record?.trigger).toBe("none");
    expect(record?.commands).toHaveLength(1);
  });

  it("upsert_common_event는 잘못된 커맨드를 거부한다", () => {
    const context = ctx();
    const result = runTool(context, "upsert_common_event", {
      id: "ce_bad",
      name: "불량",
      commands: [{ notACommand: true }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("get_database_records", () => {
  it("컬렉션별 id/name 목록을 반환한다", () => {
    const context = ctx();
    for (const collection of ["items", "actors", "switches", "maps", "commonEvents"]) {
      const result = runTool(context, "get_database_records", { collection });
      expect(result.ok, `${collection}: ${result.summary}`).toBe(true);
      const records = (result.data as { records: { id: string; name: string }[] }).records;
      expect(Array.isArray(records)).toBe(true);
    }
  });

  it("maps 컬렉션은 실제 맵 id를 담는다", () => {
    const context = ctx();
    const result = runTool(context, "get_database_records", { collection: "maps" });
    const records = (result.data as { records: { id: string }[] }).records;
    expect(records.some((entry) => entry.id === context.project.startMapId)).toBe(true);
  });

  it("알 수 없는 컬렉션은 실패한다", () => {
    expect(runTool(ctx(), "get_database_records", { collection: "nope" }).ok).toBe(false);
  });
});

describe("set_tile_passability", () => {
  it("타일 통행성을 4방향 일괄 변경한다", () => {
    const context = ctx();
    // 342(FLOOR)는 겉보기와 달리 통행 불가로 검증된 함정 타일 — 통행 가능으로 바꿔 본다.
    const result = runTool(context, "set_tile_passability", { tile: 342, passable: true });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[context.project.startMapId];
    const flags = context.project.tilesets[map.tilesetId].passability[342];
    expect(flags).toEqual({ up: true, down: true, left: true, right: true });
  });

  it("범위 밖 타일 인덱스는 실패한다", () => {
    const result = runTool(ctx(), "set_tile_passability", { tile: 99999, passable: false });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("범위 밖");
  });
});
