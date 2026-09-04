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
import { drawTransferMapPreview, type TransferPreviewSelection } from "./transferMapPreview";
import {
  bindShowAnimationPlayback,
  renderShowAnimationFallback,
  renderShowAnimationFrame,
  showAnimationPlaybackSource,
} from "./showAnimationPlayback";
import {
  listMovieResources,
  renderMoviePreviewStage,
  resolveMovieResourceUrl,
} from "./playMoviePreview";
import { LAYER_OPTIONS, pictureSlotCaption } from "./options";
import { showPictureAiField } from "./showPictureAiField";
import type { CommandEditContext } from "./types";

const ANCHOR_SEGMENTS = [
  { value: "player", key: "player", label: "주인공" },
  { value: "event", key: "event", label: "이벤트" },
  { value: "position", key: "position", label: "좌표" },
] as const satisfies readonly SegmentOption<"player" | "event" | "position">[];

function opacityToPercent(value: number): number {
  return Math.round((Math.min(255, Math.max(0, value)) / 255) * 100);
}

function percentToOpacity(value: number): number {
  return Math.round((Math.min(100, Math.max(0, value)) / 100) * 255);
}

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
  const ambient = numberInput(Math.round(clamp01(cmd.ambient) * 100), "밝기 (%)", "set-lighting-ambient-input");
  ambient.setAttribute("step", "1");
  ambient.setAttribute("min", "0");
  ambient.setAttribute("max", "100");
  const ambientSlider = el("input", {
    class: "page3-range-input",
    attrs: { type: "range", min: "0", max: "1", step: "0.05", "aria-label": "암전 슬라이더" },
    value: String(clamp01(cmd.ambient)),
    dataset: { testid: "set-lighting-ambient-slider" },
  }) as HTMLInputElement;
  const color = textInput(cmd.color ?? "#000000", "어둠 색", "set-lighting-color-input");
  color.classList.add("visually-hidden");
  color.setAttribute("type", "text");
  const colorPicker = el("input", {
    class: "page3-color-swatch",
    attrs: { type: "color", "aria-label": "어둠 색" },
    value: normalizeHexColor(cmd.color ?? "#000000"),
    dataset: { testid: "set-lighting-color-picker" },
  }) as HTMLInputElement;
  const transitionMs = numberInput(cmd.transitionMs ?? 0, "전환 시간", "set-lighting-transition-input");
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
        text: `암전 ${pct}%${ms > 0 ? ` · ${Math.round(ms / 100) / 10}초` : " · 바로"}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "0이면 낮처럼 밝고, 100%면 완전히 어둡습니다. 전환 시간이 있으면 서서히 바뀝니다.",
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
      "맵이 얼마나 어두운지와 어둠 색을 바꿉니다. 전환 시간이 있으면 서서히 바뀝니다.",
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
              "어둠 색",
              el("div", {
                class: "page3-color-row",
                children: [colorPicker, color],
              })
            ),
            fieldBlock("전환 시간", transitionStepper),
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
  const id = textInput(cmd.source.id, "빛 이름", "add-light-id-input");
  const anchor = segmentedSelect({
    options: ANCHOR_SEGMENTS,
    value: lightAnchorKind(cmd.source.at),
    testid: "add-light-anchor-kind-select",
    ariaLabel: "어디에 붙일지",
  });
  const eventId = textInput(
    cmd.source.at !== "player" && "eventId" in cmd.source.at ? cmd.source.at.eventId : "",
    "어느 이벤트",
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
  const radius = numberInput(cmd.source.radius, "크기", "add-light-radius-input");
  radius.setAttribute("min", "0");
  const radiusStepper = amountStepper(radius, { testidBase: "add-light-radius", min: 0 });
  const intensity = numberInput(cmd.source.intensity ?? 1, "밝기", "add-light-intensity-input");
  intensity.setAttribute("step", "0.05");
  intensity.setAttribute("min", "0");
  intensity.setAttribute("max", "1");
  const intensitySlider = el("input", {
    class: "page3-range-input",
    attrs: { type: "range", min: "0", max: "1", step: "0.05", "aria-label": "밝기" },
    value: String(clamp01(cmd.source.intensity ?? 1)),
    dataset: { testid: "add-light-intensity-slider" },
  }) as HTMLInputElement;
  const color = textInput(cmd.source.color ?? "", "빛 색", "add-light-color-input");
  const colorPicker = el("input", {
    class: "page3-color-swatch",
    attrs: { type: "color", "aria-label": "빛 색" },
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
  const eventField = fieldBlock("어느 이벤트", eventId, "add-light-event-field");
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
        ? "주인공"
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
        text: `${lightId} · ${where} · 크기 ${r} · 밝기 ${Math.round(power * 100)}%`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: flicker.select.value === "true" ? "깜빡임 켜짐" : "고정된 빛",
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
      "빛 켜기",
      "주인공이나 이벤트, 칸에 빛을 붙입니다. 크기·밝기·색·깜빡임을 정합니다.",
      "add-light-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("빛 이름", id),
            fieldBlock("어디에", anchor.root),
            eventField,
            posField,
            fieldBlock("크기", radiusStepper),
            fieldBlock(
              "밝기",
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
      { value: "false", key: "id", label: "하나만" },
    ] as const satisfies readonly SegmentOption<"true" | "false">[],
    value: cmd.all === true ? "true" : "false",
    testid: "remove-light-all-select",
    ariaLabel: "제거 범위",
  });
  const id = textInput(cmd.id ?? "", "어느 빛", "remove-light-id-input");
  const idField = fieldBlock("어느 빛", id, "remove-light-id-field");
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
    idField.style.display = all.select.value === "true" ? "none" : "";
  };

  const renderPreview = () => {
    const line =
      all.select.value === "true"
        ? "맵 위의 움직이는 빛을 모두 끕니다."
        : `그 빛을 끕니다.`;
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: all.select.value === "true" ? "빛 모두 끄기" : `빛 끄기 · ${id.value.trim() || "—"}`,
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
      "빛 끄기",
      "맵 위의 빛 하나 또는 전부를 끕니다.",
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
  const transitionMs = numberInput(cmd.transitionMs ?? 0, "전환 시간", "set-weather-transition-input");
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
        text: `${weatherLabel(weather)} · 강도 ${Math.round(power * 100)}%${ms > 0 ? ` · ${Math.round(ms / 100) / 10}초` : ""}`,
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
            fieldBlock("전환 시간", transitionStepper),
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
    "어느 이벤트",
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
    subtitleOf: (record) => record.scope === "allTargets" ? "여러 대상" : record.scope === "screen" ? "화면 전체" : "대상 하나",
  });
  // 애니메이션 표시면은 하나다: 고르는 곳과 재생되는 곳이 같은 표면 안에 있다.
  // (예전에는 intentCard "애니메이션 표시" + fieldBlock "애니메이션" + 가짜 ✦ 스테이지로
  //  같은 정체성이 세 번 나뉘어 있었다.)
  const preview = el("div", {
    class: "actor-m2-preview-body page3-anim-preview",
    dataset: { testid: "show-animation-preview" },
  });
  const playHost = el("div", { class: "page3-anim-play-host" });
  const surface = el("section", {
    class: "actor-m2-preview page3-command-preview page3-anim-surface",
    dataset: { testid: "show-animation-surface" },
    children: [
      el("div", {
        class: "page3-anim-surface-head",
        children: [
          el("h4", {
            class: "page3-anim-surface-title",
            text: "애니메이션",
            dataset: { testid: "show-animation-surface-title" },
          }),
          playHost,
        ],
      }),
      animation.root,
      preview,
    ],
  });
  const eventField = fieldBlock("어느 이벤트", eventId, "show-animation-event-field");
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

  // 재생은 선택한 애니메이션이 바뀌었을 때만 다시 시작한다 — 좌표를 한 글자 칠 때마다 리셋되면 볼 수 없다.
  let stagedAnimationId: string | undefined;
  const stageHost = el("div", { class: "page3-anim-stage-host" });
  const caption = el("p", { class: "actor-m2-preview-line" });
  const note = el("p", { class: "actor-m2-preview-note" });
  preview.append(stageHost, caption, note);

  const renderStage = () => {
    const anim = project.database.battleAnimations.find((entry) => entry.id === animation.select.value);
    const stage = el("div", {
      class: "page3-preview-stage page3-preview-animation page3-anim-stage",
      dataset: { testid: "show-animation-preview-stage" },
    });
    const source = showAnimationPlaybackSource(anim, project);
    if (source) {
      const cells = el("div", {
        class: "db-animation-stage-cells page3-anim-cells",
        dataset: { testid: "show-animation-frame-layer" },
      });
      stage.append(el("span", { class: "page3-preview-stage-label", text: "재생" }), cells);
      renderShowAnimationFrame(cells, source, 0);
      if (source.frames.length > 1) {
        const play = el("button", {
          class: "btn small page3-anim-play",
          text: "▶ 재생",
          attrs: { type: "button", "aria-pressed": "false", title: "선택한 애니메이션을 한 번 재생합니다." },
          dataset: { testid: "show-animation-play" },
        }) as HTMLButtonElement;
        playHost.replaceChildren(play);
        // 열릴 때 1회 자동 재생. 버튼은 그 뒤 다시 켜고 끄는 토글이다.
        bindShowAnimationPlayback(play, stage, cells, source);
      } else {
        // 프레임이 하나면 런타임도 정지 화면이다. 재생 버튼을 주면 거짓말이 된다.
        playHost.replaceChildren();
        stage.append(
          el("span", {
            class: "page3-anim-stage-note",
            text: "프레임 1장 · 런타임도 정지 화면",
            dataset: { testid: "show-animation-static-frame" },
          })
        );
      }
    } else {
      playHost.replaceChildren();
      renderShowAnimationFallback(stage, anim?.name ?? "없는 애니메이션");
    }
    stageHost.replaceChildren(stage);
    stagedAnimationId = animation.select.value;
  };

  const renderCaption = () => {
    const anim = project.database.battleAnimations.find((entry) => entry.id === animation.select.value);
    const where =
      target.select.value === "player"
        ? "플레이어"
        : target.select.value === "event"
          ? `이벤트 ${eventId.value.trim() || "(현재/미선택)"}`
          : `(${parseInt(x.value, 10) || 0}, ${parseInt(y.value, 10) || 0})`;
    caption.textContent = `${anim?.name ?? (animation.select.value || "(선택 없음)")} · ${where}`;
    note.textContent =
      wait.select.value === "true" ? "재생이 끝날 때까지 대기" : "대기 없이 다음 명령 진행";
  };

  const renderPreview = () => {
    if (stagedAnimationId !== animation.select.value) renderStage();
    renderCaption();
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
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("어디에", target.root),
            eventField,
            posField,
            fieldBlock("완료 대기", wait.root),
          ],
        }),
        surface,
      ],
    })
  );
  return wrap;
}

/**
 * 동영상 재생 본문. 표시면은 하나다 — 고르는 픽커와 진짜 <video> 재생면이 한 표면 안에 있다.
 * 프로젝트에 동영상이 없으면 번들 샘플을 그 자리에서 재생해 "동영상이 뭘 하는 명령인지"를 보여 준다.
 */
export function playMovieBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "playMovie" }>
): HTMLElement {
  const wrap = shell("page3-command-body actor-m2-command-body", "play-movie-command-body");
  const project = store.getCurrent();
  const movies = listMovieResources(project);
  const resource = recordPickerWithPreview({
    records: movies,
    selectedId: cmd.resourceId,
    placeholder: "동영상 선택",
    testid: "play-movie-resource-select",
    subtitleOf: (record) => record.id,
  });
  const wait = segmentedSelect({
    options: BOOL_SEGMENTS,
    value: cmd.wait === true ? "true" : "false",
    testid: "play-movie-wait-select",
    ariaLabel: "완료 대기",
  });
  const skippable = segmentedSelect({
    options: BOOL_SEGMENTS,
    value: cmd.skippable === true ? "true" : "false",
    testid: "play-movie-skippable-select",
    ariaLabel: "스킵 허용",
  });

  const stageHost = el("div", { class: "page3-movie-stage-host" });
  const caption = el("p", { class: "actor-m2-preview-line" });
  const note = el("p", { class: "actor-m2-preview-note" });
  const preview = el("div", {
    class: "actor-m2-preview-body page3-movie-preview",
    dataset: { testid: "play-movie-preview" },
    children: [stageHost, caption, note],
  });
  const surface = el("section", {
    class: "actor-m2-preview page3-command-preview page3-movie-surface",
    dataset: { testid: "play-movie-surface" },
    children: [
      el("div", {
        class: "page3-anim-surface-head",
        children: [
          el("h4", {
            class: "page3-anim-surface-title",
            text: "동영상",
            dataset: { testid: "play-movie-surface-title" },
          }),
        ],
      }),
      resource.root,
      preview,
    ],
  });

  // 재생면은 리소스가 바뀔 때만 다시 만든다 — 토글을 누를 때마다 재생이 처음으로 돌아가면 볼 수 없다.
  let stagedResourceId: string | undefined;
  const renderStage = (): void => {
    const { stage } = renderMoviePreviewStage(resolveMovieResourceUrl(resource.select.value, project));
    stageHost.replaceChildren(stage);
    stagedResourceId = resource.select.value;
  };

  const renderCaption = (): void => {
    const selected = movies.find((entry) => entry.id === resource.select.value);
    caption.textContent = selected
      ? `${selected.name} 재생`
      : movies.length === 0
        ? "프로젝트에 동영상 리소스가 없습니다 — 리소스 관리자에서 동영상을 올린 뒤 고르세요"
        : "(동영상 선택 없음)";
    note.textContent = [
      wait.select.value === "true" ? "재생이 끝날 때까지 대기" : "대기 없이 다음 명령 진행",
      skippable.select.value === "true" ? "플레이어가 건너뛸 수 있음" : "건너뛰기 불가",
    ].join(" · ");
  };

  const renderPreview = (): void => {
    if (stagedResourceId !== resource.select.value) renderStage();
    renderCaption();
  };

  const commit = (): void => {
    context.actions.replaceCommand(context.path, {
      kind: "playMovie",
      resourceId: resource.select.value,
      ...(wait.select.value === "true" ? { wait: true } : {}),
      ...(skippable.select.value === "true" ? { skippable: true } : {}),
    });
    renderPreview();
  };

  resource.select.addEventListener("change", commit);
  wait.select.addEventListener("change", commit);
  skippable.select.addEventListener("change", commit);

  renderPreview();
  wrap.append(
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [fieldBlock("완료 대기", wait.root), fieldBlock("스킵 허용", skippable.root)],
        }),
        surface,
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
  const pictureId = textInput(cmd.pictureId, "화면 자리", "show-picture-id-input");
  const resourceId = textInput(cmd.resourceId, "그림", "show-picture-resource-input");
  resourceId.classList.add("visually-hidden");
  const resourceName = el("span", {
    class: "page3-resource-name",
    text: humanizePictureId(cmd.resourceId),
    dataset: { testid: "show-picture-resource-name" },
  });
  const syncResourceName = (): void => {
    resourceName.textContent = humanizePictureId(resourceId.value);
  };
  resourceId.addEventListener("input", syncResourceName);
  resourceId.addEventListener("change", syncResourceName);
  const x = numberInput(cmd.x, "X 좌표", "show-picture-x-input");
  const y = numberInput(cmd.y, "Y 좌표", "show-picture-y-input");
  // 런타임은 확대·투명도·회전·전환시간을 모두 지원하는데(pictures/pictureTween.ts) 폼에는
  // 칸이 없어서, 감독이 "60% 로 줄여 15도 기울여 페이드인" 을 하려면 AI 툴이나 JSON
  // 손편집으로 우회해야 했다. 왕복 1회가 폼 입력 1회로 줄어든다.
  const scale = numberInput(cmd.scale ?? 100, "확대율(%) — 100이 원본", "show-picture-scale-input");
  const opacity = numberInput(opacityToPercent(cmd.opacity ?? 255), "불투명도(%)", "show-picture-opacity-input");
  const rotation = numberInput(cmd.rotation ?? 0, "회전(도)", "show-picture-rotation-input");
  const durationMs = numberInput(cmd.durationMs ?? 0, "전환 시간 — 0이면 즉시", "show-picture-duration-input");
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "show-picture-preview" },
  });
  const presets = el("div", {
    class: "actor-m2-presets",
    dataset: { testid: "show-picture-position-presets" },
  });

  /** 범위 밖 입력이 런타임까지 새지 않게 폼에서 접는다. 런타임 클램프와 같은 경계다. */
  const intInRange = (input: HTMLInputElement, fallback: number, min: number, max: number): number => {
    const parsed = parseInt(input.value, 10);
    return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
  };

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      kind: "showPicture",
      pictureId: pictureId.value.trim() || "pic1",
      resourceId: resourceId.value.trim(),
      x: parseInt(x.value, 10) || 0,
      y: parseInt(y.value, 10) || 0,
      scale: intInRange(scale, 100, 1, 2000),
      opacity: (() => {
        const nextPercent = intInRange(opacity, 100, 0, 100);
        const current = cmd.opacity ?? 255;
        return opacityToPercent(current) === nextPercent ? current : percentToOpacity(nextPercent);
      })(),
      // 회전은 한 바퀴를 넘겨도 뜻이 통하므로 접지 않고 그대로 싣는다.
      rotation: parseInt(rotation.value, 10) || 0,
      durationMs: intInRange(durationMs, 0, 0, 60_000),
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
      dataset: { testid: "show-picture-preview-marker" },
    });
    marker.style.left = `${clampPct((px / 320) * 100)}%`;
    marker.style.top = `${clampPct((py / 240) * 100)}%`;
    // 런타임은 확대·회전을 transform 으로, 투명도를 opacity 로 적용한다(runtimeDom.applyPictureTransform).
    // 프리뷰가 같은 순서로 걸어야 감독이 폼에서 본 것과 게임에서 보는 것이 일치한다.
    const previewScale = (parseInt(scale.value, 10) || 100) / 100;
    const previewRotation = parseInt(rotation.value, 10) || 0;
    const previewOpacityPercent = intInRange(opacity, 100, 0, 100);
    marker.style.transform = `scale(${previewScale}) rotate(${previewRotation}deg)`;
    marker.style.opacity = String(clampPct(previewOpacityPercent) / 100);
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
          text: pictureSlotCaption(pictureId.value),
        })
      );
    }
    stage.append(marker);
    preview.replaceChildren(
      stage,
      el("p", {
        class: "actor-m2-preview-line",
        text:
          `그림 · 위치 (${px}, ${py})` +
          ` · ${parseInt(scale.value, 10) || 100}%` +
          ` · 불투명도 ${parseInt(opacity.value, 10) || 0}%` +
          (previewRotation ? ` · ${previewRotation}°` : "") +
          ((parseInt(durationMs.value, 10) || 0) ? ` · ${parseInt(durationMs.value, 10)}ms` : ""),
      }),
      el("p", {
        class: "actor-m2-preview-note",
        // 런타임은 left/top = x/y 에 transform-origin: top left 다(runtime/pictures.css).
        // 예전 문구는 "중심 앵커" 라고 적혀 있었지만 실제와 달랐다.
        text: rid ? `${humanizePictureId(rid)} · 기준점은 왼쪽 위` : "그림을 선택하세요. 기준점은 왼쪽 위입니다.",
      })
    );
  };

  for (const control of [pictureId, resourceId, x, y, scale, opacity, rotation, durationMs]) {
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
          title: "그림 선택",
          currentId: resourceId.value.trim(),
          onConfirm: (result) => {
            resourceId.value = result.resourceId;
            syncResourceName();
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
      "화면에 그림을 올립니다. 화면 자리로 나중에 옮기거나 지울 수 있습니다.",
      "show-picture-intent"
    ),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [
            fieldBlock("화면 자리", pictureId),
            fieldBlock(
              "그림",
              el("div", {
                class: "page3-resource-row",
                children: [resourceName, resourceId, pick],
              })
            ),
            fieldBlock(
              "AI로 그림 만들기",
              showPictureAiField({
                queueKey: `show-picture:${context.path.join(".")}`,
                onInserted: (id) => {
                  resourceId.value = id;
                  syncResourceName();
                  commit();
                },
              }),
            ),
            fieldBlock(
              "위치",
              el("div", { class: "actor-m2-inline page3-coord-row", children: [x, y] })
            ),
            fieldBlock("위치 프리셋", presets),
            fieldBlock(
              "크기 · 불투명도",
              el("div", { class: "actor-m2-inline page3-coord-row", children: [scale, opacity] })
            ),
            el("details", {
              class: "page3-more-fields",
              attrs: {
                ...(Number(rotation.value) || Number(durationMs.value) ? { open: "" } : {}),
              },
              children: [
                el("summary", { text: "회전 · 서서히" }),
                fieldBlock(
                  "회전 · 서서히",
                  el("div", { class: "actor-m2-inline page3-coord-row", children: [rotation, durationMs] })
                ),
              ],
            }),
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
  const pictureId = textInput(cmd.pictureId, "화면 자리", "erase-picture-id-input");
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
      el("p", { class: "actor-m2-preview-line", text: `${pictureSlotCaption(id)} 지우기` }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "화면에 떠 있는 그 자리의 그림을 지웁니다.",
      })
    );
  };

  pictureId.addEventListener("change", commit);
  pictureId.addEventListener("input", renderPreview);
  renderPreview();
  wrap.append(
    intentCard("그림 지우기", "화면에 떠 있는 그림을 화면 자리로 지웁니다.", "erase-picture-intent"),
    el("div", {
      class: "actor-m2-layout page3-command-layout",
      children: [
        el("div", {
          class: "actor-m2-main page3-command-main",
          children: [fieldBlock("화면 자리", pictureId)],
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
    ariaLabel: "레이어",
  });
  const x = numberInput(cmd.x, "X 좌표", "change-tile-x-input");
  const y = numberInput(cmd.y, "Y 좌표", "change-tile-y-input");
  const tile = numberInput(cmd.tile, "바꿀 그림", "change-tile-tile-input");
  const tileStepper = amountStepper(tile, { testidBase: "change-tile-tile", min: -1 });
  const preview = el("div", {
    class: "actor-m2-preview page3-command-preview",
    dataset: { testid: "change-tile-preview" },
  });
  // 초보자 계약(2026-08-27 감사): 텍스트만 있던 타일 변경에 실제 맵 미리보기를 붙인다.
  const mapCanvas = el("canvas", {
    dataset: { testid: "change-tile-map-canvas" },
  }) as HTMLCanvasElement;
  const mapCanvasHost = el("div", {
    class: "page3-command-body change-tile-map-preview",
    dataset: { testid: "change-tile-map-preview" },
  });
  let canvasVersion = 0;
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
    const layerLabel = layer.select.value === "upper" ? "덧그림" : "바닥";
    const tx = parseInt(x.value, 10) || 0;
    const ty = parseInt(y.value, 10) || 0;
    const parsedTile = parseInt(tile.value, 10);
    const tileNo = Number.isFinite(parsedTile) ? parsedTile : 0;
    for (const btn of presets.querySelectorAll<HTMLElement>("[data-testid^='change-tile-preset-']")) {
      const id = btn.dataset.testid ?? "";
      const selected =
        (id.endsWith("-clear") && tileNo < 0) ||
        (id.endsWith("-zero") && tileNo === 0) ||
        (id.endsWith("-floor") && tileNo === 1);
      btn.classList.toggle("is-active", selected);
    }
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: `${mapName} · ${layerLabel} (${tx}, ${ty}) → ${tileNo < 0 ? "비움" : tileNo === 0 ? "빈 바닥" : tileNo === 1 ? "기본 바닥" : `그림 ${tileNo}`}`,
      }),
      mapCanvasHost,
      el("p", {
        class: "actor-m2-preview-note",
        text: tileNo < 0 ? "음수면 그 칸을 비웁니다." : "맵 위 그 칸의 타일을 바로 바꿉니다.",
      })
    );
    renderCanvas(mapId ?? "", tx, ty);
  };

  const renderCanvas = (mapId: string, tx: number, ty: number) => {
    const version = ++canvasVersion;
    const selection: TransferPreviewSelection = { x: tx, y: ty, zoom: 1 };
    const fit = () => ({ maxWidth: Math.max(1, mapCanvasHost.clientWidth - 8), maxHeight: Math.max(1, Math.min(280, mapCanvasHost.clientHeight || 280)) });
    const isCurrent = () => version === canvasVersion;
    void drawTransferMapPreview({ canvas: mapCanvas, project, mapId, selection, fitDisplay: fit(), isCurrent }).catch(() => undefined);
  };

  for (const preset of [
    { id: "clear", label: "비우기", tile: -1 },
    { id: "zero", label: "빈 바닥", tile: 0 },
    { id: "floor", label: "기본 바닥", tile: 1 },
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
      "맵 한 칸의 바닥이나 덧그림을 바꿉니다. 비우기를 누르면 그 칸을 지웁니다.",
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
            fieldBlock("바꿀 그림", presets),
            fieldBlock("번호", tileStepper),
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

function humanizePictureId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "(그림 선택)";
  const slug = trimmed.replace(/^easyrpg-picture-/, "").replace(/^easyrpg-/, "").replace(/[-_]+/g, " ");
  const named: Record<string, string> = {
    cloud: "구름",
    "picture cloud": "구름",
  };
  const key = slug.toLowerCase();
  if (named[key]) return named[key];
  if (/[가-힣]/.test(slug)) return slug;
  return slug;
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
