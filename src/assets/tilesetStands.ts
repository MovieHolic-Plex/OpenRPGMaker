// 숲 구성(stand) · 풀밭 얼룩(meadow) — «한 맵의 숲이 나무 그림 하나를 고른 간격으로 찍은 것» 으로 읽히지 않게(2026-11-13 오너: «나무랑 땅 타일도 좀
// 다양하게 해야할듯. 특히 숲쪽....»).
//
// 숲 구성 하나는 주 수종 · 곁 수종 둘 · 드문 강조 나무 · 물가 나무 · 덤불과 숲 바닥 재질이다. 나무 킷의 칸 번호·통행·이름은 그대로 두고
//   · 킷마다 다른 수종 그림을 그릴 때만 겹치고(pairs — assets/tilesetLooks.ts 가 겉모습 이식에 얹는다),
//   · 이어진 숲 수관(자연 덧그림 칸)도 그 수종 수관으로 다시 지은 그림을 겹치며(sources),
//   · 시공기는 역할별 킷 목록(kits)으로 «주 수종 많이 · 곁 수종 섞어 · 강조 나무 드물게» 를 고른다.
// 숲 바닥·풀밭 얼룩은 2층 투명 덧그림 칸이다(overlays — 꼭짓점 넷의 안팎 15꼴). 1층 바닥 칸·통행은 그대로다(editor/tools/beodeulGroundCover.ts).
// 그림판·표는 scripts/content/beodeul-looks/bake_stands.py 가 굽는다. 고르기는 겉모습의 stand·meadow 갈래(project/tilesetLook.ts).
import beodeulStands from "./beodeulStands.json";
import type { TilesetDef } from "@/project/types";

export type StandRole = "dominant" | "companion" | "accent" | "shrub" | "water" | "row" | "fruit";
type Pairs = readonly number[];
export type TilesetStand = {
  readonly label: string; readonly en?: string;
  /** 숲 바닥 재질(overlays 열쇠). */
  readonly floor: string;
  /** [버들항 칸, 그림판 칸] 쌍 — 나무 킷 칸의 그림. */
  readonly pairs: Pairs;
  /** 그림판별 [원본 칸, 그림판 칸] 쌍 — 이어진 숲 수관·숲 그늘. */
  readonly sources: Readonly<Record<string, Pairs>>;
  readonly kits: Readonly<Partial<Record<StandRole, readonly string[]>>>;
  /** 밑풀 킷(고사리·버섯·그루터기·통나무·바위·들꽃) — 숲 바닥 재질에 맞춘 목록. 이미 있는 킷이다. */
  readonly under: readonly string[];
};
export type GroundOverlay = {
  readonly label: string; readonly en?: string; readonly role: "floor" | "patch";
  /** [꼭짓점 비트 북서1·북동2·남서4·남동8] → 그림판 칸(0 은 -1). alt = 둘째 벌. */
  readonly cells: readonly number[]; readonly alt: readonly number[];
  /** 이 재질과 같은 바닥 겉모습(grounds 열쇠) — 바닥이 이 재질인 게임에는 얼룩으로 깔지 않는다. */
  readonly ground?: string;
  /** 이 바닥 겉모습 위에는 깔지 않는다(모래·맨흙 위의 짙은 풀·들꽃). */
  readonly avoid?: readonly string[];
  /** 작은 자리로만 깐다(맨흙 — 넓게 깔면 풀밭이 얼룩덜룩한 흙판이 된다). */
  readonly small?: boolean;
  /** [자연 덧그림 그림자 칸, 그 그림자를 이 바닥에 얹은 그림판 칸] 쌍. */
  readonly shadow?: Pairs;
};
export type TilesetStandTable = {
  readonly version: number; readonly tilesetId: string; readonly image: string; readonly texture: string;
  readonly tileSize: number; readonly tilesPerRow: number; readonly count: number;
  readonly stands: Readonly<Record<string, TilesetStand>>;
  readonly meadows: Readonly<Record<string, { readonly label: string; readonly en?: string; readonly patches: readonly string[] }>>;
  readonly overlays: Readonly<Record<string, GroundOverlay>>;
  /** 닳은 땅(문 앞·우물 곁) 재질 · 길가/물가 띠 재질(overlays 열쇠). */
  readonly worn: string; readonly verge: { readonly water: string; readonly road: string };
  /** 물가 갈대 킷. */
  readonly reed: string;
};

const TABLES: readonly TilesetStandTable[] = [beodeulStands as unknown as TilesetStandTable];

/** 숲 그림판 textureKey → 칸 수(bundledChipsetFrameCount 가 쓴다). */
export function tilesetStandSheetCount(textureKey: string): number | undefined {
  return TABLES.find((table) => table.texture === textureKey)?.count;
}

export function tilesetStandTableFor(tilesetId: string): TilesetStandTable | undefined {
  return TABLES.find((table) => table.tilesetId === tilesetId);
}

/** 그 겉모습의 숲 구성(없으면 undefined — 원래 숲). */
export function tilesetStand(tilesetId: string, stand: string | undefined): TilesetStand | undefined {
  return stand ? tilesetStandTableFor(tilesetId)?.stands[stand] : undefined;
}

const sources = new WeakMap<object, TilesetDef>();
/**
 * 덧그림 칸의 «원본 타일셋» — translateTiles 가 맵 타일셋으로 이식할 때 통행·위아래·이름표를 여기서 옮긴다.
 * 모두 ★(통행 + 상위): 2층 덧그림은 통행 판정에서 건너뛰고(칸의 통행은 1·3층이 정한다) 캐릭터 밑 묶음이라 인물 아래에 그린다(자연 덧그림과 같은 규칙).
 * 프로젝트에 넣지 않는다 — 타일셋 목록이 늘지 않는다.
 */
export function standOverlaySource(table: TilesetStandTable): TilesetDef {
  const hit = sources.get(table);
  if (hit) return hit;
  const n = table.count;
  const meta: { label: string; description: string }[] = Array.from({ length: n }, () => ({ label: "", description: "" }));
  for (const overlay of Object.values(table.overlays)) {
    const text = { label: overlay.label, description: overlay.role === "floor" ? "숲 바닥 — 2층 투명 덧그림(통행은 아래 바닥 그대로)" : "풀밭 얼룩 — 2층 투명 덧그림(통행은 아래 바닥 그대로)" };
    for (const cell of [...overlay.cells, ...overlay.alt]) if (cell > 0) meta[cell] = text;
    const shadow = overlay.shadow ?? [];
    for (let i = 1; i < shadow.length; i += 2) meta[shadow[i]!] = { label: `${overlay.label} · 그림자`, description: text.description };
  }
  const tileset = {
    id: "beodeul_stands", name: "버들항 · 숲 바닥·풀밭 얼룩 덧그림",
    image: { type: "bundled", id: table.texture }, kind: "custom", family: "oprn-atlas",
    tileSize: table.tileSize, tilesPerRow: table.tilesPerRow, count: n,
    passability: Array.from({ length: n }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array(n).fill("upper"), terrain: Array(n).fill(0), tileMeta: meta,
  } as unknown as TilesetDef;
  sources.set(table, tileset);
  return tileset;
}
