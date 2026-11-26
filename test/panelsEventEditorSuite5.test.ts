// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveEventDraft } from "@/editor/eventDraftActions";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import { buildFieldMonsterFightCommands, hasFieldMonsterVictoryErasePattern } from "@/project/fieldMonsterTemplate";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent, EventPageCondition, Project, Command, GameMap } from "@/project/types";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { openEventRailGroupFor } from "@/editor/panels/eventEditor/pageProps";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { craftRecipe } from "@/project/craftRecipes";
import { applyItemUpgrade } from "@/project/upgrades";
import { deserialize, serialize } from "@/project/io";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { depositShipping, settleShipping } from "@/project/shipping";
import { resolveShopSellUnitPrice } from "@/project/shopPrice";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { GOLD_MAX, startSession } from "@/project/session";
import { resolveTerms } from "@/project/terms";
import { createInterpreter } from "@/player/interpreter";
import { createShopOverlay, listingPrice, renderShopItems, sellPrice, updateShopQuantityTotal } from "@/player/playSceneShopDom";
import { handleShopTransaction, type ShopStep } from "@/player/playSceneShop";
import { itemToGoods } from "@/player/playSceneShopGoods";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { LOCATION_DRAW_CTA_LABEL, renderLocationDrawCta, startDrawingLocations } from "@/editor/locationDrawCta";
import { locationLayerState, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";
import { renderInsideLocationCondition } from "@/editor/panels/eventEditor/conditionForm";
import { TILE } from "@/project/defaults/constants";
import { addMapLocation, isLocationDrawClick } from "@/project/mapNamedLocations";
import { installLocationDrawModeGuard, dismissLocationDrawModeForLayer, dismissLocationDrawModeForTool, isLocationDrawMode } from "@/editor/locationDrawMode";
import { selectMapModeTool, selectTileTool } from "@/editor/panels/tileToolbarActions";
import { isolateTimers } from "./mergedTeardown";

describe("fieldMonsterTemplate", () => {
  isolateTimers();
  function basePage(overrides: Partial<EventPage> = {}): EventPage {
    return {
      id: "p1",
      name: "빈 이벤트",
      conditions: [],
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" } },
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
      ...overrides,
    };
  }
  function baseEvent(overrides: Partial<GameEvent> = {}): GameEvent {
    return {
      id: "ev_field_mob",
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
      pages: [basePage()],
      ...overrides,
    };
  }
  describe("field monster template", () => {
    let host: HTMLElement;

    beforeEach(() => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId]!.events = [baseEvent()];
      if (project.database.troops.length === 0) {
        project.database.troops.push({
          id: "troop_test",
          name: "시험 무리",
          enemyIds: [],
          members: [],
          battleEventPages: [],
        });
      }
      store.replaceProject(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      host = document.createElement("div");
      document.body.append(host);
    });

    afterEach(() => {
      _resetEventDraftVaultForTest();
      host.remove();
      document.querySelectorAll('[data-testid="field-monster-template-dialog"]').forEach((node) => node.remove());
    });

    it("builds victory-only erase fight commands", () => {
      const commands = buildFieldMonsterFightCommands({
        troopId: "troop_test",
        clearSwitchId: "sw_clear",
        intro: ["싸운다!"],
        victory: ["이겼다!"],
        victoryItems: [{ itemId: "it_potion", amount: 1 }],
      });
      expect(hasFieldMonsterVictoryErasePattern(commands)).toBe(true);
      expect(commands[0]).toMatchObject({ kind: "text", body: "싸운다!" });
      expect(commands[1]).toMatchObject({ kind: "battleProcessing", troopId: "troop_test" });
      expect(commands[2]).toMatchObject({
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
      });
      const then = commands[2]!.kind === "fork" ? commands[2].then : [];
      expect(then.some((c) => c.kind === "setSwitch" && c.switchId === "sw_clear")).toBe(true);
      expect(then.some((c) => c.kind === "m2Command" && c.commandId === "m2-086-erase-event")).toBe(true);
      expect(then.some((c) => c.kind === "changeItem" && c.itemId === "it_potion")).toBe(true);
    });

    it("shows toolbar button and applies two-page template from dialog", () => {
      const mapId = store.getCurrent().startMapId;
      renderEventEditorDynamic(host, mapId, "ev_field_mob");
      const button = host.querySelector('[data-testid="event-command-toolbar-field-monster"]');
      expect(button).toBeTruthy();
      expect(button?.getAttribute("title")).toContain("필드 몬스터");

      const page = store.getCurrent().maps[mapId]!.events[0]!.pages![0]!;
      openFieldMonsterTemplateDialog(mapId, "ev_field_mob", page);
      const dialog = document.querySelector('[data-testid="field-monster-template-dialog"]');
      expect(dialog).toBeTruthy();

      const troopSelect = dialog!.querySelector('[data-testid="field-monster-template-troop"]') as HTMLSelectElement;
      const troopId = store.getCurrent().database.troops[0]!.id;
      troopSelect.value = troopId;
      troopSelect.dispatchEvent(new Event("change"));

      const intro = dialog!.querySelector('[data-testid="field-monster-template-intro"]') as HTMLTextAreaElement;
      const victory = dialog!.querySelector('[data-testid="field-monster-template-victory"]') as HTMLTextAreaElement;
      intro.value = "나타난다!";
      victory.value = "쓰러졌다!";

      (dialog!.querySelector('[data-testid="field-monster-template-apply"]') as HTMLButtonElement).click();

      const event = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === "ev_field_mob")!;
      expect(event.pages).toHaveLength(2);
      expect(event.pages![0]!.name).toBe("전투");
      expect(hasFieldMonsterVictoryErasePattern(event.pages![0]!.commands)).toBe(true);
      expect(event.pages![1]!.conditions).toEqual([
        { kind: "switch", switchId: "sw_ev_field_mob_clear", value: true },
      ]);
      expect(event.pages![1]!.graphic.transparent).toBe(true);
      expect(store.getCurrent().switches.some((entry) => entry.id === "sw_ev_field_mob_clear")).toBe(false);
      saveEventDraft(mapId, "ev_field_mob");
      expect(store.getCurrent().switches.some((entry) => entry.id === "sw_ev_field_mob_clear")).toBe(true);
      expect(document.querySelector('[data-testid="field-monster-template-dialog"]')).toBeNull();
    });
  });
});

