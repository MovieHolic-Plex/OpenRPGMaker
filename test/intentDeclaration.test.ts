// 의도 선언(순수 함수) — 모델 응답을 선언으로 옮기는 검증과, 선언 필드에서 도메인·영역 탈출·노트로 가는 고정 사상.
import { describe, expect, it } from "vitest";
import {
  buildIntentUserPayload,
  continuationIntentDeclaration,
  fallbackIntentDeclaration,
  formatIntentAudit,
  formatIntentClarifyMessage,
  formatIntentNote,
  formatScopeNote,
  INTENT_SYSTEM_PROMPT,
  intentEscapesRegion,
  intentToolDomains,
  isContinuationText,
  parseIntentDeclaration,
  type IntentFacts,
} from "@/ai/intentDeclaration";
import { QUICK_REPLY_MARKER } from "@/ai/interviewPrompt";
import { declaredIntent } from "./intentFixture";

const FACTS: IntentFacts = {
  userText: "여관 지어줘",
  currentMap: { id: "map_start", name: "시작 맵" },
  selection: null,
  maps: [{ id: "map_start", name: "시작 맵" }, { id: "map_inn", name: "여관" }],
  facilityLabels: ["여관", "민가", "상점", "대장간"],
  toolNames: ["place_concept", "author_house", "place_npc", "fill_region"],
  hasActivePlan: false,
};

describe("parseIntentDeclaration", () => {
  it("enables navigation only for an explicit true declaration without clarification", () => {
    const parse = (viewNavigation: unknown, clarify: string | null = null) => parseIntentDeclaration(
      JSON.stringify({ mode: "question", tools: [], viewNavigation, clarify }), FACTS,
    ).intent?.viewNavigation;
    expect(parse(true)).toBe(true);
    expect(parse("true")).toBe(false);
    expect(parse(undefined)).toBe(false);
    expect(parse(true, "어느 상점인가요?")).toBe(false);
    expect(continuationIntentDeclaration(FACTS).viewNavigation).not.toBe(true);
    expect(fallbackIntentDeclaration(FACTS).viewNavigation).not.toBe(true);
  });
  it("정상 JSON 을 선언으로 옮기고 source 는 llm 이다", () => {
    const raw = JSON.stringify({
      mode: "create", space: "interior", facility: "여관", targetMapId: null, useSelection: false,
      clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: ["place_concept"], summary: "여관 실내 시공",
    });
    const { intent, error } = parseIntentDeclaration(raw, FACTS);
    expect(error).toBeUndefined();
    expect(intent).toMatchObject({ mode: "create", space: "interior", facility: "여관", tools: ["place_concept"], source: "llm" });
  });

  it("코드펜스·잡담이 섞여도 JSON 을 건진다", () => {
    const raw = "네, 분류했습니다.\n```json\n{\"mode\":\"question\",\"space\":\"none\",\"tools\":[],\"summary\":\"질문\"}\n```";
    expect(parseIntentDeclaration(raw, FACTS).intent?.mode).toBe("question");
  });

  it("레지스트리에 없는 툴·모르는 맵 id·모르는 시설은 버린다(스키마 밖 값을 코드로 흘리지 않는다)", () => {
    const raw = JSON.stringify({
      mode: "modify", space: "none", facility: "우주정거장", targetMapId: "map_nope",
      tools: ["place_concept", "make_everything", "place_npc"], summary: "x",
    });
    const intent = parseIntentDeclaration(raw, FACTS).intent!;
    expect(intent.tools).toEqual(["place_concept", "place_npc"]);
    expect(intent.targetMapId).toBeNull();
    expect(intent.facility).toBeNull();
  });

  it("아는 맵 id 는 대상으로 남고 시설 라벨은 대소문자 무관하게 맞춘다", () => {
    const raw = JSON.stringify({ mode: "modify", space: "none", facility: "여관", targetMapId: "map_inn", tools: [], summary: "x" });
    const intent = parseIntentDeclaration(raw, FACTS).intent!;
    expect(intent.targetMapId).toBe("map_inn");
    expect(intent.facility).toBe("여관");
  });

  it("mode 가 enum 밖이면 실패로 돌려 호출자가 폴백을 쓰게 한다", () => {
    const result = parseIntentDeclaration(JSON.stringify({ mode: "destroy", tools: [] }), FACTS);
    expect(result.intent).toBeNull();
    expect(result.error).toMatch(/mode/);
    expect(parseIntentDeclaration("그냥 문장", FACTS).intent).toBeNull();
  });

  it("선택 영역이 없으면 useSelection 은 참이 될 수 없고, clarify 없는 선택지는 버린다", () => {
    const raw = JSON.stringify({ mode: "create", space: "outdoor", useSelection: true, clarify: null, clarifyOptions: ["a", "b"], tools: [], summary: "x" });
    const intent = parseIntentDeclaration(raw, FACTS).intent!;
    expect(intent.useSelection).toBe(false);
    expect(intent.clarifyOptions).toEqual([]);
  });

  it("선택 영역이 있으면 useSelection 을 읽고 clarify 선택지는 4개까지", () => {
    const facts: IntentFacts = { ...FACTS, selection: { mapId: "map_start", x: 1, y: 2, width: 3, height: 4 } };
    const raw = JSON.stringify({ mode: "create", space: "unclear", useSelection: true, clarify: "실내인가요 야외인가요?", clarifyOptions: ["실내", "야외", "둘 다", "취소", "다섯"], tools: [], summary: "x" });
    const intent = parseIntentDeclaration(raw, facts).intent!;
    expect(intent.useSelection).toBe(true);
    expect(intent.clarify).toBe("실내인가요 야외인가요?");
    expect(intent.clarifyOptions).toHaveLength(4);
  });
});

