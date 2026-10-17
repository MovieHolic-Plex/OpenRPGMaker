import { addMapFolder, createMapFromSpec } from "@/editor/actions";
import { selectEditorMap } from "@/editor/mapSelection";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import {
  createMapWithSpacePreset,
  nextSpacePresetStyleVariant,
  presetsByCategory,
  SPACE_PRESET_CATEGORIES,
  SPACE_PRESET_STYLE_VARIANTS,
  styleVariantIndex,
  type SpacePresetCategoryId,
  type SpacePresetItem,
  type SpacePresetStyleVariant,
} from "@/editor/spacePresetCatalog";
import { appendGroupedTilesetOptions } from "@/editor/tilesetSelectOptions";
import {
  clampMapSize,
  resolveMapCreateDefaults,
  type MapCreatePreset,
  type MapCreateRequest,
} from "@/project/mapCreateSpec";
import { exceedsMapDimensionLimit, MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { openWorldAtlasCreateDialog } from './worldAtlasCreateDialog';
import { WORLDMAP_AUTHORING_ID } from '@/project/defaults/worldmapAuthoring';

export function openMapCreateDialog(request: MapCreateRequest = {}): void {
  const project = store.getCurrent();
  let spec = resolveMapCreateDefaults(project, request);
  openEventSubdialog({
    title: spec.parentId ? "하위 맵 만들기" : "맵 만들기",
    subtitle: "이름·크기·타일 그림판을 정한 뒤 만듭니다. 트리 계층은 이동 문이 아닙니다.",
    testId: "map-create-dialog",
    width: "wide",
    render: (body, close) => {
      const name = el("input", {
        attrs: { type: "text", "aria-label": "맵 이름" },
        value: spec.name,
        dataset: { testid: "map-create-name" },
      }) as HTMLInputElement;
      const width = el("input", {
        attrs: { type: "number", min: "4", max: String(MAX_TOOL_MAP_DIMENSION), "aria-label": "가로" },
        value: spec.width,
        dataset: { testid: "map-create-width" },
      }) as HTMLInputElement;
      const height = el("input", {
        attrs: { type: "number", min: "4", max: String(MAX_TOOL_MAP_DIMENSION), "aria-label": "세로" },
        value: spec.height,
        dataset: { testid: "map-create-height" },
      }) as HTMLInputElement;
      const tileset = el("select", {
        attrs: { "aria-label": "타일 그림판" },
        dataset: { testid: "map-create-tileset" },
      }) as HTMLSelectElement;
      appendGroupedTilesetOptions(tileset, Object.values(project.tilesets));
      tileset.value = spec.tilesetId;
      const parent = el("select", {
        attrs: { "aria-label": "상위 맵" },
        dataset: { testid: "map-create-parent" },
      }) as HTMLSelectElement;
      // 빈 상위는 프로젝트 루트가 아니라 **트리 최상위 노드의 자식**으로 들어간다
      // (mapTree.insertTreeNode: parentId "" → root). 이 저장소의 최상위는 언제나 실제 맵
      // 하나라서 예전 「(루트)」는 없는 계층(형제 최상위 맵)을 약속했다 — 실제로 부모가 되는
      // 맵을 이름으로 밝힌다(OPRN-OUT-027). 저장 구조는 그대로다.
      parent.append(el("option", { text: `${rootParentPrefix(project)}의 하위`, attrs: { value: "" } }));
      appendTreeParentOptions(parent, project.mapTree, project.maps, 0);
      parent.value = spec.parentId;

      let selectedSpacePreset: SpacePresetItem | null = null;
      let activeCategory: SpacePresetCategoryId = "modern_interior";
      let styleVariant: SpacePresetStyleVariant = "A";
      let variantSeed = 1;
      let lastAutoPresetName = spec.name;

      const confirmBtn = el("button", {
        class: "btn primary",
        text: "만들기",
        attrs: { type: "button" },
        dataset: { testid: "map-create-confirm" },
      }) as HTMLButtonElement;

      const activeBanner = el("div", {
        class: "map-space-preset-active-banner",
        dataset: { testid: "space-preset-active-banner" },
      });

      const updateConfirmAndBanner = (): void => {
        if (!selectedSpacePreset) {
          confirmBtn.textContent = "만들기";
          activeBanner.hidden = true;
          activeBanner.replaceChildren();
          return;
        }
        const svMeta = SPACE_PRESET_STYLE_VARIANTS.find((v) => v.id === styleVariant) ?? SPACE_PRESET_STYLE_VARIANTS[0]!;
        confirmBtn.textContent = `공간 프리셋 생성 (${selectedSpacePreset.shortName} · 구조 ${styleVariant})`;
        activeBanner.hidden = false;
        activeBanner.replaceChildren(
          el("div", {
            class: "map-space-preset-active-banner-info",
            children: [
              el("strong", { text: `선택됨: ${selectedSpacePreset.name} (${selectedSpacePreset.badge})` }),
              el("span", { text: `${svMeta.label} · 시드 #${variantSeed} · 구역: ${selectedSpacePreset.zonesSummary}` }),
            ],
          }),
          el("button", {
            class: "btn map-space-preset-clear-btn",
            text: "빈 맵으로 전환",
            attrs: { type: "button" },
            dataset: { testid: "space-preset-clear" },
            on: {
              click: () => {
                selectedSpacePreset = null;
                renderPresetCards();
                updateConfirmAndBanner();
              },
            },
          }),
        );
      };

      const applyPreset = (preset: MapCreatePreset): void => {
        selectedSpacePreset = null;
        spec = resolveMapCreateDefaults(store.getCurrent(), {
          parentId: parent.value as MapId | "",
          preset,
          name: name.value,
        });
        width.value = String(spec.width);
        height.value = String(spec.height);
        tileset.value = spec.tilesetId;
        renderPresetCards();
        updateConfirmAndBanner();
      };

      const selectSpacePreset = (item: SpacePresetItem): void => {
        selectedSpacePreset = item;
        const trimmed = name.value.trim();
        if (!trimmed || trimmed === "새 맵" || trimmed === lastAutoPresetName) {
          name.value = item.name;
          lastAutoPresetName = item.name;
        }
        width.value = String(item.defaultWidth);
        height.value = String(item.defaultHeight);
        if (project.tilesets[item.tilesetId]) {
          tileset.value = item.tilesetId;
        }
        renderPresetCards();
        updateConfirmAndBanner();
      };

      const presets = el("div", { class: "map-create-presets", dataset: { testid: "map-create-presets" } });
      presets.append(el("button", {
        class: "btn",
        text: "빈 월드맵",
        attrs: { type: "button" },
        dataset: { testid: "map-create-worldmap-blank" },
        on: {
          click: () => {
            applyPreset("blank");
            tileset.value = WORLDMAP_AUTHORING_ID;
            width.value = "48";
            height.value = "36";
          },
        },
      }));
      for (const [value, label] of [
        ["blank", "빈 맵"],
        ["inherit-parent", "부모와 같게"],
        ["interior", "실내"],
      ] as const) {
        presets.append(el("button", {
          class: "btn",
          text: label,
          attrs: { type: "button" },
          dataset: { testid: `map-create-preset-${value}` },
          on: { click: () => applyPreset(value) },
        }));
      }

      const categoryTabsHost = el("div", {
        class: "map-space-preset-category-tabs",
        attrs: { role: "tablist", "aria-label": "공간 프리셋 분류" },
        dataset: { testid: "space-preset-category-tabs" },
      });
      const variantBarHost = el("div", {
        class: "map-space-preset-variant-bar",
        dataset: { testid: "space-preset-variant-bar" },
      });
      const cardsHost = el("div", {
        class: "map-space-preset-grid",
        dataset: { testid: "space-preset-grid" },
      });

      const renderCategoryTabs = (): void => {
        categoryTabsHost.replaceChildren(
          ...SPACE_PRESET_CATEGORIES.map((cat) => {
            const active = cat.id === activeCategory;
            return el("button", {
              class: `map-space-preset-tab${active ? " is-active" : ""}`,
              text: cat.label,
              attrs: {
                type: "button",
                role: "tab",
                "aria-selected": active ? "true" : "false",
                title: cat.description,
              },
              dataset: { testid: `space-preset-cat-${cat.id}`, category: cat.id },
              on: {
                click: () => {
                  activeCategory = cat.id;
                  renderCategoryTabs();
                  renderPresetCards();
                },
              },
            });
          }),
        );
      };

      const renderVariantBar = (): void => {
        const vIdx = styleVariantIndex(styleVariant) + 1;
        const svMeta = SPACE_PRESET_STYLE_VARIANTS.find((v) => v.id === styleVariant) ?? SPACE_PRESET_STYLE_VARIANTS[0]!;
        variantBarHost.replaceChildren(
          el("div", {
            class: "map-space-preset-style-pills",
            children: SPACE_PRESET_STYLE_VARIANTS.map((sv) => {
              const isCurrent = sv.id === styleVariant;
              return el("button", {
                class: `map-space-preset-style-pill${isCurrent ? " is-active" : ""}`,
                text: sv.shortLabel,
                attrs: {
                  type: "button",
                  "aria-pressed": isCurrent ? "true" : "false",
                  title: `${sv.label} — ${sv.summary}`,
                },
                dataset: { testid: `space-preset-style-${sv.id}`, styleVariant: sv.id },
                on: {
                  click: () => {
                    styleVariant = sv.id;
                    variantSeed = styleVariantIndex(sv.id) + 1;
                    renderVariantBar();
                    updateConfirmAndBanner();
                  },
                },
              });
            }),
          }),
          el("button", {
            class: "btn map-space-preset-cycle-btn",
            text: `다른 구조·분위기로 변형 (Variant ${vIdx}/4 · ${svMeta.shortLabel})`,
            attrs: {
              type: "button",
              title: "클릭할 때마다 방 구획 배치(동↔서 반전·광폭·비대칭)와 바닥/벽 팔레트, 소품 배치가 다른 변형으로 바뀝니다.",
            },
            dataset: { testid: "space-preset-cycle-variant" },
            on: {
              click: () => {
                styleVariant = nextSpacePresetStyleVariant(styleVariant);
                variantSeed = (variantSeed % 4) + 1;
                renderVariantBar();
                updateConfirmAndBanner();
              },
            },
          }),
        );
      };

      const submit = (): void => {
        const requestedWidth = Number(width.value);
        const requestedHeight = Number(height.value);
        if (exceedsMapDimensionLimit(requestedWidth, requestedHeight)) {
          toast(mapSizeLimitMessage(), "error");
          return;
        }
        if (selectedSpacePreset) {
          const res = createMapWithSpacePreset(selectedSpacePreset, {
            styleVariant,
            variantSeed,
            customName: name.value.trim() || selectedSpacePreset.name,
            parentId: parent.value as MapId | "",
            requestedWidth: clampMapSize(requestedWidth, selectedSpacePreset.defaultWidth),
            requestedHeight: clampMapSize(requestedHeight, selectedSpacePreset.defaultHeight),
          });
          if (!res.ok) return;
          close();
          return;
        }
        const id = createMapFromSpec({
          name: name.value,
          width: clampMapSize(requestedWidth, spec.width),
          height: clampMapSize(requestedHeight, spec.height),
          tilesetId: tileset.value,
          parentId: parent.value as MapId | "",
          preset: spec.preset,
        });
        if (!id) return;
        selectEditorMap(id);
        close();
      };

      const renderPresetCards = (): void => {
        const list = presetsByCategory(activeCategory);
        cardsHost.replaceChildren(
          ...list.map((item) => {
            const isSelected = selectedSpacePreset?.id === item.id;
            return el("div", {
              class: `map-space-preset-card${isSelected ? " is-active" : ""}`,
              attrs: {
                role: "button",
                tabindex: "0",
                "aria-pressed": isSelected ? "true" : "false",
                title: `${item.name} (${item.badge})\n구역: ${item.zonesSummary}\n${item.description}`,
              },
              dataset: { testid: `space-preset-card-${item.id}`, presetId: item.id },
              on: {
                click: () => selectSpacePreset(item),
                dblclick: () => {
                  selectSpacePreset(item);
                  submit();
                },
                keydown: (ev: Event) => {
                  if (!(ev instanceof KeyboardEvent)) return;
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    selectSpacePreset(item);
                  }
                },
              },
              children: [
                el("div", {
                  class: "map-space-preset-card-top",
                  children: [
                    el("span", { class: "map-space-preset-card-title", text: item.name }),
                    el("span", { class: "map-space-preset-card-badge", text: item.badge }),
                  ],
                }),
                el("div", { class: "map-space-preset-card-zones", text: item.zonesSummary }),
                el("div", {
                  class: "map-space-preset-card-footer",
                  children: [
                    el("span", { class: "map-space-preset-card-desc", text: item.description }),
                    el("button", {
                      class: "btn map-space-preset-card-apply",
                      text: "바로 생성",
                      attrs: { type: "button" },
                      dataset: { testid: `space-preset-instant-${item.id}` },
                      on: {
                        click: (ev: Event) => {
                          ev.stopPropagation();
                          selectSpacePreset(item);
                          submit();
                        },
                      },
                    }),
                  ],
                }),
              ],
            });
          }),
        );
      };

      confirmBtn.addEventListener("click", submit);
      renderCategoryTabs();
      renderVariantBar();
      renderPresetCards();
      updateConfirmAndBanner();

      const gallerySection = el("section", {
        class: "map-space-preset-gallery-section",
        attrs: { "aria-label": "공간 프리셋 갤러리" },
        dataset: { testid: "map-create-space-gallery" },
        children: [
          el("div", {
            class: "map-space-preset-gallery-header",
            children: [
              el("div", {
                class: "map-space-preset-gallery-title-wrap",
                children: [
                  el("strong", { class: "map-space-preset-gallery-title", text: "공간 프리셋 갤러리 (20종 다구역 완성 맵)" }),
                  el("span", {
                    class: "map-space-preset-gallery-subtitle",
                    text: "빈 잔디판 대신 로비·강의실·백화점·지하철역·병원·강변·번화가·상점가·여관·던전을 1클릭으로 생성합니다.",
                  }),
                ],
              }),
              variantBarHost,
            ],
          }),
          categoryTabsHost,
          cardsHost,
          activeBanner,
        ],
      });

      body.append(
        el("div", { class: "map-create-form", children: [
          presets,
          gallerySection,
          field("이름", name),
          field("가로", width),
          field("세로", height),
          field("타일 그림판", tileset),
          field("상위", parent),
          el("p", {
            class: "map-create-hint",
            text: `상위를 고르지 않은 맵은 ${rootParentPrefix(project)}의 하위로 들어갑니다. 나란히 서는 최상위 맵은 만들 수 없습니다.`,
          }),
          el("p", {
            class: "map-create-hint",
            text: "상위에 넣는 것만으로는 문이 생기지 않습니다. 만든 뒤 메뉴에서 왕복 이동을 넣을 수 있습니다.",
          }),
          confirmBtn,
          el("button", {
            class: "btn",
            text: "세계 지도 만들기",
            attrs: { type: "button" },
            dataset: { testid: "map-create-world-atlas" },
            on: { click: () => { close(); openWorldAtlasCreateDialog(); } },
          }),
          el("button", {
            class: "btn",
            text: "분류만 만들기",
            attrs: { type: "button" },
            dataset: { testid: "map-create-folder" },
            on: {
              click: () => {
                addMapFolder(parent.value as MapId | "", name.value.trim() || "새 분류");
                close();
              },
            },
          }),
        ] }),
      );
      name.focus();
      name.select();
    },
  });
}

