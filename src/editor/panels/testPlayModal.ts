import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene } from "@/player/battleDom";
import { renderPlayer, teardownPlayer } from "@/player/player";
import { store } from "@/project/store";
import { el } from "@/util/dom";

let modalRoot: HTMLElement | null = null;
let removePlayWindowKeydown: (() => void) | null = null;

type TestPlayWindowMode = "fullscreen" | "windowed";

export async function openTestPlayModal(): Promise<void> {
  await store.flush();
  const body = openTestPlayShell("테스트 플레이 - RPG 쯔꾸르");
  renderPlayer(body, { onExit: closeTestPlayModal, trackGlobalGame: false });
}

export async function openTroopBattleTestModal(troopId: string): Promise<void> {
  await store.flush();
  const project = store.getCurrent();
  const troop = project.database.troops.find((record) => record.id === troopId);
  const body = openTestPlayShell(`전투 테스트 - ${troop?.name ?? troopId}`);
  const runtime = createBattleRuntime({ project, troopId, canEscape: true, canLose: true });
  advanceBattleRuntime(runtime);
  mountBattleScene({
    host: body,
    runtime,
    onResult: () => undefined,
  });
}

export function closeTestPlayModal(): void {
  if (!modalRoot) return;
  removePlayWindowKeydown?.();
  removePlayWindowKeydown = null;
  teardownPlayer();
  modalRoot.remove();
  modalRoot = null;
}

function openTestPlayShell(title: string): HTMLElement {
  closeTestPlayModal();
  const backdrop = el("div", {
    class: "test-play-modal-backdrop",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
    },
    dataset: { testid: "test-play-modal-backdrop" },
  });
  const windowNode = el("div", {
    class: "test-play-window",
    dataset: { testid: "test-play-window", windowMode: "windowed" },
  });
  const titlebar = el("div", { class: "test-play-titlebar" });
  const restoreButton = el("button", {
    class: "test-play-close window-control restore",
    text: "창",
    attrs: { title: "창 모드", "aria-label": "테스트 플레이 창 모드" },
    dataset: { testid: "test-play-window-restore" },
  }) as HTMLButtonElement;
  const maximizeButton = el("button", {
    class: "test-play-close window-control maximize",
    text: "전체",
    attrs: { title: "전체 화면", "aria-label": "테스트 플레이 전체 화면" },
    dataset: { testid: "test-play-window-maximize" },
  }) as HTMLButtonElement;
  titlebar.append(
    el("span", {
      class: "test-play-title",
      text: title,
      dataset: { testid: "test-play-window-title" },
    }),
    el("button", {
      class: "test-play-close",
      text: "편집으로",
      attrs: { title: "테스트 플레이 닫기" },
      dataset: { testid: "mode-edit" },
      on: { click: () => closeTestPlayModal() },
    }),
    restoreButton,
    maximizeButton,
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
  restoreButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "windowed"));
  maximizeButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "fullscreen"));
  removePlayWindowKeydown = bindPlayWindowFullscreenHotkey(windowNode);
  return body;
}

function setTestPlayWindowMode(windowNode: HTMLElement, mode: TestPlayWindowMode): void {
  windowNode.dataset.windowMode = mode;
}

function bindPlayWindowFullscreenHotkey(windowNode: HTMLElement): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isPlayWindowFullscreenHotkey(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setTestPlayWindowMode(windowNode, nextTestPlayWindowMode(windowNode.dataset.windowMode));
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}

function isPlayWindowFullscreenHotkey(event: KeyboardEvent): boolean {
  return event.altKey && event.key === "Enter";
}

function nextTestPlayWindowMode(mode: string | undefined): TestPlayWindowMode {
  return mode === "fullscreen" ? "windowed" : "fullscreen";
}
