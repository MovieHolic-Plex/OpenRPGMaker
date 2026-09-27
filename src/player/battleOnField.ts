/**
 * 필드 위 전투(system.battlePresentation === "onField", 크로노 트리거식).
 *
 * 전투가 전환 연출 없이 **지금 보이는 필드 위에서** 벌어진다:
 *   - 배경은 필드 스냅샷을 게임 캔버스와 같은 화면 사각형에 1:1 로 깐다(확대·자르기 없음).
 *   - 적은 전투를 건 심볼 이벤트의 발밑 화면 좌표에, 아군은 주인공·동료 스프라이트의 발밑 화면 좌표에 선다.
 *   - 스냅샷에 같은 캐릭터가 두 번 찍히지 않게, 찍기 전에 필드의 해당 스프라이트를 투명하게 하고 끝나면 되돌린다.
 *   - 전투는 플레이어를 옮기지 않는다 — 끝나면 같은 칸·같은 방향 그대로다.
 *
 * 좌표는 **캔버스 비율(0..1)** 로 넘긴다. 전투 DOM 이 매 동기화마다 캔버스와 배틀러 그룹의 화면 사각형을 재서
 * 저작 좌표(0..320 × 0..160)로 바꾼다 — 창 크기·레터박스가 달라도 같은 자리에 선다(battleDom.ts).
 */
import type Phaser from "phaser";
import type { BattleTransition } from "@/player/battleTransition";

/** 캔버스 비율 좌표. fx/fy = 캔버스 왼쪽 위 기준 0..1, 발끝(스프라이트 원점 0.5,1). */
export interface OnFieldPoint {
  readonly fx: number;
  readonly fy: number;
}

export interface OnFieldAnchors {
  /** 좌표의 기준 — 게임 캔버스 엘리먼트. */
  readonly canvas: HTMLElement;
  /** 적 무리의 중심(심볼 이벤트 발밑). 심볼이 없으면 주인공 정면 3칸. */
  readonly enemy: OnFieldPoint;
  /** 파티 순서대로 주인공·동료의 발밑. */
  readonly party: readonly OnFieldPoint[];
  /** 한 타일의 캔버스 비율 크기 — 여러 마리 적을 한 칸 간격으로 벌린다. */
  readonly tileFx: number;
  readonly tileFy: number;
}

type FieldSprite = Pick<Phaser.GameObjects.Sprite, "x" | "y" | "alpha" | "setAlpha" | "active">;

export interface OnFieldScene {
  readonly player?: FieldSprite;
  readonly eventSprites?: ReadonlyMap<string, FieldSprite>;
  readonly followerSprites?: ReadonlyMap<string, FieldSprite>;
  readonly cameras?: { readonly main?: { readonly worldView: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } } };
  readonly facing?: "down" | "left" | "right" | "up";
  readonly map?: { readonly tileSize?: number };
}

const FACING_STEP: Readonly<Record<"down" | "left" | "right" | "up", readonly [number, number]>> = {
  down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0],
};

/** 심볼 이벤트가 없을 때 적이 서는 거리(칸) — 주인공 정면. */
const FALLBACK_ENEMY_TILES = 3;

export function computeOnFieldAnchors(
  scene: OnFieldScene,
  canvas: HTMLElement | undefined,
  ownerEventId: string | undefined,
  tileSize: number,
): OnFieldAnchors | undefined {
  const view = scene.cameras?.main?.worldView;
  const player = scene.player;
  if (!canvas || !view || !player || view.width <= 0 || view.height <= 0) return undefined;
  const toPoint = (x: number, y: number): OnFieldPoint => ({ fx: (x - view.x) / view.width, fy: (y - view.y) / view.height });
  const owner = ownerEventId ? scene.eventSprites?.get(ownerEventId) : undefined;
  const [dx, dy] = FACING_STEP[scene.facing ?? "down"];
  const enemy = owner
    ? toPoint(owner.x, owner.y)
    : toPoint(player.x + dx * tileSize * FALLBACK_ENEMY_TILES, player.y + dy * tileSize * FALLBACK_ENEMY_TILES);
  const party = [toPoint(player.x, player.y), ...[...(scene.followerSprites?.values() ?? [])].map((sprite) => toPoint(sprite.x, sprite.y))];
  return { canvas, enemy, party, tileFx: tileSize / view.width, tileFy: tileSize / view.height };
}

