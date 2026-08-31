// 2026-08-23 실측 회귀: "엔딩 조건도 하나 걸어줘" 요청에서 define_ending 이 도메인 스코핑·노출 상한에
// 밀려 모델에 노출되지 않았고, 모델은 사용자에게 "엔딩을 정의하는 기능이 없습니다"라고 보고했다.
// 있는 기능을 없다고 말하게 만드는 노출 누락은 툴콜 실패보다 나쁘다 — 사용자가 제품 한계로 오해한다.
import { describe, expect, it } from "vitest";
import { computeActiveToolDomains, getActiveToolDomainInfo } from "@/editor/assistantToolMode";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";

/**
 * 모델이 **실제로** 받는 목록.
 *
 * 2026-08-30 실측: 이 파일의 원래 헬퍼는 `activeTools({ domains })` 였는데 `activeTools()` 는
 * **인자를 받지 않는다**(toolRegistry.ts:221). 객체는 조용히 버려졌고, 단정은 도메인 스코핑도
 * 40툴 상한도 지나지 않은 전체 레지스트리 188개를 상대로 이뤄졌다 — 즉 이 가드는 통과 여부가
 * 노출 정책과 무관한 공회전이었다(그래서 회상 어휘 누락도 잡지 못했다). 노출 누락은 상한
 * 트림에서만 재현되므로 반드시 `toOpenAiTools` 를 지나야 한다.
 */
function exposedNames(userText: string): string[] {
  const domains = computeActiveToolDomains(userText);
  return toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
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

// 2026-08-30 실측 회귀: "회상 장면 하나 넣어줘" 는 event 도메인을 열지 못했다. 40툴 상한이
// event 버킷을 통째로 버려 모델에 남은 34개는 전부 map/core 였고, script_cutscene 은 물론
// upsert_event 조차 스키마로 노출되지 않았다. `컷신` 만 키워드였던 것이 원인이고,
// 핀(PINNED_TOOLS_BY_DOMAIN)은 도메인이 닫히면 무의미하다.
//
// 이 가드가 단정하는 것은 **노출 집합**뿐이다. 스키마 미노출이 실제 대화에서 어떤 답변을
// 만들었는지는 측정되지 않았고, 여기서 단정하지 않는다 — toolCapabilityIndex 가 전체 툴
// 이름을 상시 싣기 때문에 "모델이 존재를 몰랐다"는 추론은 성립하지 않는다(자세한 근거는
// src/editor/assistantToolMode.ts 의 event 도메인 주석).
describe("회상·시청 전용 장면 요청의 컷신 툴 노출 (상한 적용 경로)", () => {
  const PHRASINGS = [
    "회상 장면 하나 넣어줘",
    "회상 씬 만들어줘",
    "플래시백 넣어줘",
    "주인공이 과거를 떠올리는 장면 만들어줘",
    "시네마틱 하나 넣어줘",
    "오프닝 무비 만들어줘",
    "컷씬 하나 넣어줘",
    "보스방 앞에 선택지가 있는 컷신을 넣어줘",
  ];

  for (const text of PHRASINGS) {
    it(`"${text}" 에 script_cutscene 이 노출된다`, () => {
      expect(exposedNames(text)).toContain("script_cutscene");
    });
  }

  it("회상 요청에 프리셋 툴도 함께 잡힌다", () => {
    expect(exposedNames("회상 장면 하나 넣어줘")).toContain("script_cutscene_preset");
  });

  it("컷신 요청이 열어야 하는 도메인은 event 다", () => {
    expect([...computeActiveToolDomains("회상 장면 하나 넣어줘")]).toContain("event");
  });

  it("무관한 타일 요청은 컷신 툴을 끌어오지 않는다 (키워드 과잉 확장 방지)", () => {
    const names = exposedNames("이 맵 바닥에 흙길 깔아줘");
    expect(names).not.toContain("script_cutscene");
  });
});

// 2026-08-30 실측: tile 키워드 `지면` 이 한국어 연결어미 `-지면` 과 부분일치해, 조건절이 들어간
// 요청이면 무엇이든 tile 을 strong 으로 열었다. 그러면 핀 합계가 상한(40)을 넘어 라운드로빈이
// event 버킷 꼬리를 굶긴다 — define_ending 이 그 꼬리에 있었다.
describe("연결어미 오탐이 도메인을 열지 않는다", () => {
  // 수정 요청("…바꿔줘")은 설계상 tile 을 **weak** 로 넣는다(requestLikelyModifiesExisting).
  // 여기서 보는 것은 그것과 구별되는 strong 판정이다 — 핀 비용을 물리는 쪽은 strong 이다.
  function strongDomains(text: string): string[] {
    const info = getActiveToolDomainInfo(computeActiveToolDomains(text));
    return [...(info?.strongIntentDomains ?? [])];
  }

  it("'켜지면' 은 tile 을 strong 으로 열지 않는다", () => {
    expect(strongDomains("스위치가 켜지면 엔딩으로 가게 해줘")).not.toContain("tile");
  });

  it("'넓어지면' 도 tile 을 strong 으로 열지 않는다", () => {
    expect(strongDomains("파티가 넓어지면 대사를 바꿔줘")).not.toContain("tile");
  });

  it("진짜 지형 요청은 그대로 tile 을 strong 으로 연다", () => {
    for (const text of ["이 맵 바닥 타일 바꿔줘", "지형을 평평하게 해줘"]) {
      expect(strongDomains(text)).toContain("tile");
    }
  });
});
