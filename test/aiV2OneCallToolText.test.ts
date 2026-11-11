import { describe, expect, it } from "vitest";
import { V2_TOOL_EN } from "@/ai/v2/tools/toolTextEn";

// 한 호출로 끝나는 도구 넷(시작 상태 · 이벤트 복사 · 한 번 도는 컷신 · 길을 막는 전투)과 2026-11-11 에 고친 도구가 v2 에서 영어 글로 읽히는가.
// 도구 동작은 test/toolsOneCallGaps.test.ts.

describe("v2 가 읽는 영어 글", () => {
  it("풀에 넣을 네 도구와 고친 도구에 영어 설명이 있다", () => {
    for (const name of ["set_session_start", "duplicate_event", "script_cutscene", "place_battle_blocker", "place_chest", "place_savepoint", "configure_npc_patrol", "set_map_properties"]) {
      expect(V2_TOOL_EN[name]?.d, name).toBeTruthy();
      expect(/[ㄱ-ㆎ가-힣]/u.test(V2_TOOL_EN[name]!.d), name).toBe(false);
    }
    expect(V2_TOOL_EN.place_savepoint!.d).toContain("mode:'heal'");
    expect(V2_TOOL_EN.configure_npc_patrol!.d).toContain("type:'random'");
    expect(V2_TOOL_EN.place_chest!.p!.contents).toContain("count");
  });
});
