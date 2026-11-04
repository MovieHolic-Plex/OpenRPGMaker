import { describe, expect, it } from "vitest";
import { createTransitSim, stepTransitSim, transitPose, transitRectCells, type MapTransit } from "@/project/mapTransit";

// 폭 6 도로(laneShift 0.5)에서 차 몸이 덮는 셋째 줄에 선 사람 앞에서도 1칸 넘게 띄우고 서는지(첫사랑 r7: 0.07칸 앞에서 섰다).
function run(shift: number, personRow: number) {
  const transit = { routes: [{ id: "r", kind: "road", path: [{ x: 0, y: 10 }, { x: 40, y: 10 }], vehicles: ["mc-veh-truck-a"], headwaySec: 1, ...(shift ? { laneShift: { ew: shift } } : {}) }] } as unknown as MapTransit;
  const sim = createTransitSim(transit, { width: 50, height: 30 }, 0);
  const person = { x: 20, y: personRow };
  for (let i = 0; i < 600; i += 1) stepTransitSim(sim, 1 / 30, (x, y) => x === person.x && y === person.y);
  const v = sim.vehicles[0];
  expect(v, "차가 나와 움직였다").toBeDefined();
  const pose = transitPose(sim, v!);
  return { pose, person, front: pose.rect.x + pose.rect.w };
}

describe("사람 앞 양보는 차선 맞춤이 들어간 몸으로 본다", () => {
  for (const row of [10, 11, 12]) {
    it(`laneShift 0.5 · 사람 줄 ${row}`, () => {
      const { pose, person, front } = run(0.5, row);
      expect(pose.rect.x, "출발 칸에서 움직였다").toBeGreaterThan(0);
      expect(front).toBeLessThanOrEqual(person.x - 1);
      expect(transitRectCells(pose.rect).some((c) => c.x === person.x && c.y === person.y)).toBe(false);
    });
  }
  it("laneShift 0 · 사람 줄 11", () => {
    const { front, person } = run(0, 11);
    expect(front).toBeLessThanOrEqual(person.x - 1);
  });
});
