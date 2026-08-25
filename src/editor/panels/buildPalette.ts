import { editorState } from "@/editor/editorState";
import {
  applyBuildPalettePrimitive,
  DEFAULT_HOUSE_KIT_ID,
  DEFAULT_HOUSE_SHAPE_ID,
  HOUSE_KIT_CARDS,
  HOUSE_SHAPE_PRESETS,
  type BuildHouseShapeId,
  type BuildPalettePrimitive,
  type BuildPaletteApplyOptions,
} from "@/editor/panels/buildPaletteCore";
import type { HouseKitId } from "@/editor/houseKit";
import { openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

let buildPaletteEnabled = false;
export const BUILD_PALETTE_VISIBILITY_EVENT = "oprn:build-palette-visibility";

const PRIMITIVES: readonly { readonly id: BuildPalettePrimitive | "ai"; readonly label: string; readonly title: string }[] = [
  { id: "house", label: "🏠집", title: "선택한 집 키트와 형태로 집을 시공" },
  { id: "village", label: "🏘️마을", title: "선택 영역 안에 집 키트 기반 마을을 시공" },
  { id: "river", label: "🌊강", title: "선택 영역을 물로 채우기" },
  { id: "path", label: "🛣️길", title: "선택 영역 중앙에 길 놓기" },
  { id: "roof", label: "🔺지붕", title: "선택 영역을 지붕 줄로 채우기" },
  { id: "npc", label: "🧍NPC", title: "선택 영역 중앙에 NPC 배치" },
  { id: "tree", label: "🌲나무", title: "선택 영역에 나무 산포" },
  { id: "prop", label: "🪑소품", title: "선택 영역에 소품 산포" },
  { id: "ai", label: "✨AI로 채우기", title: "기존 영역 AI 작업 경로로 보내기" },
];

const HOUSE_SHAPE_STORAGE_KEY = "oprn:build-palette:house-shape";
const HOUSE_KIT_STORAGE_KEY = "oprn:build-palette:house-kit";
const HOUSE_OPTION_STORAGE_KEYS = {
  doorEvent: "oprn:build-palette:door-event",
  interior: "oprn:build-palette:interior",
  windows: "oprn:build-palette:windows",
} as const;

export type HouseOptionKey = keyof typeof HOUSE_OPTION_STORAGE_KEYS;

export function renderBuildPaletteToggle(): HTMLElement {
  return el("button", {
    class: "oprn-tool-button build-palette-toggle" + (buildPaletteEnabled ? " active" : ""),
    text: "🏗️건축▾",
    attrs: {
      type: "button",
      title: "선택 영역 건축 팔레트",
      "aria-label": "선택 영역 건축 팔레트",
      "aria-pressed": String(buildPaletteEnabled),
    },
    dataset: { testid: "build-palette-toggle" },
    on: {
      click: (event) => {
        const next = !buildPaletteEnabled;
        const button = event?.currentTarget as HTMLElement | null;
        button?.classList?.toggle?.("active", next);
        button?.setAttribute?.("aria-pressed", String(next));
        setBuildPaletteEnabled(next);
      },
    },
  });
}

// 건축 모드 on/off. 켜면 곧바로 영역 선택 툴로 전환해 사용자가 바로 드래그로 영역을 지정할 수 있게 하고,
// 끄면 그리기 툴로 되돌린다. (이 툴 전환이 없으면 건축을 눌러도 그리기 상태라 "반응 없음"으로 보인다.)
export function setBuildPaletteEnabled(enabled: boolean): void {
  buildPaletteEnabled = enabled;
  editorState.set({ tool: enabled ? "select" : "paint" });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BUILD_PALETTE_VISIBILITY_EVENT));
}

export function isBuildPaletteEnabled(): boolean {
  return buildPaletteEnabled;
}

