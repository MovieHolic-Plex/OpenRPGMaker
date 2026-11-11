// 맵이 무엇으로 깔렸는가 — 깔 때 적힌 장소 기록에서 읽는다(맵의 타일을 보고 짐작하지 않는다).
import type { PlaceSpec } from "../shared/types";
import { parseWorldStyle } from "./world";
import type { Laid } from "./exitDress";

/** 장소 명세가 말하는 종류: 방(실내·집, 세계의 실내 종류) · 바깥(마을·거리, 세계의 바깥 종류). 기록이 없거나 그 밖의 종류(던전·동굴)는 undefined. */
export function laidOf(spec: PlaceSpec | undefined): Laid | undefined {
  if (!spec) return undefined;
  const world = parseWorldStyle(spec.style);
  if (world) return world.kind.indoor ? "room" : "outdoor";
  if (spec.type === "interior" || spec.type === "house") return "room";
  if (spec.type === "village" || spec.type === "street") return "outdoor";
  return undefined;
}
