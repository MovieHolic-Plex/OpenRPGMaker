import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { AGENT_UX_POLICY_LINES } from "@/ai/promptPolicies";
import { TOKEN_BUDGET_STATUS_TEXT } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";

function prompt(): string {
  return buildSystemPrompt(createBlankProject(), { budgetChars: 20000 });
}

describe("agent UX policy prompt", () => {
  it("keeps the UX policy text in a snapshot-friendly constant", () => {
    expect(AGENT_UX_POLICY_LINES).toMatchInlineSnapshot(`
      "## UX 응답 정책(반드시 준수)
      - 능력 경계: 이 엔진은 2D 타일 RPG 에디터입니다. 3D 오픈월드, 실시간 액션 전투, 외부 서비스 연동/API 호출, 플러그인 설치, 실제 배포처럼 현재 툴/엔진이 지원하지 않는 요청은 쓰기 툴을 호출하거나 변경 제안을 만들지 마세요. 한계를 설명하고 2D 맵·이벤트·DB로 가능한 대안을 1~2개 제안한 뒤 턴을 끝내세요.
      - 허위 완료 금지: 존재하지 않는 결과를 했다고 서술하지 마세요. 캔버스에 없는 지형·숲·길·건물·NPC·3D 시점·전투 방식을 마무리 서술에 언급하지 말고, 실제로 조회하거나 변경한 내용만 말하세요.
      - 모호한 요청: '좀 멋지게 해줘'처럼 대상·스타일·규모를 특정할 수 없는 저정보 요청이면 도구 호출 전에 1문장으로 되물으세요. 단, 요청문에서 추출 가능한 파라미터(예: 집 두어 채, 길, 나무 군락, 작은 마을)는 되묻지 말고 그대로 사용하세요.
      - 원큐 진행: 사용자가 진행/계속/진행해/진행하라고 지시하면 추가 확인 질문 없이 끝까지 실행하세요. 실행 중 장애(맵 크기 부족 등)는 리사이즈 같은 비파괴 조치로 스스로 해결하고 결과에 보고하세요. 확인 질문은 파괴적 변경 또는 진짜 모호한 요구일 때만 허용됩니다.
      - 준비 작업만 한 턴: 리사이즈, 맵 이름 변경, 타일 그룹/메타데이터 등록, 밑그림 확정처럼 준비만 하고 실제 타일·이벤트·DB 배치를 아직 하지 않았다면 마무리 서술에 '아직 배치 자체는 하지 않았다'는 사실을 명확히 쓰세요.
      - 초안 시제: 수락 전 제안 단계의 변경은 완료형으로 쓰지 말고 '~할 예정입니다', '~하도록 제안합니다'처럼 초안/예정 표현을 쓰세요.
      - 마무리 톤: 최종 사용자 응답은 3~5문장으로 제한하고 초보 사용자 언어로 쓰세요. 내부 ID(Tile 342, tex_*, ev_*, run_lint 등), 원시 도구명, 함수명, 테스트/개발자 용어는 노출하지 마세요."
    `);
  });

  it("injects the UX policy section into the system prompt", () => {
    expect(prompt()).toContain("## UX 응답 정책(반드시 준수)");
  });

  it("tells the agent to refuse unsupported 3D requests without write proposals", () => {
    const text = prompt();
    expect(text).toContain("3D 오픈월드");
    expect(text).toContain("쓰기 툴을 호출하거나 변경 제안을 만들지 마세요");
  });

  it("names real-time battle and external integration as unsupported boundaries", () => {
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

  it("forbids re-asking parameters already present in the user request", () => {
    const text = prompt();
    expect(text).toContain("집 두어 채");
    expect(text).toContain("되묻지 말고 그대로 사용하세요");
  });

  it("continues without confirmation after proceed instructions and limits questions", () => {
    const text = prompt();
    expect(text).toContain("진행/계속/진행해/진행하라고");
    expect(text).toContain("추가 확인 질문 없이 끝까지 실행");
    expect(text).toContain("확인 질문은 파괴적 변경 또는 진짜 모호한 요구일 때만");
  });

  it("guides resize before cramped structure plans", () => {
    const text = prompt();
    expect(text).toContain("맵이 요구 구조물 대비 작으면");
    expect(text).toContain("resize_map을 먼저 호출");
  });

  it("routes terrain surfaces to fill_region and scattered objects to place_props", () => {
    const text = prompt();
    expect(text).toContain("수역/지면/바닥처럼 면을 채우는 작업은 fill_region");
    expect(text).toContain("오브젝트 산포만 place_props");
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
});
