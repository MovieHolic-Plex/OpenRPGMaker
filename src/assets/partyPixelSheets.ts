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
import type { PixelEnemyMotion } from "@/assets/pixelEnemySheets";

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
}));

const byId = new Map(PARTY_PIXEL_SHEETS.map((entry) => [entry.resourceId, entry]));

/** 리소스 id 가 파티원 도트 시트면 그 항목. */
export function partyPixelSheet(resourceId: string | undefined): PartyPixelSheet | undefined {
  return resourceId ? byId.get(resourceId) : undefined;
}

export function partyPixelSheetUrl(entry: PartyPixelSheet): string {
  return withInlineAsset(`/${entry.path}`);
}
