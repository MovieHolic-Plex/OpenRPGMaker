// 도트 측면 전투(retro2003) 전용 적 도트 시트 카탈로그.
//
// 시트 계약(그림 원본: scripts/asset-gen/pixel-enemy/<name>.py, 설명: tiledata/pixel-enemies/<name>/README.md):
//   셀 `cell` px 정사각 3열×3행(기본 48 = 아군 전투 셀과 같은 크기, 큰 적은 64·96), 화면에는 2배로 그린다.
//   1:1 도트, 알파 0/255. 오른쪽(아군 쪽)을 본다. 가로 중심 x=cell/2, 바닥 기준선 y=cell−4.
//   (0,0)(1,0)(2,0) 대기 a·b·c — a→b→c→b 로 돈다
//   (0,1) windup · (1,1) move · (2,1) attack
//   (0,2) recover · (1,2) hit · (2,2) dead
//
// 같은 리소스 id 를 다른 스킨은 지금까지의 통짜 그림으로 그린다 — 이 카탈로그는 retro2003 에서만 읽힌다.
import { withInlineAsset } from "@/assets/inlineAssetStore";

export const PIXEL_ENEMY_CELL = 48;

export type PixelEnemyCell = "idle_a" | "idle_b" | "idle_c" | "windup" | "move" | "attack" | "recover" | "hit" | "dead";

/**
 * 공격할 때 대상에게 가는 방식.
 *   hop   통통 두 번 뛰어 박치기(슬라임)       swoop 날개를 치켜들었다 급강하해 물기(박쥐·새)
 *   stomp 무겁게 두어 걸음 다가가 내려찍기(골렘·트롤)  dash  낮게 달려들어 물어뜯기(늑대·짐승)
 *   float 스르르 떠서 다가가 할퀴기(유령·정령)   shoot 제자리에서 쏘기 — 다가가지 않는다(궁수·마법형)
 *   breath 크게 젖혔다 앞으로 숨을 뿜기, 제자리(드래곤)
 */
export type PixelEnemyMotion = "hop" | "swoop" | "stomp" | "dash" | "float" | "shoot" | "breath";

export interface PixelEnemySheet {
  /** 적 레코드의 monsterResourceId. */
  readonly resourceId: string;
  /** public 기준 경로(선행 슬래시 없음). */
  readonly path: string;
  readonly motion: PixelEnemyMotion;
  /** 대기 루프 한 칸 길이(ms). a→b→c→b 네 칸. */
  readonly idleFrameMs: number;
  /** 셀 한 변(px). 생략 = 48. 시트는 cell×3 정사각. */
  readonly cell?: number;
}

