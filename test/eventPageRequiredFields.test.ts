// 2026-08-23 실측 회귀: 모델이 이벤트 레벨 trigger 만 주고 페이지에는 conditions/commands 만 담아
// upsert_event 를 호출하면, 프로젝트 린트가 `page.trigger.kind` / `movement.route` 를 읽다 TypeError 로
// 죽고 커밋이 "후처리 실패: Cannot read properties of undefined" 로 끝났다. 모델은 고칠 단서가 없어
// 같은 인자를 3회 재전송했다. 필수 페이지 필드는 자동 보완되어야 하고, 실패해도 사유가 읽혀야 한다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";

function eventWithBarePage(mapId: string, conditions: unknown[], trigger = "auto"): Record<string, unknown> {
  return {
    mapId,
    event: {
      id: "ev_bare_page",
      x: 0,
      y: 0,
      trigger: { kind: trigger },
      pages: [{ conditions, commands: [{ kind: "text", body: "끝" }] }],
    },
  };
}

describe("upsert_event 페이지 필수 필드 보완", () => {
  it("trigger/graphic/movement 누락 페이지가 TypeError 없이 처리된다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_event", eventWithBarePage(ctx.project.startMapId, []));

    expect(result.summary).not.toContain("Cannot read properties");
    expect(result.summary).not.toContain("후처리 실패");
    expect(result.ok).toBe(true);
    const page = ctx.project.maps[ctx.project.startMapId]?.events.find((e) => e.id === "ev_bare_page")?.pages?.[0];
    expect(page?.trigger.kind).toBe("auto");
    expect(page?.movement).toBeDefined();
    expect(page?.graphic).toBeDefined();
  });

  it("복합 조건(all)이 붙은 페이지도 크래시 대신 읽을 수 있는 사유를 돌려준다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(
      ctx,
      "upsert_event",
      eventWithBarePage(ctx.project.startMapId, [
        {
          kind: "all",
          conditions: [
            { kind: "switch", switchId: "sw_missing_a", value: true },
            { kind: "switch", switchId: "sw_missing_b", value: true },
          ],
        },
      ]),
    );

    expect(result.summary).not.toContain("Cannot read properties");
    // place_npc 와 같은 규칙(2026-09-24): 없는 스위치는 거부 대신 등록하고 경고로 알린다.
    expect(result.ok).toBe(true);
    expect((result.diff?.warnings ?? []).join(" ")).toMatch(/미등록 switchId 자동 생성: sw_missing_a/);
    expect(ctx.project.switches.map((entry) => entry.id)).toEqual(expect.arrayContaining(["sw_missing_a", "sw_missing_b"]));
  });

  it("속도·빈도가 빠진 movement 부분 객체를 채워 직렬화 왕복이 깨지지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_event", {
      mapId: ctx.project.startMapId,
      event: {
        id: "ev_partial_move", x: 1, y: 1,
        pages: [{ trigger: { kind: "action" }, movement: { type: "fixed" }, graphic: { transparent: true }, conditions: [],
          commands: [{ kind: "setSwitch", switchId: "sw_intro_done", value: true }] }],
      },
    });
    expect(result.ok).toBe(true);
    const page = ctx.project.maps[ctx.project.startMapId]?.events.find((e) => e.id === "ev_partial_move")?.pages?.[0];
    expect(page?.movement).toMatchObject({ type: "fixed", speed: 3, frequency: 3 });
    expect(ctx.project.switches.some((entry) => entry.id === "sw_intro_done")).toBe(true);
    expect(() => deserialize(serialize(ctx.project))).not.toThrow();
  });

  it("발명한 trigger 값에는 허용 목록을 실어 준다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_event", eventWithBarePage(ctx.project.startMapId, [], "autorun"));

    expect(result.ok).toBe(false);
    const messages = [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" ");
    expect(messages).toContain("autorun");
    expect(messages).toContain("auto");
    expect(messages).toContain("parallel");
  });
});
