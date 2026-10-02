import { renderActorM2CommandBody } from "./commandBodyM2Actor";
import { renderPage3M2CommandBody } from "./commandBodyM2Page3";
import { renderCoordinateMoveCommandBody } from "./commandBodyM2Coordinate";
import { renderWeightedBranchCommandBody } from "./commandBodyWeightedBranch";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { audioDescriptionView, audioPlayback, audioPlaybackBadge } from "@/editor/panels/audioResourcePresentation";
import { m2CommandById, type M2CommandFieldSpec } from "@/project/eventCommands/m2Catalog";
import { SCREEN_COLOR_OPTIONS } from "@/project/eventCommands/m2ModernCatalog";
import { screenColorToRgb } from "@/player/interpreter/commandCatalog";
import { isRecognizedTintValue } from "@/player/screen/tintModel";
import { KOREAN_LABEL_BY_TITLE } from "@/project/eventCommands/m2CatalogData";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { Command, M2CommandValue, ResourceKind, ResourceProfile, UploadedAsset } from "@/project/types";
import { el } from "@/util/dom";
import { switchVariablePicker } from "./switchVariablePicker";
import { field as fieldRow } from "./dom";
import type { CommandEditContext } from "./types";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type ResourcePickerItem = { readonly id: string; readonly imageHeight?: number; readonly imageWidth?: number; readonly kind: ResourceKind; readonly name: string };
type RecordPickerItem = { readonly id: string; readonly name: string };
type ResourceFieldSemantic = { readonly kind: "resource"; readonly label: string; readonly resourceKinds: ReadonlySet<ResourceKind> };
type RecordFieldSemantic = { readonly emptyText: string; readonly items: readonly RecordPickerItem[]; readonly kind: "record"; readonly label: string };
type OptionsFieldSemantic = { readonly kind: "options"; readonly label: string; readonly options: readonly { readonly label: string; readonly value: string }[] };
type FieldSemantic = OptionsFieldSemantic | RecordFieldSemantic | ResourceFieldSemantic;
type FieldControlRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly spec: M2CommandFieldSpec; readonly title: string; readonly value: M2CommandValue };
type OptionsControlRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly key: string; readonly semantic: OptionsFieldSemantic; readonly value: string };
type ResourcePickerRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly key: string; readonly semantic: ResourceFieldSemantic; readonly value: string };
type ResourcePreviewOptions = { readonly item: ResourcePickerItem | undefined; readonly project: ReturnType<typeof store.getCurrent>; readonly selectedName: string; readonly semantic: ResourceFieldSemantic; readonly testId: string; readonly value: string };
type RecordPickerRequest = { readonly context: CommandEditContext; readonly cmd: M2Command; readonly key: string; readonly semantic: RecordFieldSemantic; readonly value: string };

const IMAGE_RESOURCE_KINDS: ReadonlySet<ResourceKind> = new Set(["backdrop", "battle", "battleCharset", "battleWeapon", "charset", "chipset", "faceset", "gameOver", "monster", "picture", "system", "system2", "title"]);
const VEHICLE_OPTIONS = [
  { value: "boat", label: "소형선" },
  { value: "ship", label: "대형선" },
  { value: "airship", label: "비행선" },
] as const;
const PLAYER_OPTIONS = [{ value: "player", label: "주인공" }] as const;

export function renderM2CommandBody(context: CommandEditContext, cmd: Command): HTMLElement | undefined {
  if (cmd.kind !== "m2Command") return undefined;
  const body = renderM2CommandBodyInner(context, cmd);
  if (!body) return undefined;
  // 은퇴한 M2 행 — 저장된 프로젝트는 열리지만 새로 고르는 길은 피커에서 막혀 있다.
  // 전용 폼 경로를 포함해 모든 M2 다이얼로그에 붙는다.
  const deprecated = m2CommandById(cmd.commandId)?.deprecated;
  if (deprecated) {
    body.prepend(el("div", {
      class: "empty-hint",
      dataset: { testid: "m2-command-deprecated-notice" },
      text: `이 명령은 ${deprecated.supersededBy}로 통합되었습니다. ${deprecated.reason}`,
    }));
  }
  return body;
}

function renderM2CommandBodyInner(context: CommandEditContext, cmd: Extract<Command, { kind: "m2Command" }>): HTMLElement | undefined {
  const rich = renderActorM2CommandBody(context, cmd);
  if (rich) return rich;
  const weighted = renderWeightedBranchCommandBody(context, cmd);
  if (weighted) return weighted;
  const page3 = renderPage3M2CommandBody(context, cmd);
  if (page3) return page3;
  // OPRN-OUT-013 좌표 목적지 이동. 제네릭 폼은 변수 픽커·대상 픽커·실패 정책을
  // 표현할 수 없으므로 전용 폼이 필요하다.
  const coordinateMove = renderCoordinateMoveCommandBody(context, cmd);
  if (coordinateMove) return coordinateMove;
  const entry = m2CommandById(cmd.commandId);
  if (entry?.title === "Erase Event" || cmd.commandId === "m2-086-erase-event") {
    return eraseEventCommandBody(context, cmd);
  }
  const wrap = el("div", {
    class: "m2-command-body cream-command-form",
    dataset: { testid: `m2-command-body-${cmd.commandId}` },
  });
  if (entry) {
    wrap.append(el("div", {
      class: "cream-command-form-head",
      text: KOREAN_LABEL_BY_TITLE[entry.title] ?? entry.title,
    }));
  }

  if (!entry) {
    wrap.append(el("div", { class: "empty-hint", text: "이 명령은 이 에디터에서 아직 열 수 없습니다." }));
    return wrap;
  }

  const intent = M2_INTENT_BY_TITLE[entry.title];
  if (intent) wrap.append(m2IntentCard(intent));

  // 필드 없는 명령은 안내 한 줄만 — 도움말+빈문구 이중 노출을 막는다.
  if (entry.fields.length === 0) {
    wrap.append(el("div", { class: "empty-hint", text: m2CommandHelpText(0) }));
    return wrap;
  }

  wrap.append(
    el("div", {
      class: "empty-hint",
      text: m2CommandHelpText(entry.fields.length),
    })
  );

  for (const spec of entry.fields) {
    wrap.append(fieldRow(fieldLabelForSpec(cmd.commandId, entry.title, spec), controlForField({ context, cmd, spec, title: entry.title, value: cmd.fields[spec.key] ?? spec.defaultValue })));
  }
  if (entry.title === "Screen Effect") decorateScreenEffectBody(wrap);
  if (entry.title === "Particle Effect" || entry.title === "Sprite Look") decorateStagingTargetBody(wrap);
  return wrap;
}

