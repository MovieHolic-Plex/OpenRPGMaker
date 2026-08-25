type WindowStyleSnapshot = {
  readonly width: string;
  readonly height: string;
  readonly transform: string;
};

export type ModalFullscreenHandle = {
  readonly dispose: () => void;
  readonly isFullscreen: () => boolean;
  readonly toggle: (force?: boolean) => void;
};

export function attachWindowFullscreen(
  button: HTMLButtonElement,
  header: HTMLElement,
  backdrop: HTMLElement,
  windowEl: HTMLElement,
): ModalFullscreenHandle {
  let fullscreen = false;
  let snapshot: WindowStyleSnapshot | null = null;

  const updateButton = (): void => {
    const label = fullscreen ? "창 보기로 복원" : "전체 보기";
    button.textContent = fullscreen ? "❐" : "⛶";
    button.title = `${label} (Alt+Enter)`;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", fullscreen ? "true" : "false");
  };

  const toggle = (force?: boolean): void => {
    const next = force ?? !fullscreen;
    if (next === fullscreen) return;

    if (next) {
      snapshot = {
        width: windowEl.style.width,
        height: windowEl.style.height,
        transform: windowEl.style.transform,
      };
      windowEl.style.width = "";
      windowEl.style.height = "";
      windowEl.style.transform = "";
    } else if (snapshot) {
      windowEl.style.width = snapshot.width;
      windowEl.style.height = snapshot.height;
      windowEl.style.transform = snapshot.transform;
      snapshot = null;
    }

    fullscreen = next;
    backdrop.classList.toggle("is-fullscreen", fullscreen);
    windowEl.classList.toggle("is-fullscreen", fullscreen);
    updateButton();
  };

  const onButtonClick = (): void => toggle();
  const onHeaderDoubleClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, input, select, textarea, a")) return;
    event.preventDefault();
    toggle();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      toggle();
      return;
    }
    if (event.key === "Escape" && fullscreen) {
      event.preventDefault();
      event.stopPropagation();
      toggle(false);
    }
  };

  button.addEventListener("click", onButtonClick);
  header.addEventListener("dblclick", onHeaderDoubleClick);
  backdrop.addEventListener("keydown", onKeyDown);
  updateButton();

  return {
    dispose: () => {
      button.removeEventListener("click", onButtonClick);
      header.removeEventListener("dblclick", onHeaderDoubleClick);
      backdrop.removeEventListener("keydown", onKeyDown);
    },
    isFullscreen: () => fullscreen,
    toggle,
  };
}
