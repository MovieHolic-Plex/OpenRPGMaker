// Page 3 native command rich forms (맵·연출): lighting, weather, animation, picture, tile.
import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import type { Command, WeatherKind } from "@/project/types";
import { el } from "@/util/dom";
import {
  amountStepper,
  recordPickerWithPreview,
  segmentedSelect,
  type SegmentOption,
} from "./recordPicker";
import { selectedOptionValue } from "./dom";
import { LAYER_OPTIONS } from "./options";
import type { CommandEditContext } from "./types";

const ANCHOR_SEGMENTS = [
  { value: "player", key: "player", label: "플레이어" },
  { value: "event", key: "event", label: "이벤트" },
  { value: "position", key: "position", label: "좌표" },
] as const satisfies readonly SegmentOption<"player" | "event" | "position">[];

const BOOL_SEGMENTS = [
  { value: "true", key: "true", label: "예" },
  { value: "false", key: "false", label: "아니오" },
] as const satisfies readonly SegmentOption<"true" | "false">[];

const WEATHER_SEGMENTS = [
  { value: "none", key: "none", label: "없음" },
  { value: "rain", key: "rain", label: "비" },
  { value: "storm", key: "storm", label: "폭풍" },
  { value: "snow", key: "snow", label: "눈" },
  { value: "fog", key: "fog", label: "안개" },
] as const satisfies readonly SegmentOption<WeatherKind>[];

const LAYER_SEGMENTS = [
  { value: "lower", key: "lower", label: "바닥" },
  { value: "upper", key: "upper", label: "덧그림" },
] as const satisfies readonly SegmentOption<"lower" | "upper">[];

const LIGHTING_PRESETS = [
  { id: "day", label: "낮", ambient: 0, color: "#000000", transitionMs: 0 },
  { id: "dusk", label: "황혼", ambient: 0.35, color: "#1a1020", transitionMs: 400 },
  { id: "night", label: "밤", ambient: 0.75, color: "#05070a", transitionMs: 600 },
  { id: "horror", label: "호러", ambient: 0.9, color: "#020408", transitionMs: 800 },
] as const;

const WEATHER_PRESETS = [
  { id: "clear", label: "맑음", weather: "none" as const, intensity: 0, transitionMs: 0 },
  { id: "drizzle", label: "이슬비", weather: "rain" as const, intensity: 0.3, transitionMs: 400 },
  { id: "storm", label: "폭풍", weather: "storm" as const, intensity: 0.85, transitionMs: 600 },
  { id: "blizzard", label: "눈보라", weather: "snow" as const, intensity: 0.7, transitionMs: 500 },
  { id: "mist", label: "안개", weather: "fog" as const, intensity: 0.55, transitionMs: 400 },
] as const;