/**
 * 파티클·모습 효과의 「어디에/누구」 — 고른 대상이 읽는 칸만 보인다. 이벤트 칸은 「특정 이벤트」, X·Y 는 「맵 좌표」일 때만.
 * 실측 캡처(2026-10-02): 「이 이벤트」인데 이벤트 선택과 X·Y 가 늘 떠 있어 무엇을 채워야 하는지 헷갈렸다.
 */
function decorateStagingTargetBody(wrap: HTMLElement): void {
  const targetSelect = wrap.querySelector<HTMLSelectElement>('[data-testid="m2-command-target-option-select"]');
  if (!targetSelect) return;
  const rowOf = (selector: string): HTMLElement | null => {
    const row = wrap.querySelector<HTMLElement>(selector)?.closest(".field");
    return row instanceof HTMLElement ? row : null;
  };
  const eventRow = rowOf('[data-testid^="m2-command-eventId-"]');
  const tileRows = [rowOf('[data-testid="m2-command-x-input"]'), rowOf('[data-testid="m2-command-y-input"]')];
  const sync = (): void => {
    if (eventRow) eventRow.hidden = targetSelect.value !== "event";
    for (const row of tileRows) if (row) row.hidden = targetSelect.value !== "tile";
  };
  targetSelect.addEventListener("change", sync);
  sync();
}

/**
 * 제네릭 M2 폼에 얹는 설명카드.
 *
 * 왜 필요한가 — 제네릭 폼은 영어 제목을 한국어로 바꿔 머리에 달고 필드를 그대로 나열할 뿐이라,
 * "이 명령이 무엇을 하고 **무엇을 하지 않는지**" 를 말하지 않는다. 그래서 감독은 이름만 보고
 * 엉뚱한 명령을 집었다(예: `이벤트 지우기` 를 맵에서 오브젝트를 삭제하는 버튼으로 읽었다).
 * 그 사고가 잦았던 명령부터 한 문단씩 붙인다.
 *
 * `copy` 의 둘째 문장은 **부정문**이다 — 헷갈리는 짝을 명시적으로 배제하는 것이 이 카드의 값이다.
 * 첫 문장만 쓸 거면 붙이지 마라. 한국어 머리글이 이미 같은 말을 하고 있다.
 */
type M2IntentCopy = { readonly testid: string; readonly title: string; readonly copy: string };

/** 키는 카탈로그의 영어 `title` — 전문 렌더러들이 쓰는 분기 축과 같다(id 는 별칭이 갈린다). */
const M2_INTENT_BY_TITLE: Readonly<Record<string, M2IntentCopy>> = {
  "Change Vehicle Graphic": {
    testid: "m2-change-vehicle-graphic-intent",
    title: "탈것 겉모습 바꾸기",
    copy: "배·비행선 같은 탈것이 맵 위에 그려지는 그림을 바꿉니다. 주인공이나 NPC 의 모습을 바꾸는 명령이 아닙니다.",
  },
  "Change Screen Transition": {
    testid: "m2-change-screen-transition-intent",
    title: "다음 전환 연출 정하기",
    copy: "앞으로 맵을 옮기거나 전투를 시작할 때 쓸 화면 전환 방식을 미리 정해 둡니다. 이 명령 자체가 지금 화면을 전환시키지는 않습니다.",
  },
  "Play Movie": {
    testid: "m2-play-movie-intent",
    title: "동영상 재생",
    copy: "동영상 파일을 화면 전체에 재생하고, 끝날 때까지 다음 명령을 기다립니다. 배경에 깔아 두는 음악·효과음이 아닙니다.",
  },
  "Open Menu Screen": {
    testid: "m2-open-menu-screen-intent",
    title: "메뉴 화면 열기",
    copy: "플레이어가 메뉴 버튼을 누른 것처럼 게임 안의 메뉴를 엽니다. 에디터의 메뉴나 설정 창을 여는 명령이 아닙니다.",
  },
  "Camera Control": {
    testid: "m2-camera-control-intent",
    title: "카메라 옮기기",
    copy: "화면이 비추는 위치와 배율만 바꿉니다. 주인공이나 이벤트를 실제로 이동시키지는 않습니다 — 이동은 `이동 경로 설정` 이나 `좌표로 이동` 입니다.",
  },
  "Region Trigger": {
    testid: "m2-region-trigger-intent",
    title: "지역을 밟으면 일어날 일",
    copy: "맵에 칠해 둔 지역 번호를 밟았을 때 이벤트를 부르거나 스위치를 켜도록 연결합니다. 지역 번호를 칠하는 것은 맵 편집 화면에서 합니다.",
  },
  "Cutscene Control": {
    testid: "m2-cutscene-control-intent",
    title: "컷신 모드 켜고 끄기",
    copy: "켜는 동안 조작을 잠그고 화면 UI 를 숨깁니다. 컷신에서 무슨 일이 벌어지는지는 이 명령 다음에 오는 명령들이 정합니다.",
  },
};

/** 설명카드 한 장. 판정 축은 `m2-command-intent-card` 클래스 하나로 모은다. */
function m2IntentCard(intent: M2IntentCopy): HTMLElement {
  return el("div", {
    class: "m2-command-intent-card",
    dataset: { testid: intent.testid },
    attrs: { role: "note" },
    children: [
      el("div", { class: "m2-command-intent-title", text: intent.title }),
      el("p", { class: "m2-command-intent-body", text: intent.copy }),
    ],
  });
}

/** 시간 프리셋 칩 — 런타임 clampMs(50~5000) 안쪽의 흔한 세 값. */
const SCREEN_EFFECT_DURATION_PRESETS = [
  { id: "fast", label: "빠른", ms: 300 },
  { id: "normal", label: "보통", ms: 800 },
  { id: "slow", label: "느린", ms: 1600 },
] as const;

/**
 * `값` 을 실제로 읽는 효과. planScreenEffect/applyScreenEffect 와 같은 목록이다.
 * fadeIn/fadeOut 은 도착 색이 고정(투명/검정)이라 값을 보지 않는다 — 입력을 보여주면
 * 감독은 "여기에 뭘 넣어야 하나" 를 고민하고, 넣어도 아무 일도 일어나지 않는다(D9).
 */
