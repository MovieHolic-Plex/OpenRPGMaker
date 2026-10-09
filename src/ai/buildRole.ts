// 실행 모델을 일의 종류로 고른다 — 공간 시공(타일·맵·장소 짓기, 게임 전체 짓기)은 시공 역할(build), 나머지는 실행 역할(deep).
// 실측(2026-10-07·08 조수 시험): 같은 장르 기획 전체 짓기가 gemini-3.8-flash 10분·자동 플레이 끝까지 통과, gpt-6.1-sol 50분·보스
// 스위치에서 막힘. 작은 수정 12과제는 gpt 12/12·gemini 11/12. 그래서 사용자가 시공만 다른 모델로 둘 수 있게 한다(src/ai/modelRoles.ts).
import { getTool } from "@/editor/tools";
import { isGenrePresetBriefRequest } from "./genrePresetBrief";
import type { SpecialistRole } from "./modelRoles";

/**
 * 공간 시공 실행인가. 판정은 scripts/lib/piAgentRuntime.ts 의 spatialWork 와 같다(선언 모델이 고른 첫 노출 도구 중 tile·world 영역,
 * 또는 map 영역 쓰기 도구가 있으면 시공) — 다만 도구 목록이 없으면 시공으로 보지 않는다(지시문은 모르면 싣고, 모델은 모르면 바꾸지 않는다).
 * 장르 프리셋 기획으로 게임 전체를 짓는 실행은 맵이 대부분이라 시공으로 본다.
 */
export function isSpatialBuildRun(task: string | undefined, initialToolNames: readonly string[] | undefined): boolean {
  if (isGenrePresetBriefRequest(task)) return true;
  return (initialToolNames ?? []).some((name) => {
    const tool = getTool(name);
    const domains: readonly string[] = tool?.domains ?? [];
    return domains.includes("tile") || domains.includes("world") || (domains.includes("map") && tool?.mode === "write");
  });
}

export function executionRoleFor(task: string | undefined, initialToolNames: readonly string[] | undefined): Extract<SpecialistRole, "deep" | "build"> {
  return isSpatialBuildRun(task, initialToolNames) ? "build" : "deep";
}
