// player/exitLabelPlacement.ts
// 출입 칸 「→ 목적지」 글자의 자리 — playSceneFieldStaging.syncExitLabels 가 부른다(Phaser 없는 순수 함수라 단위 시험이 그대로 잰다).
//
// 규칙
//  1. 글자는 출구 칸 위(위에 자리가 없으면 아래). 주인공이 위에서 다가오면 아래로 — 주인공이 오는 쪽의 반대편.
//  2. 그래도 주인공 몸에 겹치면 주인공 옆(오른쪽, 안 되면 왼쪽)으로 비킨다. 그래도 겹치면 옅게(0.35).
//  3. (2026-10-30) 맵에 적힌 문(map.doors)의 그림 사각형 — 문 칸 위로 이어진 문 그림 칸까지 — 을 덮으면 문 아래·오른쪽·왼쪽·위
//     차례로 옮긴다. 맵 안에 들고, 어떤 문도 덮지 않고, 주인공도 안 덮는 첫 자리. 그런 자리가 없으면 문만 피하는 첫 자리에 옅게.
//     문을 피할 자리가 아예 없으면 1·2 의 결과 그대로. 편의점 문 위 줄을 「→ 해피 마트 사쿠라자카점」이 덮었다(door-kinds 영상).
//     문 정의가 없는 맵(옛 맵)은 3 을 건너뛴다 — 예전과 똑같다.

/** 맵 픽셀 사각형(오른쪽·아래는 끝 바로 다음 픽셀). */
export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ExitLabelPlacementInput {
  /** 출구 칸(들) 가운데 x. */
  readonly anchorX: number;
  /** 출구 칸 위에 둘 때 글자 밑변 y. */
  readonly aboveY: number;
  /** 출구 칸 아래에 둘 때 글자 윗변 y. */
  readonly belowY: number;
  readonly width: number;
  readonly height: number;
  readonly mapW: number;
  readonly mapH: number;
  /** 주인공 칸 좌표와 칸 크기(px). */
  readonly heroTileX: number;
  readonly heroTileY: number;
  readonly tileSize: number;
  /** 맵에 적힌 문 그림 사각형(px). 비면 문 피하기를 하지 않는다. */
  readonly doors?: readonly PixelRect[];
}

/** 글자 자리 — origin(0,1)이라 y 는 글자 밑변. */
export interface ExitLabelPlacement {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
}

const FADED = 0.35;
const GAP = 2;

/** 문 정의(칸) → 문 그림 픽셀 사각형. */
export function doorPixelRect(door: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }, size: number): PixelRect {
  return { left: door.x * size, top: door.y * size, right: (door.x + door.w) * size, bottom: (door.y + door.h) * size };
}

export function placeExitLabel(input: ExitLabelPlacementInput): ExitLabelPlacement {
  const { anchorX, aboveY, belowY, width: w, height: h, mapW, mapH, tileSize: size } = input;
  const heroTop = (input.heroTileY - 0.75) * size;
  const heroBottom = (input.heroTileY + 1) * size;
  const heroLeft = input.heroTileX * size;
  const clampX = (x: number): number => Math.round(Math.max(1, Math.min(mapW - w - 1, x)));
  const overlapsHero = (x: number, y: number): boolean => x < heroLeft + size && x + w > heroLeft && y - h < heroBottom && y > heroTop;
  const doors = input.doors ?? [];
  const overlapsDoor = (x: number, y: number, d: PixelRect): boolean => x < d.right && x + w > d.left && y - h < d.bottom && y > d.top;
  const coversDoor = (x: number, y: number): PixelRect | undefined => doors.find((d) => overlapsDoor(x, y, d));

  // 1·2 — 문 정의 이전과 같은 자리.
  let x = clampX(anchorX - w / 2);
  const aboveFits = aboveY - h >= 0;
  const belowFits = belowY + h <= mapH;
  const heroAboveExit = heroBottom <= aboveY + GAP;
  const placeBelow = !aboveFits || (heroAboveExit && belowFits);
  const y = Math.round(placeBelow ? belowY + h : aboveY);
  if (overlapsHero(x, y)) {
    const right = heroLeft + size + GAP;
    const left = heroLeft - GAP - w;
    if (right + w <= mapW - 1) x = Math.round(right);
    else if (left >= 1) x = Math.round(left);
  }
  const base: ExitLabelPlacement = { x, y, alpha: overlapsHero(x, y) ? FADED : 1 };

  // 3 — 문 그림을 덮으면 문 옆·아래로.
  const door = coversDoor(base.x, base.y);
  if (!door) return base;
  const candidates: { x: number; y: number }[] = [];
  const belowDoorY = Math.round(Math.max(belowY, door.bottom + GAP) + h);
  if (belowDoorY <= mapH) candidates.push({ x: clampX(anchorX - w / 2), y: belowDoorY });
  const besideY = Math.round(Math.max(h, Math.min(mapH, door.bottom)));
  if (door.right + GAP + w <= mapW - 1) candidates.push({ x: Math.round(door.right + GAP), y: besideY });
  if (door.left - GAP - w >= 1) candidates.push({ x: Math.round(door.left - GAP - w), y: besideY });
  const aboveDoorY = Math.round(door.top - GAP);
  if (aboveDoorY - h >= 0) candidates.push({ x: clampX(anchorX - w / 2), y: aboveDoorY });
  const clear = candidates.filter((c) => !coversDoor(c.x, c.y));
  const best = clear.find((c) => !overlapsHero(c.x, c.y));
  if (best) return { ...best, alpha: 1 };
  const faded = clear[0];
  if (faded) return { ...faded, alpha: FADED };
  return base;
}
