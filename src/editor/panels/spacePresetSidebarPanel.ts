// editor/panels/spacePresetSidebarPanel.ts
// 좌측 사이드바 「맵」 탭 및 「맵 목록」 도크에 노출되는 1클릭 「바로 깔기 · 공간 프리셋 (Stamp Place)」 갤러리 패널.

import { editorState } from "@/editor/editorState";
import {
  applySpacePresetToMap,
  findSpacePresetById,
  nextSpacePresetStyleVariant,
  presetsByCategory,
  SPACE_PRESET_CATEGORIES,
  SPACE_PRESET_STYLE_VARIANTS,
  styleVariantIndex,
  type SpacePresetCategoryId,
  type SpacePresetItem,
  type SpacePresetStyleVariant,
} from "@/editor/spacePresetCatalog";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export interface SpacePresetSidebarPanelOptions {
  readonly defaultExpanded?: boolean;
  readonly testidPrefix?: string;
}

interface SharedPresetPanelState {
  category: SpacePresetCategoryId;
  styleVariant: SpacePresetStyleVariant;
  variantSeed: number;
  lastAppliedPresetId: string | null;
  lastAppliedMapId: string | null;
}

const sharedState: SharedPresetPanelState = {
  category: "modern_interior",
  styleVariant: "A",
  variantSeed: 1,
  lastAppliedPresetId: null,
  lastAppliedMapId: null,
};

let dockExpandedState = false;