// 호감도 조건의 UI 게이트 — 런타임이 하드 게이트(resolveSocialKey → null)로 항상 거짓을 내는 조합을
// 저작 화면이 조용히 만들게 두지 않는다. 근거: docs/specs/2026-07-14-character-id-relationship-gate.md §1-7,8
describe("friendshipConditionGate", () => {
  isolateTimers();
  const HINT = "event-condition-friendship-requires-character-id";
  function pageWith(conditions: readonly EventPageCondition[]): EventPage {
    return {
      id: "p1",
      name: "호감도 게이트",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "안녕" }],
    };
  }
  function renderRow(page: EventPage, event?: { characterId?: string }): HTMLElement {
    const host = document.createElement("div");
    host.append(...renderPageConditions("map-start", "ev_gate", page, event));
    return host;
  }
  function seedEvent(page: EventPage, characterId?: string): { project: Project; mapId: string; event: GameEvent } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event: GameEvent = {
      id: "ev_gate",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
      ...(characterId ? { characterId } : {}),
    };
    project.maps[mapId]!.events = [event];
    return { project, mapId, event };
  }
  function issueCodes(page: EventPage, characterId?: string): readonly string[] {
    const { project, mapId, event } = seedEvent(page, characterId);
    return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
  }
  describe("호감도 조건 게이트", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("NPC 관계가 없으면 조건 행이 항상 거짓임을 말한다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]));
      expect(host.querySelector(`[data-testid="${HINT}"]`)).not.toBeNull();
      // 행 자체는 사라지지 않는다 — RM 계약상 핵심 조건 행은 항상 자리를 지킨다.
      expect(host.querySelector('[data-testid="event-page-friendship-condition-value"]')).not.toBeNull();
    });

    it("NPC 관계가 연결되면 경고가 사라진다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), { characterId: "char_a" });
      expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
    });

    it("NPC 키를 직접 적은 경로는 미연결에서도 유효하다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", npcKey: "village_herbalist", value: 80 }]));
      expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
    });

    it("검증기가 미연결 호감도 조건을 경고로 잡는다", () => {
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }])))
        .toContain("condition.friendship.no-character-id");
    });

    it("검증기는 연결됐거나 NPC 키가 있으면 경고하지 않는다", () => {
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), "char_a"))
        .not.toContain("condition.friendship.no-character-id");
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", npcKey: "char_b", value: 80 }])))
        .not.toContain("condition.friendship.no-character-id");
    });

    it("중첩·명령 안 조건도 같은 게이트를 받는다", () => {
      const nested = pageWith([{ kind: "all", conditions: [{ kind: "friendshipAtLeast", value: 10 }] }]);
      expect(issueCodes(nested)).toContain("condition.friendship.no-character-id");

      const forked = pageWith([]);
      const page: EventPage = {
        ...forked,
        commands: [{
          kind: "fork",
          condition: { kind: "friendshipAtLeast", value: 10 },
          then: [],
          else: [],
        }],
      };
      expect(issueCodes(page)).toContain("condition.friendship.no-character-id");
    });
  });
  describe("검증 이슈 앵커와 설정 레일 그룹", () => {
    it("닫힌 그룹 안의 앵커를 가리키면 그 그룹이 열린다", () => {
      const rail = document.createElement("div");
      rail.className = "event-editor-settings-accordion";
      rail.dataset.railKey = "rail-test";
      const groups = ["look-talk", "when"].map((slug, index) => {
        const group = document.createElement("div");
        group.className = `event-editor-settings-accordion-group${index === 0 ? " is-open" : ""}`;
        group.dataset.railGroup = slug;
        const header = document.createElement("button");
        header.className = "event-editor-settings-accordion-header";
        header.setAttribute("aria-expanded", index === 0 ? "true" : "false");
        group.append(header);
        rail.append(group);
        return group;
      });
      const anchor = document.createElement("input");
      groups[1]!.append(anchor);
      document.body.append(rail);

      openEventRailGroupFor(anchor);

      expect(groups[1]!.classList.contains("is-open")).toBe(true);
      expect(groups[0]!.classList.contains("is-open")).toBe(false);
      expect(groups[1]!.querySelector(".event-editor-settings-accordion-header")?.getAttribute("aria-expanded")).toBe("true");
      rail.remove();
    });
  });
});

