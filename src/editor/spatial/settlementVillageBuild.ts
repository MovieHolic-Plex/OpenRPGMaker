import type { Project } from "@/project/types";
import { SpatialCompileError } from "./compilerTypes";

/** 정주지 지역이 위임하던 마을 시공 본체 — buildVillageDomain 시그니처. */
export type SettlementVillageBuild = (
  draft: Project,
  args: Readonly<Record<string, unknown>>,
) => unknown;

/**
 * 정주지 지역의 마을 시공은 숲마을·합본 마을 칩셋 전용 시공기(tools/village/builder)가 맡았다.
 * 2026-10-07 저작권 정리로 그 칩셋과 시공기를 지웠으므로, 옛 문서의 정주지 지역은 컴파일하면 이 오류를 낸다.
 */
export function settlementVillageBuild(
  _draft: Project,
  _args: Readonly<Record<string, unknown>>,
): void {
  throw new SpatialCompileError("material", "정주지(마을) 지역 시공기는 2026-10-07 저작권 정리로 지웠습니다 — 마을은 author_beodeul_town 으로 짓습니다");
}
