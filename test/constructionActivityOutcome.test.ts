import { describe, expect, it } from "vitest";

import type { AuditEntry, TurnResult } from "@/ai/assistantSession";
import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";
import { buildRegionTaskLogExport } from "@/editor/regionTask/runRegionTask";
import { createBlankProject } from "@/project/defaults";

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

    // When: the region task builds its top-level exported tool-call list.
    const log = buildRegionTaskLogExport({
      mapId: "map_1",
      mapName: "마을",
      region: { x: 0, y: 0, width: 20, height: 20 },
      instruction: "집 8채 마을을 정확히 지어줘",
      composedMessage: "집 8채 마을을 정확히 지어줘\n[context]",
      result: {
        ok: false,
        applied: false,
        changedCells: 0,
        changedEvents: 0,
        clippedCells: 0,
        proposedCalls: 0,
        assistantText: turn.assistantText,
        error: "exact count rolled back",
      },
      turn,
      uiEvents: [],
      session: {
        sendUserMessage: async () => turn,
        getProposedProject: () => createBlankProject(),
        getAuditEntries: () => audit,
      },
    });

    // Then: failure, route, target, and count survive in the top-level call summary.
    expect(log.toolCalls).toEqual([expect.objectContaining({
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
});
