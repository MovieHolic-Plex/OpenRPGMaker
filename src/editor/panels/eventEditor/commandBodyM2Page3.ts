// 맵·연출(피커 3페이지) M2 명령 전용 리치 폼.
// actor-m2 패턴(intent + 2열 layout + 미리보기)을 복제해 결합도를 낮춘다.
import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command, M2CommandValue } from "@/project/types";
import { el } from "@/util/dom";
import { databasePicker } from "./conditionForm";
import {
  imageIconOf,
  recordIconElement,
  recordPickerWithPreview,
  segmentedSelect,
  type SegmentOption,
} from "./recordPicker";
import type { CommandEditContext } from "./types";

type M2Command = Extract<Command, { kind: "m2Command" }>;

const VALUE_SOURCE_SEGMENTS = [
  { value: "number", key: "number", label: "숫자" },
  { value: "variable", key: "variable", label: "변수" },
] as const satisfies readonly SegmentOption<"number" | "variable">[];

const BOOLEAN_SEGMENTS = [
  { value: "true", key: "true", label: "ON" },
  { value: "false", key: "false", label: "OFF" },
] as const satisfies readonly SegmentOption<"true" | "false">[];

const VEHICLE_SEGMENTS = [
  { value: "boat", key: "boat", label: "소형선" },
  { value: "ship", key: "ship", label: "대형선" },
  { value: "airship", key: "airship", label: "비행선" },
] as const satisfies readonly SegmentOption<"boat" | "ship" | "airship">[];

const SCREEN_COLOR_SEGMENTS = [
  { value: "white", key: "white", label: "흰색" },
  { value: "red", key: "red", label: "빨강" },
  { value: "green", key: "green", label: "초록" },
  { value: "blue", key: "blue", label: "파랑" },
  { value: "yellow", key: "yellow", label: "노랑" },
  { value: "purple", key: "purple", label: "보라" },
  { value: "black", key: "black", label: "검정" },
] as const satisfies readonly SegmentOption<
  "white" | "red" | "green" | "blue" | "yellow" | "purple" | "black"
>[];

const TINT_COLOR_CHIPS = [
  { id: "neutral", label: "기본" },
  { id: "white", label: "흰색" },
  { id: "red", label: "빨강" },
  { id: "green", label: "초록" },
  { id: "blue", label: "파랑" },
  { id: "yellow", label: "노랑" },
  { id: "purple", label: "보라" },
  { id: "black", label: "검정" },
] as const;

const SHAKE_INTENSITY_SEGMENTS = [
  { value: "1", key: "1", label: "약하게" },
  { value: "3", key: "3", label: "보통" },
  { value: "6", key: "6", label: "강하게" },
  { value: "10", key: "10", label: "매우 강하게" },
] as const satisfies readonly SegmentOption<"1" | "3" | "6" | "10">[];

const SCROLL_DIR_SEGMENTS = [
  { value: "up", key: "up", label: "위" },
  { value: "down", key: "down", label: "아래" },
  { value: "left", key: "left", label: "왼쪽" },
  { value: "right", key: "right", label: "오른쪽" },
] as const satisfies readonly SegmentOption<"up" | "down" | "left" | "right">[];

const SCROLL_MODE_SEGMENTS = [
  { value: "return", key: "return", label: "복귀" },
  { value: "lock", key: "lock", label: "고정" },
  { value: "pan", key: "pan", label: "패닝" },
] as const satisfies readonly SegmentOption<"return" | "lock" | "pan">[];

const WEATHER_CHIPS = [
  { id: "none", label: "없음" },
  { id: "rain", label: "비" },
  { id: "storm", label: "폭풍" },
  { id: "snow", label: "눈" },
  { id: "fog", label: "안개" },
] as const;

const ANIMATION_TARGET_SEGMENTS = [
  { value: "player", key: "player", label: "주인공" },
  { value: "event", key: "event", label: "이벤트" },
] as const satisfies readonly SegmentOption<"player" | "event">[];

/** 피커 3페이지(맵·연출) M2 리치 폼. 해당 없으면 undefined → 일반 M2 폼. */
export function renderPage3M2CommandBody(
  context: CommandEditContext,
  cmd: M2Command
): HTMLElement | undefined {
  const entry = m2CommandById(cmd.commandId);
  if (!entry) return undefined;
  switch (entry.title) {
    case "Get Player Location":
      return getPlayerLocationBody(context, cmd);
    case "Move to Variable Location":
      return moveToVariableLocationBody(context, cmd);
    case "Get On/Off Vehicle":
      return getOnOffVehicleBody(context, cmd);
    case "Set Vehicle Location":
      return setVehicleLocationBody(context, cmd);
    case "Set Event Location":
      return setEventLocationBody(context, cmd);
    case "Swap Event Location":
      return swapEventLocationBody(context, cmd);
    case "Get Terrain ID":
      return getTerrainIdBody(context, cmd);
    case "Get Event ID":
      return getEventIdBody(context, cmd);
    case "Hide Screen":
      return hideShowScreenBody(context, cmd, "hide");
    case "Show Screen":
      return hideShowScreenBody(context, cmd, "show");
    case "Tint Screen":
      return tintScreenBody(context, cmd);
    case "Flash Screen":
      return flashScreenBody(context, cmd);
    case "Shake Screen":
      return shakeScreenBody(context, cmd);
    case "Scroll Map":
      return scrollMapBody(context, cmd);
    case "Set Weather Effects":
      return setWeatherEffectsBody(context, cmd);
    case "Show Picture":
      return showPictureM2Body(context, cmd);
    case "Move Picture":
      return movePictureM2Body(context, cmd);
    case "Erase Picture":
      return erasePictureM2Body(context, cmd);
    case "Show Animation":
      return showAnimationM2Body(context, cmd);
    case "Flash Event":
      return flashEventBody(context, cmd);
    case "Stop All Movement":
      return stopAllMovementBody(context, cmd);
    case "Key Input Processing":
      return keyInputProcessingBody(context, cmd);
    case "Change Tileset":
      return changeTilesetBody(context, cmd);
    case "Change Parallax Back":
      return changeParallaxBackBody(context, cmd);
    case "Set Encounter Rate":
      return setEncounterRateBody(context, cmd);
    case "Change Tile":
      return changeTileM2Body(context, cmd);
    default:
      return undefined;
  }
}

function getPlayerLocationBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "get-player-location-command-body");
  let variableId = String(cmd.fields.variableId ?? "").trim();
  const preview = previewPanel("get-player-location-preview");
  const variable = databasePicker(
    "variable",
    variableId,
    (nextId) => {
      variableId = nextId;
      commit();
    },
    "get-player-location-variable"
  );

  const commit = () => {
    replaceFields(context, cmd, {
      variableId,
      target: "player",
    });
    renderPreview();
  };

  const renderPreview = () => {
    preview.replaceChildren(
      line(`주인공 위치 → 변수 ${variableLabel(variableId)}`),
      note("맵/X/Y를 각각 변수_map / 변수_x / 변수_y 에 기록합니다.")
    );
  };

  renderPreview();
  wrap.append(
    intentCard(
      "주인공 위치 얻기",
      "현재 맵과 좌표를 지정한 변수 묶음에 저장합니다.",
      "get-player-location-intent"
    ),
    layout(
      [fieldBlock("저장 변수", variable, "get-player-location-variable-field")],
      preview
    )
  );
  return wrap;
}

function moveToVariableLocationBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "move-to-variable-location-command-body");
  let mapVariableId = String(cmd.fields.mapVariableId ?? cmd.fields.mapId ?? "").trim();
  let xVariableId = String(cmd.fields.xVariableId ?? cmd.fields.x ?? "").trim();
  let yVariableId = String(cmd.fields.yVariableId ?? cmd.fields.y ?? "").trim();
  // 숫자 좌표로 저장된 레거시 값이면 변수 필드로 옮기지 않고 빈 값 취급.
  if (/^\d+$/.test(xVariableId)) xVariableId = "";
  if (/^\d+$/.test(yVariableId)) yVariableId = "";

  const preview = previewPanel("move-to-variable-location-preview");
  const mapVar = databasePicker(
    "variable",
    mapVariableId,
    (id) => {
      mapVariableId = id;
      commit();
    },
    "move-to-variable-location-map-variable"
  );
  const xVar = databasePicker(
    "variable",
    xVariableId,
    (id) => {
      xVariableId = id;
      commit();
    },
    "move-to-variable-location-x-variable"
  );
  const yVar = databasePicker(
    "variable",
    yVariableId,
    (id) => {
      yVariableId = id;
      commit();
    },
    "move-to-variable-location-y-variable"
  );

  const commit = () => {
    replaceFields(context, cmd, {
      mapVariableId,
      xVariableId,
      yVariableId,
    }, ["mapId", "x", "y"]);
    renderPreview();
  };

  const renderPreview = () => {
    preview.replaceChildren(
      line(
        `변수 위치로 이동 · 맵 ${variableLabel(mapVariableId)} / X ${variableLabel(xVariableId)} / Y ${variableLabel(yVariableId)}`
      ),
      note("맵·좌표 변수 값을 읽어 주인공을 이동시킵니다.")
    );
  };

  renderPreview();
  wrap.append(
    intentCard(
      "변수 위치로 이동",
      "맵/X/Y 변수에 담긴 좌표로 주인공을 이동시킵니다.",
      "move-to-variable-location-intent"
    ),
    layout(
      [
        fieldBlock("맵 변수", mapVar),
        fieldBlock("X 변수", xVar),
        fieldBlock("Y 변수", yVar),
      ],
      preview
    )
  );
  return wrap;
}

function getOnOffVehicleBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "get-on-off-vehicle-command-body");
  const enabled = segmentedSelect({
    options: BOOLEAN_SEGMENTS,
    value: String(cmd.fields.boarded ?? cmd.fields.enabled ?? "true") === "false" ? "false" : "true",
    testid: "get-on-off-vehicle-enabled",
    ariaLabel: "승하차",
  });
  const preview = previewPanel("get-on-off-vehicle-preview");

  const commit = () => {
    replaceFields(context, cmd, { boarded: enabled.select.value }, ["enabled"]);
    renderPreview();
  };
  const renderPreview = () => {
    preview.replaceChildren(
      line(enabled.select.value === "true" ? "탈것 탑승" : "탈것 하차"),
      note("현재 위치의 탈것에 타거나 내립니다.")
    );
  };

  enabled.select.addEventListener("change", commit);
  renderPreview();
  wrap.append(
    intentCard("탈것 승하차", "현재 타일 위 탈것에 타거나 내립니다.", "get-on-off-vehicle-intent"),
    layout([fieldBlock("동작", enabled.root)], preview)
  );
  return wrap;
}

function setVehicleLocationBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "set-vehicle-location-command-body");
  const vehicleRaw = String(cmd.fields.vehicle ?? cmd.fields.target ?? "boat");
  const vehicle = segmentedSelect({
    options: VEHICLE_SEGMENTS,
    value: vehicleRaw === "ship" || vehicleRaw === "airship" ? vehicleRaw : "boat",
    testid: "set-vehicle-location-vehicle",
    ariaLabel: "탈것",
  });
  const coords = locationControls(cmd, "set-vehicle-location");
  const preview = previewPanel("set-vehicle-location-preview");

  const commit = () => {
    const loc = coords.read();
    replaceFields(context, cmd, {
      vehicle: vehicle.select.value,
      mapId: loc.mapId,
      x: loc.x,
      y: loc.y,
    }, ["target"]);
    renderPreview();
  };
  const renderPreview = () => {
    const loc = coords.read();
    const name = VEHICLE_SEGMENTS.find((entry) => entry.value === vehicle.select.value)?.label ?? vehicle.select.value;
    preview.replaceChildren(
      line(`${name} → ${mapLabel(loc.mapId)} (${loc.x}, ${loc.y})`),
      note("지정 맵 좌표로 탈것을 옮깁니다.")
    );
  };

  vehicle.select.addEventListener("change", commit);
  coords.bind(commit);
  renderPreview();
  wrap.append(
    intentCard("탈것 위치 설정", "소형선·대형선·비행선 위치를 지정합니다.", "set-vehicle-location-intent"),
    layout(
      [fieldBlock("탈것", vehicle.root), ...coords.fields],
      preview
    )
  );
  return wrap;
}

function setEventLocationBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "set-event-location-command-body");
  const project = store.getCurrent();
  const events = eventRecords(project);
  const event = recordPickerWithPreview({
    records: events,
    selectedId: String(cmd.fields.target ?? ""),
    placeholder: "이벤트 선택",
    testid: "set-event-location-event-select",
    subtitleOf: (record) => record.id,
  });
  const coords = locationControls(cmd, "set-event-location");
  const preview = previewPanel("set-event-location-preview");

  const commit = () => {
    const loc = coords.read();
    replaceFields(context, cmd, {
      target: event.select.value,
      mapId: loc.mapId,
      x: loc.x,
      y: loc.y,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const loc = coords.read();
    const name = events.find((entry) => entry.id === event.select.value)?.name ?? "이벤트";
    preview.replaceChildren(
      line(`${name} → ${mapLabel(loc.mapId)} (${loc.x}, ${loc.y})`),
      note("이벤트를 지정 좌표로 순간이동합니다.")
    );
  };

  event.select.addEventListener("change", commit);
  coords.bind(commit);
  renderPreview();
  wrap.append(
    intentCard("이벤트 위치 설정", "맵 이벤트를 지정 좌표로 옮깁니다.", "set-event-location-intent"),
    layout([fieldBlock("이벤트", event.root), ...coords.fields], preview)
  );
  return wrap;
}

function swapEventLocationBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "swap-event-location-command-body");
  const project = store.getCurrent();
  const events = eventRecords(project);
  const a = recordPickerWithPreview({
    records: events,
    selectedId: String(cmd.fields.eventA ?? cmd.fields.target ?? ""),
    placeholder: "이벤트 A",
    testid: "swap-event-location-event-a",
    subtitleOf: (record) => record.id,
  });
  const b = recordPickerWithPreview({
    records: events,
    selectedId: String(cmd.fields.eventB ?? cmd.fields.value ?? cmd.fields.mapId ?? ""),
    placeholder: "이벤트 B",
    testid: "swap-event-location-event-b",
    subtitleOf: (record) => record.id,
  });
  const preview = previewPanel("swap-event-location-preview");

  const commit = () => {
    replaceFields(context, cmd, {
      eventA: a.select.value,
      eventB: b.select.value,
    }, ["target", "value", "mapId", "x", "y"]);
    renderPreview();
  };
  const renderPreview = () => {
    const nameA = events.find((entry) => entry.id === a.select.value)?.name ?? "A";
    const nameB = events.find((entry) => entry.id === b.select.value)?.name ?? "B";
    preview.replaceChildren(line(`${nameA} ↔ ${nameB}`), note("두 이벤트의 위치를 서로 바꿉니다."));
  };

  a.select.addEventListener("change", commit);
  b.select.addEventListener("change", commit);
  renderPreview();
  wrap.append(
    intentCard("이벤트 위치 교환", "두 이벤트의 좌표를 서로 맞바꿉니다.", "swap-event-location-intent"),
    layout([fieldBlock("이벤트 A", a.root), fieldBlock("이벤트 B", b.root)], preview)
  );
  return wrap;
}

function getTerrainIdBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  return getIdAtLocationBody(context, cmd, {
    testid: "get-terrain-id-command-body",
    intentTestid: "get-terrain-id-intent",
    previewTestid: "get-terrain-id-preview",
    title: "지형 ID 얻기",
    body: "지정 좌표의 지형 ID를 변수에 저장합니다.",
    note: "타일 지형 번호를 읽어 분기·조건에 사용합니다.",
  });
}

function getEventIdBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  return getIdAtLocationBody(context, cmd, {
    testid: "get-event-id-command-body",
    intentTestid: "get-event-id-intent",
    previewTestid: "get-event-id-preview",
    title: "이벤트 ID 얻기",
    body: "지정 좌표에 있는 이벤트 ID를 변수에 저장합니다.",
    note: "해당 칸에 이벤트가 없으면 0을 기록합니다.",
  });
}

function getIdAtLocationBody(
  context: CommandEditContext,
  cmd: M2Command,
  options: {
    readonly testid: string;
    readonly intentTestid: string;
    readonly previewTestid: string;
    readonly title: string;
    readonly body: string;
    readonly note: string;
  }
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", options.testid);
  let variableId = String(cmd.fields.variableId ?? "").trim();
  const coords = locationControls(cmd, options.testid.replace(/-command-body$/, ""));
  const preview = previewPanel(options.previewTestid);
  const variable = databasePicker(
    "variable",
    variableId,
    (id) => {
      variableId = id;
      commit();
    },
    `${options.testid.replace(/-command-body$/, "")}-variable`
  );

  const commit = () => {
    const loc = coords.read();
    replaceFields(context, cmd, {
      target: loc.mapId || "map",
      variableId,
      mapId: loc.mapId,
      x: loc.x,
      y: loc.y,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const loc = coords.read();
    preview.replaceChildren(
      line(`${options.title} · ${mapLabel(loc.mapId)} (${loc.x}, ${loc.y}) → ${variableLabel(variableId)}`),
      note(options.note)
    );
  };

  coords.bind(commit);
  renderPreview();
  wrap.append(
    intentCard(options.title, options.body, options.intentTestid),
    layout([fieldBlock("저장 변수", variable), ...coords.fields], preview)
  );
  return wrap;
}

function hideShowScreenBody(
  _context: CommandEditContext,
  _cmd: M2Command,
  mode: "hide" | "show"
): HTMLElement {
  const testid = mode === "hide" ? "hide-screen-command-body" : "show-screen-command-body";
  const wrap = shell("page3-command-body actor-m2-command-body", testid);
  const preview = previewPanel(`${mode}-screen-preview`);
  preview.replaceChildren(
    line(mode === "hide" ? "화면 숨김 (페이드 아웃)" : "화면 표시 (페이드 인)"),
    note(mode === "hide" ? "맵 화면을 가립니다." : "가려진 화면을 다시 보여줍니다.")
  );
  // field-less command — no form state to commit on open.
  wrap.append(
    intentCard(
      mode === "hide" ? "화면 숨기기" : "화면 표시",
      mode === "hide" ? "화면을 어둡게 가립니다." : "숨긴 화면을 다시 표시합니다.",
      `${mode}-screen-intent`
    ),
    layout(
      [
        el("p", {
          class: "actor-m2-preview-note",
          text: "추가 설정 없이 실행됩니다.",
        }),
      ],
      preview
    )
  );
  return wrap;
}

function tintScreenBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "tint-screen-command-body");
  let color = String(cmd.fields.color ?? "neutral").trim() || "neutral";
  if (!TINT_COLOR_CHIPS.some((chip) => chip.id === color) && !String(cmd.fields.value ?? "").trim()) {
    color = "neutral";
  }
  const valueInput = el("input", {
    attrs: { type: "text", placeholder: "R,G,B 또는 #hex (선택)" },
    value: String(cmd.fields.value ?? ""),
    dataset: { testid: "tint-screen-value-input" },
  }) as HTMLInputElement;
  const durationInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.duration === "number"
        ? cmd.fields.duration
        : Number(cmd.fields.duration) || 0
    ),
    dataset: { testid: "tint-screen-duration-input" },
  }) as HTMLInputElement;
  const chips = el("div", {
    class: "actor-m2-chip-grid",
    dataset: { testid: "tint-screen-color-chips" },
  });
  const preview = previewPanel("tint-screen-preview");

  const renderChips = () => {
    chips.replaceChildren();
    for (const chip of TINT_COLOR_CHIPS) {
      chips.append(
        el("button", {
          class: "btn small actor-m2-chip" + (chip.id === color ? " is-active" : ""),
          text: chip.label,
          attrs: { type: "button" },
          dataset: { testid: `tint-screen-color-${chip.id}` },
          on: {
            click: () => {
              color = chip.id;
              renderChips();
              commit();
            },
          },
        })
      );
    }
  };

  const commit = () => {
    replaceFields(context, cmd, {
      color,
      value: valueInput.value.trim(),
      duration: Math.max(0, Math.trunc(Number(durationInput.value) || 0)),
    });
    renderPreview();
  };
  const renderPreview = () => {
    const explicit = valueInput.value.trim();
    const duration = Math.max(0, Math.trunc(Number(durationInput.value) || 0));
    const colorLabel = TINT_COLOR_CHIPS.find((chip) => chip.id === color)?.label ?? color;
    preview.replaceChildren(
      line(`색조 ${explicit || colorLabel}${duration > 0 ? ` · ${duration}ms` : " · 즉시"}`),
      note("명시 RGB/hex가 있으면 색 이름보다 우선합니다.")
    );
  };

  valueInput.addEventListener("change", commit);
  valueInput.addEventListener("input", commit);
  durationInput.addEventListener("change", commit);
  durationInput.addEventListener("input", commit);
  renderChips();
  renderPreview();
  wrap.append(
    intentCard("화면 색조 변경", "맵 전체에 색 필터를 적용합니다.", "tint-screen-intent"),
    layout(
      [
        fieldBlock("색상 프리셋", chips),
        fieldBlock("직접 색", valueInput),
        fieldBlock("전환 시간(ms)", durationInput),
      ],
      preview
    )
  );
  return wrap;
}

function flashScreenBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "flash-screen-command-body");
  const colorRaw = String(cmd.fields.color ?? cmd.fields.value ?? "white");
  const color = segmentedSelect({
    options: SCREEN_COLOR_SEGMENTS,
    value: (SCREEN_COLOR_SEGMENTS.find((entry) => entry.value === colorRaw)?.value ?? "white") as
      | "white"
      | "red"
      | "green"
      | "blue"
      | "yellow"
      | "purple"
      | "black",
    testid: "flash-screen-color",
    ariaLabel: "플래시 색",
  });
  const durationInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.durationMs === "number"
        ? cmd.fields.durationMs
        : Number(cmd.fields.durationMs) || 300
    ),
    dataset: { testid: "flash-screen-duration-input" },
  }) as HTMLInputElement;
  const preview = previewPanel("flash-screen-preview");

  const commit = () => {
    const durationMs = Math.max(0, Math.trunc(Number(durationInput.value) || 0));
    replaceFields(context, cmd, {
      color: color.select.value,
      value: color.select.value,
      durationMs,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const label = SCREEN_COLOR_SEGMENTS.find((entry) => entry.value === color.select.value)?.label ?? color.select.value;
    const durationMs = Math.max(0, Math.trunc(Number(durationInput.value) || 0));
    preview.replaceChildren(line(`플래시 ${label} · ${durationMs}ms`), note("화면 전체를 순간 번쩍입니다."));
  };

  color.select.addEventListener("change", commit);
  durationInput.addEventListener("change", commit);
  durationInput.addEventListener("input", commit);
  renderPreview();
  wrap.append(
    intentCard("화면 플래시", "화면을 지정 색으로 번쩍입니다.", "flash-screen-intent"),
    layout(
      [fieldBlock("색상", color.root), fieldBlock("시간(ms)", durationInput)],
      preview
    )
  );
  return wrap;
}

function shakeScreenBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "shake-screen-command-body");
  const intensityRaw = String(
    cmd.fields.intensity ?? cmd.fields.value ?? "3"
  );
  const intensity = segmentedSelect({
    options: SHAKE_INTENSITY_SEGMENTS,
    value: (SHAKE_INTENSITY_SEGMENTS.find((entry) => entry.value === intensityRaw)?.value ?? "3") as
      | "1"
      | "3"
      | "6"
      | "10",
    testid: "shake-screen-intensity",
    ariaLabel: "흔들림 강도",
  });
  const durationInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.durationMs === "number"
        ? cmd.fields.durationMs
        : Number(cmd.fields.durationMs) || 400
    ),
    dataset: { testid: "shake-screen-duration-input" },
  }) as HTMLInputElement;
  const preview = previewPanel("shake-screen-preview");

  const commit = () => {
    const durationMs = Math.max(0, Math.trunc(Number(durationInput.value) || 0));
    const intensityValue = Number(intensity.select.value) || 3;
    replaceFields(context, cmd, {
      intensity: intensity.select.value,
      value: intensityValue,
      durationMs,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const label =
      SHAKE_INTENSITY_SEGMENTS.find((entry) => entry.value === intensity.select.value)?.label ??
      intensity.select.value;
    const durationMs = Math.max(0, Math.trunc(Number(durationInput.value) || 0));
    preview.replaceChildren(line(`화면 흔들기 ${label} · ${durationMs}ms`), note("카메라 흔들림 연출."));
  };

  intensity.select.addEventListener("change", commit);
  durationInput.addEventListener("change", commit);
  durationInput.addEventListener("input", commit);
  renderPreview();
  wrap.append(
    intentCard("화면 흔들기", "카메라 흔들림으로 충격을 표현합니다.", "shake-screen-intent"),
    layout(
      [fieldBlock("강도", intensity.root), fieldBlock("시간(ms)", durationInput)],
      preview
    )
  );
  return wrap;
}

function scrollMapBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "scroll-map-command-body");
  const dirRaw = String(cmd.fields.direction ?? cmd.fields.target ?? "down");
  const direction = segmentedSelect({
    options: SCROLL_DIR_SEGMENTS,
    value: (SCROLL_DIR_SEGMENTS.find((entry) => entry.value === dirRaw)?.value ?? "down") as
      | "up"
      | "down"
      | "left"
      | "right",
    testid: "scroll-map-direction",
    ariaLabel: "스크롤 방향",
  });
  const modeRaw = String(cmd.fields.mode ?? "return");
  const mode = segmentedSelect({
    options: SCROLL_MODE_SEGMENTS,
    value: (SCROLL_MODE_SEGMENTS.find((entry) => entry.value === modeRaw)?.value ?? "return") as
      | "return"
      | "lock"
      | "pan",
    testid: "scroll-map-mode",
    ariaLabel: "스크롤 모드",
  });
  const wait = segmentedSelect({
    options: BOOLEAN_SEGMENTS,
    value: String(cmd.fields.wait ?? "true") === "false" ? "false" : "true",
    testid: "scroll-map-wait",
    ariaLabel: "대기",
  });
  const distanceInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.distance === "number"
        ? cmd.fields.distance
        : Number(cmd.fields.distance) || 1
    ),
    dataset: { testid: "scroll-map-distance-input" },
  }) as HTMLInputElement;
  const speedInput = el("input", {
    attrs: { type: "number", min: "1", step: "1" },
    value: String(
      typeof cmd.fields.speed === "number" ? cmd.fields.speed : Number(cmd.fields.speed) || 4
    ),
    dataset: { testid: "scroll-map-speed-input" },
  }) as HTMLInputElement;
  const preview = previewPanel("scroll-map-preview");

  const commit = () => {
    replaceFields(context, cmd, {
      direction: direction.select.value,
      distance: Math.max(0, Math.trunc(Number(distanceInput.value) || 0)),
      speed: Math.max(1, Math.trunc(Number(speedInput.value) || 4)),
      wait: wait.select.value,
      mode: mode.select.value,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const dirLabel =
      SCROLL_DIR_SEGMENTS.find((entry) => entry.value === direction.select.value)?.label ??
      direction.select.value;
    const modeLabel =
      SCROLL_MODE_SEGMENTS.find((entry) => entry.value === mode.select.value)?.label ??
      mode.select.value;
    const distance = Math.max(0, Math.trunc(Number(distanceInput.value) || 0));
    preview.replaceChildren(
      line(`맵 스크롤 ${dirLabel} ${distance}칸 · ${modeLabel}${wait.select.value === "true" ? " · 대기" : ""}`),
      note("카메라만 이동하며 주인공 위치는 그대로입니다.")
    );
  };

  for (const control of [direction.select, mode.select, wait.select, distanceInput, speedInput]) {
    control.addEventListener("change", commit);
  }
  distanceInput.addEventListener("input", commit);
  speedInput.addEventListener("input", commit);
  renderPreview();
  wrap.append(
    intentCard("맵 스크롤", "카메라를 지정 방향/거리로 패닝합니다.", "scroll-map-intent"),
    layout(
      [
        fieldBlock("방향", direction.root),
        fieldBlock("거리(타일)", distanceInput),
        fieldBlock("속도", speedInput),
        fieldBlock("모드", mode.root),
        fieldBlock("완료까지 대기", wait.root),
      ],
      preview
    )
  );
  return wrap;
}

function setWeatherEffectsBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "set-weather-effects-command-body");
  const parsed = parseWeatherValue(String(cmd.fields.value ?? "none"));
  let kind = parsed.kind;
  const intensityInput = el("input", {
    attrs: { type: "number", min: "0", max: "1", step: "0.05" },
    value: String(parsed.intensity),
    dataset: { testid: "set-weather-effects-intensity-input" },
  }) as HTMLInputElement;
  const transitionInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.transitionMs === "number"
        ? cmd.fields.transitionMs
        : Number(cmd.fields.transitionMs ?? cmd.fields.durationMs) || 0
    ),
    dataset: { testid: "set-weather-effects-transition-input" },
  }) as HTMLInputElement;
  const chips = el("div", {
    class: "actor-m2-chip-grid",
    dataset: { testid: "set-weather-effects-kind-chips" },
  });
  const preview = previewPanel("set-weather-effects-preview");

  const renderChips = () => {
    chips.replaceChildren();
    for (const chip of WEATHER_CHIPS) {
      chips.append(
        el("button", {
          class: "btn small actor-m2-chip" + (chip.id === kind ? " is-active" : ""),
          text: chip.label,
          attrs: { type: "button" },
          dataset: { testid: `set-weather-effects-kind-${chip.id}` },
          on: {
            click: () => {
              kind = chip.id;
              renderChips();
              commit();
            },
          },
        })
      );
    }
  };

  const commit = () => {
    const intensity = clamp01(Number(intensityInput.value));
    const transitionMs = Math.max(0, Math.trunc(Number(transitionInput.value) || 0));
    const value = kind === "none" ? "none" : `${kind},${round2(intensity)}`;
    replaceFields(context, cmd, {
      value,
      transitionMs,
      durationMs: transitionMs,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const intensity = clamp01(Number(intensityInput.value));
    const transitionMs = Math.max(0, Math.trunc(Number(transitionInput.value) || 0));
    const label = WEATHER_CHIPS.find((chip) => chip.id === kind)?.label ?? kind;
    preview.replaceChildren(
      line(
        kind === "none"
          ? "날씨 없음"
          : `${label} · 강도 ${round2(intensity)}${transitionMs > 0 ? ` · ${transitionMs}ms` : ""}`
      ),
      note("비/눈/폭풍/안개 오버레이를 설정합니다.")
    );
  };

  intensityInput.addEventListener("change", commit);
  intensityInput.addEventListener("input", commit);
  transitionInput.addEventListener("change", commit);
  transitionInput.addEventListener("input", commit);
  renderChips();
  renderPreview();
  wrap.append(
    intentCard("날씨 효과 설정", "맵 날씨 오버레이를 바꿉니다.", "set-weather-effects-intent"),
    layout(
      [
        fieldBlock("종류", chips),
        fieldBlock("강도(0~1)", intensityInput),
        fieldBlock("전환 시간(ms)", transitionInput),
      ],
      preview
    )
  );
  return wrap;
}

function showPictureM2Body(context: CommandEditContext, cmd: M2Command): HTMLElement {
  return pictureBody(context, cmd, {
    testid: "show-picture-m2-command-body",
    intentTestid: "show-picture-m2-intent",
    previewTestid: "show-picture-m2-preview",
    title: "그림 표시",
    body: "지정 번호 슬롯에 그림을 띄웁니다.",
    includeResource: true,
    includeDuration: false,
  });
}

function movePictureM2Body(context: CommandEditContext, cmd: M2Command): HTMLElement {
  return pictureBody(context, cmd, {
    testid: "move-picture-m2-command-body",
    intentTestid: "move-picture-m2-intent",
    previewTestid: "move-picture-m2-preview",
    title: "그림 이동",
    body: "이미 표시된 그림을 좌표·투명도로 옮깁니다.",
    includeResource: false,
    includeDuration: true,
  });
}

function erasePictureM2Body(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "erase-picture-m2-command-body");
  const pictureIdInput = el("input", {
    attrs: { type: "text", placeholder: "그림 번호" },
    value: String(cmd.fields.pictureId ?? "pic1"),
    dataset: { testid: "erase-picture-m2-id-input" },
  }) as HTMLInputElement;
  const preview = previewPanel("erase-picture-m2-preview");

  const commit = () => {
    replaceFields(context, cmd, {
      pictureId: pictureIdInput.value.trim() || "pic1",
      resourceId: "",
      x: 0,
      y: 0,
    });
    renderPreview();
  };
  const renderPreview = () => {
    preview.replaceChildren(
      line(`그림 삭제 · ${pictureIdInput.value.trim() || "pic1"}`),
      note("해당 번호의 그림을 화면에서 지웁니다.")
    );
  };

  pictureIdInput.addEventListener("change", commit);
  pictureIdInput.addEventListener("input", commit);
  renderPreview();
  wrap.append(
    intentCard("그림 삭제", "표시 중인 그림 슬롯을 비웁니다.", "erase-picture-m2-intent"),
    layout([fieldBlock("그림 번호", pictureIdInput)], preview)
  );
  return wrap;
}

