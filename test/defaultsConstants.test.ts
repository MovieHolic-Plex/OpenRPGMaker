// @vitest-environment happy-dom

import { afterEach, describe, expect, it, beforeEach } from "vitest";
import type { BattleSnapshot } from "@/battle/types";
import { DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID, TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { battleResultPanel, resultHeadLootText, rewardValue, resultDirectorState } from "@/player/battleDirectorDom";
import { collectBattleRewards } from "@/battle/battleRewards";
import { playGiftSelection } from "@/player/playSceneGift";
import { playPresentItem } from "@/player/playScenePresentItem";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { DEFAULT_MESSAGE_WINDOW_SETTINGS, startSession } from "@/project/session";
import type { GameEvent, GameMap } from "@/project/types";
import { setCanvasPointerBridge } from "@/editor/canvasPointerBridge";
import { editorState } from "@/editor/editorState";
import { setClientPointTileResolver, setRegionClientRectResolver } from "@/editor/regionClientRect";
import { installMapLocationLayer, repositionMapLocationLayer } from "@/editor/mapLocationLayer";
import { createLocationFromRect, currentLocations, deleteLocation, locationDeletionImpact, locationLayerState, renameSelectedLocation, repairBrokenLocationReferences, resizeLocation, selectLocation, setLocationLayerEnabled, toggleLocationLayer } from "@/editor/mapLocationLayerState";
import { isolateTimers } from "./mergedTeardown";

describe("battleLootIcon", () => {
  isolateTimers();
  // 몬스터 드롭이 결과 창 글자 한 줄뿐이라 무엇을 얻었는지 놓쳤다(2026-11-08). 도트 결과 창의 전리품 줄은 아이템 아이콘을 단다.
  function lootSnapshot(items: string[]): BattleSnapshot {
    return {
      result: "victory",
      actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1, skillIds: [] }],
      rewards: { exp: 12, gold: 0, items },
      eventState: { gold: 0, inventory: {} },
      participatingActorIds: [DEFAULT_ACTOR_ID],
    } as unknown as BattleSnapshot;
  }
  describe("pixel battle result loot row", () => {
    const project = store.getCurrent();
    const previousBattleUi = project.system.battleUiStyle;
    const previousMenu = project.system.menuUiStyle;

    afterEach(() => {
      project.system.battleUiStyle = previousBattleUi;
      project.system.menuUiStyle = previousMenu;
    });

    it("puts the dropped item's icon on its row with the count", () => {
      project.system.battleUiStyle = "retro2003";
      project.system.menuUiStyle = "pixel";
      const panel = battleResultPanel(lootSnapshot([DEFAULT_ITEM_ID, DEFAULT_ITEM_ID]))!;
      const row = [...panel.querySelectorAll<HTMLElement>(".battle-result-reward-row")].find((node) => node.dataset.rewardKind === "item")!;
      expect(row.querySelector(`[data-testid="battle-result-loot-icon-${DEFAULT_ITEM_ID}"]`)).not.toBeNull();
      expect(row.querySelector(".battle-result-reward-value")?.textContent).toBe("×2");
      expect(row.querySelector(".battle-result-reward-owned")?.textContent).toBe("보유 0 → 2");
    });

    it("adds no loot row or icon when nothing dropped", () => {
      project.system.battleUiStyle = "retro2003";
      project.system.menuUiStyle = "pixel";
      const panel = battleResultPanel(lootSnapshot([]))!;
      expect(panel.querySelector(".battle-result-loot-icon")).toBeNull();
      expect([...panel.querySelectorAll<HTMLElement>(".battle-result-reward-row")].some((node) => node.dataset.rewardKind === "item")).toBe(false);
    });
  });
});