export function renderBuildPalettePopup(
  openRegionTask: typeof openRegionTaskModal = openRegionTaskModal,
): HTMLElement | null {
  if (!buildPaletteEnabled) return null;
  const selection = editorState.get().selection;
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  if (!selection || selection.mapId !== mapId || !project.maps[selection.mapId]) return null;

  const title = el("div", {
    class: "build-palette-title",
    text: `(${selection.x},${selection.y}) ${selection.width}×${selection.height}`,
    dataset: { testid: "build-palette-selection-label" },
  });
  const selectedHouseShape = getSelectedHouseShapeId();
  const selectedHouseKit = getSelectedHouseKitId();
  const houseOptions = getBuildPaletteHouseOptions();
  const shapeButtons = HOUSE_SHAPE_PRESETS.map((preset) =>
    el("button", {
      class: "build-house-preset-button" + (preset.id === selectedHouseShape ? " active" : ""),
      text: preset.name,
      attrs: {
        type: "button",
        "aria-pressed": String(preset.id === selectedHouseShape),
        title: `${preset.name} 형태 선택`,
      },
      dataset: { testid: `build-shape-${preset.id}` },
      on: {
        click: (event) => {
          setSelectedHouseShapeId(preset.id);
          const group = (event.currentTarget as HTMLElement).parentElement;
          group?.querySelectorAll<HTMLElement>(".build-house-preset-button").forEach((button) => {
            const active = button.dataset.testid === `build-shape-${preset.id}`;
            if (active) button.classList.add("active");
            else button.classList.remove("active");
            button.setAttribute("aria-pressed", String(active));
          });
        },
      },
    })
  );
  const kitButtons = HOUSE_KIT_CARDS.map((kit) =>
    el("button", {
      class: "build-house-kit-button" + (kit.id === selectedHouseKit ? " active" : ""),
      text: kit.name,
      attrs: {
        type: "button",
        "aria-pressed": String(kit.id === selectedHouseKit),
        title: `${kit.name} 키트 선택`,
      },
      dataset: { testid: `build-kit-${kit.id}` },
      on: {
        click: (event) => {
          setSelectedHouseKitId(kit.id);
          const group = (event.currentTarget as HTMLElement).parentElement;
          group?.querySelectorAll<HTMLElement>(".build-house-kit-button").forEach((button) => {
            const active = button.dataset.testid === `build-kit-${kit.id}`;
            if (active) button.classList.add("active");
            else button.classList.remove("active");
            button.setAttribute("aria-pressed", String(active));
          });
        },
      },
    })
  );
  const optionButtons = ([
    ["doorEvent", "문 이벤트"],
    ["interior", "내부"],
    ["windows", "창문"],
  ] as const).map(([key, label]) =>
    el("button", {
      class: "build-house-option-button" + (houseOptions[key] ? " active" : ""),
      text: label,
      attrs: {
        type: "button",
        "aria-pressed": String(houseOptions[key]),
        title: `${label} 옵션`,
      },
      dataset: { testid: `build-option-${optionTestId(key)}` },
      on: {
        click: (event) => {
          const button = event.currentTarget as HTMLElement;
          const active = button.getAttribute("aria-pressed") !== "true";
          setBuildPaletteHouseOption(key, active);
          if (active) button.classList.add("active");
          else button.classList.remove("active");
          button.setAttribute("aria-pressed", String(active));
        },
      },
    })
  );
  const buttons = PRIMITIVES.map((primitive) =>
    el("button", {
      class: "build-palette-button",
      text: primitive.label,
      attrs: { type: "button", title: primitive.title, "aria-label": primitive.title },
      dataset: { testid: `build-palette-${primitive.id}` },
      on: {
        click: () => {
          if (primitive.id === "ai") {
            openBuildPaletteAiFill(selection, openRegionTask);
            return;
          }
          if (primitive.id === "house" || primitive.id === "village") {
            openBuildPaletteAiConstruction(selection, primitive.id, openRegionTask);
            return;
          }
          const result = applyBuildPalettePrimitive(selection, primitive.id, buildPaletteApplyOptions());
          toast(result.ok ? result.summary : `건축 팔레트 실패: ${result.summary}`, result.ok ? "ok" : "error");
        },
      },
    })
  );
  return el("div", {
    class: "build-palette-popup",
    attrs: { role: "group", "aria-label": "건축 팔레트" },
    dataset: { testid: "build-palette-popup" },
    children: [
      title,
      el("div", { class: "build-house-preset-group", attrs: { role: "group", "aria-label": "집 형태" }, children: shapeButtons }),
      el("div", { class: "build-house-kit-group", attrs: { role: "group", "aria-label": "집 키트" }, children: kitButtons }),
      el("div", { class: "build-house-option-group", attrs: { role: "group", "aria-label": "집 옵션" }, children: optionButtons }),
      el("div", { class: "build-palette-grid", children: buttons }),
    ],
  });
}

