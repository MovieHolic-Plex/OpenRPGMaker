// editor/operators/operatorTypes.ts
// 지형 오퍼레이터 계약 — "LLM 은 의도를, 코드는 픽셀을" 의 코드 쪽 절반.
//
// 오퍼레이터는 (맵, 영역, 파라미터, 시드) 를 받아 타일 쓰기 목록을 돌려주는 **순수 함수**다.
// 같은 입력이면 항상 같은 출력이라, 변형은 시드로 뽑고 강약은 파라미터로 민다.
// 파라미터 스펙을 데이터로 들고 있으므로 UI(슬라이더·스위치)는 스펙에서 자동 생성된다 —
// 오퍼레이터를 추가할 때 UI 코드를 건드리지 않게 하려는 것이 이 계약의 목적이다.

import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { GameMap } from "@/project/types";
import type { ResolvedMaterialSlots } from "./materialSlots";

/** 오퍼레이터가 산출하는 타일 쓰기 한 칸. */
export interface OperatorWrite {
  readonly layer: "lower" | "upper";
  readonly x: number;
  readonly y: number;
  readonly tile: number;
}

/** 슬라이더 하나. 0..1 비율이든 개수든 같은 위젯으로 그린다. */
export interface OperatorRangeParam {
  readonly kind: "range";
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly defaultValue: number;
  /** 값 옆에 붙는 설명(예: "0 성김 · 1 울창"). */
  readonly hint?: string;
}

/** 켜고 끄는 스위치 하나. */
export interface OperatorToggleParam {
  readonly kind: "toggle";
  readonly id: string;
  readonly label: string;
  readonly defaultValue: boolean;
  readonly hint?: string;
}

/** 몇 갈래 중 하나. 수치로 뭉갤 수 없는 축(마을 배치 형태 등)에 쓴다. */
export interface OperatorChoiceParam {
  readonly kind: "choice";
  readonly id: string;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly defaultValue: string;
  readonly hint?: string;
}

export type OperatorParamSpec = OperatorRangeParam | OperatorToggleParam | OperatorChoiceParam;

export type OperatorParamValues = Readonly<Record<string, number | boolean | string>>;

export interface OperatorBuildResult {
  readonly writes: readonly OperatorWrite[];
  /** 로그·요약에 그대로 실리는 한 줄(예: "나무 189그루"). */
  readonly note: string;
}

export interface OperatorDef {
  readonly id: string;
  readonly label: string;
  /** 모드 패널에 한 줄로 뜨는 설명. */
  readonly hint: string;
  readonly params: readonly OperatorParamSpec[];
  /**
   * 순수 함수 — 맵을 변형하지 않고 쓰기 목록만 돌려준다.
   * `slots` 는 그 맵 타일셋에서 유도한 재료다. 오퍼레이터는 타일 번호를 알지 못하고,
   * 슬롯을 통해서만 칩셋에 닿는다 — 이것이 칩셋 독립성의 유일한 근거다.
   */
  build(
    map: GameMap,
    region: RegionRect,
    params: OperatorParamValues,
    seed: number,
    slots?: ResolvedMaterialSlots,
  ): OperatorBuildResult;
}

/** 스펙의 기본값 묶음. UI 최초 렌더와 헤드리스 호출이 같은 값에서 출발하게 한다. */
export function defaultOperatorParams(def: OperatorDef): Record<string, number | boolean | string> {
  const values: Record<string, number | boolean | string> = {};
  for (const spec of def.params) values[spec.id] = spec.defaultValue;
  return values;
}

/**
 * 스펙 밖 키를 버리고 범위를 강제한다. UI·하네스·향후 LLM 의도 파서가 모두 이 문을 지나므로
 * 오퍼레이터 본체는 값 검증을 하지 않아도 된다(신뢰 경계가 여기 하나뿐).
 */
export function clampOperatorParams(def: OperatorDef, input: OperatorParamValues | undefined): Record<string, number | boolean | string> {
  const values = defaultOperatorParams(def);
  if (!input) return values;
  for (const spec of def.params) {
    const raw = input[spec.id];
    if (raw === undefined) continue;
    if (spec.kind === "toggle") {
      if (typeof raw === "boolean") values[spec.id] = raw;
      continue;
    }
    if (spec.kind === "choice") {
      // 목록 밖 값은 버린다 — 모델이 지어낸 배치 이름이 생성기까지 내려가지 않게.
      if (typeof raw === "string" && spec.options.some((option) => option.value === raw)) values[spec.id] = raw;
      continue;
    }
    const numeric = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(numeric)) continue;
    const clamped = Math.min(spec.max, Math.max(spec.min, numeric));
    // step 이 정수면 정수로 스냅한다 — 공터 개수 2.4 같은 값이 내려가지 않게.
    values[spec.id] = Number.isInteger(spec.step) && spec.step >= 1 ? Math.round(clamped) : clamped;
  }
  return values;
}
