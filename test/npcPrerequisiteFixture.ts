import { EVENT_TOOLS } from "@/editor/tools/eventTools";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent } from "@/project/types";
import type { NpcRewardRequirement } from "@/ai/intentDeclaration";
import type { NpcRewardPreludeStep, NpcRewardWitness } from "@/ai/npcRewardWitness";

export const CHIEF = "ev_chief";
export const KEY = "item_brass_key";
export function page(id: string, commands: Command[], conditions: EventPage["conditions"] = [], trigger: EventPage["trigger"] = { kind: "action" }, solid = true): EventPage {
  return { id, name: id, conditions, graphic: { transparent: true }, trigger,
    priority: solid ? "same" : "below", overlapForbidden: solid,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands };
}
export function event(id: string, x: number, y: number, pages: EventPage[]): GameEvent {
  return { id, name: id, x, y, pages, trigger: { kind: "action" }, commands: [] };
}
export function prerequisiteFixture() {
  const project = createBlankProject();
  const village = project.maps[project.startMapId];
  village.events = [];
  village.encounterRate = 0;
  const cellar = { ...structuredClone(village), id: "map_cellar", name: "Cellar", events: [] as GameEvent[] };
  project.maps[cellar.id] = cellar;
  project.startPos = { x: 2, y: 2 };
  project.session.gold = 37;
  project.session.inventory = {};
  project.switches.push({ id: "accepted", name: "Accepted" }, { id: "paid", name: "Paid" });
  const template = project.database.items.find(item => item.id === "item_potion");
  if (!template) throw new Error("Missing default potion fixture");
  project.database.items.push({ ...template, id: KEY, name: "Brass key" });
  const chief = event(CHIEF, 5, 2, [
    page("intro", [{ kind: "setSwitch", switchId: "accepted", value: true }]),
    page("reward", [{ kind: "changeGold", op: "+=", amount: 20 }, { kind: "setSwitch", switchId: "paid", value: true }], [
      { kind: "switch", switchId: "accepted", value: true }, { kind: "item", itemId: KEY, present: true }, { kind: "switch", switchId: "paid", value: false },
    ]),
    page("claimed", [], [{ kind: "switch", switchId: "paid", value: true }]),
  ]);
  const out = event("to_cellar", 8, 2, [page("out", [{ kind: "transfer", mapId: cellar.id, x: 2, y: 2 }], [], { kind: "playerTouch" }, false)]);
  const back = event("to_village", 1, 2, [page("back", [{ kind: "transfer", mapId: village.id, x: 7, y: 2 }], [], { kind: "playerTouch" }, false)]);
  village.events.push(chief, out);
  cellar.events.push(back);
  const chestTool = EVENT_TOOLS.find(tool => tool.name === "place_chest");
  if (!chestTool) throw new Error("Missing chest preset");
  const created = chestTool.run(project, { mapId: cellar.id, x: 6, y: 2, id: "key_chest", contents: { itemId: KEY } });
  if (created.issues?.some(issue => issue.severity === "error")) throw new Error(created.summary);
  const chest = cellar.events.find(entry => entry.id === "key_chest");
  if (!chest?.pages?.[0]) throw new Error("Missing authored chest");
  const visitChest = [
    { kind: "walk" as const, mapId: village.id, to: { x: 8, y: 2 } },
    { kind: "walk" as const, mapId: cellar.id, to: { x: 6, y: 2 }, adjacent: true },
    { kind: "interact" as const, mapId: cellar.id, eventId: "key_chest" },
    { kind: "walk" as const, mapId: cellar.id, to: { x: 1, y: 2 } },
  ];
  const prelude: NpcRewardPreludeStep[] = [
    { kind: "walk" as const, mapId: village.id, to: { x: 5, y: 2 }, adjacent: true },
    { kind: "interact" as const, mapId: village.id, eventId: CHIEF },
    ...visitChest,
    { kind: "walk" as const, mapId: village.id, to: { x: 5, y: 2 }, adjacent: true },
  ];
  const requirement: NpcRewardRequirement = { target: { mapId: village.id, eventId: CHIEF }, grants: [{ kind: "gold", count: 20 }], oneTime: true };
  const witness: NpcRewardWitness = { target: { mapId: village.id, eventId: CHIEF }, prelude };
  return { project, village, cellar, chief, out, back, chest, prelude, visitChest, requirement, witness };
}
