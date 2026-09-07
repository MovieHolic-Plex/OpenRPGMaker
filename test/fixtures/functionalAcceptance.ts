import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";

export function functionalFixture() {
  const project = createBlankProject();
  project.startPos = { x: 1, y: 1 };
  project.session.gold = 100;
  project.session.inventory = {};
  const potion = project.database.items.find(item => item.id === "item_potion");
  if (!potion) throw new Error("Missing test potion");
  potion.price = 10;
  const origin = project.maps[project.startMapId];
  origin.events = [];
  const destination = { ...structuredClone(origin), id: "test_interior", name: "Test interior", events: [] as GameEvent[] };
  project.maps[destination.id] = destination;
  const event = (id: string, x: number, y: number, commands: Command[], touch = false): GameEvent => ({
    id, name: id, x, y, trigger: { kind: touch ? "touch" : "action" }, commands: [],
    pages: [{ id: `${id}_page`, name: id, conditions: [], graphic: { transparent: true },
      trigger: { kind: touch ? "touch" : "action" }, priority: touch ? "below" : "same", overlapForbidden: !touch,
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
  });
  const seller = event("test_seller", 4, 1, [{ kind: "shop", itemIds: ["item_potion"], stock: [{ itemId: "item_potion", priceOverride: 10 }], quantityMode: "select", allowSell: false }]);
  const outgoing = event("test_outgoing", 1, 4, [{ kind: "transfer", mapId: destination.id, x: 1, y: 1 }], true);
  const returning = event("test_return", 1, 4, [{ kind: "transfer", mapId: origin.id, x: 1, y: 1 }], true);
  const reward = event("test_reward", 6, 1, [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 }, { kind: "setSelfSwitch", key: "A", value: true }]);
  const page = reward.pages?.[0];
  if (!page) throw new Error("Missing test page");
  reward.pages?.push({ ...structuredClone(page), id: "claimed", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [] });
  origin.events.push(seller, outgoing, reward);
  destination.events.push(returning);
  return { project, origin, destination, seller, outgoing, returning, reward };
}

export function suspendedCorridorFixture() {
  const fixture = functionalFixture();
  const { seller, outgoing, origin } = fixture;
  const shop = seller.pages?.[0]?.commands[0];
  const corridor = structuredClone(outgoing);
  const page = corridor.pages?.[0];
  if (!shop || !page) throw new Error("Missing corridor fixture commands");
  corridor.id = "mandatory_shop";
  corridor.y = 2;
  page.commands = [structuredClone(shop), { kind: "gameOver" }];
  origin.events.push(corridor);
  for (let x = 0; x < origin.width; x++) {
    if (x !== 1) origin.events.push({ ...structuredClone(seller), id: `corridor_wall_${x}`, x, y: 2 });
  }
  return { ...fixture, corridor };
}
