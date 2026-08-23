// 2026-08-23 실측 회귀: "엔딩 조건도 하나 걸어줘" 요청에서 define_ending 이 도메인 스코핑·노출 상한에
// 밀려 모델에 노출되지 않았고, 모델은 사용자에게 "엔딩을 정의하는 기능이 없습니다"라고 보고했다.
// 있는 기능을 없다고 말하게 만드는 노출 누락은 툴콜 실패보다 나쁘다 — 사용자가 제품 한계로 오해한다.
import { describe, expect, it } from "vitest";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { activeTools } from "@/editor/tools/toolRegistry";

function exposedNames(userText: string): string[] {
  const domains = computeActiveToolDomains(userText);
  return activeTools({ domains }).map((tool) => tool.name);
}

describe("의도에 맞는 툴 노출", () => {
  it("엔딩 요청에 define_ending 이 노출된다", () => {
    expect(exposedNames("엔딩 조건 하나 걸어줘. 스위치가 켜지면 엔딩.")).toContain("define_ending");
  });

  it("상성표 요청에 set_type_chart 가 노출된다", () => {
    expect(exposedNames("속성 상성표를 설정해줘")).toContain("set_type_chart");
  });

  it("컷신·선택지 요청에 script_cutscene 이 노출된다", () => {
    expect(exposedNames("보스방 앞에 선택지가 있는 컷신을 넣어줘")).toContain("script_cutscene");
  });

  it("참조 id 조회 툴은 어떤 요청에서도 노출된다(core)", () => {
    for (const text of ["집 지어줘", "적 3종 만들어줘", "엔딩 걸어줘"]) {
      expect(exposedNames(text)).toContain("get_database_records");
    }
  });
});
