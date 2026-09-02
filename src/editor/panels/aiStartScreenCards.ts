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

export type AiAuthoringExampleKind = "road" | "npc" | "shop" | "chest" | "house" | "quest";

export type AiAuthoringExample = {
  readonly id: AiAuthoringExampleKind;
  readonly kind: AiAuthoringExampleKind;
  readonly label: string;
  readonly instruction: string;
};

/** 에디터 AI가 실제로 저작할 수 있는 대표 사례. 카드 3개 제한과 별개인 작은 프롬프트 칩이다. */
export const AI_AUTHORING_EXAMPLES: readonly AiAuthoringExample[] = [
  {
    id: "road",
    kind: "road",
    label: "길",
    instruction: "현재 맵의 입구에서 중심 광장까지 2칸 폭 돌길을 연결하고, 막힘 없이 걸을 수 있는지 확인해줘.",
  },
  {
    id: "npc",
    kind: "npc",
    label: "NPC",
    instruction: "광장 주변에 서로 다른 대사와 역할을 가진 NPC 3명을 배치하고, 말을 걸면 자연스럽게 인사하게 해줘.",
  },
  {
    id: "shop",
    kind: "shop",
    label: "상점",
    instruction: "길가에 상점 NPC를 만들고, 말을 걸면 회복약과 해독초를 사고팔 수 있게 해줘.",
  },
  {
    id: "chest",
    kind: "chest",
    label: "상자",
    instruction: "집 옆에 한 번만 열리는 보물상자를 놓고, 열면 50G를 얻은 뒤 열린 모습으로 남게 해줘.",
  },
  {
    id: "house",
    kind: "house",
    label: "집",
    instruction: "길에 맞닿은 작은 집을 만들고, 문을 조사하면 실내 맵으로 들어갔다가 다시 밖으로 나올 수 있게 해줘.",
  },
  {
    id: "quest",
    kind: "quest",
    label: "퀘스트",
    instruction: "마을 NPC에게서 시작해 보물상자를 찾고 돌아오면 보상을 받는 짧은 퀘스트를 만들어줘.",
  },
];

export function buildAiAuthoringExamples(opts: {
  readonly examples?: readonly AiAuthoringExample[];
  readonly onPick: (instruction: string, id: string) => void;
}): HTMLElement {
  const examples = opts.examples ?? AI_AUTHORING_EXAMPLES;
  return el("div", {
    class: "ai-authoring-examples",
    dataset: { testid: "ai-authoring-examples" },
    children: [
      el("span", { class: "ai-authoring-examples-title", text: "이런 것도 만들 수 있어요" }),
      el("div", {
        class: "ai-authoring-example-chips",
        children: examples.map((example) =>
          el("button", {
            class: "ai-authoring-example-chip",
            text: example.label,
            attrs: { type: "button", title: example.instruction },
            dataset: { testid: `ai-authoring-example-${example.id}` },
            on: {
              // mousedown 에서 먼저 채운다. click 만 기다리면 입력 blur 가 팝오버를
              // display:none 으로 접어 실제 마우스 클릭이 유실된다(실측 2026-09-02).
              mousedown: (event) => {
                event.preventDefault();
                opts.onPick(example.instruction, example.id);
              },
              click: () => opts.onPick(example.instruction, example.id),
            },
          }),
        ),
      }),
    ],
  });
}

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

function renderVisualPreview(
  prompt: AiVisualStartPrompt,
  tileset: TilesetDef | null,
  tileSize = 20,
  charsetHeight = 48,
): HTMLElement {
  const stage = el("div", { class: "ai-start-visual-stage", dataset: { testid: `ai-start-visual-stage-${prompt.id}` } });
  if (prompt.charset) {
    stage.append(renderCharsetThumb(prompt.charset, charsetHeight));
    return stage;
  }
  const tiles = prompt.mosaicTiles ?? [];
  const cols = Math.max(1, prompt.mosaicCols ?? 3);
  const size = tileSize;
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
  readonly tileSize?: number;
  readonly charsetHeight?: number;
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
        renderVisualPreview(prompt, opts.tileset, opts.tileSize, opts.charsetHeight),
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
