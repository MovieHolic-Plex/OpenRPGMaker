// Pi 턴이 의도 노트를 싣는가 — 세션 → Pi 이관(2026-09-11)에서 formatIntentNote/formatScopeNote 가 빠져
// 「마을을 만들어달라」의 계획·실행 모델이 author_village·권장 크기를 한 번도 못 봤다(2026-09-17 실측:
// 계획은 도구 이름 없는 산문, 실행은 paint_road 5번으로 16턴 소진). 여기서 본문이 읽는 문자열을 고정한다.
import { describe, expect, it } from "vitest";
import { buildPiIntentNote, composePiTask } from "@/ai/piAgent/executionRoute";
import { emptyIntentDeclaration, type IntentDeclaration } from "@/ai/intentDeclaration";

const villageIntent: IntentDeclaration = {
  ...emptyIntentDeclaration(),
  mode: "create",
  space: "outdoor",
  needsPlan: true,
  tools: ["author_village"],
  construction: { scale: "medium" },
  summary: "마을을 만들어달라",
  source: "llm",
};

describe("Pi 턴 의도 노트", () => {
  it("야외 마을 시공 선언은 author_village 와 권장 크기를 본문에 싣는다", () => {
    const note = buildPiIntentNote({ intent: villageIntent, targetMap: { id: "map_a", width: 100, height: 100, lived: true }, selection: null });
    expect(note).not.toBeNull();
    expect(note).toContain("author_village");
    expect(note).toContain("[시공 규모]");
    expect(note).toMatch(/권장 맵 크기는 \d+×\d+/);
  });

  it("수정 선언 + 작은 대상 맵이면 resize_map 을 먼저 부르라고 못박는다", () => {
    const note = buildPiIntentNote({
      intent: { ...villageIntent, mode: "modify", targetMapId: "map_small", construction: { scale: "medium", houseCount: 12 } },
      targetMap: { id: "map_small", width: 20, height: 20, lived: true },
      selection: null,
    });
    expect(note).toContain('resize_map({mapId:"map_small"');
    expect(note).toContain("author_village(kind:\"new\") 로 새것을 만들지 말 것");
  });

  it("선택 영역이 있으면 그 사각형을 author_village target 으로 못박는다", () => {
    const note = buildPiIntentNote({
      intent: { ...villageIntent, useSelection: true },
      targetMap: { id: "map_a", width: 100, height: 100, lived: true },
      selection: { mapId: "map_a", x: 10, y: 20, width: 30, height: 40 },
    });
    expect(note).toContain('target:{kind:"existing",mapId:"map_a",bounds:{x:10,y:20,w:30,h:40}}');
  });

  // 2026-09-17 실측: 빈 20×15 시작 맵에서 선언은 tools=[author_village,…] 를 냈지만 모델은 그 이름을 못 봤고,
  // 수량이 없어 크기 지시도 없어서 fill_region 길 + author_house 2채로 끝났다. 도구는 빈 맵을 전체 시공하고
  // 집 수에 맞춰 스스로 넓히므로, 노트는 그 한 호출을 지시하면 된다.
  it("빈 맵 + author_village 선언 → 맵 전체 한 호출, 기본 집 수, resize 불필요, 손작업 금지", () => {
    const note = buildPiIntentNote({
      intent: { ...villageIntent, construction: undefined },
      targetMap: { id: "map_blank_start", width: 20, height: 15, lived: false },
      selection: null,
    });
    expect(note).toContain("[마을 시공]");
    expect(note).toContain('target:{kind:"existing", mapId:"map_blank_start"}');
    expect(note).toContain("houseCount:12(수량 선언이 없어 코드 기본값)");
    expect(note).toContain("resize_map 은 부르지 않는다");
    expect(note).toContain("paint_road·fill_region·place_props 로 길과 나무를 손으로 깔지 말 것");
    expect(note).not.toContain('kind:"new"');
  });

  it("선언 수량이 있으면 그 수가 houseCount 다", () => {
    const note = buildPiIntentNote({
      intent: { ...villageIntent, construction: { houseCount: 7 } },
      targetMap: { id: "map_blank_start", width: 20, height: 15, lived: false },
      selection: null,
    });
    expect(note).toContain("houseCount:7,");
    expect(note).not.toContain("코드 기본값");
  });

  // 평문 채팅의 범위는 지금 맵 하나 — 최상위에 새로 달린 마을 맵은 mergeMapBundles 가 버린다. 그래서 내용이
  // 있는 맵에서는 새 맵을 권하지 않고, 빈 땅 bounds 아니면 사용자에게 돌려보내는 것이 정직하다.
  it("내용이 있는 맵 + author_village 선언 → 새 맵 금지, 빈 땅 bounds 또는 되돌려 보내기", () => {
    const note = buildPiIntentNote({
      intent: villageIntent,
      targetMap: { id: "map_village", width: 100, height: 100, lived: true },
      selection: null,
    });
    expect(note).toContain("이미 내용이 있다");
    expect(note).toContain("새 맵(target:{kind:\"new\"}·create_map)은 결과에서 버려진다");
    expect(note).toContain('bounds:{x,y,w,h}');
    expect(note).toContain("빈 맵을 열어 다시 지시해 달라");
  });

  it("선택 영역 안 시공이면 마을 노트는 target 을 선택 영역 노트에 맡긴다", () => {
    const note = buildPiIntentNote({
      intent: { ...villageIntent, useSelection: true },
      targetMap: { id: "map_a", width: 100, height: 100, lived: true },
      selection: { mapId: "map_a", x: 10, y: 20, width: 30, height: 40 },
    });
    expect(note).toContain("target 은 아래 [선택 영역] 노트의 사각형이다");
    expect(note).toContain('bounds:{x:10,y:20,w:30,h:40}');
  });

  it("선언이 author_village 를 고르지 않았으면 마을 노트는 없다 — 집 한 채·소품 요청을 마을로 키우지 않는다", () => {
    const note = buildPiIntentNote({
      intent: { ...villageIntent, tools: ["author_house"], construction: undefined },
      targetMap: { id: "map_blank_start", width: 20, height: 15, lived: false },
      selection: null,
    });
    expect(note).not.toContain("[마을 시공]");
    expect(note).toContain("author_house");
  });

  it("모호한 점은 되묻지 않고 해석을 밝히라고 한다 — Pi 경로에는 되묻는 자리가 없다", () => {
    const note = buildPiIntentNote({ intent: { ...villageIntent, clarify: "어느 맵에?" }, targetMap: null, selection: null });
    expect(note).toContain("모호한 점: 어느 맵에?");
    expect(note).toContain("되묻지 않는다");
  });

  it("폴백 선언은 노트가 없고 지시문은 그대로다", () => {
    const fallback: IntentDeclaration = { ...emptyIntentDeclaration(), source: "fallback" };
    expect(buildPiIntentNote({ intent: fallback, targetMap: null, selection: null })).toBeNull();
    expect(composePiTask("마을을 만들어달라", null)).toBe("마을을 만들어달라");
  });

  it("지시문 뒤에 노트를 붙인다 — 사용자 문장이 먼저, 노트가 뒤", () => {
    const task = composePiTask("마을을 만들어달라", "[의도] 야외 시공");
    expect(task.startsWith("마을을 만들어달라")).toBe(true);
    expect(task).toBe("마을을 만들어달라\n\n[의도] 야외 시공");
  });
});
