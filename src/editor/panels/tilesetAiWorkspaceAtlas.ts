import { gridSelectionGeometry } from "@/editor/panels/tilesetGridSelection";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { proposalsForAiReview, type TilesetAiReviewProposal } from "@/editor/tilesetAiNativeReviewModel";
import type { TilesetAiConversationSnapshot } from "@/editor/tilesetAiConversationSession";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export type TilesetAiAtlasFilter = "all" | "confirmed" | "questions" | "unclassified";
export type TilesetAiAtlasZoom = 2 | 3 | 4;

type AtlasOptions = {
  readonly filter: TilesetAiAtlasFilter;
  readonly onFilter: (filter: TilesetAiAtlasFilter) => void;
  readonly onQuestion: (proposalId: string) => void;
  readonly onZoom: (zoom: TilesetAiAtlasZoom) => void;
  readonly snapshot: TilesetAiConversationSnapshot;
  readonly tileset: TilesetDef;
  readonly zoom: TilesetAiAtlasZoom;
};

type AtlasRegion = {
  readonly kind: Exclude<TilesetAiAtlasFilter, "all">;
  readonly proposal: TilesetAiReviewProposal;
};

const FILTERS: readonly { readonly id: TilesetAiAtlasFilter; readonly label: string }[] = [
  { id: "all", label: "전체" },
  { id: "confirmed", label: "확정" },
  { id: "questions", label: "확인 필요" },
  { id: "unclassified", label: "낮은 확신" },
];

const ZOOMS: readonly TilesetAiAtlasZoom[] = [2, 3, 4];

export function renderTilesetAiWorkspaceAtlas(options: AtlasOptions): HTMLElement {
  const regions = atlasRegions(options.snapshot);
  const visible = options.filter === "all" ? regions : regions.filter((region) => region.kind === options.filter);
  const rows = Math.ceil(options.tileset.count / options.tileset.tilesPerRow);
  const atlasWidth = options.tileset.tilesPerRow * options.tileset.tileSize * options.zoom;
  const atlasHeight = rows * options.tileset.tileSize * options.zoom;
  const atlasStyle = [
    `--ai-atlas-columns:${options.tileset.tilesPerRow}`,
    `--ai-atlas-rows:${rows}`,
    `--ai-atlas-tile-size:${options.tileset.tileSize}px`,
    `--ai-atlas-zoom:${options.zoom}`,
    `--ai-atlas-width:${atlasWidth}px`,
    `--ai-atlas-height:${atlasHeight}px`,
  ].join(";");
  return el("section", {
    class: "tileset-ai-workspace-atlas",
    attrs: { "aria-label": "AI가 분석한 전체 타일셋" },
    dataset: { testid: "tileset-ai-workspace-atlas" },
    children: [
      el("header", {
        class: "tileset-ai-atlas-toolbar",
        children: [renderFilters(options, regions), renderViewportControls(options)],
      }),
      el("div", {
        class: "tileset-ai-atlas-scroll",
        children: [
          el("div", {
            class: "tileset-ai-atlas-canvas",
            attrs: { style: atlasStyle },
            children: [
              el("img", {
                class: "tileset-ai-atlas-image",
                attrs: { alt: `${options.tileset.name} 전체 타일셋`, draggable: "false", src: tilesetImageUrl(options.tileset) },
              }),
              ...visible.map((region) => renderRegion(region, options)),
            ],
          }),
        ],
      }),
      renderLegend(),
    ],
  });
}

function renderFilters(options: AtlasOptions, regions: readonly AtlasRegion[]): HTMLElement {
  return el("div", {
    class: "tileset-ai-atlas-filters",
    attrs: { role: "group", "aria-label": "분석 결과 필터" },
    children: FILTERS.map((filter) => {
      const count = filter.id === "all" ? regions.length : regions.filter((region) => region.kind === filter.id).length;
      return el("button", {
        class: `tileset-ai-atlas-filter${filter.id === options.filter ? " active" : ""}`,
        text: `${filter.label} ${count}`,
        attrs: { type: "button", "aria-pressed": String(filter.id === options.filter) },
        dataset: { testid: `tileset-ai-atlas-filter-${filter.id}` },
        on: { click: () => options.onFilter(filter.id) },
      });
    }),
  });
}

