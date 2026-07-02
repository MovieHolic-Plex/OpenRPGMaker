import { textControl } from "@/editor/panels/databaseControls";
import { renderTilesetCheckerSummary } from "@/editor/panels/tilesetCheckerSummary";
import {
  getTilesetMetadataEditMode,
  renderTilesetMetadataEditor,
  setTilesetMetadataEditMode,
} from "@/editor/panels/tilesetMetadataEditor";
import { openTilesetSettingsModal } from "@/editor/panels/tilesetPassageModal";
import { store } from "@/project/store";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type DisabledButtonSpec = {
  readonly extraClass?: string;
  readonly label: string;
  readonly testid: string;
  readonly title: string;
};

type ModeButtonSpec = {
  readonly activeMode: ReturnType<typeof getTilesetMetadataEditMode>;
  readonly label: string;
  readonly mode: ReturnType<typeof getTilesetMetadataEditMode>;
  readonly rerender: () => void;
};

const TERRAIN_NAMES = [
  "초원",
  "숲",
  "사막",
  "황무지",
  "독 늪",
  "눈",
  "눈: 숲",
  "대미지 바닥",
  "바다: 해안",
  "바다: 외해",
] as const;

export function renderTilesetEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("section", {
    class: "tileset-db-editor simplified rm2k3-tileset-editor",
    children: [
      renderTilesetProperties(tileset, rerender),
      el("div", {
        class: "rm2k3-tileset-main",
        children: [renderTilesetMetadataEditor(tileset, rerender), renderTerrainPanel(tileset, rerender)],
      }),
    ],
  });
}

function renderTilesetProperties(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-properties rm2k3-tileset-properties",
    children: [
      el("fieldset", {
        class: "rm2k3-db-fieldset rm2k3-tileset-name-field",
        dataset: { testid: "tileset-rm2k3-name" },
        children: [el("legend", { text: "이름" }), textControl("", tileset.name, (value) => updateTilesetName(tileset.id, value))],
      }),
      el("fieldset", {
        class: "rm2k3-db-fieldset rm2k3-tileset-graphic-field",
        dataset: { testid: "tileset-rm2k3-graphic" },
        children: [
          el("legend", { text: "타일셋 그래픽" }),
          el("div", { class: "rm2k3-tileset-graphic-value", text: tileset.image.id }),
          disabledButton({
            extraClass: "rm2k3-browse-button",
            label: "...",
            testid: "tileset-rm2k3-graphic-browse",
            title: "타일셋 그래픽 교체는 리소스 관리자에서 처리합니다.",
          }),
        ],
      }),
      el("div", {
        class: "tileset-db-layer-tabs rm2k3-tileset-layer-tabs",
        dataset: { testid: "tileset-rm2k3-layer-tabs" },
        children: [
          disabledButton({
            extraClass: "active",
            label: "하위 레이어",
            testid: "tileset-rm2k3-layer-lower",
            title: "현재 타일셋 표시는 하위/상위 레이어를 함께 보여줍니다.",
          }),
          disabledButton({
            label: "상위 레이어",
            testid: "tileset-rm2k3-layer-upper",
            title: "현재 타일셋 표시는 하위/상위 레이어를 함께 보여줍니다.",
          }),
        ],
      }),
      el("button", {
        class: "database-footer-button rm2k3-global-terrain-button",
        text: "상세 통행",
        attrs: { type: "button", title: "상세 통행 설정 열기" },
        dataset: { testid: "tileset-settings-open" },
        on: { click: () => openTilesetSettingsModal(tileset.id, rerender) },
      }),
      el("button", {
        class: "database-footer-button rm2k3-global-terrain-button primary",
        text: "AI 메타",
        attrs: { type: "button", title: "AI 타일 의미 분석 열기" },
        dataset: { testid: "tileset-ai-meta-open" },
        on: { click: () => openTilesetAiMeta(rerender) },
      }),
    ],
  });
}

function renderTerrainPanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const activeMode = getTilesetMetadataEditMode();
  return el("aside", {
    class: "rm2k3-tileset-terrain-pane",
    children: [
      renderTilesetCheckerSummary(tileset),
      el("fieldset", {
        class: "rm2k3-db-fieldset rm2k3-tileset-edit-mode",
        dataset: { testid: "tileset-rm2k3-edit-mode" },
        children: [
          el("legend", { text: "편집 모드" }),
          renderModeButton({ activeMode, label: "지형", mode: "terrain", rerender }),
          renderModeButton({ activeMode, label: "통행", mode: "passage", rerender }),
          renderModeButton({ activeMode, label: "AI 메타", mode: "ai", rerender }),
          renderModeButton({ activeMode, label: "그룹", mode: "group", rerender }),
          el("button", {
            class: "database-footer-button rm2k3-mode-button",
            text: "4방향 통행",
            attrs: { type: "button", title: "타일별 4방향 통행 설정 열기" },
            dataset: { testid: "tileset-rm2k3-mode-four-way" },
            on: { click: () => openTilesetSettingsModal(tileset.id, rerender) },
          }),
          disabledButton({
            extraClass: "rm2k3-mode-button",
            label: "전역 지형 설정",
            testid: "tileset-rm2k3-mode-global-terrain",
            title: "전역 지형 일괄 설정은 아직 지원하지 않습니다.",
          }),
        ],
      }),
      renderAutotileSummary(tileset),
      renderTerrainList(),
    ],
  });
}

function renderModeButton(spec: ModeButtonSpec): HTMLButtonElement {
  const isActive = spec.activeMode === spec.mode;
  return el("button", {
    class: `database-footer-button rm2k3-mode-button${isActive ? " active" : ""}`,
    text: spec.label,
    attrs: { type: "button", "aria-pressed": String(isActive) },
    dataset: { testid: `tileset-rm2k3-mode-${spec.mode}` },
    on: { click: () => setTilesetMetadataEditMode(spec.mode, spec.rerender) },
  });
}

function disabledButton(spec: DisabledButtonSpec): HTMLButtonElement {
  return el("button", {
    class: `database-footer-button ${spec.extraClass ?? ""} disabled`.trim(),
    text: spec.label,
    attrs: { type: "button", disabled: "true", title: spec.title },
    dataset: { testid: spec.testid },
  });
}

function renderAutotileSummary(tileset: TilesetDef): HTMLElement {
  return el("fieldset", {
    class: "rm2k3-db-fieldset rm2k3-tileset-autotile",
    children: [
      el("legend", { text: "자동타일 애니메이션" }),
      el("div", { class: "tileset-db-autotile-swatch" }),
      el("div", { class: "tileset-db-resource", text: passageSummary(tileset) }),
    ],
  });
}

function renderTerrainList(): HTMLElement {
  return el("fieldset", {
    class: "rm2k3-db-fieldset rm2k3-tileset-terrain-list-wrap",
    children: [
      el("legend", { text: "지형" }),
      el("div", {
        class: "tileset-db-terrain-list",
        dataset: { testid: "tileset-rm2k3-terrain-list" },
        children: TERRAIN_NAMES.map((name, index) =>
          el("div", { class: `tileset-db-terrain-row${index === 0 ? " active" : ""}`, text: `${recordNumber(index)}:${name}` }),
        ),
      }),
    ],
  });
}

function updateTilesetName(tilesetId: string, value: string): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) target.name = value;
  });
}

function openTilesetAiMeta(rerender: () => void): void {
  setTilesetMetadataEditMode("ai", rerender);
  window.requestAnimationFrame(() => {
    document.querySelector("[data-testid='tileset-ai-question-panel']")?.scrollIntoView({ block: "nearest" });
  });
}

function passageSummary(tileset: TilesetDef): string {
  const marks = Array.from({ length: tileset.count }, (_unused, index) => passageMarkForTile(tileset, index));
  const open = marks.filter((mark) => mark === "o").length;
  const blocked = marks.filter((mark) => mark === "x").length;
  const upper = marks.filter((mark) => mark === "star").length;
  return `O ${open} / X ${blocked} / * ${upper}`;
}

function recordNumber(index: number): string {
  return String(index + 1).padStart(4, "0");
}
