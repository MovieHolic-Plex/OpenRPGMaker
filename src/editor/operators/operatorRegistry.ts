// editor/operators/operatorRegistry.ts
// 등록된 지형 오퍼레이터 목록. 새 오퍼레이터는 여기에 한 항목을 더하면 UI·하네스에 자동 노출된다.
//
// 지금은 forest 하나뿐이다(프로토타입). water/village/road 는 같은 계약으로 뒤따른다 —
// 계약이 먼저 서야 UI 를 두 번 짓지 않는다.

import { buildForestWrites, forestPaletteFromSlots } from "@/editor/regionTask/forestWrites";
import {
  clampOperatorParams,
  defaultOperatorParams,
  type OperatorDef,
  type OperatorParamValues,
} from "./operatorTypes";

const forestOperator: OperatorDef = {
  id: "forest",
  label: "숲",
  hint: "군집 캐노피 · 수종 혼합 · 하층식생 · 공터 · 오솔길",
  params: [
    { kind: "range", id: "density", label: "밀도", min: 0, max: 1, step: 0.05, defaultValue: 0.6, hint: "0 성김 · 1 울창" },
    { kind: "range", id: "deadRatio", label: "고사목", min: 0, max: 0.5, step: 0.02, defaultValue: 0.08 },
    { kind: "range", id: "underbrush", label: "하층식생", min: 0, max: 1, step: 0.05, defaultValue: 0.5, hint: "덤불·꽃·바위" },
    { kind: "range", id: "clearings", label: "공터", min: 0, max: 4, step: 1, defaultValue: 1 },
    { kind: "toggle", id: "path", label: "오솔길", defaultValue: true, hint: "좌우를 잇는 통행 회랑" },
    { kind: "toggle", id: "groundNoise", label: "지면 변화", defaultValue: true },
  ],
  build(map, region, params, seed, slots) {
    const built = buildForestWrites(
      map,
      region,
      {
        density: params.density as number,
        deadRatio: params.deadRatio as number,
        underbrush: params.underbrush as number,
        clearings: params.clearings as number,
        path: params.path as boolean,
        groundNoise: params.groundNoise as boolean,
      },
      seed,
      forestPaletteFromSlots(slots),
    );
    return { writes: built.writes, note: `나무 ${built.trees}그루` };
  },
};

const OPERATORS: readonly OperatorDef[] = [forestOperator];

export function listOperators(): readonly OperatorDef[] {
  return OPERATORS;
}

export function getOperator(id: string): OperatorDef | undefined {
  return OPERATORS.find((operator) => operator.id === id);
}

/** UI·하네스 공용 진입점 — 알 수 없는 id 나 범위 밖 값은 여기서 걸러진다. */
export function resolveOperatorParams(id: string, input?: OperatorParamValues): Record<string, number | boolean> | undefined {
  const def = getOperator(id);
  if (!def) return undefined;
  return input ? clampOperatorParams(def, input) : defaultOperatorParams(def);
}
