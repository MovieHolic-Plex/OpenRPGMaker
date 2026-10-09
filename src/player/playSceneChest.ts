import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  depositToChest,
  ensureChest,
  findChestAt,
  inventoryEntries,
  withdrawFromChest,
  type ChestState,
} from "@/project/placeables";
import type { ItemId } from "@/project/types";
import type { Command, ItemType } from "@/project/types";
import type { ItemRecord } from "@/project/types/database";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { applyWindowSkinGraphic } from "@/player/systemGraphics";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { el } from "@/util/dom";
import {
  occupiedChestSlots,
  resolveStorageChest,
  storageChestLockState,
  storageChestTabLabel,
  storageChestTabOf,
  transferChestGold,
  type OpenChestFields,
  type ResolvedStorageChest,
  type StorageChestTab,
} from "@/project/storageChest";

export type OpenChestRequest = OpenChestFields & {
  readonly chestId?: string;
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
};

export async function playOpenChest(scene: PlaySceneContext, request: OpenChestRequest): Promise<void> {
  const presentation = resolveStorageChest(request);
  const lock = storageChestLockState(scene.session, presentation);
  if (lock.locked) {
    await showLockedChest(scene, presentation.displayName, lock.reason ?? "잠겨 있습니다.");
    return;
  }
  const chest = resolveChest(scene, request);
  if (!chest) return;
  await openChestUi(scene, chest, presentation);
  scene.syncRuntimeState?.();
  scene.refreshRuntimeSurfaces?.();
}

function resolveChest(scene: PlaySceneContext, request: OpenChestRequest): ChestState | undefined {
  const explicit = request.chestId?.trim();
  if (explicit) {
    return ensureChest(scene.session, {
      id: explicit,
      mapId: request.mapId ?? scene.map.id,
      x: request.x ?? scene.tileX,
      y: request.y ?? scene.tileY,
    });
  }
  const mapId = request.mapId ?? scene.map.id;
  const x = request.x ?? scene.tileX;
  const y = request.y ?? scene.tileY;
  const existing = findChestAt(scene.session, mapId, x, y);
  if (existing) return existing;
  return ensureChest(scene.session, {
    id: `chest_${mapId}_${Math.trunc(x)}_${Math.trunc(y)}`,
    mapId,
    x,
    y,
  });
}

function showLockedChest(scene: PlaySceneContext, title: string, reason: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "runtime-overlay runtime-chest-overlay is-center";
    overlay.dataset.testid = "chest-locked";
    const close = el("button", {
      class: "runtime-chest-cancel",
      text: "닫기",
      attrs: { type: "button" },
      dataset: { testid: "chest-close" },
      on: { click: () => { overlay.remove(); resolve(); } },
    });
    const window = el("div", {
      class: "runtime-chest-window",
      children: [
        el("div", { class: "runtime-chest-title", text: title }),
        el("div", { class: "runtime-chest-status", dataset: { testid: "chest-status" }, text: reason }),
        close,
      ],
    });
    applyWindowSkinGraphic(window as HTMLElement);
    overlay.append(window);
    mountChestOverlay(scene, overlay);
    attachCursorMenu(overlay, { items: [close as HTMLElement], cancelEl: close as HTMLElement, initialIndex: 0 });
  });
}