describe("폴백·이어가기·빈 선언", () => {
  it("폴백은 아무것도 추측하지 않는다 — 되묻기 없음, 툴 없음, 계획 여부는 플래너에게 넘긴다", () => {
    const fallback = fallbackIntentDeclaration(FACTS);
    expect(fallback).toMatchObject({ mode: "other", clarify: null, tools: [], needsPlan: true, source: "fallback" });
    expect(fallbackIntentDeclaration({ ...FACTS, userText: "  " }).needsPlan).toBe(false);
  });

  it("선택 영역이 있으면 폴백은 그 안에서 작업한다고 본다(안전한 기본)", () => {
    const facts: IntentFacts = { ...FACTS, selection: { mapId: "map_start", x: 0, y: 0, width: 4, height: 4 } };
    expect(fallbackIntentDeclaration(facts).useSelection).toBe(true);
  });

  it("계속·이어서 같은 한 마디는 continuation 이고 진행 중 계획이 있을 때만 계획을 이어간다", () => {
    for (const text of ["계속", "이어서", "계속해줘", "go on", "Continue.", "다음"]) expect(isContinuationText(text), text).toBe(true);
    expect(isContinuationText("계속 나무를 심어줘")).toBe(false);
    expect(continuationIntentDeclaration({ ...FACTS, hasActivePlan: true }).needsPlan).toBe(true);
    expect(continuationIntentDeclaration(FACTS).source).toBe("continuation");
  });
});

describe("사용자가 명시한 조회 계약", () => {
  it("프로젝트/DB/ID 조회 요구를 실행부에 구조화해 전달한다", () => {
    const parsed = parseIntentDeclaration(JSON.stringify({ mode: "modify", readBeforeWrite: {
      project: true, collections: ["items", "enemies", "troops", "invented"], references: true,
    } }), FACTS);
    expect(parsed.intent?.readBeforeWrite).toEqual({ project: true, collections: ["items", "enemies", "troops"], references: true });
    expect(formatIntentNote(parsed.intent!)).toContain("조회 선행 계약");
    expect(formatIntentNote(parsed.intent!)).toContain('include:"full"');
  });
  it("선언하지 않은 계약을 키워드로 추측해서 추가하지 않는다", () => {
    const parsed = parseIntentDeclaration('{"mode":"modify"}', { ...FACTS, userText: "먼저 읽고 조회 후 써라" });
    expect(parsed.intent?.readBeforeWrite).toBeUndefined();
  });
});

