import { describe, expect, it } from "vitest";
import { mapAiBadges } from "@/editor/panels/mapTreeAiBadges";
import type { MapRunTicket } from "@/editor/aiMapRunQueue";
import type { Presence } from "@/editor/panels/aiPresence";

const maps = new Set(["map_a", "map_b", "map_c"]);
const isMap = (id: string) => maps.has(id);

function ticket(id: number, mapKey: string, status: MapRunTicket["status"], extra: Partial<MapRunTicket> = {}): MapRunTicket {
  return { id, mapKey, exclusive: false, foreground: false, label: `요청 ${id}`, status, wait: status === "waiting" ? "same-map" : null, ahead: 0,
    enqueuedAt: 0, startedAt: null, endedAt: null, error: null, ...extra };
}

function presence(extra: Partial<Presence>): Presence {
  return { id: "p", source: "chat", name: "조수", readsOnly: false, no: 1, tone: 0, state: "working", mapId: null, mapName: null, task: "",
    action: "", steps: 0, startedAt: undefined, recent: [], ...extra };
}

describe("mapAiBadges", () => {
  it("shows who holds a map and which maps are waiting for its lock", () => {
    const badges = mapAiBadges([], [ticket(1, "map_a", "running"), ticket(2, "map_a", "waiting"), ticket(3, "map_a", "waiting", { ahead: 1 })], isMap);
    expect(badges.get("map_a")!.map((b) => [b.kind, b.text])).toEqual([["working", "조수 작업 중"], ["waiting", "잠금 대기 2"]]);
  });

  it("names the team worker that owns a map, with its job colour", () => {
    const badges = mapAiBadges([presence({ name: "시공 1", tone: 1, mapId: "map_b" }), presence({ id: "r", name: "검수", readsOnly: true, mapId: "map_c" })], [], isMap);
    expect(badges.get("map_b")).toEqual([expect.objectContaining({ kind: "working", text: "시공 1 작업 중", tone: 1 })]);
    expect(badges.has("map_c")).toBe(false);
  });

  it("does not badge project-wide or exclusive (team) queue keys", () => {
    const badges = mapAiBadges([], [ticket(1, "__project__", "running"), ticket(2, "map_c", "running", { exclusive: true })], isMap);
    expect(badges.size).toBe(0);
  });
});
