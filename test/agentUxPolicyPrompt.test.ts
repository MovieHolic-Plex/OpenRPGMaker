import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { AGENT_UX_POLICY_LINES } from "@/ai/promptPolicies";
import { composeSystemPrompt } from "@/ai/systemPromptEnvelope";
import { TOKEN_BUDGET_STATUS_TEXT } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";

function prompt(): string {
  return buildSystemPrompt(createBlankProject(), { budgetChars: 20000 });
}

describe("agent UX policy prompt", () => {
  it("ships identical policy bytes through the main prompt and shared envelope", () => {
    const wrapped = composeSystemPrompt({ surface: "chat", body: "POLICY_COPY_BOUNDARY", includePolicy: true });
    for (const shipped of [prompt(), wrapped]) {
      const start = shipped.indexOf(AGENT_UX_POLICY_LINES.split("\n")[0]);
      expect(shipped.slice(start, start + AGENT_UX_POLICY_LINES.length)).toBe(AGENT_UX_POLICY_LINES);
    }
  });

  it("makes shape variety a separate axis from kit color and names the observe step", () => {
    const text = prompt();
    expect(text).toContain("집 다양성(필수)");
    expect(text).toContain("모양 축(templateId)과 색 축(kitId)은 별개다");
    expect(text).toContain("집마다 서로 다른 templateId를 배정하라");
    // 6종 kitId 가 지붕색 3군으로 접히는 사실을 프롬프트가 직접 말해야 "색만 바꾼 다양성"을 막는다.
    expect(text).toContain("blue: blue-stone·slate-wood");
    expect(text).toContain("look_at_houses");
  });

  it("injects the UX policy section into the system prompt", () => {
    expect(prompt()).toContain("## UX 응답 정책(반드시 준수)");
  });

  it("forbids leaving a 1-tile gap from walls when placing transfers and tiles", () => {
    const text = prompt();
    expect(text).toContain("벽 밀착(필수)");
    expect(text).toContain("1칸 띄우지 마세요");
    expect(text).toContain("벽과 맞닿은 통행 가능 칸");
  });

  it("tells the agent to refuse unsupported 3D requests without write proposals", () => {
    const text = prompt();
    expect(text).toContain("3D 오픈월드");
    expect(text).toContain("쓰기 툴을 호출하거나 변경 제안을 만들지 마세요");
  });

  it("includes action combat and external integration capability guidance", () => {
    const text = prompt();
    expect(text).toContain("실시간 액션 전투");
    expect(text).toContain("외부 서비스 연동/API 호출");
  });

  it("requires a feasible 2D alternative when a request is out of scope", () => {
    expect(prompt()).toContain("2D 맵·이벤트·DB로 가능한 대안");
  });

  it("forbids describing nonexistent canvas results", () => {
    const text = prompt();
    expect(text).toContain("존재하지 않는 결과를 했다고 서술하지 마세요");
    expect(text).toContain("캔버스에 없는 지형·숲·길·건물·NPC");
  });

  it("prefers a one-sentence question for low-information requests", () => {
    const text = prompt();
    expect(text).toContain("저정보 요청");
    expect(text).toContain("도구 호출 전에 1문장으로 되물으세요");
  });

  it("requires clarify before guessing house vs interior map", () => {
    const text = prompt();
    expect(text).toContain("집 vs 실내(필수)");
    expect(text).toContain("추측 실행 금지");
    expect(text).toContain("매칭 스킬이 없거나");
    expect(text).toContain("모호한 집 요청은 author_house를 호출하지");
  });

  it("forbids re-asking parameters already present in the user request", () => {
    const text = prompt();
    expect(text).toContain("집 두어 채");
    expect(text).toContain("되묻지 말고 그대로 사용하세요");
  });

  it("continues without confirmation after proceed instructions and limits questions", () => {
    const text = prompt();
    expect(text).toContain("진행/계속/진행해/진행하라고");
    expect(text).toContain("추가 확인 질문 없이 끝까지 실행");
    expect(text).toContain("확인 질문은 파괴적 변경·집/실내 경로 미확정·또는 진짜 모호한 요구일 때만");
  });

  it("distinguishes automatic time tint from static scene mood", () => {
    const text = prompt();
    expect(text).toContain("configure_time_system");
    expect(text).toContain("자동 주야간 색조");
    expect(text).toContain("set_scene_mood");
    expect(text).toContain("정적 분위기");
  });

  it("guides resize before cramped structure plans", () => {
    const text = prompt();
    expect(text).toContain("맵이 요구 구조물 대비 작으면");
    expect(text).toContain("resize_map을 먼저 호출");
  });

  it("routes terrain surfaces to fill_region and scattered objects to place_props", () => {
    const text = prompt();
    expect(text).toContain("수역/지면/바닥 면은 fill_region만 쓴다");
    expect(text).toContain("shape=circle");
    expect(text).toContain("물 위 place_props 금지");
    expect(text).toContain("호수·물 칸 밖");
  });

  it("routes common domain requests to high-level tools before low-level event upserts", () => {
    const text = prompt();
    expect(text).toContain("## 고수준 툴 우선");
    expect(text).toContain("트랩/즉사=place_trap");
    expect(text).toContain("체크포인트=place_trap의 checkpoint 관례");
    expect(text).toContain("퍼즐=compile_puzzle");
    expect(text).toContain("조사=place_examine_hotspots");
    expect(text).toContain("컷신=script_cutscene");
    expect(text).toContain("추격=make_chase_scene");
    expect(text).toContain("NPC=place_npc/make_villager");
    expect(text).toContain("상점=set_shop_stock");
    expect(text).toContain("사냥터=make_hunting_ground");
    expect(text).toContain("조명=set_lighting_volume/set_scene_mood");
    expect(text).toContain("수역=fill_region");
    expect(text).toContain("야외 집=author_house");
    expect(text).toContain("마을=author_village");
    expect(text).toContain('target:{kind:"existing",mapId}');
    expect(text).toContain('target:{kind:"new",mapId,name,width,height}');
    expect(text).toContain('countPolicy:"exact"');
    expect(text).toContain("start_interior_room_session");
    expect(text).not.toMatch(/야외 집[^\n]*(build_house_kit|build_house_lots|build_wall|place_door|build_roof)/);
    expect(text).not.toMatch(/마을[^\n]*(build_village|run_village_session|run_village_pipeline)/);
    expect(text).toContain("월드=plan_world/build_world");
    expect(text).toContain("퀘스트=define_quest→verify_quest");
    expect(text).toContain("upsert_event/upsert_common_event는 위에 없는 커스텀 로직 전용");
  });

  it("routes interior room requests to the independent session and excludes outdoor facades", () => {
    const text = prompt();
    expect(text).toContain("외장 없는 독립 실내·방·인테리어 요청은 야외 집이 아니다");
    expect(text).toContain("start_interior_room_session");
    expect(text).toContain('author_house(interior:"linked-interior")');
    expect(text).toContain("create_map만 하고 멈추지 마세요");
  });

  it("routes NPC placement to place_npc instead of low-level upsert_event", () => {
    const text = prompt();
    expect(text).toContain("NPC/주민 배치 = place_npc");
    expect(text).toContain("저수준 upsert_event 금지");
  });

  it("requires honest disclosure when only preparation work happened", () => {
    const text = prompt();
    expect(text).toContain("준비만 하고 실제 타일·이벤트·DB 배치를 아직 하지 않았다면");
    expect(text).toContain("아직 배치 자체는 하지 않았다");
  });

  it("requires quest graph registration and verification for narrative work", () => {
    const text = prompt();
    expect(text).toContain("일반 퀘스트는 define_quest로 등록");
    expect(text).toContain("verify_quest 통과");
    expect(text).toContain("author_story_arc");
    expect(text).toContain("evaluate_game_quality");
  });

  it("forces draft tense before proposal acceptance", () => {
    const text = prompt();
    expect(text).toContain("수락 전 제안 단계");
    expect(text).toContain("~할 예정입니다");
    expect(text).toContain("~하도록 제안합니다");
  });

  it("limits final response length and beginner-facing tone", () => {
    const text = prompt();
    expect(text).toContain("3~5문장");
    expect(text).toContain("초보 사용자 언어");
  });

  it("forbids internal ids, tool names, and developer terms in the final text", () => {
    const text = prompt();
    expect(text).toContain("Tile 342");
    expect(text).toContain("tex_*");
    expect(text).toContain("run_lint");
    expect(text).toContain("원시 도구명");
    expect(text).toContain("테스트/개발자 용어는 노출하지 마세요");
  });

  it("uses user-facing wording for token budget exhaustion", () => {
    expect(TOKEN_BUDGET_STATUS_TEXT).toBe("요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.");
    expect(TOKEN_BUDGET_STATUS_TEXT).not.toContain("출력 토큰");
    expect(TOKEN_BUDGET_STATUS_TEXT).not.toContain("8192");
    expect(TOKEN_BUDGET_STATUS_TEXT).not.toContain("최대 토큰");
  });

  // 봉투(systemPromptEnvelope)를 거쳐도 정책 문장이 변형·손실되지 않아야 한다. 정책을
  // promptPolicies 한 곳에 모아 둬도 닿는 경로가 하나면 통합이 아니다 — 봉투가 그 배급 지점이다.
  it("survives the shared envelope byte-for-byte", () => {
    const wrapped = composeSystemPrompt({
      surface: "chat",
      body: "## 채널 고유 지침\n- 아무 규칙",
      includePolicy: true,
    });
    expect(wrapped).toContain(AGENT_UX_POLICY_LINES);
    // 정책이 본문보다 먼저 읽힌다 — 상위에서 잘려도 정책이 먼저 살아남는 순서.
    expect(wrapped.indexOf("## UX 응답 정책(반드시 준수)")).toBeLessThan(wrapped.indexOf("## 채널 고유 지침"));
  });

  it("stays out of JSON-only surfaces where tone rules would corrupt the output", () => {
    const wrapped = composeSystemPrompt({
      surface: "tileset-analysis",
      body: "Return exactly one JSON object.",
    });
    expect(wrapped).not.toContain("## UX 응답 정책(반드시 준수)");
    expect(wrapped).not.toContain("3~5문장");
  });
});
