// 도트 측면 전투(retro2003) 전용 적 도트 시트 카탈로그 — 현행 5×4(20칸) 정식 번들 44종.
//
// 시트 계약:
//   셀 `cell` px 정사각 5열×4행(48·64·96·128·192px), 화면에는 2배로 그린다.
//   1:1 도트, 알파 0/255. 오른쪽(아군 쪽)을 본다.
//   (0,0)(1,0)(2,0) 대기 a·b·c(a→b→c→b) · (3,0) windup · (4,0) move
//   (0,1) attack · (1,1) recover · (2,1) hit · (3,1) dead · (4,1) attack_mid
//   (0,2) cast_charge · (1,2) cast_release · (2,2) guard · (3,2) weak · (4,2) intro
//   (0,3) move_b · (1,3) hit_b · (2,3) attack_b · (3,3) stunned · (4,3) enrage
//
// 같은 리소스 id 의 일반 이미지/다른 스킨은 pixelEnemyPortraits.ts 의 idle_a 한 칸을 그린다.
// 옛 3×3 번들 106종은 2026-11-26 폐기·삭제했고, 기존 저장 프로젝트의 옛 id 는 `RETIRED_PIXEL_ENEMY_ALIASES` 를 통해
// 가장 가까운 현행 5×4 번들 시트로 호환 해석된다(고르기 목록·카탈로그에는 노출하지 않는다).
// 프로젝트 저작 시트(에디터 「도트 몬스터 공방」·author_enemy_pixel_sheet): project.assets.uploaded[resourceId] 가 한 칸 초상이고
// 그 meta.pixelEnemySheet.sheetResourceId 자산이 시트다. 스토어 몬스터 팩도 같은 표식을 싣고 넣을 때 id 만 바뀐다(src/assetStore/pack.ts).
// pixelEnemySheet() 는 현재 프로젝트(setPixelEnemySheetProjectSource — 편집기·플레이어 store 가 등록)의 저작 시트를 번들 항목보다 먼저 찾는다.
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import { isExtendedPixelGrid, pixelEnemyGridDims, pixelEnemyOptionalCells, pixelEnemyReservedCells, type PixelEnemyGrid } from "@/assets/pixelEnemyGrid";
import type { AssetSet, UploadedAsset, UploadedPixelEnemySheetMeta } from "@/project/types";

export type { PixelEnemyGrid };

export const PIXEL_ENEMY_CELL = 48;

export type PixelEnemyCell = "idle_a" | "idle_b" | "idle_c" | "windup" | "move" | "attack" | "recover" | "hit" | "dead";
/**
 * 4×4(16칸)·5×4(20칸) 시트만 갖는 칸. 칸 번호(행 우선, 격자 폭과 무관): 9 attack_mid · 10 cast_charge · 11 cast_release · 12 guard ·
 * 13 weak(5×4 에서만 HP 25% 이하 대기에 사용) · 14 intro(전투 시작 한 번) · 15 4×4 는 예약(완전 투명) / 5×4 는 move_b(걷기 2) ·
 * 16 hit_b(피격 2) · 17 attack_b(연타 2타 이후) · 18 stunned(행동 불가 상태 대기) · 19 enrage(HP 50% 이하 대기). 0~8 은 3×3 과 같은 이름·순서다.
 * 저작자가 그리지 못한 확장 칸(4×4 는 9~14, 5×4 는 9~19)은 meta.pixelEnemySheet.missingCells 에 적고 비워 둔다 — pixelEnemyFrame 이 물린다.
 */
