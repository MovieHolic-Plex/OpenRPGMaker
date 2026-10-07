import { decodeBase64, type Rgb } from "./raster.ts";

/**
 * 생성 건물 설계도. 칸 16px.
 * map: X 건물(막힘·하위) . 땅 D 입구(위 칸 검정·아래 칸 원본 문, 막힘) * 머리 공간(굴뚝·첨탑만, 상위·통행) G 성문 통로(하위·통행) A 성문 위(상위·통행).
 * zones(선택): R 지붕 윗면 W 앞벽 - 상관없음. R 바로 아래 W 인 경계가 처마선.
 */
export interface BuildingBlueprint {
  readonly id: string;
  readonly label: string;
  readonly subject: string;
  readonly stories: number;
  readonly map: readonly string[];
  readonly zones?: readonly string[];
  readonly zoneTint?: boolean;
}

/** 화풍 묶음. 옛 숲마을 건물 키트(tiledata/forest-harmony-buildings)는 2026-10-07 저작권 정리로 지웠다. */
export interface StyleKitJson {
  readonly tileset: string;
  readonly tile: number;
  readonly scale: number;
  readonly canvas: number;
  readonly styleForm: string;
  readonly palette: readonly Rgb[];
  readonly roofColors: readonly Rgb[];
  readonly roofShare: readonly number[];
  readonly timber: readonly Rgb[];
  readonly doorTile: string;
  readonly style: { readonly w: number; readonly h: number; readonly rgba: string };
}

export interface StyleKit extends Omit<StyleKitJson, "doorTile" | "style"> {
  readonly doorTile: Uint8Array;
  readonly style: { readonly w: number; readonly h: number; readonly rgba: Uint8Array };
}

export function decodeStyleKit(json: StyleKitJson): StyleKit {
  return {
    ...json,
    doorTile: decodeBase64(json.doorTile),
    style: { w: json.style.w, h: json.style.h, rgba: decodeBase64(json.style.rgba) },
  };
}

/** 기준 이미지 안 설계도 자리(bp_ref 의 {id}-ref.json). */
export interface ReferenceLayout {
  readonly width: number;
  readonly height: number;
  readonly origin: readonly [number, number];
  readonly scale: number;
}

export const BODY_CELLS = "XDGA";
