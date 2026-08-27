// 감독 크롬 — 낱장 얼굴 플레이트 + 48px 복귀 얼굴.

import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { idlePresenceLine, readAgentBrief } from "./aiAgentBrief";

const DIRECTOR_FACE_RESOURCE_ID = "easyrpg-faceset-actor1-00";
const DIRECTOR_NAME = "조수";
const DIRECTOR_RESTORE_LABEL = "조수";
const DIRECTOR_FACE_SIZE_PX = FACE_IMAGE_SIZE;

export type DirectorPlateHandle = {
  readonly element: HTMLElement;
  readonly setName: (name: string) => void;
  readonly setLine: (line: string | null) => void;
  readonly dispose: () => void;
};

type DirectorFaceOptions = {
  readonly ariaLabel?: string;
  readonly testid?: string;
};

function applyDirectorFace(face: HTMLElement): void {
  face.style.width = `${DIRECTOR_FACE_SIZE_PX}px`;
  face.style.height = `${DIRECTOR_FACE_SIZE_PX}px`;
  const faceUrl = resolveAssetResourceUrl(DIRECTOR_FACE_RESOURCE_ID, { project: store.getCurrent() });
  if (faceUrl === null) return;
  face.style.backgroundImage = `url("${faceUrl}")`;
  face.style.backgroundPosition = "center";
  face.style.backgroundSize = `${DIRECTOR_FACE_SIZE_PX}px ${DIRECTOR_FACE_SIZE_PX}px`;
}

export function createAssistantFace(options: DirectorFaceOptions = {}): HTMLElement {
  const ariaLabel = options.ariaLabel;
  const face = el("span", {
    class: "ai-director-face",
    attrs: ariaLabel === undefined
      ? { "aria-hidden": "true" }
      : { role: "img", "aria-label": ariaLabel },
    ...(options.testid === undefined ? {} : { dataset: { testid: options.testid } }),
  });
  applyDirectorFace(face);
  return face;
}

export function createDirectorRestoreButton(): HTMLButtonElement {
  const button = el("button", {
    class: "ai-collapsed-restore",
    attrs: {
      type: "button",
      title: DIRECTOR_RESTORE_LABEL,
      "aria-label": DIRECTOR_RESTORE_LABEL,
    },
    dataset: { testid: "ai-collapsed-restore" },
    children: [
      el("span", { class: "ai-collapsed-restore-dot", attrs: { "aria-hidden": "true" } }),
      createAssistantFace(),
    ],
  });
  button.style.width = `${DIRECTOR_FACE_SIZE_PX}px`;
  button.style.height = `${DIRECTOR_FACE_SIZE_PX}px`;
  return button;
}

export function createDirectorPlate(): DirectorPlateHandle {
  const face = createAssistantFace({
    ariaLabel: DIRECTOR_NAME,
    testid: "ai-director-face",
  });

  const name = el("h2", { class: "ai-director-name", text: DIRECTOR_NAME });
  const line = el("p", {
    class: "ai-director-line",
    dataset: { testid: "ai-director-line" },
    text: idlePresenceLine(readAgentBrief()),
  });
  const element = el("div", {
    class: "ai-director-plate",
    dataset: { testid: "ai-director-plate" },
    children: [
      face,
      el("div", { class: "ai-director-copy", children: [name, line] }),
    ],
  });

  let override: string | null = null;
  const refreshLine = (): void => {
    if (typeof document === "undefined") return;
    line.textContent = override ?? idlePresenceLine(readAgentBrief());
  };
  const unsubscribeEditor = editorState.subscribe(refreshLine);
  const unsubscribeStore = store.subscribe(refreshLine);

  return {
    element,
    setName: (nextName: string) => {
      name.textContent = nextName;
      face.setAttribute("aria-label", nextName);
    },
    setLine: (nextLine: string | null) => {
      override = nextLine;
      refreshLine();
    },
    dispose: () => {
      unsubscribeEditor();
      unsubscribeStore();
    },
  };
}

