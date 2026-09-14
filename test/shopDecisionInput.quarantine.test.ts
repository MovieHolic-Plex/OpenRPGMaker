// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { playShop, type ShopStep } from "@/player/playSceneShop";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { normalizeElementRecords } from "@/project/databaseUtilityRecordModel";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

function fixture() {
  const project = createBlankProject();
  const base = project.database.actors[0];
  if (!base) throw new Error("Missing actor fixture");
  project.growth = undefined;
  project.database.actors = Array.from({ length: 6 }, (_, i) => ({
    ...structuredClone(base), id: `a${i + 1}`, name: `동료 ${i + 1}`,
    initialLevel: 1, initialEquipment: { weapon: "old" },
    options: { ...base.options, fixedEquipment: i === 4, dualWield: i === 5 },
    parameterCurves: { maxHp: Array(99).fill(100), maxMp: Array(99).fill(30),
      attack: Array(99).fill(20), defense: Array(99).fill(10),
      mind: Array(99).fill(8), agility: Array(99).fill(6) },
  }));
  for (const c of project.database.classes) {
    c.options.fixedEquipment = false;
    c.options.dualWield = false;
    c.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
  }
  const ids = project.database.actors.map(a => a.id);
  const old = normalizeEquipmentRecord({ id: "old", name: "기존 검", slot: "weapon", price: 40,
    equippableActorIds: ids, statBonuses: { attack: 10, defense: 8, mind: 0, agility: 2 } });
  const candidate = normalizeEquipmentRecord({ id: "candidate", name: "후보 검", slot: "weapon", price: 40,
    equippableActorIds: ids, statBonuses: { attack: 5, defense: 0, mind: 0, agility: 0 } });
  old.effectFlags.doubleAttack = true;
  old.elementalDefenseIds = ["fire"];
  old.accuracy = 90;
  candidate.effectFlags.attackAll = true;
  candidate.accuracy = 80;
  project.database.elements = normalizeElementRecords([{ id: "fire", name: "불꽃", kind: "magical" }]);
  project.database.equipment = [candidate, old];
  const potion = project.database.items[0];
  if (!potion) throw new Error("Missing item fixture");
  project.database.items = [{ ...potion, id: "potion", type: "medicine", price: 10 }];
  const session = startSession(project);
  session.partyActorIds = ids;
  session.actorEquipment = Object.fromEntries(ids.map(id => [id, { weapon: "old" }]));
  session.actorLevels = Object.fromEntries(ids.map(id => [id, 1]));
  session.classOverrides = {};
  session.actorParamBonuses = {};
  session.inventory = { candidate: 1, old: 1, potion: 1 };
  session.gold = 100;
  return { project, session, candidate };
}
type Fixture = ReturnType<typeof fixture>;
function mount(f = fixture(), overrides: Partial<ShopStep> = {}) {
  store.replace(f.project);
  const host = document.createElement("div");
  document.body.append(host);
  // Faithful synchronous scene seam: the real shop owns DOM, input and session transactions.
  const scene = { session: f.session, syncRuntimeState: () => {},
    game: { registry: { get: (key: string) => key === "dialogueHost" ? host : undefined } },
  } as unknown as PlaySceneContext;
  const completion = playShop(scene, { kind: "shop", itemIds: ["candidate", "old", "potion"],
    allowSell: true, shopType: "normal", quantityMode: "select", merchantGold: 200, ...overrides } as ShopStep);
  const overlay = host.querySelector<HTMLElement>("[data-testid='shop-scene']");
  if (!overlay) throw new Error("Shop did not mount");
  const get = (id: string) => overlay.querySelector<HTMLElement>(`[data-testid='${id}']`);
  const key = (key: string, init: KeyboardEventInit = {}) => {
    const target = document.activeElement;
    if (!(target instanceof HTMLElement) || !overlay.contains(target)) throw new Error("Shop focus escaped");
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };
  const focus = () => (document.activeElement as HTMLElement)?.dataset.testid;
  const close = async () => {
    // Cleanup also works on RED without depending on the missing new focus contract.
    get("shop-detail-close")?.click();
    get("shop-item-cancel")?.click();
    (get("shop-menu-cancel") ?? get("shop-notice-close"))?.click();
    await completion;
    host.remove();
  };
  return { ...f, overlay, get, key, focus, close };
}
type Mounted = ReturnType<typeof mount>;
async function stock(check: (s: Mounted) => void, f?: Fixture, options?: Partial<ShopStep>) {
  const s = mount(f, options);
  try { s.key("Enter"); check(s); } finally { await s.close(); }
}
function openDetail(s: Mounted) {
  const opener = s.get("shop-detail-open");
  expect(opener).not.toBeNull();
  opener?.focus();
  s.key("Enter");
  expect(s.get("shop-comparison")).not.toBeNull();
  return opener;
}
function numeric(s: Mounted, key: string) {
  const row = s.get(`shop-stat-${key}`);
  return [row?.dataset.current, row?.dataset.next, row?.dataset.delta];
}

