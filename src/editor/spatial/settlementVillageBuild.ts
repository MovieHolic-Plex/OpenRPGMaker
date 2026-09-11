import type { Project } from "@/project/types";
import { SpatialCompileError } from "./compilerTypes";

/** 정주지 지역이 위임하는 마을 시공 본체 — buildVillageDomain 시그니처. */
export type SettlementVillageBuild = (
  draft: Project,
  args: Readonly<Record<string, unknown>>,
) => unknown;

let impl: SettlementVillageBuild | undefined;

/**
 * tools/village/builder 가 모듈 로드 때 자기 자신을 등록한다.
 * 정적 import 로는 houseKit → … → spatial/preview → compileRegions → compileGeography
 * → builder 순환이 닫혀 초기화 시점 TDZ 크래시가 나므로, 이 리프 훅으로 끊는다.
 */
export function bindSettlementVillageBuild(build: SettlementVillageBuild): void {
  impl = build;
}

export function settlementVillageBuild(
  draft: Project,
  args: Readonly<Record<string, unknown>>,
): void {
  if (!impl) {
    throw new SpatialCompileError("material", "정주지 지역 컴파일에 마을 시공기가 아직 등록되지 않았다");
  }
  impl(draft, args);
}
