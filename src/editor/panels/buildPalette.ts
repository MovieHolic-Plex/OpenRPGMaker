import { editorState } from "@/editor/editorState";
import {
  applyBuildPalettePrimitive,
  DEFAULT_HOUSE_PRESET_ID,
  HOUSE_PRESETS,
  type BuildPalettePrimitive,
} from "@/editor/panels/buildPaletteCore";
import type { HousePresetId } from "@/editor/panels/housePlan";
import { openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

let buildPaletteEnabled = false;
export const BUILD_PALETTE_VISIBILITY_EVENT = "rpgzzu:build-palette-visibility";

const PRIMITIVES: readonly { readonly id: BuildPalettePrimitive | "ai"; readonly label: string; readonly title: string }[] = [
  { id: "house", label: "🏠집", title: "선택한 집 프리셋으로 벽, 문, 지붕을 한 번에 시공" },
  { id: "village", label: "🏘️마을", title: "선택 영역에 집을 먼저 배치한 뒤 문 앞 길을 연결" },
  { id: "river", label: "🌊강", title: "선택 영역을 물로 채우기" },
  { id: "path", label: "🛣️길", title: "선택 영역 중앙에 길 놓기" },
  { id: "roof", label: "🔺지붕", title: "선택 영역을 지붕 줄로 채우기" },
  { id: "npc", label: "🧍NPC", title: "선택 영역 중앙에 NPC 배치" },
  { id: "tree", label: "🌲나무", title: "선택 영역에 나무 산포" },
  { id: "prop", label: "🪑소품", title: "선택 영역에 소품 산포" },
  { id: "ai", label: "✨AI로 채우기", title: "기존 영역 AI 작업 경로로 보내기" },
];

const HOUSE_PRESET_STORAGE_KEY = "rpg-zzu:build-palette:house-preset";

export function renderBuildPaletteToggle(): HTMLElement {
  return el("button", {
    class: "rm2k3-tool-button build-palette-toggle" + (buildPaletteEnabled ? " active" : ""),
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

export function renderBuildPalettePopup(): HTMLElement | null {
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
  const selectedHousePreset = getSelectedHousePresetId();
  const presetButtons = HOUSE_PRESETS.map((preset) =>
    el("button", {
      class: "build-house-preset-button" + (preset.id === selectedHousePreset ? " active" : ""),
      text: preset.name,
      attrs: {
        type: "button",
        "aria-pressed": String(preset.id === selectedHousePreset),
        title: `${preset.name} 프리셋 선택`,
      },
      dataset: { testid: `build-house-preset-${preset.id}` },
      on: {
        click: (event) => {
          setSelectedHousePresetId(preset.id);
          const group = (event.currentTarget as HTMLElement).parentElement;
          group?.querySelectorAll<HTMLElement>(".build-house-preset-button").forEach((button) => {
            const active = button.dataset.testid === `build-house-preset-${preset.id}`;
            if (active) button.classList.add("active");
            else button.classList.remove("active");
            button.setAttribute("aria-pressed", String(active));
          });
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
            openBuildPaletteAiFill(selection);
            return;
          }
          const result = applyBuildPalettePrimitive(selection, primitive.id, { housePresetId: getSelectedHousePresetId() });
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
      el("div", { class: "build-house-preset-group", attrs: { role: "group", "aria-label": "집 프리셋" }, children: presetButtons }),
      el("div", { class: "build-palette-grid", children: buttons }),
    ],
  });
}

export function getSelectedHousePresetId(): HousePresetId {
  const storage = globalThis.localStorage;
  if (!storage) return DEFAULT_HOUSE_PRESET_ID;
  const stored = storage.getItem(HOUSE_PRESET_STORAGE_KEY);
  return HOUSE_PRESETS.some((preset) => preset.id === stored) ? stored as HousePresetId : DEFAULT_HOUSE_PRESET_ID;
}

export function setSelectedHousePresetId(id: HousePresetId): void {
  globalThis.localStorage?.setItem(HOUSE_PRESET_STORAGE_KEY, id);
}

function openBuildPaletteAiFill(selection: NonNullable<ReturnType<typeof editorState.get>["selection"]>): void {
  const region = { x: selection.x, y: selection.y, width: selection.width, height: selection.height };
  const prompt = [
    `선택 영역 mapId=${selection.mapId}, x=${selection.x}, y=${selection.y}, width=${selection.width}, height=${selection.height} 안만 작업하세요.`,
    "먼저 set_build_spec으로 이 사각 영역을 outline/assets에 기록한 뒤, 모든 공간 쓰기 툴은 이 영역 안에서만 실행하세요.",
    "영역을 자연스럽게 채워 주세요.",
  ].join("\n");
  openRegionTaskModal({ mapId: selection.mapId, region, initialInstruction: prompt, autoRun: false });
}