describe("mounted shop decision focus and comparison", () => {
  it("cycles exact stock focus groups in both directions without trading", async () => {
    await stock(s => {
      expect(s.focus()).toBe("shop-buy-candidate");
      const snapshot = structuredClone(s.session);
      const ring = ["shop-tab-buy", "shop-category-all", "shop-detail-open", "shop-quantity-input", "shop-confirm", "shop-item-cancel", "shop-buy-candidate"];
      for (const id of ring) { s.key("Tab"); expect(s.focus()).toBe(id); }
      for (const id of [...ring].reverse().slice(1).concat("shop-buy-candidate")) {
        s.key("Tab", { shiftKey: true }); expect(s.focus()).toBe(id);
      }
      expect(s.session).toEqual(snapshot);
    });
  });
  it("moves mode/category focus without committing until confirm and never buys", async () => {
    await stock(s => {
      s.key("Tab"); s.key("ArrowRight");
      expect(s.focus()).toBe("shop-tab-sell");
      expect(s.get("shop-buy-candidate")).not.toBeNull();
      s.key("Enter");
      expect(s.focus()).toBe("shop-tab-sell");
      expect(s.get("shop-sell-candidate")).not.toBeNull();
      s.key("Tab"); s.key("ArrowRight");
      expect(s.focus()).toBe("shop-category-consumable");
      expect(s.get("shop-sell-candidate")).not.toBeNull();
      s.key("z");
      expect(s.get("shop-sell-candidate")).toBeNull();
      expect(s.focus()).toBe("shop-category-consumable");
      expect(s.session.gold).toBe(100);
      expect(s.session.shopTradeCounts).toBeUndefined();
    });
  });
  it.each(["e", "z", "Enter", " "])("confirms only rows/transaction buttons with %j; ignores repeats", async alias => {
    await stock(s => {
      s.key("ArrowRight");
      expect((s.get("shop-quantity-input") as HTMLInputElement).value).toBe("2");
      s.key(alias, { repeat: true });
      expect(s.session.gold).toBe(100);
      s.get("shop-quantity-input")?.focus(); s.key(alias);
      expect(s.session.gold).toBe(100);
      s.key("Tab"); expect(s.focus()).toBe("shop-confirm"); s.key(alias);
      expect(s.session.gold).toBe(20);
      expect(s.session.inventory.candidate).toBe(3);
      expect(s.get("shop-balance-after")?.dataset.shortage).toBe("20");
      expect(s.get("shop-balance-after")?.dataset.balance).toBeUndefined();
      s.key("Escape", { repeat: true }); expect(s.get("shop-confirm")).not.toBeNull();
    });
  });
  it("moves actual row focus, preserves horizontal quantity and updates balance", async () => {
    await stock(s => {
      expect(s.get("shop-balance-after")?.dataset.balance).toBe("60");
      s.key("ArrowRight"); expect(s.get("shop-balance-after")?.dataset.balance).toBe("20");
      s.key("ArrowDown"); expect(s.focus()).toBe("shop-buy-old");
      s.key("ArrowDown"); expect(s.focus()).toBe("shop-buy-potion");
      expect(s.get("shop-balance-after")?.dataset.balance).toBe("80");
      expect(s.session.gold).toBe(100);
    });
  });
  it("keeps moving actual row focus while ArrowDown repeats", async () => {
    await stock(s => {
      const snapshot = structuredClone(s.session);
      s.key("ArrowDown"); expect(s.focus()).toBe("shop-buy-old");
      s.key("ArrowDown", { repeat: true }); expect(s.focus()).toBe("shop-buy-potion");
      s.key("ArrowDown", { repeat: true }); expect(s.focus()).toBe("shop-buy-candidate");
      expect(s.session).toEqual(snapshot);
    });
  });
  it("keeps increasing selected quantity while ArrowRight repeats without trading", async () => {
    const f = fixture();
    f.session.gold = 200;
    await stock(s => {
      const snapshot = structuredClone(s.session);
      const input = s.get("shop-quantity-input");
      if (!(input instanceof HTMLInputElement)) throw new Error("Missing quantity input");
      s.key("ArrowRight"); expect(input.value).toBe("2");
      s.key("ArrowRight", { repeat: true }); expect(input.value).toBe("3");
      s.key("ArrowRight", { repeat: true }); expect(input.value).toBe("4");
      expect(s.focus()).toBe("shop-buy-candidate");
      expect(s.get("shop-balance-after")?.dataset.balance).toBe("40");
      expect(s.session).toEqual(snapshot);
    }, f);
  });
  it("keeps held detail arrow/page scrolling while repeated confirm/cancel remain inert", async () => {
    await stock(s => {
      const snapshot = structuredClone(s.session);
      openDetail(s);
      s.key("Tab"); s.key("Tab"); expect(s.focus()).toBe("shop-detail-scroll");
      const scroll = s.get("shop-detail-scroll");
      if (!scroll) throw new Error("Missing detail scroll region");
      Object.defineProperties(scroll, { scrollHeight: { value: 1000 }, clientHeight: { value: 100 } });
      s.key("ArrowDown"); expect(scroll.scrollTop).toBe(32);
      s.key("ArrowDown", { repeat: true }); expect(scroll.scrollTop).toBe(64);
      s.key("PageDown", { repeat: true }); expect(scroll.scrollTop).toBe(164);
      s.key("PageUp", { repeat: true }); expect(scroll.scrollTop).toBe(64);
      s.key("ArrowUp", { repeat: true }); expect(scroll.scrollTop).toBe(32);
      s.key("Home", { repeat: true }); expect(scroll.scrollTop).toBe(0);
      s.key("End", { repeat: true }); expect(scroll.scrollTop).toBe(900);
      s.key("Tab"); expect(s.focus()).toBe("shop-detail-close");
      const panel = s.get("shop-comparison");
      for (const key of ["e", "z", "Enter", " ", "Escape", "x"]) {
        s.key(key, { repeat: true });
        expect(s.get("shop-comparison")).toBe(panel);
        expect(s.focus()).toBe("shop-detail-close");
      }
      expect(s.session).toEqual(snapshot);
    });
  });
  it("uses horizontal arrows for 1D row navigation when single mode has no quantity input", async () => {
    await stock(s => {
      const snapshot = structuredClone(s.session);
      expect(s.get("shop-quantity-input")).toBeNull();
      expect(s.focus()).toBe("shop-buy-candidate");
      s.key("ArrowRight"); expect(s.focus()).toBe("shop-buy-old");
      s.key("ArrowLeft"); expect(s.focus()).toBe("shop-buy-candidate");
      s.key("ArrowRight", { repeat: true }); expect(s.focus()).toBe("shop-buy-old");
      s.key("ArrowLeft", { repeat: true }); expect(s.focus()).toBe("shop-buy-candidate");
      expect(s.session).toEqual(snapshot);
    }, undefined, { quantityMode: "single", itemIds: ["candidate", "old"] });
  });
  it("renders four truthful downgrade totals, +0, displacement and effect data without mutation", async () => {
    await stock(s => {
      const snapshot = structuredClone(s.session);
      const opener = openDetail(s);
      expect(numeric(s, "attack")).toEqual(["30", "25", "-5"]);
      expect(numeric(s, "defense")).toEqual(["18", "10", "-8"]);
      expect(numeric(s, "mind")).toEqual(["8", "8", "0"]);
      expect(s.get("shop-stat-mind")?.querySelector("[data-delta-label]")?.textContent).toBe("+0");
      expect(numeric(s, "agility")).toEqual(["8", "6", "-2"]);
      expect(s.get("shop-displaced")?.querySelector("[data-equipment-id='old']")?.getAttribute("data-count")).toBe("1");
      expect(s.get("shop-effects-lost")?.querySelector("[data-effect-id='fire']")?.getAttribute("data-effect-name")).toBe("불꽃");
      expect(s.get("shop-effects-gained")?.querySelector("[data-effect-key='attackAll']")).not.toBeNull();
      expect(s.get("shop-effects-changed")?.querySelector("[data-effect-key='accuracy']")?.getAttribute("data-next")).toBe("80");
      s.key("Escape"); expect(document.activeElement).toBe(opener);
      expect(s.session).toEqual(snapshot);
      s.key("Escape"); expect(s.get("shop-mode-buy")).not.toBeNull();
    });
  });
  it("exposes all six actors, immediate dual-wield slots, scroll ring and exact opener restoration", async () => {
    await stock(s => {
      const opener = openDetail(s);
      expect(s.focus()).toBe("shop-actor-a1");
      expect(s.overlay.querySelectorAll(".runtime-shop-actor").length).toBe(6);
      for (let i = 0; i < 5; i++) s.key("ArrowDown");
      expect(s.focus()).toBe("shop-actor-a6");
      s.key("Tab"); expect(s.focus()).toBe("shop-slot-weapon");
      s.key("ArrowDown"); expect(s.focus()).toBe("shop-slot-shield");
      expect(numeric(s, "attack")).toEqual(["30", "35", "5"]);
      s.key("Tab"); expect(s.focus()).toBe("shop-detail-scroll");
      const scroll = s.get("shop-detail-scroll");
      if (!scroll) throw new Error("Missing scroll surface");
      Object.defineProperties(scroll, { scrollHeight: { value: 1000 }, clientHeight: { value: 100 } });
      s.key("End"); expect(scroll.scrollTop).toBe(900);
      s.key("PageUp"); expect(scroll.scrollTop).toBe(800);
      s.key("Home"); expect(scroll.scrollTop).toBe(0);
      s.key("PageDown"); expect(scroll.scrollTop).toBe(100);
      s.key("ArrowDown"); expect(scroll.scrollTop).toBeGreaterThan(100);
      s.key("Tab"); expect(s.focus()).toBe("shop-detail-close");
      s.key("Tab"); expect(s.focus()).toBe("shop-actor-a6");
      s.key("Escape"); expect(document.activeElement).toBe(opener);
      s.key("Tab", { shiftKey: true }); s.key("Tab", { shiftKey: true }); s.key("Tab", { shiftKey: true });
      expect(s.focus()).toBe("shop-buy-candidate"); s.key("ArrowDown"); openDetail(s);
      expect(s.focus()).toBe("shop-actor-a6");
      s.key("Tab"); expect(s.focus()).toBe("shop-slot-shield");
    });
  });
  it("shows blocked current totals without fabricated next, and same-equipment status", async () => {
    await stock(s => {
      openDetail(s);
      for (let i = 0; i < 4; i++) s.key("ArrowDown");
      expect(s.get("shop-preview-reason")?.dataset.reason).toBe("fixedEquipment");
      expect(numeric(s, "attack")).toEqual(["30", undefined, undefined]);
      s.key("Escape"); s.get("shop-buy-old")?.focus(); openDetail(s);
      s.key("ArrowUp");
      expect(s.get("shop-comparison")?.dataset.sameEquipment).toBe("true");
      expect(numeric(s, "attack")).toEqual(["30", "30", "0"]);
    });
  });
  it("supports custom slots and unavailable non-equipment/legacy/no-party states", async () => {
    const custom = fixture();
    custom.project.database.equipmentSlots = [{ id: "charm", label: "부적" }];
    custom.candidate.slot = "charm";
    await stock(s => { openDetail(s); s.key("Tab"); expect(s.focus()).toBe("shop-slot-charm"); }, custom);
    for (const kind of ["notEquipment", "unsupportedItemEquipment", "noActor"] as const) {
      const f = fixture();
      if (kind === "noActor") f.session.partyActorIds = [];
      else {
        const potion = f.project.database.items[0];
        if (!potion) throw new Error("Missing potion");
        potion.type = kind === "notEquipment" ? "medicine" : "weapon";
      }
      await stock(s => {
        openDetail(s);
        expect(s.get("shop-preview-reason")?.dataset.reason).toBe(kind);
        expect(s.get("shop-stat-attack")).toBeNull();
        if (kind === "noActor") expect(s.overlay.querySelectorAll(".runtime-shop-party-sprite").length).toBe(0);
        s.key("Escape");
      }, f, { itemIds: [kind === "noActor" ? "candidate" : "potion"] });
    }
  });
  it("retains real selection after last-copy sale, skips absent groups and empty-list confirm", async () => {
    await stock(s => {
      // Sell order is the canonical owned-goods index (items before equipment).
      s.get("shop-sell-candidate")?.focus();
      s.key("Enter");
      expect(s.get("shop-sell-candidate")).toBeNull();
      expect(s.focus()).toBe("shop-sell-old");
      expect(s.get("shop-balance-after")?.dataset.balance).toBe("140");
      s.key("Enter"); s.key("Enter");
      expect(s.get("shop-item-list-empty")).not.toBeNull();
      expect(s.focus()).toBe("shop-item-cancel");
      expect(s.get("shop-confirm")?.hasAttribute("disabled")).toBe(true);
      s.key("Tab"); expect(s.focus()).toBe("shop-item-cancel");
    }, undefined, { shopType: "sellOnly" });
    await stock(s => {
      s.key("Tab"); expect(s.focus()).toBe("shop-detail-open");
      s.key("Tab"); expect(s.focus()).toBe("shop-confirm");
    }, undefined, { shopType: "buyOnly", itemIds: ["candidate"], quantityMode: "single" });
  });
  it("aborts old stock/detail listeners on rerender and close without document-wide capture", async () => {
    const s = mount();
    const outside = document.createElement("button");
    try {
      s.key("Enter");
      const staleRow = s.get("shop-buy-candidate");
      openDetail(s);
      const staleActor = s.get("shop-actor-a1");
      s.key("Escape");
      s.get("shop-tab-sell")?.focus(); s.key("Enter");
      const snapshot = structuredClone(s.session);
      staleRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      staleActor?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      document.body.append(outside); outside.focus();
      const external = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      outside.dispatchEvent(external);
      expect(external.defaultPrevented).toBe(false); expect(s.session).toEqual(snapshot);
      outside.remove(); await s.close();
      const afterClose = structuredClone(s.session);
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      s.overlay.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false); expect(s.session).toEqual(afterClose);
    } finally { outside.remove(); await s.close(); }
  });
  it("closes the real empty-stock notice", async () => {
    const s = mount(undefined, { itemIds: [] });
    try { expect(s.get("shop-notice-close")).not.toBeNull(); s.key("Enter"); }
    finally { await s.close(); }
  });
});
