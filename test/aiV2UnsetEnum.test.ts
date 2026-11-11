// 값이 하나뿐인 선택 enum 은 칸을 다 채우는 모델이 비울 수 없다 — v2 는 "none" 을 더해 보여 주고, 인자 검사가 도구에 가기 전에 걷는다.
// 2026-11-11 작은 일 둘째 묶음 item-new-built: upsert_item 의 escapeTo 가 하나뿐인 값 "entrance" 로 채워져 회복 차가 탈출 로프로 저장됐다.
import { describe, expect, it } from "vitest";
import { getTool, runTool } from "@/editor/tools";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { englishToolCopy } from "@/ai/v2/tools/toolExposure";
import { preCheck } from "@/ai/v2/loop/argGuard";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";

type Node = { enum?: unknown[]; properties?: Record<string, Node>; items?: Node; required?: string[] };
const at = (node: Node, path: string[]): Node | undefined => path.reduce<Node | undefined>((n, k) => n?.properties?.[k], node);

describe("값 하나짜리 선택 enum", () => {
  const ctx = { project: buildFixture("starter") };
  const shown = (name: string) => englishToolCopy(createPiToolset(ctx, { toolNames: [name] }).find((t) => t.name === name)!, true).parameters as Node;

  it("모델이 보는 스키마에는 none 이 앞에 있다 — 도구의 진짜 스키마는 그대로", () => {
    expect(at(shown("upsert_item"), ["item", "escapeTo"])?.enum).toEqual(["none", "entrance"]);
    expect(at(getTool("upsert_item")!.parameters as Node, ["item", "escapeTo"])?.enum).toEqual(["entrance"]);
    expect(at(shown("place_npc"), ["guide"])?.enum).toEqual(["none", "action-controls"]);
    // 값이 여럿인 enum 과 필수 칸은 건드리지 않는다.
    expect(at(shown("upsert_item"), ["item", "scope"])?.enum).toEqual(at(getTool("upsert_item")!.parameters as Node, ["item", "scope"])?.enum);
  });

  it("none 으로 온 칸은 도구에 가기 전에 걷히고, 차는 탈출 로프가 되지 않는다", () => {
    const sent = { item: { id: "item_tea", name: "눈꽃 차", scope: "ally", price: 30, type: "medicine", escapeTo: "none", hpRecovery: { flat: 50, percentMax: 0 } } };
    const pre = preCheck("upsert_item", shown("upsert_item"), sent, ctx.project);
    expect(pre.kind).toBe("ok");
    const args = (pre as { args: { item: Record<string, unknown> } }).args;
    expect("escapeTo" in args.item).toBe(false);
    // 진짜 값이 none 인 칸(scope)은 그대로 둔다.
    const keep = preCheck("upsert_item", shown("upsert_item"), { item: { id: "item_rope", name: "밧줄", scope: "none" } }, ctx.project);
    expect((keep as { args: { item: Record<string, unknown> } }).args.item.scope).toBe("none");
    const run = { project: ctx.project };
    expect(runTool(run, "upsert_item", args).ok).toBe(true);
    const saved = run.project.database.items.find((i) => i.id === "item_tea") as { escapeTo?: string; type?: string } | undefined;
    expect(saved?.escapeTo).toBeUndefined();
    expect(saved?.type).toBe("medicine");
  });
});