/**
 * 전투 동안 필드의 주인공·동료·심볼 스프라이트를 투명하게 한다. 전투 DOM 이 같은 자리에 배틀러를 세우므로
 * 스냅샷과 살아 있는 캔버스에 두 번 보이지 않게 한다. visible 이 아니라 alpha 를 쓴다 — 주인공 visible 은
 * 매 프레임 은신 상태로 다시 정해진다(playSceneMovement). 돌려주는 함수가 원래 alpha 로 되돌린다
 * (전투 뒤 지워진 심볼처럼 파괴된 스프라이트는 건너뛴다).
 */
export function hideOnFieldSprites(scene: OnFieldScene, ownerEventId: string | undefined): () => void {
  const sprites: FieldSprite[] = [];
  if (scene.player) sprites.push(scene.player);
  for (const sprite of scene.followerSprites?.values() ?? []) sprites.push(sprite);
  const owner = ownerEventId ? scene.eventSprites?.get(ownerEventId) : undefined;
  if (owner) sprites.push(owner);
  const saved = sprites.map((sprite) => [sprite, sprite.alpha] as const);
  for (const sprite of sprites) sprite.setAlpha(0);
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const [sprite, alpha] of saved) if (sprite.active !== false) sprite.setAlpha(alpha);
  };
}

/**
 * 필드 스냅샷을 전투 무대(host 크기) 안에서 게임 캔버스와 **같은 화면 사각형**에 깐다. 무대 뒤판이라 전장·HUD 가
 * 그 위에 그려진다. 무대는 host 를 덮는 불투명 판이므로 캔버스 밖 여백(레터박스)은 그대로 무대 색이다.
 */
export function mountOnFieldBackdrop(stage: HTMLElement, canvas: HTMLElement, url: string): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "battle-onfield-backdrop";
  layer.dataset.testid = "battle-onfield-backdrop";
  layer.setAttribute("aria-hidden", "true");
  const s = stage.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  Object.assign(layer.style, {
    position: "absolute",
    left: `${c.left - s.left}px`,
    top: `${c.top - s.top}px`,
    width: `${c.width}px`,
    height: `${c.height}px`,
    backgroundImage: `url("${url}")`,
    backgroundSize: "100% 100%",
    pointerEvents: "none",
  });
  stage.prepend(layer);
  return layer;
}

/** 필드 위 전투는 전환이 없다 — 같은 계약을 즉시 끝나는 약속으로 채운다. */
export function instantBattleTransition(): BattleTransition {
  const done = (): Promise<void> => Promise.resolve();
  return { cover: done, reveal: done, exit: done, destroy: () => {} };
}

/** 저작 좌표 공간(battleFieldDom.positionBattleNode: 0..320 × 0..160). */
const AUTHOR_W = 320;
const AUTHOR_H = 160;

/**
 * 캔버스 비율 좌표를 배틀러 그룹의 저작 좌표로 바꾼다. 둘 다 화면 사각형을 재서 계산하므로
 * 전투 무대의 CSS 배율(bindBattleStageScale)·레터박스와 무관하다. 재지 못하면 undefined.
 */
export function onFieldPointToAuthored(point: OnFieldPoint, canvas: HTMLElement, group: HTMLElement): { x: number; y: number } | undefined {
  const c = canvas.getBoundingClientRect();
  const g = group.getBoundingClientRect();
  if (c.width <= 0 || c.height <= 0 || g.width <= 0 || g.height <= 0) return undefined;
  const sx = c.left + point.fx * c.width;
  const sy = c.top + point.fy * c.height;
  return { x: ((sx - g.left) / g.width) * AUTHOR_W, y: ((sy - g.top) / g.height) * AUTHOR_H };
}

/** 적 i/n 의 자리 — 심볼을 중심으로 한 칸 간격 가로줄. */
export function onFieldEnemyPoint(anchors: OnFieldAnchors, index: number, count: number): OnFieldPoint {
  return { fx: anchors.enemy.fx + (index - (count - 1) / 2) * anchors.tileFx, fy: anchors.enemy.fy };
}

/** 아군 i 의 자리 — 필드 스프라이트가 모자라면(파티 > 동료 표시) 주인공 옆으로 한 칸씩. */
export function onFieldPartyPoint(anchors: OnFieldAnchors, index: number): OnFieldPoint {
  const known = anchors.party[index];
  if (known) return known;
  const lead = anchors.party[0] ?? anchors.enemy;
  return { fx: lead.fx + index * anchors.tileFx, fy: lead.fy };
}