const SCREEN_EFFECT_VALUE_USERS: ReadonlySet<string> = new Set(["tint", "flash", "weather", "wave", "mosaic", "rotate", "letterbox"]);
/** 값이 색이 아니라 숫자(세기·두께)인 효과 — 색 피커·견본을 숨기고 자리표시를 바꾼다. */
const SCREEN_EFFECT_NUMBER_VALUES: Readonly<Record<string, string>> = {
  wave: "물결 세기 px 0~16 (비우면 4)",
  mosaic: "모자이크 칸 px 0~32 (비우면 8)",
  rotate: "기울기 도 -180~180 (비우면 8)",
  letterbox: "띠 두께 % 0~25 (비우면 12)",
};

/**
 * 화면 효과 폼에 의도 카드와 시간 프리셋을 얹고, 쓰이지 않는 `값` 행을 숨긴다(D6/D9).
 * 폼은 효과를 바꿔도 재빌드되지 않으므로(shouldRerenderCommandForm) 여기서 직접 동기화한다.
 */
function decorateScreenEffectBody(wrap: HTMLElement): void {
  const effectSelect = wrap.querySelector<HTMLSelectElement>('[data-testid="m2-command-effect-option-select"]');
  const valueRow = wrap.querySelector<HTMLElement>('[data-testid="m2-command-value-input"]')?.closest(".field");
  const durationInput = wrap.querySelector<HTMLInputElement>('[data-testid="m2-command-durationMs-input"]');
  const durationRow = durationInput?.closest(".field");
  if (!effectSelect || !(valueRow instanceof HTMLElement) || !durationInput || !(durationRow instanceof HTMLElement)) return;

  valueRow.dataset.testid = "m2-screen-effect-value-field";
  const intent = el("div", {
    class: "m2-command-intent-card m2-screen-effect-intent",
    dataset: { testid: "m2-screen-effect-intent" },
    attrs: { role: "note" },
  });
  const intentTitle = el("div", { class: "m2-command-intent-title" });
  const intentCopy = el("p", { class: "m2-command-intent-body" });
  intent.append(intentTitle, intentCopy);

  const presets = el("div", {
    class: "m2-screen-effect-duration-presets",
    attrs: { role: "group", "aria-label": "시간 프리셋" },
  });
  const sync = (): void => {
    const effect = effectSelect.value || "fadeIn";
    const value = wrap.querySelector<HTMLInputElement>('[data-testid="m2-command-value-input"]')?.value ?? "";
    const durationMs = clampScreenEffectMs(Number(durationInput.value));
    valueRow.hidden = !SCREEN_EFFECT_VALUE_USERS.has(effect);
    const numberHint = SCREEN_EFFECT_NUMBER_VALUES[effect];
    for (const colorOnly of valueRow.querySelectorAll<HTMLElement>(".m2-screen-color-picker, .m2-screen-color-swatches")) {
      colorOnly.hidden = numberHint !== undefined;
    }
    const valueInput = valueRow.querySelector<HTMLInputElement>('[data-testid="m2-command-value-input"]');
    if (valueInput) valueInput.placeholder = numberHint ?? "#rrggbb / red / 128,64,32,0.5";
    intentTitle.textContent = screenEffectIntentTitle(effect);
    intentCopy.textContent = screenEffectIntentCopy(effect, value, durationMs);
    for (const chip of presets.children) {
      chip.setAttribute("aria-pressed", chip.getAttribute("data-ms") === String(durationMs) ? "true" : "false");
    }
  };

  for (const preset of SCREEN_EFFECT_DURATION_PRESETS) {
    presets.append(
      el("button", {
        class: "m2-screen-effect-duration-chip",
        text: `${preset.label} ${preset.ms}ms`,
        attrs: { type: "button", "aria-pressed": "false", "data-ms": String(preset.ms) },
        dataset: { testid: `m2-screen-effect-duration-${preset.id}` },
        on: {
          click: () => {
            durationInput.value = String(preset.ms);
            // 숫자 필드가 스스로 범위 안내를 갱신하고(input) 명령에 커밋하도록(change) 태운다.
            durationInput.dispatchEvent(new Event("input", { bubbles: true }));
            durationInput.dispatchEvent(new Event("change", { bubbles: true }));
            sync();
          },
        },
      })
    );
  }
  durationRow.append(presets);

  // 효과/값/시간 어디를 건드려도 의도 카드와 값 행 노출이 따라온다.
  wrap.addEventListener("change", sync);
  wrap.addEventListener("input", sync);
  wrap.prepend(intent);
  sync();
}

/** 런타임 clampMs(commandCatalog.ts) 와 같은 범위. 의도 카드가 실제 실행 시간을 말해야 한다. */
function clampScreenEffectMs(value: number): number {
  if (!Number.isFinite(value)) return 300;
  return Math.min(5000, Math.max(50, Math.round(value)));
}

function screenEffectIntentTitle(effect: string): string {
  switch (effect) {
    case "fadeIn": return "페이드 인";
    case "fadeOut": return "페이드 아웃";
    case "flash": return "플래시";
    case "tint": return "색조";
    case "weather": return "날씨";
    case "wave": return "물결 왜곡";
    case "mosaic": return "모자이크";
    case "rotate": return "화면 기울기";
    case "clearDistortion": return "왜곡 모두 끄기";
    case "letterbox": return "레터박스";
    case "clearLetterbox": return "레터박스 걷기";
    default: return effect;
  }
}

/** 고른 효과가 무엇을 하는지 한 줄로. 문장은 planScreenEffect 의 실제 실행 경로에서 나온다. */
function screenEffectIntentCopy(effect: string, value: string, durationMs: number): string {
  const color = value.trim();
  switch (effect) {
    case "fadeIn":
      return `검게 덮인 화면을 ${durationMs}ms 동안 걷어내며 서서히 밝아진다. 값은 쓰지 않는다.`;
    case "fadeOut":
      return `${durationMs}ms 동안 화면이 점점 어두워져 검정으로 덮인다. 값은 쓰지 않는다.`;
    case "flash":
      return `화면이 ${color || "흰색"}으로 한 번 밝게 번쩍이고 ${durationMs}ms 안에 원래대로 돌아온다.`;
    case "tint":
      return color
        ? `화면 전체가 ${durationMs}ms 동안 ${color} 색조로 물든다.`
        : `값이 비어 있어 ${durationMs}ms 동안 색조를 지운다(원래 색으로 되돌림).`;
    case "weather":
      return `날씨 레이어를 '${color || "none"}' 로 바꾼다. 날씨는 즉시 바뀌어 시간(${durationMs}ms)을 쓰지 않는다.`;
    case "wave":
      return `게임 화면이 줄마다 물결처럼 흔들린다(세기 ${color || "4"}px). ${durationMs}ms 동안 차오르고, 끌 때까지 남는다(세이브 포함).`;
    case "mosaic":
      return `게임 화면이 ${color || "8"}px 모자이크 칸으로 뭉개진다. ${durationMs}ms 동안 바뀌고, 끌 때까지 남는다.`;
    case "rotate":
      return `게임 화면이 ${color || "8"}° 기운다. ${durationMs}ms 동안 기울고, 끌 때까지 남는다.`;
    case "clearDistortion":
      return `물결·모자이크·기울기를 ${durationMs}ms 동안 모두 거둔다.`;
    case "letterbox":
      return `화면 위아래에 ${color || "12"}% 두께 검은 띠가 ${durationMs}ms 동안 들어온다. 대화창은 띠 위에 그대로 뜬다. 걷을 때까지 남는다.`;
    case "clearLetterbox":
      return `위아래 검은 띠를 ${durationMs}ms 동안 걷는다.`;
    default:
      return `'${effect}' 는 런타임에 렌더러가 없어 실행되지 않는다(${durationMs}ms 도 무시된다).`;
  }
}

function eraseEventCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const project = store.getCurrent();
  const selectedEventId = String(cmd.fields.eventId ?? "").trim();
  const target = el("select", {
    class: "m2-record-picker",
    dataset: { testid: "m2-erase-event-target" },
    attrs: { "aria-label": "지울 이벤트" },
  }) as HTMLSelectElement;
  target.append(el("option", { text: "이 이벤트", attrs: { value: "" } }));
  for (const event of eventRecords(project)) {
    target.append(el("option", { text: event.name, attrs: { value: event.id } }));
  }
  if (selectedEventId && !eventRecords(project).some((event) => event.id === selectedEventId)) {
    target.append(el("option", { text: `현재 값: ${selectedEventId}`, attrs: { value: selectedEventId } }));
  }
  target.value = selectedEventId;

  const previewTitle = el("div", { class: "m2-erase-event-preview-title" });
  const previewSub = el("div", {
    class: "m2-erase-event-preview-sub",
    text: "맵을 다시 불러오면 이벤트가 다시 나타납니다.",
  });
  const preview = el("div", {
    class: "m2-erase-event-preview",
    dataset: { testid: "m2-erase-event-preview" },
    children: [previewTitle, previewSub],
  });
  const renderPreview = () => {
    const selected = eventRecords(project).find((event) => event.id === target.value);
    previewTitle.textContent = target.value
      ? `${selected?.name ?? target.value} 지우기`
      : "이 이벤트 지우기";
  };
  target.addEventListener("change", () => {
    updateField(context, cmd, "eventId", target.value);
    renderPreview();
  });
  renderPreview();

  return el("div", {
    class: "m2-command-body m2-erase-event-body",
    dataset: { testid: `m2-command-body-${cmd.commandId}` },
    children: [
      el("div", {
        class: "m2-command-intent-card m2-command-intent m2-erase-event-card",
        dataset: { testid: "m2-command-intent-card" },
        children: [
          el("div", { class: "m2-command-intent-title", text: "플레이 중 이벤트 지우기" }),
          el("p", {
            class: "m2-command-intent-copy",
            text: "플레이 화면에서 이벤트를 임시로 숨깁니다. 에디터 맵에서 이벤트 오브젝트를 삭제하는 버튼이 아닙니다.",
          }),
        ],
      }),
      el("div", {
        class: "m2-erase-event-field",
        children: [
          el("label", { class: "m2-erase-event-label", text: "어떤 이벤트" }),
          target,
        ],
      }),
      preview,
    ],
  });
}

function m2CommandHelpText(fieldCount: number): string {
  return fieldCount > 0 ? "값을 고르고 확인을 누르면 적용됩니다." : "이 명령은 추가 설정 없이 실행됩니다.";
}

function controlForField(request: FieldControlRequest): HTMLElement {
  // 화면 효과의 `값` 은 생 텍스트여서 `#xyz` 가 조용히 통과했다 — 색 피커를 붙인다.
  if (request.title === "Screen Effect" && request.spec.key === "value") {
    return screenColorControl(request);
  }
  const semantic = fieldSemantic(request);
  if (semantic?.kind === "record") {
    // 스위치/변수 레코드는 이벤트 에디터 전체 계약에 맞춰 모달 트리거 픽커로 통일한다.
    if (request.spec.key === "switchId" || request.spec.key === "variableId") {
      return m2SwitchVariableControl({
        context: request.context,
        cmd: request.cmd,
        key: request.spec.key,
        kind: request.spec.key === "switchId" ? "switch" : "variable",
        value: String(request.value),
      });
    }
    return recordPickerControl({ context: request.context, cmd: request.cmd, key: request.spec.key, semantic, value: String(request.value) });
  }
  if (semantic?.kind === "resource") return resourcePickerControl({ context: request.context, cmd: request.cmd, key: request.spec.key, semantic, value: String(request.value) });
  if (semantic?.kind === "options") return optionsControl({ context: request.context, cmd: request.cmd, key: request.spec.key, semantic, value: String(request.value) });
  const { context, cmd, spec, value } = request;
  if (spec.type === "textarea") return textareaControl(context, cmd, spec, String(value));
  if (spec.type === "number") return numberControl(context, cmd, spec, value);
  if (spec.type === "boolean") return booleanControl(context, cmd, spec, value);
  if (spec.type === "select") return selectControl(context, cmd, spec, String(value));
  return textControl(context, cmd, spec, String(value));
}

function textControl(context: CommandEditContext, cmd: M2Command, spec: M2CommandFieldSpec, value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.testid = `m2-command-${spec.key}-input`;
  input.addEventListener("change", () => updateField(context, cmd, spec.key, input.value));
  return input;
}

function textareaControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: string
): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.dataset.testid = `m2-command-${spec.key}-textarea`;
  textarea.addEventListener("change", () => updateField(context, cmd, spec.key, textarea.value));
  return textarea;
}

function numberControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: M2CommandValue
): HTMLElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(typeof value === "number" ? value : spec.defaultValue);
  input.dataset.testid = `m2-command-${spec.key}-input`;
  input.addEventListener("change", () => updateField(context, cmd, spec.key, parseNumber(input.value)));
  if (spec.min === undefined && spec.max === undefined && spec.step === undefined) return input;

  // 범위가 있는 숫자 필드는 해당 범위를 말하고, 밖으로 나가면 어떻게 잡힐지 알려준다.
  if (spec.min !== undefined) input.min = String(spec.min);
  if (spec.max !== undefined) input.max = String(spec.max);
  if (spec.step !== undefined) input.setAttribute("step", String(spec.step));
  const note = el("div", { class: "m2-field-note", dataset: { testid: `m2-command-${spec.key}-note` } });
  const syncNote = () => {
    const raw = Number(input.value);
    const min = spec.min ?? Number.NEGATIVE_INFINITY;
    const max = spec.max ?? Number.POSITIVE_INFINITY;
    const outOfRange = !Number.isFinite(raw) || raw < min || raw > max;
    input.setAttribute("aria-invalid", outOfRange ? "true" : "false");
    note.classList.toggle("is-invalid", outOfRange);
    note.textContent = outOfRange
      ? `실제 적용 범위는 ${spec.min ?? ""}~${spec.max ?? ""} 입니다 — ${input.value} 는 ${Math.min(max, Math.max(min, Number.isFinite(raw) ? raw : min))} 로 잡힙니다.`
      : `적용 범위 ${spec.min ?? ""}~${spec.max ?? ""}`;
  };
  input.addEventListener("input", syncNote);
  syncNote();
  return el("div", { class: "m2-number-field", children: [input, note] });
}

/**
 * 화면 효과 값 필드 — 자유 텍스트(날씨 `rain,0.9` 등)를 유지하면서
 * 네이티브 색 피커와 프리셋 색 칩을 같이 주고, 알 수 없는 색은 aria-invalid 로 알린다.
 */
function screenColorControl(request: FieldControlRequest): HTMLElement {
  const { context, cmd, spec } = request;
  const current = String(request.value ?? "");
  // 효과 select 를 바꿔도 폼은 재빌드되지 않는다(프리뷰만 갱신) — 검사 시점에 다시 읽는다.
  const currentEffect = (): string => {
    const latest = context.getCurrentCommand?.();
    if (latest?.kind === "m2Command" && latest.commandId === cmd.commandId) {
      return String(latest.fields.effect ?? "fadeIn");
    }
    return String(cmd.fields.effect ?? "fadeIn");
  };

  const text = document.createElement("input");
  text.type = "text";
  text.value = current;
  text.placeholder = "#rrggbb / red / 128,64,32,0.5";
  text.dataset.testid = `m2-command-${spec.key}-input`;

  const picker = el("input", {
    class: "m2-screen-color-picker",
    attrs: { type: "color", "aria-label": "색 골라서 쓰기" },
    dataset: { testid: `m2-command-${spec.key}-color` },
  }) as HTMLInputElement;
  picker.type = "color";
  picker.value = colorFieldHex(current);

  const error = el("div", {
    class: "m2-field-error",
    attrs: { role: "status" },
    dataset: { testid: `m2-command-${spec.key}-error` },
  });
  const swatches = el("div", { class: "m2-screen-color-swatches" });

  const syncValidity = (value: string) => {
    // 색을 안 쓰는 효과(페이드/날씨)는 검사하지 않는다 — 플레이어 해석과 동일.
    const effect = currentEffect();
    const checked = effect === "tint" || effect === "flash";
    const invalid = checked && value.trim().length > 0 && !isRecognizedTintValue(value);
    text.setAttribute("aria-invalid", invalid ? "true" : "false");
    error.textContent = invalid
      ? `알 수 없는 색 '${value.trim()}' — #rrggbb, red 등 이름, 또는 128,64,32,0.5 형식을 쓴다.`
      : "";
    for (const chip of swatches.children) {
      chip.setAttribute("aria-pressed", chip.getAttribute("data-color") === value.trim() ? "true" : "false");
    }
    if (!invalid && value.trim()) picker.value = colorFieldHex(value);
  };

  const commit = (value: string) => {
    // 같은 값을 다시 넣으면 캐럿이 끝으로 튄다 — 타이핑 중 커밋에서는 건드리지 않는다.
    if (text.value !== value) text.value = value;
    syncValidity(value);
    updateField(context, cmd, spec.key, value);
  };

  for (const option of SCREEN_COLOR_OPTIONS) {
    const chip = el("button", {
      class: "m2-screen-color-swatch",
      text: option.label,
      attrs: { type: "button", "aria-pressed": "false", "data-color": option.value },
      dataset: { testid: `m2-command-${spec.key}-swatch-${option.value}` },
      on: { click: () => commit(option.value) },
    });
    chip.style.setProperty("--m2-swatch-color", colorFieldHex(option.value));
    swatches.append(chip);
  }

  // 타이핑 즉시 커밋한다 — 프리뷰가 런타임 해석(알 수 없는 색 = 흰색 워시)을 바로 보여줘야
  // "조용히 통과"가 사라진다. 폼은 재빌드되지 않으므로(shouldRerenderCommandForm) 포커스는 유지된다.
  text.addEventListener("input", () => commit(text.value));
  text.addEventListener("change", () => commit(text.value));
  picker.addEventListener("input", () => commit(picker.value));
  syncValidity(current);

  return el("div", {
    class: "m2-screen-color-field",
    children: [
      el("div", { class: "m2-screen-color-row", children: [text, picker] }),
      swatches,
      error,
    ],
  });
}