function openChestUi(scene: PlaySceneContext, chest: ChestState, presentation: ResolvedStorageChest): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = `runtime-overlay runtime-chest-overlay is-${presentation.layout}`;
    overlay.dataset.testid = "chest-scene";
    overlay.dataset.chestTemplate = presentation.template ?? "legacy";

    const status = el("div", {
      class: "runtime-chest-status",
      dataset: { testid: "chest-status" },
    });
    const playerList = el("div", { class: "runtime-chest-list", dataset: { testid: "chest-player-list" } });
    const chestList = el("div", { class: "runtime-chest-list", dataset: { testid: "chest-storage-list" } });
    const capacity = el("div", { class: "runtime-chest-capacity", dataset: { testid: "chest-capacity" } });
    const tabs = el("div", { class: "runtime-chest-tabs", dataset: { testid: "chest-tabs" } });
    const search = el("input", {
      class: "runtime-chest-search",
      attrs: { type: "search", placeholder: "검색", autocomplete: "off" },
      dataset: { testid: "chest-search" },
    }) as HTMLInputElement;
    const qty = el("input", {
      class: "runtime-chest-qty",
      attrs: { type: "number", min: "1", value: "1" },
      dataset: { testid: "chest-qty" },
    }) as HTMLInputElement;
    const cancel = el("button", {
      class: "runtime-chest-cancel",
      text: "닫기",
      attrs: { type: "button" },
      dataset: { testid: "chest-close" },
      on: { click: () => finish() },
    }) as HTMLButtonElement;

    let tab: StorageChestTab = "all";
    let query = "";
    let selectedAmount = 1;

    const window = el("div", { class: "runtime-chest-window" });
    applyWindowSkinGraphic(window as HTMLElement, undefined);
    window.append(
      el("div", { class: "runtime-chest-title", text: presentation.displayName }),
      status,
    );
    if (presentation.showCategories) {
      window.append(tabs, search);
    }
    window.append(
      el("div", {
        class: "runtime-chest-columns",
        children: [
          el("div", {
            class: "runtime-chest-column",
            children: [el("div", { class: "runtime-chest-column-title", text: "소지품" }), playerList],
          }),
          el("div", {
            class: "runtime-chest-column",
            children: [el("div", { class: "runtime-chest-column-title", text: "상자" }), chestList],
          }),
        ],
      }),
      capacity,
      el("div", {
        class: "runtime-chest-toolbar",
        children: [
          el("label", { class: "runtime-chest-qty-label", text: "수량" }),
          qty,
          ...(presentation.allowBulk
            ? [
                qtyButton("1", 1),
                qtyButton("10", 10),
                el("button", {
                  class: "runtime-chest-tool",
                  text: "전부",
                  attrs: { type: "button" },
                  dataset: { testid: "chest-qty-all" },
                  on: { click: () => { qty.value = "all"; } },
                }),
              ]
            : []),
          ...(presentation.allowSort
            ? [el("button", {
                class: "runtime-chest-tool",
                text: "정렬",
                attrs: { type: "button" },
                dataset: { testid: "chest-sort" },
                on: { click: () => { sortInventories(); rebuild(); } },
              })]
            : []),
          cancel,
        ],
      }),
    );
    overlay.append(window);
    mountChestOverlay(scene, overlay);

    function qtyButton(label: string, value: number): HTMLElement {
      return el("button", {
        class: "runtime-chest-tool",
        text: label,
        attrs: { type: "button" },
        dataset: { testid: `chest-qty-${value}` },
        on: { click: () => { qty.value = String(value); selectedAmount = value; } },
      });
    }

    let detachCursor: (() => void) | null = null;
    const transferOpts = () => ({
      capacity: presentation.capacity,
      allowedItemTypes: presentation.allowedItemTypes as ItemType[],
    });

    const amountFor = (max: number): number => {
      if (qty.value === "all") return Math.max(1, max);
      const parsed = Number.parseInt(qty.value, 10);
      selectedAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      return Math.min(selectedAmount, max);
    };

    const setStatus = (text: string): void => {
      status.textContent = text;
    };

    const matchesFilter = (item: ItemRecord | undefined, itemId: string): boolean => {
      if (query && !itemLabel(item, itemId).toLowerCase().includes(query)) return false;
      if (!presentation.showCategories || tab === "all") return true;
      return storageChestTabOf(item?.type) === tab;
    };

    const sortInventories = (): void => {
      const project = store.getCurrent();
      const byName = (left: string, right: string): number => {
        const a = project.database.items.find((entry) => entry.id === left)?.name ?? left;
        const b = project.database.items.find((entry) => entry.id === right)?.name ?? right;
        return a.localeCompare(b, "ko");
      };
      const reorder = (inv: Record<string, number>): void => {
        const rows = Object.entries(inv).sort(([a], [b]) => byName(a, b));
        for (const key of Object.keys(inv)) delete inv[key];
        for (const [id, count] of rows) inv[id] = count;
      };
      reorder(scene.session.inventory);
      reorder(chest.inventory);
      setStatus("이름순으로 정렬했습니다");
    };

    const rebuildTabs = (): void => {
      tabs.replaceChildren();
      if (!presentation.showCategories) return;
      for (const id of ["all", "medicine", "material", "gear", "key"] as const) {
        tabs.append(el("button", {
          class: `runtime-chest-tab${tab === id ? " selected" : ""}`,
          text: storageChestTabLabel(id),
          attrs: { type: "button" },
          dataset: { testid: `chest-tab-${id}` },
          on: { click: () => { tab = id; rebuild(); } },
        }));
      }
    };

    const rebuild = (): void => {
      detachCursor?.();
      detachCursor = null;
      rebuildTabs();
      const project = store.getCurrent();
      const itemById = new Map(project.database.items.map((item) => [item.id, item]));
      const used = occupiedChestSlots(chest.inventory);
      capacity.textContent = presentation.capacity === undefined
        ? `칸 ${used}`
        : `칸 ${used}/${presentation.capacity}`;

      playerList.replaceChildren(
        ...inventoryEntries(scene.session.inventory)
          .filter((entry) => matchesFilter(itemById.get(entry.itemId), entry.itemId))
          .map((entry, index) =>
            itemRow({
              side: "player",
              item: itemById.get(entry.itemId),
              itemId: entry.itemId,
              count: entry.count,
              index,
              showIcons: presentation.showIcons,
              onClick: () => {
                const ok = depositToChest(scene.session, chest.id, entry.itemId, amountFor(entry.count), {
                  ...transferOpts(),
                  itemType: itemById.get(entry.itemId)?.type,
                });
                setStatus(ok ? `${itemLabel(itemById.get(entry.itemId), entry.itemId)} 넣음` : "넣을 수 없습니다");
                rebuild();
              },
            })
          )
      );
      const chestRows: HTMLElement[] = inventoryEntries(chest.inventory)
        .filter((entry) => matchesFilter(itemById.get(entry.itemId), entry.itemId))
        .map((entry, index) =>
          itemRow({
            side: "chest",
            item: itemById.get(entry.itemId),
            itemId: entry.itemId,
            count: entry.count,
            index,
            showIcons: presentation.showIcons,
            onClick: () => {
              const ok = withdrawFromChest(scene.session, chest.id, entry.itemId, amountFor(entry.count));
              setStatus(ok ? `${itemLabel(itemById.get(entry.itemId), entry.itemId)} 꺼냄` : "꺼낼 수 없습니다");
              rebuild();
            },
          })
        );
      if (presentation.goldVault) {
        chestRows.unshift(goldRow(scene, chest, amountFor, setStatus, rebuild, presentation.showIcons));
      }
      chestList.replaceChildren(...chestRows);
      if (playerList.childElementCount === 0) {
        playerList.append(el("div", { class: "runtime-chest-empty", text: "(비어 있음)" }));
      }
      if (chestList.childElementCount === 0) {
        chestList.append(el("div", { class: "runtime-chest-empty", text: "(비어 있음)" }));
      }
      const items = Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-chest-item, .runtime-chest-tab, .runtime-chest-tool, .runtime-chest-cancel"));
      detachCursor = attachCursorMenu(overlay, {
        items: items.length > 0 ? items : [cancel],
        cancelEl: cancel,
        initialIndex: 0,
      });
      scene.syncRuntimeState?.();
    };

    const finish = (): void => {
      detachCursor?.();
      detachCursor = null;
      overlay.remove();
      resolve();
    };

    search.addEventListener("input", () => {
      query = search.value.trim().toLowerCase();
      rebuild();
    });
    qty.addEventListener("change", () => {
      if (qty.value !== "all") selectedAmount = Math.max(1, Number.parseInt(qty.value, 10) || 1);
    });
    rebuild();
  });
}