export function getSelectedHouseShapeId(): BuildHouseShapeId {
  const storage = globalThis.localStorage;
  if (!storage) return DEFAULT_HOUSE_SHAPE_ID;
  const stored = storage.getItem(HOUSE_SHAPE_STORAGE_KEY);
  return HOUSE_SHAPE_PRESETS.some((preset) => preset.id === stored) ? stored as BuildHouseShapeId : DEFAULT_HOUSE_SHAPE_ID;
}

export function setSelectedHouseShapeId(id: BuildHouseShapeId): void {
  globalThis.localStorage?.setItem(HOUSE_SHAPE_STORAGE_KEY, id);
}

export function getSelectedHouseKitId(): HouseKitId {
  const storage = globalThis.localStorage;
  if (!storage) return DEFAULT_HOUSE_KIT_ID;
  const stored = storage.getItem(HOUSE_KIT_STORAGE_KEY);
  return HOUSE_KIT_CARDS.some((kit) => kit.id === stored) ? stored as HouseKitId : DEFAULT_HOUSE_KIT_ID;
}

export function setSelectedHouseKitId(id: HouseKitId): void {
  globalThis.localStorage?.setItem(HOUSE_KIT_STORAGE_KEY, id);
}

export function getBuildPaletteHouseOptions(): Required<Pick<BuildPaletteApplyOptions, "doorEvent" | "interior" | "windows">> {
  return {
    doorEvent: storedBoolean("doorEvent", true),
    interior: storedBoolean("interior", true),
    windows: storedBoolean("windows", true),
  };
}

export function setBuildPaletteHouseOption(key: HouseOptionKey, value: boolean): void {
  globalThis.localStorage?.setItem(HOUSE_OPTION_STORAGE_KEYS[key], value ? "true" : "false");
}

function buildPaletteApplyOptions(): BuildPaletteApplyOptions {
  const houseOptions = getBuildPaletteHouseOptions();
  return {
    houseShapeId: getSelectedHouseShapeId(),
    houseKitId: getSelectedHouseKitId(),
    doorEvent: houseOptions.doorEvent,
    interior: houseOptions.interior,
    windows: houseOptions.windows,
  };
}

function storedBoolean(key: HouseOptionKey, fallback: boolean): boolean {
  const stored = globalThis.localStorage?.getItem(HOUSE_OPTION_STORAGE_KEYS[key]);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
}

function optionTestId(key: HouseOptionKey): string {
  return key === "doorEvent" ? "door-event" : key;
}

function openBuildPaletteAiFill(
  selection: NonNullable<ReturnType<typeof editorState.get>["selection"]>,
  openRegionTask: typeof openRegionTaskModal,
): void {
  const region = { x: selection.x, y: selection.y, width: selection.width, height: selection.height };
  const prompt = [
    `선택 영역 mapId=${selection.mapId}, x=${selection.x}, y=${selection.y}, width=${selection.width}, height=${selection.height} 안만 작업하세요.`,
    "먼저 set_build_spec으로 이 사각 영역을 outline/assets에 기록한 뒤, 모든 공간 쓰기 툴은 이 영역 안에서만 실행하세요.",
    "영역을 자연스럽게 채워 주세요.",
  ].join("\n");
  openRegionTask({ mapId: selection.mapId, region, initialInstruction: prompt, autoRun: false });
}

function openBuildPaletteAiConstruction(
  selection: NonNullable<ReturnType<typeof editorState.get>["selection"]>,
  primitive: "house" | "village",
  openRegionTask: typeof openRegionTaskModal,
): void {
  const region = { x: selection.x, y: selection.y, width: selection.width, height: selection.height };
  const initialInstruction = primitive === "house"
    ? "선택 영역 안에 야외 집 한 채를 지어 주세요. 주변 지형과 출입 경로를 보존하고, 완성 전 미리보기를 보여 주세요."
    : "선택 영역 안에 여러 집과 연결된 길을 갖춘 작은 마을을 만들어 주세요. 주변 지형과 출입 경로를 보존하고, 완성 전 미리보기를 보여 주세요.";
  openRegionTask({
    autoRun: true,
    initialInstruction,
    mapId: selection.mapId,
    region,
  });
}