/** 텍스트 값을 input[type=color] 가 받는 #rrggbb 로. 알 수 없는 값은 런타임과 같이 흰색. */
function colorFieldHex(value: string): string {
  const rgb = screenColorToRgb(value.trim());
  const hex = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${hex(rgb.red)}${hex(rgb.green)}${hex(rgb.blue)}`;
}

function booleanControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: M2CommandValue
): HTMLInputElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = value === true || value === "true";
  checkbox.dataset.testid = `m2-command-${spec.key}-checkbox`;
  checkbox.addEventListener("change", () => updateField(context, cmd, spec.key, checkbox.checked));
  return checkbox;
}

function selectControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: string
): HTMLSelectElement {
  const select = document.createElement("select");
  select.dataset.testid = `m2-command-${spec.key}-select`;
  for (const option of spec.options ?? []) {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    select.append(optionElement);
  }
  select.value = value;
  select.addEventListener("change", () => updateField(context, cmd, spec.key, select.value));
  return select;
}

function resourcePickerControl(request: ResourcePickerRequest): HTMLElement {
  const project = store.getCurrent();
  const audio = isAudioResourceSemantic(request.semantic);
  const items: readonly ResourcePickerItem[] = audio
    ? (["music", "sound"] as const)
      .filter(kind => request.semantic.resourceKinds.has(kind))
      .flatMap(kind => listAudioResources(kind, project))
    : resourcePickerItems(project.resourceProfiles, Object.values(project.assets.uploaded), request.semantic.resourceKinds);
  const selectedItem = items.find((item) => item.id === request.value);
  const selectedName = selectedItem?.name ?? (request.value ? `목록에 없는 리소스: ${request.value}` : "선택 없음");
  const testIds = resourcePickerTestIds(request.key);
  const name = el("div", {
    class: "m2-resource-selected-name",
    text: selectedName,
    dataset: { testid: testIds.selectedName },
  });
  let preview = resourcePreview({
    item: selectedItem, project, selectedName,
    semantic: request.semantic, testId: testIds.preview, value: request.value,
  });
  const select = el("select", {
    attrs: { "aria-label": request.semantic.label },
    dataset: { testid: testIds.picker },
  });
  select.append(el("option", { text: "(선택 없음)", attrs: { value: "" } }));
  if (request.value && selectedItem === undefined) {
    select.append(el("option", { text: `현재 값: ${request.value}`, attrs: { value: request.value } }));
  }
  for (const item of items) {
    select.append(el("option", { text: `${item.name} (${item.id})`, attrs: { value: item.id } }));
  }
  select.value = request.value;
  let selectedId = request.value;
  if (audio) {
    for (const option of select.querySelectorAll<HTMLOptionElement>("option")) option.disabled = audioPlayback(option.value, project).midi;
  }
  select.addEventListener("change", () => {
    if (audio && audioPlayback(select.value, store.getCurrent()).midi) {
      select.value = selectedId;
      return;
    }
    selectedId = select.value;
    updateField(request.context, request.cmd, request.key, select.value);
    if (!audio) return;
    const current = store.getCurrent();
    const item = (["music", "sound"] as const)
      .filter(kind => request.semantic.resourceKinds.has(kind))
      .flatMap(kind => listAudioResources(kind, current))
      .find(entry => entry.id === select.value);
    const selectedName = item?.name ?? (select.value || "선택 없음");
    name.textContent = selectedName;
    const next = resourcePreview({
      item, project: current, selectedName,
      semantic: request.semantic, testId: testIds.preview, value: select.value,
    });
    preview.replaceWith(next);
    preview = next;
  });

  return el("div", {
    class: "m2-resource-picker",
    children: [
      select,
      name,
      preview,
    ],
  });
}

/** 스위치/변수 필드 공용: 숨은 select + 선택 카드 + 모달 트리거. */
function m2SwitchVariableControl(options: {
  readonly context: CommandEditContext;
  readonly cmd: M2Command;
  readonly key: string;
  readonly kind: "switch" | "variable";
  readonly value: string;
}): HTMLElement {
  let selectedName = options.value ? `목록에 없는 항목: ${options.value}` : "선택 없음";
  const nameEl = el("div", {
    class: "m2-record-selected-name",
    text: selectedName,
    dataset: { testid: `m2-command-${options.key}-record-selected-name` },
  });
  const picker = switchVariablePicker({
    kind: options.kind,
    selectedId: options.value,
    className: "m2-record-modal-picker",
    pickerTestId: `m2-command-${options.key}-record-open`,
    selectTestId: `m2-command-${options.key}-record-select`,
    onChange: (id) => {
      selectedName = id
        ? store.getCurrent()[options.kind === "switch" ? "switches" : "variables"].find((entry) => entry.id === id)?.name ?? `목록에 없는 항목: ${id}`
        : "선택 없음";
      nameEl.textContent = selectedName;
      updateField(options.context, options.cmd, options.key, id);
    },
  });
  void picker;
  return el("div", { class: "m2-record-picker", children: [picker.root, nameEl] });
}

function recordPickerControl(request: RecordPickerRequest): HTMLElement {
  const selectedItem = request.semantic.items.find((item) => item.id === request.value);
  const selectedName = selectedItem?.name ?? (request.value ? `목록에 없는 항목: ${request.value}` : "선택 없음");
  const select = el("select", {
    attrs: { "aria-label": request.semantic.label },
    dataset: { testid: `m2-command-${request.key}-record-select` },
  });
  select.append(el("option", { text: `(${request.semantic.emptyText})`, attrs: { value: "" } }));
  if (request.value && selectedItem === undefined) select.append(el("option", { text: `현재 값: ${request.value}`, attrs: { value: request.value } }));
  for (const item of request.semantic.items) {
    select.append(el("option", { text: item.name.trim() || "(이름 없음)", attrs: { value: item.id } }));
  }
  select.value = request.value;
  select.addEventListener("change", () => updateField(request.context, request.cmd, request.key, select.value));
  return el("div", {
    class: "m2-record-picker",
    children: [
      select,
      el("div", { class: "m2-record-selected-name", text: selectedName, dataset: { testid: `m2-command-${request.key}-record-selected-name` } }),
    ],
  });
}

function optionsControl(request: OptionsControlRequest): HTMLSelectElement {
  const select = el("select", { attrs: { "aria-label": request.semantic.label }, dataset: { testid: `m2-command-${request.key}-option-select` } }) as HTMLSelectElement;
  const legacyCue = request.key === "cue" && request.cmd.fields.cue === undefined
    && (request.cmd.commandId === "m2-027-change-system-bgm" || request.cmd.commandId === "m2-028-change-system-se");
  if (legacyCue) select.append(el("option", { text: "기존 메타데이터 (소리를 선택하면 적용)", attrs: { value: "", disabled: "" } }));
  for (const option of request.semantic.options) select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  select.value = legacyCue ? "" : request.value;
  select.addEventListener("change", () => updateField(request.context, request.cmd, request.key, select.value));
  return select;
}

function resourcePickerItems(
  profiles: readonly ResourceProfile[],
  uploaded: readonly UploadedAsset[],
  selectedKinds: ReadonlySet<ResourceKind>
): readonly ResourcePickerItem[] {
  const seenIds = new Set<string>();
  const items: ResourcePickerItem[] = [];
  for (const profile of profiles) {
    if (profile.assetId === undefined || seenIds.has(profile.assetId) || !selectedKinds.has(profile.kind)) continue;
    seenIds.add(profile.assetId);
    items.push({
      id: profile.assetId,
      kind: profile.kind,
      name: profile.name,
      ...resourceImageSize(profile.imageWidth, profile.imageHeight),
    });
  }
  for (const asset of uploaded) {
    const kind = resourceKindFromUploaded(asset.kind);
    if (kind === null || seenIds.has(asset.id) || !selectedKinds.has(kind)) continue;
    seenIds.add(asset.id);
    items.push({
      id: asset.id,
      kind,
      name: asset.name,
      ...resourceImageSize(asset.meta.width, asset.meta.height),
    });
  }
  return items;
}

function isAudioResourceSemantic(semantic: ResourceFieldSemantic): boolean {
  return semantic.resourceKinds.size > 0 && Array.from(semantic.resourceKinds).every((kind) => kind === "music" || kind === "sound");
}

function resourcePreview(options: ResourcePreviewOptions): HTMLElement {
  // 오디오 필드는 그림 미리보기 우물을 만들지 않는다 — 빈 640x500 상자에 "그림을 고르세요" 는 거짓말.
  if (isAudioResourceSemantic(options.semantic)) {
    const resourceId = options.item?.id ?? options.value;
    const resource = (["music", "sound"] as const)
      .filter(kind => options.semantic.resourceKinds.has(kind))
      .flatMap(kind => listAudioResources(kind, options.project))
      .find(entry => entry.id === resourceId);
    return el("div", {
      class: "m2-resource-audio-note",
      attrs: { "aria-label": "오디오 리소스 선택" },
      dataset: { testid: options.testId, resourceId },
      children: [
        el("div", {
          text: options.value ? `선택한 음악: ${options.selectedName}` : "선택한 음악이 여기에 표시됩니다",
        }),
        audioDescriptionView(resource),
        audioPlaybackBadge(resourceId, options.project),
      ],
    });
  }
  const resourceId = options.item?.id ?? options.value;
  const url = resolveAssetResourceUrl(resourceId, { project: options.project });
  const canPreview = options.item !== undefined && IMAGE_RESOURCE_KINDS.has(options.item.kind) && url !== null;
  const preview = el("div", {
    class: "m2-resource-preview",
    attrs: { "aria-label": resourcePreviewAriaLabel(options.item?.kind) },
    dataset: { testid: options.testId, resourceId },
  });
  if (canPreview) {
    preview.append(
      resourcePreviewImage(url, options.selectedName, options.item),
      el("span", { class: "m2-resource-preview-label", text: options.selectedName })
    );
    return preview;
  }
  preview.dataset.empty = "true";
  // 종류가 근거다 — 동영상 칸에 "그림을 고르세요"는 거짓말이다.
  const emptyCopy = options.semantic.resourceKinds.size === 1 && options.semantic.resourceKinds.has("movie")
    ? "동영상을 고르세요"
    : "그림을 고르세요";
  preview.textContent = options.value ? `${options.selectedName} 미리보기 없음` : emptyCopy;
  return preview;
}

function resourcePreviewImage(url: string, selectedName: string, item: ResourcePickerItem): HTMLImageElement {
  const attrs: Record<string, string> = {
    alt: selectedName,
    src: url,
  };
  if (item.imageWidth !== undefined) attrs.width = String(item.imageWidth);
  if (item.imageHeight !== undefined) attrs.height = String(item.imageHeight);
  return el("img", { attrs });
}

function fieldSemantic(request: FieldControlRequest): FieldSemantic | undefined {
  const project = store.getCurrent();
  const { spec, title } = request;
  if (spec.key === "resourceId") return resourceSemantic(title);
  if (spec.key === "actorId") return recordSemantic("주인공 선택", "주인공 선택", namedRecords(project.database.actors));
  if (spec.key === "classId") return recordSemantic("직업 선택", "직업 선택", namedRecords(project.database.classes));
  if (spec.key === "skillId") return recordSemantic("스킬 선택", "스킬 선택", namedRecords(project.database.skills));
  if (spec.key === "itemId") return recordSemantic("아이템 선택", "아이템 선택", namedRecords(project.database.items));
  if (spec.key === "equipmentId") return recordSemantic("장비 선택", "장비 선택", namedRecords(project.database.equipment));
  if (spec.key === "stateId") return recordSemantic("상태 선택", "상태 선택", namedRecords(project.database.states));
  if (spec.key === "enemyId") return recordSemantic("적 선택", "적 선택", namedRecords(project.database.enemies));
  if (spec.key === "troopId") return recordSemantic("적 그룹 선택", "적 그룹 선택", namedRecords(project.database.troops));
  if (spec.key === "switchId") return recordSemantic("스위치 선택", "스위치 선택", switchVariableRecords(project, "switch"));
  if (spec.key === "eventId") return recordSemantic("이벤트 선택", "이벤트 선택", eventRecords(project));
  if (spec.key === "commonEventId") return recordSemantic("이벤트 고르기", "이벤트 고르기", namedRecords(project.commonEvents));
  if (spec.key === "tilesetId") return recordSemantic("맵 그림 세트", "맵 그림 세트", namedRecords(Object.values(project.tilesets)));
  if (spec.key === "animationId") return recordSemantic("전투 애니메이션 선택", "전투 애니메이션 선택", namedRecords(project.database.battleAnimations));
  if (spec.key === "variableId") return recordSemantic("변수 선택", "변수 선택", switchVariableRecords(project, "variable"));
  if (spec.key === "mapId") return recordSemantic("맵 선택", "맵 선택", namedRecords(Object.values(project.maps)));
  if (spec.key === "target") {
    const semantic = targetSemantic(title, project);
    if (semantic) return semantic;
  }
  if (spec.key === "value") {
    const semantic = valueSemantic(title, project);
    if (semantic) return semantic;
  }
  if (spec.type === "select" && spec.options) return { kind: "options", label: spec.label, options: spec.options };
  return undefined;
}

function targetSemantic(title: string, project: ReturnType<typeof store.getCurrent>): FieldSemantic | undefined {
  if (title.includes("Actor") || title === "Change State" || title === "Damage Processing" || title === "Name Input Processing" || title === "Recover All") return recordSemantic("주인공 선택", "주인공 선택", namedRecords(project.database.actors));
  if (title.includes("Enemy")) return recordSemantic("적 선택", "적 선택", namedRecords(project.database.enemies));
  if (title.includes("Vehicle")) return { kind: "options", label: "탈것 선택", options: VEHICLE_OPTIONS };
  if (title.includes("Player")) return { kind: "options", label: "주인공 선택", options: PLAYER_OPTIONS };
  if (title.includes("Event") || title === "Flash Event" || title === "Move Event" || title === "Show Animation") return recordSemantic("이벤트 선택", "이벤트 선택", eventRecords(project));
  return undefined;
}

function valueSemantic(title: string, project: ReturnType<typeof store.getCurrent>): FieldSemantic | undefined {
  if (title === "Change Actor Class") return recordSemantic("직업 선택", "직업 선택", namedRecords(project.database.classes));
  if (title === "Change Skills") return recordSemantic("스킬 선택", "스킬 선택", namedRecords(project.database.skills));
  if (title === "Change Items") return recordSemantic("아이템 선택", "아이템 선택", namedRecords(project.database.items));
  if (title === "Change State" || title === "Change Enemy State") return recordSemantic("상태 선택", "상태 선택", namedRecords(project.database.states));
  if (title === "Change Equipment") return recordSemantic("장비 선택", "장비 선택", namedRecords(project.database.equipment));
  if (title === "Change Tileset") return recordSemantic("맵 그림 세트", "맵 그림 세트", namedRecords(Object.values(project.tilesets)));
  if (title === "Change Battle Commands") return recordSemantic("전투 명령 선택", "전투 명령 선택", namedRecords(project.database.battleCommands ?? []));
  if (title === "Change System Graphic") return { kind: "resource", label: "메뉴 모습 선택", resourceKinds: new Set(["system", "system2"]) };
  if (title === "Change Actor Graphic" || title === "Change Vehicle Graphic") return { kind: "resource", label: "모습 고르기", resourceKinds: new Set(["charset"]) };
  if (title === "Change Actor Faceset") return { kind: "resource", label: "얼굴 고르기", resourceKinds: new Set(["faceset"]) };
  if (title === "Change Parallax Back") return { kind: "resource", label: "먼 배경 선택", resourceKinds: new Set(["backdrop"]) };
  return undefined;
}

function resourceSemantic(title: string): ResourceFieldSemantic {
  if (title.includes("Battleback")) return { kind: "resource", label: "전투 배경 선택", resourceKinds: new Set(["backdrop"]) };
  if (title === "Sound Layer") return { kind: "resource", label: "소리 선택", resourceKinds: new Set(["music", "sound"]) };
  if (title.includes("Picture")) return { kind: "resource", label: "그림 선택", resourceKinds: new Set(["picture"]) };
  if (title.includes("BGM")) return { kind: "resource", label: "배경음 선택", resourceKinds: new Set(["music"]) };
  if (title.includes("SE")) return { kind: "resource", label: "효과음 선택", resourceKinds: new Set(["sound"]) };
  if (title.includes("Movie")) return { kind: "resource", label: "영상 선택", resourceKinds: new Set(["movie"]) };
  return { kind: "resource", label: "그림 선택", resourceKinds: IMAGE_RESOURCE_KINDS };
}

function recordSemantic(label: string, emptyText: string, items: readonly RecordPickerItem[]): RecordFieldSemantic {
  return { kind: "record", label, emptyText, items };
}

function namedRecords(records: readonly { readonly id: string; readonly name?: string }[]): readonly RecordPickerItem[] {
  return records.map((record) => ({ id: record.id, name: record.name?.trim() || "(이름 없음)" }));
}

function switchVariableRecords(project: ReturnType<typeof store.getCurrent>, kind: "switch" | "variable"): readonly RecordPickerItem[] {
  const records = kind === "switch" ? project.switches : project.variables;
  return records.map((record, index) => ({
    id: record.id,
    name: storyFlagOptionLabel(project, kind, record, index),
  }));
}

function eventRecords(project: ReturnType<typeof store.getCurrent>): readonly RecordPickerItem[] {
  return Object.values(project.maps).flatMap((map) => map.events.map((event) => ({ id: event.id, name: `${map.name} / ${event.id} (${event.x}, ${event.y})` })));
}

function resourcePickerTestIds(key: string): { readonly picker: string; readonly preview: string; readonly selectedName: string } {
  if (key === "resourceId") return { picker: "m2-command-resourceId-picker", preview: "m2-command-resourceId-preview", selectedName: "m2-command-resourceId-selected-name" };
  return { picker: `m2-command-${key}-resource-picker`, preview: `m2-command-${key}-resource-preview`, selectedName: `m2-command-${key}-resource-selected-name` };
}

function resourcePreviewAriaLabel(kind: ResourceKind | undefined): string {
  if (kind === "picture") return "선택한 그림 리소스 미리보기";
  if (kind === "backdrop") return "선택한 전투 배경 리소스 미리보기";
  if (kind === "movie") return "선택한 동영상 리소스 미리보기";
  return "선택한 리소스 미리보기";
}

function fieldLabelForSpec(commandId: string, title: string, spec: M2CommandFieldSpec): string {
  if (spec.key === "target") return targetLabelForTitle(title) ?? spec.label;
  if (spec.key === "value") return valueLabelForTitle(title) ?? spec.label;
  if (spec.key === "animationId") return "전투 애니메이션";
  if (spec.key === "variableId") return "변수";
  if (spec.key === "mapId") return "맵";
  if (spec.key !== "resourceId") return spec.label;
  if (commandId.includes("picture")) return "그림 리소스";
  if (commandId.includes("battleback")) return "전투 배경";
  if (commandId.includes("bgm")) return "BGM";
  if (commandId.includes("se")) return "효과음";
  return "리소스";
}

function targetLabelForTitle(title: string): string | undefined {
  if (title.includes("Actor") || title === "Change State" || title === "Damage Processing" || title === "Name Input Processing" || title === "Recover All") return "주인공";
  if (title.includes("Enemy")) return "적";
  if (title.includes("Vehicle")) return "탈것";
  if (title.includes("Player")) return "주인공";
  if (title.includes("Event") || title === "Flash Event" || title === "Move Event" || title === "Show Animation") return "이벤트";
  return undefined;
}

function valueLabelForTitle(title: string): string | undefined {
  if (title === "Change Actor Class") return "직업";
  if (title === "Change Skills") return "스킬";
  if (title === "Change Items") return "아이템";
  if (title === "Change State" || title === "Change Enemy State") return "상태";
  if (title === "Change Equipment") return "장비";
  if (title === "Change Tileset") return "맵 그림 세트";
  if (title === "Change Battle Commands") return "전투 명령";
  if (title === "Change System Graphic") return "메뉴 모습";
  if (title === "Change Actor Graphic" || title === "Change Vehicle Graphic") return "모습";
  if (title === "Change Actor Faceset") return "얼굴";
  if (title === "Change Parallax Back") return "먼 배경";
  return undefined;
}

function resourceKindFromUploaded(kind: UploadedAsset["kind"]): ResourceKind | null {
  return kind === "tileset" ? "chipset" : kind === "sprite" ? "charset" : kind;
}

function resourceImageSize(
  imageWidth: number | undefined,
  imageHeight: number | undefined
): Pick<ResourcePickerItem, "imageHeight" | "imageWidth"> {
  return { ...(imageWidth !== undefined ? { imageWidth } : {}), ...(imageHeight !== undefined ? { imageHeight } : {}) };
}

function updateField(context: CommandEditContext, cmd: M2Command, key: string, value: M2CommandValue): void {
  const current = context.getCurrentCommand?.();
  const latest = current?.kind === "m2Command" && current.commandId === cmd.commandId ? current : cmd;
  context.actions.replaceCommand(context.path, {
    ...latest,
    fields: {
      ...latest.fields,
      [key]: value,
    },
  });
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
