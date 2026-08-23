import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import type { EventPage } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

function runPlaceNpc(id: string, page: Record<string, unknown>): { context: ToolContext; result: ToolResult; page: EventPage | undefined } {
  const context: ToolContext = { project: createBlankProject() };
  const result = runTool(context, "place_npc", {
    mapId: context.project.startMapId,
    x: 2,
    y: 2,
    id,
    name: "리나",
    graphic: { transparent: true },
    pages: [page],
  });
  const map = context.project.maps[context.project.startMapId];
  const event = map?.events.find((entry) => entry.id === id);
  return { context, result, page: event?.pages?.[0] };
}

function firstIssueMessage(result: ToolResult): string {
  return result.issues?.[0]?.message ?? "";
}

describe("place_npc SimplePage malformed input normalization", () => {
  it("normalizes a missing command kind from the command alias", () => {
    const { result, page } = runPlaceNpc("npc_kind_alias", {
      commands: [{ command: "text", body: "어서 와." }],
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("SimplePage 정규화 경고");
    expect(result.diff?.warnings.join("\n")).toContain("pages[0].commands[0].command 문자열을 kind로 사용");
    expect(page?.commands).toContainEqual({ kind: "text", body: "어서 와." });
  });

  it("normalizes an object command kind from kind.command", () => {
    const { result, page } = runPlaceNpc("npc_kind_object_alias", {
      commands: [{ kind: { command: "text" }, body: "오늘은 장터가 조용해." }],
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("SimplePage 정규화 경고");
    expect(result.diff?.warnings.join("\n")).toContain("pages[0].commands[0].kind.command 문자열을 kind로 사용");
    expect(page?.commands).toContainEqual({ kind: "text", body: "오늘은 장터가 조용해." });
  });

  it("wraps a single conditions object into an array", () => {
    const { result, page } = runPlaceNpc("npc_single_condition", {
      conditions: { kind: "selfSwitch", key: "A", value: true },
      lines: ["비밀을 지켜줘."],
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("SimplePage 정규화 경고");
    expect(result.diff?.warnings.join("\n")).toContain("pages[0].conditions 단수 객체를 배열로 감쌌습니다");
    expect(page?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
  });

  it("normalizes null conditions to an empty array", () => {
    const { result, page } = runPlaceNpc("npc_null_condition", {
      conditions: null,
      lines: ["조건 없는 페이지야."],
    });

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("SimplePage 정규화 경고");
    expect(result.diff?.warnings.join("\n")).toContain("pages[0].conditions null을 빈 배열로 처리했습니다");
    expect(page?.conditions).toEqual([]);
  });
  it("normalizes empty object conditions {} to an empty array", () => {
    const { result, page } = runPlaceNpc("npc_empty_object_condition", {
      conditions: {},
      lines: ["조건 없음."],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(page?.conditions).toEqual([]);
    expect(result.diff?.warnings.join("\n") ?? "").toMatch(/빈\/없음 조건|정규화/);
  });

  it("normalizes conditions kind none to an empty array", () => {
    const { result, page } = runPlaceNpc("npc_kind_none_condition", {
      conditions: { kind: "none" },
      commands: [{ kind: "text", text: "크르르...!" }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(page?.conditions).toEqual([]);
  });

  it("normalizes LLM self-switch id aliases and boolean strings in conditions and choice commands", () => {
    const { result, page } = runPlaceNpc("npc_self_switch_aliases", {
      conditions: [{ kind: "selfSwitch", id: "A", value: "true" }],
      choices: [{
        text: "선택",
        commands: [{ kind: "setSelfSwitch", id: "A", value: "true" }],
      }],
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(page?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
    const choices = page?.commands.find((command) => command.kind === "choices");
    expect(choices).toMatchObject({
      options: [{ branch: [{ kind: "setSelfSwitch", key: "A", value: true }] }],
    });
    const warnings = result.diff?.warnings.join("\n") ?? "";
    expect(warnings).toContain("selfSwitch.key");
    expect(warnings).toContain("boolean");
  });

  it("registers missing global switches referenced by nested choice commands", () => {
    const { context, result } = runPlaceNpc("npc_global_switch", {
      choices: [{
        text: "진실을 선택한다",
        commands: [{ kind: "setSwitch", switchId: "ending_flag", value: true }],
      }],
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(context.project.switches).toContainEqual(expect.objectContaining({ id: "ending_flag" }));
    expect(context.project.session.switches.ending_flag).toBe(false);
    expect(result.diff?.warnings.join("\n") ?? "").toContain("미등록 switchId 자동 생성: ending_flag");
  });

  it("updates an explicit event id in place without treating itself as an occupied cell", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const first = runTool(context, "place_npc", {
      mapId, x: 2, y: 2, id: "npc_in_place", name: "리나",
      graphic: { transparent: true }, pages: [{ lines: ["처음 대사"] }],
    });
    const second = runTool(context, "place_npc", {
      mapId, x: 2, y: 2, id: "npc_in_place", name: "리나",
      graphic: { transparent: true }, pages: [{ lines: ["수정 대사"] }],
    });

    expect(first.ok).toBe(true);
    expect(second.ok, JSON.stringify(second.issues)).toBe(true);
    expect(second.data).toMatchObject({ x: 2, y: 2, adjusted: false });
    expect(context.project.maps[mapId]?.events.filter((event) => event.id === "npc_in_place")).toHaveLength(1);
  });

  it("moves a transfer endpoint to a nearby usable cell when the requested doorway has no landing", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapAId = context.project.startMapId;
    expect(runTool(context, "create_map", { id: "transfer_target", name: "실내", width: 20, height: 15 }).ok).toBe(true);
    const mapA = context.project.maps[mapAId]!;
    for (let y = 4; y <= 6; y += 1) {
      for (let x = 4; x <= 6; x += 1) mapA.lowerTiles[y * mapA.width + x] = TILE.WATER;
    }

    const result = runTool(context, "create_transfer_pair", {
      a: { mapId: mapAId, x: 5, y: 5 },
      b: { mapId: "transfer_target", x: 2, y: 2 },
      fade: "black",
    });

    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ adjustedA: true, adjustedB: false });
    expect(result.diff?.warnings.join("\n") ?? "").toContain("출입구 A 위치 자동 조정");
  });

  it("returns a model-friendly error when command kind is an unrecoverable object", () => {
    const { result } = runPlaceNpc("npc_bad_kind_object", {
      commands: [{ kind: { value: "text" }, body: "안녕" }],
    });

    expect(result.ok).toBe(false);
    const message = firstIssueMessage(result);
    expect(message).toContain("필드: pages[0].commands[0].kind");
    expect(message).toContain("기대 타입: string");
    expect(message).toContain("실제 타입: object");
    expect(message).toContain("최소 예시:");
  });

  it("returns a model-friendly error when conditions is not iterable or an object", () => {
    const { result } = runPlaceNpc("npc_bad_conditions", {
      conditions: "sw_ready",
      lines: ["조건이 잘못됐어."],
    });

    expect(result.ok).toBe(false);
    const message = firstIssueMessage(result);
    expect(message).toContain("필드: pages[0].conditions");
    expect(message).toContain("기대 타입: array<EventPageCondition> 또는 EventPageCondition object");
    expect(message).toContain("실제 타입: string");
    expect(message).toContain("최소 예시:");
  });
});