function pictureBody(
  context: CommandEditContext,
  cmd: M2Command,
  options: {
    readonly testid: string;
    readonly intentTestid: string;
    readonly previewTestid: string;
    readonly title: string;
    readonly body: string;
    readonly includeResource: boolean;
    readonly includeDuration: boolean;
  }
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", options.testid);
  const project = store.getCurrent();
  let resourceId = String(cmd.fields.resourceId ?? "").trim();
  const pictureIdInput = el("input", {
    attrs: { type: "text", placeholder: "그림 번호" },
    value: String(cmd.fields.pictureId ?? "pic1"),
    dataset: { testid: `${options.testid.replace(/-command-body$/, "")}-id-input` },
  }) as HTMLInputElement;
  const xInput = el("input", {
    attrs: { type: "number", step: "1" },
    value: String(typeof cmd.fields.x === "number" ? cmd.fields.x : Number(cmd.fields.x) || 0),
    dataset: { testid: `${options.testid.replace(/-command-body$/, "")}-x-input` },
  }) as HTMLInputElement;
  const yInput = el("input", {
    attrs: { type: "number", step: "1" },
    value: String(typeof cmd.fields.y === "number" ? cmd.fields.y : Number(cmd.fields.y) || 0),
    dataset: { testid: `${options.testid.replace(/-command-body$/, "")}-y-input` },
  }) as HTMLInputElement;
  const durationInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.durationMs === "number"
        ? cmd.fields.durationMs
        : typeof cmd.fields.duration === "number"
          ? cmd.fields.duration
          : Number(cmd.fields.durationMs ?? cmd.fields.duration) || 0
    ),
    dataset: { testid: `${options.testid.replace(/-command-body$/, "")}-duration-input` },
  }) as HTMLInputElement;
  const resourceSelect = resourceIdSelect(resourceId, `${options.testid.replace(/-command-body$/, "")}-resource-select`, "picture");
  const pickBtn = el("button", {
    class: "btn small",
    text: "리소스 선택…",
    attrs: { type: "button" },
    dataset: { testid: `${options.testid.replace(/-command-body$/, "")}-resource-picker` },
    on: {
      click: () => {
        openDatabaseResourcePickerDialog({
          kind: "image",
          title: "그림 리소스 선택",
          currentId: resourceId,
          onConfirm: (result) => {
            resourceId = result.resourceId;
            resourceSelect.value = resourceId;
            commit();
          },
        });
      },
    },
  });
  const preview = previewPanel(options.previewTestid);

  const commit = () => {
    resourceId = resourceSelect.value.trim();
    const fields: Record<string, M2CommandValue> = {
      pictureId: pictureIdInput.value.trim() || "pic1",
      x: Math.trunc(Number(xInput.value) || 0),
      y: Math.trunc(Number(yInput.value) || 0),
    };
    if (options.includeResource) fields.resourceId = resourceId;
    if (options.includeDuration) {
      const durationMs = Math.max(0, Math.trunc(Number(durationInput.value) || 0));
      fields.durationMs = durationMs;
      fields.duration = durationMs;
    }
    replaceFields(context, cmd, fields);
    renderPreview();
  };
  const renderPreview = () => {
    const id = pictureIdInput.value.trim() || "pic1";
    const x = Math.trunc(Number(xInput.value) || 0);
    const y = Math.trunc(Number(yInput.value) || 0);
    const icon = imageIconOf(project, resourceId || undefined);
    const children: HTMLElement[] = [
      el("div", {
        class: "actor-m2-preview-actor",
        children: [
          recordIconElement(icon, resourceId || "선택 없음"),
          el("div", {
            class: "actor-m2-preview-copy",
            children: [
              line(
                options.includeResource
                  ? `${id} · ${resourceId || "(리소스 없음)"} @ (${x}, ${y})`
                  : `${id} → (${x}, ${y})`
              ),
              note(options.body),
            ],
          }),
        ],
      }),
    ];
    preview.replaceChildren(...children);
  };

  pictureIdInput.addEventListener("change", commit);
  pictureIdInput.addEventListener("input", commit);
  xInput.addEventListener("change", commit);
  xInput.addEventListener("input", commit);
  yInput.addEventListener("change", commit);
  yInput.addEventListener("input", commit);
  resourceSelect.addEventListener("change", commit);
  durationInput.addEventListener("change", commit);
  durationInput.addEventListener("input", commit);
  renderPreview();

  const fields: HTMLElement[] = [
    fieldBlock("그림 번호", pictureIdInput),
    fieldBlock("X", xInput),
    fieldBlock("Y", yInput),
  ];
  if (options.includeResource) {
    fields.splice(
      1,
      0,
      fieldBlock(
        "그림 리소스",
        el("div", { class: "actor-m2-inline", children: [resourceSelect, pickBtn] })
      )
    );
  }
  if (options.includeDuration) {
    fields.push(fieldBlock("이동 시간(ms)", durationInput));
  }

  wrap.append(intentCard(options.title, options.body, options.intentTestid), layout(fields, preview));
  return wrap;
}

