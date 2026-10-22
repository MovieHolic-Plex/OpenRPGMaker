// src/editor/workshop/objectRequest.ts
/**
 * 조수의 「없는 기물 만들기」(generate_missing_object) 요청 — 도구·카드·시험 구동기가 함께 쓰는 순수 모듈(DOM 없음).
 * 도구는 요청만 만들고, 편집기 카드(aiObjectGenCard.ts)가 공방 실행기(object-gen)로 후보를 그린 뒤
 * 사용자가 고르거나(기본) 사용자가 켠 「알아서 고르기」가 검수 통과 후보를 골라 칩셋에 굽는다. 놓는 것은 후속 턴의 조수다.
 */
import type { Grid, ItemDefinition, WorkshopRun } from "@/harnesses/_core/workshop/types";
import { newItemKey } from "@/harnesses/interior-props/editor/items";

export type ObjectGenHarness = "interior-props" | "map-objects";
/** floor 바닥에 세움 · wall 북쪽 벽 앞 · hang 벽에 걸기 · flat 밟는 바닥 무늬(깔개) */
export type ObjectGenKind = "floor" | "wall" | "hang" | "flat";
export const OBJECT_GEN_KINDS: readonly ObjectGenKind[] = ["floor", "wall", "hang", "flat"];

export interface ObjectGenRequest {
  readonly kind: "workshop-object-request";
  readonly harnessId: ObjectGenHarness;
  readonly tilesetId: string;
  readonly tilesetName: string;
  readonly mapId: string;
  readonly title: string;
  readonly description: string;
  readonly objectKind: ObjectGenKind;
  readonly tilesW: number;
  readonly tilesH: number;
  /** 발밑 칸 위로 솟는 px */
  readonly rise: number;
  /** 놓을 자리 — 물체가 땅에 닿는 맨 아래 줄의 왼쪽 칸(stamp_tileset_object 의 base). 없으면 조수가 정한다. */
  readonly base: { readonly x: number; readonly y: number } | null;
  /** 원래 사용자 요청(후속 턴에 그대로 돌려준다) */
  readonly need: string;
  /** 놓을 맵의 배경(나라·시대) 한 줄 — 칩셋에서 정한다. 검수가 「그 배경에서 그 물건으로 읽히나」를 본다. 옛 요청엔 없다. */
  readonly setting?: string;
  /** 3/4 관문 종류(조언 배지용, object-gate rules.ts). 옛 요청엔 없다. */
  readonly gateKind?: string;
}

export function isObjectGenRequest(value: unknown): value is ObjectGenRequest {
  return (value as { kind?: unknown } | null)?.kind === "workshop-object-request";
}

/** 칸 상한 — 공방 폼과 같다(실내 가구 3×2, 맵 기물 4×3, 솟는 높이 48px). */
export function objectGenLimits(harnessId: ObjectGenHarness): { readonly maxW: number; readonly maxH: number; readonly maxRise: number } {
  return harnessId === "interior-props" ? { maxW: 3, maxH: 2, maxRise: 32 } : { maxW: 4, maxH: 3, maxRise: 48 };
}

/**
 * 조수 요청의 솟는 높이 기본값(px) = 0: 발밑 칸 안에 다 들어가는 크기. 1×1 을 부탁했으면 한 칸 높이다.
 * 공방 폼(workshopItemForm.ts)은 사람이 칸을 보며 정하니 16 을 그대로 쓴다. 2026-10-21 VQA: 1×1 벌통이 기본 16 때문에 두 칸 높이로 나왔다.
 */
export const DEFAULT_RISE: Readonly<Record<ObjectGenKind, number>> = { floor: 0, wall: 0, hang: 0, flat: 0 };

/** 요청 → 공방 새 기물 정의. 맵 기물이면 그 칩셋 id 와 칩셋에서 뽑은 팔레트(#rrggbb)를 넣는다. */
export function objectGenDefinition(request: ObjectGenRequest, takenKeys: ReadonlySet<string>, palette: readonly string[]): ItemDefinition {
  const base: ItemDefinition = {
    key: newItemKey(request.title, takenKeys),
    title: request.title,
    description: request.description,
    tilesW: request.tilesW,
    tilesH: request.tilesH,
    rise: request.rise,
    kind: request.objectKind,
    category: request.harnessId === "map-objects" ? request.tilesetName : "조수 요청",
    use: [],
    refs: [],
    ...(request.setting ? { setting: request.setting } : {}),
    ...(request.gateKind ? { gateKind: request.gateKind } : {}),
  };
  return request.harnessId === "map-objects" ? { ...base, tilesetId: request.tilesetId, palette } : base;
}

/** 「알아서 고르기」— 검수(독립 vision 검수 + 하네스 판정)를 통과한 후보 중 글자 순서로 첫 장. 통과한 것이 없으면 고르지 않는다(사람에게 넘긴다). */
export function autoPickRun(runs: readonly WorkshopRun[]): (WorkshopRun & { grid: Grid }) | null {
  const passed = runs.filter((run): run is WorkshopRun & { grid: Grid } => run.status === "done" && run.grid !== null && run.verdict?.verdict === "PASS");
  return passed.sort((a, b) => a.letter.localeCompare(b.letter))[0] ?? null;
}

/** 굽고 난 뒤 조수에게 보내는 후속 요청 — 놓는 도구와 자리를 정확히 적는다. */
export function objectGenFollowUp(request: ObjectGenRequest, baked: { readonly objectId: string; readonly title: string; readonly tilesetId: string; readonly columns: number; readonly rows: number }, how: "user" | "auto"): string {
  const where = request.base
    ? `stamp_tileset_object({mapId:"${request.mapId}", objectId:"${baked.objectId}", base:{x:${request.base.x}, y:${request.base.y}}})`
    : `stamp_tileset_object({mapId:"${request.mapId}", objectId:"${baked.objectId}", base:{x,y}}) — 자리는 원래 요청에 맞게 정하라`;
  const who = how === "auto" ? "사용자 설정 「알아서 고르기」로 검수 통과 후보를 골라" : "사용자가 후보를 골라";
  return `[공방에서 그려 넣음] ${who} 「${baked.title}」(${baked.columns}×${baked.rows}칸)을 칩셋 ${baked.tilesetId} 에 넣었다. 물체 id ${baked.objectId}. `
    + `이제 ${where} 로 놓고, 막힌 칸이면 다른 빈 바닥으로 옮겨 다시 놓아라. 다시 그리거나 generate_missing_object 를 또 부르지 마라. 원래 요청: ${request.need}`;
}