function goldRow(
  scene: PlaySceneContext,
  chest: ChestState,
  amountFor: (max: number) => number,
  setStatus: (text: string) => void,
  rebuild: () => void,
  showIcons: boolean,
): HTMLElement {
  const wrap = el("div", { class: "runtime-chest-gold", dataset: { testid: "chest-gold-row" } });
  const stored = chest.gold ?? 0;
  wrap.append(
    showIcons ? el("span", { class: "runtime-chest-item-icon runtime-chest-item-icon-fallback", text: "G" }) : el("span"),
    el("span", { class: "runtime-chest-item-name", text: `골드  ${scene.session.gold} / 상자 ${stored}` }),
    el("button", {
      class: "runtime-chest-tool",
      text: "넣기",
      attrs: { type: "button" },
      dataset: { testid: "chest-gold-deposit" },
      on: {
        click: () => {
          const ok = transferChestGold(scene.session, chest, "deposit", amountFor(scene.session.gold));
          setStatus(ok ? "골드를 넣었습니다" : "넣을 수 없습니다");
          rebuild();
        },
      },
    }),
    el("button", {
      class: "runtime-chest-tool",
      text: "꺼내기",
      attrs: { type: "button" },
      dataset: { testid: "chest-gold-withdraw" },
      on: {
        click: () => {
          const ok = transferChestGold(scene.session, chest, "withdraw", amountFor(stored));
          setStatus(ok ? "골드를 꺼냈습니다" : "꺼낼 수 없습니다");
          rebuild();
        },
      },
    }),
  );
  return wrap;
}

