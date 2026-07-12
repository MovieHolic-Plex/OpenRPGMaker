import { el } from "@/util/dom";
import { store } from "@/project/store";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";
import type { Dir, MapId, MoveCommand } from "@/project/types";
import { databasePicker } from "./conditionForm";
import type { MoveRouteCommandContext } from "./moveRouteCommandCatalog";

export function renderTopBar(
  initialFrequency: number,
  onFrequencyChange: (frequency: number) => void,
  parameters: MoveRouteCommandContext & {
    readonly onSwitchId: (value: string) => void;
    readonly onSpriteId: (value: string) => void;
    readonly onSoundId: (value: string) => void;
    readonly onNpcTargetMapId: (value: MapId) => void;
    readonly onNpcTargetX: (value: number) => void;
    readonly onNpcTargetY: (value: number) => void;
    readonly onNpcTargetDirection: (value: Dir) => void;
  }
): HTMLElement {
  return el("div", {
    class: "event-page-move-route-top",
    children: [
      el("fieldset", {
        class: "event-page-move-route-event",
        children: [
          el("legend", { text: "이벤트" }),
          el("select", {
            attrs: { title: "페이지 자율 이동은 현재 이벤트에 적용됩니다." },
            dataset: { testid: "event-page-move-route-target-event" },
            children: [el("option", { text: "이 이벤트" })],
          }),
        ],
      }),
      el("fieldset", {
        class: "event-page-move-route-frequency",
        children: [el("legend", { text: "빈도" }), renderFrequencyRadios(initialFrequency, onFrequencyChange)],
      }),
      renderParameterPanel(parameters),
    ],
  });
}

export function renderFooter(close: () => void, onOk: () => void, onHelp: () => void): HTMLElement {
  return el("div", {
    class: "event-page-move-route-footer",
    children: [
      routeFooterButton("확인", "event-page-move-route-ok", onOk),
      routeFooterButton("취소", "event-page-move-route-cancel", close),
      routeFooterButton("도움말", "event-page-move-route-help", onHelp),
    ],
  });
}

export function checkboxLabel(input: HTMLInputElement, label: string): HTMLElement {
  return el("label", { children: [input, el("span", { text: label })] });
}

export function routeUtilityButton(label: string, testId: string): HTMLButtonElement {
  return el("button", {
    class: "event-page-move-route-utility",
    text: label,
    attrs: { type: "button" },
    dataset: { testid: testId },
  });
}

export function updateDeleteState(
  deleteButton: HTMLButtonElement,
  deleteAllButton: HTMLButtonElement,
  moves: readonly MoveCommand[],
  selectedIndex: number
): void {
  deleteButton.disabled = selectedIndex < 0 || selectedIndex >= moves.length;
  deleteAllButton.disabled = moves.length === 0;
}

function renderFrequencyRadios(initialFrequency: number, onChange: (frequency: number) => void): HTMLElement {
  const wrap = el("div", { class: "event-page-move-route-frequency-radios" });
  for (let value = 1; value <= 8; value += 1) {
    const radio = el("input", {
      attrs: { type: "radio", name: "event-page-move-route-frequency", value: String(value) },
      dataset: { testid: `event-page-move-route-frequency-${value}` },
    });
    radio.checked = value === initialFrequency;
    radio.addEventListener("change", () => {
      if (radio.checked) onChange(value);
    });
    wrap.append(el("label", { children: [radio, el("span", { text: String(value) })] }));
  }
  return wrap;
}

