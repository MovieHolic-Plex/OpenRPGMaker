import type { GameMap, TilesetDef } from "@/project/types";

export type TilesetSwitchImpact = {
  /** 새 칩셋 칸 수보다 큰 번호를 가진 칸(아래·위 층 합). 이 칸은 바꾼 뒤 빈 칸으로 그려진다. */
  readonly outOfRangeCells: number;
  readonly paintedCells: number;
  readonly sizeChanged: boolean;
  readonly fromTileSize: number;
  readonly toTileSize: number;
};

function countLayer(tiles: readonly number[] | undefined, count: number): { painted: number; outside: number } {
  let painted = 0;
  let outside = 0;
  for (const tile of tiles ?? []) {
    if (!Number.isInteger(tile) || tile < 0) continue;
    painted += 1;
    if (tile >= count) outside += 1;
  }
  return { painted, outside };
}

/** 맵의 칩셋을 next 로 바꾸면 무엇이 깨지는가(F2). 타일 번호는 다시 매기지 않으므로 범위 밖 칸은 빈 칸이 된다. */
export function tilesetSwitchImpact(map: GameMap, current: TilesetDef | undefined, next: TilesetDef): TilesetSwitchImpact {
  const lower = countLayer(map.lowerTiles, next.count);
  const upper = countLayer(map.upperTiles, next.count);
  const fromTileSize = map.tileSize ?? current?.tileSize ?? next.tileSize;
  return {
    outOfRangeCells: lower.outside + upper.outside,
    paintedCells: lower.painted + upper.painted,
    sizeChanged: fromTileSize !== next.tileSize,
    fromTileSize,
    toTileSize: next.tileSize,
  };
}

export function tilesetSwitchNeedsConfirm(impact: TilesetSwitchImpact): boolean {
  return impact.outOfRangeCells > 0 || impact.sizeChanged;
}

export function tilesetSwitchMessage(impact: TilesetSwitchImpact, nextName: string): string {
  const lines: string[] = [];
  if (impact.outOfRangeCells > 0) {
    lines.push(`칠한 칸 ${impact.paintedCells}칸 중 ${impact.outOfRangeCells}칸이 「${nextName}」 범위 밖이라 빈 칸으로 보입니다. 타일 번호는 다시 매기지 않습니다.`);
  }
  if (impact.sizeChanged) {
    lines.push(`칸 크기가 ${impact.fromTileSize}px → ${impact.toTileSize}px 로 바뀝니다. 같은 ${impact.fromTileSize}px 칩셋을 고르는 것을 권합니다.`);
  }
  lines.push("바꾼 뒤에도 Ctrl+Z 한 번으로 되돌릴 수 있습니다.");
  return lines.join("\n");
}