describe("선언 → 도메인·영역 탈출", () => {
  const domainsOf = (name: string) =>
    ({ place_concept: ["tile"], place_npc: ["event"], define_quest: ["quest"], get_project_summary: ["core"] } as Record<string, readonly ("tile" | "event" | "quest" | "core")[]>)[name];

  it("선언한 툴의 레지스트리 도메인이 열리고 core 는 세지 않는다", () => {
    const domains = intentToolDomains(declaredIntent({ tools: ["place_npc", "define_quest", "get_project_summary"] }), domainsOf);
    expect([...domains].sort()).toEqual(["event", "quest"]);
  });

  it("공간 시공은 tile 을, 수정은 편집 3도메인을 함께 연다", () => {
    expect(intentToolDomains(declaredIntent({ space: "interior" }), domainsOf).has("tile")).toBe(true);
    expect([...intentToolDomains(declaredIntent({ mode: "modify" }), domainsOf)].sort()).toEqual(["event", "map", "tile"]);
    expect(intentToolDomains(declaredIntent({ mode: "question" }), domainsOf).size).toBe(0);
  });

  it("실내 신축·선택 영역 밖 신규 생성은 영역 작업을 탈출하고, 수정·폴백은 남는다", () => {
    expect(intentEscapesRegion(declaredIntent({ space: "interior" }))).toBe(true);
    expect(intentEscapesRegion(declaredIntent({ mode: "create", useSelection: false }))).toBe(true);
    expect(intentEscapesRegion(declaredIntent({ mode: "create", useSelection: true }))).toBe(false);
    expect(intentEscapesRegion(declaredIntent({ mode: "modify", space: "interior" }))).toBe(false);
    expect(intentEscapesRegion(fallbackIntentDeclaration(FACTS))).toBe(false);
  });
});

describe("모델에 주는 입력과 모델이 낸 것의 표현", () => {
  it("페이로드는 사실만 싣는다 — 요청·현재 맵·선택 영역·맵 목록·시설 라벨·툴 목록", () => {
    const payload = buildIntentUserPayload({ ...FACTS, selection: { mapId: "map_start", x: 1, y: 2, width: 3, height: 4 } });
    expect(payload).toContain("여관 지어줘");
    expect(payload).toContain("시작 맵 (map_start)");
    expect(payload).toContain("선택 영역: map_start (1,2) 3×4");
    expect(payload).toContain("여관, 민가, 상점, 대장간");
    expect(payload).toContain("place_concept, author_house");
    expect(INTENT_SYSTEM_PROMPT).toContain("\"mode\"");
    expect(INTENT_SYSTEM_PROMPT).toContain("부정과 금지");
  });

  it("되묻기 문장은 선언의 질문 그대로이고 선택지가 둘 이상이면 원탭 마커를 붙인다", () => {
    const withOptions = formatIntentClarifyMessage(declaredIntent({ clarify: "어디에 지을까요?", clarifyOptions: ["실내 맵", "야외 외장"] }));
    expect(withOptions).toBe(`어디에 지을까요?\n${QUICK_REPLY_MARKER} 실내 맵 | 야외 외장`);
    expect(formatIntentClarifyMessage(declaredIntent({ clarify: "어느 맵인가요?" }))).toBe("어느 맵인가요?");
  });

  it("선택 영역 노트: 안에서 작업이면 경계·마을 시그니처, 새 맵 시공이면 참고용", () => {
    const scope = { mapId: "map_start", region: { x: 2, y: 3, width: 8, height: 6 } };
    const inside = formatScopeNote(scope, declaredIntent({ useSelection: true }));
    expect(inside).toContain("영역 밖 타일·이벤트는 수정하지 말 것");
    expect(inside).toContain('bounds:{x:2,y:3,w:8,h:6}');
    const outside = formatScopeNote(scope, declaredIntent({ space: "interior", useSelection: false }));
    expect(outside).toContain("참고용");
    // 폴백 선언은 안전한 쪽(영역 안)으로 본다.
    expect(formatScopeNote(scope, fallbackIntentDeclaration(FACTS))).toContain("영역 밖 타일·이벤트는 수정하지 말 것");
  });

  it("감사 한 줄에 출처·모드·공간·시설·툴·소요가 실린다", () => {
    const line = formatIntentAudit(declaredIntent({ space: "interior", facility: "여관", tools: ["place_concept"] }), 812);
    expect(line).toBe("intent:llm mode=create space=interior facility=여관 single tools=place_concept 812ms");
  });
});