function renderParameterPanel(parameters: MoveRouteCommandContext & {
  readonly onSwitchId: (value: string) => void;
  readonly onSpriteId: (value: string) => void;
  readonly onSoundId: (value: string) => void;
  readonly onNpcTargetMapId: (value: MapId) => void;
  readonly onNpcTargetX: (value: number) => void;
  readonly onNpcTargetY: (value: number) => void;
  readonly onNpcTargetDirection: (value: Dir) => void;
}): HTMLElement {
  return el("fieldset", {
    class: "event-page-move-route-parameters",
    children: [
      el("legend", { text: "매개변수" }),
      switchParameterRow(parameters.switchId, parameters.onSwitchId),
      graphicParameterRow(parameters.spriteId, parameters.onSpriteId),
      soundParameterRow(parameters.soundId, parameters.onSoundId),
      mapSelect("NPC 대상 맵", parameters.npcTargetMapId, parameters.onNpcTargetMapId),
      numberInput("NPC X", "event-page-move-route-npc-target-x", parameters.npcTargetX, parameters.onNpcTargetX),
      numberInput("NPC Y", "event-page-move-route-npc-target-y", parameters.npcTargetY, parameters.onNpcTargetY),
      directionSelect(parameters.npcTargetDirection, parameters.onNpcTargetDirection),
    ],
  });
}

// 스위치: 레코드 피커(셀렉트 + ... 버튼) + 원시 id 입력 하이브리드.
// e2e 가 event-page-move-route-switch-id 에 fill() 하므로 원시 input 은 반드시 유지한다.
function switchParameterRow(value: string, onChange: (value: string) => void): HTMLElement {
  const input = el("input", {
    class: "event-page-move-route-raw-id",
    attrs: { type: "text", placeholder: "스위치 id 직접 입력" },
    value,
    dataset: { testid: "event-page-move-route-switch-id" },
  });
  const picker = databasePicker(
    "switch",
    value,
    (id) => {
      input.value = id;
      onChange(id);
    },
    "event-page-move-route-switch-picker"
  );
  const pickerSelect = picker.querySelector("select") as HTMLSelectElement | null;
  input.addEventListener("input", () => {
    const next = input.value.trim();
    onChange(next);
    if (pickerSelect) pickerSelect.value = next;
  });
  return el("label", {
    class: "event-page-move-route-parameter-row",
    children: [el("span", { text: "스위치 ID" }), picker, input],
  });
}

// 그래픽: RTP 차셋 셀렉트 + 24x32 스프라이트 미리보기 칩 + 원시 id 입력 하이브리드.
// e2e 가 event-page-move-route-graphic-id 에 fill() 하므로 원시 input 은 반드시 유지한다.
function graphicParameterRow(value: string, onChange: (value: string) => void): HTMLElement {
  const chip = el("span", {
    class: "event-page-move-route-graphic-chip",
    attrs: { "aria-hidden": "true" },
    dataset: { testid: "event-page-move-route-graphic-preview" },
  });
  const select = el("select", {
    class: "event-page-move-route-graphic-select",
    dataset: { testid: "event-page-move-route-graphic-select" },
  });
  select.append(el("option", { text: "(직접 입력)", attrs: { value: "" } }));
  for (const asset of CHARSET_ASSETS) {
    select.append(el("option", { text: charsetOptionLabel(asset.fileName, asset.group), attrs: { value: asset.textureKey } }));
  }
  const input = el("input", {
    class: "event-page-move-route-raw-id",
    attrs: { type: "text", placeholder: "텍스처 키 직접 입력" },
    value,
    dataset: { testid: "event-page-move-route-graphic-id" },
  });
  select.value = knownCharsetKey(value) ? value : "";
  updateGraphicChip(chip, value);
  select.addEventListener("change", () => {
    const next = select.value;
    if (next.length === 0) return;
    input.value = next;
    onChange(next);
    updateGraphicChip(chip, next);
  });
  input.addEventListener("input", () => {
    const next = input.value.trim();
    select.value = knownCharsetKey(next) ? next : "";
    onChange(next);
    updateGraphicChip(chip, next);
  });
  return el("label", {
    class: "event-page-move-route-parameter-row",
    children: [el("span", { text: "그래픽 ID" }), chip, select, input],
  });
}

