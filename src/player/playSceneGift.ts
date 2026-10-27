import { giftRankEmote } from "@/project/emotes";
import { showSceneEmote } from "@/player/playSceneEmotes";
import { giftDayKey } from "@/project/session";
import { store } from "@/project/store";
import { friendshipDisplayMax } from "@/project/socialLoop";
import { formatFriendshipFeedback, giftRankForItem, giveGiftToNpc, giftResponseForKey } from "@/project/friendship";
import { resolveCharacterSpeaker, resolveGiftPrefs, resolveGiftResponses } from "@/project/characterProfiles";
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
    // 선물 반응을 대사창 밖에서도 보여준다 — 등급이 정수리에 뜨므로 저작자가 아무것도 안 해도 읽힌다.
    showSceneEmote(scene, event.id, giftRankEmote(giftRankForItem(resolveGiftPrefs(project, event), item.id)));
    const feedback = formatFriendshipFeedback({ delta: result.delta, friendship: result.friendship, max: friendshipDisplayMax(project) });
    await showGiftMessage(scene, event, `${result.message}\n${feedback}`);
    return;
  }
  await showGiftMessage(scene, event, result.message);
}

async function showGiftMessage(scene: PlaySceneContext, event: GameEvent, body: string): Promise<void> {
  const dialogue = dialogueUi(scene);
  if (!dialogue) return;
  await dialogue.showText({
    speaker: resolveCharacterSpeaker(store.getCurrent(), event),
    body,
    textContext: { session: scene.session, project: store.getCurrent() },
    playerTileY: scene.tileY,
    mapHeight: scene.map.height,
  });
}

/** 보이는 「선물하기」가 창 이름이다. 커서가 옮기면 그 물건만 알린다. */
const GIFT_TITLE_ID = "runtime-gift-title";

function chooseGiftItem(scene: PlaySceneContext, event: GameEvent): Promise<ItemRecord | null> {
  const items = giftableInventoryItems(scene);
  if (items.length === 0) {
    return showNoItems(scene, event).then(() => null);
  }
  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "runtime-overlay runtime-gift-overlay";
    overlay.dataset.testid = "gift-scene";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", GIFT_TITLE_ID);
    overlay.tabIndex = -1;
    const list = el("div", {
      class: "runtime-gift-list",
      dataset: { testid: "gift-item-list" },
      attrs: { role: "group", "aria-label": "선물할 물건" },
      children: items.map((item, index) => giftItemButton(scene, item, index, resolveWith)),
    });
    const cancel = el("button", {
      class: "runtime-gift-cancel",
      text: "취소",
      attrs: { type: "button" },
      dataset: { testid: "gift-cancel" },
      on: { click: () => resolveWith(null) },
    }) as HTMLButtonElement;
    const announcement = choiceAnnouncement("gift-announcement");
    overlay.append(el("div", {
      class: "runtime-gift-window",
      children: [
        el("div", { class: "runtime-gift-title", text: "선물하기", attrs: { id: GIFT_TITLE_ID } }),
        list,
        cancel,
        announcement,
      ],
    }));
    mountGiftOverlay(scene, overlay);
    const choices = Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-gift-item"));
    let detachCursor: (() => void) | null = attachCursorMenu(overlay, {
      items: choices,
      cancelEl: cancel,
      initialIndex: 0,
      onSelect: (index) => announceChoice(announcement, choices[index]),
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
    speaker: resolveCharacterSpeaker(store.getCurrent(), event),
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
  const count = scene.session.inventory[item.id] ?? 0;
  button.setAttribute("aria-label", `${item.name} ${count}개`);
  button.append(
    el("span", { class: "runtime-gift-item-name", text: item.name }),
    el("span", { class: "runtime-gift-item-count", text: String(count) })
  );
  button.addEventListener("click", () => onSelect(item));
  return button;
}

function choiceAnnouncement(testId: string): HTMLElement {
  return el("div", {
    // 선택지 질문과 같은 화면 밖 알림. 보이는 행은 그대로 둔다.
    class: "dialogue-choice-announcement",
    dataset: { testid: testId },
    attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
  });
}

function announceChoice(announcement: HTMLElement, choice: HTMLElement | undefined): void {
  const label = choice?.getAttribute("aria-label") ?? "";
  if (!label || announcement.textContent === label) return;
  announcement.textContent = label;
}

function mountGiftOverlay(scene: PlaySceneContext, overlay: HTMLElement): void {
  const host = dialogueHost(scene);
  if (!host) return;
  const layer = host.closest(".play-viewport") ?? host;
  layer.querySelector("[data-testid='gift-scene']")?.remove();
  layer.append(overlay);
}