function renderViewportControls(options: AtlasOptions): HTMLElement {
  const zoomIndex = ZOOMS.indexOf(options.zoom);
  return el("div", {
    class: "tileset-ai-atlas-viewport-controls",
    children: [
      el("div", {
        class: "tileset-ai-atlas-zoom",
        attrs: { role: "group", "aria-label": "타일셋 배율" },
        children: [
          viewportButton("−", "축소", () => options.onZoom(ZOOMS[Math.max(0, zoomIndex - 1)] ?? 2)),
          ...ZOOMS.map((zoom) => el("button", {
            class: zoom === options.zoom ? "active" : "",
            text: `${zoom}x`,
            attrs: { type: "button", "aria-pressed": String(zoom === options.zoom) },
            dataset: { testid: `tileset-ai-atlas-zoom-${zoom}` },
            on: { click: () => options.onZoom(zoom) },
          })),
          viewportButton("+", "확대", () => options.onZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)] ?? 4)),
        ],
      }),
      el("div", {
        class: "tileset-ai-atlas-pan",
        attrs: { role: "group", "aria-label": "타일셋 화면 이동" },
        children: [
          viewportButton("←", "왼쪽으로 이동", () => panAtlas(-96, 0)),
          viewportButton("↑", "위로 이동", () => panAtlas(0, -96)),
          viewportButton("↓", "아래로 이동", () => panAtlas(0, 96)),
          viewportButton("→", "오른쪽으로 이동", () => panAtlas(96, 0)),
          viewportButton("맞춤", "전체 화면에 맞춤", () => fitAtlas(options)),
        ],
      }),
    ],
  });
}

function viewportButton(text: string, label: string, click: () => void): HTMLButtonElement {
  return el("button", { text, attrs: { type: "button", "aria-label": label }, on: { click } });
}

function panAtlas(left: number, top: number): void {
  const scroll = document.querySelector<HTMLElement>("[data-testid='tileset-ai-workspace-atlas'] .tileset-ai-atlas-scroll");
  if (!scroll) return;
  scroll.scrollLeft += left;
  scroll.scrollTop += top;
}

function fitAtlas(options: AtlasOptions): void {
  options.onZoom(2);
  requestAnimationFrame(() => {
    const scroll = document.querySelector<HTMLElement>("[data-testid='tileset-ai-workspace-atlas'] .tileset-ai-atlas-scroll");
    if (!scroll) return;
    scroll.scrollLeft = 0;
    scroll.scrollTop = 0;
  });
}

function renderRegion(region: AtlasRegion, options: AtlasOptions): HTMLElement {
  const geometry = gridSelectionGeometry(region.proposal.tileIds, {
    tileCount: options.tileset.count,
    tilesPerRow: options.tileset.tilesPerRow,
  });
  const rows = Math.ceil(options.tileset.count / options.tileset.tilesPerRow);
  const style = [
    `left:${(geometry.x / options.tileset.tilesPerRow) * 100}%`,
    `top:${(geometry.y / rows) * 100}%`,
    `width:${(geometry.width / options.tileset.tilesPerRow) * 100}%`,
    `height:${(geometry.height / rows) * 100}%`,
  ].join(";");
  const active = options.snapshot.current?.id === region.proposal.id;
  const pending = region.proposal.status === "pending";
  return el("button", {
    class: `tileset-ai-atlas-region ${region.kind}${active ? " active" : ""}`,
    attrs: {
      type: "button",
      style,
      title: pending
        ? `${region.proposal.name} · 신뢰도 ${Math.round(region.proposal.confidence * 100)}% · 클릭해서 이 질문 열기`
        : `${region.proposal.name} · 신뢰도 ${Math.round(region.proposal.confidence * 100)}% · 확정 · 적용 대기`,
      "aria-label": `${region.proposal.name}, ${region.proposal.tileIds.length}칸${pending ? ", 클릭해서 이 질문 열기" : ", 확정됨"}`,
    },
    dataset: { proposalId: region.proposal.id, testid: `tileset-ai-atlas-region-${region.proposal.id}` },
    children: [el("span", {
      class: "tileset-ai-atlas-region-label",
      text: `${region.proposal.name} · ${region.proposal.tileIds.length}칸`,
    })],
    on: { click: () => { if (pending) options.onQuestion(region.proposal.id); } },
  });
}

function atlasRegions(snapshot: TilesetAiConversationSnapshot): readonly AtlasRegion[] {
  return proposalsForAiReview(snapshot.state).map((proposal) => ({
    kind: proposal.status === "accepted" ? "confirmed" : proposal.confidence >= 0.5 ? "questions" : "unclassified",
    proposal,
  }));
}

function renderLegend(): HTMLElement {
  const items: readonly [string, string][] = [
    ["confirmed", "확정 · 적용 대기"],
    ["questions", "확인 필요"],
    ["unclassified", "낮은 확신"],
  ];
  return el("div", {
    class: "tileset-ai-atlas-legend",
    children: items.map(([className, label]) => el("span", {
      children: [el("i", { class: className, attrs: { "aria-hidden": "true" } }), label],
    })),
  });
}
