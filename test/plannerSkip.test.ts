import { describe, expect, it } from "vitest";
import { plannerSkipReason, PLANNER_SKIP_MAX_CHARS, shouldSkipPlanner } from "@/ai/plannerSkip";

describe("plannerSkipReason", () => {
  it("짧은 시공 한 줄은 simple 로 건너뛴다", () => {
    expect(plannerSkipReason("여기 나무 심어줘")).toBe("simple");
    expect(plannerSkipReason("길 좀 다듬어")).toBe("simple");
    expect(shouldSkipPlanner("타이틀 화면 안내만 해줘")).toBe(true);
  });

  it("질문이면 길어도 건너뛴다", () => {
    expect(plannerSkipReason("이 맵이 뭐야")).toBe("question");
    expect(plannerSkipReason("저 NPC 이름이 뭐예요?")).toBe("question");
  });

  it("영역 작업 합성 문장과 선택 영역은 건너뛴다", () => {
    expect(
      plannerSkipReason("선택 영역 안에 야외 집 한 채를 지어 주세요.\n\n영역 작업 도구 규칙:\n- 공식 시공 facade 사용"),
    ).toBe("protocol-locked");
    expect(
      plannerSkipReason("여기 고쳐줘\n\n[컨텍스트] 현재 맵: 들판 (map_1) · 사용자 선택 영역: (4,5) 6×4"),
    ).toBe("selection");
  });

  it("마을/퀘스트/여러 맵은 플래너를 남긴다", () => {
    expect(plannerSkipReason("빈 프로젝트에 강이 있는 마을을 하나 만들고 집 8채를 지어줘")).toBeNull();
    expect(plannerSkipReason("퀘스트 하나 만들고 엔딩까지 이어줘")).toBeNull();
    expect(plannerSkipReason("맵을 3개 만들고 마을과 던전을 연결해줘")).toBeNull();
  });

  it("긴 지시인데 다단계 표지가 없으면 플래너를 남긴다", () => {
    const long = "이 맵 오른쪽 숲을 조금 더 깊게 만들고 길 가장자리에 가로수를 듬성듬성 심고 연못 옆 돌담을 손본 뒤 빈 바닥이 보이지 않게 풀로 채워 주세요.";
    expect(long.length).toBeGreaterThan(PLANNER_SKIP_MAX_CHARS);
    expect(plannerSkipReason(long)).toBeNull();
  });

  it("컨텍스트 푸터의 맵 이름 마을 은 다단계 표지로 세지 않는다", () => {
    expect(
      plannerSkipReason("여기 나무 심어줘\n\n[컨텍스트] 현재 맵: 호숫가 마을 (map_lake)"),
    ).toBe("simple");
  });
});
