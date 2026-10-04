// 전신 초상 무대 견본 — 게임 해상도 비율의 축소 화면에 대사창과 그 뒤에 서는 전신 초상을 그린다.
// 크기·내림 비율은 런타임(player/dialogue.ts)과 같은 resolveDialogueFullPortraitLayout 에서 받는다.
// 자료집 「대화창 → 전신 초상」과 얼굴 표시 명령의 「장면 크기」가 함께 쓴다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { DialogueFullPortraitLayout } from "@/project/dialogueStyles";
import { resolvePlayResolution } from "@/project/playResolution";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/** 견본에 기본으로 세우는 공용 전신 — 프로젝트에 고른 그림이 없을 때. */
export const FULL_PORTRAIT_SAMPLE_RESOURCE_ID = "shared-people1-girl-expressions-full-base";

const STAGE_WIDTH = 320;
const PORTRAIT_ASPECT = 9 / 16;
/** 런타임 CSS(.dialogue-face-behind)의 좌우 여백 — 게임 논리 해상도 px. */
const SIDE_INSET_PX = 22;

export interface FullPortraitStageOptions {
  readonly resourceId: string;
  readonly layout: DialogueFullPortraitLayout;
  readonly position?: "left" | "right";
  readonly flipHorizontally?: boolean;
  readonly width?: number;
  readonly testid?: string;
}

export function renderFullPortraitStage(options: FullPortraitStageOptions): HTMLElement {
  // 견본 화면은 프로젝트의 게임 해상도 비율을 그대로 줄인다(기본 320×240).
  const project = store.getCurrent();
  const resolution = resolvePlayResolution(project.system);
  const width = options.width ?? STAGE_WIDTH;
  const scale = width / resolution.width;
  const height = Math.round(resolution.height * scale);
  const portraitHeight = Math.round(height * options.layout.heightRatio);
  const portraitWidth = Math.round(portraitHeight * PORTRAIT_ASPECT);
  const drop = Math.round(portraitHeight * options.layout.dropRatio);
  const inset = Math.round(SIDE_INSET_PX * scale);
  const url = resolveAssetResourceUrl(options.resourceId, { project });
  const right = options.position === "right";
  const portrait = url
    ? el("img", {
      class: "full-portrait-stage-figure",
      attrs: { src: url, alt: "", draggable: "false" },
      dataset: { testid: "full-portrait-stage-figure" },
    })
    : el("div", { class: "full-portrait-stage-figure is-missing", text: "그림 없음" });
  Object.assign(portrait.style, {
    width: `${portraitWidth}px`,
    height: `${portraitHeight}px`,
    bottom: `${-drop}px`,
    [right ? "right" : "left"]: `${inset}px`,
    transform: options.flipHorizontally ? "scaleX(-1)" : "",
  });
  const stage = el("div", {
    class: "full-portrait-stage",
    attrs: { role: "img", "aria-label": `전신 초상 견본 · 화면 높이의 ${Math.round(options.layout.heightRatio * 100)}%` },
    dataset: { testid: options.testid ?? "full-portrait-stage" },
    children: [
      portrait,
      el("div", {
        class: "full-portrait-stage-box",
        children: [el("span", { class: "full-portrait-stage-name", text: "소녀" }), el("span", { text: "대사창은 초상 앞에 놓입니다." })],
      }),
    ],
  });
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  return stage;
}
