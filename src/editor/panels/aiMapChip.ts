// editor/panels/aiMapChip.ts
// 작업 타임라인 행의 「맵 칩」 — 툴 호출이 건드린 자리를 46×32 크롭으로 보여 준다(제안서 P2 「show the work」).
//
// 좌표는 툴마다 다른 모양으로 온다(x/y 한 칸, x/y/w/h, rect, region, 결과 data 의 좌표). 여기서 한 번
// 읽어 RegionRect 로 만들고, 칩 창은 최소 7×5 타일로 넓혀(한 칸만 그리면 46px 에 타일 하나가 뭉개진다)
// 맵 안으로 자른다. 그림은 변경 카드와 같은 renderRegionSnapshot 이 그린다 — 두 표면이 같은 렌더러를 쓴다.
// 실패(타일셋 미로드 등)는 아이콘 칩으로 떨어지고 예외는 밖으로 새지 않는다.

import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import type { GameMap, Project } from "@/project/types";
import { el } from "@/util/dom";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
import type { ToolResult } from "@/editor/tools";

const CHIP_MIN_WIDTH = 7;
const CHIP_MIN_HEIGHT = 5;
const CHIP_PAD = 1;
/** 46px 칩을 2배로 그려 또렷하게(픽셀 아트). CSS 가 46 으로 줄인다. */
const CHIP_TARGET_WIDTH = 92;

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rectFrom(source: unknown): RegionRect | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const x = finite(record.x);
  const y = finite(record.y);
  if (x === null || y === null || x < 0 || y < 0) return null;
  const width = finite(record.width) ?? finite(record.w) ?? 1;
  const height = finite(record.height) ?? finite(record.h) ?? 1;
  if (width < 1 || height < 1) return null;
  return { x: Math.floor(x), y: Math.floor(y), width: Math.floor(width), height: Math.floor(height) };
}

/** 툴 인자 → 결과 data 순으로 본다. 어디에도 좌표가 없으면 null(아이콘 칩). */
export function regionFromToolCall(
  args: Record<string, unknown> | undefined,
  result: Pick<ToolResult, "data">,
): RegionRect | null {
  const candidates: unknown[] = [];
  if (args) {
    candidates.push(args.rect, args.region, args.area, args);
  }
  const data = result.data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    candidates.push(record.region, record.rect, record.area, record);
  }
  for (const candidate of candidates) {
    const rect = rectFrom(candidate);
    if (rect) return rect;
  }
  return null;
}

/** 영역을 가운데 두고 최소 7×5 로 넓힌 창을 맵 안으로 자른다. 큰 영역은 여백 1칸만 더한다. */
export function chipWindow(region: RegionRect, map: Pick<GameMap, "width" | "height">): RegionRect {
  const width = Math.min(map.width, Math.max(CHIP_MIN_WIDTH, region.width + CHIP_PAD * 2));
  const height = Math.min(map.height, Math.max(CHIP_MIN_HEIGHT, region.height + CHIP_PAD * 2));
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  const x = Math.min(Math.max(0, Math.round(centerX - width / 2)), Math.max(0, map.width - width));
  const y = Math.min(Math.max(0, Math.round(centerY - height / 2)), Math.max(0, map.height - height));
  return { x, y, width, height };
}

export type ChipShotRenderer = (
  project: Project,
  map: GameMap,
  region: RegionRect,
  targetWidth: number,
) => Promise<HTMLCanvasElement>;

const defaultRenderShot: ChipShotRenderer = (project, map, region, targetWidth) =>
  renderRegionSnapshot(project, map, region, { targetWidth });

function iconChip(icon: DeckIconName): HTMLElement {
  return el("span", { class: "ai-act-chip is-icon", attrs: { "aria-hidden": "true" }, children: [deckIcon(icon, { size: 15 })] });
}

/** 맵 크롭 칩. 맵이 없으면 아이콘 칩, 렌더 실패도 아이콘 칩 — 로그 렌더를 볼모로 잡지 않는다. */
export function renderMapChip(input: {
  readonly project: Project;
  readonly mapId: string;
  readonly region: RegionRect;
  readonly icon?: DeckIconName;
  readonly renderShot?: ChipShotRenderer;
}): HTMLElement {
  const map = input.project.maps[input.mapId];
  const icon = input.icon ?? "pin";
  if (!map) return iconChip(icon);
  const window = chipWindow(input.region, map);
  const chip = el("span", {
    class: "ai-act-chip",
    attrs: { "aria-hidden": "true" },
    dataset: { region: `${input.region.x},${input.region.y} ${input.region.width}×${input.region.height}` },
  });
  const render = input.renderShot ?? defaultRenderShot;
  void render(input.project, map, window, CHIP_TARGET_WIDTH).then(
    (canvas) => {
      chip.append(canvas, el("span", { class: "ai-act-pin" }));
    },
    () => {
      chip.classList.add("is-icon");
      chip.append(deckIcon(icon, { size: 15 }));
    },
  );
  return chip;
}