function showAnimationM2Body(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "show-animation-m2-command-body");
  const project = store.getCurrent();
  const animations = project.database.battleAnimations;
  const events = eventRecords(project);
  const targetRaw = String(cmd.fields.target ?? "player");
  const targetMode: "player" | "event" =
    targetRaw === "player" || !targetRaw ? "player" : "event";
  const target = segmentedSelect({
    options: ANIMATION_TARGET_SEGMENTS,
    value: targetMode,
    testid: "show-animation-m2-target-mode",
    ariaLabel: "대상",
  });
  const event = recordPickerWithPreview({
    records: events,
    selectedId: targetMode === "event" ? targetRaw : "",
    placeholder: "이벤트 선택",
    testid: "show-animation-m2-event-select",
    subtitleOf: (record) => record.id,
  });
  const animation = recordPickerWithPreview({
    records: animations,
    selectedId: String(cmd.fields.animationId ?? ""),
    placeholder: "전투 애니메이션",
    testid: "show-animation-m2-animation-select",
    subtitleOf: (record) => record.resourceId ?? null,
  });
  const preview = previewPanel("show-animation-m2-preview");
  const eventField = fieldBlock("이벤트", event.root, "show-animation-m2-event-field");

  const commit = () => {
    replaceFields(context, cmd, {
      target: target.select.value === "player" ? "player" : event.select.value,
      animationId: animation.select.value,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const animName =
      animations.find((entry) => entry.id === animation.select.value)?.name ?? "(미선택)";
    const who =
      target.select.value === "player"
        ? "주인공"
        : events.find((entry) => entry.id === event.select.value)?.name ?? "이벤트";
    preview.replaceChildren(line(`${who} · ${animName}`), note("전투 애니메이션을 맵에서 재생합니다."));
  };
  const syncVisibility = () => {
    eventField.hidden = target.select.value === "player";
  };

  target.select.addEventListener("change", () => {
    syncVisibility();
    commit();
  });
  event.select.addEventListener("change", commit);
  animation.select.addEventListener("change", commit);
  syncVisibility();
  renderPreview();
  wrap.append(
    intentCard("애니메이션 표시", "대상 위에 전투 애니메이션을 재생합니다.", "show-animation-m2-intent"),
    layout(
      [fieldBlock("대상", target.root), eventField, fieldBlock("애니메이션", animation.root)],
      preview
    )
  );
  return wrap;
}

function flashEventBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "flash-event-command-body");
  const project = store.getCurrent();
  const events = eventRecords(project);
  const event = recordPickerWithPreview({
    records: events,
    selectedId: String(cmd.fields.target ?? ""),
    placeholder: "이벤트 선택",
    testid: "flash-event-event-select",
    subtitleOf: (record) => record.id,
  });
  const colorRaw = String(cmd.fields.value ?? cmd.fields.color ?? "white");
  const color = segmentedSelect({
    options: SCREEN_COLOR_SEGMENTS,
    value: (SCREEN_COLOR_SEGMENTS.find((entry) => entry.value === colorRaw)?.value ?? "white") as
      | "white"
      | "red"
      | "green"
      | "blue"
      | "yellow"
      | "purple"
      | "black",
    testid: "flash-event-color",
    ariaLabel: "플래시 색",
  });
  const preview = previewPanel("flash-event-preview");

  const commit = () => {
    replaceFields(context, cmd, {
      target: event.select.value,
      value: color.select.value,
      operation: "set",
    });
    renderPreview();
  };
  const renderPreview = () => {
    const name = events.find((entry) => entry.id === event.select.value)?.name ?? "이벤트";
    const colorLabel =
      SCREEN_COLOR_SEGMENTS.find((entry) => entry.value === color.select.value)?.label ??
      color.select.value;
    preview.replaceChildren(line(`${name} · ${colorLabel} 플래시`), note("이벤트 스프라이트를 번쩍입니다."));
  };

  event.select.addEventListener("change", commit);
  color.select.addEventListener("change", commit);
  renderPreview();
  wrap.append(
    intentCard("이벤트 플래시", "특정 이벤트를 색으로 번쩍입니다.", "flash-event-intent"),
    layout([fieldBlock("이벤트", event.root), fieldBlock("색상", color.root)], preview)
  );
  return wrap;
}

function stopAllMovementBody(_context: CommandEditContext, _cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "stop-all-movement-command-body");
  const preview = previewPanel("stop-all-movement-preview");
  preview.replaceChildren(
    line("모든 이동 중지"),
    note("진행 중인 이동 경로를 즉시 멈춥니다.")
  );
  // field-less command — no form state to commit on open.
  wrap.append(
    intentCard("모든 이동 중지", "맵 위 이동을 일제히 정지합니다.", "stop-all-movement-intent"),
    layout(
      [el("p", { class: "actor-m2-preview-note", text: "추가 설정 없이 실행됩니다." })],
      preview
    )
  );
  return wrap;
}

function keyInputProcessingBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "key-input-processing-command-body");
  let variableId = String(cmd.fields.variableId ?? cmd.fields.target ?? "").trim();
  const wait = segmentedSelect({
    options: BOOLEAN_SEGMENTS,
    value: String(cmd.fields.value ?? cmd.fields.operation ?? "true") === "false" ? "false" : "true",
    testid: "key-input-processing-wait",
    ariaLabel: "입력 대기",
  });
  const preview = previewPanel("key-input-processing-preview");
  const variable = databasePicker(
    "variable",
    variableId,
    (id) => {
      variableId = id;
      commit();
    },
    "key-input-processing-variable"
  );

  const commit = () => {
    replaceFields(context, cmd, {
      target: variableId,
      variableId,
      operation: "set",
      value: wait.select.value,
    });
    renderPreview();
  };
  const renderPreview = () => {
    preview.replaceChildren(
      line(
        `키 입력 → ${variableLabel(variableId)}${wait.select.value === "true" ? " · 입력까지 대기" : ""}`
      ),
      note("눌린 키 코드를 변수에 저장합니다.")
    );
  };

  wait.select.addEventListener("change", commit);
  renderPreview();
  wrap.append(
    intentCard("키 입력 처리", "키 입력을 읽어 변수에 넣습니다.", "key-input-processing-intent"),
    layout(
      [fieldBlock("결과 변수", variable), fieldBlock("입력까지 대기", wait.root)],
      preview
    )
  );
  return wrap;
}

function changeTilesetBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "change-tileset-command-body");
  const project = store.getCurrent();
  const tilesets = Object.values(project.tilesets).map((tileset) => ({
    id: tileset.id,
    name: tileset.name?.trim() || "(이름 없음)",
  }));
  const tileset = recordPickerWithPreview({
    records: tilesets,
    selectedId: String(cmd.fields.value ?? cmd.fields.target ?? ""),
    placeholder: "타일셋 선택",
    testid: "change-tileset-select",
  });
  const preview = previewPanel("change-tileset-preview");

  const commit = () => {
    replaceFields(context, cmd, {
      target: tileset.select.value,
      operation: "set",
      value: tileset.select.value,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const name = tilesets.find((entry) => entry.id === tileset.select.value)?.name ?? "(미선택)";
    preview.replaceChildren(line(`타일셋 → ${name}`), note("현재 맵의 타일셋을 교체합니다."));
  };

  tileset.select.addEventListener("change", commit);
  renderPreview();
  wrap.append(
    intentCard("타일셋 변경", "맵 타일셋을 다른 세트로 바꿉니다.", "change-tileset-intent"),
    layout([fieldBlock("타일셋", tileset.root)], preview)
  );
  return wrap;
}

function changeParallaxBackBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "change-parallax-back-command-body");
  const project = store.getCurrent();
  let resourceId = String(cmd.fields.value ?? cmd.fields.resourceId ?? "").trim();
  const resourceSelect = resourceIdSelect(resourceId, "change-parallax-back-resource-select", "backdrop");
  const pickBtn = el("button", {
    class: "btn small",
    text: "리소스 선택…",
    attrs: { type: "button" },
    dataset: { testid: "change-parallax-back-resource-picker" },
    on: {
      click: () => {
        openDatabaseResourcePickerDialog({
          kind: "backdrop",
          title: "파노라마 리소스 선택",
          currentId: resourceId,
          onConfirm: (result) => {
            resourceId = result.resourceId;
            resourceSelect.value = resourceId;
            commit();
          },
        });
      },
    },
  });
  const preview = previewPanel("change-parallax-back-preview");

  const commit = () => {
    resourceId = resourceSelect.value.trim();
    replaceFields(context, cmd, {
      target: resourceId,
      operation: "set",
      value: resourceId,
      resourceId,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const icon = imageIconOf(project, resourceId || undefined);
    preview.replaceChildren(
      el("div", {
        class: "actor-m2-preview-actor",
        children: [
          recordIconElement(icon, resourceId || "선택 없음"),
          el("div", {
            class: "actor-m2-preview-copy",
            children: [
              line(`파노라마 → ${resourceId || "(선택 없음)"}`),
              note("맵 원경(parallax) 이미지를 교체합니다."),
            ],
          }),
        ],
      })
    );
  };

  resourceSelect.addEventListener("change", commit);
  renderPreview();
  wrap.append(
    intentCard("파노라마 변경", "맵 배경 원경 이미지를 바꿉니다.", "change-parallax-back-intent"),
    layout(
      [
        fieldBlock(
          "파노라마",
          el("div", { class: "actor-m2-inline", children: [resourceSelect, pickBtn] })
        ),
      ],
      preview
    )
  );
  return wrap;
}

function setEncounterRateBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "set-encounter-rate-command-body");
  const source = valueSourceControls(cmd, {
    testidBase: "set-encounter-rate",
    defaultNumber:
      typeof cmd.fields.value === "number"
        ? cmd.fields.value
        : Number(cmd.fields.value) || 0,
  });
  const preview = previewPanel("set-encounter-rate-preview");

  const commit = () => {
    const amount = source.read();
    replaceFields(context, cmd, {
      target: "map",
      operation: "set",
      value: amount.source === "variable" ? amount.variableId : amount.numberValue,
      valueSource: amount.source,
      valueVariableId: amount.variableId,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const amount = source.read();
    const label =
      amount.source === "variable"
        ? `변수 ${variableLabel(amount.variableId)}`
        : String(amount.numberValue);
    preview.replaceChildren(
      line(`인카운트율 = ${label}`),
      note("0이면 랜덤 인카운트 비활성. 값이 클수록 전투가 잦습니다.")
    );
  };

  source.bind(commit);
  source.syncVisibility();
  renderPreview();
  wrap.append(
    intentCard("인카운트율 설정", "맵 랜덤 전투 빈도를 조정합니다.", "set-encounter-rate-intent"),
    layout(
      [
        fieldBlock("값 소스", source.sourceRoot),
        source.numberField,
        source.variableField,
      ],
      preview
    )
  );
  return wrap;
}

function changeTileM2Body(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "change-tile-m2-command-body");
  const coords = locationControls(cmd, "change-tile-m2");
  const tileIdInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.value === "number"
        ? cmd.fields.value
        : Number(cmd.fields.value) || 0
    ),
    dataset: { testid: "change-tile-m2-tile-id-input" },
  }) as HTMLInputElement;
  const layerInput = el("input", {
    attrs: { type: "text", placeholder: "lower / upper" },
    value: String(cmd.fields.target ?? "lower"),
    dataset: { testid: "change-tile-m2-layer-input" },
  }) as HTMLInputElement;
  const preview = previewPanel("change-tile-m2-preview");

  const commit = () => {
    const loc = coords.read();
    replaceFields(context, cmd, {
      target: layerInput.value.trim() || "lower",
      operation: "set",
      value: Math.max(0, Math.trunc(Number(tileIdInput.value) || 0)),
      mapId: loc.mapId,
      x: loc.x,
      y: loc.y,
    });
    renderPreview();
  };
  const renderPreview = () => {
    const loc = coords.read();
    const tileId = Math.max(0, Math.trunc(Number(tileIdInput.value) || 0));
    preview.replaceChildren(
      line(
        `타일 변경 · ${mapLabel(loc.mapId)} (${loc.x}, ${loc.y}) → #${tileId} / ${layerInput.value.trim() || "lower"}`
      ),
      note("지정 좌표의 맵 타일을 교체합니다.")
    );
  };

  coords.bind(commit);
  tileIdInput.addEventListener("change", commit);
  tileIdInput.addEventListener("input", commit);
  layerInput.addEventListener("change", commit);
  layerInput.addEventListener("input", commit);
  renderPreview();
  wrap.append(
    intentCard("타일 변경", "맵 한 칸의 타일 ID를 바꿉니다.", "change-tile-m2-intent"),
    layout(
      [...coords.fields, fieldBlock("레이어", layerInput), fieldBlock("타일 ID", tileIdInput)],
      preview
    )
  );
  return wrap;
}

// ---- shared helpers ----

function locationControls(
  cmd: M2Command,
  testidBase: string
): {
  readonly fields: HTMLElement[];
  readonly read: () => { mapId: string; x: number; y: number };
  readonly bind: (onChange: () => void) => void;
} {
  const project = store.getCurrent();
  const maps = Object.values(project.maps).map((map) => ({
    id: map.id,
    name: map.name?.trim() || map.id,
  }));
  const map = recordPickerWithPreview({
    records: maps,
    selectedId: String(cmd.fields.mapId ?? ""),
    placeholder: "맵 선택",
    testid: `${testidBase}-map-select`,
  });
  const xInput = el("input", {
    attrs: { type: "number", step: "1" },
    value: String(typeof cmd.fields.x === "number" ? cmd.fields.x : Number(cmd.fields.x) || 0),
    dataset: { testid: `${testidBase}-x-input` },
  }) as HTMLInputElement;
  const yInput = el("input", {
    attrs: { type: "number", step: "1" },
    value: String(typeof cmd.fields.y === "number" ? cmd.fields.y : Number(cmd.fields.y) || 0),
    dataset: { testid: `${testidBase}-y-input` },
  }) as HTMLInputElement;

  return {
    fields: [
      fieldBlock("맵", map.root),
      fieldBlock("X", xInput),
      fieldBlock("Y", yInput),
    ],
    read: () => ({
      mapId: map.select.value,
      x: Math.trunc(Number(xInput.value) || 0),
      y: Math.trunc(Number(yInput.value) || 0),
    }),
    bind: (onChange) => {
      map.select.addEventListener("change", onChange);
      xInput.addEventListener("change", onChange);
      xInput.addEventListener("input", onChange);
      yInput.addEventListener("change", onChange);
      yInput.addEventListener("input", onChange);
    },
  };
}