export type PixelEnemyExtraCell = "attack_mid" | "cast_charge" | "cast_release" | "guard" | "weak" | "intro" | "move_b" | "hit_b" | "attack_b" | "stunned" | "enrage";
/** 파티원 15칸 시트(3×5)가 더 갖는 칸. 적 시트에는 없다 — partyPixelSheets.partyPixelFrame 이 없으면 9칸으로 물린다. */
export type PartyPixelExtraCell = "cast_charge" | "cast_raise" | "cast_release" | "leap" | "buff" | "finisher";
export type PartyPixelCell = PixelEnemyCell | PartyPixelExtraCell;

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
  /** 셀 한 변(px). 생략 = 48. */
  readonly cell?: number;
  /**
   * (0,2) 칸을 복귀 자세가 아니라 **스킬** 자세(빛·독·음파 효과 포함)로 그린 3×3 저작 시트.
   * 5×4 번들 시트는 6번 칸이 복귀 자세이고 시전 방출은 11번 칸(cast_release)이라 켜지 않는다.
   */
  readonly skillCell?: true;
  /** 프로젝트 저작 시트의 그림 URL(data URL·미디어 참조). 있으면 path 대신 쓴다. */
  readonly url?: string;
  /** 스킬 시연에 쓰는 몬스터 스킬 묶음 slug. 생략 = path 파일 이름. */
  readonly skillSlug?: string;
  /** project.assets.uploaded 에서 온 저작 시트. 웹 내보내기는 public 경로가 아니라 uploaded 자산으로 싣는다. */
  readonly projectAuthored?: true;
  /** 칸 배치. 생략 = 3x3(공방 시트). 4x4 는 16칸, 5x4 는 20칸(PixelEnemyExtraCell). */
  readonly grid?: PixelEnemyGrid;
  /** 4x4·5x4 시트에서 비워 둔 확장 칸 번호(4x4 는 9~14, 5x4 는 9~19). */
  readonly missingCells?: readonly number[];
}

