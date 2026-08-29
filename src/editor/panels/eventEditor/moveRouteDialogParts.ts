import { el } from "@/util/dom";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
} from "@/assets/easyrpgRtp";
import { applyCharsetFrameCrop } from "@/assets/charsetFrameCrop";
import type { Dir, MapId, MoveCommand } from "@/project/types";
import { databasePicker } from "./conditionForm";
import type { MoveRouteCommandContext } from "./moveRouteCommandCatalog";
import { mapSelectElement } from "./sharedPickers";

/** "이 단계 값" 패널의 현재값 + 각 필드의 변경 콜백. 컨텍스트 버튼들이 이 값을 읽어 커맨드를 만든다. */
export type MoveRouteParameterPanel = MoveRouteCommandContext & {
  readonly onSwitchId: (value: string) => void;
  readonly onSpriteId: (value: string) => void;
  readonly onSoundId: (value: string) => void;
  readonly onNpcTargetMapId: (value: MapId) => void;
  readonly onNpcTargetX: (value: number) => void;
  readonly onNpcTargetY: (value: number) => void;
  readonly onNpcTargetDirection: (value: Dir) => void;
  readonly onHopDx: (value: number) => void;
  readonly onHopDy: (value: number) => void;
  readonly onHopHeightPx: (value: number) => void;
  readonly onHopDurationMs: (value: number) => void;
};

export function renderTopBar(
  initialFrequency: number,
  onFrequencyChange: (frequency: number) => void,
  parameters: MoveRouteParameterPanel
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
        children: [el("legend", { text: "움직임 빈도" }), renderFrequencyRadios(initialFrequency, onFrequencyChange)],
      }),
      renderParameterPanel(parameters),
    ],
  });
}

export function renderFooter(close: () => void, onOk: () => void, onHelp: () => void): HTMLElement {
  return el("div", {
    class: "event-page-move-route-footer",
    children: [
      routeFooterButton("반영하고 닫기", "event-page-move-route-ok", onOk),
      routeFooterButton("닫기", "event-page-move-route-cancel", close),
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
    const labels = ["아주 드묾", "드묾", "가끔", "보통", "자주", "꽤 자주", "매우 자주", "아주 자주"];
    wrap.append(el("label", { children: [radio, el("span", { text: labels[value - 1] ?? String(value) })] }));
  }
  return wrap;
}

// 7 열 그리드(CSS)에 11 개 필드가 들어가므로 체공 4 필드는 자연히 둘째 줄로 흐른다.
// 같은 열 트랙을 재사용하는 폼 격자라 CSS 변경 없이 정렬이 맞는다.
function renderParameterPanel(parameters: MoveRouteParameterPanel): HTMLElement {
  return el("fieldset", {
    class: "event-page-move-route-parameters",
    children: [
      el("legend", { text: "이 단계 값" }),
      switchParameterRow(parameters.switchId, parameters.onSwitchId),
      graphicParameterRow(parameters.spriteId, parameters.onSpriteId),
      soundParameterRow(parameters.soundId, parameters.onSoundId),
      mapSelect("NPC 대상 맵", parameters.npcTargetMapId, parameters.onNpcTargetMapId),
      numberInput("NPC X", "event-page-move-route-npc-target-x", parameters.npcTargetX, parameters.onNpcTargetX),
      numberInput("NPC Y", "event-page-move-route-npc-target-y", parameters.npcTargetY, parameters.onNpcTargetY),
      directionSelect(parameters.npcTargetDirection, parameters.onNpcTargetDirection),
      // 라벨은 한 줄 격자에 들어가도록 짧게 — 자세한 설명은 title(툴팁)에 있다.
      // 점프 오프셋은 음수(왼쪽·위로 뛰기)가 필수라 min 을 풀어 준다.
      numberInput("점프 dx", "event-page-move-route-hop-dx", parameters.hopDx, parameters.onHopDx, {
        min: null,
        title: "점프가 건너뛸 가로 타일 수. 음수는 왼쪽.",
      }),
      numberInput("dy", "event-page-move-route-hop-dy", parameters.hopDy, parameters.onHopDy, {
        min: null,
        title: "점프가 건너뛸 세로 타일 수. 음수는 위쪽.",
      }),
      numberInput("높이px", "event-page-move-route-hop-height", parameters.hopHeightPx, parameters.onHopHeightPx, {
        title: "체공 높이. 0 이면 기본값 — 점프 12px, 낙하 128px(8칸). 보스 강림은 크게 잡는다.",
      }),
      numberInput(
        "시간ms",
        "event-page-move-route-hop-duration",
        parameters.hopDurationMs,
        parameters.onHopDurationMs,
        { title: "체공 시간. 0 이면 기본값 — 점프 300ms, 낙하 620ms. 이동 속도와 무관하게 이 시간이 쓰인다." }
      ),
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
    children: [el("span", { text: "스위치" }), picker, input],
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
    children: [el("span", { text: "모습" }), chip, select, input],
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
          "효과음 ",
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
  // 정면(아래) 대기 프레임 크롭.
  applyCharsetFrameCrop(chip, asset.path, { characterIndex: 0, direction: "down", pattern: 1 });
}

function mapSelect(label: string, value: MapId, onChange: (value: MapId) => void): HTMLElement {
  const select = mapSelectElement({
    selectedId: value,
    testid: "event-page-move-route-npc-target-map",
    allowEmpty: false,
    onChange: (mapId) => onChange(mapId),
  });
  return el("label", { children: [el("span", { text: label }), select] });
}

function numberInput(
  label: string,
  testId: string,
  value: number,
  onChange: (value: number) => void,
  // min: null 은 하한 없음(음수 허용). 생략하면 기존 NPC 좌표처럼 0 이 하한이다.
  options?: { readonly min?: string | null; readonly title?: string }
): HTMLElement {
  const min = options && "min" in options ? options.min : "0";
  const input = el("input", {
    attrs: {
      type: "number",
      ...(min === null ? {} : { min }),
      ...(options?.title === undefined ? {} : { title: options.title }),
    },
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
