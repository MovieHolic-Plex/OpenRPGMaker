import { lookHash } from "@/project/kitLook";
import type { PlaceSpec } from "../../shared/types";

/** 같은 게임의 같은 실내는 다시 지어도 같은 평면·가구를 쓴다. 이전에 저장된 씨앗과 직접 준 씨앗이 우선이다. */
export function cityInteriorSeed(spec: PlaceSpec, previousBase?: number) {
  const requested = spec.hints?.seed;
  const variant = spec.hints?.variant;
  const key = spec.variety === undefined ? spec.salt ?? 0 : lookHash(`${spec.variety}|${spec.name}|${spec.style ?? ""}`);
  const baseSeed = typeof requested === "number" && Number.isFinite(requested)
    ? requested : previousBase ?? 1 + key % 9973;
  const offset = typeof variant === "number" && Number.isFinite(variant) ? Math.floor(variant) * 101 : 0;
  return { baseSeed, seed: Math.max(1, Math.floor(baseSeed + offset)) };
}
