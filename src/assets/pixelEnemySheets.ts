// 도트 측면 전투(retro2003) 전용 적 도트 시트 카탈로그.
//
// 시트 계약(그림 원본: scripts/asset-gen/pixel-enemy/<name>.py, 설명: tiledata/pixel-enemies/<name>/README.md):
//   144×144 = 48px 셀 3열×3행(아군 전투 셀과 같은 크기·같은 2배 표시), 1:1 도트, 알파 0/255.
//   오른쪽(아군 쪽)을 본다. 가로 중심 x=24, 바닥 기준선 y=44.
//   (0,0)(1,0)(2,0) 대기 a·b·c — a→b→c→b 로 돈다
//   (0,1) windup · (1,1) move · (2,1) attack
//   (0,2) recover · (1,2) hit · (2,2) dead
//
// 같은 리소스 id 를 다른 스킨은 지금까지의 통짜 그림으로 그린다 — 이 카탈로그는 retro2003 에서만 읽힌다.
import { withInlineAsset } from "@/assets/inlineAssetStore";

export const PIXEL_ENEMY_CELL = 48;

export type PixelEnemyCell = "idle_a" | "idle_b" | "idle_c" | "windup" | "move" | "attack" | "recover" | "hit" | "dead";

/** 공격할 때 대상에게 가는 방식. hop = 통통 뛰어 박치기, swoop = 날아 내려와 물기. */
export type PixelEnemyMotion = "hop" | "swoop";

export interface PixelEnemySheet {
  /** 적 레코드의 monsterResourceId. */
  readonly resourceId: string;
  /** public 기준 경로(선행 슬래시 없음). */
  readonly path: string;
  readonly motion: PixelEnemyMotion;
  /** 대기 루프 한 칸 길이(ms). a→b→c→b 네 칸. */
  readonly idleFrameMs: number;
}

export const PIXEL_ENEMY_SHEETS: readonly PixelEnemySheet[] = [
  { resourceId: "generated-enemy-slime-01", path: "assets/generated/pixel-enemies/slime.png", motion: "hop", idleFrameMs: 220 },
  { resourceId: "generated-enemy-bat-01", path: "assets/generated/pixel-enemies/bat.png", motion: "swoop", idleFrameMs: 110 },
];

export const PIXEL_ENEMY_FRAME: Readonly<Record<PixelEnemyCell, { readonly col: number; readonly row: number }>> = {
  idle_a: { col: 0, row: 0 },
  idle_b: { col: 1, row: 0 },
  idle_c: { col: 2, row: 0 },
  windup: { col: 0, row: 1 },
  move: { col: 1, row: 1 },
  attack: { col: 2, row: 1 },
  recover: { col: 0, row: 2 },
  hit: { col: 1, row: 2 },
  dead: { col: 2, row: 2 },
};

const byId = new Map(PIXEL_ENEMY_SHEETS.map((entry) => [entry.resourceId, entry]));

export function pixelEnemySheet(resourceId: string | undefined): PixelEnemySheet | undefined {
  return resourceId ? byId.get(resourceId) : undefined;
}

export function pixelEnemySheetUrl(entry: PixelEnemySheet): string {
  return withInlineAsset(`/${entry.path}`);
}
