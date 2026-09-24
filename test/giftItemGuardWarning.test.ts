// 2026-09-24 연애 도그푸딩: 「선물을 건넨다」 분기가 changeItem -= 1 뒤에 호감 +3 을 주는데 소지 조건이 없어,
// 잡화점에 가지 않고도 선물 효과를 받았다. 거부하지 않고 presentItem / 소지 조건 fork 를 알려 준다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";

const gift = (branch: unknown[]) => ({ kind: "choices", options: [{ text: "사탕을 준다", branch }, { text: "그만둔다", branch: [{ kind: "text", body: "다음에." }] }] });
const spend = { kind: "changeItem", itemId: "item_candy", op: "-=", amount: 1 };
const love = { kind: "setVariable", variableId: "var_love", op: "+=", value: 3 };

function warningsFor(commands: unknown[]): string {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "upsert_event", {
    mapId: ctx.project.startMapId,
    event: { id: "ev_summer", x: 3, y: 3, commands: [], pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, commands }] },
  });
  expect(result.ok, result.summary).toBe(true);
  return (result.diff?.warnings ?? []).join("\n");
}

describe("소지 조건 없는 선물", () => {
  it("선택지 분기가 소지 확인 없이 아이템을 빼면 경고한다", () => {
    expect(warningsFor([gift([spend, love])])).toContain("presentItem");
  });
  it("소지 조건 fork 로 감싸면 경고하지 않는다", () => {
    const guarded = gift([{ kind: "fork", condition: { kind: "item", itemId: "item_candy", present: true }, then: [spend, love], else: [{ kind: "text", body: "사탕이 없다." }] }]);
    expect(warningsFor([guarded])).not.toContain("소지 여부를 보지 않습니다");
  });
});
