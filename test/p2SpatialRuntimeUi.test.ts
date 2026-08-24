import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createLifeLedgerDetail } from "@/player/lifeLedger";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";

describe("P2 spatial runtime status surface", () => {
  it("shows placed general structures and decorations in an independent spaces ledger tab", () => {
    // Break caught: authored placements persist but are completely invisible to the player at runtime.
    const project = createBlankProject();
    const itemId = project.database.items[0]!.id;
    project.database.farmBuildingTypes = [{
      id: "shed", name: "작업 창고",
      levels: [{ level: 1, name: "기본", footprint: { width: 2, height: 2 }, capacity: 8, graphicResourceId: "easyrpg-picture-cloud" }],
    }];
    project.database.homeDecorationTypes = [{
      id: "table", name: "나무 탁자", placementItemId: itemId,
      footprint: { width: 2, height: 1 }, blocksMovement: true,
      allowedOrientations: ["down", "left"], graphicResourceId: "easyrpg-picture-cloud",
    }];
    project.session.farmBuildingPlacements = [{
      instanceId: "shed_1", typeId: "shed", level: 1,
      mapId: project.startMapId, x: 2, y: 2, orientation: "down",
    }];
    project.session.homeDecorationPlacements = [{
      instanceId: "table_1", typeId: "table",
      mapId: project.startMapId, x: 6, y: 2, orientation: "left",
    }];
    const session = startSession(project, 901);

    expect(listStatusMenuCommandIds(project, session)).toContain("life-ledger");
    const mutations: boolean[] = [];
    const detail = createLifeLedgerDetail({ project, session, tab: "spaces", onMutation: (ok) => mutations.push(ok) });
    expect(detail.tabs?.at(-1)).toMatchObject({ id: "spaces", testId: "life-ledger-tab-spaces", selected: true });
    expect(detail.artwork?.src).toBe("/assets/farming/life-ui/decorating-card.png");
    expect(detail.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "작업 창고", testId: "life-ledger-space-building-shed_1", value: "Lv.1 · 수용량 8" }),
      expect.objectContaining({ label: "나무 탁자", testId: "life-ledger-space-decoration-table_1", value: "왼쪽 · 1×2" }),
    ]));
    const rotate = detail.entries.find((entry) => entry.testId === "life-ledger-space-decoration-rotate-table_1");
    expect(rotate?.disabled).toBe(false);
    rotate?.onActivate?.();
    expect(session.homeDecorationPlacements?.table_1?.orientation).toBe("down");
    expect(mutations).toEqual([true]);
  });
});
