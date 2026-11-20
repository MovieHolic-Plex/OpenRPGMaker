// project/jpCityStreetPieces.ts
// 일본 거리의 새 조각 표(fable_street 블록) — 바닥 가족, 소품(앵커 등급·칸 크기·바닥별 그림자 변형), 경계 줄 가족, 옛 키트 id → 새 조각 대응.
// 왜(오너 2026-11-15 «확대해서 보면 엉망진창인 게 너무많다. 버들항급 퀄리티도 안 되고»): 옛 소품은 손이 셋이고 크기가 제각각이며 아무 칸에나 놓였다.
//   새 조각은 모두 한 손으로 다시 그렸고, 조각마다 «어디에 서는가»(앵커 등급)를 자료로 갖는다 — 구성기는 그 자리에만 놓는다.
// 자료: src/assets/jpCityStreetPieces.json (생성물 — scripts/content/jp-city/street/fable_street_spec.py).
import piecesJson from "@/assets/jpCityStreetPieces.json" with { type: "json" };

/**
 * 바닥 가족: 0 없음 · pave 보도 블록 · forecourt 가게 앞마당 판 · tarmac 아스팔트(연석 있는 차도·주차장) · alley 골목 돌길(참배길·옛 골목) · earth 다진 흙 · lawn 잔디 · water 물 ·
 * lane 생활도로 포장(보도 없는 길의 낡은 포장) · laneside 생활도로 길가 띠(북쪽 한 줄 — 배수로·흰 선이 그림에 들어 있다)
 */
export const GROUND_FAMILIES = ["none", "pave", "forecourt", "tarmac", "alley", "earth", "lawn", "water", "lane", "laneside"] as const;
export type GroundFamily = (typeof GROUND_FAMILIES)[number];

/**
 * 앵커 등급 — 조각이 설 수 있는 자리.
 * wall 벽(건물 정면·담) 바로 앞 칸 · kerb 연석 줄(차도 옆 보도 칸) · lot 필지 안(건물·담·필지 끝에 붙은 칸) · open 광장·공원·마당 한가운데도 됨 ·
 * facade 건물 벽면 위 · road 차도(차만) · water 물 · floor 바닥에 깔리는 것(맨홀·디딤돌·표시) · run 경계 줄 조각(줄 짓기만 놓는다)
 */
export type StreetAnchor = "wall" | "kerb" | "lot" | "open" | "facade" | "road" | "water" | "floor" | "run";

export interface StreetPiece {
  readonly w: number; readonly h: number; readonly anchor: StreetAnchor;
  /** ground = 1층(제 바닥 칸을 가져오는 조각: 둑) · floor = 2층(바닥 장식) · prop·over = 4층(서 있는 것) */
  readonly layer: "ground" | "floor" | "prop" | "over";
  /** 바닥별 그림자 변형이 있는 바닥 가족(없으면 변형 없음 — 키트 id 가 조각 이름 그대로) */
  readonly grounds?: readonly GroundFamily[];
  readonly tags: readonly string[];
  /** 같은 그림으로 치는 이름(«한 화면에 한 번» 규칙) — 없으면 조각 이름 */
  readonly look?: string;
  /** «한 화면에 한 번» 규칙에서 빠지는 것(나무·경계 줄·바닥 조각) */
  readonly repeat?: boolean;
  readonly ko: string;
}

/** 경계 줄 가족: 닫힌 고리 아홉 조각 + 끝·대문·바뀜 조각. 가로 줄 조각은 2칸 높이(발 줄 위로 한 칸), 세로 줄 조각은 1칸. */
export interface StreetRun {
  readonly ko: string;
  /** 가로 줄 가운데(되풀이) · 바뀜 조각(가끔) */ readonly mid: string; readonly mids: readonly string[];
  readonly endL: string; readonly endR: string;
  /** 세로 줄(왼쪽·오른쪽) — 없으면 가로 줄만 짓는 가족 */ readonly sideL?: string; readonly sideR?: string;
  /** 모퉁이: 뒤(북쪽) 왼·오른, 앞(남쪽) 왼·오른 */ readonly nw?: string; readonly ne?: string; readonly sw?: string; readonly se?: string;
  /** 대문: 왼 기둥 · 문 · 오른 기둥 */ readonly gate?: readonly [string, string, string];
}

interface PiecesData {
  readonly version: number;
  readonly grounds: Readonly<Record<string, string>>;
  readonly pieces: Readonly<Record<string, StreetPiece>>;
  readonly runs: Readonly<Record<string, StreetRun>>;
  /** 옛 키트 id(또는 옛 담 재료 이름) → 새 조각 이름들 */
  readonly alias: Readonly<Record<string, readonly string[]>>;
  /** 옛 바닥 재료 이름 → 바닥 가족 */
  readonly groundOf: Readonly<Record<string, string>>;
  /** 옛 담 재료 이름 → 경계 줄 가족 */
  readonly runOf: Readonly<Record<string, string>>;
}
const DATA = piecesJson as unknown as PiecesData;

export const STREET_PIECES: Readonly<Record<string, StreetPiece>> = DATA.pieces;
export const STREET_RUNS: Readonly<Record<string, StreetRun>> = DATA.runs;
export const STREET_KIT_PREFIX = "jp-st-";

export function streetPiece(name: string): StreetPiece | undefined { return STREET_PIECES[name]; }
/** 조각의 키트 id — 바닥별 변형이 있으면 «이름--바닥». */
export function streetKitId(name: string, ground?: GroundFamily): string {
  const p = STREET_PIECES[name];
  const g = p?.grounds && p.grounds.length ? (ground && p.grounds.includes(ground) ? ground : p.grounds[0]!) : undefined;
  return `${STREET_KIT_PREFIX}${name}${g ? `--${g}` : ""}`;
}
/** 키트 id → 조각 이름(새 조각이 아니면 undefined). */
export function streetPieceOfKit(kitId: string): string | undefined {
  if (!kitId.startsWith(STREET_KIT_PREFIX)) return undefined;
  const name = kitId.slice(STREET_KIT_PREFIX.length).split("--")[0]!;
  return STREET_PIECES[name] ? name : undefined;
}
/** 옛 키트 id 가 가리키는 새 조각들(없으면 빈 목록 — 새 거리에는 놓지 않는다). 새 조각 이름을 그대로 줘도 된다. */
export function streetAlias(id: string): readonly string[] {
  if (STREET_PIECES[id]) return [id];
  return (DATA.alias[id] ?? []).filter((n) => STREET_PIECES[n]);
}
/** 혼자 서 있으면 안 되는 조각 — 벽·건물 옆이거나 길 곁에만 선다(대나무 가림 울·석등·물확·마당 수도·창고·개집·빨래·이불). */
export const STREET_ATTACHED: ReadonlySet<string> = new Set(["sodegaki", "lantern-stone", "basin", "tap", "shed", "doghouse", "laundry", "futon"]);

export function streetTagged(tag: string): string[] { return Object.keys(STREET_PIECES).filter((n) => STREET_PIECES[n]!.tags.includes(tag)); }
export function groundFamilyOf(material: string): GroundFamily {
  const f = material.startsWith("@") ? material.slice(1) : DATA.groundOf[material];
  return (GROUND_FAMILIES as readonly string[]).includes(f ?? "") ? (f as GroundFamily) : "pave";
}
export function groundMaterial(f: GroundFamily): string { return DATA.grounds[f] ?? ""; }
export function runFamilyOf(material: string): string | undefined { const r = DATA.runOf[material] ?? material; return STREET_RUNS[r] ? r : undefined; }
export const STREET_PIECE_COUNT = Object.keys(STREET_PIECES).length;
