// 관문 문제의 모델용 영어 글(2026-11-11 리팩토링 F4) — 모델은 영어 글(en)을 받고, 보고·장부·화면의 한국어 줄은 한 글자도 바뀌지 않는다.
import { describe, expect, it } from "vitest";
import { tagged, type Finding } from "@/ai/v2/judge/finding";
import { FINDING_EN_RULES, findingEn } from "@/ai/v2/judge/findingEn";
import { gateProblems } from "@/ai/v2/judge/finishGate";
import { syncGateItems } from "@/ai/v2/judge/gates";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { modelText, modelTextCut } from "@/ai/v2/todo/types";

const NON_ASCII = /[^\x20-\x7e]/u;

/** 표의 규칙 열쇠(«game:화면/shake» · «ship:bundled-picture/title») 하나로 그 규칙의 문제를 만든다. */
function findingOf(rule: string): Finding {
  const judge = rule.slice(0, rule.indexOf(":")) as "game" | "ship" | "play";
  const rest = rule.slice(rule.indexOf(":") + 1);
  const slash = rest.lastIndexOf("/");
  const id = slash < 0 ? rest : rest.slice(0, slash), variant = slash < 0 ? undefined : rest.slice(slash + 1);
  const base = { judge, id, severity: "block" as const, owner: "model" as const, ko: "" };
  // 출하 차단의 두 규칙은 갈래를 증거 머리에서 읽는다.
  if (id === "requested-feature-missing" && variant) return { ...base, evidence: `${variant}: 낱말` };
  if (id === "bundled-picture" && variant) return { ...base, evidence: variant === "title" ? "titleScreen.backgroundResourceId=x" : "endings[e].backgroundResourceId=x" };
  return variant ? { ...base, variant } : base;
}

describe("findingEn table", () => {
  it("every rule has ASCII-only English that names its judge and rule in the tag", () => {
    expect(FINDING_EN_RULES.length).toBeGreaterThan(140);
    for (const rule of FINDING_EN_RULES) {
      const en = findingEn(findingOf(rule));
      expect(en, rule).toBeTruthy();
      expect(NON_ASCII.test(en!), `${rule}: ${en}`).toBe(false);
      expect(en!.startsWith(`[${rule.slice(0, rule.indexOf(":"))} `), rule).toBe(true);
      expect(en!.length, rule).toBeLessThanOrEqual(480);
    }
  });

  it("picks the text of the variant, and falls back to the rule's text", () => {
    const shake = findingEn(tagged("game", "화면", "흔들기 명령이 없다", { variant: "shake" }))!;
    const flash = findingEn(tagged("game", "화면", "번쩍 명령이 없다", { variant: "flash" }))!;
    expect(shake).toContain("[game screen-shake]");
    expect(shake).toContain("{do:'shake'");
    expect(flash).toContain("[game screen-flash]");
    expect(findingEn(tagged("ship", "requested-feature-missing", "요청한 숨을 곳이(가) 게임에 없다", { evidence: "hiding: 숨" }))).toContain("configure_object_behavior{kind:'hiding'}");
    expect(findingEn(tagged("ship", "requested-feature-missing", "요청한 무엇이(가) 게임에 없다", { evidence: "새기능: 낱말" }))).toContain("[ship requested-feature-missing]");
    expect(findingEn(tagged("ship", "bundled-picture", "타이틀 그림이 번들 스틸이다", { evidence: "titleScreen.backgroundResourceId=oprn-title-field" }))).toContain("set_title_screen{backgroundResourceId}");
    expect(findingEn(tagged("ship", "bundled-picture", "엔딩 그림이 번들 스틸이다", { evidence: "endings[ending_a].backgroundResourceId=oprn-title-field" }))).toContain("define_ending presentation.backgroundResourceId");
  });

  it("carries ids and cells instead of names, right after the first sentence: target first, then ids in the line and the evidence", () => {
    const en = findingEn(tagged("game", "보임", "「낡은 비석」(ev_stone) 는 조사하는 이벤트인데 그림도 없고 그 칸(4,7)에 물건 타일도 없다 — 플레이어 눈에 맨땅이다.", { variant: "bare-ground", target: { mapId: "map_grave", eventId: "ev_stone" } }))!;
    expect(en).toContain("so the player sees bare ground. Refs: map_grave ev_stone (4,7). Find an object");
    expect(en).not.toContain("비석");
    // 증거가 ASCII 면 통째로 실린다(수가 뜻이다).
    expect(findingEn(tagged("ship", "maps-min", "세는 맵이 1/6장이다 — 5장 더.", { evidence: "counted=1 need=6 uncounted=2" }))).toContain("[ship maps-min] Too few counted maps. Refs: counted=1 need=6 uncounted=2. Build new places");
    // 한국어가 섞인 증거에서는 id 만.
    const mixed = findingEn(tagged("ship", "blueprint-event-missing", "청사진 s2 의 이벤트 「촌장」가 「마을」(map_village)에 없다", { evidence: "s2 map_village event=촌장" }))!;
    expect(mixed).toContain("Refs: map_village.");
    expect(NON_ASCII.test(mixed)).toBe(false);
    // 표의 글에 이미 든 예시 id 는 대상으로 되풀이하지 않는다.
    expect(findingEn(tagged("game", "상태", "실제 상태를 거는 명령이 없다. {value:'state_poison'} 를 넣는다."))).not.toContain("Refs:");
  });

  it("a rule that bundles many checks names the tools its Korean line names", () => {
    const en = findingEn(tagged("ship", "romance-gap", "게임 제목이 기본값 「새 프로젝트」 그대로입니다 — set_title_screen {title} 로 이 게임의 이름을 정하세요."))!;
    expect(en).toContain("Fix that part with set_title_screen.");
    expect(NON_ASCII.test(en)).toBe(false);
  });

  it("has no English for rules outside the table — the Korean line goes to the model as before", () => {
    expect(findingEn(tagged("game", "새 규칙", "아직 표에 없는 검사"))).toBeUndefined();
    // 장면 손질 줄은 처음부터 영어로 쓰여 있다(인용한 대사는 한국어) — 따로 옮기지 않는다.
    expect(findingEn(tagged("scene", "thin", "«map_a/ev_1» is a cutscene with 1 line"))).toBeUndefined();
  });
});

