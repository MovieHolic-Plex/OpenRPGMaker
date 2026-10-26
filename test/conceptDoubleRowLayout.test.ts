import { describe, expect, it } from "vitest";
import { layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { layoutConceptFacilityDoubleRow } from "@/editor/conceptLayoutDoubleRow";
import type { ConceptBundleRecord, ConceptFacilityRecord } from "@/project/types/conceptBundle";

describe("place_concept double-row 도면", () => {
  // Removed it "모르는 layout 은 invalid-plan": place_concept was removed from the tool registry on purpose.

  // Removed it "double-row 는 복도 북쪽과 남쪽에": place_concept was removed from the tool registry on purpose.

  it("BUILTIN에 없는 장소는 theme이 placeId 그대로, 복도는 corridor다", () => {
    const bundle: ConceptBundleRecord = {
      id: "t",
      label: "T",
      facilities: [{ id: "f", label: "F", placeIds: ["living", "corridor"] }],
      places: [
        { id: "living", label: "거실", role: "room", size: "m" },
        { id: "corridor", label: "복도", role: "walkway" },
      ],
      things: [],
    };
    const facility: ConceptFacilityRecord = bundle.facilities[0]!;
    for (const layout of [layoutConceptFacility(bundle, facility), layoutConceptFacilityDoubleRow(bundle, facility)]) {
      const living = layout.rooms.find((room) => room.placeId === "living")!;
      const walkway = layout.rooms.find((room) => room.role === "walkway")!;
      expect(living.theme).toBe("living");
      expect(walkway.theme).toBe("corridor");
    }
  });
});

describe("row/double-row legacy walkway contract", () => {
  it.each([
    [{ id: "passage", label: "Hall" }, "walkway"],
    [{ id: "passage", label: "corridor" }, "walkway"],
    [{ id: "corridor", label: "연결" }, "walkway"],
    [{ id: "hall", label: "홀" }, "room"],
    [{ id: "hall", label: "Hall", role: "entrance" }, "entrance"],
    [{ id: "hall", label: "Hall", role: "room" }, "room"],
  ] as const)("%j resolves to %s in both layouts", (place, role) => {
    const bundle: ConceptBundleRecord = {
      id: "test", label: "Test", facilities: [{ id: "f", label: "F", placeIds: [place.id] }],
      places: [{ ...place }], things: [],
    };
    for (const layout of [layoutConceptFacility(bundle, bundle.facilities[0]!), layoutConceptFacilityDoubleRow(bundle, bundle.facilities[0]!)]) {
      expect(layout.rooms.find((room) => room.placeId === place.id)?.role).toBe(role);
    }
  });
});
