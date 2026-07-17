import { giftDayKey } from "@/project/session";
import { store } from "@/project/store";
import { formatFriendshipFeedback, giveGiftToNpc, giftResponseForKey } from "@/project/friendship";
import { resolveGiftResponses } from "@/project/characterProfiles";
import { resolveSocialKey } from "@/project/socialKey";
import type { GameEvent } from "@/project/types";
import type { ItemRecord } from "@/project/types/database";
import { dialogueHost, dialogueUi } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { el } from "@/util/dom";

export async function playGiftSelection(scene: PlaySceneContext, event: GameEvent): Promise<void> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return;
  const project = store.getCurrent();
  const responses = resolveGiftResponses(project, event);
  const npcKey = resolveSocialKey(event);
  if (!npcKey) {
    await showGiftMessage(scene, event, giftResponseForKey(responses, "noItems"));
    return;
  }
  const today = giftDayKey(scene.session.gameTime);
  if ((scene.session.dailyGifts ?? {})[npcKey] === today) {
    await showGiftMessage(scene, event, giftResponseForKey(responses, "alreadyGifted"));
    return;
  }
  const item = await chooseGiftItem(scene, event);
  if (!item) return;
  const result = giveGiftToNpc(project, scene.session, event, item.id);
  scene.syncRuntimeState();
  if (result.ok) {
    const feedback = formatFriendshipFeedback({ delta: result.delta, friendship: result.friendship });
    await showGiftMessage(scene, event, `${result.message}\n${feedback}`);
    return;
  }
  await showGiftMessage(scene, event, result.message);
}

async function showGiftMessage(scene: PlaySceneContext, event: GameEvent, body: string): Promise<void> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return;
  await dialogue.showText({
    speaker: event.pages?.[0]?.name,
    body,
    textContext: { session: scene.session, project: store.getCurrent() },
    playerTileY: scene.tileY,
    mapHeight: scene.map.height,
  });
}

function chooseGiftItem(scene: PlaySceneContext, event: GameEvent): Promise<ItemRecord | null> {
  const items = giftableInventoryItems(scene);
  if (items.length === 0) {
    return showNoItems(scene, event).then(() => null);
  }
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "runtime-overlay runtime-gift-overlay";
    overlay.dataset.testid = "gift-scene";
    const list = el("div", {
      class: "runtime-gift-list",
      dataset: { testid: "gift-item-list" },
      children: items.map((item, index) => giftItemButton(scene, item, index, resolveWith)),
    });
    const cancel = el("button", {
      class: "runtime-gift-cancel",
      text: "취소",
      attrs: { type: "button" },
      dataset: { testid: "gift-cancel" },
      on: { click: () => resolveWith(null) },
    }) as HTMLButtonElement;
    overlay.append(el("div", { class: "runtime-gift-window", children: [el("div", { class: "runtime-gift-title", text: "선물하기" }), list, cancel] }));
    mountGiftOverlay(scene, overlay);
    let detachCursor: (() => void) | null = attachCursorMenu(overlay, {
      items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-gift-item")),
      cancelEl: cancel,
      initialIndex: 0,
    });

    function resolveWith(item: ItemRecord | null): void {
      detachCursor?.();
      detachCursor = null;
      overlay.remove();
      resolve(item);
    }
  });
}

function giftableInventoryItems(scene: PlaySceneContext): ItemRecord[] {
  const project = store.getCurrent();
  return project.database.items.filter((item) => (scene.session.inventory[item.id] ?? 0) > 0);
}

async function showNoItems(scene: PlaySceneContext, event: GameEvent): Promise<void> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return;
  const responses = resolveGiftResponses(store.getCurrent(), event);
  await dialogue.showText({
    speaker: event.pages?.[0]?.name,
    body: giftResponseForKey(responses, "noItems"),
    textContext: { session: scene.session, project: store.getCurrent() },
    playerTileY: scene.tileY,
    mapHeight: scene.map.height,
  });
}

function giftItemButton(
  scene: PlaySceneContext,
  item: ItemRecord,
  index: number,
  onSelect: (item: ItemRecord) => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-gift-item";
  button.dataset.testid = `gift-item-${item.id}`;
  if (index === 0) button.classList.add("selected");
  button.append(
    el("span", { class: "runtime-gift-item-name", text: item.name }),
    el("span", { class: "runtime-gift-item-count", text: String(scene.session.inventory[item.id] ?? 0) })
  );
  button.addEventListener("click", () => onSelect(item));
  return button;
}

function mountGiftOverlay(scene: PlaySceneContext, overlay: HTMLElement): void {
  const host = dialogueHost(scene);
  if (!host) return;
  const layer = host.closest(".play-viewport") ?? host;
  layer.querySelector("[data-testid='gift-scene']")?.remove();
  layer.append(overlay);
}
