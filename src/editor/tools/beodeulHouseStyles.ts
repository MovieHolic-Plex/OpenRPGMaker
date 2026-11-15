// 버들항 마을 시공기의 집 양식 — 그 게임이 고른 양식(tileset.look.houseStyle)의 집 무리를 돌려준다.
// 시공기(beodeulVillage.ts)의 집 목록은 작은 표다(본 무리 · 강조 · 앵커). 양식은 그 표의 한 줄을 통째로 바꾼다:
//   본 무리 = 오두막·살림집·큰 집 · 강조 = 가게집 · 앵커 = 같은 양식의 여관·예배당/회관 · 일터 = 같은 양식의 대장간·방앗간·창고.
// 지붕 가족을 직접 말한 요청(roofs)과 자기 집이 있는 테마(사막·설원·늪)는 양식을 쓰지 않는다 — 그 판정은 시공기가 한다.
import { houseStyleOf } from "@/assets/houseStyles";
import type { TilesetLook } from "@/project/types";

export interface HouseStylePools {
  readonly id: string;
  /** 보고에 적는 이름(«지붕 <이름>») */
  readonly label: string;
  readonly main: string[];
  readonly accent: string[];
  readonly anchors: string[];
  readonly works: string[];
}

/** 그 게임의 집 양식 무리(양식을 고르지 않은 게임·열쇠 없는 실행·옛 게임은 undefined — 예전 그대로 짓는다). */
export function houseStylePools(tilesetId: string, look: TilesetLook | undefined): HouseStylePools | undefined {
  const style = houseStyleOf(tilesetId, look?.houseStyle);
  if (!style || !look?.houseStyle) return undefined;
  const of = (...roles: string[]): string[] => style.houses.filter((house) => roles.includes(house.role)).map((house) => house.id);
  return { id: look.houseStyle, label: style.label, main: of("cottage", "family", "large"), accent: of("shop"), anchors: of("inn", "hall"), works: of("work") };
}

