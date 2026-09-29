// 도트 측면 전투(retro2003) **파티원용 몬스터 9칸 시트** 카탈로그 — 사람형이 아닌 걷기 칩(짐승·탈것·몬스터)의 전투 그림.
//
// 규격은 적 도트 시트(pixelEnemySheets.ts)와 같다: 셀 cell(48·64) 정사각 3×3, (0,0)(1,0)(2,0) 대기 a·b·c ·
// (0,1) windup · (1,1) move · (2,1) attack · (0,2) recover · (1,2) hit · (2,2) dead. 다른 점 하나 — 파티원은 화면 오른쪽에서
// **왼쪽을 본다**. 그래서 그림이 이미 왼쪽을 보고 그려져 있고, 적 도트의 이동 경로(hop·swoop·stomp·dash·float·shoot·breath)는
// 가로 방향만 뒤집어 재사용한다(battleRetroMotion 의 partySign).
//
// 시트 목록의 정본은 묶음 파일(src/assets/retroRosterSkills/<batch>.ts 의 partyPixel). 여기서는 그 목록에서 조회만 한다.
// 리소스 id 는 "party-pixel-<칩>" — 배우 battleCharacterResourceId 에 그대로 넣는다(별도 스키마 필드 없음).
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { RETRO_PARTY_PIXEL_SHEETS } from "@/assets/retroRosterSkills";
import { PIXEL_ENEMY_FRAME, type PartyPixelCell, type PartyPixelExtraCell, type PixelEnemyCell, type PixelEnemyMotion } from "@/assets/pixelEnemySheets";
import { RETRO_ROSTER } from "@/assets/retroRoster";

export const PARTY_PIXEL_PREFIX = "party-pixel-";

export interface PartyPixelSheet {
  /** "party-pixel-<칩>" */
  readonly resourceId: string;
  readonly chip: string;
  /** public 기준 경로(선행 슬래시 없음). */
  readonly path: string;
  readonly cell: 48 | 64;
  readonly motion: PixelEnemyMotion;
  /** 대기 루프 한 칸 길이(ms). a→b→c→b. */
  readonly idleFrameMs: number;
  /** 시트 행 수(3 = 9칸, 5 = 15칸 확장). */
  readonly rows: 3 | 5;
  /** 화면 상자 한 변(px). 칩 × 1 그림은 셀 × 2, 칩 × 2 그림(art 2)은 셀 × 1 — 어느 쪽이든 칩 한 픽셀이 화면 2px 다. */
  readonly box: number;
}

export function partyPixelResourceId(chip: string): string {
  return `${PARTY_PIXEL_PREFIX}${chip}`;
}

export const PARTY_PIXEL_SHEETS: readonly PartyPixelSheet[] = RETRO_PARTY_PIXEL_SHEETS.map((entry) => ({
  resourceId: partyPixelResourceId(entry.chip),
  chip: entry.chip,
  path: `assets/generated/party-pixel/${entry.chip}.png`,
  cell: entry.cell,
  motion: entry.motion,
  idleFrameMs: entry.idleFrameMs,
  rows: entry.rows ?? 3,
  box: entry.cell * (entry.art === 2 ? 1 : 2),
}));

/** 15칸 시트의 확장 칸 자리(열, 행). 행 0~2 는 PIXEL_ENEMY_FRAME 과 같다. */
export const PARTY_PIXEL_EXTRA_FRAME: Readonly<Record<PartyPixelExtraCell, { readonly col: number; readonly row: number }>> = {
  cast_charge: { col: 0, row: 3 },
  cast_raise: { col: 1, row: 3 },
  cast_release: { col: 2, row: 3 },
  leap: { col: 0, row: 4 },
  buff: { col: 1, row: 4 },
  finisher: { col: 2, row: 4 },
};
/** 확장 칸이 없는 9칸 시트에서 대신 쓸 칸. */
const EXTRA_FALLBACK: Readonly<Record<PartyPixelExtraCell, PixelEnemyCell>> = {
  cast_charge: "windup", cast_raise: "move", cast_release: "attack", leap: "move", buff: "windup", finisher: "attack",
};

/** 이 시트에서 칸의 실제 자리. 9칸 시트면 확장 칸을 기존 칸으로 물린다. */
export function partyPixelFrame(sheet: Pick<PartyPixelSheet, "rows">, cell: PartyPixelCell): { readonly col: number; readonly row: number } {
  if (cell in PIXEL_ENEMY_FRAME) return PIXEL_ENEMY_FRAME[cell as PixelEnemyCell];
  const extra = cell as PartyPixelExtraCell;
  return sheet.rows >= 5 ? PARTY_PIXEL_EXTRA_FRAME[extra] : PIXEL_ENEMY_FRAME[EXTRA_FALLBACK[extra]];
}

/** background-position 백분율(열 0~2, 행 0~rows−1). background-size 는 300% × (rows×100)%. */
export function partyPixelBackgroundPosition(sheet: Pick<PartyPixelSheet, "rows">, cell: PartyPixelCell): string {
  const at = partyPixelFrame(sheet, cell);
  return `${at.col * 50}% ${sheet.rows > 1 ? (at.row * 100) / (sheet.rows - 1) : 0}%`;
}

const byId = new Map(PARTY_PIXEL_SHEETS.map((entry) => [entry.resourceId, entry]));

/** 리소스 id 가 파티원 도트 시트면 그 항목. */
export function partyPixelSheet(resourceId: string | undefined): PartyPixelSheet | undefined {
  return resourceId ? byId.get(resourceId) : undefined;
}

export function partyPixelSheetUrl(entry: PartyPixelSheet): string {
  return withInlineAsset(`/${entry.path}`);
}

/** 피커·미리보기 라벨: 「파티원 몬스터 전투 · 슬라임」. 로스터 표에 없는 칩이면 칩 id. */
export function partyPixelLabel(entry: PartyPixelSheet): string {
  return `파티원 몬스터 전투 · ${RETRO_ROSTER.find((row) => row.chip === entry.chip)?.name ?? entry.chip}`;
}
