import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { fixture, plan, size, target, type Call } from "./requiredOutcomeFixture";

// createBlankProject(~63MB)·조수 세션을 ci 러너(워커 1개)에서 처음 만드는 시험이 13~17초 걸려 vitest 기본 15초 상한에 걸린다
// (ci-vitest-files 42446009926 실측). 같은 사정의 aiChatPanelSettings.test.ts 선례대로 이 파일만 예산을 늘린다.
vi.setConfig({ testTimeout: 120_000 });

beforeEach(resetIntentDeclarationCache);
afterEach(resetIntentDeclarationCache);

const attempts: readonly Call[] = [
  { name: "skip_work_item", args: { itemId: "edit" } },
  { name: "complete_work_item", args: { itemId: "edit" } },
  plan([{ ...size, required: false }]),
  { name: "repair_acceptance", args: { itemId: "repair", criteria: [{ kind: "eventCount", target, count: 0 }] } },
  { name: "review_acceptance", args: { itemId: "size", verdict: "pass", note: "Fabricated review" } },
  { name: "reset_project", args: { prompt: "Replace project", title: "Replacement" } },
];
const inspect: Call = { name: "get_work_plan", args: {} };
const inspectProject: Call = { name: "get_project_summary", args: {} };

describe("question dispatch preserves blocked goal ownership", () => {
  for (const mode of ["ask", "question"] as const) {
    it.each([false, true])(`${mode} preserves blocked state when tools attempt mutation=%s`, async mutate => {
      // Given a real blocked item, a pending sibling, unmet promises and repeated-write counters.
      const f = fixture();
      const originalPlan: Call = { name: "set_work_plan", args: {
        ...plan([size, { id: "repair", title: "Repair", criteria: null }]).args,
        layers: [{ title: "Work", items: [
          { id: "edit", title: "Blocked", instruction: "Edit the map" },
          { id: "next", title: "Pending", instruction: "Inspect later", successTools: ["get_work_plan"] },
        ] }],
      } };
      const rejectedWrite: Call = { name: "set_map_properties", args: { mapId: "missing", name: "Rejected" } };
      await f.run([[originalPlan], [rejectedWrite], [rejectedWrite], [rejectedWrite], [rejectedWrite]]);
      const work = f.session.getWorkPlan();
      const acceptance = f.session.getAcceptanceSnapshot();
      const counters = {
        ralph: structuredClone([...f.session["ralphAttemptsByItemId"]]),
        failures: structuredClone([...f.session["repeatedToolFailures"]]),
        reasons: [...f.session["lastBlockReasonByItemId"]],
        repairs: f.session["acceptanceRepairAttempts"],
      };
      expect(work?.layers[0]?.items.map(item => item.status)).toEqual(["blocked", "pending"]);
      // 수용 원장은 더 이상 만들어지지 않는다(acceptance:disabled, 2026-09-17 하네스 게이트 2차 해체) — 질문 턴 뒤에도 그대로 없어야 한다.
      expect(acceptance).toBeNull();
      expect(counters.failures.length).toBeGreaterThan(0);
      if (mode === "question") f.setIntent({ mode: "question", resetsContext: true });
      // When a question's model attempts writes plus inspection through the real dispatch path.
      await f.run([mutate ? [...attempts, inspect] : [inspect], [inspectProject]], mode === "ask" ? { composerMode: "ask" } : {}, "Explain the blocked work");
      // Then writes are refused, inspection succeeds, and neither direct nor secondary paths change the goal.
      const results = f.events.filter(event => event.type === "tool_call");
      expect(results.map(event => ({ name: event.name, ok: event.result.ok }))).toEqual([
        ...(mutate ? attempts.map(call => ({ name: call.name, ok: false })) : []),
        { name: inspect.name, ok: true }, { name: inspectProject.name, ok: true },
      ]);
      if (mutate) for (const event of results.filter(event => attempts.some(call => call.name === event.name))) {
        expect(event.result.issues?.map(issue => issue.code)).toContain("composer-mode-ask");
      }
      expect(f.session.getWorkPlan()).toEqual(work);
      expect(f.session.getAcceptanceSnapshot()).toEqual(acceptance);
      expect([...f.session["ralphAttemptsByItemId"]]).toEqual(counters.ralph);
      expect([...f.session["repeatedToolFailures"]]).toEqual(counters.failures);
      expect([...f.session["lastBlockReasonByItemId"]]).toEqual(counters.reasons);
      expect(f.session["acceptanceRepairAttempts"]).toBe(counters.repairs);
      expect(f.events.filter(event => event.type === "work_plan").every(event => JSON.stringify(event.plan) === JSON.stringify(work))).toBe(true);
    });
  }
});