export function createSpacePresetSidebarPanel(options?: SpacePresetSidebarPanelOptions): HTMLElement {
  const prefix = options?.testidPrefix ?? "sidebar-space-preset";
  const isDock = prefix.startsWith("dock-");
  let expanded = options?.defaultExpanded ?? (isDock ? dockExpandedState : true);

  const root = el("section", {
    class: `map-sidebar-preset-panel${isDock ? " is-dock-compact" : ""}`,
    attrs: { "aria-label": "바로 깔기 공간 프리셋" },
    dataset: { testid: `${prefix}-panel` },
  });

  const render = (): void => {
    const vIdx = styleVariantIndex(sharedState.styleVariant) + 1;
    const svMeta =
      SPACE_PRESET_STYLE_VARIANTS.find((v) => v.id === sharedState.styleVariant) ??
      SPACE_PRESET_STYLE_VARIANTS[0]!;

    const toggleBtn = el("button", {
      class: "map-sidebar-preset-toggle",
      attrs: {
        type: "button",
        "aria-expanded": expanded ? "true" : "false",
        title: "현재 맵에 오피스 로비·강의실·백화점·지하철역·강변·번화가·상점가·여관·던전 등 20종 공간을 1클릭으로 바로 깝니다 (Ctrl+Z 실행 취소 지원)",
      },
      dataset: { testid: `${prefix}-toggle` },
      on: {
        click: () => {
          expanded = !expanded;
          if (isDock) dockExpandedState = expanded;
          render();
        },
      },
      children: [
        el("span", {
          class: "map-sidebar-preset-toggle-title",
          text: "바로 깔기 · 공간 프리셋",
        }),
        el("span", {
          class: "map-sidebar-preset-toggle-meta",
          text: expanded ? `Variant ${vIdx}/4 (${svMeta.shortLabel}) ▾` : "20종 펼치기 ▸",
        }),
      ],
    });

    if (!expanded) {
      root.replaceChildren(toggleBtn);
      return;
    }

    const catTabs = el("div", {
      class: "map-sidebar-preset-cats",
      attrs: { role: "tablist", "aria-label": "공간 프리셋 분류" },
      dataset: { testid: `${prefix}-cats` },
      children: SPACE_PRESET_CATEGORIES.map((cat) => {
        const active = cat.id === sharedState.category;
        return el("button", {
          class: `map-sidebar-preset-cat${active ? " is-active" : ""}`,
          text: cat.shortLabel,
          attrs: {
            type: "button",
            role: "tab",
            "aria-selected": active ? "true" : "false",
            title: cat.description,
          },
          dataset: { testid: `${prefix}-cat-${cat.id}`, category: cat.id },
          on: {
            click: () => {
              sharedState.category = cat.id;
              render();
            },
          },
        });
      }),
    });

    const applyPresetWithCurrentVariant = (preset: SpacePresetItem): void => {
      const currentMapId = editorState.get().currentMapId || store.getCurrent().startMapId;
      applySpacePresetToMap(currentMapId, preset, {
        styleVariant: sharedState.styleVariant,
        variantSeed: sharedState.variantSeed,
      });
      sharedState.lastAppliedPresetId = preset.id;
      sharedState.lastAppliedMapId = currentMapId;
      render();
    };

    const variantRow = el("div", {
      class: "map-sidebar-preset-variant-row",
      dataset: { testid: `${prefix}-variant-bar` },
      children: [
        el("div", {
          class: "map-sidebar-preset-style-pills",
          children: SPACE_PRESET_STYLE_VARIANTS.map((sv) => {
            const active = sv.id === sharedState.styleVariant;
            return el("button", {
              class: `map-sidebar-preset-style-pill${active ? " is-active" : ""}`,
              text: sv.id,
              attrs: {
                type: "button",
                "aria-pressed": active ? "true" : "false",
                title: `${sv.label} — ${sv.summary}`,
              },
              dataset: { testid: `${prefix}-style-${sv.id}`, styleVariant: sv.id },
              on: {
                click: () => {
                  sharedState.styleVariant = sv.id;
                  sharedState.variantSeed = styleVariantIndex(sv.id) + 1;
                  const currentMapId = editorState.get().currentMapId || store.getCurrent().startMapId;
                  const lastPreset =
                    sharedState.lastAppliedMapId === currentMapId
                      ? findSpacePresetById(sharedState.lastAppliedPresetId ?? undefined)
                      : undefined;
                  if (lastPreset) {
                    applyPresetWithCurrentVariant(lastPreset);
                  } else {
                    render();
                  }
                },
              },
            });
          }),
        }),
        el("button", {
          class: "btn map-sidebar-preset-cycle-btn",
          text: `다른 구조·분위기로 변형 (${vIdx}/4)`,
          attrs: {
            type: "button",
            title: "클릭할 때마다 구조 A→B→C→D 와 시드를 바꾸며, 방금 적용한 프리셋이 있으면 즉시 새 구조·색감으로 다시 깝니다.",
          },
          dataset: { testid: `${prefix}-cycle-variant` },
          on: {
            click: () => {
              sharedState.styleVariant = nextSpacePresetStyleVariant(sharedState.styleVariant);
              sharedState.variantSeed = (sharedState.variantSeed % 4) + 1;
              const currentMapId = editorState.get().currentMapId || store.getCurrent().startMapId;
              const lastPreset =
                sharedState.lastAppliedMapId === currentMapId
                  ? findSpacePresetById(sharedState.lastAppliedPresetId ?? undefined)
                  : undefined;
              if (lastPreset) {
                applyPresetWithCurrentVariant(lastPreset);
              } else {
                render();
              }
            },
          },
        }),
      ],
    });

    const items = presetsByCategory(sharedState.category);
    const currentMapId = editorState.get().currentMapId || store.getCurrent().startMapId;
    const chipsGrid = el("div", {
      class: "map-sidebar-preset-chips",
      dataset: { testid: `${prefix}-chips` },
      children: items.map((item) => {
        const isLastApplied =
          sharedState.lastAppliedPresetId === item.id &&
          sharedState.lastAppliedMapId === currentMapId;
        return el("button", {
          class: `map-sidebar-preset-chip${isLastApplied ? " is-active" : ""}`,
          attrs: {
            type: "button",
            "aria-pressed": isLastApplied ? "true" : "false",
            title: `${item.name} (${item.badge})\n구역: ${item.zonesSummary}\n클릭 시 현재 맵에 1클릭 적용 (같은 프리셋 재클릭 시 다음 구조 변형 A→B→C→D 자동 전환 · Ctrl+Z 취소 가능)`,
          },
          dataset: { testid: `${prefix}-chip-${item.id}`, presetId: item.id },
          on: {
            click: () => {
              if (isLastApplied) {
                sharedState.styleVariant = nextSpacePresetStyleVariant(sharedState.styleVariant);
                sharedState.variantSeed = (sharedState.variantSeed % 4) + 1;
              }
              applyPresetWithCurrentVariant(item);
            },
          },
          children: [
            el("span", { class: "map-sidebar-preset-chip-name", text: item.shortName }),
            el("span", {
              class: "map-sidebar-preset-chip-meta",
              text: isLastApplied ? `${item.defaultWidth}×${item.defaultHeight} · ${sharedState.styleVariant}` : `${item.defaultWidth}×${item.defaultHeight}`,
            }),
          ],
        });
      }),
    });

    const body = el("div", {
      class: "map-sidebar-preset-body",
      dataset: { testid: `${prefix}-body` },
      children: [catTabs, variantRow, chipsGrid],
    });
    root.replaceChildren(toggleBtn, body);
  };

  render();
  return root;
}