function itemRow(input: {
  readonly side: "player" | "chest";
  readonly item: ItemRecord | undefined;
  readonly itemId: ItemId;
  readonly count: number;
  readonly index: number;
  readonly showIcons: boolean;
  readonly onClick: () => void;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-chest-item";
  button.dataset.testid = `chest-${input.side}-item-${input.itemId}`;
  if (input.index === 0) button.classList.add("selected");
  if (input.showIcons) button.append(itemIcon(input.item));
  button.append(
    el("span", { class: "runtime-chest-item-name", text: itemLabel(input.item, input.itemId) }),
    el("span", { class: "runtime-chest-item-count", text: `×${input.count}` })
  );
  button.addEventListener("click", input.onClick);
  return button;
}

function itemIcon(item: ItemRecord | undefined): HTMLElement {
  const icon = el("span", { class: "runtime-chest-item-icon" });
  const resourceId = item?.iconResourceId ?? item?.imageResourceId;
  const url = resourceId ? resolveAssetResourceUrl(resourceId) : undefined;
  if (url) {
    icon.style.backgroundImage = `url("${url}")`;
  } else {
    icon.classList.add("runtime-chest-item-icon-fallback");
    icon.textContent = (item?.name ?? "?").trim().slice(0, 1) || "?";
  }
  return icon;
}

function itemLabel(item: ItemRecord | undefined, itemId: string): string {
  return item?.name?.trim() || itemId;
}

function mountChestOverlay(scene: PlaySceneContext, overlay: HTMLElement): void {
  const host = dialogueHost(scene);
  if (!host) return;
  const layer = host.closest(".play-viewport") ?? host;
  layer.querySelector("[data-testid='chest-scene']")?.remove();
  layer.querySelector("[data-testid='chest-locked']")?.remove();
  layer.append(overlay);
}

function openChestCommandAt(scene: PlaySceneContext, x: number, y: number): Extract<Command, { kind: "openChest" }> | undefined {
  const event = scene.map.events.find((entry) => entry.x === x && entry.y === y);
  const pages = event?.pages ?? [];
  for (const page of pages) {
    const command = page.commands.find((entry): entry is Extract<Command, { kind: "openChest" }> => entry.kind === "openChest");
    if (command) return command;
  }
  const legacy = event?.commands?.find((entry): entry is Extract<Command, { kind: "openChest" }> => entry.kind === "openChest");
  return legacy;
}

/** Action-key path: open a session chest standing on the faced/underfoot tile. */
export function tryChestInteraction(scene: PlaySceneContext, x: number, y: number): boolean {
  const chest = findChestAt(scene.session, scene.map.id, x, y);
  if (!chest) return false;
  const authored = openChestCommandAt(scene, x, y);
  void playOpenChest(scene, {
    ...(authored ?? {}),
    chestId: authored?.chestId ?? chest.id,
    mapId: chest.mapId,
    x: chest.x,
    y: chest.y,
  });
  return true;
}