// 효과음: 텍스트 입력 유지 + ♪ 아이콘/placeholder 예시.
function soundParameterRow(value: string, onChange: (value: string) => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "text", placeholder: "예: se_cursor" },
    value,
    dataset: { testid: "event-page-move-route-sound-id" },
  });
  input.addEventListener("input", () => onChange(input.value.trim()));
  return el("label", {
    class: "event-page-move-route-parameter-row",
    children: [
      el("span", {
        children: [
          "효과음 ID ",
          el("span", { class: "event-page-move-route-sound-icon", attrs: { "aria-hidden": "true" }, text: "♪" }),
        ],
      }),
      input,
    ],
  });
}

function charsetOptionLabel(fileName: string, group: string): string {
  return `${fileName.replace(/\.png$/iu, "")} (${group})`;
}

function knownCharsetKey(textureKey: string): boolean {
  return CHARSET_ASSETS.some((asset) => asset.textureKey === textureKey);
}

function updateGraphicChip(chip: HTMLElement, textureKey: string): void {
  const asset = CHARSET_ASSETS.find((item) => item.textureKey === textureKey);
  chip.dataset.spriteId = textureKey;
  chip.style.width = `${CHARSET_FRAME_WIDTH}px`;
  chip.style.height = `${CHARSET_FRAME_HEIGHT}px`;
  if (!asset) {
    chip.dataset.empty = "true";
    chip.style.backgroundImage = "none";
    chip.title = textureKey.length > 0 ? textureKey : "그래픽 없음";
    return;
  }
  delete chip.dataset.empty;
  chip.title = asset.name;
  // 정면(아래) 대기 프레임 크롭. 투명 컬러키 배경 처리 재사용.
  const source = charsetFrameSource({ characterIndex: 0, direction: "down", pattern: 1 });
  applyTransparentColorKeyBackground(chip, asset.path);
  chip.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH}px ${
    CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT
  }px`;
  chip.style.backgroundPosition = `-${source.x}px -${source.y}px`;
}

function mapSelect(label: string, value: MapId, onChange: (value: MapId) => void): HTMLElement {
  const select = el("select", {
    dataset: { testid: "event-page-move-route-npc-target-map" },
    on: {
      change: (event) => {
        if (event.currentTarget instanceof HTMLSelectElement) onChange(event.currentTarget.value);
      },
    },
  });
  for (const map of Object.values(store.getCurrent().maps)) {
    select.append(el("option", { attrs: { value: map.id }, text: map.name }));
  }
  select.value = value;
  return el("label", { children: [el("span", { text: label }), select] });
}

function numberInput(label: string, testId: string, value: number, onChange: (value: number) => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "number", min: "0" },
    value,
    dataset: { testid: testId },
    on: {
      input: (event) => {
        if (event.currentTarget instanceof HTMLInputElement) onChange(parseInt(event.currentTarget.value, 10) || 0);
      },
    },
  });
  return el("label", { children: [el("span", { text: label }), input] });
}

function directionSelect(value: Dir, onChange: (value: Dir) => void): HTMLElement {
  const select = el("select", {
    dataset: { testid: "event-page-move-route-npc-target-direction" },
    on: {
      change: (event) => {
        if (event.currentTarget instanceof HTMLSelectElement) onChange(toDirection(event.currentTarget.value));
      },
    },
  });
  for (const option of [
    { value: "down", label: "아래" },
    { value: "left", label: "왼쪽" },
    { value: "right", label: "오른쪽" },
    { value: "up", label: "위" },
  ] as const) {
    select.append(el("option", { attrs: { value: option.value }, text: option.label }));
  }
  select.value = value;
  return el("label", { children: [el("span", { text: "NPC 방향" }), select] });
}

function toDirection(value: string): Dir {
  if (value === "left" || value === "right" || value === "up" || value === "down") return value;
  return "down";
}

function routeFooterButton(label: string, testId: string, onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: "event-page-move-route-footer-button",
    text: label,
    attrs: { type: "button" },
    dataset: { testid: testId },
    on: { click: onClick },
  });
}
