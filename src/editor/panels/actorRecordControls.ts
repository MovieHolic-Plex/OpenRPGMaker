import { applyCharsetFrameCrop } from "@/assets/charsetFrameCrop";
import { ACTOR_RATE_GRADES } from "@/project/actorModel";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { field } from "@/editor/panels/databaseControls";
import { store } from "@/project/store";
import type { ActorRateGrade } from "@/project/types";
import { el } from "@/util/dom";

export type GraphicPreviewKind = "battleCharset" | "charset" | "faceset";

const GENERATED_BATTLE_CHARSET_FRAME_WIDTH = 48;
const GENERATED_BATTLE_CHARSET_FRAME_HEIGHT = 64;
const GENERATED_BATTLE_CHARSET_SHEET_WIDTH = 144;
const GENERATED_BATTLE_CHARSET_SHEET_HEIGHT = 384;
const GENERATED_BATTLE_CHARSET_PREVIEW_SCALE = 0.75;

export function actorPanel(title: string, className: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", {
    class: `actor-panel ${className}`,
    dataset: { testid: `actor-panel-${className}` },
    children: [el("legend", { text: title }), ...children],
  });
}

export function graphicPreview(
  label: string,
  resourceId: string,
  kind: GraphicPreviewKind,
  sheetIndex = 0,
  previewScale = 1
): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId === "(없음)" ? undefined : resourceId, { project: store.getCurrent() });
  const visual = url
    ? previewVisual(label, resourceId, url, kind, sheetIndex, previewScale)
    : neutralActorResourceSlot(resourceId);
  return el("div", {
    class: "actor-graphic-preview",
    children: [el("span", { text: label }), visual],
  });
}

/**
 * 초상화 미리보기(히어로·외형 공용).
 * 얼굴이 비어 있을 때 288×256 8인 걷기 시트 전체를 faceset 으로 찌그러뜨리지 않고,
 * 해당 characterIndex 의 걷기 1칸 크롭 + 「미지정」 배지로 보여 준다.
 */
export function actorFacePreview(
  faceResourceId: string | undefined,
  fallbackCharacterResourceId: string | undefined,
  fallbackCharacterIndex = 0,
  previewScale = 1
): HTMLElement {
  if (faceResourceId) {
    return graphicPreview("얼굴", faceResourceId, "faceset", 0, previewScale);
  }
  const charsetUrl = resolveAssetResourceUrl(fallbackCharacterResourceId, { project: store.getCurrent() });
  if (charsetUrl) {
    const frame = el("span", {
      class: "actor-face-fallback-frame",
      attrs: { role: "img", "aria-label": "초상화 미지정 (걷기 그림 대체)" },
    });
    applyCharsetFrameCrop(
      frame,
      charsetUrl,
      { characterIndex: Math.min(7, Math.max(0, Math.trunc(fallbackCharacterIndex) || 0)), direction: "down", pattern: 1 },
      previewScale > 1 ? 1.5 : 1.25
    );
    const visual = el("div", {
      class: "actor-face-fallback-slot",
      children: [frame, el("span", { class: "actor-face-missing-tag", text: "미지정" })],
    });
    return el("div", {
      class: "actor-graphic-preview actor-graphic-preview-missing",
      children: [el("span", { text: "얼굴" }), visual],
    });
  }
  return graphicPreview("얼굴", "(없음)", "faceset", 0, previewScale);
}

/** 히어로 헤더용 걷기 1칸 미니 미리보기(.actor-sheet-crop 과 구분해 히어로 얼굴 계약 유지). */
export function heroWalkPreview(characterResourceId: string | undefined, characterIndex = 0): HTMLElement {
  const url = resolveAssetResourceUrl(characterResourceId, { project: store.getCurrent() });
  const inner = url
    ? (() => {
        const frame = el("span", {
          class: "db-hero-walk-frame",
          attrs: { role: "img", "aria-label": "걷기 캐릭터 미리보기" },
        });
        applyCharsetFrameCrop(
          frame,
          url,
          { characterIndex: Math.min(7, Math.max(0, Math.trunc(characterIndex) || 0)), direction: "down", pattern: 1 },
          1.35
        );
        return frame;
      })()
    : el("span", { class: "db-hero-walk-empty", text: "없음" });
  return el("div", {
    class: "db-record-hero-walk",
    children: [inner],
  });
}

function neutralActorResourceSlot(resourceId: string): HTMLElement {
  return el("div", {
    class: "actor-neutral-resource-slot",
    children: [
      el("span", { class: "actor-neutral-resource-icon" }),
      el("strong", { text: resourceId }),
    ],
  });
}

