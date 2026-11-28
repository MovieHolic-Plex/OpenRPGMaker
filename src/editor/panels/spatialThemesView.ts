import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import { prefillAiAssistantInput, setPendingAiBootIntent } from "@/editor/aiBootIntent";
import { deferredSpatialCardThumb } from "@/editor/panels/spatialCardThumbs";
import { listSpatialGalleryCards, type SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { objectThumbCacheKey, renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import { setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { tilesetListThumb } from "@/editor/panels/tilesetListThumb";
import { setSpatialAssetBrowserTileset } from "@/editor/panels/spatialAssetBrowser";
import { placeReferenceMapPreset } from "@/editor/panels/placePresetActions";
import { openPlaceDetail } from "@/editor/panels/spatialPlaceBrowse";
import { regionReferenceImage } from "@/editor/panels/regionReferenceView";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import type { DatabaseTab } from "@/editor/panels/database";
import {
  coverPlacePreviewForTilesets,
  curateThemeObjects,
  CUSTOM_THEME_SPEC,
  mapUsageByTileset,
  SPATIAL_THEME_CATEGORY_LABEL,
  SPATIAL_THEME_FILTERS,
  SPATIAL_THEME_SPECS,
  themeIdForTileset,
  type SpatialThemeFilter,
  type SpatialThemeSpec,
} from "@/project/spatialThemes";
import { store } from "@/project/store";
import type { Project, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type ResolvedThemePack = {
  readonly spec: SpatialThemeSpec;
  readonly tilesets: readonly TilesetDef[];
  readonly primaryTileset: TilesetDef | undefined;
  readonly usedMapCount: number;
  readonly usedMapNames: readonly string[];
  readonly objectCards: readonly SpatialGalleryCard[];
  readonly curatedObjects: readonly SpatialGalleryCard[];
  readonly coverObjects: readonly SpatialGalleryCard[];
  readonly placeCards: readonly SpatialGalleryCard[];
  readonly coverPlacePreviewUrl?: string;
};

type ThemeBrowserState = {
  filter: SpatialThemeFilter;
  query: string;
  selectedThemeId: string | null;
  detailSearch: string;
  selectedObjectId: string | null;
  scrollTop: number;
};

const viewState: ThemeBrowserState = {
  filter: "all",
  query: "",
  selectedThemeId: null,
  detailSearch: "",
  selectedObjectId: null,
  scrollTop: 0,
};

let themeMemo: {
  readonly tilesets: object;
  readonly maps: object;
  readonly spatial: object | undefined;
  readonly packs: readonly ResolvedThemePack[];
  readonly allObjects: readonly SpatialGalleryCard[];
} | null = null;

function buildThemePacks(project: Project): {
  readonly packs: readonly ResolvedThemePack[];
  readonly allObjects: readonly SpatialGalleryCard[];
} {
  const spatial = project.spatialAuthoring;
  if (
    themeMemo
    && themeMemo.tilesets === project.tilesets
    && themeMemo.maps === project.maps
    && themeMemo.spatial === spatial
  ) {
    return { packs: themeMemo.packs, allObjects: themeMemo.allObjects };
  }

  const tilesetList = Object.values(project.tilesets);
  const tilesetsByTheme = new Map<string, TilesetDef[]>();
  const themeByTilesetId = new Map<string, string>();
  for (const ts of tilesetList) {
    const themeId = themeIdForTileset(ts);
    themeByTilesetId.set(ts.id, themeId);
    const list = tilesetsByTheme.get(themeId) ?? [];
    list.push(ts);
    tilesetsByTheme.set(themeId, list);
  }

  const allObjects = listSpatialGalleryCards({
    tab: "objects",
    mode: "design",
    source: "all",
    designId: null,
    occurrenceId: null,
    galleryCardId: null,
    listView: true,
    inspectorOpen: false,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    regionKindFilter: null,
  });

  const allPlaces = listSpatialGalleryCards({
    tab: "places",
    mode: "design",
    source: "all",
    designId: null,
    occurrenceId: null,
    galleryCardId: null,
    listView: true,
    inspectorOpen: false,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    regionKindFilter: null,
  });

  const objectsByTheme = new Map<string, SpatialGalleryCard[]>();
  for (const card of allObjects) {
    const themeId = card.tilesetId ? (themeByTilesetId.get(card.tilesetId) ?? "worldmap_misc") : "atlas_interior";
    const list = objectsByTheme.get(themeId) ?? [];
    list.push(card);
    objectsByTheme.set(themeId, list);
  }

  const placesByTheme = new Map<string, SpatialGalleryCard[]>();
  for (const card of allPlaces) {
    if (!card.tilesetId) continue;
    // 시설 템플릿보다 완성 장소 사례·내 설계를 먼저 보게 한다.
    const themeId = themeByTilesetId.get(card.tilesetId);
    if (!themeId) continue;
    const list = placesByTheme.get(themeId) ?? [];
    list.push(card);
    placesByTheme.set(themeId, list);
  }

  const usageMap = mapUsageByTileset(project);
  const allSpecs: SpatialThemeSpec[] = [
    ...SPATIAL_THEME_SPECS,
    ...(tilesetsByTheme.has(CUSTOM_THEME_SPEC.id) ? [CUSTOM_THEME_SPEC] : []),
  ];

  const packs: ResolvedThemePack[] = [];
  for (const spec of allSpecs) {
    const tilesets = tilesetsByTheme.get(spec.id) ?? [];
    const objs = objectsByTheme.get(spec.id) ?? [];
    const rawPlaces = placesByTheme.get(spec.id) ?? [];
    if (tilesets.length === 0 && objs.length === 0 && rawPlaces.length === 0) continue;

    // 대표 타일셋 우선 정렬
    const sortedTilesets = [...tilesets].sort((a, b) => {
      if (a.id === spec.primaryTilesetId) return -1;
      if (b.id === spec.primaryTilesetId) return 1;
      return (b.structureKits?.length ?? 0) - (a.structureKits?.length ?? 0);
    });
    const primaryTileset = sortedTilesets[0];
    const idSet = new Set(sortedTilesets.map((t) => t.id));

    const usedMapNames: string[] = [];
    for (const ts of sortedTilesets) {
      const names = usageMap.get(ts.id);
      if (names) usedMapNames.push(...names);
    }

    // 완성 장소(regionReferenceId 또는 canonicalSource)만 우선 표시
    const places = rawPlaces
      .filter((card) => Boolean(card.regionReferenceId || card.reviewedPlaceId || card.canonicalSource))
      .slice(0, 12);

    const curatedObjects = curateThemeObjects(objs, project.tilesets, 18);
    const coverObjects = curatedObjects.slice(0, 4);
    const coverPlacePreviewUrl = coverPlacePreviewForTilesets(idSet);

    packs.push({
      spec,
      tilesets: sortedTilesets,
      primaryTileset,
      usedMapCount: usedMapNames.length,
      usedMapNames,
      objectCards: objs,
      curatedObjects,
      coverObjects,
      placeCards: places,
      coverPlacePreviewUrl,
    });
  }

  // 내 게임에서 사용 중인 테마를 맨 앞으로, 나머지는 정의 순서 유지
  packs.sort((a, b) => Number(b.usedMapCount > 0) - Number(a.usedMapCount > 0));

  themeMemo = {
    tilesets: project.tilesets,
    maps: project.maps,
    spatial,
    packs,
    allObjects,
  };
  return { packs, allObjects };
}

export function spatialThemePackCount(project: Project): number {
  const seen = new Set<string>();
  for (const ts of Object.values(project.tilesets)) {
    seen.add(themeIdForTileset(ts));
  }
  return seen.size;
}

function sendPromptToAssistant(text: string): void {
  openAiAssistantPanel();
  if (!prefillAiAssistantInput(text, { preserveDraft: true })) {
    setPendingAiBootIntent(text);
  }
}

function askAssistantForTheme(pack: ResolvedThemePack): void {
  const tilesetNote = pack.primaryTileset ? `(${pack.primaryTileset.id})` : "";
  sendPromptToAssistant(`${pack.spec.aiPromptHint} 새 맵을 만들어줘 ${tilesetNote} `);
}

function askAssistantForObject(card: SpatialGalleryCard): void {
  const ref = card.sharedObjectId
    ? `shared-object:${card.sharedObjectId}`
    : card.canonicalSource
      ? card.canonicalSource.id
      : `${card.tilesetId ?? ""}/${card.objectId ?? card.localId ?? card.id}`;
  sendPromptToAssistant(`오브젝트 「${card.name}」(${ref}) `);
}

function askAssistantForPlace(card: SpatialGalleryCard): void {
  const ref = card.regionReferenceId ?? card.localId ?? card.id;
  sendPromptToAssistant(`완성 장소 예시 「${card.name}」(${ref}) 분위기를 참고해서 맵을 만들어줘 `);
}

function renderLegacyMenu(
  navigate: (tab: DatabaseTab) => void,
  allObjectCount: number,
  tilesetCount: number,
): HTMLElement {
  const items: readonly { readonly tab: DatabaseTab; readonly label: string; readonly count: string }[] = [
    { tab: "spatialTiles", label: "타일 시트 · 통행 편집", count: `${tilesetCount}` },
    { tab: "spatialObjects", label: "전체 오브젝트 브라우저", count: allObjectCount.toLocaleString() },
    { tab: "spatialPlaces", label: "전체 장소 라이브러리", count: "목록" },
    { tab: "spatialRegions", label: "지역 (고급)", count: "AI" },
    { tab: "spatialWorlds", label: "세계 지리 (고급)", count: "AI" },
  ];
  const pop = el("div", {
    class: "spatial-themes-legacy-pop",
    attrs: { hidden: "" },
    children: [
      el("p", {
        class: "spatial-themes-legacy-note",
        text: "세부 타일 통행·전체 1만+ 오브젝트·지역/세계는 여기서 직접 열 수 있습니다.",
      }),
      ...items.map((item) => el("button", {
        class: "spatial-themes-legacy-item",
        attrs: { type: "button" },
        dataset: { testid: `spatial-themes-jump-${item.tab}` },
        children: [el("span", { text: item.label }), el("small", { text: item.count })],
        on: {
          click: () => {
            pop.hidden = true;
            navigate(item.tab);
          },
        },
      })),
    ],
  });
  const trigger = el("button", {
    class: "spatial-themes-legacy-trigger",
    text: "고급 관리 ▾",
    attrs: { type: "button", "aria-expanded": "false" },
    dataset: { testid: "spatial-themes-legacy-trigger" },
    on: {
      click: (event) => {
        event.stopPropagation();
        const nextOpen = pop.hidden;
        pop.hidden = !nextOpen;
        trigger.setAttribute("aria-expanded", String(nextOpen));
      },
    },
  });
  const wrap = el("div", {
    class: "spatial-themes-legacy-menu",
    dataset: { testid: "spatial-themes-legacy-menu" },
    children: [trigger, pop],
  });
  return wrap;
}

function renderThemeCover(pack: ResolvedThemePack): HTMLElement {
  const hasScene = Boolean(pack.coverPlacePreviewUrl) && pack.coverObjects.length >= 2;
  const cover = el("div", {
    class: `spatial-theme-cover${hasScene ? " has-scene" : ""}`,
  });

  if (hasScene && pack.coverPlacePreviewUrl) {
    cover.append(
      el("div", {
        class: "spatial-theme-cover-scene",
        children: [el("img", {
          class: "spatial-theme-scene-img",
          attrs: { src: pack.coverPlacePreviewUrl, alt: pack.spec.name, draggable: "false", loading: "eager" },
        })],
      }),
      ...pack.coverObjects.slice(0, 2).map((card) => el("div", {
        class: "spatial-theme-cover-tile",
        children: [deferredSpatialCardThumb(card, () => renderSpatialCardThumb(card), objectThumbCacheKey(card))],
      })),
    );
  } else if (pack.coverObjects.length > 0) {
    for (const card of pack.coverObjects.slice(0, 4)) {
      cover.append(el("div", {
        class: "spatial-theme-cover-tile",
        children: [deferredSpatialCardThumb(card, () => renderSpatialCardThumb(card), objectThumbCacheKey(card))],
      }));
    }
  } else if (pack.primaryTileset) {
    const url = tilesetImageUrl(pack.primaryTileset);
    cover.append(el("img", {
      class: "spatial-theme-cover-sheet",
      attrs: { src: url, alt: pack.spec.name, draggable: "false", loading: "eager" },
    }));
  }

  const badges = el("div", {
    class: "spatial-theme-badges",
    children: [
      pack.usedMapCount > 0
        ? el("span", { class: "spatial-theme-badge is-used", text: `내 게임 사용 중 · 맵 ${pack.usedMapCount}` })
        : el("span"),
      el("span", { class: "spatial-theme-badge", text: SPATIAL_THEME_CATEGORY_LABEL[pack.spec.category] }),
    ],
  });
  cover.append(badges);
  return cover;
}

function renderThemeCard(pack: ResolvedThemePack, onOpen: (id: string) => void): HTMLElement {
  const stats: HTMLElement[] = [
    el("span", { class: "spatial-theme-stat", text: `건물·소품 ${pack.objectCards.length.toLocaleString()}` }),
  ];
  if (pack.placeCards.length > 0) {
    stats.push(el("span", { class: "spatial-theme-stat", text: `완성 장소 ${pack.placeCards.length}` }));
  }
  stats.push(el("span", { class: "spatial-theme-stat", text: `타일셋 ${pack.tilesets.length}` }));

  return el("button", {
    class: `spatial-theme-card${pack.usedMapCount > 0 ? " is-used" : ""}`,
    attrs: { type: "button" },
    dataset: { testid: `spatial-theme-card-${pack.spec.id}`, themeId: pack.spec.id },
    children: [
      renderThemeCover(pack),
      el("div", {
        class: "spatial-theme-body",
        children: [
          el("h3", { class: "spatial-theme-name", text: pack.spec.name }),
          el("p", { class: "spatial-theme-sub", text: pack.spec.subtitle }),
          el("div", { class: "spatial-theme-stats", children: stats }),
        ],
      }),
    ],
    on: { click: () => onOpen(pack.spec.id) },
  });
}

function renderObjectSampleCard(
  card: SpatialGalleryCard,
  selected: boolean,
  onSelect: (card: SpatialGalleryCard) => void,
): HTMLElement {
  return el("button", {
    class: `spatial-theme-obj-card${selected ? " is-selected" : ""}`,
    attrs: { type: "button", "aria-pressed": String(selected) },
    dataset: { testid: `spatial-theme-obj-${card.id}`, cardId: card.id },
    children: [
      el("div", {
        class: "spatial-theme-obj-art",
        children: [deferredSpatialCardThumb(card, () => renderSpatialCardThumb(card), objectThumbCacheKey(card))],
      }),
      el("strong", { text: card.name }),
      ...(card.subtitle ? [el("small", { text: card.subtitle })] : []),
    ],
    on: { click: () => onSelect(card) },
  });
}

function renderThemeDetailView(
  pack: ResolvedThemePack,
  allObjectCount: number,
  tilesetCount: number,
  navigate: (tab: DatabaseTab) => void,
  rerender: () => void,
): HTMLElement {
  const openTileset = (tilesetId: string): void => {
    setSelectedTileset(tilesetId);
    navigate("spatialTiles");
  };
  const openFullObjectSearch = (tilesetId: string | null, query = ""): void => {
    setSpatialAssetBrowserTileset(tilesetId, query);
    navigate("spatialObjects");
  };

  const topBar = el("header", {
    class: "spatial-themes-top",
    children: [
      el("div", {
        class: "spatial-theme-detail-bar",
        children: [
          el("button", {
            class: "spatial-theme-back",
            text: "← 모든 테마 팩",
            attrs: { type: "button" },
            dataset: { testid: "spatial-theme-back" },
            on: {
              click: () => {
                viewState.selectedThemeId = null;
                viewState.detailSearch = "";
                viewState.selectedObjectId = null;
                rerender();
              },
            },
          }),
          renderLegacyMenu(navigate, allObjectCount, tilesetCount),
        ],
      }),
      el("div", {
        class: "spatial-theme-hero",
        children: [
          el("div", {
            class: "spatial-theme-hero-copy",
            children: [
              el("div", {
                class: "spatial-themes-title-line",
                children: [
                  el("h2", { text: pack.spec.name }),
                  el("span", { class: "spatial-themes-count-pill", text: SPATIAL_THEME_CATEGORY_LABEL[pack.spec.category] }),
                  ...(pack.usedMapCount > 0
                    ? [el("span", { class: "spatial-themes-count-pill", text: `내 게임 맵 ${pack.usedMapCount}곳에서 사용 중` })]
                    : []),
                ],
              }),
              el("p", { text: pack.spec.description }),
            ],
          }),
          el("div", {
            class: "spatial-theme-hero-actions",
            children: [
              el("button", {
                class: "spatial-theme-btn is-primary",
                text: "이 테마로 맵 짓기 (조수)",
                attrs: { type: "button" },
                dataset: { testid: "spatial-theme-ask-ai" },
                on: { click: () => askAssistantForTheme(pack) },
              }),
              ...(pack.primaryTileset
                ? [
                    el("button", {
                      class: "spatial-theme-btn",
                      text: "타일 통행 설정",
                      attrs: { type: "button" },
                      dataset: { testid: "spatial-theme-open-tiles" },
                      on: { click: () => openTileset(pack.primaryTileset!.id) },
                    }),
                  ]
                : []),
              ...(pack.objectCards.length > 0
                ? [
                    el("button", {
                      class: "spatial-theme-btn",
                      text: `전체 ${pack.objectCards.length.toLocaleString()}개 검색`,
                      attrs: { type: "button" },
                      dataset: { testid: "spatial-theme-open-all-objects" },
                      on: { click: () => openFullObjectSearch(pack.primaryTileset?.id ?? null, viewState.detailSearch) },
                    }),
                  ]
                : []),
            ],
          }),
        ],
      }),
    ],
  });

  const scroll = el("div", { class: "spatial-themes-scroll", dataset: { testid: "spatial-theme-detail" } });

  // 섹션 1: 완성 장소 예시
  if (pack.placeCards.length > 0) {
    const placeGrid = el("div", {
      class: "spatial-theme-places-grid",
      children: pack.placeCards.map((place) => {
        const art = place.regionReferenceId
          ? regionReferenceImage(place.regionReferenceId, true)
          : deferredSpatialCardThumb(place, () => renderSpatialCardThumb(place));
        const canPlace = Boolean(place.regionReferenceId);
        return el("article", {
          class: "spatial-theme-place-card",
          dataset: { testid: `spatial-theme-place-${place.localId ?? place.id}` },
          children: [
            el("div", { class: "spatial-theme-place-art", children: [art] }),
            el("div", {
              class: "spatial-theme-place-body",
              children: [
                el("strong", { text: place.name }),
                el("div", {
                  class: "spatial-theme-place-actions",
                  children: [
                    ...(canPlace
                      ? [
                          el("button", {
                            class: "is-primary",
                            text: "맵에 놓기",
                            attrs: { type: "button" },
                            on: {
                              click: () => {
                                if (place.regionReferenceId) {
                                  placeReferenceMapPreset(place.regionReferenceId, rerender);
                                }
                              },
                            },
                          }),
                        ]
                      : []),
                    el("button", {
                      text: "크게 보기",
                      attrs: { type: "button" },
                      on: {
                        click: () => openPlaceDetail(place, {
                          resolveBuild: () => place.regionReferenceId
                            ? () => placeReferenceMapPreset(place.regionReferenceId!, rerender)
                            : undefined,
                        }),
                      },
                    }),
                    el("button", {
                      text: "조수 참고",
                      attrs: { type: "button" },
                      on: { click: () => askAssistantForPlace(place) },
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      }),
    });

    scroll.append(el("section", {
      class: "spatial-themes-section",
      children: [
        el("div", {
          class: "spatial-themes-section-head",
          children: [
            el("div", {
              class: "spatial-themes-section-title",
              children: [
                el("h3", { text: "완성 장소 예시" }),
                el("span", { text: `${pack.placeCards.length}곳 · 바로 맵으로 추가하거나 조수 참고로 넘길 수 있습니다` }),
              ],
            }),
          ],
        }),
        placeGrid,
      ],
    }));
  }

  // 섹션 2: 대표 건물·소품 (큐레이션 18종 + 테마 내 즉시 검색)
  if (pack.objectCards.length > 0) {
    const selectionSlot = el("div");
    const gridSlot = el("div");
    const subLabel = el("span");

    const renderSelectionBar = (card: SpatialGalleryCard | undefined): void => {
      if (!card) {
        selectionSlot.replaceChildren();
        return;
      }
      selectionSlot.replaceChildren(el("div", {
        class: "spatial-theme-selection-bar",
        dataset: { testid: "spatial-theme-selection-bar" },
        children: [
          el("div", {
            class: "spatial-theme-selection-art",
            children: [renderSpatialCardThumb(card)],
          }),
          el("div", {
            class: "spatial-theme-selection-info",
            children: [
              el("strong", { text: card.name }),
              el("span", { text: `${card.tilesetId ?? ""} · 조수에게 배치·변형을 지시하거나 전체 브라우저에서 자세히 볼 수 있습니다` }),
            ],
          }),
          el("div", {
            class: "spatial-theme-selection-actions",
            children: [
              el("button", {
                class: "spatial-theme-btn is-primary",
                text: "조수에게 시키기",
                attrs: { type: "button" },
                on: { click: () => askAssistantForObject(card) },
              }),
              el("button", {
                class: "spatial-theme-btn",
                text: "전체 브라우저에서 보기",
                attrs: { type: "button" },
                on: { click: () => openFullObjectSearch(card.tilesetId ?? null, card.name) },
              }),
            ],
          }),
        ],
      }));
    };

    const paintObjects = (): void => {
      const q = viewState.detailSearch.trim().toLocaleLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const list = words.length > 0
        ? pack.objectCards
            .filter((card) => words.every((w) => `${card.name} ${card.subtitle ?? ""}`.toLocaleLowerCase().includes(w)))
            .slice(0, 24)
        : pack.curatedObjects;

      subLabel.textContent = words.length > 0
        ? `검색 결과 상위 ${list.length}종 (전체 ${pack.objectCards.length.toLocaleString()}종 중)`
        : `전체 ${pack.objectCards.length.toLocaleString()}종 중 대표 ${list.length}종 선별`;

      const selectedCard = list.find((c) => c.id === viewState.selectedObjectId);
      renderSelectionBar(selectedCard);

      if (list.length === 0) {
        gridSlot.replaceChildren(el("div", {
          class: "spatial-themes-empty",
          text: `「${viewState.detailSearch}」에 맞는 소품이 이 테마에 없습니다.`,
        }));
        return;
      }

      gridSlot.replaceChildren(el("div", {
        class: "spatial-theme-objects-grid",
        children: list.map((card) => renderObjectSampleCard(card, card.id === viewState.selectedObjectId, (chosen) => {
          const prevSelected = viewState.selectedObjectId;
          viewState.selectedObjectId = prevSelected === chosen.id ? null : chosen.id;
          renderSelectionBar(viewState.selectedObjectId ? chosen : undefined);
          for (const btn of gridSlot.querySelectorAll<HTMLButtonElement>(".spatial-theme-obj-card")) {
            const isSel = btn.dataset.cardId === viewState.selectedObjectId;
            btn.classList.toggle("is-selected", isSel);
            btn.setAttribute("aria-pressed", String(isSel));
          }
        })),
      }));
    };

    const inlineSearch = el("input", {
      class: "spatial-themes-inline-search",
      value: viewState.detailSearch,
      attrs: {
        type: "search",
        placeholder: `이 테마 ${pack.objectCards.length.toLocaleString()}종 안에서 검색…`,
        "aria-label": "테마 내 오브젝트 검색",
      },
      dataset: { testid: "spatial-theme-detail-search" },
      on: {
        input: () => {
          viewState.detailSearch = inlineSearch.value;
          paintObjects();
        },
      },
    });

    paintObjects();

    scroll.append(el("section", {
      class: "spatial-themes-section",
      children: [
        el("div", {
          class: "spatial-themes-section-head",
          children: [
            el("div", {
              class: "spatial-themes-section-title",
              children: [el("h3", { text: "대표 건물 · 소품" }), subLabel],
            }),
            inlineSearch,
          ],
        }),
        selectionSlot,
        gridSlot,
      ],
    }));
  }

  // 섹션 3: 포함된 타일셋 시트
  if (pack.tilesets.length > 0) {
    scroll.append(el("section", {
      class: "spatial-themes-section",
      children: [
        el("div", {
          class: "spatial-themes-section-head",
          children: [
            el("div", {
              class: "spatial-themes-section-title",
              children: [
                el("h3", { text: "포함된 타일셋 시트" }),
                el("span", { text: "누르면 해당 시트의 통행·자동 타일 편집 화면으로 이동합니다" }),
              ],
            }),
          ],
        }),
        el("div", {
          class: "spatial-theme-tilesets-row",
          children: pack.tilesets.map((ts) => el("button", {
            class: "spatial-theme-tileset-chip",
            attrs: { type: "button" },
            dataset: { testid: `spatial-theme-tileset-${ts.id}` },
            children: [
              tilesetListThumb(ts),
              el("span", { text: ts.name || ts.id }),
              el("small", { text: `${ts.count.toLocaleString()}칸` }),
            ],
            on: { click: () => openTileset(ts.id) },
          })),
        }),
      ],
    }));
  }

  return el("div", {
    class: "spatial-themes-shell",
    dataset: { testid: "spatial-themes-workspace", view: "detail", themeId: pack.spec.id },
    children: [topBar, scroll],
  });
}

export function renderSpatialThemesTab(
  host: HTMLElement,
  navigate: (tab: DatabaseTab) => void,
  rerender: () => void,
): void {
  const project = store.getCurrent();
  const { packs, allObjects } = buildThemePacks(project);
  const tilesetCount = Object.keys(project.tilesets).length;

  // 드릴다운 상세 보기
  if (viewState.selectedThemeId) {
    const selectedPack = packs.find((pack) => pack.spec.id === viewState.selectedThemeId);
    if (selectedPack) {
      host.append(renderThemeDetailView(selectedPack, allObjects.length, tilesetCount, navigate, rerender));
      return;
    }
    viewState.selectedThemeId = null;
  }

  const usedThemeCount = packs.filter((p) => p.usedMapCount > 0).length;

  const scroll = el("div", { class: "spatial-themes-scroll", dataset: { testid: "spatial-themes-list" } });

  const openPack = (id: string): void => {
    viewState.scrollTop = scroll.scrollTop;
    viewState.selectedThemeId = id;
    viewState.detailSearch = "";
    viewState.selectedObjectId = null;
    rerender();
  };

  const paintBody = (): void => {
    const query = viewState.query.trim().toLocaleLowerCase();
    const words = query.split(/\s+/).filter(Boolean);

    const visiblePacks = packs.filter((pack) => {
      if (viewState.filter === "used" && pack.usedMapCount === 0) return false;
      if (viewState.filter !== "all" && viewState.filter !== "used" && pack.spec.category !== viewState.filter) {
        return false;
      }
      if (words.length === 0) return true;
      const hay = `${pack.spec.name} ${pack.spec.subtitle} ${pack.spec.description} ${pack.spec.tags.join(" ")} ${pack.tilesets.map((t) => `${t.name} ${t.id}`).join(" ")}`.toLocaleLowerCase();
      return words.every((w) => hay.includes(w));
    });

    const nodes: HTMLElement[] = [];

    if (visiblePacks.length > 0) {
      nodes.push(el("div", {
        class: "spatial-themes-grid",
        dataset: { testid: "spatial-themes-grid" },
        children: visiblePacks.map((pack) => renderThemeCard(pack, openPack)),
      }));
    } else if (words.length === 0) {
      nodes.push(el("div", {
        class: "spatial-themes-empty",
        text: viewState.filter === "used"
          ? "현재 프로젝트 맵에서 사용 중인 테마가 아직 없습니다."
          : "조건에 맞는 테마 팩이 없습니다.",
      }));
    }

    // 검색어가 있으면 1.2만 개 오브젝트 중 상위 18건도 바로 아래에 보여준다.
    if (words.length > 0) {
      const matchedObjects = allObjects
        .filter((card) => words.every((w) => `${card.name} ${card.subtitle ?? ""}`.toLocaleLowerCase().includes(w)))
        .slice(0, 18);

      if (matchedObjects.length > 0) {
        nodes.push(el("section", {
          class: "spatial-themes-section",
          children: [
            el("div", {
              class: "spatial-themes-section-head",
              children: [
                el("div", {
                  class: "spatial-themes-section-title",
                  children: [
                    el("h3", { text: `일치하는 건물·소품` }),
                    el("span", { text: `상위 ${matchedObjects.length}종 · 클릭하면 조수 입력창에 바로 넣습니다` }),
                  ],
                }),
                el("button", {
                  class: "spatial-theme-btn",
                  text: "전체 오브젝트에서 더 보기 →",
                  attrs: { type: "button" },
                  on: {
                    click: () => {
                      setSpatialAssetBrowserTileset(null, viewState.query);
                      navigate("spatialObjects");
                    },
                  },
                }),
              ],
            }),
            el("div", {
              class: "spatial-theme-objects-grid",
              children: matchedObjects.map((card) => renderObjectSampleCard(card, false, (chosen) => askAssistantForObject(chosen))),
            }),
          ],
        }));
      } else if (visiblePacks.length === 0) {
        nodes.push(el("div", {
          class: "spatial-themes-empty",
          text: `「${viewState.query}」와 일치하는 테마나 건물·소품이 없습니다.`,
        }));
      }
    }

    scroll.replaceChildren(...nodes);
  };

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const searchInput = el("input", {
    class: "spatial-themes-search",
    value: viewState.query,
    attrs: {
      type: "search",
      placeholder: "테마·건물·소품 검색 (예: 조선, 편의점, 여관, 침대, 마법…)",
      "aria-label": "공간 테마 및 오브젝트 검색",
    },
    dataset: { testid: "spatial-themes-search" },
    on: {
      input: () => {
        viewState.query = searchInput.value;
        if (searchTimer !== undefined) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          searchTimer = undefined;
          paintBody();
        }, 120);
      },
    },
  });

  const chips = el("div", {
    class: "spatial-themes-chips",
    attrs: { role: "tablist", "aria-label": "테마 분류" },
  });

  const chipButtons = SPATIAL_THEME_FILTERS.map((f) => {
    const label = f.id === "used" && usedThemeCount > 0 ? `${f.label} ${usedThemeCount}` : f.label;
    const btn = el("button", {
      class: "spatial-themes-chip",
      text: label,
      attrs: { type: "button", role: "tab", "aria-selected": "false" },
      dataset: { testid: `spatial-themes-filter-${f.id}`, filterId: f.id },
      on: {
        click: () => {
          viewState.filter = f.id;
          syncChips();
          paintBody();
        },
      },
    });
    return btn;
  });
  chips.replaceChildren(...chipButtons);

  const syncChips = (): void => {
    for (const btn of chipButtons) {
      const active = btn.dataset.filterId === viewState.filter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    }
  };

  syncChips();
  paintBody();

  const header = el("header", {
    class: "spatial-themes-top",
    children: [
      el("div", {
        class: "spatial-themes-head-row",
        children: [
          el("div", {
            class: "spatial-themes-heading",
            children: [
              el("div", {
                class: "spatial-themes-title-line",
                children: [
                  el("h2", { text: "공간 테마 팩" }),
                  el("span", {
                    class: "spatial-themes-count-pill",
                    text: `${packs.length}개 테마 · 총 ${allObjects.length.toLocaleString()}종 묶음`,
                  }),
                ],
              }),
              el("p", {
                text: "수만 개의 개별 부품 대신 세계관 화풍별로 묶어 봅니다. 테마를 고르면 대표 건물·완성 장소를 보고 바로 조수에게 맡길 수 있습니다.",
              }),
            ],
          }),
          renderLegacyMenu(navigate, allObjects.length, tilesetCount),
        ],
      }),
      el("div", {
        class: "spatial-themes-toolbar",
        children: [searchInput, chips],
      }),
    ],
  });

  const shell = el("div", {
    class: "spatial-themes-shell",
    dataset: { testid: "spatial-themes-workspace", view: "list" },
    children: [header, scroll],
  });

  host.append(shell);
  if (viewState.scrollTop > 0) {
    queueMicrotask(() => {
      if (scroll.isConnected) scroll.scrollTop = viewState.scrollTop;
    });
  }
}

export function resetSpatialThemesViewState(): void {
  viewState.selectedThemeId = null;
  viewState.detailSearch = "";
  viewState.selectedObjectId = null;
}