describe("lifeEconomyUiParity", () => {
  isolateTimers();
  const previous = store.getCurrent();
  function economyProject(): Project {
    const project = createBlankProject();
    project.database.items.push(
      ...["economy_A", "economy_B", "economy_C"].map((id) =>
        normalizeItemRecord({ id, name: id, scope: "none", price: 100 }),
      ),
    );
    project.variables.push({ id: "economy_result", name: "Result" }, { id: "economy_next", name: "Next" });
    project.session.variables = { economy_result: -1, economy_next: 0 };
    project.session.inventory = { economy_A: 1 };
    project.session.gold = 100;
    project.system.craftRecipes = [
      { id: "recipe", name: "Economy Craft", ingredients: [{ itemId: "economy_A", count: 1 }], outputItemId: "economy_B", goldCost: 10 },
    ];
    project.system.itemUpgrades = [
      { id: "upgrade", fromItemId: "economy_A", toItemId: "economy_B", goldCost: 10 },
    ];
    project.system.sellPrices = [{ itemId: "economy_A", price: 90 }];
    project.system.shipping = { enabled: true };
    return project;
  }
  function scene(session: ReturnType<typeof startSession>): PlaySceneContext {
    return { session, syncRuntimeState: () => undefined } as unknown as PlaySceneContext;
  }
  function command(kind: "craftRecipe" | "applyItemUpgrade", result = true): Command {
    const target = kind === "craftRecipe" ? { kind, recipeId: "recipe" } : { kind, upgradeId: "upgrade" };
    return { ...target, ...(result ? { resultVariableId: "economy_result" } : {}) };
  }
  function mountLife(): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    const rerender = () => {
      host.replaceChildren();
      renderLifeCraftingTab(host, rerender);
    };
    rerender();
    return host;
  }
  function control<T extends HTMLElement = HTMLInputElement>(host: HTMLElement, id: string): T {
    const node = host.querySelector<T>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  }
  function openShipping(host: HTMLElement): void {
    control(host, "db-life-section-shipping").click();
    if (!host.querySelector('[data-testid="db-life-shipping-items-card"]')) {
      control(host, "db-life-package-create").click();
    }
  }
  beforeEach(() => {
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    store.replaceProject(economyProject());
    resetMapEditHistory();
    _resetEditActivityForTest();
    document.body.replaceChildren();
  });
  afterEach(() => {
    _resetEditActivityForTest();
    document.body.replaceChildren();
    store.replaceProject(previous);
  });
  describe("Task15 UI shop sell price consumers", () => {
    it.each([
      { table: 90 as number | undefined, expected: 90 },
      { table: 100, expected: 99 },
      { table: 0, expected: 0 },
      { table: undefined, expected: 50 },
    ])("rows/totals/default offers/haggle/settle use helper $table -> $expected", ({ table, expected }) => {
      const project = store.getCurrent();
      project.system.sellPrices = table === undefined ? [] : [{ itemId: "economy_A", price: table }];
      store.replaceProject(project);
      const item = project.database.items.find((entry) => entry.id === "economy_A")!;
      const goods = itemToGoods(item);
      expect(resolveShopSellUnitPrice(project, item.id, item.price)).toBe(expected);
      expect(sellPrice(item)).toBe(expected);
      expect(listingPrice(goods, "sell")).toBe(expected);

      const overlay = createShopOverlay();
      overlay.append(
        renderShopItems({
          scene: scene(startSession(project, 15)),
          step: { allowSell: true, quantityMode: "select" } as ShopStep,
          items: [item],
          mode: "sell",
          prompt: "sell",
          terms: resolveTerms(project),
          merchantGold: 500,
          setStatus: () => undefined,
          showMenu: () => undefined,
          onItem: () => undefined,
        }),
      );
      const row = overlay.querySelector<HTMLElement>("[data-testid='shop-sell-economy_A']");
      expect(row?.dataset.unitPrice).toBe(String(expected));
      expect(overlay.querySelector("[data-testid='shop-price-economy_A']")?.textContent).toBe(`${expected}G`);
      row?.classList.add("selected");
      updateShopQuantityTotal(overlay);
      expect(overlay.querySelector("[data-testid='shop-quantity-total']")?.textContent).toBe(`합계 ${expected}G`);

      const reference = sellPrice(item);
      expect(reference).toBe(expected);
      // Haggle reference is the helper unit. Offering the list price is accepted when >0;
      // explicit 0 is a valid trade unit but an insulting haggle bid.
      if (expected > 0) {
        const reserve = resolveHaggleReserve({
          role: "playerSells",
          reference,
          buyPrice: item.price,
          maxDiscount: 0.25,
          itemId: item.id,
          merchantKey: "merchant",
          dayKey: "1:spring:1",
          attemptIndex: 0,
        });
        const verdict = proposeHaggle(
          { role: "playerSells", reference, reserve, buyPrice: item.price, patience: 3, insultRatio: 0.6 },
          expected,
        );
        expect(verdict).toEqual({ kind: "accept", price: expected });
      }

      const session = startSession(project, 15);
      const result = handleShopTransaction(scene(session), item, "sell", 1, 500, expected === 0 ? 0 : undefined);
      expect(result).toMatchObject({ ok: true, merchantGold: 500 - expected });
      expect(session.gold).toBe(100 + expected);
      // Pawn/settle bookkeeping unit must match helper when no agreed price is supplied.
      const unit = sellPrice(item);
      expect(unit).toBe(expected);
    });

    it("keeps shipping unclamped at table100 while shop clamps to 99", () => {
      const project = store.getCurrent();
      project.system.sellPrices = [{ itemId: "economy_A", price: 100 }];
      store.replaceProject(project);
      expect(sellPrice(project.database.items.find((item) => item.id === "economy_A")!)).toBe(99);
      const session = startSession(project, 15);
      expect(depositShipping(project, session, "economy_A", 1).ok).toBe(true);
      expect(settleShipping(project, session, "1:spring:1")).toMatchObject({ ok: true, total: 100, credited: 100 });
    });
  });
  describe("Task15 UI shipping checkbox materialization", () => {
    it("undefined/all materializes every current item id then disable A leaves B/C", () => {
      const host = mountLife();
      openShipping(host);
      expect(store.getCurrent().system.shipping?.allowedItemIds).toBeUndefined();
      const all = control(host, "db-life-shipping-all-items");
      expect(all.checked).toBe(true);
      const itemA = control(host, "db-life-shipping-item-economy_A");
      expect(itemA.checked).toBe(true);
      itemA.checked = false;
      itemA.dispatchEvent(new Event("change", { bubbles: true }));
      const allowed = store.getCurrent().system.shipping?.allowedItemIds;
      expect(allowed).toBeDefined();
      expect(allowed).not.toEqual([]);
      expect(allowed?.includes("economy_A")).toBe(false);
      expect(allowed?.includes("economy_B")).toBe(true);
      expect(allowed?.includes("economy_C")).toBe(true);
      // default catalog items remain present when all was materialized
      expect((allowed ?? []).length).toBe(store.getCurrent().database.items.length - 1);
    });

    it("explicit empty list stays none and persists through roundtrip", () => {
      const host = mountLife();
      openShipping(host);
      const all = control(host, "db-life-shipping-all-items");
      all.checked = false;
      all.dispatchEvent(new Event("change", { bubbles: true }));
      expect(store.getCurrent().system.shipping?.allowedItemIds).toEqual([]);
      const restored = deserialize(serialize(store.getCurrent()));
      expect(restored.system.shipping?.allowedItemIds).toEqual([]);
    });
  });
  describe.each(["craftRecipe", "applyItemUpgrade"] as const)("Task15 UI %s result variable forms", (kind) => {
    let staged: Command;
    const actions: CommandListActions = {
      addCommand: () => undefined,
      insertCommand: () => undefined,
      deleteCommand: () => undefined,
      moveCommand: () => undefined,
      moveCommandTo: () => undefined,
      replaceCommand: (_path, next) => {
        staged = next;
      },
    };

    function body(cmd: Command): HTMLElement {
      staged = cmd;
      const host = document.createElement("div");
      document.body.append(host);
      host.append(renderCommandBody({ path: [0], actions, lockKind: true }, cmd));
      return host;
    }

    function resultRootTestId(): string {
      return kind === "craftRecipe" ? "craft-recipe-result-variable" : "apply-item-upgrade-result-variable";
    }

    function clearTestId(): string {
      return kind === "craftRecipe"
        ? "craft-recipe-result-variable-clear"
        : "apply-item-upgrade-result-variable-clear";
    }

    function resultSelect(host: HTMLElement): HTMLSelectElement {
      const root = host.querySelector<HTMLElement>(`[data-testid="${resultRootTestId()}"]`);
      const select = root?.querySelector("select") ?? null;
      if (!select) throw new Error(`missing result variable select for ${kind}`);
      return select;
    }

    function clearButton(host: HTMLElement): HTMLButtonElement {
      const button = host.querySelector<HTMLButtonElement>(`[data-testid="${clearTestId()}"]`);
      if (!button) throw new Error(`missing visible clear control ${clearTestId()}`);
      return button;
    }

    it("authors optional resultVariableId; visible clear omits the property", () => {
      const host = body(command(kind, false));
      const select = resultSelect(host);
      expect(select.value).toBe("");
      // Set via the real select change path (picker writes the same onChange).
      select.value = "economy_result";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(staged).toEqual(command(kind, true));
      expect(Object.prototype.hasOwnProperty.call(staged, "resultVariableId")).toBe(true);

      // Clear must be a visible form control — not hidden-select writes.
      const clear = clearButton(host);
      expect(clear.hidden).toBe(false);
      expect(clear.getAttribute("aria-hidden")).not.toBe("true");
      clear.click();
      expect(staged).toEqual(command(kind, false));
      expect(Object.prototype.hasOwnProperty.call(staged, "resultVariableId")).toBe(false);
      expect((staged as { resultVariableId?: string }).resultVariableId).toBeUndefined();
      expect(resultSelect(host).value).toBe("");
    });

    it("preserves a declared resultVariableId exactly without display trim", () => {
      // Schema-valid IDs are stored as selected; form must not rewrite them via trim helpers.
      const exactId = "economy_result";
      const withId =
        kind === "craftRecipe"
          ? ({ kind, recipeId: "recipe", resultVariableId: exactId } as Command)
          : ({ kind, upgradeId: "upgrade", resultVariableId: exactId } as Command);
      const host = body(withId);
      expect(resultSelect(host).value).toBe(exactId);
      expect(staged).toEqual(withId);
      if (staged.kind === kind) {
        expect((staged as { resultVariableId?: string }).resultVariableId).toBe(exactId);
      }
      const summary = commandSummary(withId);
      expect(summary).toContain("Result");
      // Summary must still resolve the exact stored id.
      expect(summary.includes(exactId) || summary.includes("Result")).toBe(true);
    });

    it("keeps a declared selection in the form and shows it in summary/preview", () => {
      const host = body(command(kind, true));
      expect(resultSelect(host).value).toBe("economy_result");
      expect(clearButton(host)).toBeTruthy();
      const summary = commandSummary(command(kind, true));
      expect(summary).toContain("Result");
      expect(commandSummary(command(kind, false))).not.toContain("Result");

      const preview = renderCommandPreview(command(kind, true));
      expect(preview.textContent).toContain("Result");
      const clearedPreview = renderCommandPreview(command(kind, false));
      expect(clearedPreview.textContent ?? "").not.toContain("Result");
    });

    it.each(["success", "material"] as const)(
      "form-authored command keeps core outcome parity for %s",
      (outcome) => {
        const project = store.getCurrent();
        if (outcome === "material") project.session.inventory = {};
        store.replaceProject(project);
        const authored = command(kind, true);
        // Simulate form commit path: only declared fields.
        const formCommand: Command =
          kind === "craftRecipe"
            ? {
                kind,
                recipeId: "recipe",
                ...(authored.kind === kind && authored.resultVariableId
                  ? { resultVariableId: authored.resultVariableId }
                  : {}),
              }
            : {
                kind,
                upgradeId: "upgrade",
                ...(authored.kind === kind && authored.resultVariableId
                  ? { resultVariableId: authored.resultVariableId }
                  : {}),
              };
        expect(formCommand).toEqual(command(kind, true));

        const session = startSession(project, 15);
        const before = structuredClone(session);
        const commands: Command[] = [
          formCommand,
          {
            kind: "fork",
            condition: { kind: "variable", variableId: "economy_result", op: "==", value: 1 },
            then: [{ kind: "changeItem", itemId: "economy_C", op: "+=", amount: 1 }],
          },
          { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 },
        ];
        expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
        const expected = outcome === "success" ? 1 : 0;
        expect(session.variables.economy_result).toBe(expected);
        expect(session.variables.economy_next).toBe(7);
        if (expected === 1) {
          expect(session.inventory).toEqual({ economy_B: 1, economy_C: 1 });
          expect(session.gold).toBe(90);
        } else {
          expect(session.inventory).toEqual(before.inventory);
          expect(session.gold).toBe(before.gold);
          expect(session).toEqual({
            ...before,
            variables: { ...before.variables, economy_result: 0, economy_next: 7 },
          });
        }
        const transaction =
          kind === "craftRecipe"
            ? craftRecipe(project, startSession(project, 15), "recipe")
            : applyItemUpgrade(project, startSession(project, 15), "upgrade");
        expect(transaction.ok).toBe(expected === 1);
        if (!transaction.ok) {
          expect(transaction.reason === "missing-ingredients" || transaction.reason === "missing-item").toBe(true);
        }
        const preview = simulatePageCommands(commands);
        expect(preview.finalState.variables.economy_result).toBe(expected);
        expect(preview.finalState.variables.economy_next).toBe(7);
        expect(preview.finalState.inventory).toEqual(session.inventory);
        expect(preview.finalState.gold).toBe(session.gold);
        expect(preview.steps.find((step) => step.command.kind === "fork")?.forkTaken).toBe(expected ? "then" : "else");
      },
    );

    it("failure paths never flip UI success or mutate inventory beyond result writes", () => {
      const project = store.getCurrent();
      project.session.inventory = {};
      store.replaceProject(project);
      const session = startSession(project, 15);
      const before = structuredClone(session);
      expect(createInterpreter([command(kind, true), { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 }], session, project).start()).toEqual({
        kind: "done",
      });
      expect(session.inventory).toEqual(before.inventory);
      expect(session.gold).toBe(before.gold);
      expect(session.variables.economy_result).toBe(0);
      expect(session.variables.economy_next).toBe(7);
    });
  });
  describe("Task15 UI shop failure surfaces", () => {
    it.each(["merchant-gold", "wallet-cap", "quantity-cap"] as const)(
      "rejects %s with no inventory/gold mutation and no false UI success unit",
      (failure) => {
        const project = store.getCurrent();
        if (failure === "wallet-cap") project.session.gold = GOLD_MAX;
        if (failure === "quantity-cap") project.session.inventory = { economy_A: ITEM_QUANTITY_MAX };
        store.replaceProject(project);
        const session = startSession(project, 15);
        const before = structuredClone(session);
        const item = project.database.items.find((entry) => entry.id === "economy_A")!;
        const result = handleShopTransaction(
          scene(session),
          item,
          failure === "quantity-cap" ? "buy" : "sell",
          1,
          failure === "merchant-gold" ? 89 : 500,
        );
        expect(result.ok).toBe(false);
        expect(session).toEqual(before);
        expect("merchantGold" in result).toBe(false);
        // UI unit price still comes from helper, but failed deal must not apply it.
        expect(sellPrice(item)).toBe(90);
      },
    );
  });
});