describe("battleResultHeadLoot", () => {
  isolateTimers();
  // 승리 머리 창 전리품이 전부 이어져 191px 칸에서 「늑대 가죽 ×1 · 늑대 …」 로 잘렸다(폴른 스타 QA B6, 2026-11-08).

  describe("battle result head loot", () => {
    it("names the first drop and counts the other kinds", () => {
      expect(resultHeadLootText([])).toBe("");
      expect(resultHeadLootText([{ name: "늑대 가죽", count: 1 }])).toBe("늑대 가죽 ×1");
      expect(resultHeadLootText([
        { name: "늑대 송곳니", count: 2 }, { name: "늑대 가죽", count: 2 }, { name: "회복약", count: 1 },
      ])).toBe("늑대 송곳니 ×2 외 2종");
    });

    const project = store.getCurrent();
    const previousBattleUi = project.system.battleUiStyle;
    const previousMenu = project.system.menuUiStyle;
    afterEach(() => {
      project.system.battleUiStyle = previousBattleUi;
      project.system.menuUiStyle = previousMenu;
    });

    it("keeps every drop on its own row in the loot window while the head stays short", () => {
      project.system.battleUiStyle = "retro2003";
      project.system.menuUiStyle = "pixel";
      const [first, second] = project.database.items;
      const panel = battleResultPanel({
        result: "victory",
        actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1, skillIds: [] }],
        rewards: { exp: 12, gold: 48, items: [first!.id, first!.id, second!.id] },
        eventState: { gold: 10, inventory: {} },
        participatingActorIds: [DEFAULT_ACTOR_ID],
      } as unknown as BattleSnapshot);
      expect(panel!.querySelector(".battle-result-summary-loot")?.textContent).toBe(`${first!.name} ×2 외 1종`);
      const cards = panel!.querySelector(".battle-result-cards")?.textContent ?? "";
      expect(cards).toContain(first!.name);
      expect(cards).toContain(second!.name);
    });
  });
});

