// 3/4 영수증 없이 구운 공방 기물(Claude 없는 Terra 경로)이 관문을 통과한 것처럼 나가지 못한다는 증명.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { bakeWorkshopObject, workshopObjectId, type WorkshopObjectInput } from "@/project/workshopTiles";
import { withRouteProvenance } from "@/headless/objectGen";
import { packBlockedItems, storePublishBlockReason } from "@/assetStore/pack";

const ID = "atlas_biome_interior";
const TERRA = { route: "codex", model: "gpt-6.1-terra", effort: "high", gate: "unavailable", label: "ChatGPT(Codex) gpt-6.1-terra high", note: null };

function sign(overrides: Partial<WorkshopObjectInput> = {}): WorkshopObjectInput {
  return {
    objectId: workshopObjectId("new:별등 표지판"), title: "별등 표지판", description: "별 달린 표지판", kind: "floor",
    columns: 1, rows: 2, footRows: 1, risePx: 16, use: [], gridHash: "g1",
    asset: { id: "workshop_terra1", dataUrl: "data:image/png;base64,AA", width: 16, height: 32 },
    cells: [{ sourceTile: 0, dx: 0, dy: 0 }, { sourceTile: 1, dx: 0, dy: 1 }],
    provenance: { aiGenerated: true, tool: "oprn-workshop/map-objects/headless-auto-pick" },
    ...overrides,
  } as WorkshopObjectInput;
}

describe("영수증 없는 공방 기물", () => {
  it("Terra 경로로 구우면 spec.gate 가 없고 review.vqa 가 「영수증 없음·미보정」으로 박힌다", () => {
    const input = withRouteProvenance(sign(), TERRA);
    expect(input.gate).toBeUndefined();
    expect(input.review?.vqa).toMatchObject({ verdict: "none", calibrated: false });
    expect(input.review?.vqa?.judge).toContain("no 3/4 receipt");
    expect(input.provenance.drawModel).toBe("codex:gpt-6.1-terra:high");
  });

  it("영수증이 있으면 spec.gate 를 그대로 두고 vqa 를 덮지 않는다", () => {
    const gate = { kind: "small_prop" as const, verdict: "pass" as const, decidedAt: "t" };
    const input = withRouteProvenance(sign({ gate } as Partial<WorkshopObjectInput>), { ...TERRA, route: "claude", model: "claude-opus-5-5", gate: "receipt" });
    expect(input.gate).toEqual(gate);
    expect(input.review?.vqa).toBeUndefined();
  });

  it("구운 칸이 든 칩셋·그림 모두 스토어 팩에서 막힌다(공방 그림 출구 차단)", () => {
    const p = createBlankProject();
    bakeWorkshopObject(p, ID, withRouteProvenance(sign(), TERRA));
    expect(storePublishBlockReason("workshop_terra1", "공방 · 별등 표지판", undefined)).toMatch(/3\/4/u);
    const blocked = packBlockedItems(p, { tilesetIds: [], assetIds: ["workshop_terra1"] });
    expect(blocked.map((b) => b.id)).toContain("workshop_terra1");
  });
});