describe("formatIntentNote — 선언이 확정한 것을 본문 모델에게 알린다", () => {
  it("시설 실내 선언은 손 도트 v5 build_hand_interior_room 경로와 되묻기 금지를 말한다", () => {
    const note = formatIntentNote(declaredIntent({ mode: "create", space: "interior", facility: "대장간", tools: ["build_hand_interior_room"] }));
    expect(note).toContain("손 도트 실내 (v5)");
    expect(note).toContain("build_hand_interior_room");
    expect(note).not.toContain("place_concept");
    expect(note).toContain("다시 묻지 말고");
    expect(note).toContain("author_house");
  });

  it("수정·질문·야외 선언은 각자의 경계를, 폴백·이어가기는 노트를 내지 않는다", () => {
    expect(formatIntentNote(declaredIntent({ mode: "modify", targetMapId: "map_a" }))).toContain("`map_a`");
    expect(formatIntentNote(declaredIntent({ mode: "question" }))).toContain("바꾸지 말고");
    const outdoor = formatIntentNote(declaredIntent({ mode: "create", space: "outdoor" }));
    expect(outdoor).toContain("야외 시공");
    expect(outdoor).toContain('interior:"linked-interior"');
    expect(outdoor).not.toContain("실내 세션·새 실내 맵은 만들지 말 것");
    expect(formatIntentNote(declaredIntent({ mode: "create", space: "none" }))).toBeNull();
    expect(formatIntentNote(fallbackIntentDeclaration(FACTS))).toBeNull();
    expect(formatIntentNote(continuationIntentDeclaration(FACTS))).toBeNull();
  });

  it("space=interior 선언은 독립 실내이며 linked-interior 집을 막지 않는다", () => {
    const note = formatIntentNote(declaredIntent({ mode: "create", space: "interior", facility: null, tools: ["start_interior_room_session"] }));
    expect(note).toContain("독립 실내");
    expect(note).toContain('interior:"linked-interior"');
    expect(note).not.toContain("야외 집(author_house)을 대신 짓지 말 것");
  });

  it("space=both 선언은 linked-interior 한 번을 말한다", () => {
    const note = formatIntentNote(declaredIntent({ mode: "create", space: "both", facility: null, tools: ["author_house"] }));
    expect(note).toContain("author_house");
    expect(note).toContain('interior:"linked-interior"');
    expect(note).not.toContain("start_interior_room_session");
    expect(note).not.toContain("둘은 create_transfer_pair 로 잇는다");
    expect(note).not.toContain("create_transfer_pair 수동 연결은 불필요");
    const facilityNote = formatIntentNote(declaredIntent({ mode: "create", space: "both", facility: "여관", tools: ["build_hand_interior_room"] }));
    expect(facilityNote).toContain("build_hand_interior_room");
    expect(facilityNote).not.toContain("create_transfer_pair");
  });

  it("auto 모드에서 건너뛴 되묻기는 「택하고 밝혀라」로 바뀐다", () => {
    const intent = declaredIntent({ mode: "create", space: "unclear", clarify: "실내인가요 야외인가요?" });
    expect(formatIntentNote(intent)).toBeNull();
    expect(formatIntentNote(intent, { clarifyBypassed: true })).toContain("실내인가요 야외인가요?");
    expect(formatIntentNote(intent, { clarifyBypassed: true })).toContain("되묻지 않는다");
  });
});

