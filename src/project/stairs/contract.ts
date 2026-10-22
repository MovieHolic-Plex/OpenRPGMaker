// project/stairs/contract.ts
// 계단·사다리·에스컬레이터·바닥 구멍의 「입구 계약」(2026-10-22).
//
// 왜: 계단 조각 설명에는 「무엇인지」만 있고 「어느 칸으로 들어서는지」가 없었다. 그래서 조수·방 조립기·데모 빌더가
// 계단을 벽에 등지게 하거나, 앞 칸을 가구로 막거나, 오르는 계단으로 내려가게 놓았다(첫사랑 사무층: 옥상으로 가는 길에
// 내려가는 계단통). 이 계약이 정본이다 — 칸 좌표는 모두 키트 원점(키트 rows 의 왼쪽 위) 기준 상대 좌표다.
//
//   footprint  w×h      키트 그대로의 칸 덩어리(그림이 벽면 위로 솟는 위 줄 포함).
//   trigger            층 이동 이벤트를 다는 칸 = 계단 그림 칸(밟거나 부딪히는 칸). 반드시 이 칸들 중 하나에 둔다.
//   approach / side    들어서는 쪽 바닥 칸(키트 밖). 반드시 걸을 수 있는 바닥이고 방과 이어져야 한다.
//                      다른 층에서 이 계단으로 도착하면 approach 칸에 내리고 side 쪽을 바라본다(계단을 등진다).
//   passable           키트 안에서 밟을 수 있는 칸.
//   mode               walk = trigger 칸을 밟고 올라선다 · bump = trigger 칸이 막힌 그림이라 approach 칸에서 부딪혀 탄다(priority same).
//   leads              up 위층으로 · down 아래층으로 · same 같은 맵 안의 단(이동 이벤트 없음, exit 쪽으로 이어진다).
//   exit               leads=same 일 때 반대쪽 끝(올라선 뒤 나가는 칸, 키트 밖).
import contracts from "@/assets/stairContracts.json";

export type StairSide = "N" | "S" | "E" | "W";
export type StairLeads = "up" | "down" | "same";
export type Rel = readonly [number, number];

export interface StairContract {
  readonly leads: StairLeads;
  readonly w: number;
  readonly h: number;
  readonly trigger: readonly Rel[];
  readonly approach: readonly Rel[];
  readonly side: StairSide | "any";
  readonly passable: readonly Rel[];
  readonly mode: "walk" | "bump";
  readonly exit?: readonly Rel[];
  /** derived = 이름표·통행에서 유도 · checked = 4배 확대 그림을 보고 사람이 확인/고침. */
  readonly source: "derived" | "checked";
  /** 조수가 읽는 한 줄(한국어). */
  readonly note: string;
}

interface StairContractFile {
  readonly version: number;
  /** tilesetId → kitId → 계약. */
  readonly kits: Readonly<Record<string, Readonly<Record<string, StairContract>>>>;
  /** 손 도트 실내 사양(조립기) 물건 id → { tileset, kit, lift } — 사양 좌표 (o.x,o.y) 는 키트 원점에서 (0, lift) 아래다. */
  readonly objects: Readonly<Record<string, Readonly<Record<string, { readonly kit: string; readonly lift: number }>>>>;
}

const FILE = contracts as unknown as StairContractFile;

export const SIDE_DELTA: Readonly<Record<StairSide, Rel>> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
/** 계단을 등진 방향(도착해서 바라보는 쪽) — 런타임 direction 값. */
export const SIDE_FACING: Readonly<Record<StairSide, "up" | "down" | "left" | "right">> = { N: "up", S: "down", E: "right", W: "left" };
const SIDE_KO: Readonly<Record<StairSide | "any", string>> = { N: "북쪽", S: "남쪽", E: "동쪽", W: "서쪽", any: "어느 쪽이든(옆 바닥)" };

export function stairContractForKit(tilesetId: string, kitId: string): StairContract | undefined {
  return FILE.kits[tilesetId]?.[kitId];
}

/** 키트 정의에 계약이 직접 붙어 있으면(사용자 키트) 그것, 없으면 번들 표. */
export function stairContractOf(tilesetId: string, kit: { id: string; stair?: StairContract }): StairContract | undefined {
  return kit.stair ?? stairContractForKit(tilesetId, kit.id);
}

/** 조립기 사양 물건 id 의 계약과, 사양 좌표 → 키트 원점 변환(키트 원점 = (o.x, o.y - lift)). */
export function stairContractForSpecObject(specTilesetId: string, objectId: string): { contract: StairContract; kit: string; lift: number } | undefined {
  const ref = FILE.objects[specTilesetId]?.[objectId];
  if (!ref) return undefined;
  const contract = stairContractForKit(specTilesetId, ref.kit);
  return contract ? { contract, kit: ref.kit, lift: ref.lift } : undefined;
}

export function allStairContracts(): ReadonlyArray<{ tilesetId: string; kitId: string; contract: StairContract }> {
  const out: { tilesetId: string; kitId: string; contract: StairContract }[] = [];
  for (const [tilesetId, kits] of Object.entries(FILE.kits)) for (const [kitId, contract] of Object.entries(kits)) out.push({ tilesetId, kitId, contract });
  return out;
}

export function stairSpecObjectIds(specTilesetId: string): readonly string[] {
  return Object.keys(FILE.objects[specTilesetId] ?? {});
}

export interface PlacedStair {
  readonly contract: StairContract;
  /** 키트 원점의 맵 좌표. */
  readonly x: number;
  readonly y: number;
}

const abs = (p: PlacedStair, cells: readonly Rel[]) => cells.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));
export const stairTriggerCells = (p: PlacedStair) => abs(p, p.contract.trigger);
export const stairApproachCells = (p: PlacedStair) => abs(p, p.contract.approach);
export const stairExitCells = (p: PlacedStair) => abs(p, p.contract.exit ?? []);

/** 도착 방향(계단을 등진다). side=any 면 approach 칸이 trigger 와 이루는 방향. */
export function stairArrivalFacing(contract: StairContract, approach?: { x: number; y: number }, trigger?: { x: number; y: number }): "up" | "down" | "left" | "right" {
  if (contract.side !== "any") return SIDE_FACING[contract.side];
  if (approach && trigger) {
    const dx = approach.x - trigger.x, dy = approach.y - trigger.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy < 0 ? "up" : "down";
  }
  return "down";
}

/** 조수에게 보여 주는 한 줄. 좌표는 키트 원점 기준. */
export function describeStairContract(c: StairContract): string {
  const cells = (list: readonly Rel[]) => list.map(([x, y]) => `(${x},${y})`).join(" ");
  const lead = c.leads === "up" ? "위층으로 오른다" : c.leads === "down" ? "아래층으로 내려간다" : "같은 맵 안의 단(층 이동 없음)";
  const how = c.mode === "walk" ? "계단 칸을 밟는다" : "계단 그림 칸이 막혀 있어 앞 칸에서 부딪혀 탄다(이벤트 priority same)";
  const exit = c.exit?.length ? ` · 위 끝(나가는 칸) ${cells(c.exit)}` : "";
  return `계단 입구: ${lead} · 들어서는 쪽 ${SIDE_KO[c.side]} · 앞 칸(비워 둘 바닥) ${cells(c.approach)} · 이동 칸 ${cells(c.trigger)} — ${how}${exit} · `
    + `도착은 앞 칸에 내려 계단을 등지고(${c.side === "any" ? "앞 칸 쪽" : SIDE_FACING[c.side]}) 선다. 좌표는 키트 왼쪽 위 기준.`;
}
