// 쓰기 도구의 성공 결과가 모델에게 가는 모양 — 도구가 남긴 알림은 싣고, 변경 전부터 있던 프로젝트 검사 줄은 뺀다.
// 2026-11-11 작은 일 둘째 묶음(Terra): 지어진 게임에서 upsert_item 을 다섯 번 불렀고 결과마다 다른 이벤트의 같은 경고 8줄뿐이었다 —
// 「scope 가 ally 라 … 탈출 로프는 scope none 이 맞습니다」 같은 도구 자신의 알림은 한 줄도 가지 않았다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { formatPiToolSuccess, writeResultForModel } from "@/ai/piAgent/toolAdapter";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import type { ToolResult } from "@/editor/tools/types";

const shown = (ctx: { project: ReturnType<typeof buildFixture> }, name: string, args: Record<string, unknown>) => {
  const before = ctx.project;
  const result = runTool(ctx, name, args);
  expect(result.ok, result.summary).toBe(true);
  const view = writeResultForModel(result, before, ctx.project);
  return { result, view, body: JSON.parse(formatPiToolSuccess(view)) as { warnings?: string[]; issues?: { code: string; message: string }[] } };
};

describe("writeResultForModel", () => {
  it("변경 전부터 있던 검사 줄은 싣지 않고, 도구의 알림은 싣는다", () => {
    const ctx = { project: buildFixture("built") };
    const { result, body } = shown(ctx, "upsert_item", { item: { id: "item_tea", name: "눈꽃 차", scope: "ally", price: 30, type: "medicine", escapeTo: "entrance", hpRecovery: { flat: 50, percentMax: 0 } } });
    // 러너 결과에는 프로젝트 전체 검사가 그대로 있다(다른 이벤트의 런타임 지원 경고).
    expect((result.issues ?? []).length).toBeGreaterThan(8);
    expect(body.issues ?? []).toEqual([]);
    expect(body.warnings?.some((w) => w.includes("scope"))).toBe(true);
  });

  it("이벤트를 옮겨도 그 이벤트의 옛 검사 줄이 새 줄로 나오지 않는다", () => {
    const ctx = { project: buildFixture("built") };
    const market = Object.values(ctx.project.maps).find((m) => m.name === "겨울 시장")!;
    const withWarnings = market.events.find((e) => e.name && !/gate/u.test(e.id))!;
    const { body } = shown(ctx, "move_event", { mapId: market.id, eventId: withWarnings.id, x: withWarnings.x + 1, y: withWarnings.y });
    expect((body.issues ?? []).filter((i) => i.code.startsWith("runtime-support"))).toEqual([]);
  });

  it("이번 변경이 새로 만든 줄은 남는다 — 알림과 겹치면 알림으로 한 번만", () => {
    const ctx = { project: buildFixture("built") };
    const hall = Object.values(ctx.project.maps).find((m) => m.name === "족장의 긴 집")!;
    const market = Object.values(ctx.project.maps).find((m) => m.name === "겨울 시장")!;
    const { result, body } = shown(ctx, "create_transfer_pair", { a: { mapId: hall.id, x: 10, y: 1 }, b: { mapId: market.id, x: 21, y: 13 } });
    const moved = (result.diff?.warnings ?? []).filter((w) => w.includes("자동 조정"));
    expect(moved.length).toBeGreaterThan(0);
    for (const note of moved) expect(body.warnings).toContain(note);
    // 장면 다듬기 줄은 알림(diff.warnings)과 issues 양쪽에 있었다 — 모델에게는 한 번만 간다.
    expect((body.issues ?? []).filter((i) => body.warnings!.includes(i.message))).toEqual([]);
  });

  it("같은 프로젝트에서 이어 부르면 앞 호출이 알린 줄을 되풀이하지 않는다", () => {
    const ctx = { project: buildFixture("built") };
    const hall = Object.values(ctx.project.maps).find((m) => m.name === "족장의 긴 집")!;
    const market = Object.values(ctx.project.maps).find((m) => m.name === "겨울 시장")!;
    const first = shown(ctx, "create_transfer_pair", { a: { mapId: hall.id, x: 10, y: 1 }, b: { mapId: market.id, x: 21, y: 13 } });
    const firstIssues = new Set((first.result.issues ?? []).map((i) => i.message));
    const second = shown(ctx, "upsert_item", { item: { id: "item_tea", name: "눈꽃 차", price: 30 } });
    expect((second.body.issues ?? []).filter((i) => firstIssues.has(i.message))).toEqual([]);
  });

  it("실패 결과와 알림 없는 결과는 그대로다", () => {
    const failed: ToolResult = { ok: false, summary: "x", issues: [{ severity: "error", code: "c", message: "m" }] };
    const project = buildFixture("blank");
    expect(writeResultForModel(failed, project, project)).toBe(failed);
    const plain: ToolResult = { ok: true, summary: "done" };
    expect(writeResultForModel(plain, project, project)).toEqual(plain);
  });
});
