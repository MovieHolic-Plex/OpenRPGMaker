import type { TileAiMetadata, TilesetDef } from "@/project/types";

// 사용자 교정 29건: reports/chipset-label-confirmed-v2-2026-09-05.html.
// 물체 이름과 조립 의미만 교정한다. 통행성·레이어·그림은 변경하지 않는다.
type ChipsetLabelCorrection = {
  readonly textureKey: string;
  readonly index: number;
  readonly label: string;
  readonly description: string;
  readonly role: string;
  readonly tags: readonly string[];
  readonly repeatability: TileAiMetadata["repeatability"];
};

export const CHIPSET_LABEL_CORRECTIONS: readonly ChipsetLabelCorrection[] = [
  {
    "textureKey": "tex_easyrpg_chipset_retro_exterior",
    "index": 84,
    "label": "스테인드 글라스",
    "description": "",
    "role": "window",
    "tags": [
      "스테인드 글라스",
      "window",
      "stained-glass",
      "스테인드 글라스",
      "유리창",
      "창문"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_retro_house",
    "index": 84,
    "label": "스테인드 글라스",
    "description": "",
    "role": "window",
    "tags": [
      "스테인드 글라스",
      "window",
      "stained-glass",
      "스테인드 글라스",
      "유리창",
      "창문"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_retro_house",
    "index": 29,
    "label": "돌 무더기 (캐기 전)",
    "description": "",
    "role": "rock",
    "tags": [
      "돌 무더기 (캐기 전)",
      "rock",
      "돌",
      "돌무더기",
      "unmined",
      "캐기 전"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_retro_exterior",
    "index": 119,
    "label": "돌무더기",
    "description": "",
    "role": "rock",
    "tags": [
      "돌무더기",
      "rock",
      "돌",
      "돌무더기"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_retro_house",
    "index": 119,
    "label": "돌 무더기 (캐기 전)",
    "description": "",
    "role": "rock",
    "tags": [
      "돌 무더기 (캐기 전)",
      "rock",
      "돌",
      "돌무더기",
      "unmined",
      "캐기 전"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_retro_house",
    "index": 59,
    "label": "돌 무더기 (캔 후)",
    "description": "",
    "role": "rock",
    "tags": [
      "돌 무더기 (캔 후)",
      "rock",
      "돌",
      "돌무더기",
      "mined",
      "캔 후"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_retro_exterior",
    "index": 59,
    "label": "돌 무더기",
    "description": "",
    "role": "rock",
    "tags": [
      "돌 무더기",
      "rock",
      "돌",
      "돌무더기"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 317,
    "label": "벽돌 벽의 상층부 (가로 사이즈 1칸짜리)",
    "description": "가로 1칸짜리 벽의 독립 상단/하단. 317 아래에 347을 놓는다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 상층부 (가로 사이즈 1칸짜리)",
      "wall",
      "brick",
      "벽돌 벽",
      "상층부",
      "single-width",
      "폭 1칸"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 347,
    "label": "벽돌 벽의 하층부 (가로 사이즈 1칸짜리)",
    "description": "가로 1칸짜리 벽의 독립 상단/하단. 317 아래에 347을 놓는다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 하층부 (가로 사이즈 1칸짜리)",
      "wall",
      "brick",
      "벽돌 벽",
      "하층부",
      "single-width",
      "폭 1칸"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_combined_town",
    "index": 29,
    "label": "돌 무더기 (캐기 전)",
    "description": "",
    "role": "rock",
    "tags": [
      "돌 무더기 (캐기 전)",
      "rock",
      "돌",
      "돌무더기",
      "unmined",
      "캐기 전"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 78,
    "label": "교회 바닥 느낌",
    "description": "",
    "role": "floor",
    "tags": [
      "교회 바닥 느낌",
      "floor",
      "바닥",
      "타일",
      "교회"
    ],
    "repeatability": "repeat"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 79,
    "label": "화장실 타일 느낌",
    "description": "",
    "role": "floor",
    "tags": [
      "화장실 타일 느낌",
      "floor",
      "바닥",
      "타일",
      "화장실"
    ],
    "repeatability": "repeat"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 255,
    "label": "광산 벽의 왼쪽 하단부",
    "description": "기본형은 가로 3칸 × 세로 2칸. 하단은 255 + 256 반복 + 257. 좌우 끝을 고정하고 가운데 열을 가로 확장한다. 상단 칩 ID는 미확정.",
    "role": "wall",
    "tags": [
      "광산 벽의 왼쪽 하단부",
      "wall",
      "mine",
      "광산 벽",
      "하단",
      "left-cap"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 256,
    "label": "광산 벽의 가운데 하단부 (가로 반복)",
    "description": "기본형은 가로 3칸 × 세로 2칸. 하단은 255 + 256 반복 + 257. 좌우 끝을 고정하고 가운데 열을 가로 확장한다. 상단 칩 ID는 미확정.",
    "role": "wall",
    "tags": [
      "광산 벽의 가운데 하단부 (가로 반복)",
      "wall",
      "mine",
      "광산 벽",
      "하단",
      "repeat-horizontal"
    ],
    "repeatability": "center"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 257,
    "label": "광산 벽의 오른쪽 하단부",
    "description": "기본형은 가로 3칸 × 세로 2칸. 하단은 255 + 256 반복 + 257. 좌우 끝을 고정하고 가운데 열을 가로 확장한다. 상단 칩 ID는 미확정.",
    "role": "wall",
    "tags": [
      "광산 벽의 오른쪽 하단부",
      "wall",
      "mine",
      "광산 벽",
      "하단",
      "right-cap"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_interior",
    "index": 125,
    "label": "소용돌이 (프레임 1)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 1)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-1"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 125,
    "label": "소용돌이 (프레임 1)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 1)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-1"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_interior",
    "index": 155,
    "label": "소용돌이 (프레임 2)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 2)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-2"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_interior",
    "index": 185,
    "label": "소용돌이 (프레임 3)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 3)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-3"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_interior",
    "index": 215,
    "label": "소용돌이 (프레임 4)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 4)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-4"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 155,
    "label": "소용돌이 (프레임 2)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 2)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-2"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 185,
    "label": "소용돌이 (프레임 3)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 3)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-3"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_dungeon",
    "index": 215,
    "label": "소용돌이 (프레임 4)",
    "description": "같은 칩셋 안에서 125 → 155 → 185 → 215 순으로 반복 재생한다. 다른 칩셋 프레임과 합치지 않는다.",
    "role": "water",
    "tags": [
      "소용돌이 (프레임 4)",
      "water",
      "whirlpool",
      "소용돌이",
      "animation-frame",
      "frame-4"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 314,
    "label": "벽돌 벽의 상층부, 왼쪽 상단",
    "description": "벽 상층부 314·315·316과 하층부 344·345·346을 조립한다. 가운데 열 315·345를 가로 반복한다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 상층부, 왼쪽 상단",
      "wall",
      "brick",
      "벽돌 벽",
      "상층부",
      "left-cap"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 315,
    "label": "벽돌 벽의 상층부, 가운데 상단",
    "description": "벽 상층부 314·315·316과 하층부 344·345·346을 조립한다. 가운데 열 315·345를 가로 반복한다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 상층부, 가운데 상단",
      "wall",
      "brick",
      "벽돌 벽",
      "상층부",
      "repeat-horizontal"
    ],
    "repeatability": "center"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 316,
    "label": "벽돌 벽의 상층부, 오른쪽 상단",
    "description": "벽 상층부 314·315·316과 하층부 344·345·346을 조립한다. 가운데 열 315·345를 가로 반복한다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 상층부, 오른쪽 상단",
      "wall",
      "brick",
      "벽돌 벽",
      "상층부",
      "right-cap"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 344,
    "label": "벽돌 벽의 하층부, 왼쪽 하단",
    "description": "벽 상층부 314·315·316과 하층부 344·345·346을 조립한다. 가운데 열 315·345를 가로 반복한다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 하층부, 왼쪽 하단",
      "wall",
      "brick",
      "벽돌 벽",
      "하층부",
      "left-cap"
    ],
    "repeatability": "fixed"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 345,
    "label": "벽돌 벽의 하층부, 가운데 하단",
    "description": "벽 상층부 314·315·316과 하층부 344·345·346을 조립한다. 가운데 열 315·345를 가로 반복한다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 하층부, 가운데 하단",
      "wall",
      "brick",
      "벽돌 벽",
      "하층부",
      "repeat-horizontal"
    ],
    "repeatability": "center"
  },
  {
    "textureKey": "tex_easyrpg_chipset_world",
    "index": 346,
    "label": "벽돌 벽의 하층부, 오른쪽 하단",
    "description": "벽 상층부 314·315·316과 하층부 344·345·346을 조립한다. 가운데 열 315·345를 가로 반복한다.",
    "role": "wall",
    "tags": [
      "벽돌 벽의 하층부, 오른쪽 하단",
      "wall",
      "brick",
      "벽돌 벽",
      "하층부",
      "right-cap"
    ],
    "repeatability": "fixed"
  }
];

export function chipsetLabelCorrection(textureKey: string, tile: number): TileAiMetadata | undefined {
  const entry = CHIPSET_LABEL_CORRECTIONS.find(candidate => candidate.textureKey === textureKey && candidate.index === tile);
  if (!entry) return undefined;
  return { label: entry.label, description: entry.description, role: entry.role, tags: [...entry.tags], repeatability: entry.repeatability };
}

export function applyChipsetLabelCorrections<T extends { readonly index: number; readonly label: string; readonly role: string; readonly tags: readonly string[] }>(textureKey: string, entries: readonly T[]): T[] {
  return entries.map(entry => {
    const correction = CHIPSET_LABEL_CORRECTIONS.find(candidate => candidate.textureKey === textureKey && candidate.index === entry.index);
    return correction ? { ...entry, label: correction.label, role: correction.role, tags: [...correction.tags] } : entry;
  });
}

export function seedChipsetLabelCorrections(tileset: TilesetDef): boolean {
  const tileMeta = tileset.tileMeta;
  if (tileset.image.type !== "bundled" || !tileMeta) return false;
  let changed = false;
  for (const correction of CHIPSET_LABEL_CORRECTIONS) {
    if (correction.textureKey !== tileset.image.id || correction.index >= tileset.count) continue;
    const meta = tileMeta[correction.index];
    if (!meta || meta.source === "user" || meta.origin === "user" || meta.userLocked || meta.locked) continue;
    if (tileset.tileGrafts?.some(graft => graft.targetTile === correction.index)) continue;
    const next = { ...meta, ...chipsetLabelCorrection(correction.textureKey, correction.index), source: "bundled-default" as const };
    if (JSON.stringify(meta) !== JSON.stringify(next)) {
      tileMeta[correction.index] = next;
      changed = true;
    }
  }
  return changed;
}