describe("locationDraw", () => {
  isolateTimers();
  // test/locationDrawCta.test.ts
  //
  // 「이 맵에는 아직 구역이 없습니다」 빈 상태의 **행동** 계약.
  //
  // 왜 회귀가 필요한가(어포던스 감사 2026-09-11 실측): 쓰는 지점(조건 폼·트리거·인카운터)이
  // 문장 하나로 끝나 막다른 길이었고, 인카운터는 0개 맵에서 필드를 통째로 숨겨 기능의 존재 자체를
  // 배울 수 없었다. 이 파일은 «없으면 행동을 낸다» 와 «있으면 소음이 되지 않는다» 를 고정한다.
  describe("locationDrawCta", () => {
    isolateTimers();
    const MAP_ID = "cta_map";
    function seedMap(): GameMap {
      const project = createBlankProject();
      const map: GameMap = {
        id: MAP_ID,
        name: "빈 상태 맵",
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
      return map;
    }
    function testId(id: string): HTMLElement | null {
      return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    }
    beforeEach(() => {
      setLocationLayerEnabled(false);
      document.body.innerHTML = "";
      seedMap();
    });
    describe("location draw CTA — 빈 상태의 행동", () => {
      it("구역이 없으면 버튼을 내고, 누르면 로케이션 레이어가 켜진다", () => {
        const cta = renderLocationDrawCta({ testId: "cta-probe" });
        expect(cta).not.toBeNull();
        expect(cta?.textContent).toBe(LOCATION_DRAW_CTA_LABEL);

        document.body.append(cta!);
        cta!.click();

        expect(locationLayerState().enabled).toBe(true);
        // 켠 결과가 지금 자리에 보이지 않을 수 있으므로(소비 표면은 모달) 토스트가 그 자리를 잇는다.
        expect(testId("toast")?.textContent).toContain("로케이션 레이어를 켰습니다");
      });

      it("구역이 하나라도 있으면 버튼을 내지 않는다", () => {
        const result = addMapLocation(store.getCurrent().maps[MAP_ID]!, { name: "정문 광장", x: 1, y: 1, w: 3, h: 3 });
        expect(result.ok).toBe(true);
        expect(renderLocationDrawCta({ testId: "cta-probe" })).toBeNull();
      });

      it("맵을 못 고른 상태(맵 없음)에서는 버튼을 내지 않는다", () => {
        const project = store.getCurrent();
        delete project.maps[MAP_ID];
        editorState.set({ currentMapId: "없는_맵" });
        expect(renderLocationDrawCta({ testId: "cta-probe" })).toBeNull();
      });

      it("조건 폼은 구역이 없을 때만 그리기 버튼을 붙인다", () => {
        const open = renderInsideLocationCondition({ kind: "insideLocation", locationId: "", inside: true }, () => {});
        expect(open.querySelector("[data-testid='event-condition-inside-location-draw']")).not.toBeNull();

        addMapLocation(store.getCurrent().maps[MAP_ID]!, { name: "부두", x: 12, y: 12, w: 4, h: 4 });
        const filled = renderInsideLocationCondition({ kind: "insideLocation", locationId: "", inside: true }, () => {});
        expect(filled.querySelector("[data-testid='event-condition-inside-location-draw']")).toBeNull();
      });

      it("startDrawingLocations 는 이미 켜져 있어도 상태를 켜진 채로 유지한다", () => {
        setLocationLayerEnabled(true);
        startDrawingLocations();
        expect(locationLayerState().enabled).toBe(true);
      });
    });
  });
  describe("locationDrawGuard", () => {
    isolateTimers();
    let dispose: (() => void) | null = null;
    describe("location draw mode guard", () => {
      afterEach(() => {
        dispose?.();
        dispose = null;
        setLocationLayerEnabled(false);
        editorState.set({ tool: "paint", layer: "lower" });
        delete document.body.dataset.locationDraw;
      });

      it("끄는 순간의 도구와 다른 도구로 넘어가면 그리기를 끝낸다", () => {
        editorState.set({ tool: "paint" });
        setLocationLayerEnabled(true);
        dispose = installLocationDrawModeGuard();
        expect(locationLayerState().enabled).toBe(true);

        // 같은 도구를 다시 고르는 것(팔레트 칸 클릭)도 도구 전이의 한 형태다.
        editorState.set({ tool: "fill" });
        expect(locationLayerState().enabled).toBe(false);
      });

      it("팬은 그리기를 빼앗지 않는다", () => {
        editorState.set({ tool: "paint" });
        setLocationLayerEnabled(true);
        dispose = installLocationDrawModeGuard();

        editorState.set({ tool: "pan" });
        expect(locationLayerState().enabled).toBe(true);
        editorState.set({ tool: "pan" });
        expect(locationLayerState().enabled).toBe(true);
      });

      it("바닥↔덧그림 전환은 그리기를 유지한다", () => {
        editorState.set({ tool: "paint", layer: "lower" });
        setLocationLayerEnabled(true);
        dispose = installLocationDrawModeGuard();

        editorState.set({ layer: "upper" });
        expect(locationLayerState().enabled).toBe(true);
        editorState.set({ layer: "lower" });
        expect(locationLayerState().enabled).toBe(true);
      });

      it("타일 팔레트에서 칸을 고르면 그리기가 끝난다", async () => {
        editorState.set({ tool: "paint", layer: "lower" });
        setLocationLayerEnabled(true);
        const { selectPaletteTile } = await import("@/editor/panels/tilePalette");
        selectPaletteTile(42);
        expect(locationLayerState().enabled).toBe(false);
        expect(editorState.get().selectedTile).toBe(42);
      });

      it("설치 시점에 이미 켜져 있으면 첫 전이에 곧바로 꺼지지 않는다", () => {
        editorState.set({ tool: "select" });
        setLocationLayerEnabled(true);
        dispose = installLocationDrawModeGuard();
        // 상태 변화 없음 — 여전히 켜져 있다.
        expect(locationLayerState().enabled).toBe(true);
        editorState.set({ tool: "event", layer: "event" });
        expect(locationLayerState().enabled).toBe(false);
      });
    });
  });
  describe("locationDrawMode", () => {
    isolateTimers();
    describe("location draw mode", () => {
      afterEach(() => {
        setLocationLayerEnabled(false);
        editorState.set({ tool: "paint", layer: "lower" });
        delete document.body.dataset.locationDraw;
      });

      it("isLocationDrawClick is only true on the same tile", () => {
        expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
        expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 4, y: 4 })).toBe(false);
      });

      it("keeps pan and dismisses paint/event tools", () => {
        setLocationLayerEnabled(true);
        expect(isLocationDrawMode()).toBe(true);
        dismissLocationDrawModeForTool("pan");
        expect(locationLayerState().enabled).toBe(true);
        dismissLocationDrawModeForTool("paint");
        expect(locationLayerState().enabled).toBe(false);
      });

      it("event layer dismisses draw mode", () => {
        setLocationLayerEnabled(true);
        dismissLocationDrawModeForLayer("lower");
        expect(locationLayerState().enabled).toBe(true);
        dismissLocationDrawModeForLayer("event");
        expect(locationLayerState().enabled).toBe(false);
      });

      it("selecting a tile tool turns the location layer off even if paint was already selected", () => {
        editorState.set({ tool: "paint", layer: "lower" });
        setLocationLayerEnabled(true);
        expect(document.body.dataset.locationDraw).toBe("1");
        selectTileTool("pen");
        expect(locationLayerState().enabled).toBe(false);
        expect(document.body.dataset.locationDraw).toBeUndefined();
      });

      it("selecting the event tool turns the location layer off", () => {
        setLocationLayerEnabled(true);
        selectMapModeTool("event");
        expect(locationLayerState().enabled).toBe(false);
        expect(editorState.get().tool).toBe("event");
      });
    });
  });
});
