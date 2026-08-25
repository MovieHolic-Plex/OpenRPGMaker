import { describe, expect, it } from "vitest";
import { createVillagerRoomMap } from "@/editor/villagerRoomKit";
import { VR } from "@/editor/interiorRoomPipeline";

describe("villagerRoomKit re-export", () => {
  it("builds bedroom via pipeline", () => {
    const map = createVillagerRoomMap("bedroom");
    expect(map.upperTiles).toContain(VR.BED_L);
    expect(map.events?.some((e) => e.pages?.[0]?.name === "입구")).toBe(true);
  });
});
