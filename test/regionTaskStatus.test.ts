import { describe, expect, it } from "vitest";
import { regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";

describe("regionTaskStatusDetail", () => {
  it("유효한 detail을 통과시키고 불량 payload는 null", () => {
    const good = { detail: { mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true } } as unknown as Event;
    expect(regionTaskStatusDetail(good)).toEqual({ mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true });
    const bad = { detail: { mapId: 5 } } as unknown as Event;
    expect(regionTaskStatusDetail(bad)).toBeNull();
    expect(regionTaskStatusDetail({} as Event)).toBeNull();
  });
});
