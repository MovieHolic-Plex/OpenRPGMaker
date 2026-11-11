// 관문 문제의 모델용 영어 글(2026-11-11 리팩토링 F4) — 모델은 영어 글(en)을 받고, 보고·장부·화면의 한국어 줄은 한 글자도 바뀌지 않는다.
// 우리가 쓰는 글은 영어(ASCII)이고, 프로젝트의 이름은 자료라 저장된 그대로 «» 안에 id 와 같이 실린다.
import { describe, expect, it } from "vitest";
import { tagged, type Finding } from "@/ai/v2/judge/finding";
import { FINDING_EN_RULES, findingEn, refNames, type RefNames } from "@/ai/v2/judge/findingEn";
import { gateProblems } from "@/ai/v2/judge/finishGate";
import { syncGateItems } from "@/ai/v2/judge/gates";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { modelText, modelTextCut } from "@/ai/v2/todo/types";
import type { Project } from "@/project/types";

const NON_ASCII = /[^\x20-\x7e]/u;
/** «…» 안(프로젝트 이름)을 뺀 나머지 — 우리가 쓴 글. */
const ourWords = (en: string): string => en.replace(/«[^»]*»/gu, "");

/** 이름표를 만드는 데 읽는 칸만 채운 프로젝트. */
const project = (over: Partial<Record<"maps" | "database" | "switches" | "variables" | "commonEvents" | "endings" | "quests", unknown>>): Project =>
  ({ maps: {}, database: {}, switches: [], variables: [], commonEvents: [], ...over }) as unknown as Project;
const village = project({
  maps: { map_grave: { id: "map_grave", name: "묘지", events: [{ id: "ev_stone", name: "낡은 비석", x: 4, y: 7 }, { id: "ev_blank", name: "", x: 1, y: 2 }] }, map_village: { id: "map_village", name: "마을", events: [] } },
  database: { actors: [{ id: "actor_hero", name: "시온" }], troops: [{ id: "troop_wolf", name: "늑대 둘" }] },
  switches: [{ id: "sw_seal", name: "별의 봉인: 풀림" }],
  endings: [{ id: "ending_dawn", name: "새벽" }],
});
const names: RefNames = refNames(village);

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

  it("puts the targets right after the first sentence — the project's name in «» as stored, then the id, map and cell", () => {
    const bare = tagged("game", "보임", "「낡은 비석」(ev_stone) 는 조사하는 이벤트인데 그림도 없고 그 칸(4,7)에 물건 타일도 없다 — 플레이어 눈에 맨땅이다.", { variant: "bare-ground", target: { mapId: "map_grave", eventId: "ev_stone" } });
    const en = findingEn(bare, names)!;
    expect(en).toContain("so the player sees bare ground. Refs: «낡은 비석» (ev_stone @ map_grave (4,7)). Find an object");
    expect(NON_ASCII.test(ourWords(en))).toBe(false);
    // 이름표가 없으면 id·칸만.
    expect(findingEn(bare)).toContain("Refs: ev_stone, map_grave, (4,7). Find an object");
    // 증거가 ASCII 이고 수가 든 것이면 통째로 — 그 안의 id 에도 이름이 붙는다.
    expect(findingEn(tagged("ship", "maps-min", "세는 맵이 1/6장이다 — 5장 더.", { evidence: "counted=1 need=6 uncounted=2" }), names)).toContain("[ship maps-min] Too few counted maps. Refs: counted=1 need=6 uncounted=2. Build new places");
    expect(findingEn(tagged("ship", "ending-closure", "엔딩 「새벽」이 장면으로 맺지 않는다", { evidence: "ending_dawn: lines=1 chars=12 image=false" }), names)).toContain("Refs: «새벽» (ending_dawn): lines=1 chars=12 image=false.");
    // 한국어가 섞인 증거에서는 id 만 — 이름은 이름표에서.
    expect(findingEn(tagged("ship", "blueprint-event-missing", "청사진 s2 의 이벤트 「촌장」가 「마을」(map_village)에 없다", { evidence: "s2 map_village event=촌장" }), names)).toContain("Refs: «마을» (map_village).");
    // 맵 · 기록 · 스위치도 같은 꼴, 이름이 빈 이벤트와 이름표에 없는 id 는 id 만.
    const mixed = findingEn(tagged("game", "깃발", "켜기만 하는 스위치: sw_seal(「낡은 비석」) / ev_blank / troop_wolf / sw_gone", { variant: "unread-switch" }), names)!;
    expect(mixed).toContain("Refs: «별의 봉인: 풀림» (sw_seal), (ev_blank @ map_grave (1,2)), «늑대 둘» (troop_wolf), sw_gone.");
    // 표의 글에 이미 든 예시 id 는 대상으로 되풀이하지 않는다.
    expect(findingEn(tagged("game", "상태", "실제 상태를 거는 명령이 없다. {value:'state_poison'} 를 넣는다."), names)).not.toContain("Refs:");
    // 자동 플레이의 막힌 단계는 id 가 아니라 이름이다.
    expect(findingEn({ judge: "play", id: "autoplay", target: { ref: "보스 방" }, severity: "block", owner: "model", ko: "[끝까지 플레이 불가] …" })).toContain("blocked at one step. Refs: «보스 방». The player must");
  });

  it("refNames reads the current project first, then the starting save for what this turn deleted", () => {
    const before = project({ maps: { map_grave: { id: "map_grave", name: "옛 묘지", events: [{ id: "ev_gone", name: "사라진 묘지기", x: 2, y: 3 }] } } });
    const both = refNames(village, before);
    expect(both.name("map_grave")).toBe("묘지");
    expect(both.event("ev_gone")).toEqual({ name: "사라진 묘지기", mapId: "map_grave", x: 2, y: 3 });
    expect(both.event("ev_stone", "map_village")?.mapId).toBe("map_grave");
    expect(both.name("actor_none")).toBeUndefined();
  });

  it("a rule that bundles many checks names the tools its Korean line names", () => {
    const en = findingEn(tagged("ship", "romance-gap", "게임 제목이 기본값 「새 프로젝트」 그대로입니다 — set_title_screen {title} 로 이 게임의 이름을 정하세요."))!;
    expect(en).toContain("Fix that part with set_title_screen.");
    expect(NON_ASCII.test(ourWords(en))).toBe(false);
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
    // 이름표를 주면 대상에 이름이 붙는다 — 한국어 줄은 그대로.
    const [named] = gateProblems([tagged("ship", "map-bgm", "맵 1장(마을)이 편집기 기본 필드 곡을 튼다", { evidence: "map_village" })], names);
    expect(named!.en).toContain("Refs: «마을» (map_village).");
    expect(named!.text).toBe("[출하 차단 map-bgm] 맵 1장(마을)이 편집기 기본 필드 곡을 튼다");
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
