import { renderPlayer, teardownPlayer } from "@/player/player";
import { store } from "@/project/store";
import { el } from "@/util/dom";

let modalRoot: HTMLElement | null = null;

export async function openTestPlayModal(): Promise<void> {
  await store.flush();
  closeTestPlayModal();

  const backdrop = el("div", {
    class: "test-play-modal-backdrop",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "테스트 플레이",
    },
    dataset: { testid: "test-play-modal-backdrop" },
  });
  const windowNode = el("div", {
    class: "test-play-window",
    dataset: { testid: "test-play-window" },
  });
  const titlebar = el("div", { class: "test-play-titlebar" });
  titlebar.append(
    el("span", {
      class: "test-play-title",
      text: "테스트 플레이 - RPG 쯔꾸르",
      dataset: { testid: "test-play-window-title" },
    }),
    el("button", {
      class: "test-play-close",
      text: "편집으로",
      attrs: { title: "테스트 플레이 닫기" },
      dataset: { testid: "mode-edit" },
      on: { click: () => closeTestPlayModal() },
    }),
    el("button", {
      class: "test-play-close icon",
      text: "x",
      attrs: { title: "닫기" },
      dataset: { testid: "test-play-window-close" },
      on: { click: () => closeTestPlayModal() },
    })
  );
  const body = el("div", {
    class: "test-play-modal-body",
    dataset: { testid: "test-play-window-body" },
  });

  windowNode.append(titlebar, body);
  backdrop.append(windowNode);
  document.body.append(backdrop);
  modalRoot = backdrop;
  renderPlayer(body, { trackGlobalGame: false });
}

export function closeTestPlayModal(): void {
  if (!modalRoot) return;
  teardownPlayer();
  modalRoot.remove();
  modalRoot = null;
}
