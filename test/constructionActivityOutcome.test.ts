import { describe, expect, it } from "vitest";

import { toolCallsFromAudit } from "@/ai/activityLog";
import type { AuditEntry, TurnResult } from "@/ai/assistantSession";
import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";

const ZERO_DIFF = {
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
} as const;

const FAILED_CONSTRUCTION = {
  executionOk: false,
  applied: false,
  outcome: "failed",
  requestedEntrypoint: "author_village",
  canonicalRoute: "author_village",
  selectedImplementation: "buildVillageDomain",
  routeChanges: [],
  target: { kind: "existing", mapId: "map_1" },
  counts: { requested: 8, actual: 0 },
  diff: ZERO_DIFF,
  warnings: ["exact count rolled back"],
  activityPersistence: "local",
  projectPersistence: "failed",
} as const satisfies ConstructionAuditRecord;

describe("canonical construction activity outcome", () => {
  it("exports a failed canonical call from the audit ledger even without a proposal", () => {
    // Given: a canonical call failed before it could become a proposed change.
    const audit = [{
      kind: "tool",
      name: "author_village",
      args: { target: { kind: "existing", mapId: "map_1" }, houseCount: 8 },
      ok: false,
      summary: "exact count rolled back",
      construction: FAILED_CONSTRUCTION,
    }] as const satisfies readonly AuditEntry[];
    const turn = {
      assistantText: "마을 건설에 실패했습니다.",
      proposedCalls: [],
      stoppedReason: "final",
    } as const satisfies TurnResult;

    // When: the assistant turn builds its top-level exported tool-call list.
    // (예전엔 runRegionTask.buildRegionTaskLogExport 가 했다 — 실행체 통합으로 조수 경로 하나다.)
    expect(turn.proposedCalls).toHaveLength(0); // 제안 0건 — 감사 로그가 유일한 단서다.
    const toolCalls = toolCallsFromAudit(audit, []);

    // Then: failure, route, target, and count survive in the top-level call summary.
    expect(toolCalls).toEqual([expect.objectContaining({
      name: "author_village",
      ok: false,
      construction: expect.objectContaining({
        outcome: "failed",
        canonicalRoute: "author_village",
        target: { kind: "existing", mapId: "map_1" },
        counts: { requested: 8, actual: 0 },
      }),
    })]);
  });

  it("falls back to the proposal list when the audit ledger has no tool entries", () => {
    const toolCalls = toolCallsFromAudit([{ kind: "assistant", text: "네" }], [
      { name: "paint_tiles", args: { mapId: "map_1" }, ok: true, summary: "12칸" },
    ]);
    expect(toolCalls).toEqual([{ name: "paint_tiles", args: { mapId: "map_1" }, ok: true, summary: "12칸" }]);
  });
});
