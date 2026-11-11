import { describe, expect, it } from "vitest";
import { evalActorQueryCondition, type ActorQuerySession } from "@/project/conditionActorQueries";
import type { ActorQueryCondition } from "@/project/types";

// 벽 x=3(문틈 y=5), 경비 둘이 서로 마주 본다, 문 이벤트가 문틈에 선다.
const wall = (x: number, y: number): boolean => x === 3 && y >= 0 && y <= 9 && y !== 5;
const events = [
  { id: "guard_a", name: "성문 경비", characterId: "guard", x: 1, y: 5, commands: [] },
  { id: "guard_b", name: "성문 경비", characterId: "guard", x: 8, y: 5, commands: [] },
  { id: "door", name: "문", x: 3, y: 5, commands: [{ kind: "transfer", mapId: "m", x: 0, y: 0 }] },
];
const positions: Record<string, { x: number; y: number; direction?: "left" | "right" }> = {
  guard_a: { x: 1, y: 5, direction: "right" },
  guard_b: { x: 8, y: 5, direction: "left" },
  door: { x: 3, y: 5 },
};
const NIGHT = { hour: 23, minute: 0, day: 1, season: "spring" as const, year: 1 };
const NOON = { hour: 12, minute: 0, day: 1, season: "spring" as const, year: 1 };

function sees(condition: Partial<Extract<ActorQueryCondition, { kind: "eventSeesPlayer" }>>, x: number, y: number, extra: Partial<ActorQuerySession> = {}, ambient?: number): boolean {
  const session: ActorQuerySession = { partyActorIds: [], actorVitals: {}, x, y, flags: {}, currentMapId: "m", ...extra };
  return evalActorQueryCondition(session, { kind: "eventSeesPlayer", eventId: "", ...condition } as ActorQueryCondition, {}, {
    eventPosition: (id) => positions[id],
    blocksSight: wall,
    mapEvents: () => events,
    ambient: () => ambient,
    locations: () => [],
  });
}

describe("eventSeesPlayer optional fields", () => {
  it("keeps the old outcome when no new field is set", () => {
    expect(sees({ eventId: "guard_a", range: 5 }, 2, 5)).toBe(true);
    expect(sees({ eventId: "guard_a", range: 5 }, 5, 5)).toBe(true);
    expect(sees({ eventId: "guard_a", range: 5 }, 4, 3)).toBe(false);
    expect(sees({ eventId: "guard_a", range: 2 }, 4, 5)).toBe(false);
    expect(sees({ eventId: "guard_b", range: 5 }, 6, 5, { gameTime: NIGHT }, 0.9)).toBe(true);
  });

  it("doorsBlock closes the door gap", () => {
    expect(sees({ eventId: "guard_a", range: 5, doorsBlock: true }, 5, 5)).toBe(false);
  });

  it("darkness shortens sight only at night or in the dark", () => {
    expect(sees({ eventId: "guard_b", range: 5, darkness: { dark: 1 } }, 6, 5, {}, 0.9)).toBe(false);
    expect(sees({ eventId: "guard_b", range: 5, darkness: { dark: 1 } }, 6, 5, {}, 0.2)).toBe(true);
    expect(sees({ eventId: "guard_b", range: 5, darkness: { night: 1 } }, 6, 5, { gameTime: NIGHT })).toBe(false);
    expect(sees({ eventId: "guard_b", range: 5, darkness: { night: 1 } }, 6, 5, { gameTime: NOON })).toBe(true);
  });

  it("watchers pick anyone matching; not-seen means nobody sees", () => {
    expect(sees({ watchers: { name: "경비" }, range: 5 }, 7, 5)).toBe(true);
    expect(sees({ watchers: { characterId: "guard" }, range: 5 }, 2, 5)).toBe(true);
    expect(sees({ watchers: { name: "기사" }, range: 5 }, 7, 5)).toBe(false);
    expect(sees({ watchers: { name: "경비" }, range: 5, value: false }, 4, 0)).toBe(true);
    expect(sees({ watchers: { name: "경비" }, range: 5, value: false }, 7, 5)).toBe(false);
  });
});