function previewVisual(
  label: string,
  resourceId: string,
  url: string,
  kind: GraphicPreviewKind,
  sheetIndex: number,
  previewScale: number
): HTMLElement {
  if (kind === "faceset") {
    // 얼굴은 그림 한 장이다 — 크롭 없이 통째로 그린다.
    return faceImageVisual(label, url, previewScale);
  }
  if (kind === "charset") {
    const characterIndex = Math.min(7, Math.max(0, Math.trunc(sheetIndex) || 0));
    const source = charsetFrameSource({ characterIndex, direction: "down", pattern: 1 });
    return sheetCrop(label, url, {
      ...source,
      sheetWidth: CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH,
      sheetHeight: CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT,
      scale: 2,
    });
  }
  if (resourceId === "hero" || isGeneratedBattleActorResource(resourceId)) {
    return sheetCrop(label, url, {
      x: 0,
      y: 0,
      width: GENERATED_BATTLE_CHARSET_FRAME_WIDTH,
      height: GENERATED_BATTLE_CHARSET_FRAME_HEIGHT,
      sheetWidth: GENERATED_BATTLE_CHARSET_SHEET_WIDTH,
      sheetHeight: GENERATED_BATTLE_CHARSET_SHEET_HEIGHT,
      scale: GENERATED_BATTLE_CHARSET_PREVIEW_SCALE,
    });
  }
  return el("img", { attrs: { alt: `${label} 미리보기`, src: url } });
}

function faceImageVisual(label: string, url: string, previewScale: number): HTMLElement {
  const size = Math.round(FACE_IMAGE_SIZE * (previewScale > 0 ? previewScale : 1));
  return el("img", {
    class: "actor-face-image",
    attrs: { alt: `${label} 미리보기`, src: url, width: String(size), height: String(size) },
  });
}

function isGeneratedBattleActorResource(resourceId: string): boolean {
  return resourceId.startsWith("generated-actor-") && resourceId.endsWith("-battle");
}

function sheetCrop(
  label: string,
  url: string,
  source: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly sheetWidth: number;
    readonly sheetHeight: number;
    readonly scale: number;
  }
): HTMLElement {
  return el("div", {
    class: "actor-sheet-crop",
    attrs: {
      "aria-label": `${label} 미리보기`,
      role: "img",
      style: [
        `--crop-url:url("${url}")`,
        `--crop-width:${source.width * source.scale}px`,
        `--crop-height:${source.height * source.scale}px`,
        `--crop-sheet-width:${source.sheetWidth * source.scale}px`,
        `--crop-sheet-height:${source.sheetHeight * source.scale}px`,
        `--crop-x:-${source.x * source.scale}px`,
        `--crop-y:-${source.y * source.scale}px`,
      ].join(";"),
    },
  });
}

export function textControl(label: string, testid: string, value: string, onInput: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, dataset: { testid }, value }) as HTMLInputElement;
  input.addEventListener("input", () => onInput(input.value));
  return field(label, input);
}

export function resourceControl(
  label: string,
  testid: string,
  value: string,
  onInput: (value: string) => void,
  onPick: () => void
): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, dataset: { testid }, value }) as HTMLInputElement;
  input.addEventListener("input", () => onInput(input.value));
  const button = el("button", {
    class: "actor-resource-set-button",
    text: "설정...",
    attrs: { type: "button", "aria-label": `${label} 리소스 선택` },
    on: { click: onPick },
  });
  return field(label, el("span", { class: "actor-resource-control", children: [input, button] }));
}

export function numberControl(label: string, testid: string, value: number, onInput: (value: number) => void): HTMLElement {
  return field(label, numberInput(testid, value, onInput));
}

export function numberInput(testid: string, value: number, onInput: (value: number) => void): HTMLInputElement {
  const input = el("input", { attrs: { type: "number" }, dataset: { testid }, value: String(value) }) as HTMLInputElement;
  input.addEventListener("input", () => onInput(Number(input.value)));
  return input;
}

export function checkboxControl(label: string, testid: string, checked: boolean, onInput: (value: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  return el("label", { class: "actor-check", children: [input, el("span", { text: label })] });
}

export function selectRecord(
  label: string,
  testid: string,
  value: string,
  records: readonly { readonly id: string; readonly name: string }[],
  onChange: (value: string) => void
): HTMLElement {
  return field(label, selectInput(testid, value, records, onChange));
}

export function selectInput(
  testid: string,
  value: string,
  records: readonly { readonly id: string; readonly name: string }[],
  onChange: (value: string) => void
): HTMLSelectElement {
  const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
  select.append(el("option", { text: "(없음)", attrs: { value: "" } }));
  for (const record of records) select.append(el("option", { text: record.name, attrs: { value: record.id } }));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

export function gradeSelect(value: ActorRateGrade, onChange: (value: ActorRateGrade) => void): HTMLSelectElement {
  const select = el("select") as HTMLSelectElement;
  for (const grade of ACTOR_RATE_GRADES) select.append(el("option", { text: grade, attrs: { value: grade } }));
  select.value = value;
  select.addEventListener("change", () => {
    const grade = ACTOR_RATE_GRADES.find((entry) => entry === select.value);
    if (grade) onChange(grade);
  });
  return select;
}

export function emptyToUndefined(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}