it("full-adventure contracts come from declared intent and cannot affect question mode", () => {
  const adventure = { village: true, dungeon: true, party: true, battle: true };
  expect(parseIntentDeclaration(JSON.stringify({ mode: "modify", adventure }), FACTS).intent?.adventure).toEqual(adventure);
  expect(parseIntentDeclaration(JSON.stringify({ mode: "question", adventure }), FACTS).intent?.adventure).toBeUndefined();
  expect(parseIntentDeclaration('{"mode":"modify"}', { ...FACTS, userText: "마을 NPC 추가" }).intent?.adventure).toBeUndefined();
});

it("preserves the foundation lanes for a full RPG kickoff", () => {
  const adventure = { village: true, dungeon: true, party: true, battle: true, world: true, characters: true, appearance: true };
  expect(parseIntentDeclaration(JSON.stringify({ mode: "create", adventure }), FACTS).intent?.adventure).toEqual(adventure);
});

describe("참조 작품 비유 — 검색을 부르는 계약", () => {
  const REFERENCE_FACTS: IntentFacts = {
    ...FACTS,
    userText: "해리포터 같은 게임 만들고 싶다. 마법학교 분위기로.",
    toolNames: [...FACTS.toolNames, "web_search", "set_world_canon"],
  };

  function declare(payload: Record<string, unknown>) {
    return parseIntentDeclaration(JSON.stringify(payload), REFERENCE_FACTS);
  }

  it("실존 작품을 지목하면 referenceWork 로 보존한다", () => {
    const result = declare({ mode: "create", referenceWork: "해리포터", summary: "마법학교 게임" });
    expect(result.intent?.referenceWork).toBe("해리포터");
  });

  it("mode=other 로 분류돼도 보존한다 — 「만들고 싶다」는 발화가 여기로 온다", () => {
    // 실측 2026-09-21: authoring(create|modify) 게이트에 묶여 있으면 mode=other 에서 조용히 사라졌다.
    const result = declare({ mode: "other", referenceWork: "해리포터", summary: "게임을 만들고 싶다" });
    expect(result.intent?.mode).toBe("other");
    expect(result.intent?.referenceWork).toBe("해리포터");
  });

  it("장르·스타일 설명은 작품명이 아니다", () => {
    const result = declare({ mode: "create", summary: "중세 판타지 RPG" });
    expect(result.intent?.referenceWork).toBeUndefined();
  });

  it("참조 작품이 있으면 노트가 검색을 지시한다", () => {
    const intent = declaredIntent({ referenceWork: "해리포터", tools: ["web_search"] });
    const note = formatIntentNote(intent);
    expect(note).toContain("[참조 작품]");
    expect(note).toContain("해리포터");
    expect(note).toContain("web_search");
    // 고유명사를 그대로 쓰지 말라는 경계도 함께 간다.
    expect(note).toContain("고유명사");
  });

  it("참조 작품이 없으면 그 노트가 붙지 않는다", () => {
    expect(formatIntentNote(declaredIntent({})) ?? "").not.toContain("[참조 작품]");
  });

  it("선언 프롬프트가 referenceWork 필드를 가르친다", () => {
    expect(INTENT_SYSTEM_PROMPT).toContain('"referenceWork"');
    expect(INTENT_SYSTEM_PROMPT).toContain("해리포터");
  });
});

