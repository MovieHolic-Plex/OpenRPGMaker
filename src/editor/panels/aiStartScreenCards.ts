// AI 시작 화면 — 텍스트 나열 대신 타일/캐릭터 프리뷰 소수 개.
import type { AiActivityLogRecord } from "@/ai/activityLog";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  charsetFrameSource,
  EASYRPG_CHARSET_ASSETS,
} from "@/assets/easyrpgRtp";
import { HOUSE_KITS } from "@/editor/houseKit";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { SuggestedRegionCommand } from "@/editor/regionTask/suggestedCommands";
import { TILE } from "@/project/defaults/constants";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function formatRelativeTime(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function summarizeActivityResult(record: AiActivityLogRecord): string {
  if (!record.result.ok) return "오류";
  const cells = record.result.changedCells ?? 0;
  const events = record.result.changedEvents ?? 0;
  if (cells === 0 && events === 0) return "변경 없음";
  const parts: string[] = [];
  if (cells > 0) parts.push(`${cells}칸`);
  if (events > 0) parts.push(`이벤트 ${events}건`);
  return parts.join(" · ");
}

/** 시작 화면 비주얼 프롬프트 — 초보자용 결과 중심 5개. */
export type AiVisualStartPrompt = {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
  /** 타일 모자이크(행 우선 1D). */
  readonly mosaicTiles?: readonly number[];
  readonly mosaicCols?: number;
  /** 캐릭터셋 미리보기. */
  readonly charset?: {
    readonly textureKey: string;
    readonly path: string;
    readonly characterIndex: number;
  };
};

const BLUE = HOUSE_KITS["blue-stone"];

/** 처음 바로 시도할 수 있는 결과 중심 5개 카드. 내부 도구/스킬 이름은 노출하지 않는다. */
export function defaultAiVisualStartPrompts(): readonly AiVisualStartPrompt[] {
  const people = EASYRPG_CHARSET_ASSETS.find((asset) => asset.textureKey === "tex_easyrpg_charset_people1");
  return [
    {
      id: "place",
      label: "장소 만들기",
      instruction: "현재 맵에 집과 길, 나무가 자연스럽게 이어지는 작은 장소를 만들어줘.",
      mosaicCols: 3,
      mosaicTiles: [
        BLUE.roof.body,
        BLUE.roof.body,
        TILE.TREE,
        BLUE.wall.mid[0],
        BLUE.windowTile,
        TILE.PATH,
        TILE.GRASS,
        TILE.PATH,
        TILE.FLOWERS,
      ],
    },
    {
      id: "character",
      label: "등장인물 만들기",
      instruction: "현재 장소에 어울리는 등장인물 한 명을 만들고, 말을 걸면 자연스럽게 인사하도록 해줘.",
      charset: people
        ? {
            textureKey: people.textureKey,
            path: people.path,
            characterIndex: 0,
          }
        : undefined,
      mosaicCols: 1,
      mosaicTiles: [TILE.PATH],
    },
    {
      id: "quest",
      label: "퀘스트 만들기",
      instruction: "현재 맵의 등장인물과 장소를 활용한 짧은 퀘스트를 만들어줘. 시작 조건과 완료 보상도 포함해줘.",
      charset: people
        ? {
            textureKey: people.textureKey,
            path: people.path,
            characterIndex: 1,
          }
        : undefined,
      mosaicCols: 1,
      mosaicTiles: [TILE.GRASS],
    },
    {
      id: "selection",
      label: "선택 영역 꾸미기",
      instruction: "선택한 영역을 나무와 풀, 꽃, 자연스러운 길이 어울리도록 꾸며줘.",
      mosaicCols: 3,
      mosaicTiles: [
        TILE.DARK_GRASS,
        TILE.TREE,
        TILE.DARK_GRASS,
        TILE.GRASS,
        TILE.PATH,
        TILE.FLOWERS,
        TILE.GRASS,
        TILE.PATH,
        TILE.GRASS,
      ],
    },
    {
      id: "audit",
      label: "문제 검사/수정",
      instruction: "현재 맵에서 이동 불가, 막힌 입구, 어색한 타일이나 이벤트 문제를 검사하고 안전하게 고칠 변경안을 보여줘.",
      mosaicCols: 3,
      mosaicTiles: [
        TILE.WALL,
        TILE.PATH,
        TILE.WALL,
        TILE.GRASS,
        TILE.PATH,
        TILE.FLOWERS,
        TILE.GRASS,
        TILE.PATH,
        TILE.GRASS,
      ],
    },
  ];
}

function renderTileCell(tileset: TilesetDef | null, tile: number, size: number): HTMLElement {
  const cell = el("div", {
    class: "ai-start-visual-tile",
    attrs: {
      style: tileset
        ? `width:${size}px;height:${size}px;${tilesetTileBackgroundStyle(tileset, tile, size)}`
        : `width:${size}px;height:${size}px;background:var(--control-bg)`,
      title: `tile ${tile}`,
    },
  });
  return cell;
}

function renderCharsetThumb(charset: NonNullable<AiVisualStartPrompt["charset"]>, displayHeight = 48): HTMLElement {
  const source = charsetFrameSource({
    characterIndex: charset.characterIndex,
    direction: "down",
    pattern: 1,
  });
  const scale = displayHeight / CHARSET_FRAME_HEIGHT;
  const width = Math.round(CHARSET_FRAME_WIDTH * scale);
  const height = Math.round(CHARSET_FRAME_HEIGHT * scale);
  return el("div", {
    class: "ai-start-visual-charset",
    attrs: {
      style: [
        `width:${width}px`,
        `height:${height}px`,
        `background-image:url("/${charset.path.replaceAll('"', '\\"')}")`,
        `background-repeat:no-repeat`,
        `background-size:${CHARSET_SHEET_COLUMNS * width}px auto`,
        `background-position:-${Math.round(source.x * scale)}px -${Math.round(source.y * scale)}px`,
        `image-rendering:pixelated`,
      ].join(";"),
      title: charset.textureKey,
    },
  });
}

function renderVisualPreview(prompt: AiVisualStartPrompt, tileset: TilesetDef | null): HTMLElement {
  const stage = el("div", { class: "ai-start-visual-stage", dataset: { testid: `ai-start-visual-stage-${prompt.id}` } });
  if (prompt.charset) {
    stage.append(renderCharsetThumb(prompt.charset));
    return stage;
  }
  const tiles = prompt.mosaicTiles ?? [];
  const cols = Math.max(1, prompt.mosaicCols ?? 3);
  const size = 20;
  const grid = el("div", {
    class: "ai-start-visual-mosaic",
    attrs: {
      style: `grid-template-columns:repeat(${cols}, ${size}px)`,
    },
  });
  for (const tile of tiles) {
    grid.append(renderTileCell(tileset, tile, size));
  }
  stage.append(grid);
  return stage;
}

/**
 * 이미지 리치 시작 갤러리 — 결과 중심 카드 5개. 클릭 시 instruction을 넘긴다.
 */
export function buildVisualStartGallery(opts: {
  readonly tileset: TilesetDef | null;
  readonly prompts?: readonly AiVisualStartPrompt[];
  readonly onPick: (instruction: string, id: string) => void;
}): HTMLElement {
  const prompts = opts.prompts ?? defaultAiVisualStartPrompts();
  const cards = prompts.map((prompt) =>
    el("button", {
      class: "ai-start-visual-card",
      attrs: {
        type: "button",
        title: prompt.instruction,
      },
      // 집 카드는 기존 testid 유지(ai-start-build-house).
      dataset: {
        testid: prompt.id === "house" ? "ai-start-build-house" : `ai-start-visual-${prompt.id}`,
      },
      children: [
        renderVisualPreview(prompt, opts.tileset),
        el("span", { class: "ai-start-visual-label", text: prompt.label }),
      ],
      on: {
        click: () => opts.onPick(prompt.instruction, prompt.id),
      },
    })
  );

  return el("div", {
    class: "ai-start-visual-gallery",
    dataset: { testid: "ai-start-visual-gallery" },
    children: cards,
  });
}

export function buildTryRegionCard(opts: {
  readonly commands: readonly SuggestedRegionCommand[];
  readonly onPick: (instruction: string) => void;
}): HTMLElement {
  return el("div", {
    class: "ai-start-basic-card",
    dataset: { testid: "ai-start-try-region" },
    children: [
      el("div", { class: "ai-start-basic-card-title", text: "빠른 예시" }),
      el("div", {
        class: "ai-start-basic-chips",
        children: opts.commands.map((command) =>
          el("button", {
            class: "ai-start-basic-chip",
            text: command.label,
            attrs: { type: "button", title: command.instruction },
            dataset: { testid: `ai-start-try-${command.id}` },
            on: { click: () => opts.onPick(command.instruction) },
          })
        ),
      }),
    ],
  });
}

export function buildRecentAiWorkCard(records: readonly AiActivityLogRecord[], now: Date): HTMLElement | null {
  if (records.length === 0) return null;
  const rows = records.slice(0, 3).map((record) =>
    el("div", {
      class: "ai-start-recent-row",
      children: [
        el("span", { class: "ai-start-recent-instruction", text: record.instruction.slice(0, 40) }),
        el("span", {
          class: "ai-start-recent-meta",
          text: `${summarizeActivityResult(record)} · ${formatRelativeTime(record.at, now)}`,
        }),
      ],
    })
  );
  return el("div", {
    class: "ai-start-basic-card",
    dataset: { testid: "ai-start-recent-work" },
    children: [el("div", { class: "ai-start-basic-card-title", text: "최근 AI 작업" }), ...rows],
  });
}