export const PIXEL_ENEMY_SHEETS: readonly PixelEnemySheet[] = [
  // 현행 5×4(20칸) 몬스터 38종 + 폴른 스타 인간형 적 6종 = 정식 번들 44종
  { resourceId: "generated-enemy-slime-green", path: "assets/generated/pixel-enemies/slime-green.png", cell: 96, grid: "5x4", motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-bat-cave", path: "assets/generated/pixel-enemies/bat-cave.png", cell: 96, grid: "5x4", motion: "swoop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-golem-stone", path: "assets/generated/pixel-enemies/golem-stone.png", cell: 96, grid: "5x4", motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-dragon-blue", path: "assets/generated/pixel-enemies/dragon-blue.png", cell: 192, grid: "5x4", motion: "breath", idleFrameMs: 200 },
  { resourceId: "generated-enemy-wolf-grey", path: "assets/generated/pixel-enemies/wolf-grey.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spider-cave", path: "assets/generated/pixel-enemies/spider-cave.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 160 },
  { resourceId: "generated-enemy-wisp-blue", path: "assets/generated/pixel-enemies/wisp-blue.png", cell: 48, grid: "5x4", motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-beetle-horn", path: "assets/generated/pixel-enemies/beetle-horn.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-boar-tusk", path: "assets/generated/pixel-enemies/boar-tusk.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-crab-rock", path: "assets/generated/pixel-enemies/crab-rock.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-spirit-water", path: "assets/generated/pixel-enemies/spirit-water.png", cell: 96, grid: "5x4", motion: "float", idleFrameMs: 220 },
  { resourceId: "generated-enemy-eel-electric", path: "assets/generated/pixel-enemies/eel-electric.png", cell: 96, grid: "5x4", motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-mantis-blade", path: "assets/generated/pixel-enemies/mantis-blade.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-plant-carnivore", path: "assets/generated/pixel-enemies/plant-carnivore.png", cell: 96, grid: "5x4", motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-goblin-scout", path: "assets/generated/pixel-enemies/goblin-scout.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 160 },
  { resourceId: "generated-enemy-ghost-pale", path: "assets/generated/pixel-enemies/ghost-pale.png", cell: 96, grid: "5x4", motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-wolf-dire", path: "assets/generated/pixel-enemies/wolf-dire.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-bird-hawk", path: "assets/generated/pixel-enemies/bird-hawk.png", cell: 96, grid: "5x4", motion: "swoop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-hound-hell", path: "assets/generated/pixel-enemies/hound-hell.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-snake-viper", path: "assets/generated/pixel-enemies/snake-viper.png", cell: 64, grid: "5x4", motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-snake-01", path: "assets/generated/pixel-enemies/snake-01.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-eye-floating", path: "assets/generated/pixel-enemies/eye-floating.png", cell: 96, grid: "5x4", motion: "shoot", idleFrameMs: 200 },
  { resourceId: "generated-enemy-spirit-fire", path: "assets/generated/pixel-enemies/spirit-fire.png", cell: 96, grid: "5x4", motion: "float", idleFrameMs: 160 },
  { resourceId: "generated-enemy-golem-clay", path: "assets/generated/pixel-enemies/golem-clay.png", cell: 128, grid: "5x4", motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-golem-iron", path: "assets/generated/pixel-enemies/golem-iron.png", cell: 128, grid: "5x4", motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-bandit-mask", path: "assets/generated/pixel-enemies/bandit-mask.png", cell: 64, grid: "5x4", motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-bee-giant", path: "assets/generated/pixel-enemies/bee-giant.png", cell: 64, grid: "5x4", motion: "swoop", idleFrameMs: 120 },
  { resourceId: "generated-enemy-golem-crystal", path: "assets/generated/pixel-enemies/golem-crystal.png", cell: 128, grid: "5x4", motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-wraith-dark", path: "assets/generated/pixel-enemies/wraith-dark.png", cell: 128, grid: "5x4", motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-jelly-lantern", path: "assets/generated/pixel-enemies/jelly-lantern.png", cell: 96, grid: "5x4", motion: "float", idleFrameMs: 220 },
  { resourceId: "generated-enemy-yeti-frost", path: "assets/generated/pixel-enemies/yeti-frost.png", cell: 96, grid: "5x4", motion: "stomp", idleFrameMs: 240 },
  { resourceId: "generated-enemy-moth-dust", path: "assets/generated/pixel-enemies/moth-dust.png", cell: 64, grid: "5x4", motion: "swoop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-leafling-01", path: "assets/generated/pixel-enemies/leafling-01.png", cell: 96, grid: "5x4", motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-well-olm", path: "assets/generated/pixel-enemies/well-olm.png", cell: 128, grid: "5x4", motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-triceratops", path: "assets/generated/pixel-enemies/triceratops.png", cell: 128, grid: "5x4", motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-dragon-whelp", path: "assets/generated/pixel-enemies/dragon-whelp.png", cell: 96, grid: "5x4", motion: "breath", idleFrameMs: 200 },
  { resourceId: "generated-enemy-centipede-fire", path: "assets/generated/pixel-enemies/centipede-fire.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-bear-brown", path: "assets/generated/pixel-enemies/bear-brown.png", cell: 96, grid: "5x4", motion: "stomp", idleFrameMs: 320 },
  // 『폴른 스타』 인간형 적 6종
  { resourceId: "generated-enemy-inq-soldier", path: "assets/generated/pixel-enemies/inq-soldier.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-cult-preacher", path: "assets/generated/pixel-enemies/cult-preacher.png", cell: 96, grid: "5x4", motion: "shoot", idleFrameMs: 180 },
  { resourceId: "generated-enemy-inq-shield", path: "assets/generated/pixel-enemies/inq-shield.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-sarah", path: "assets/generated/pixel-enemies/sarah.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-inq-spearman", path: "assets/generated/pixel-enemies/inq-spearman.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-flagellant", path: "assets/generated/pixel-enemies/flagellant.png", cell: 96, grid: "5x4", motion: "dash", idleFrameMs: 180 },
];

/** 3×3 기본 시트(공방·파티원 9칸)의 칸 좌표. 확장 격자(4×4·5×4)는 `pixelEnemyFrame(sheet, cell)` 을 쓴다. */
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

/** 칸 이름 → 행 우선 번호. 0~8 은 3×3·4×4·5×4 공통, 9~14 는 4×4·5×4 확장 칸, 15~19 는 5×4 확장 칸. */
export const PIXEL_ENEMY_CELL_INDEX: Readonly<Record<PixelEnemyCell | PixelEnemyExtraCell, number>> = {
  idle_a: 0, idle_b: 1, idle_c: 2,
  windup: 3, move: 4, attack: 5,
  recover: 6, hit: 7, dead: 8,
  attack_mid: 9, cast_charge: 10, cast_release: 11, guard: 12, weak: 13, intro: 14,
  move_b: 15, hit_b: 16, attack_b: 17, stunned: 18, enrage: 19,
};
/** 4×4 시트에서 비울 수 있는 칸(missingCells 허용 범위). 15 는 항상 비고, 0~8 은 비울 수 없다. 격자별 목록은 pixelEnemyOptionalCells. */
export const PIXEL_ENEMY_OPTIONAL_CELLS: readonly number[] = pixelEnemyOptionalCells("4x4");
/**
 * 비워 둔 확장 칸을 무엇으로 물리는가. undefined = 그 동작을 건너뛴다(attack_mid: windup 에서 바로 attack).
 * move_b → move · hit_b → hit · attack_b → attack. stunned·enrage 는 전용 대기 칸이라 없으면 보통 대기 루프(그리는 쪽이 칸 유무를 먼저 묻는다).
 */
export const PIXEL_ENEMY_EXTRA_FALLBACK: Readonly<Record<PixelEnemyExtraCell, PixelEnemyCell | undefined>> = {
  attack_mid: undefined, cast_charge: "windup", cast_release: "attack", guard: "idle_a", weak: "idle_a", intro: "idle_a",
  move_b: "move", hit_b: "hit", attack_b: "attack", stunned: "idle_a", enrage: "idle_a",
};

/** pixelEnemyFrame 이 받는 칸 이름. "skill" 은 skillCell 시트에서만 (0,2), 아니면 attack 칸으로 물린다. */
export type RetroMonsterCell = PixelEnemyCell | PixelEnemyExtraCell | "skill";

type FrameSheet = Pick<PixelEnemySheet, "skillCell" | "grid" | "missingCells">;

/** 이 시트가 그 확장 칸을 실제로 그려 가지고 있는가(3×3 은 늘 false, 4×4 는 15~19 늘 false, missingCells 도 false). */
export function pixelEnemyHasCell(sheet: FrameSheet | undefined, cell: PixelEnemyExtraCell): boolean {
  if (!sheet || !isExtendedPixelGrid(sheet.grid)) return false;
  const index = PIXEL_ENEMY_CELL_INDEX[cell];
  const { cols, rows } = pixelEnemyGridDims(sheet.grid);
  if (index >= cols * rows || pixelEnemyReservedCells(sheet.grid).includes(index)) return false;
  return !(sheet.missingCells ?? []).includes(index);
}

/**
 * 시트 한 장의 칸 좌표.
 *   - 3×3 은 9칸, 4×4 는 16칸(15번 예약), 5×4 는 20칸 — `cols = pixelEnemyGridDims(sheet.grid).cols` 로 (index % cols, floor(index / cols)).
 *   - skillCell 시트는 (0,2)가 스킬 자세이므로 통상 recover 는 move 로, "skill" 은 (0,2)로 간다.
 *   - 확장 칸(attack_mid · cast_charge · cast_release · guard · weak · intro · move_b · hit_b · attack_b · stunned · enrage)이
 *     시트에 없으면(3×3·4×4 의 15~19·missingCells) 자연스러운 기본 칸으로 물린다.
 *   - 4×4 시트는 13번 weak 를 그리지 않았을 수 있고 5×4 는 13번 weak 를 쓴다 — 없으면 idle_c 로 물린다.
 */
export function pixelEnemyFrame(sheet: FrameSheet | undefined, cell: RetroMonsterCell): { readonly col: number; readonly row: number } {
  const { cols } = pixelEnemyGridDims(sheet?.grid);
  const at = (id: PixelEnemyCell | PixelEnemyExtraCell): { readonly col: number; readonly row: number } => {
    const index = PIXEL_ENEMY_CELL_INDEX[id];
    return { col: index % cols, row: Math.floor(index / cols) };
  };
  if (cell === "skill") {
    if (sheet?.skillCell) return at("recover");
    if (pixelEnemyHasCell(sheet, "cast_release")) return at("cast_release");
    return at("attack");
  }
  if (cell === "recover" && sheet?.skillCell) return at("move");
  if (cell === "attack_mid") return pixelEnemyHasCell(sheet, "attack_mid") ? at("attack_mid") : at("attack");
  if (cell === "cast_charge") return pixelEnemyHasCell(sheet, "cast_charge") ? at("cast_charge") : at("windup");
  if (cell === "cast_release") return pixelEnemyHasCell(sheet, "cast_release") ? at("cast_release") : sheet?.skillCell ? at("recover") : at("attack");
  if (cell === "guard") return pixelEnemyHasCell(sheet, "guard") ? at("guard") : at("idle_b");
  if (cell === "weak") return pixelEnemyHasCell(sheet, "weak") ? at("weak") : at("idle_c");
  if (cell === "intro") return pixelEnemyHasCell(sheet, "intro") ? at("intro") : at("windup");
  if (cell === "move_b") return pixelEnemyHasCell(sheet, "move_b") ? at("move_b") : at("move");
  if (cell === "hit_b") return pixelEnemyHasCell(sheet, "hit_b") ? at("hit_b") : at("hit");
  if (cell === "attack_b") return pixelEnemyHasCell(sheet, "attack_b") ? at("attack_b") : at("attack");
  if (cell === "stunned") return pixelEnemyHasCell(sheet, "stunned") ? at("stunned") : at("hit");
  if (cell === "enrage") return pixelEnemyHasCell(sheet, "enrage") ? at("enrage") : at("windup");
  return at(cell as PixelEnemyCell);
}

/** CSS background-position(%) — 열 수가 c 면 한 칸이 가로 100/(c−1)%, 행 수가 r 이면 세로 100/(r−1)%. */
export function pixelEnemyBackgroundPosition(sheet: FrameSheet | undefined, cell: RetroMonsterCell): string {
  const at = pixelEnemyFrame(sheet, cell);
  const { cols, rows } = pixelEnemyGridDims(sheet?.grid);
  const stepX = 100 / (cols - 1);
  const stepY = 100 / (rows - 1);
  return `${Math.round(at.col * stepX * 1000) / 1000}% ${Math.round(at.row * stepY * 1000) / 1000}%`;
}

const byId = new Map(PIXEL_ENEMY_SHEETS.map((entry) => [entry.resourceId, entry]));

/**
 * 2026-11-26 폐기·삭제한 구형 3×3 번들 106종 + 옛 단축 id → 가장 가까운 현행 5×4 번들 id.
 * 기존 저장 프로젝트·테스트·웹 내보내기가 옛 id 를 물고 있어도 깨지지 않게 해석만 유지한다.
 * PIXEL_ENEMY_SHEETS / 고르기 목록에는 들어가지 않는다.
 */
const RETIRED_PIXEL_ENEMY_ALIASES: Readonly<Record<string, string>> = {
  // 옛 단축 별칭
  slime: "generated-enemy-slime-green",
  classic_blue_slime: "generated-enemy-slime-green",
  meadow_green_slime: "generated-enemy-slime-green",
  minotaur: "generated-enemy-golem-stone",
  monster_minotaur: "generated-enemy-golem-stone",
  // 폐기된 구형 3×3 기본·생성 적 106종
  "generated-enemy-slime-01": "generated-enemy-slime-green",
  "generated-enemy-slime-blue": "generated-enemy-slime-green",
  "generated-enemy-slime-red": "generated-enemy-slime-green",
  "generated-enemy-slime-metal": "generated-enemy-slime-green",
  "generated-enemy-slime-king": "generated-enemy-slime-green",
  "generated-enemy-slime-cube": "generated-enemy-slime-green",
  "generated-enemy-ooze-black": "generated-enemy-slime-green",
  "generated-enemy-ooze-acid": "generated-enemy-slime-green",
  "generated-enemy-king-slime-01": "generated-enemy-slime-green",
  "generated-enemy-bat-01": "generated-enemy-bat-cave",
  "generated-enemy-bat-vampire": "generated-enemy-bat-cave",
  "generated-enemy-rat-giant": "generated-enemy-bat-cave",
  "generated-enemy-spider-01": "generated-enemy-spider-cave",
  "generated-enemy-spider-widow": "generated-enemy-spider-cave",
  "generated-enemy-golem-01": "generated-enemy-golem-stone",
  "generated-enemy-totem-cursed": "generated-enemy-golem-stone",
  "generated-enemy-gargoyle-stone": "generated-enemy-golem-stone",
  "generated-enemy-ape-stone": "generated-enemy-golem-stone",
  "generated-enemy-spirit-earth": "generated-enemy-golem-stone",
  "generated-enemy-troll-cave": "generated-enemy-golem-stone",
  "generated-enemy-ogre-club": "generated-enemy-golem-stone",
  "generated-enemy-minotaur-maze": "generated-enemy-golem-stone",
  "generated-enemy-behemoth-horn": "generated-enemy-golem-stone",
  "generated-enemy-armor-living": "generated-enemy-golem-iron",
  "generated-enemy-knight-fallen": "generated-enemy-golem-iron",
  "generated-enemy-skeleton-knight": "generated-enemy-golem-iron",
  "generated-enemy-sword-flying": "generated-enemy-golem-iron",
  "generated-enemy-puppet-string": "generated-enemy-golem-iron",
  "generated-enemy-mimic-chest": "generated-enemy-golem-iron",
  "generated-enemy-dragon-01": "generated-enemy-dragon-blue",
  "generated-enemy-dragon-red": "generated-enemy-dragon-blue",
  "generated-enemy-dragon-bone": "generated-enemy-dragon-blue",
  "generated-enemy-hydra-three": "generated-enemy-dragon-blue",
  "generated-enemy-wyvern-cliff": "generated-enemy-dragon-blue",
  "generated-enemy-skeleton-01": "generated-enemy-ghost-pale",
  "generated-enemy-skeleton-bone": "generated-enemy-ghost-pale",
  "generated-enemy-skeleton-archer": "generated-enemy-ghost-pale",
  "generated-enemy-zombie-01": "generated-enemy-ghost-pale",
  "generated-enemy-zombie-rot": "generated-enemy-ghost-pale",
  "generated-enemy-ghoul-01": "generated-enemy-ghost-pale",
  "generated-enemy-ghoul-grave": "generated-enemy-ghost-pale",
  "generated-enemy-ghost-01": "generated-enemy-ghost-pale",
  "generated-enemy-mummy-bandage": "generated-enemy-ghost-pale",
  "generated-enemy-banshee-wail": "generated-enemy-ghost-pale",
  "generated-enemy-bonepile-crawler": "generated-enemy-ghost-pale",
  "generated-enemy-lemora-01": "generated-enemy-ghost-pale",
  "generated-enemy-lich-frost": "generated-enemy-wraith-dark",
  "generated-enemy-revenant-vengeful": "generated-enemy-wraith-dark",
  "generated-enemy-spirit-dark": "generated-enemy-wraith-dark",
  "generated-enemy-demon-lord": "generated-enemy-wraith-dark",
  "generated-enemy-angel-fallen": "generated-enemy-wraith-dark",
  "generated-enemy-mage-rogue": "generated-enemy-wraith-dark",
  "generated-enemy-specter-01": "generated-enemy-wraith-dark",
  "generated-enemy-scorpion-01": "generated-enemy-beetle-horn",
  "generated-enemy-scorpion-sand": "generated-enemy-beetle-horn",
  "generated-enemy-ant-soldier": "generated-enemy-beetle-horn",
  "generated-enemy-worm-sand": "generated-enemy-snake-viper",
  "generated-enemy-lizardman-spear": "generated-enemy-snake-viper",
  "generated-enemy-salamander-01": "generated-enemy-spirit-fire",
  "generated-enemy-salamander-flame": "generated-enemy-spirit-fire",
  "generated-enemy-sparkit-01": "generated-enemy-spirit-fire",
  "generated-enemy-centipede-01": "generated-enemy-centipede-fire",
  "generated-enemy-wolf-01": "generated-enemy-wolf-grey",
  "generated-enemy-tiger-saber": "generated-enemy-wolf-dire",
  "generated-enemy-cat-01": "generated-enemy-hound-hell",
  "generated-enemy-cat-shadow": "generated-enemy-hound-hell",
  "generated-enemy-fire-pup": "generated-enemy-hound-hell",
  "generated-enemy-goat-mountain": "generated-enemy-boar-tusk",
  "generated-enemy-deer-forest": "generated-enemy-boar-tusk",
  "generated-enemy-centaur-plains": "generated-enemy-boar-tusk",
  "generated-enemy-horse-01": "generated-enemy-boar-tusk",
  "generated-enemy-unicorn-01": "generated-enemy-boar-tusk",
  "generated-enemy-goblin-brute": "generated-enemy-goblin-scout",
  "generated-enemy-orc-01": "generated-enemy-goblin-scout",
  "generated-enemy-orc-warrior": "generated-enemy-goblin-scout",
  "generated-enemy-orc-shaman": "generated-enemy-goblin-scout",
  "generated-enemy-kobold-digger": "generated-enemy-goblin-scout",
  "generated-enemy-imp-mischief": "generated-enemy-goblin-scout",
  "generated-enemy-spirit-01": "generated-enemy-wisp-blue",
  "generated-enemy-spirit-wind": "generated-enemy-wisp-blue",
  "generated-enemy-spirit-light": "generated-enemy-wisp-blue",
  "generated-enemy-sylph-01": "generated-enemy-wisp-blue",
  "generated-enemy-sylph-air": "generated-enemy-wisp-blue",
  "generated-enemy-carbuncle-01": "generated-enemy-wisp-blue",
  "generated-enemy-undine-sea": "generated-enemy-spirit-water",
  "generated-enemy-kappa-01": "generated-enemy-spirit-water",
  "generated-enemy-aqualing-01": "generated-enemy-spirit-water",
  "generated-enemy-harpy-01": "generated-enemy-bird-hawk",
  "generated-enemy-harpy-cliff": "generated-enemy-bird-hawk",
  "generated-enemy-griffin-sky": "generated-enemy-bird-hawk",
  "generated-enemy-roc-giant": "generated-enemy-bird-hawk",
  "generated-enemy-phoenix-rebirth": "generated-enemy-bird-hawk",
  "generated-enemy-cockatrice-01": "generated-enemy-bird-hawk",
  "generated-enemy-fish-01": "generated-enemy-eel-electric",
  "generated-enemy-fish-piranha": "generated-enemy-eel-electric",
  "generated-enemy-squid-deep": "generated-enemy-eel-electric",
  "generated-enemy-shark-land": "generated-enemy-eel-electric",
  "generated-enemy-crab-01": "generated-enemy-crab-rock",
  "generated-enemy-mantis-01": "generated-enemy-mantis-blade",
  "generated-enemy-plant-01": "generated-enemy-plant-carnivore",
  "generated-enemy-scarecrow-field": "generated-enemy-plant-carnivore",
  "generated-enemy-sylph-hornet": "generated-enemy-bee-giant",
  "generated-enemy-parasite-01": "generated-enemy-moth-dust",
  "generated-enemy-leaf-fox": "generated-enemy-leafling-01",
  "generated-enemy-jackolantern-01": "generated-enemy-jelly-lantern",
  "generated-enemy-ontology-8da61312": "generated-enemy-eye-floating",
};

/** 번들(public) 시트만. 웹 내보내기처럼 public 파일을 싣는 쪽이 쓴다. */
export function bundledPixelEnemySheet(resourceId: string | undefined): PixelEnemySheet | undefined {
  if (!resourceId) return undefined;
  const namedId = resourceId.replace(/-enemy_extra_\d+$/, "");
  return byId.get(namedId) ?? (Object.hasOwn(RETIRED_PIXEL_ENEMY_ALIASES, namedId) ? byId.get(RETIRED_PIXEL_ENEMY_ALIASES[namedId]!) : undefined);
}

type PixelEnemySheetProject = { readonly assets: Pick<AssetSet, "uploaded"> };
let projectSource: (() => PixelEnemySheetProject | undefined) | undefined;

/** 편집기 store·플레이어 store 가 부팅 때 한 번 등록한다. 등록 전(단위 시험·도구 스크립트)은 번들 시트만 찾는다. */
export function setPixelEnemySheetProjectSource(source: (() => PixelEnemySheetProject | undefined) | undefined): void {
  projectSource = source;
}

const PIXEL_ENEMY_MOTIONS: Readonly<Record<PixelEnemyMotion, true>> = { hop: true, swoop: true, stomp: true, dash: true, float: true, shoot: true, breath: true };
const projectSheetCache = new WeakMap<UploadedAsset, { readonly meta: UploadedPixelEnemySheetMeta; readonly sheet: PixelEnemySheet }>();

/** 프로젝트 저작 시트(9칸 3×3, 16칸 4×4 또는 20칸 5×4). 초상 자산에 시트 표식이 없거나 시트 자산·그림이 없으면 undefined. */
export function projectPixelEnemySheet(resourceId: string | undefined, project: PixelEnemySheetProject | undefined = projectSource?.()): PixelEnemySheet | undefined {
  if (!resourceId || !project) return undefined;
  const uploaded = project.assets.uploaded;
  const meta = Object.hasOwn(uploaded, resourceId) ? uploaded[resourceId]?.meta.pixelEnemySheet : undefined;
  if (!meta || ![48, 64, 96, 128, 192, 256].includes(meta.cell) || !Object.hasOwn(PIXEL_ENEMY_MOTIONS, meta.motion)) return undefined;
  const sheetAsset = Object.hasOwn(uploaded, meta.sheetResourceId) ? uploaded[meta.sheetResourceId] : undefined;
  if (!sheetAsset) return undefined;
  const cached = projectSheetCache.get(sheetAsset);
  if (cached && cached.meta === meta && cached.sheet.resourceId === resourceId) return cached.sheet;
  const url = uploadedAssetUrl(sheetAsset);
  if (!url) return undefined;
  const sheet: PixelEnemySheet = {
    resourceId,
    path: `uploaded/${meta.sheetResourceId}.png`,
    url,
    motion: meta.motion,
    idleFrameMs: Number.isFinite(meta.idleFrameMs) && meta.idleFrameMs >= 60 ? meta.idleFrameMs : 200,
    cell: meta.cell,
    ...(meta.skillCell ? { skillCell: true as const } : {}),
    ...(meta.skillSlug ? { skillSlug: meta.skillSlug } : {}),
    ...(isExtendedPixelGrid(meta.grid) ? { grid: meta.grid, missingCells: (meta.missingCells ?? []).filter((index) => pixelEnemyOptionalCells(meta.grid).includes(index)) } : {}),
    projectAuthored: true,
  };
  projectSheetCache.set(sheetAsset, { meta, sheet });
  return sheet;
}

/**
 * 이 몬스터 소재가 전투에서 도트 시트로 움직이면 그 이동 방식(hop·swoop …), 아니면 undefined(번쩍임·흔들림만).
 * 프로젝트 업로드가 같은 id 를 덮으면 그 업로드의 시트만 본다(battleFieldDom applyPixelEnemySheet 와 같은 규칙).
 */
export function monsterBattleMotion(project: PixelEnemySheetProject, resourceId: string): PixelEnemyMotion | undefined {
  const authored = projectPixelEnemySheet(resourceId, project);
  if (authored) return authored.motion;
  if (Object.hasOwn(project.assets.uploaded, resourceId)) return undefined;
  return bundledPixelEnemySheet(resourceId)?.motion;
}

/** 이 몬스터 소재의 전투 시트가 20칸(5×4)이면 20, 16칸(4×4)이면 16, 9칸이면 9, 시트가 없으면 undefined. */
export function monsterBattleCells(project: PixelEnemySheetProject, resourceId: string): 9 | 16 | 20 | undefined {
  const authored = projectPixelEnemySheet(resourceId, project);
  if (authored) return authored.grid === "5x4" ? 20 : authored.grid === "4x4" ? 16 : 9;
  if (Object.hasOwn(project.assets.uploaded, resourceId)) return undefined;
  const bundled = bundledPixelEnemySheet(resourceId);
  if (!bundled) return undefined;
  return bundled.grid === "5x4" ? 20 : bundled.grid === "4x4" ? 16 : 9;
}

/** 저작 시트가 있으면 그것, 없으면 번들 시트. */
export function pixelEnemySheet(resourceId: string | undefined): PixelEnemySheet | undefined {
  return projectPixelEnemySheet(resourceId) ?? bundledPixelEnemySheet(resourceId);
}

export function pixelEnemyCell(entry: PixelEnemySheet): number {
  return entry.cell ?? PIXEL_ENEMY_CELL;
}

export function pixelEnemySheetUrl(entry: PixelEnemySheet): string {
  return entry.url ?? withInlineAsset(`/${entry.path}`);
}
