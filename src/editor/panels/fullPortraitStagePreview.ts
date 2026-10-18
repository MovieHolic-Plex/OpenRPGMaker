// 전신 초상 무대 견본 — 게임 해상도 비율의 축소 화면에 대사창과 그 뒤에 서는 전신 초상을 그린다.
// 크기·내림 비율은 런타임(player/dialogue.ts)과 같은 resolveDialogueFullPortraitLayout 에서 받는다.
// 자료집 「대화창 → 전신 초상」과 얼굴 표시 명령의 「장면 크기」가 함께 쓴다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { DialogueFullPortraitLayout } from "@/project/dialogueStyles";
import { resolvePlayResolution } from "@/project/playResolution";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/** 견본에 기본으로 세우는 공용 전신(자연스러운 성인·청소년 전신) — 어린이·노인 등 특수 체형을 제외한 기본 전신. */
export const FULL_PORTRAIT_SAMPLE_RESOURCE_ID = "shared-modern-uni-girl-long-expressions-full-base";
export const FULL_PORTRAIT_PARTNER_SAMPLE_RESOURCE_ID = "shared-modern-uni-boy-navy-expressions-full-base";
export const FULL_PORTRAIT_CORNER_FACE_SAMPLE_RESOURCE_ID = "shared-modern-uni-girl-long-expressions-bust-base";

const STAGE_WIDTH = 320;
const PORTRAIT_ASPECT = 9 / 16;
/** 런타임 CSS(.dialogue-face-behind)의 좌우 여백 — 게임 논리 해상도 px. */
const SIDE_INSET_PX = 22;

export interface FullPortraitStageOptions {
  readonly resourceId: string;
  readonly partnerResourceId?: string;
  readonly veil?: boolean;
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
  const aspectScale = width / resolution.width;
  const stageScale = width / STAGE_WIDTH;
  const height = Math.round(resolution.height * aspectScale);
  const portraitHeight = Math.round(height * options.layout.heightRatio);
  const portraitWidth = Math.round(portraitHeight * (options.veil ? 0.56 : PORTRAIT_ASPECT));
  const drop = Math.round(portraitHeight * options.layout.dropRatio);
  const inset = Math.round((options.veil ? -4 : SIDE_INSET_PX) * stageScale);
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
    imageRendering: "pixelated",
    transform: options.flipHorizontally ? "scaleX(-1)" : "",
  });
  const stageChildren: HTMLElement[] = [portrait];
  if (options.partnerResourceId) {
    const partnerUrl = resolveAssetResourceUrl(options.partnerResourceId, { project });
    const partnerNode = partnerUrl
      ? el("img", {
        class: "full-portrait-stage-figure",
        attrs: { src: partnerUrl, alt: "", draggable: "false" },
        dataset: { testid: "full-portrait-stage-listener" },
      })
      : el("div", { class: "full-portrait-stage-figure is-missing", text: "그림 없음" });
    Object.assign(partnerNode.style, {
      width: `${portraitWidth}px`,
      height: `${portraitHeight}px`,
      bottom: `${-drop}px`,
      [right ? "left" : "right"]: `${inset}px`,
      imageRendering: "pixelated",
      filter: options.veil ? "none" : "brightness(0.82) saturate(0.92)",
    });
    stageChildren.push(partnerNode);
  }
  const textGroup = el("div", {
    attrs: { style: "display:flex;flex-direction:column;gap:2px;min-width:0;" },
    children: [el("span", { class: "full-portrait-stage-name", text: "소녀" }), el("span", { text: "대사창은 초상 앞에 놓입니다." })],
  });
  const boxChildren: HTMLElement[] = [textGroup];
  if (options.veil) {
    const cornerUrl = resolveAssetResourceUrl(FULL_PORTRAIT_CORNER_FACE_SAMPLE_RESOURCE_ID, { project });
    if (cornerUrl) {
      const cornerFace = el("img", {
        attrs: {
          src: cornerUrl,
          alt: "",
          draggable: "false",
          style: `width:${Math.round(44 * stageScale)}px;height:${Math.round(44 * stageScale)}px;object-fit:contain;object-position:bottom center;flex-shrink:0;image-rendering:pixelated;margin-bottom:-5px;`,
        },
        dataset: { testid: "full-portrait-stage-corner-face" },
      });
      boxChildren.unshift(cornerFace);
    }
  }
  const boxNode = el("div", {
    class: "full-portrait-stage-box",
    children: boxChildren,
  });
  if (options.veil) {
    Object.assign(boxNode.style, {
      inset: "auto 0 0 0",
      border: "0",
      borderRadius: "0",
      padding: "4px 12px 5px 8px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "8px",
      background: "linear-gradient(180deg, rgba(10, 8, 16, 0) 0%, rgba(12, 10, 18, 0.32) 18%, rgba(14, 12, 22, 0.72) 42%, rgba(10, 8, 16, 0.88) 100%)",
    });
  }
  stageChildren.push(boxNode);
  const stage = el("div", {
    class: "full-portrait-stage",
    attrs: { role: "img", "aria-label": `전신 초상 견본 · 화면 높이의 ${Math.round(options.layout.heightRatio * 100)}%` },
    dataset: { testid: options.testid ?? "full-portrait-stage" },
    children: stageChildren,
  });
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  return stage;
}