export function setLightingBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "setLighting" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "set-lighting-command-body");
  const ambient = numberInput(cmd.ambient, "암전 정도(0~1)", "set-lighting-ambient-input");
  ambient.setAttribute("step", "0.05");
  ambient.setAttribute("min", "0");
  ambient.setAttribute("max", "1");
  const ambientSlider = el("input", {
    class: "page3-range-input",
    attrs: { type: "range", min: "0", max: "1", step: "0.05", "aria-label": "암전 슬라이더" },
    value: String(clamp01(cmd.ambient)),
    dataset: { testid: "set-lighting-ambient-slider" },
  }) as HTMLInputElement;
  const color = textInput(cmd.color ?? "#000000", "마스크 색상", "set-lighting-color-input");
  color.setAttribute("type", "text");
  const colorPicker = el("input", {
    class: "page3-color-swatch",
    attrs: { type: "color", "aria-label": "마스크 색상 피커" },
    value: normalizeHexColor(cmd.color ?? "#000000"),
    dataset: { testid: "set-lighting-color-picker" },
  }) as HTMLInputElement;
  const transitionMs = numberInput(cmd.transitionMs ?? 0, "전환 시간(ms)", "set-lighting-transition-input");
  transitionMs.setAttribute("min", "0");
  const transitionStepper = amountStepper(transitionMs, { testidBase: "set-lighting-transition", min: 0 });
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "set-lighting-preview" },
  });
  const presets = el("div", {
    class: "actor-m2-presets",
    dataset: { testid: "set-lighting-presets" },
  });

  const commit = () => {
    const nextTransition = Math.max(0, parseInt(transitionMs.value, 10) || 0);
    context.actions.replaceCommand(context.path, {
      kind: "setLighting",
      ambient: clamp01(parseFloat(ambient.value)),
      color: color.value.trim() || undefined,
      ...(nextTransition > 0 ? { transitionMs: nextTransition } : {}),
    });
    renderPreview();
  };

  const renderPreview = () => {
    const ambientValue = clamp01(parseFloat(ambient.value));
    const pct = Math.round(ambientValue * 100);
    const hex = color.value.trim() || "#000000";
    const ms = Math.max(0, parseInt(transitionMs.value, 10) || 0);
    const stage = el("div", {
      class: "page3-preview-stage page3-preview-lighting",
      dataset: { testid: "set-lighting-preview-stage" },
    });
    stage.style.background = `linear-gradient(180deg, #3a4a62, #1c2433)`;
    const veil = el("div", { class: "page3-preview-lighting-veil" });
    veil.style.background = hex;
    veil.style.opacity = String(ambientValue);
    stage.append(veil, el("div", { class: "page3-preview-lighting-label", text: `DARK ${pct}%` }));
    preview.replaceChildren(
      stage,
      el("p", {
        class: "actor-m2-preview-line",
        text: `암전 ${pct}% · ${hex}${ms > 0 ? ` · ${ms}ms` : " · 즉시"}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "ambient 0=완전 밝음, 1=완전 암전. 전환 시간이 있으면 페이드 후 적용됩니다.",
      })
    );
  };

  for (const preset of LIGHTING_PRESETS) {
    presets.append(
      el("button", {
        class: "btn small actor-m2-chip",
        text: preset.label,
        attrs: { type: "button" },
        dataset: { testid: `set-lighting-preset-${preset.id}` },
        on: {
          click: () => {
            ambient.value = String(preset.ambient);
            ambientSlider.value = String(preset.ambient);
            color.value = preset.color;
            colorPicker.value = normalizeHexColor(preset.color);
            transitionMs.value = String(preset.transitionMs);
            commit();
          },
        },
      })
    );
  }

  ambient.addEventListener("change", () => {
    ambientSlider.value = String(clamp01(parseFloat(ambient.value)));
    commit();
  });
  ambient.addEventListener("input", () => {
    ambientSlider.value = String(clamp01(parseFloat(ambient.value)));
    renderPreview();
  });
  ambientSlider.addEventListener("input", () => {
    ambient.value = ambientSlider.value;
    renderPreview();
  });
  ambientSlider.addEventListener("change", () => {
    ambient.value = ambientSlider.value;
    commit();
  });
  color.addEventListener("change", () => {
    colorPicker.value = normalizeHexColor(color.value.trim() || "#000000");
    commit();
  });
  color.addEventListener("input", renderPreview);
  colorPicker.addEventListener("input", () => {
    color.value = colorPicker.value;
    renderPreview();
  });
  colorPicker.addEventListener("change", () => {
    color.value = colorPicker.value;
    commit();
  });
  transitionMs.addEventListener("change", commit);
  transitionMs.addEventListener("input", renderPreview);

  renderPreview();
  wrap.append(
    intentCard(
      "조명 설정",
      "맵 전체 암전 정도와 마스크 색상을 바꿉니다. 전환 시간(ms)이 있으면 페이드로 적용됩니다.",
      "set-lighting-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock(
              "암전 정도",
              el("div", {
                class: "page3-slider-row",
                children: [ambientSlider, ambient],
              })
            ),
            fieldBlock(
              "마스크 색상",
              el("div", {
                class: "page3-color-row",
                children: [colorPicker, color],
              })
            ),
            fieldBlock("전환 시간(ms)", transitionStepper),
            fieldBlock("프리셋", presets),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

export function addLightBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "addLight" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "add-light-command-body");
  const id = textInput(cmd.source.id, "광원 ID", "add-light-id-input");
  const anchor = segmentedSelect({
    options: ANCHOR_SEGMENTS,
    value: lightAnchorKind(cmd.source.at),
    testid: "add-light-anchor-kind-select",
    ariaLabel: "광원 앵커",
  });
  const eventId = textInput(
    cmd.source.at !== "player" && "eventId" in cmd.source.at ? cmd.source.at.eventId : "",
    "이벤트 ID",
    "add-light-event-id-input"
  );
  const x = numberInput(
    cmd.source.at !== "player" && "x" in cmd.source.at ? cmd.source.at.x : 0,
    "X",
    "add-light-x-input"
  );
  const y = numberInput(
    cmd.source.at !== "player" && "y" in cmd.source.at ? cmd.source.at.y : 0,
    "Y",
    "add-light-y-input"
  );
  const radius = numberInput(cmd.source.radius, "반경(타일)", "add-light-radius-input");
  radius.setAttribute("min", "0");
  const radiusStepper = amountStepper(radius, { testidBase: "add-light-radius", min: 0 });
  const intensity = numberInput(cmd.source.intensity ?? 1, "세기(0~1)", "add-light-intensity-input");
  intensity.setAttribute("step", "0.05");
  intensity.setAttribute("min", "0");
  intensity.setAttribute("max", "1");
  const intensitySlider = el("input", {
    class: "page3-range-input",
    attrs: { type: "range", min: "0", max: "1", step: "0.05", "aria-label": "광원 세기" },
    value: String(clamp01(cmd.source.intensity ?? 1)),
    dataset: { testid: "add-light-intensity-slider" },
  }) as HTMLInputElement;
  const color = textInput(cmd.source.color ?? "", "광원 색상", "add-light-color-input");
  const colorPicker = el("input", {
    class: "page3-color-swatch",
    attrs: { type: "color", "aria-label": "광원 색상 피커" },
    value: normalizeHexColor(cmd.source.color ?? "#ffd27a"),
    dataset: { testid: "add-light-color-picker" },
  }) as HTMLInputElement;
  const flicker = segmentedSelect({
    options: BOOL_SEGMENTS,
    value: cmd.source.flicker === true ? "true" : "false",
    testid: "add-light-flicker-select",
    ariaLabel: "깜빡임",
  });
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "add-light-preview" },
  });
  const eventField = fieldBlock("이벤트 ID", eventId, "add-light-event-field");
  const posField = fieldBlock(
    "좌표",
    el("div", { class: "actor-m2-inline page3-coord-row", children: [x, y] }),
    "add-light-position-field"
  );

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      kind: "addLight",
      source: {
        id: id.value.trim() || "light_1",
        at: lightAnchorFromControls(anchor.select.value, eventId.value, x.value, y.value),
        radius: Math.max(0, parseFloat(radius.value) || 0),
        intensity: clamp01(parseFloat(intensity.value)),
        ...(color.value.trim() ? { color: color.value.trim() } : {}),
        ...(flicker.select.value === "true" ? { flicker: true } : {}),
      },
    });
    renderPreview();
  };

  const syncVisibility = () => {
    eventField.hidden = anchor.select.value !== "event";
    posField.hidden = anchor.select.value !== "position";
  };

  const renderPreview = () => {
    const lightId = id.value.trim() || "light_1";
    const r = Math.max(0, parseFloat(radius.value) || 0);
    const power = clamp01(parseFloat(intensity.value));
    const hex = color.value.trim() || "#ffd27a";
    const where =
      anchor.select.value === "player"
        ? "플레이어"
        : anchor.select.value === "event"
          ? `이벤트 ${eventId.value.trim() || "(미선택)"}`
          : `(${parseInt(x.value, 10) || 0}, ${parseInt(y.value, 10) || 0})`;
    const stage = el("div", {
      class: "page3-preview-stage page3-preview-light",
      dataset: { testid: "add-light-preview-stage" },
    });
    const glow = el("div", { class: "page3-preview-light-glow" });
    glow.style.width = `${Math.max(18, Math.min(96, 18 + r * 10))}px`;
    glow.style.height = glow.style.width;
    glow.style.background = `radial-gradient(circle, ${hex} 0%, transparent 70%)`;
    glow.style.opacity = String(0.35 + power * 0.65);
    stage.append(glow);
    preview.replaceChildren(
      stage,
      el("p", {
        class: "actor-m2-preview-line",
        text: `${lightId} · ${where} · r${r} · ${Math.round(power * 100)}%`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: flicker.select.value === "true" ? "깜빡임 켜짐" : "고정 광원",
      })
    );
  };

  for (const control of [id, eventId, x, y, radius, intensity, color]) {
    control.addEventListener("change", commit);
    control.addEventListener("input", renderPreview);
  }
  intensitySlider.addEventListener("input", () => {
    intensity.value = intensitySlider.value;
    renderPreview();
  });
  intensitySlider.addEventListener("change", () => {
    intensity.value = intensitySlider.value;
    commit();
  });
  intensity.addEventListener("input", () => {
    intensitySlider.value = String(clamp01(parseFloat(intensity.value)));
  });
  intensity.addEventListener("change", () => {
    intensitySlider.value = String(clamp01(parseFloat(intensity.value)));
  });
  colorPicker.addEventListener("input", () => {
    color.value = colorPicker.value;
    renderPreview();
  });
  colorPicker.addEventListener("change", () => {
    color.value = colorPicker.value;
    commit();
  });
  color.addEventListener("change", () => {
    if (color.value.trim()) colorPicker.value = normalizeHexColor(color.value.trim());
  });
  anchor.select.addEventListener("change", () => {
    syncVisibility();
    commit();
  });
  flicker.select.addEventListener("change", commit);

  syncVisibility();
  renderPreview();
  wrap.append(
    intentCard(
      "광원 추가",
      "플레이어·이벤트·좌표 중 한 곳에 점광원을 붙입니다. 반경(타일)·세기·색·깜빡임을 설정합니다.",
      "add-light-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("광원 ID", id),
            fieldBlock("앵커", anchor.root),
            eventField,
            posField,
            fieldBlock("반경(타일)", radiusStepper),
            fieldBlock(
              "세기",
              el("div", {
                class: "page3-slider-row",
                children: [intensitySlider, intensity],
              })
            ),
            fieldBlock(
              "색상",
              el("div", {
                class: "page3-color-row",
                children: [colorPicker, color],
              })
            ),
            fieldBlock("깜빡임", flicker.root),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

export function removeLightBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "removeLight" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "remove-light-command-body");
  const all = segmentedSelect({
    options: [
      { value: "true", key: "all", label: "전체 제거" },
      { value: "false", key: "id", label: "ID 지정" },
    ] as const satisfies readonly SegmentOption<"true" | "false">[],
    value: cmd.all === true ? "true" : "false",
    testid: "remove-light-all-select",
    ariaLabel: "제거 범위",
  });
  const id = textInput(cmd.id ?? "", "광원 ID", "remove-light-id-input");
  const idField = fieldBlock("광원 ID", id, "remove-light-id-field");
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "remove-light-preview" },
  });

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      kind: "removeLight",
      ...(all.select.value === "true" ? { all: true } : { id: id.value.trim() }),
    });
    renderPreview();
  };

  const syncVisibility = () => {
    idField.hidden = all.select.value === "true";
  };

  const renderPreview = () => {
    const line =
      all.select.value === "true"
        ? "맵의 모든 동적 광원을 끕니다."
        : `광원 ID "${id.value.trim() || "(비어 있음)"}" 를 제거합니다.`;
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: all.select.value === "true" ? "LIGHTS OFF" : `LIGHT OFF · ${id.value.trim() || "—"}`,
      }),
      el("p", { class: "actor-m2-preview-note", text: line })
    );
  };

  all.select.addEventListener("change", () => {
    syncVisibility();
    commit();
  });
  id.addEventListener("change", commit);
  id.addEventListener("input", renderPreview);

  syncVisibility();
  renderPreview();
  wrap.append(
    intentCard(
      "광원 제거",
      "지정 ID 광원 하나 또는 세션의 모든 동적 광원을 제거합니다.",
      "remove-light-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [fieldBlock("범위", all.root), idField],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

export function setWeatherBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "setWeather" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "set-weather-command-body");
  const kind = segmentedSelect({
    options: WEATHER_SEGMENTS,
    value: cmd.weather,
    testid: "set-weather-kind-select",
    ariaLabel: "날씨 종류",
  });
  const intensity = numberInput(cmd.intensity ?? 0.5, "강도(0~1)", "set-weather-intensity-input");
  intensity.setAttribute("step", "0.05");
  intensity.setAttribute("min", "0");
  intensity.setAttribute("max", "1");
  const intensitySlider = el("input", {
    class: "page3-range-input",
    attrs: { type: "range", min: "0", max: "1", step: "0.05", "aria-label": "날씨 강도" },
    value: String(clamp01(cmd.intensity ?? 0.5)),
    dataset: { testid: "set-weather-intensity-slider" },
  }) as HTMLInputElement;
  const transitionMs = numberInput(cmd.transitionMs ?? 0, "전환 시간(ms)", "set-weather-transition-input");
  transitionMs.setAttribute("min", "0");
  const transitionStepper = amountStepper(transitionMs, { testidBase: "set-weather-transition", min: 0 });
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "set-weather-preview" },
  });
  const presets = el("div", {
    class: "actor-m2-presets",
    dataset: { testid: "set-weather-presets" },
  });

  const commit = () => {
    const nextTransition = Math.max(0, parseInt(transitionMs.value, 10) || 0);
    context.actions.replaceCommand(context.path, {
      kind: "setWeather",
      weather: kind.select.value as WeatherKind,
      intensity: clamp01(parseFloat(intensity.value)),
      ...(nextTransition > 0 ? { transitionMs: nextTransition } : {}),
    });
    renderPreview();
  };

  const renderPreview = () => {
    const weather = kind.select.value as WeatherKind;
    const power = clamp01(parseFloat(intensity.value));
    const ms = Math.max(0, parseInt(transitionMs.value, 10) || 0);
    const stage = el("div", {
      class: `page3-preview-stage page3-preview-weather page3-preview-weather-${weather}`,
      dataset: { testid: "set-weather-preview-stage" },
    });
    stage.append(
      el("div", {
        class: "page3-preview-weather-label",
        text: weatherLabel(weather).toUpperCase(),
      })
    );
    preview.replaceChildren(
      stage,
      el("p", {
        class: "actor-m2-preview-line",
        text: `${weatherLabel(weather)} · 강도 ${Math.round(power * 100)}%${ms > 0 ? ` · ${ms}ms` : ""}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: weather === "none" ? "날씨 효과를 끕니다." : "맵 오버레이 파티클로 표시됩니다.",
      })
    );
  };

  for (const preset of WEATHER_PRESETS) {
    presets.append(
      el("button", {
        class: "btn small actor-m2-chip",
        text: preset.label,
        attrs: { type: "button" },
        dataset: { testid: `set-weather-preset-${preset.id}` },
        on: {
          click: () => {
            kind.select.value = preset.weather;
            kind.select.dispatchEvent(new Event("change"));
            intensity.value = String(preset.intensity);
            intensitySlider.value = String(preset.intensity);
            transitionMs.value = String(preset.transitionMs);
            commit();
          },
        },
      })
    );
  }

  kind.select.addEventListener("change", commit);
  intensity.addEventListener("change", () => {
    intensitySlider.value = String(clamp01(parseFloat(intensity.value)));
    commit();
  });
  intensity.addEventListener("input", () => {
    intensitySlider.value = String(clamp01(parseFloat(intensity.value)));
    renderPreview();
  });
  intensitySlider.addEventListener("input", () => {
    intensity.value = intensitySlider.value;
    renderPreview();
  });
  intensitySlider.addEventListener("change", () => {
    intensity.value = intensitySlider.value;
    commit();
  });
  transitionMs.addEventListener("change", commit);
  transitionMs.addEventListener("input", renderPreview);

  renderPreview();
  wrap.append(
    intentCard(
      "날씨 설정",
      "비·폭풍·눈·안개 오버레이와 강도를 바꿉니다. 없음으로 끄고 전환 시간으로 페이드할 수 있습니다.",
      "set-weather-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("종류", kind.root),
            fieldBlock(
              "강도",
              el("div", {
                class: "page3-slider-row",
                children: [intensitySlider, intensity],
              })
            ),
            fieldBlock("전환 시간(ms)", transitionStepper),
            fieldBlock("프리셋", presets),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

export function showAnimationBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "showAnimation" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "show-animation-command-body");
  const project = store.getCurrent();
  const target = segmentedSelect({
    options: ANCHOR_SEGMENTS,
    value: showAnimationTargetKind(cmd.target),
    testid: "show-animation-target-kind-select",
    ariaLabel: "애니메이션 대상",
  });
  const eventId = textInput(
    cmd.target !== "player" && "eventId" in cmd.target ? cmd.target.eventId : "",
    "이벤트 ID",
    "show-animation-event-id-input"
  );
  const x = numberInput(
    cmd.target !== "player" && "x" in cmd.target ? cmd.target.x : 0,
    "X",
    "show-animation-x-input"
  );
  const y = numberInput(
    cmd.target !== "player" && "y" in cmd.target ? cmd.target.y : 0,
    "Y",
    "show-animation-y-input"
  );
  const wait = segmentedSelect({
    options: BOOL_SEGMENTS,
    value: cmd.wait === true ? "true" : "false",
    testid: "show-animation-wait-select",
    ariaLabel: "완료 대기",
  });
  const animation = recordPickerWithPreview({
    records: project.database.battleAnimations,
    selectedId: cmd.animationId,
    placeholder: "전투 애니메이션",
    testid: "show-animation-animationId-select",
    subtitleOf: (record) => record.resourceId ?? null,
  });
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "show-animation-preview" },
  });
  const eventField = fieldBlock("이벤트 ID", eventId, "show-animation-event-field");
  const posField = fieldBlock(
    "좌표",
    el("div", { class: "actor-m2-inline page3-coord-row", children: [x, y] }),
    "show-animation-position-field"
  );

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      kind: "showAnimation",
      target: showAnimationTargetFromControls(target.select.value, eventId.value, x.value, y.value),
      animationId: animation.select.value || project.database.battleAnimations[0]?.id || "",
      ...(wait.select.value === "true" ? { wait: true } : {}),
    });
    renderPreview();
  };

  const syncVisibility = () => {
    eventField.hidden = target.select.value !== "event";
    posField.hidden = target.select.value !== "position";
  };

  const renderPreview = () => {
    const anim = project.database.battleAnimations.find((entry) => entry.id === animation.select.value);
    const where =
      target.select.value === "player"
        ? "플레이어"
        : target.select.value === "event"
          ? `이벤트 ${eventId.value.trim() || "(현재/미선택)"}`
          : `(${parseInt(x.value, 10) || 0}, ${parseInt(y.value, 10) || 0})`;
    const stage = el("div", {
      class: "page3-preview-stage page3-preview-animation",
      dataset: { testid: "show-animation-preview-stage" },
    });
    stage.append(el("div", { class: "page3-preview-animation-burst", text: "✦" }));
    preview.replaceChildren(
      stage,
      el("p", {
        class: "actor-m2-preview-line",
        text: `${anim?.name ?? (animation.select.value || "(선택 없음)")} · ${where}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: wait.select.value === "true" ? "재생이 끝날 때까지 대기" : "대기 없이 다음 명령 진행",
      })
    );
  };

  for (const control of [eventId, x, y]) {
    control.addEventListener("change", commit);
    control.addEventListener("input", renderPreview);
  }
  target.select.addEventListener("change", () => {
    syncVisibility();
    commit();
  });
  wait.select.addEventListener("change", commit);
  animation.select.addEventListener("change", commit);

  syncVisibility();
  renderPreview();
  wrap.append(
    intentCard(
      "애니메이션 표시",
      "전투 애니메이션을 맵 위 대상(플레이어·이벤트·좌표)에 재생합니다.",
      "show-animation-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("대상", target.root),
            eventField,
            posField,
            fieldBlock("애니메이션", animation.root),
            fieldBlock("완료 대기", wait.root),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

export function showPictureBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "showPicture" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "show-picture-command-body");
  const pictureId = textInput(cmd.pictureId, "그림 번호", "show-picture-id-input");
  const resourceId = textInput(cmd.resourceId, "그림 리소스 ID", "show-picture-resource-input");
  const x = numberInput(cmd.x, "X 좌표", "show-picture-x-input");
  const y = numberInput(cmd.y, "Y 좌표", "show-picture-y-input");
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "show-picture-preview" },
  });
  const presets = el("div", {
    class: "actor-m2-presets",
    dataset: { testid: "show-picture-position-presets" },
  });

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      kind: "showPicture",
      pictureId: pictureId.value.trim() || "pic1",
      resourceId: resourceId.value.trim(),
      x: parseInt(x.value, 10) || 0,
      y: parseInt(y.value, 10) || 0,
    });
    renderPreview();
  };

  const renderPreview = () => {
    const project = store.getCurrent();
    const rid = resourceId.value.trim();
    const url = resolveAssetResourceUrl(rid, { project });
    const px = parseInt(x.value, 10) || 0;
    const py = parseInt(y.value, 10) || 0;
    const stage = el("div", {
      class: "page3-preview-stage page3-preview-picture",
      dataset: { testid: "show-picture-preview-stage" },
    });
    const marker = el("div", {
      class: `page3-preview-picture-marker${url ? "" : " is-missing"}`,
    });
    marker.style.left = `${clampPct((px / 320) * 100)}%`;
    marker.style.top = `${clampPct((py / 240) * 100)}%`;
    if (url) {
      marker.append(
        el("img", {
          class: "page3-preview-picture-img",
          attrs: { src: url, alt: "", draggable: "false" },
        })
      );
    } else {
      marker.append(
        el("span", {
          class: "page3-preview-picture-missing",
          text: `#${pictureId.value.trim() || "pic"}`,
        })
      );
    }
    stage.append(marker);
    preview.replaceChildren(
      stage,
      el("p", {
        class: "actor-m2-preview-line",
        text: `그림 ${pictureId.value.trim() || "pic1"} · (${px}, ${py})`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: rid ? `리소스 ${rid}` : "그림 리소스를 선택하세요 (320×240 좌표계, 중심 앵커).",
      })
    );
  };

  for (const control of [pictureId, resourceId, x, y]) {
    control.addEventListener("change", commit);
    control.addEventListener("input", renderPreview);
  }

  for (const preset of [
    { id: "center", label: "중앙", x: 160, y: 120 },
    { id: "top", label: "상단", x: 160, y: 40 },
    { id: "bottom", label: "하단", x: 160, y: 200 },
    { id: "left", label: "좌", x: 48, y: 120 },
    { id: "right", label: "우", x: 272, y: 120 },
  ] as const) {
    presets.append(
      el("button", {
        class: "btn small actor-m2-chip",
        text: preset.label,
        attrs: { type: "button" },
        dataset: { testid: `show-picture-pos-${preset.id}` },
        on: {
          click: () => {
            x.value = String(preset.x);
            y.value = String(preset.y);
            commit();
          },
        },
      })
    );
  }

  const pick = el("button", {
    class: "btn",
    text: "그림 선택…",
    attrs: { type: "button" },
    dataset: { testid: "show-picture-resource-picker" },
    on: {
      click: () => {
        openDatabaseResourcePickerDialog({
          kind: "image",
          title: "그림 리소스 선택",
          currentId: resourceId.value.trim(),
          onConfirm: (result) => {
            resourceId.value = result.resourceId;
            commit();
          },
        });
      },
    },
  });

  renderPreview();
  wrap.append(
    intentCard(
      "그림 표시",
      "화면 좌표에 그림 레이어를 올립니다. pictureId로 이후 이동/삭제 대상을 식별합니다.",
      "show-picture-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("그림 번호", pictureId),
            fieldBlock(
              "리소스",
              el("div", {
                class: "page3-resource-row",
                children: [resourceId, pick],
              })
            ),
            fieldBlock(
              "좌표 (320×240)",
              el("div", { class: "actor-m2-inline page3-coord-row", children: [x, y] })
            ),
            fieldBlock("위치 프리셋", presets),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

export function erasePictureBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "erasePicture" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "erase-picture-command-body");
  const pictureId = textInput(cmd.pictureId, "그림 번호", "erase-picture-id-input");
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "erase-picture-preview" },
  });

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      kind: "erasePicture",
      pictureId: pictureId.value.trim() || "pic1",
    });
    renderPreview();
  };

  const renderPreview = () => {
    const id = pictureId.value.trim() || "pic1";
    preview.replaceChildren(
      el("p", { class: "actor-m2-preview-line", text: `그림 ${id} 삭제` }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "세션에 표시 중인 해당 pictureId 레이어를 제거합니다.",
      })
    );
  };

  pictureId.addEventListener("change", commit);
  pictureId.addEventListener("input", renderPreview);
  renderPreview();
  wrap.append(
    intentCard("그림 삭제", "표시 중인 그림 레이어를 pictureId로 지웁니다.", "erase-picture-intent"),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [fieldBlock("그림 번호", pictureId)],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

export function changeTileBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "changeTile" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "change-tile-command-body");
  const project = store.getCurrent();
  const mapSel = mapSelect(cmd.mapId, "change-tile-map-select");
  const layer = segmentedSelect({
    options: LAYER_SEGMENTS,
    value: cmd.layer,
    testid: "change-tile-layer-select",
    ariaLabel: "타일 레이어",
  });
  const x = numberInput(cmd.x, "X 좌표", "change-tile-x-input");
  const y = numberInput(cmd.y, "Y 좌표", "change-tile-y-input");
  const tile = numberInput(cmd.tile, "타일 번호", "change-tile-tile-input");
  const tileStepper = amountStepper(tile, { testidBase: "change-tile-tile", min: -1 });
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "change-tile-preview" },
  });
  const presets = el("div", {
    class: "actor-m2-presets",
    dataset: { testid: "change-tile-presets" },
  });

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeTile",
      mapId: mapSel.value,
      layer: selectedOptionValue(layer.select, LAYER_OPTIONS, cmd.layer),
      x: parseInt(x.value, 10) || 0,
      y: parseInt(y.value, 10) || 0,
      tile: parseInt(tile.value, 10) || 0,
    });
    renderPreview();
  };

  const renderPreview = () => {
    const mapId = mapSel.value;
    const mapName = mapId ? project.maps[mapId]?.name || mapId : "(맵 선택)";
    const layerLabel = layer.select.value === "upper" ? "상위" : "하위";
    const tx = parseInt(x.value, 10) || 0;
    const ty = parseInt(y.value, 10) || 0;
    const tileNo = parseInt(tile.value, 10) || 0;
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: `${mapName} · ${layerLabel} (${tx}, ${ty}) → #${tileNo}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: tileNo < 0 ? "음수 타일은 해당 칸을 비웁니다." : "런타임에 맵 타일을 즉시 교체합니다.",
      })
    );
  };

  for (const preset of [
    { id: "clear", label: "비우기", tile: -1 },
    { id: "zero", label: "#0", tile: 0 },
    { id: "floor", label: "#1", tile: 1 },
  ] as const) {
    presets.append(
      el("button", {
        class: "btn small actor-m2-chip",
        text: preset.label,
        attrs: { type: "button" },
        dataset: { testid: `change-tile-preset-${preset.id}` },
        on: {
          click: () => {
            tile.value = String(preset.tile);
            commit();
          },
        },
      })
    );
  }

  for (const control of [mapSel, x, y, tile]) {
    control.addEventListener("change", commit);
    control.addEventListener("input", renderPreview);
  }
  layer.select.addEventListener("change", commit);

  renderPreview();
  wrap.append(
    intentCard(
      "지형 변경",
      "지정 맵·레이어의 한 칸 타일 번호를 바꿉니다. -1은 비우기입니다.",
      "change-tile-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("맵", mapSel),
            fieldBlock("레이어", layer.root),
            fieldBlock(
              "좌표",
              el("div", { class: "actor-m2-inline page3-coord-row", children: [x, y] })
            ),
            fieldBlock("타일 번호", tileStepper),
            fieldBlock("빠른 값", presets),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}


function mapSelect(currentId: string, testId?: string): HTMLSelectElement {
  const project = store.getCurrent();
  const mapSel = el("select", {
    dataset: testId ? { testid: testId } : undefined,
  }) as HTMLSelectElement;
  mapSel.append(el("option", { text: "(맵 선택)", attrs: { value: "" } }));
  for (const id of Object.keys(project.maps)) {
    mapSel.append(el("option", { text: project.maps[id].name || id, attrs: { value: id } }));
  }
  mapSel.value = currentId;
  return mapSel;
}

function numberInput(value: number, title: string, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", title },
    value: String(value),
    dataset: { testid: testId },
  }) as HTMLInputElement;
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

function textInput(value: string, placeholder: string, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "text", placeholder },
    value,
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return "#000000";
}

function lightAnchorKind(
  anchor: Extract<Command, { kind: "addLight" }>["source"]["at"]
): "player" | "event" | "position" {
  if (anchor === "player") return "player";
  if ("eventId" in anchor) return "event";
  return "position";
}

function lightAnchorFromControls(
  kind: string,
  eventId: string,
  xValue: string,
  yValue: string
): Extract<Command, { kind: "addLight" }>["source"]["at"] {
  if (kind === "player") return "player";
  if (kind === "event") return { eventId: eventId.trim() };
  return { x: parseInt(xValue, 10) || 0, y: parseInt(yValue, 10) || 0 };
}

function showAnimationTargetKind(
  target: Extract<Command, { kind: "showAnimation" }>["target"]
): "player" | "event" | "position" {
  if (target === "player") return "player";
  if ("eventId" in target) return "event";
  return "position";
}

function showAnimationTargetFromControls(
  kind: string,
  eventId: string,
  xValue: string,
  yValue: string
): Extract<Command, { kind: "showAnimation" }>["target"] {
  if (kind === "player") return "player";
  if (kind === "event") return { eventId: eventId.trim() };
  return { x: parseInt(xValue, 10) || 0, y: parseInt(yValue, 10) || 0 };
}

function weatherLabel(kind: WeatherKind): string {
  switch (kind) {
    case "none":
      return "없음";
    case "rain":
      return "비";
    case "storm":
      return "폭풍";
    case "snow":
      return "눈";
    case "fog":
      return "안개";
  }
}