function valueSourceControls(
  cmd: M2Command,
  options: { readonly testidBase: string; readonly defaultNumber: number }
): {
  readonly sourceRoot: HTMLElement;
  readonly numberField: HTMLElement;
  readonly variableField: HTMLElement;
  readonly read: () => { source: "number" | "variable"; numberValue: number; variableId: string };
  readonly syncVisibility: () => void;
  readonly bind: (onChange: () => void) => void;
} {
  const initialSource =
    String(cmd.fields.valueSource ?? "") === "variable" ||
    Boolean(String(cmd.fields.valueVariableId ?? "").trim())
      ? "variable"
      : "number";
  let variableId = String(cmd.fields.valueVariableId ?? "").trim();
  const source = segmentedSelect({
    options: VALUE_SOURCE_SEGMENTS,
    value: initialSource,
    testid: `${options.testidBase}-value-source`,
    ariaLabel: "값 소스",
  });
  const numberInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.value === "number"
        ? cmd.fields.value
        : Number(cmd.fields.value) || options.defaultNumber
    ),
    dataset: { testid: `${options.testidBase}-value-input` },
  }) as HTMLInputElement;
  let outerOnChange: (() => void) | null = null;
  const variable = databasePicker(
    "variable",
    variableId,
    (nextId) => {
      variableId = nextId;
      outerOnChange?.();
    },
    `${options.testidBase}-value-variable`
  );
  const numberField = fieldBlock("값", numberInput, `${options.testidBase}-number-field`);
  const variableField = fieldBlock("변수", variable, `${options.testidBase}-variable-field`);

  const syncVisibility = () => {
    const useVariable = source.select.value === "variable";
    numberField.hidden = useVariable;
    variableField.hidden = !useVariable;
  };

  return {
    sourceRoot: source.root,
    numberField,
    variableField,
    read: () => ({
      source: source.select.value === "variable" ? "variable" : "number",
      numberValue: Math.max(0, Math.trunc(Number(numberInput.value) || 0)),
      variableId,
    }),
    syncVisibility,
    bind: (onChange) => {
      outerOnChange = onChange;
      source.select.addEventListener("change", () => {
        syncVisibility();
        onChange();
      });
      numberInput.addEventListener("change", onChange);
      numberInput.addEventListener("input", onChange);
    },
  };
}

function resourceIdSelect(
  currentId: string,
  testId: string,
  prefer: "picture" | "backdrop"
): HTMLSelectElement {
  const project = store.getCurrent();
  const select = el("select", {
    dataset: { testid: testId },
    attrs: { "aria-label": prefer === "picture" ? "그림 리소스" : "파노라마 리소스" },
  }) as HTMLSelectElement;
  select.append(el("option", { text: "(선택 없음)", attrs: { value: "" } }));
  const ids = new Set<string>();
  for (const profile of project.resourceProfiles) {
    if (!profile.assetId || ids.has(profile.assetId)) continue;
    if (prefer === "picture" && profile.kind !== "picture" && profile.kind !== "system") continue;
    if (prefer === "backdrop" && profile.kind !== "backdrop" && profile.kind !== "picture") continue;
    ids.add(profile.assetId);
    select.append(
      el("option", {
        text: `${profile.name} (${profile.assetId})`,
        attrs: { value: profile.assetId },
      })
    );
  }
  for (const asset of Object.values(project.assets.uploaded)) {
    if (ids.has(asset.id)) continue;
    if (prefer === "picture" && asset.kind !== "picture") continue;
    if (prefer === "backdrop" && asset.kind !== "picture" && asset.kind !== "backdrop") continue;
    ids.add(asset.id);
    select.append(el("option", { text: `${asset.name} (${asset.id})`, attrs: { value: asset.id } }));
  }
  if (currentId && !ids.has(currentId)) {
    select.append(el("option", { text: `현재 값: ${currentId}`, attrs: { value: currentId } }));
  }
  select.value = currentId;
  return select;
}

function shell(className: string, testId: string): HTMLElement {
  return el("div", {
    class: `rich-command-form ${className}`,
    dataset: { testid: testId },
  });
}

function intentCard(title: string, body: string, testId: string): HTMLElement {
  return el("div", {
    class: "party-member-intent",
    dataset: { testid: testId },
    children: [
      el("div", { class: "party-member-intent-title", text: title }),
      el("p", { class: "party-member-intent-body", text: body }),
    ],
  });
}

function fieldBlock(label: string, control: HTMLElement, testId?: string): HTMLElement {
  return el("div", {
    class: "actor-m2-field change-parameters-field",
    dataset: testId ? { testid: testId } : undefined,
    children: [el("div", { class: "actor-m2-field-label change-parameters-field-label", text: label }), control],
  });
}

function layout(mainChildren: readonly HTMLElement[], preview: HTMLElement): HTMLElement {
  return el("div", {
    class: "actor-m2-layout",
    children: [
      el("div", {
        class: "actor-m2-main",
        children: [...mainChildren],
      }),
      preview,
    ],
  });
}

function previewPanel(testId: string): HTMLElement {
  return el("div", {
    class: "actor-m2-preview",
    dataset: { testid: testId },
  });
}

function line(text: string): HTMLElement {
  return el("p", { class: "actor-m2-preview-line", text });
}

function note(text: string): HTMLElement {
  return el("p", { class: "actor-m2-preview-note", text });
}

function replaceFields(
  context: CommandEditContext,
  cmd: M2Command,
  fields: Record<string, M2CommandValue>,
  removeKeys: readonly string[] = []
): void {
  const current = context.getCurrentCommand?.();
  const latest = current?.kind === "m2Command" && current.commandId === cmd.commandId ? current : cmd;
  const nextFields = { ...latest.fields, ...fields };
  for (const key of removeKeys) delete nextFields[key];
  context.actions.replaceCommand(context.path, {
    ...latest,
    fields: nextFields,
  });
}

function eventRecords(project: ReturnType<typeof store.getCurrent>): readonly {
  readonly id: string;
  readonly name: string;
}[] {
  return Object.values(project.maps).flatMap((map) =>
    map.events.map((event) => ({
      id: event.id,
      name: `${map.name} / ${event.id} (${event.x}, ${event.y})`,
    }))
  );
}

function variableLabel(variableId: string): string {
  if (!variableId) return "(미선택)";
  const project = store.getCurrent();
  const index = project.variables.findIndex((entry) => entry.id === variableId);
  if (index < 0) return variableId;
  const name = project.variables[index]?.name?.trim();
  return name ? `${String(index + 1).padStart(4, "0")}: ${name}` : String(index + 1).padStart(4, "0");
}

function mapLabel(mapId: string): string {
  if (!mapId) return "(맵 미선택)";
  const project = store.getCurrent();
  return project.maps[mapId]?.name?.trim() || mapId;
}

function parseWeatherValue(raw: string): { kind: string; intensity: number } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "none") return { kind: "none", intensity: 0.5 };
  const tokens = trimmed.split(/[\s,:;]+/).filter(Boolean);
  let kind = "none";
  let intensity = 0.5;
  for (const token of tokens) {
    if (["none", "rain", "storm", "snow", "fog"].includes(token)) {
      kind = token;
      continue;
    }
    const n = Number(token);
    if (Number.isFinite(n)) intensity = clamp01(n > 1 ? n / 10 : n);
  }
  if (kind === "none" && tokens[0]) kind = tokens[0];
  return { kind, intensity };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