describe("battleResultRewardSign", () => {
  isolateTimers();
  // 사장 1.37 VQA D2(2026-11-05): 결과 패널에 「경험치+-28」·「G+-7」처럼 부호가 겹쳐 찍혔다.
  // 세션 적립은 음수를 0 으로 깎으므로, 패널도 같은 규칙을 써야 한다(받지 않는 손실을 보여 주면 안 된다).

  function snapshotWithRewards(exp: number, gold: number): BattleSnapshot {
    return {
      result: "victory",
      actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1, skillIds: [] }],
      rewards: { exp, gold, items: [] },
      eventState: { gold: 10, inventory: {} },
      participatingActorIds: [DEFAULT_ACTOR_ID],
    } as unknown as BattleSnapshot;
  }
  describe("battle result reward signs", () => {
    const project = store.getCurrent();
    const previousTerms = project.meta.terms;
    const previousBattleUi = project.system.battleUiStyle;
    const previousMenu = project.system.menuUiStyle;

    afterEach(() => {
      project.meta.terms = previousTerms;
      project.system.battleUiStyle = previousBattleUi;
      project.system.menuUiStyle = previousMenu;
    });

    it("clamps reward values the way the session does", () => {
      expect(rewardValue(28)).toBe("+28");
      expect(rewardValue(0)).toBe("+0");
      expect(rewardValue(-28)).toBe("+0");
    });

    it("drops a negative reward row instead of printing a doubled sign", () => {
      project.meta.terms = { ...previousTerms, gold: "G", item: "아이템" };
      project.system.battleUiStyle = "retro2003";
      project.system.menuUiStyle = "pixel";
      const panel = battleResultPanel(snapshotWithRewards(-28, -7))!;
      expect(panel.textContent ?? "").not.toContain("+-");
      const values = [...panel.querySelectorAll(".battle-result-reward-value")].map((node) => node.textContent);
      expect(values).not.toContain("-28");
      expect(values).not.toContain("-7");
      expect(values.filter((text) => (text ?? "").includes("-"))).toHaveLength(0);
    });

    it("still prints a plain plus for positive rewards", () => {
      project.system.battleUiStyle = "retro2003";
      project.system.menuUiStyle = "pixel";
      const panel = battleResultPanel(snapshotWithRewards(12, 48))!;
      const values = [...panel.querySelectorAll(".battle-result-reward-value")].map((node) => node.textContent);
      expect(values).toContain("+12");
      expect(values).toContain("+48");
      expect(panel.textContent ?? "").not.toContain("+-");
    });

    it("collects no negative total even when an enemy reward is negative", () => {
      const snapshot = collectBattleRewards(
        project,
        [{ id: "e1", recordId: "enemy_negative_probe", level: 1, hp: 0, hidden: false } as never],
        () => 0.5,
      );
      expect(snapshot.exp).toBeGreaterThanOrEqual(0);
      expect(snapshot.gold).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("battleVictoryCurrency", () => {
  isolateTimers();
  // 기본 용어의 화폐는 「G」다. 승리 칸만 「골드」로 고정되면 상점·메뉴와 다른 돈을 받은 것처럼 읽힌다.

  function victorySnapshot(): BattleSnapshot {
    return {
      result: "victory",
      actors: [{ recordId: DEFAULT_ACTOR_ID, id: DEFAULT_ACTOR_ID, name: "주인공", hp: 20, maxHp: 20, level: 1, skillIds: [] }],
      rewards: { exp: 12, gold: 48, items: [] },
      eventState: { gold: 10, inventory: {} },
      participatingActorIds: [DEFAULT_ACTOR_ID],
    } as unknown as BattleSnapshot;
  }
  describe("battle victory currency term", () => {
    const project = store.getCurrent();
    const previousTerms = project.meta.terms;
    const previousBattleUi = project.system.battleUiStyle;
    const previousMenu = project.system.menuUiStyle;

    afterEach(() => {
      project.meta.terms = previousTerms;
      project.system.battleUiStyle = previousBattleUi;
      project.system.menuUiStyle = previousMenu;
    });

    it("uses the project currency on the reward row, purse line, and summary", () => {
      project.meta.terms = { ...previousTerms, gold: "크레딧", item: "도구" };
      project.system.battleUiStyle = "retro2003";
      project.system.menuUiStyle = "pixel";
      const snapshot = victorySnapshot();
      const panel = battleResultPanel(snapshot);
      expect(panel).toBeTruthy();
      const labels = [...panel!.querySelectorAll(".battle-result-reward-label")].map((node) => node.textContent);
      expect(labels).toContain("크레딧");
      expect(labels).not.toContain("골드");
      expect(panel!.querySelector(".battle-result-reward-owned")?.textContent).toBe("소지금 10 크레딧 → 58 크레딧");
      expect(panel!.querySelector(".battle-result-summary-gold")?.textContent).toBe("+48 크레딧");
      const summary = resultDirectorState(snapshot, { step: "acting", lines: [] }).lines[1];
      expect(summary).toBe("경험치 12 / 48 크레딧 / 도구 0");
    });

    it("falls back to G when the currency term is blank", () => {
      project.meta.terms = { ...previousTerms, gold: "   " };
      project.system.battleUiStyle = "classic";
      project.system.menuUiStyle = "classic";
      const panel = battleResultPanel(victorySnapshot());
      const labels = [...panel!.querySelectorAll(".battle-result-reward-label")].map((node) => node.textContent);
      expect(labels).toContain("G");
      expect(labels).not.toContain("골드");
    });
  });
});

// 선물하기·물건 제시 창: 보이는 제목이 대화상자 이름이고, 커서가 옮기면 그 물건만 알린다.
describe("giftChoiceA11y", () => {
  isolateTimers();
  function sceneFixture(inventory: Record<string, number>): PlaySceneContext {
    store.replace(deserialize(serialize(createBlankProject())));
    const project = store.getCurrent();
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = {
      showText: async () => undefined,
      showChoices: async () => 0,
      showNumberInput: async () => 0,
      hide() {},
      close() {},
    };
    const scene = {
      session: startSession(project, 1),
      map: project.maps[project.startMapId],
      tileX: 0,
      tileY: 0,
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : key === "dialogue" ? dialogue : undefined) } },
      syncRuntimeState() {},
    } as unknown as PlaySceneContext;
    scene.session.inventory = inventory;
    return scene;
  }
  afterEach(() => {
    document.body.replaceChildren();
  });
  describe("gift and present-item dialog accessibility", () => {
    it("names the gift dialog and announces the item under the cursor", async () => {
      const scene = sceneFixture({ [DEFAULT_ITEM_ID]: 2 });
      const event: GameEvent = {
        id: "npc",
        x: 1,
        y: 1,
        characterId: "resident",
        trigger: { kind: "action" },
        commands: [],
      };
      const pending = playGiftSelection(scene, event);
      const dialog = document.querySelector<HTMLElement>("[data-testid='gift-scene']");
      const title = document.getElementById("runtime-gift-title");
      expect(dialog?.getAttribute("role")).toBe("dialog");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
      expect(dialog?.getAttribute("aria-labelledby")).toBe(title?.id);
      expect(title?.textContent).toBe("선물하기");
      expect(document.querySelector("[data-testid='gift-item-list']")?.getAttribute("aria-label")).toBe("선물할 물건");
      expect(document.querySelector("[data-testid='gift-item-item_potion']")?.getAttribute("aria-label")).toBe("회복약 2개");

      const status = document.querySelector<HTMLElement>("[data-testid='gift-announcement']");
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.getAttribute("aria-live")).toBe("polite");
      expect(status?.textContent).toBe("회복약 2개");
      expect(document.activeElement).toBe(dialog);

      document.querySelector<HTMLButtonElement>("[data-testid='gift-cancel']")?.click();
      await pending;
      expect(document.querySelector("[data-testid='gift-scene']")).toBeNull();
    });

    it("names the present-item dialog with the question and speaks the next item", async () => {
      const scene = sceneFixture({});
      const pending = playPresentItem(scene, {
        kind: "presentItem",
        prompt: "증거를 제시하라",
        items: [
          { itemId: "item_knife", count: 1 },
          { itemId: "item_letter", count: 2 },
        ],
        settings: DEFAULT_MESSAGE_WINDOW_SETTINGS,
      });
      // item_knife 는 자료집에 없어 id 가 그대로 이름이 되고, item_letter 는 기본 자료집의 「배달 편지」로 풀린다.
      const dialog = document.querySelector<HTMLElement>("[data-testid='present-item-scene']");
      const title = document.getElementById("runtime-present-title");
      expect(dialog?.getAttribute("role")).toBe("dialog");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
      expect(dialog?.getAttribute("aria-labelledby")).toBe(title?.id);
      expect(title?.textContent).toBe("증거를 제시하라");
      expect(document.querySelector("[data-testid='present-item-list']")?.getAttribute("aria-label")).toBe("보여줄 물건");
      expect(document.querySelector("[data-testid='present-item-item_knife']")?.getAttribute("aria-label")).toBe("item_knife 1개");
      expect(document.querySelector("[data-testid='present-item-item_letter']")?.getAttribute("aria-label")).toBe("배달 편지 2개");

      const status = document.querySelector<HTMLElement>("[data-testid='present-item-announcement']");
      expect(status?.textContent).toBe("item_knife 1개");
      expect(document.activeElement).toBe(dialog);

      dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(status?.textContent).toBe("배달 편지 2개");

      document.querySelector<HTMLButtonElement>("[data-testid='present-item-cancel']")?.click();
      await expect(pending).resolves.toBeUndefined();
      expect(document.querySelector("[data-testid='present-item-scene']")).toBeNull();
    });
  });
});

