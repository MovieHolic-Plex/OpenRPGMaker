/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startSession } from "@/project/session";
import { setEquippedTool } from "@/project/toolActions";
import {
  cycleHandSlot,
  handSlotCurrent,
  handSlotEntries,
  handSlotIndex,
  selectHandSlot,
} from "@/player/handSlot";
import { mountHandSlotChip } from "@/player/handSlotChip";
import { handSlotCycleDelta, handSlotDigit, isInputCapturingSurfaceActive } from "@/player/keyBindings";

function farmingSession() {
  const project = createFarmingDemoProject();
  return { project, session: startSession(project) };
}

describe("hand slot model", () => {
  it("lists only held farm tools and seeds, tools first", () => {
    const { project, session } = farmingSession();

    const entries = handSlotEntries(project, session);

    expect(entries.map((entry) => entry.itemId)).toEqual([
      "item_hoe",
      // 광산을 싣면서 곡괭이도 시작 장비가 됐다 — 새 스타파이 아니라 달린 도구다.
      "item_pickaxe",
      "item_watering_can",
      // 벌목 가능한 스타터 나무를 실으면서 도끼도 시작 장비가 됐다(task81).
      "item_axe",
      "item_potato_seed",
      "item_strawberry_seed",
      "item_tomato_seed",
      "item_corn_seed",
    ]);
    expect(entries[0]).toEqual({ itemId: "item_hoe", name: "괭이", count: 1 });
    // 수확물(item_potato 등)은 도구도 씨앗도 아니므로 목록에 없다.
    expect(entries.some((entry) => entry.itemId === "item_potato")).toBe(false);
  });

  it("keeps the CC0 catalog art and description when the demo overrides an item", () => {
    const { project } = farmingSession();
    const hoe = project.database.items.find((item) => item.id === "item_hoe");

    // 데모가 명시한 것은 이긴다.
    expect(hoe?.name).toBe("괭이");
    expect(hoe?.farmTool).toBe("hoe");
    // 명시하지 않은 것은 카탈로그에서 상속한다 — 통째 교체하면 상점·인벤토리가 무지 칸이 된다.
    expect(hoe?.iconResourceId).toBe("cc0-jetrel-hoe");
    expect(hoe?.imageResourceId).toBe("cc0-jetrel-hoe");
    expect(hoe?.description).toBeTruthy();
  });

  it("skips items the player does not actually hold", () => {
    const { project, session } = farmingSession();
    delete session.inventory.item_hoe;

    expect(handSlotEntries(project, session).map((entry) => entry.itemId)).not.toContain("item_hoe");
  });

  it("cycles tools then seeds then back through the reachable empty hand", () => {
    const { project, session } = farmingSession();
    const entries = handSlotEntries(project, session);
    expect(session.equippedToolItemId).toBeUndefined();

    const visited: Array<string | undefined> = [];
    for (let step = 0; step < entries.length + 1; step += 1) {
      cycleHandSlot(project, session, 1);
      visited.push(session.equippedToolItemId);
    }

    expect(visited).toEqual([...entries.map((entry) => entry.itemId), undefined]);
    expect(handSlotIndex(project, session)).toBe(0);
  });

  it("cycles backwards from the empty hand to the last seed", () => {
    const { project, session } = farmingSession();

    cycleHandSlot(project, session, -1);

    expect(session.equippedToolItemId).toBe("item_corn_seed");
  });

  it("treats a digit beyond the entry count as a no-op", () => {
    const { project, session } = farmingSession();
    setEquippedTool(session, "item_hoe");

    selectHandSlot(project, session, 9);

    expect(session.equippedToolItemId).toBe("item_hoe");
  });

  it("falls back to the empty hand when the held item is used up", () => {
    const { project, session } = farmingSession();
    setEquippedTool(session, "item_potato_seed");
    delete session.inventory.item_potato_seed;

    expect(handSlotCurrent(project, session)).toBeUndefined();
    expect(handSlotIndex(project, session)).toBe(0);
  });
});

describe("hand slot chip", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders the empty hand label with nothing equipped", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { project, session } = farmingSession();

    const chip = mountHandSlotChip(host);
    chip?.update(project, session);

    expect(host.querySelector("[data-testid='hand-slot']")).toBeTruthy();
    expect(host.querySelector("[data-testid='hand-slot-label']")?.textContent).toBe("빈 손");
  });

  it("renders the held item name and count, and clears on destroy", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { project, session } = farmingSession();
    session.inventory.item_potato_seed = 3;
    setEquippedTool(session, "item_potato_seed");

    const chip = mountHandSlotChip(host);
    chip?.update(project, session);

    expect(host.querySelector("[data-testid='hand-slot-label']")?.textContent).toBe("감자 씨앗 ×3");
    // 항상 켜져 있는 칩이므로 zone-feedback 안에 들어가면 안 된다
    // (제네릭 맵에서 zone-feedback 개수 0 을 요구하는 e2e 계약).
    expect(host.querySelector("[data-testid='zone-feedback'] [data-testid='hand-slot']")).toBeNull();

    chip?.destroy();
    expect(host.querySelector("[data-testid='hand-slot']")).toBeNull();
  });

  it("returns null for a missing host instead of throwing", () => {
    expect(mountHandSlotChip(null)).toBeNull();
  });
});

describe("hand slot key predicates", () => {
  it("maps digits to slots and brackets to cycle deltas, ignoring everything else", () => {
    expect(handSlotDigit("1")).toBe(1);
    expect(handSlotDigit("9")).toBe(9);
    expect(handSlotDigit("0")).toBe(0);
    expect(handSlotDigit("z")).toBeUndefined();
    expect(handSlotDigit("ArrowUp")).toBeUndefined();
    expect(handSlotCycleDelta("[")).toBe(-1);
    expect(handSlotCycleDelta("]")).toBe(1);
    expect(handSlotCycleDelta("1")).toBeUndefined();
  });

  it("treats the name entry overlay as an input-capturing surface, like dialogue", () => {
    const stage = document.createElement("div");

    expect(isInputCapturingSurfaceActive(stage)).toBe(false);
    expect(isInputCapturingSurfaceActive(null)).toBe(false);

    // 이름 입력 중 숫자는 글자지 손 슬롯 번호가 아니다.
    const nameEntry = document.createElement("div");
    nameEntry.dataset.testid = "runtime-name-entry";
    stage.append(nameEntry);
    expect(isInputCapturingSurfaceActive(stage)).toBe(true);

    nameEntry.remove();
    const dialogue = document.createElement("div");
    dialogue.dataset.testid = "dialogue-box";
    stage.append(dialogue);
    expect(isInputCapturingSurfaceActive(stage)).toBe(true);
  });
});