export function openMapCreateUnder(parentId: MapId): void {
  const project = store.getCurrent();
  const parentOfParent = findParentMapId(project.mapTree, parentId);
  openMapCreateDialog({
    parentId,
    preset: parentOfParent === null ? "inherit-parent" : "interior",
  });
}

/**
 * 트리 최상위 노드를 사람 말로 — 「(루트)」가 감췄던 실제 부모다.
 * 최상위는 보통 실제 맵이지만 합성 분류가 앉을 수도 있어(mapInspection 의 같은 방어) 낱말을 가른다.
 */
function rootParentPrefix(project: Pick<Project, "mapTree" | "maps">): string {
  const noun = isMapTreeFolder(project.mapTree) ? "분류" : "맵";
  return `최상위 ${noun} 「${mapTreeNodeLabel(project.mapTree, project.maps)}」`;
}

function appendTreeParentOptions(
  select: HTMLSelectElement,
  node: MapTreeNode,
  maps: ReturnType<typeof store.getCurrent>["maps"],
  depth: number,
): void {
  const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
  const label = isMapTreeFolder(node) ? `[분류] ${mapTreeNodeLabel(node, maps)}` : mapTreeNodeLabel(node, maps);
  select.append(el("option", { text: `${prefix}${label}`, attrs: { value: node.mapId } }));
  for (const child of node.children) appendTreeParentOptions(select, child, maps, depth + 1);
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "map-create-field", children: [el("span", { text: label }), control] });
}