describe("gate items carry the English text for the model and the Korean line for the report", () => {
  const ko = "[게임 검사 날씨] 요청에 비·눈·날씨가 있는데 바꾼 이벤트에 실제 날씨 명령(setWeather)이 없다.";

  it("gateProblems keeps the Korean text and adds en", () => {
    const [p] = gateProblems([tagged("game", "날씨", "요청에 비·눈·날씨가 있는데 바꾼 이벤트에 실제 날씨 명령(setWeather)이 없다.")]);
    expect(p!.text).toBe(ko);
    expect(p!.en).toContain("[game weather] The request asks for rain");
    expect(gateProblems([tagged("game", "새 규칙", "아직 표에 없는 검사")])[0]!.en).toBeUndefined();
  });

  it("the todo item shows English to the model and Korean in the report view", () => {
    const store = new TodoStore();
    const { opened } = syncGateItems(store, gateProblems([tagged("game", "날씨", "요청에 비·눈·날씨가 있는데 바꾼 이벤트에 실제 날씨 명령(setWeather)이 없다.")]), new Set());
    const item = opened[0]!;
    expect(item.content).toBe(ko);
    expect(modelText(item)).toContain("[game weather]");
    expect(store.viewEn(10)).toContain("[game weather] The request asks for rain");
    expect(store.viewEn(10)).not.toContain("게임 검사");
    expect(store.view(10)).toContain("[게임 검사 날씨]");
    expect(store.view(10)).not.toContain("[game weather]");
  });

  it("cuts English item text at 1.8 times the Korean limit, so a cut view still reaches the fixing call", () => {
    const store = new TodoStore();
    const [gate, plain] = syncGateItems(store, [...gateProblems([tagged("ship", "maps-min", "세는 맵이 0/6장이다 — 6장 더.", { evidence: "counted=0 need=6 uncounted=1" })]), { key: "place:map_a:place", text: "가".repeat(300), source: "gate" as const }], new Set()).opened;
    expect(modelTextCut(gate!, 120)).toHaveLength(216);
    expect(modelTextCut(gate!, 120)).toContain("Build new places with make_place{spec:");
    expect(modelTextCut(plain!, 120)).toHaveLength(120);
  });

  it("an item without English falls back to its content, and a gate problem that loses its English drops the old one", () => {
    const store = new TodoStore();
    const plain = { key: "place:map_a:place", text: "마을(map_a) 고치기 — edit_place: 길이 끊겼다", source: "gate" as const };
    const first = syncGateItems(store, [plain, { ...plain, key: "game:x", text: "[게임 검사 x] 가", en: "[game x] A." }], new Set()).opened;
    expect(modelText(first[0]!)).toBe(plain.text);
    expect(modelText(first[1]!)).toBe("[game x] A.");
    syncGateItems(store, [plain, { ...plain, key: "game:x", text: "[게임 검사 x] 나" }], new Set());
    expect(first[1]!.content).toBe("[게임 검사 x] 나");
    expect(modelText(first[1]!)).toBe("[게임 검사 x] 나");
  });

  it("the English text survives save and restore with the item", () => {
    const store = new TodoStore();
    syncGateItems(store, gateProblems([tagged("ship", "title-name", "게임 제목이 편집기 기본 「새 프로젝트」이다 — set_title_screen{title} 로 이 게임의 제목을 쓴다.")]), new Set());
    const next = new TodoStore();
    expect(next.restore(JSON.parse(JSON.stringify(store.serialize("게임 만들어 줘"))))).toBe(true);
    expect(modelText(next.items[0]!)).toContain("[ship title-name] The game title is still the editor default.");
    expect(next.items[0]!.content).toContain("[출하 차단 title-name]");
  });
});