export const PIXEL_ENEMY_SHEETS: readonly PixelEnemySheet[] = [
  { resourceId: "generated-enemy-slime-01", path: "assets/generated/pixel-enemies/slime.png", motion: "hop", idleFrameMs: 220 },
  { resourceId: "generated-enemy-bat-01", path: "assets/generated/pixel-enemies/bat.png", motion: "swoop", idleFrameMs: 110 },
  { resourceId: "generated-enemy-golem-01", path: "assets/generated/pixel-enemies/golem.png", cell: 64, motion: "stomp", idleFrameMs: 300 },
  { resourceId: "generated-enemy-dragon-01", path: "assets/generated/pixel-enemies/dragon.png", cell: 96, motion: "breath", idleFrameMs: 260 },
  { resourceId: "generated-enemy-skeleton-archer", path: "assets/generated/pixel-enemies/skeleton-archer.png", cell: 48, motion: "shoot", idleFrameMs: 240 },
  { resourceId: "generated-enemy-wolf-grey", path: "assets/generated/pixel-enemies/wolf-grey.png", cell: 48, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spider-cave", path: "assets/generated/pixel-enemies/spider-cave.png", cell: 48, motion: "dash", idleFrameMs: 160 },
  { resourceId: "generated-enemy-wisp-blue", path: "assets/generated/pixel-enemies/wisp-blue.png", cell: 48, motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-slime-red", path: "assets/generated/pixel-enemies/slime-red.png", cell: 48, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-zombie-rot", path: "assets/generated/pixel-enemies/zombie-rot.png", cell: 48, motion: "stomp", idleFrameMs: 340 },
  // 2026-09-28 확장 30종(계약 retroMonsterPlan.ts 순서). 대기 한 칸 길이는 tiledata/pixel-enemies/<slug>/README.md 권장값,
  // 권장값이 없는 짐승 10종은 이동 방식 기본값(swoop 120 · dash 170 · stomp 320). 식충 식물은 stomp 슬롯이지만 제자리 덩굴 채찍이다.
  { resourceId: "generated-enemy-bat-vampire", path: "assets/generated/pixel-enemies/bat-vampire.png", cell: 48, motion: "swoop", idleFrameMs: 120 },
  { resourceId: "generated-enemy-bee-giant", path: "assets/generated/pixel-enemies/bee-giant.png", cell: 48, motion: "swoop", idleFrameMs: 120 },
  { resourceId: "generated-enemy-scorpion-sand", path: "assets/generated/pixel-enemies/scorpion-sand.png", cell: 48, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-mantis-blade", path: "assets/generated/pixel-enemies/mantis-blade.png", cell: 48, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-boar-tusk", path: "assets/generated/pixel-enemies/boar-tusk.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-bear-brown", path: "assets/generated/pixel-enemies/bear-brown.png", cell: 64, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-snake-viper", path: "assets/generated/pixel-enemies/snake-viper.png", cell: 48, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-crab-rock", path: "assets/generated/pixel-enemies/crab-rock.png", cell: 48, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-hound-hell", path: "assets/generated/pixel-enemies/hound-hell.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-plant-carnivore", path: "assets/generated/pixel-enemies/plant-carnivore.png", cell: 64, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-skeleton-knight", path: "assets/generated/pixel-enemies/skeleton-knight.png", cell: 48, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-ghost-pale", path: "assets/generated/pixel-enemies/ghost-pale.png", cell: 48, motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-lich-frost", path: "assets/generated/pixel-enemies/lich-frost.png", cell: 64, motion: "shoot", idleFrameMs: 280 },
  { resourceId: "generated-enemy-mummy-bandage", path: "assets/generated/pixel-enemies/mummy-bandage.png", cell: 48, motion: "stomp", idleFrameMs: 340 },
  { resourceId: "generated-enemy-spirit-fire", path: "assets/generated/pixel-enemies/spirit-fire.png", cell: 48, motion: "float", idleFrameMs: 160 },
  { resourceId: "generated-enemy-spirit-water", path: "assets/generated/pixel-enemies/spirit-water.png", cell: 48, motion: "float", idleFrameMs: 220 },
  { resourceId: "generated-enemy-golem-iron", path: "assets/generated/pixel-enemies/golem-iron.png", cell: 64, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-armor-living", path: "assets/generated/pixel-enemies/armor-living.png", cell: 48, motion: "stomp", idleFrameMs: 300 },
  { resourceId: "generated-enemy-mimic-chest", path: "assets/generated/pixel-enemies/mimic-chest.png", cell: 48, motion: "hop", idleFrameMs: 200 },
  { resourceId: "generated-enemy-eye-floating", path: "assets/generated/pixel-enemies/eye-floating.png", cell: 48, motion: "shoot", idleFrameMs: 200 },
  { resourceId: "generated-enemy-goblin-scout", path: "assets/generated/pixel-enemies/goblin-scout.png", cell: 48, motion: "dash", idleFrameMs: 160 },
  { resourceId: "generated-enemy-orc-warrior", path: "assets/generated/pixel-enemies/orc-warrior.png", cell: 64, motion: "stomp", idleFrameMs: 300 },
  { resourceId: "generated-enemy-orc-shaman", path: "assets/generated/pixel-enemies/orc-shaman.png", cell: 48, motion: "shoot", idleFrameMs: 240 },
  { resourceId: "generated-enemy-bandit-mask", path: "assets/generated/pixel-enemies/bandit-mask.png", cell: 48, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-lizardman-spear", path: "assets/generated/pixel-enemies/lizardman-spear.png", cell: 48, motion: "dash", idleFrameMs: 190 },
  { resourceId: "generated-enemy-harpy-cliff", path: "assets/generated/pixel-enemies/harpy-cliff.png", cell: 48, motion: "swoop", idleFrameMs: 120 },
  { resourceId: "generated-enemy-minotaur-maze", path: "assets/generated/pixel-enemies/minotaur-maze.png", cell: 96, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-troll-cave", path: "assets/generated/pixel-enemies/troll-cave.png", cell: 96, motion: "stomp", idleFrameMs: 340 },
  { resourceId: "generated-enemy-gargoyle-stone", path: "assets/generated/pixel-enemies/gargoyle-stone.png", cell: 64, motion: "swoop", idleFrameMs: 260 },
  { resourceId: "generated-enemy-demon-lord", path: "assets/generated/pixel-enemies/demon-lord.png", cell: 96, motion: "breath", idleFrameMs: 280 },
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

export function pixelEnemyCell(entry: PixelEnemySheet): number {
  return entry.cell ?? PIXEL_ENEMY_CELL;
}

export function pixelEnemySheetUrl(entry: PixelEnemySheet): string {
  return withInlineAsset(`/${entry.path}`);
}
