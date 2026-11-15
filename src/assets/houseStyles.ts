// 집 양식(house style) — 게임마다 «다른 건축» 의 집 가족 하나(2026-11-14 오너: «집의 스타일들도 … 공격적으로 추가해. 맨날 뻔한 '그림체' 만 나오잖나»).
//
// 집 벌(assets/houseSets.ts)은 원본 킷과 같은 칸 크기·같은 문 칸의 그림만 갈아 끼웠다 — 벽·지붕 재질은 달라져도 덩어리·지붕 꼴·비례가 모든 게임에서 같았다.
// 양식은 새 킷 가족이다: 양식마다 집 열두 채(오두막 2 · 살림집 3 · 큰 집 2 · 가게집 2 · 여관 · 일터 · 예배당/회관)가 제 칸 크기·제 윤곽을 갖는다.
// 킷은 버들항 시트 끝에 굽고(scripts/content/beodeul-house-styles/bake.py — `bd-house-st-<양식>-<집>` + 그림자·기초), 이 표는 양식마다 킷과 역할만 싣는다.
// 양식 이름은 겉모습(tileset.look.houseStyle)에 한 번 적힌다(project/tilesetLook.ts) — 그 게임의 모든 마을이 같은 양식이다. 마을 시공기가 읽는다(editor/tools/beodeulHouseStyles.ts).
import beodeulHouseStyles from "./beodeulHouseStyles.json";

export type HouseStyleRole = "cottage" | "family" | "large" | "shop" | "inn" | "work" | "hall";
export type HouseStyle = { readonly label: string; readonly en?: string; readonly houses: readonly { readonly id: string; readonly role: HouseStyleRole; readonly w: number; readonly h: number }[] };
export type HouseStyleTable = {
  readonly version: number;
  readonly tilesetId: string;
  readonly gate: string;
  readonly kitPrefix: string;
  readonly shadowPrefix: string;
  readonly foundationPrefix: string;
  readonly styles: Readonly<Record<string, HouseStyle>>;
};

const TABLES: readonly HouseStyleTable[] = [beodeulHouseStyles as unknown as HouseStyleTable];

export function houseStyleTableFor(tilesetId: string): HouseStyleTable | undefined {
  return TABLES.find((table) => table.tilesetId === tilesetId);
}

const MAIN: readonly HouseStyleRole[] = ["cottage", "family", "large"];
/** 마을 하나를 지을 수 있는 양식인가 — 본 무리 집 셋 이상과 여관이 있어야 한다(양식은 하나씩 구워진다 — 덜 구운 양식은 고르지 않는다). */
function buildable(style: HouseStyle): boolean {
  return style.houses.filter((house) => MAIN.includes(house.role)).length >= 3 && style.houses.some((house) => house.role === "inn");
}

/** 그 타일셋에서 게임이 고를 수 있는 양식 이름들(표 순서). */
export function houseStyleNames(tilesetId: string): string[] {
  const table = houseStyleTableFor(tilesetId);
  return table ? Object.keys(table.styles).filter((name) => buildable(table.styles[name]!)) : [];
}

export function houseStyleOf(tilesetId: string, name: string | undefined): HouseStyle | undefined {
  const style = name ? houseStyleTableFor(tilesetId)?.styles[name] : undefined;
  return style && buildable(style) ? style : undefined;
}