describe("mapLocationLayer", () => {
  isolateTimers();
  const MAP_ID = "layer_map";
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();
    get length(): number { return this.values.size; }
    clear(): void { this.values.clear(); }
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
    removeItem(key: string): void { this.values.delete(key); }
    setItem(key: string, value: string): void { this.values.set(key, value); }
  }
  function seedProject(): void {
    const project = createBlankProject();
    const map: GameMap = {
      id: MAP_ID,
      name: "레이어 맵",
      width: 20,
      height: 20,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(400).fill(TILE.GRASS),
      upperTiles: new Array(400).fill(TILE.EMPTY),
      events: [],
    };
    project.maps[MAP_ID] = map;
    project.startMapId = MAP_ID;
    store.replace(project);
    editorState.set({ currentMapId: MAP_ID });
  }
  let dispose: (() => void) | null = null;
  function mount(): HTMLElement {
    const host = document.createElement("div");
    host.className = "phaser-container";
    document.body.append(host);
    dispose = installMapLocationLayer();
    return host;
  }
  function testId(id: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }
  function pointerDownAt(clientX: number, clientY: number, init: PointerEventInit = {}): PointerEvent {
    return new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX, clientY, ...init });
  }
  describe("map location editor layer", () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: new MemoryStorage() });
      seedProject();
      setLocationLayerEnabled(false);
      selectLocation(null);
    });

    afterEach(() => {
      dispose?.();
      dispose = null;
      document.body.innerHTML = "";
      setLocationLayerEnabled(false);
      Reflect.deleteProperty(globalThis, "localStorage");
      setCanvasPointerBridge(null);
      setRegionClientRectResolver(null);
      setClientPointTileResolver(null);
    });

    it("is inert until toggled on: no pointer target and no inspector", () => {
      mount();
      const overlay = testId("map-location-layer");
      const inspector = testId("map-location-inspector");
      expect(overlay).not.toBeNull();
      expect(overlay?.classList.contains("is-active")).toBe(false);
      expect(inspector?.classList.contains("is-active")).toBe(false);
      // 꺼진 상태에서는 아무것도 그리지 않는다 — 캔버스 위에 남는 잔상이 없다.
      expect(overlay?.children).toHaveLength(0);
    });

    it("toggling on activates the layer and persists across reinstall", () => {
      mount();
      toggleLocationLayer();
      expect(locationLayerState().enabled).toBe(true);
      expect(testId("map-location-layer")?.classList.contains("is-active")).toBe(true);
      expect(testId("map-location-inspector")?.classList.contains("is-active")).toBe(true);
      expect(localStorage.getItem("oprn:map-location-layer")).toBe("1");

      toggleLocationLayer();
      expect(testId("map-location-layer")?.classList.contains("is-active")).toBe(false);
      expect(localStorage.getItem("oprn:map-location-layer")).toBeNull();
    });

    it("draws, names, renames, resizes and deletes a location through the layer surface", () => {
      mount();
      setLocationLayerEnabled(true);

      expect(createLocationFromRect({ x: 2, y: 3, w: 5, h: 4 }).ok).toBe(true);
      const created = currentLocations()[0]!;
      expect(created).toMatchObject({ x: 2, y: 3, w: 5, h: 4 });
      // 그린 직후 자동 선택 + 인스펙터에 이름 칸이 뜬다(그리자마자 이름을 붙이는 흐름).
      expect(locationLayerState().selectedId).toBe(created.id);
      const nameInput = testId("map-location-name-input") as HTMLInputElement | null;
      expect(nameInput?.value).toBe(created.name);
      expect(testId(`map-location-box-${created.id}`)).not.toBeNull();
      expect(testId(`map-location-label-${created.id}`)?.textContent).toBe(created.name);

      expect(renameSelectedLocation(created.id, "정문 광장").ok).toBe(true);
      expect(testId(`map-location-label-${created.id}`)?.textContent).toBe("정문 광장");
      expect(testId("map-location-id")?.textContent).toContain(created.id);

      expect(resizeLocation(created.id, { x: 1, y: 1, w: 9, h: 9 }).ok).toBe(true);
      expect((testId("map-location-rect-w") as HTMLInputElement).value).toBe("9");
      // ID 는 이름·크기 변경을 모두 견딘다.
      expect(currentLocations()[0]?.id).toBe(created.id);

      expect(deleteLocation(created.id).ok).toBe(true);
      expect(currentLocations()).toHaveLength(0);
      expect(locationLayerState().selectedId).toBeNull();
      expect(testId("map-location-list")?.textContent).toContain("아직 구역이 없습니다");
    });

    it("warns about overlap without blocking it", () => {
      mount();
      setLocationLayerEnabled(true);
      createLocationFromRect({ x: 0, y: 0, w: 10, h: 10 }, "상점가");
      createLocationFromRect({ x: 4, y: 4, w: 2, h: 2 }, "좌판");
      expect(currentLocations()).toHaveLength(2);
      expect(testId("map-location-overlap")?.textContent).toContain("상점가");
    });

    it("shows the reference impact before deletion and a repair path after it", () => {
      mount();
      setLocationLayerEnabled(true);
      createLocationFromRect({ x: 2, y: 2, w: 4, h: 4 }, "정문 광장");
      createLocationFromRect({ x: 12, y: 12, w: 4, h: 4 }, "뒷골목");
      const plaza = currentLocations()[0]!;
      const alley = currentLocations()[1]!;
      store.update((project) => {
        project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: plaza.id } }];
      }, { scope: "map", mapId: MAP_ID, label: "test encounter" });

      selectLocation(plaza.id);
      expect(testId("map-location-refs")?.textContent).toContain("1건");
      const impact = locationDeletionImpact(plaza.id);
      expect(impact?.sites).toHaveLength(1);
      expect(impact?.sites[0]).toContain("인카운터");

      expect(deleteLocation(plaza.id).ok).toBe(true);
      // 참조는 남아 있고 복구 UI 가 드러난다.
      expect(store.getCurrent().maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(plaza.id);
      const broken = testId("map-location-broken");
      expect(broken).not.toBeNull();
      expect(broken?.textContent).toContain(plaza.id);
      expect(testId(`map-location-repair-remap-${plaza.id}`)).not.toBeNull();
      expect(testId(`map-location-repair-detach-${plaza.id}`)).not.toBeNull();

      expect(repairBrokenLocationReferences(plaza.id, { kind: "remap", locationId: alley.id }).ok).toBe(true);
      expect(store.getCurrent().maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(alley.id);
      expect(testId("map-location-broken")).toBeNull();
    });

    it("turning the layer off drops selection and stops rendering boxes", () => {
      mount();
      setLocationLayerEnabled(true);
      createLocationFromRect({ x: 2, y: 2, w: 3, h: 3 }, "구역");
      const id = currentLocations()[0]!.id;
      expect(testId(`map-location-box-${id}`)).not.toBeNull();

      setLocationLayerEnabled(false);
      expect(locationLayerState().selectedId).toBeNull();
      expect(testId(`map-location-box-${id}`)).toBeNull();
      // 데이터는 그대로다 — 레이어를 끈다고 저작물이 사라지지 않는다.
      expect(store.getCurrent().maps[MAP_ID].locations).toHaveLength(1);
    });

    it("camera gestures belong to the camera, not to the overlay", () => {
      mount();
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      const pans: Array<[number, number]> = [];
      const bridge = (armed: () => boolean) => ({
        claim: (point: { button: number; buttons: number; clientX: number; clientY: number }) => {
          if (point.button === 1 || (point.buttons & 4) === 4 || editorState.get().tool === "pan" || armed()) {
            return { kind: "pan" as const, start: () => pans.push([point.clientX, point.clientY]) };
          }
          return null;
        },
      });

      // 「화면 밀기」 도구: 맵을 밀려는 드래그다. 오버레이가 삼키면 구역이 그려진다.
      editorState.set({ tool: "pan" });
      setCanvasPointerBridge(bridge(() => false));
      overlay.dispatchEvent(pointerDownAt(120, 240));
      expect(pans).toEqual([[120, 240]]);
      expect(locationLayerState().drag).toBeNull();
      expect(currentLocations()).toHaveLength(0);

      // 스페이스 팬은 도구와 무관하게 카메라의 것이다.
      editorState.set({ tool: "paint" });
      setCanvasPointerBridge(bridge(() => true));
      overlay.dispatchEvent(pointerDownAt(10, 20));
      expect(pans).toHaveLength(2);
      expect(currentLocations()).toHaveLength(0);

      // 가운데 버튼 드래그도 같은 길로 간다.
      setCanvasPointerBridge(bridge(() => false));
      overlay.dispatchEvent(pointerDownAt(5, 6, { button: 1, buttons: 4 }));
      expect(pans).toHaveLength(3);
      expect(currentLocations()).toHaveLength(0);
    });

    it("오른쪽 버튼은 캔버스의 것 — 브리지 start 호출 + is-yielding 부착 + 레이어 드래그 없음", () => {
      mount();
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      let regionCalls = 0;
      setCanvasPointerBridge({
        claim: (point) => {
          if (point.button === 2) {
            return { kind: "region", start: () => { regionCalls++; } };
          }
          return null;
        },
      });

      overlay.dispatchEvent(pointerDownAt(50, 60, { button: 2, buttons: 2 }));
      expect(regionCalls).toBe(1);
      expect(overlay.classList.contains("is-yielding")).toBe(true);
      expect(locationLayerState().drag).toBeNull();
      expect(currentLocations()).toHaveLength(0);
    });

    it("pointerup 은 is-yielding 을 해제하지 않고 mouseup 이 해제한다 (R5 계약 고정)", () => {
      mount();
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      setCanvasPointerBridge({
        claim: () => ({ kind: "region", start: () => undefined }),
      });

      overlay.dispatchEvent(pointerDownAt(50, 60, { button: 2, buttons: 2 }));
      expect(overlay.classList.contains("is-yielding")).toBe(true);

      // pointerup 은 mouseup 보다 먼저 발생하므로 is-yielding 을 해제해서는 안 된다
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      expect(overlay.classList.contains("is-yielding")).toBe(true);

      // mouseup 시점에 정상 복원
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      expect(overlay.classList.contains("is-yielding")).toBe(false);
    });

    it("제스처 중 레이어를 비활성화하면 is-yielding 이 즉시 정리된다 (R3)", () => {
      mount();
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      setCanvasPointerBridge({
        claim: () => ({ kind: "region", start: () => undefined }),
      });

      overlay.dispatchEvent(pointerDownAt(50, 60, { button: 2, buttons: 2 }));
      expect(overlay.classList.contains("is-yielding")).toBe(true);

      // 레이어 OFF
      setLocationLayerEnabled(false);
      expect(overlay.classList.contains("is-yielding")).toBe(false);
    });

    it("claim('region')은 preventDefault 를 호출하지 않고(호환 마우스 이벤트 보존), claim('pan')은 호출한다", () => {
      mount();
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;

      let regionStarted = false;
      setCanvasPointerBridge({
        claim: (point) => {
          if (point.button === 2) {
            return { kind: "region", start: () => { regionStarted = true; } };
          }
          return null;
        },
      });

      const regionEvent = pointerDownAt(50, 60, { button: 2, buttons: 2 });
      overlay.dispatchEvent(regionEvent);
      expect(regionStarted).toBe(true);
      expect(regionEvent.defaultPrevented).toBe(false);

      let panStarted = false;
      setCanvasPointerBridge({
        claim: (point) => {
          if (point.button === 1) {
            return { kind: "pan", start: () => { panStarted = true; } };
          }
          return null;
        },
      });

      const panEvent = pointerDownAt(50, 60, { button: 1, buttons: 4 });
      overlay.dispatchEvent(panEvent);
      expect(panStarted).toBe(true);
      expect(panEvent.defaultPrevented).toBe(true);
    });

    it("단독 pointerup 은 is-yielding 을 동기적으로 해제하지 않고 지연된 매크로태스크 후 해제한다", async () => {
      mount();
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      setCanvasPointerBridge({
        claim: () => ({ kind: "region", start: () => undefined }),
      });

      overlay.dispatchEvent(pointerDownAt(50, 60, { button: 2, buttons: 2 }));
      expect(overlay.classList.contains("is-yielding")).toBe(true);

      // pointerup 발생 직후(동기)에는 여전히 is-yielding 유지
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      expect(overlay.classList.contains("is-yielding")).toBe(true);

      // 매크로태스크 1회 대기 후에는 해제되어야 한다
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(overlay.classList.contains("is-yielding")).toBe(false);
    });

    it("claim('scene') 경로: start() 가 실행되고 로케이션 드래그가 시작되지 않으며 is-yielding 이 붙지 않는다", () => {
      mount();
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      let sceneCalls = 0;
      setCanvasPointerBridge({
        claim: () => ({ kind: "scene", start: () => { sceneCalls++; } }),
      });

      const sceneEvent = pointerDownAt(50, 60, { button: 0, buttons: 1 });
      overlay.dispatchEvent(sceneEvent);

      expect(sceneCalls).toBe(1);
      expect(overlay.classList.contains("is-yielding")).toBe(false);
      expect(locationLayerState().drag).toBeNull();
      expect(currentLocations()).toHaveLength(0);
    });

    it("좌클릭은 여전히 오버레이의 것이다 — 카메라 브리지가 있어도", () => {
      mount();
      setLocationLayerEnabled(true);
      const pans: Array<[number, number]> = [];
      setCanvasPointerBridge({
        claim: (point) => {
          if (point.button === 1) {
            return { kind: "pan", start: () => pans.push([point.clientX, point.clientY]) };
          }
          return null;
        },
      });
      editorState.set({ tool: "paint" });

      // 카메라 좌표 해석기가 없으면(null) 제스처를 시작하지 않는다 — 좌표를 지어내지 않는다.
      testId("map-location-layer")!.dispatchEvent(pointerDownAt(120, 240));
      expect(pans).toEqual([]);
      expect(locationLayerState().drag).toBeNull();
    });

    it("카메라가 움직이면 상자 좌표만 다시 쓰고 인스펙터는 다시 만들지 않는다", () => {
      mount();
      setLocationLayerEnabled(true);
      let originX = 300;
      // 카메라가 움직이면 타일 → 화면 변환이 통째로 밀린다. 그 밀림을 흉내 낸다
      // (16px 타일 · zoom 2 = 타일당 32px, seedProject 의 tileSize 와 맞춘다).
      const px = 16 * 2;
      setRegionClientRectResolver((region) => ({
        x: originX + region.x * px,
        y: 100 + region.y * px,
        width: region.width * px,
        height: region.height * px,
      }));
      createLocationFromRect({ x: 2, y: 3, w: 4, h: 5 }, "정문 광장");
      const id = currentLocations()[0]!.id;
      const box = testId(`map-location-box-${id}`)!;
      const nameInput = testId("map-location-name-input");
      expect(box.style.left).toBe(`${300 + 2 * px}px`);
      expect(box.style.top).toBe(`${100 + 3 * px}px`);

      originX = 120;
      repositionMapLocationLayer();

      expect(box.style.left).toBe(`${120 + 2 * px}px`);
      expect(box.style.width).toBe(`${4 * px}px`);
      // 노드는 그대로다 — 팬 중에 이름을 입력하고 있을 수 있다.
      expect(testId(`map-location-box-${id}`)).toBe(box);
      expect(testId("map-location-name-input")).toBe(nameInput);
      // 그리고 데이터는 손대지 않는다: 좌표는 카메라가 아니라 저작물의 것이다.
      expect(currentLocations()[0]).toMatchObject({ x: 2, y: 3, w: 4, h: 5 });

      // 레이어를 끄면 재배치할 것도 없다.
      setLocationLayerEnabled(false);
      expect(() => repositionMapLocationLayer()).not.toThrow();
    });

    it("휠은 캔버스로 넘어간다 — 레이어를 켠 동안에도 맵을 휠로 밀 수 있다", () => {
      mount();
      const host = document.querySelector<HTMLElement>(".phaser-container")!;
      const canvas = document.createElement("canvas");
      host.append(canvas);
      setLocationLayerEnabled(true);
      const seen: WheelEvent[] = [];
      canvas.addEventListener("wheel", event => seen.push(event as WheelEvent));

      const wheel = new WheelEvent("wheel", { deltaX: 3, deltaY: 120, clientX: 30, clientY: 40, ctrlKey: true, bubbles: true, cancelable: true });
      testId("map-location-layer")!.dispatchEvent(wheel);

      expect(seen).toHaveLength(1);
      expect(seen[0]?.deltaY).toBe(120);
      // 원본은 취소된다 — Ctrl+휠이 브라우저 페이지 확대로 새지 않는다.
      expect(wheel.defaultPrevented).toBe(true);
    });

    it("같은 칸 클릭은 구역을 만들지 않고 드래그만 만든다", () => {
      mount();
      setClientPointTileResolver(({ x, y }) => ({ x: Math.floor(x / 16), y: Math.floor(y / 16) }));
      setRegionClientRectResolver((region) => ({
        x: region.x * 16,
        y: region.y * 16,
        width: region.width * 16,
        height: region.height * 16,
      }));
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 40, clientY: 40, button: 0 }));
      overlay.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: 40, clientY: 40, button: 0 }));
      expect(currentLocations()).toHaveLength(0);

      overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 40, clientY: 40, button: 0 }));
      overlay.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX: 88, clientY: 72, button: 0 }));
      overlay.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: 88, clientY: 72, button: 0 }));
      expect(currentLocations()).toHaveLength(1);
      expect(currentLocations()[0]).toMatchObject({ x: 2, y: 2, w: 4, h: 3 });
    });

    it("Shift+클릭은 1칸 구역을 만든다 — 문·단상용 명시 통로", () => {
      mount();
      setClientPointTileResolver(({ x, y }) => ({ x: Math.floor(x / 16), y: Math.floor(y / 16) }));
      setLocationLayerEnabled(true);
      const overlay = testId("map-location-layer")!;
      overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 40, clientY: 40, button: 0 }));
      overlay.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: 40, clientY: 40, button: 0, shiftKey: true }));
      expect(currentLocations()).toHaveLength(1);
      expect(currentLocations()[0]).toMatchObject({ x: 2, y: 2, w: 1, h: 1 });
    });

    it("참조 0건이면 쓰는 법을 말하고 인카운터로 가는 버튼을 낸다", () => {
      mount();
      setLocationLayerEnabled(true);
      createLocationFromRect({ x: 1, y: 1, w: 3, h: 3 }, "광장");
      expect(testId("map-location-refs")?.textContent).toContain("랜덤 전투");
      expect(testId("map-location-open-encounter")).not.toBeNull();

      const id = currentLocations()[0]!.id;
      store.update((project) => {
        project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];
      }, { scope: "map", mapId: MAP_ID, label: "test encounter" });
      expect(testId("map-location-refs")?.textContent).toContain("참조 1건");
      expect(testId("map-location-ref-site-0")?.textContent).toContain("랜덤 전투 1번");
    });

    it("참조 숫자는 현재 맵만 센다 — loc1 은 맵마다 다시 쓰인다", () => {
      mount();
      setLocationLayerEnabled(true);
      createLocationFromRect({ x: 1, y: 1, w: 3, h: 3 }, "광장");
      const id = currentLocations()[0]!.id;
      // 다른 맵에 같은 ID(loc1)의 다른 장소가 있다고 가정한다.
      store.update((project) => {
        const other = structuredClone(project.maps[MAP_ID]);
        other.id = "layer_map_other";
        other.name = "다른 맵";
        other.locations = [{ ...project.maps[MAP_ID].locations![0]!, name: "다른 광장" }];
        other.encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];
        project.maps[other.id] = other;
      }, { scope: "project", label: "test other map" });

      // 이 맵에는 참조가 없다 — 다른 맵의 같은 ID 를 세면 거짓말이 된다.
      expect(testId("map-location-refs")?.textContent).toContain("이벤트 조건");
      expect(testId("map-location-open-encounter")).not.toBeNull();
      expect(testId("map-location-ref-site-0")).toBeNull();
    });
  });
});
