// Opt-in storage chest play surface (session.chests deposit/withdraw UI).
import { store } from "@/project/store";
import {
  depositToChest,
  ensureChest,
  findChestAt,
  inventoryEntries,
  withdrawFromChest,
  type ChestState,
} from "@/project/placeables";
import type { ItemId } from "@/project/types";
import type { ItemRecord } from "@/project/types/database";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { el } from "@/util/dom";

export type OpenChestRequest = {
  readonly chestId?: string;
  /** When chestId omitted, create/open chest at this map tile. */
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
};

export async function playOpenChest(scene: PlaySceneContext, request: OpenChestRequest): Promise<void> {
  const chest = resolveChest(scene, request);
  if (!chest) return;
  await openChestUi(scene, chest);
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
  // Implicit tile open creates a stable id from map+coords so re-open reuses the same box.
  return ensureChest(scene.session, {
    id: `chest_${mapId}_${Math.trunc(x)}_${Math.trunc(y)}`,
    mapId,
    x,
    y,
  });
}

function openChestUi(scene: PlaySceneContext, chest: ChestState): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "runtime-overlay runtime-chest-overlay";
    overlay.dataset.testid = "chest-scene";

    const status = el("div", {
      class: "runtime-chest-status",
      dataset: { testid: "chest-status" },
      text: "보관 상자",
    });
    const playerList = el("div", {
      class: "runtime-chest-list",
      dataset: { testid: "chest-player-list" },
    });
    const chestList = el("div", {
      class: "runtime-chest-list",
      dataset: { testid: "chest-storage-list" },
    });
    const cancel = el("button", {
      class: "runtime-chest-cancel",
      text: "닫기",
      attrs: { type: "button" },
      dataset: { testid: "chest-close" },
      on: { click: () => finish() },
    }) as HTMLButtonElement;

    const window = el("div", {
      class: "runtime-chest-window",
      children: [
        el("div", { class: "runtime-chest-title", text: "보관 상자" }),
        status,
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
        cancel,
      ],
    });
    overlay.append(window);
    mountChestOverlay(scene, overlay);

    let detachCursor: (() => void) | null = null;

    const setStatus = (text: string): void => {
      status.textContent = text;
    };

    const rebuild = (): void => {
      detachCursor?.();
      detachCursor = null;
      const project = store.getCurrent();
      const itemById = new Map(project.database.items.map((item) => [item.id, item]));
      playerList.replaceChildren(
        ...inventoryEntries(scene.session.inventory).map((entry, index) =>
          itemRow({
            side: "player",
            item: itemById.get(entry.itemId),
            itemId: entry.itemId,
            count: entry.count,
            index,
            onClick: () => {
              const ok = depositToChest(scene.session, chest.id, entry.itemId, 1);
              setStatus(ok ? `${itemLabel(itemById.get(entry.itemId), entry.itemId)} 넣음` : "넣을 수 없습니다");
              rebuild();
            },
          })
        )
      );
      chestList.replaceChildren(
        ...inventoryEntries(chest.inventory).map((entry, index) =>
          itemRow({
            side: "chest",
            item: itemById.get(entry.itemId),
            itemId: entry.itemId,
            count: entry.count,
            index,
            onClick: () => {
              const ok = withdrawFromChest(scene.session, chest.id, entry.itemId, 1);
              setStatus(ok ? `${itemLabel(itemById.get(entry.itemId), entry.itemId)} 꺼냄` : "꺼낼 수 없습니다");
              rebuild();
            },
          })
        )
      );
      if (playerList.childElementCount === 0) {
        playerList.append(el("div", { class: "runtime-chest-empty", text: "(비어 있음)" }));
      }
      if (chestList.childElementCount === 0) {
        chestList.append(el("div", { class: "runtime-chest-empty", text: "(비어 있음)" }));
      }
      const items = Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-chest-item"));
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

    rebuild();
  });
}

function itemRow(input: {
  readonly side: "player" | "chest";
  readonly item: ItemRecord | undefined;
  readonly itemId: ItemId;
  readonly count: number;
  readonly index: number;
  readonly onClick: () => void;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-chest-item";
  button.dataset.testid = `chest-${input.side}-item-${input.itemId}`;
  if (input.index === 0) button.classList.add("selected");
  button.append(
    el("span", { class: "runtime-chest-item-name", text: itemLabel(input.item, input.itemId) }),
    el("span", { class: "runtime-chest-item-count", text: `×${input.count}` })
  );
  button.addEventListener("click", input.onClick);
  return button;
}

function itemLabel(item: ItemRecord | undefined, itemId: string): string {
  return item?.name?.trim() || itemId;
}

function mountChestOverlay(scene: PlaySceneContext, overlay: HTMLElement): void {
  const host = dialogueHost(scene);
  if (!host) return;
  const layer = host.closest(".play-viewport") ?? host;
  layer.querySelector("[data-testid='chest-scene']")?.remove();
  layer.append(overlay);
}

/** Action-key path: open a session chest standing on the faced/underfoot tile. */
export function tryChestInteraction(scene: PlaySceneContext, x: number, y: number): boolean {
  const chest = findChestAt(scene.session, scene.map.id, x, y);
  if (!chest) return false;
  void playOpenChest(scene, { chestId: chest.id, mapId: chest.mapId, x: chest.x, y: chest.y });
  return true;
}
