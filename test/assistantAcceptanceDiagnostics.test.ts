import { describe, expect, it } from "vitest";
import { ACCEPTANCE_EXAMPLES, parseAcceptanceCriteriaResult } from "@/ai/assistantAcceptance";

// 수용 원장(AssistantAcceptanceLedger)의 보수·검토·도달성 평가 경로는 2026-09-17 에 꺼졌다(assistantSession.adoptAcceptance).
// 그 경로를 돌리던 사례는 지웠고, 살아 있는 코드가 부르는 순수 파서(parseAcceptanceCriteriaResult ← runRecovery·requestCoverage)의
// 「어느 필드가 왜 틀렸는가」 진단만 남긴다.
const target = { mapId: "map_blank_start" };

describe("actionable atomic acceptance diagnostics", () => {
  it.each([
    { criterion: { kind: "mapCount", count: 1, targets: [{ ...target, newMapName: "Both" }] }, field: "targets[0]", code: "invalid-selector" },
    { criterion: { kind: "mapDimensions", target, width: 0, height: 15 }, field: "width", code: "invalid-field" },
    { criterion: { kind: "eventCount", target, count: -1 }, field: "count", code: "invalid-field" },
    { criterion: { kind: "preserve", target, evidence: "forged" }, field: "evidence", code: "unknown-field" },
    { criterion: { kind: "imageReviewed", target, region: { x: 0, y: 0, w: 0, h: 1 } }, field: "region", code: "invalid-field" },
    { criterion: { kind: "reachability", target, from: { x: 0, y: 0 }, to: [{ x: -1, y: 0 }] }, field: "to[0]", code: "invalid-field" },
  ])("identifies malformed sibling $field without retaining its valid prefix", ({ criterion, field, code }) => {
    expect(parseAcceptanceCriteriaResult([ACCEPTANCE_EXAMPLES.preserve, criterion])).toMatchObject({ criteria: null,
      issues: [{ criterionIndex: 1, field: `criteria[1].${field}`, code }] });
  });
});
