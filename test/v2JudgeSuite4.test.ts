import { describe, expect, it } from "vitest";
import { lintExamineEvents } from "@/ai/v2/judge/examineLint";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { objectClusterAt } from "@/project/objectFootprint";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { tagged, type Finding, findingKey, findingLine } from "@/ai/v2/judge/finding";
import { FINDING_EN_RULES, findingEn, refNames, type RefNames } from "@/ai/v2/judge/findingEn";
import { gateProblems, mapViewArtProblems } from "@/ai/v2/judge/finishGate";
import { syncGateItems, splitPreexisting } from "@/ai/v2/judge/gates";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { modelText, modelTextCut } from "@/ai/v2/todo/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { checkImageDataUrl } from "@/ai/v2/judge/imageCheck";
import { isolateTimers } from "./mergedTeardown";

// 조사 이벤트 검사(scene-examine-*) — 2026-11-04 폴른 스타 월드 정비의 망원경·사당·수레.
describe("examineLint", () => {
  isolateTimers();
  const examinePage = (): EventPage => ({
    id: "p", name: "살핀다", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
    overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "오래된 물건이다." }],
  } as unknown as EventPage);
  const examine = (id: string, x: number, y: number): GameEvent => ({ id, name: "물건", x, y, pages: [examinePage()] } as unknown as GameEvent);
  function fixture(): { project: Project; map: GameMap; object: number; wall: number } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events = [];
    project.startPos = { x: 1, y: 1 };
    const upper = (map as unknown as { upperTiles: number[] }).upperTiles;
    const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta: Array<{ label?: string } | undefined> }).tileMeta;
    const blockedSingle = (pattern: RegExp): number => meta.findIndex((m, t) => {
      if (!pattern.test(m?.label ?? "")) return false;
      const i = 5 * map.width + 5, old = upper[i]!;
      upper[i] = t;
      const ok = !isPassable(project, map, 5, 5) && objectClusterAt(project, map, 5, 5)?.cells.length === 1;
      upper[i] = old;
      return ok;
    });
    const object = blockedSingle(/· (우물|나무통|술통|궤짝|나무 상자|바위|그루터기)( |$|\()/u);
    expect(object, "막힌 1칸 기물 칸이 번들 칩셋에 있어야 한다").toBeGreaterThan(0);
    return { project, map, object, wall: object };
  }
  const codes = (project: Project): string[] => lintExamineEvents(project).map((issue) => `${issue.code}:${issue.eventId}`).sort();
  describe("scene-examine-*", () => {
    it("열린 칸 옆 기물의 조사 하나는 조용하다", () => {
      const { project, map, object } = fixture();
      (map as unknown as { upperTiles: number[] }).upperTiles[5 * map.width + 5] = object;
      map.events.push(examine("ex_ok", 5, 5));
      expect(codes(project)).toEqual([]);
    });

    it("사방이 막힌 기물의 조사는 닿지 못한다고 한다", () => {
      const { project, map, object, wall } = fixture();
      const upper = (map as unknown as { upperTiles: number[] }).upperTiles;
      upper[5 * map.width + 5] = object;
      for (const [x, y] of [[4, 5], [6, 5], [5, 4], [5, 6]] as const) upper[y * map.width + x] = wall;
      map.events.push(examine("ex_sealed", 5, 5));
      expect(codes(project)).toContain("scene-examine-unreachable:ex_sealed");
    });

    it("이미 이벤트가 있는 물건에 조사를 하나 더 달면 겹친다고 한다", () => {
      const { project, map, object } = fixture();
      (map as unknown as { upperTiles: number[] }).upperTiles[5 * map.width + 5] = object;
      map.events.push(examine("ex_first", 5, 5), examine("ex_second", 5, 5));
      expect(codes(project)).toContain("scene-examine-duplicate:ex_second");
    });

    it("마감 단계가 건물 입구에 세운 「들어갈 수 없다」 한 줄은 조수가 지은 조사로 세지 않는다", () => {
      // 같은 건물의 간판 조사와 «한 물건에 이야기 둘»이 되거나, 문 앞이 막힌 집에서 «닿지 못한다»가 되면 조수가 고칠 수 없는 줄이 생긴다.
      const { project, map, object, wall } = fixture();
      const upper = (map as unknown as { upperTiles: number[] }).upperTiles;
      upper[5 * map.width + 5] = object;
      map.events.push(examine("ex_sign", 5, 5), examine("ev_locked_door_5_5", 5, 5));
      expect(codes(project)).toEqual([]);
      for (const [x, y] of [[4, 5], [6, 5], [5, 4], [5, 6]] as const) upper[y * map.width + x] = wall;
      map.events = [examine("ev_locked_door_5_5", 5, 5)];
      expect(codes(project)).toEqual([]);
    });
  });
});

describe("finishGate", () => {
  isolateTimers();
  // 관문 문제의 모델용 영어 글(2026-11-11 리팩토링 F4) — 모델은 영어 글(en)을 받고, 보고·장부·화면의 한국어 줄은 한 글자도 바뀌지 않는다.
  // 우리가 쓰는 글은 영어(ASCII)이고, 프로젝트의 이름은 자료라 저장된 그대로 «» 안에 id 와 같이 실린다.
  describe("aiV2FindingEn", () => {
    isolateTimers();
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
  });
  // 관문 열쇠는 글이 아니라 규칙·대상에서 나온다(2026-11-11 리팩토링 F3) — 글이 바뀌어도 같은 항목, 옛 열쇠로 저장된 할 일은 지금 열쇠로 옮긴다,
  // 시작 저장본 대조는 글까지 같아야 «기존 결함» 이다.
  describe("aiV2FindingKeys", () => {
    isolateTimers();
    const undeclared = (ids: string) => tagged("game", "깃발", `선언 안 된 스위치·변수: ${ids} — declare_story_flag 로 선언한다.`);
    describe("findingKey", () => {
      it("is the judge and the rule, plus the target when the judge named one — never the wording", () => {
        expect(findingKey(undeclared("sw_a"))).toBe("game:깃발");
        expect(findingKey(undeclared("sw_a, sw_b"))).toBe("game:깃발");
        expect(findingKey(tagged("ship", "maps-min", "세는 맵이 1/6장이다"))).toBe("ship:maps-min");
        expect(findingKey(tagged("game", "보임", "「돌」(ev_1) 는 맨땅이다", { target: { mapId: "map_a", eventId: "ev_1" } }))).toBe("game:보임:map_a:ev_1");
        expect(findingKey({ judge: "play", id: "autoplay", target: { ref: "보스 방" }, severity: "block", owner: "model", ko: "[끝까지 플레이 불가] …" })).toBe("play:autoplay::보스 방");
        // 같은 표지 아래의 갈래는 다른 문제다.
        expect(findingKey(tagged("game", "화면", "흔들기 명령이 없다", { variant: "shake" }))).toBe("game:화면/shake");
        expect(findingKey(tagged("game", "화면", "번쩍 명령이 없다", { variant: "flash" }))).toBe("game:화면/flash");
      });
    });
    describe("gateProblems", () => {
      it("keeps the old text key beside the new key", () => {
        const [p] = gateProblems([tagged("ship", "maps-min", "세는 맵이 1/6장이다 — 5장 더.")]);
        expect(p!.key).toBe("ship:maps-min");
        expect(p!.textKey).toBe("game:[출하 차단 maps-min] 세는 맵이 #/#장이다 — #장 더.");
        expect(p!.text).toBe("[출하 차단 maps-min] 세는 맵이 1/6장이다 — 5장 더.");
      });

      it("splits two problems of one rule by their wording instead of folding them into one item", () => {
        const two = gateProblems([tagged("game", "그림", "「촌장」의 걷기 그림이 이름과 어긋난다"), tagged("game", "그림", "「대장장이」의 걷기 그림이 이름과 어긋난다"), tagged("game", "음악", "곡을 걸지 않았다")]);
        expect(new Set(two.map((p) => p.key)).size).toBe(3);
        expect(two[0]!.key.startsWith("game:그림:")).toBe(true);
        expect(two[2]!.key).toBe("game:음악");
        // 대상이 있으면 글이 아니라 대상이 가른다.
        const targeted = gateProblems(["ev_1", "ev_2"].map((id) => tagged("game", "보임", `「돌」(${id}) 는 맨땅이다`, { target: { mapId: "map_a", eventId: id } })));
        expect(targeted.map((p) => p.key)).toEqual(["game:보임:map_a:ev_1", "game:보임:map_a:ev_2"]);
      });
    });
    describe("gate items follow the rule, not the wording", () => {
      it("a problem whose wording changed stays the same item and its attempts keep counting", () => {
        const store = new TodoStore();
        const first = syncGateItems(store, gateProblems([undeclared("sw_a, sw_b")]), new Set());
        expect(first.opened).toHaveLength(1);
        const item = first.opened[0]!;
        store.done(item, { pass: true, detail: "조수 표시" }, "model");
        // 하나를 고쳤더니 목록이 줄었다 — 같은 규칙이라 같은 항목이 다시 열린다(전에는 글이 달라 새 항목이 생기고 시도가 0 으로 돌아갔다).
        const second = syncGateItems(store, gateProblems([undeclared("sw_b")]), new Set());
        expect(store.items).toHaveLength(1);
        expect(second.opened).toEqual([item]);
        expect(item.attempts).toBe(1);
        expect(item.content).toContain("sw_b —");
      });

      it("moves an item saved under the old text key to the new key instead of opening a second one", () => {
        const [problem] = gateProblems([tagged("ship", "maps-min", "세는 맵이 1/6장이다 — 5장 더.")]);
        const store = new TodoStore();
        const [old] = store.append("함수 검사", [{ content: problem!.text, key: problem!.textKey! }], "gate");
        store.block(old!, "맵을 더 지을 수 없음");
        const sync = syncGateItems(store, [problem!], new Set());
        expect(sync.opened).toEqual([]);
        expect(store.items).toHaveLength(1);
        expect(store.byKey("ship:maps-min")).toBe(old);
        expect(old!.status).toBe("blocked");
      });

      it("closes an old-key item whose problem is gone", () => {
        const store = new TodoStore();
        const [old] = store.append("함수 검사", [{ content: "[게임 검사 음악] 곡을 걸지 않았다", key: "game:[게임 검사 음악] 곡을 걸지 않았다" }], "gate");
        const sync = syncGateItems(store, [], new Set());
        expect(sync.closed).toEqual([old]);
        expect(old!.status).toBe("completed");
      });
    });
    describe("a defect counts as preexisting only when the start snapshot had the same wording", () => {
      it("the same rule with a new instance this turn is a current problem", () => {
        const baseline = new Set(gateProblems([undeclared("sw_a")]).map((p) => p.textKey!));
        const same = splitPreexisting(gateProblems([undeclared("sw_a")]), baseline, undefined, undefined);
        expect(same.preexisting).toHaveLength(1);
        const grown = splitPreexisting(gateProblems([undeclared("sw_a, sw_b")]), baseline, undefined, undefined);
        expect(grown.current).toHaveLength(1);
        expect(grown.preexisting).toHaveLength(0);
      });

      it("editor-default leaks are never excused, and that is read from the rule id", () => {
        const [leak] = gateProblems([tagged("ship", "title-image", "타이틀 그림이 기본 그림이다")]);
        expect(splitPreexisting([leak!], new Set([leak!.textKey!]), undefined, undefined).current).toHaveLength(1);
        const [other] = gateProblems([tagged("ship", "window-look", "창 모양이 기본이다")]);
        expect(splitPreexisting([other!], new Set([other!.textKey!]), undefined, undefined).preexisting).toHaveLength(1);
      });
    });
  });
  describe("aiV2GenerateArt", () => {
    isolateTimers();
    // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
    const mapViewArtLines = (...args: Parameters<typeof mapViewArtProblems>): string[] => mapViewArtProblems(...args).map(findingLine);
    // 오너 2026-11-09: 타이틀·엔딩 그림이 게임 속 맵 화면(map-view)이면, 그림 생성이 가능한 실행은 generate_art 를 먼저 시도해야 한다.
    // 시도가 오류/불가로 기록되면 그 실패가 증거라 맵 화면을 받아 준다. 이 시험은 그 «기록이 문을 연다» 와 동사가 실제로 그림을 거는 것을 단언한다.
    const WHOLE = "마을 하나 만들어줘. 거기서 시작하는 모험 게임으로";
    const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
    function mapViewGame(): Project {
      const p = createBlankProject() as Project;
      p.meta.title = "새벽의 약속";
      p.system.titleScreen = { ...p.system.titleScreen!, title: "새벽의 약속", backgroundResourceId: `map-view:${p.startMapId}` };
      p.gameBlueprint = { request: WHOLE, title: "새벽의 약속", premise: "마을 모험", playerGoal: "등불을 밝힌다", steps: [],
        ending: { name: "새벽", how: "불을 밝힌다", feeling: "희망" } } as never;
      p.endings = [{ id: "e1", name: "새벽의 약속", conditions: [], priority: 0, presentation: { finalTitle: "새벽", backgroundResourceId: `map-view:${p.startMapId}` }, epilogue: [] } as never];
      return p;
    }
    describe("map-view title/ending needs a generation attempt first", () => {
      it("blocks a map-view title and ending when generation is available and nothing was tried", () => {
        const out = mapViewArtLines(mapViewGame(), new V2Session(), true, WHOLE);
        expect(out.length).toBe(2);
        expect(out.join("\n")).toContain("art-generation");
      });
      it("does not block when generation is not available in the run", () => {
        expect(mapViewArtLines(mapViewGame(), new V2Session(), false, WHOLE)).toEqual([]);
      });
      it("a recorded failure opens the gate; a recorded success on a still-map-view picture does not", () => {
        const failed = new V2Session();
        failed.artAttempts.set("title", { status: "failed", error: "provider 503", failures: 2 });
        failed.artAttempts.set("ending", { status: "unavailable" });
        expect(mapViewArtLines(mapViewGame(), failed, true, WHOLE)).toEqual([]);
        const ok = new V2Session();
        ok.artAttempts.set("title", { status: "ok" });
        expect(mapViewArtLines(mapViewGame(), ok, true, WHOLE).length).toBeGreaterThan(0);
      });
      it("one transient failure does not open the gate; it takes two failures on the same target", () => {
        const once = new V2Session();
        once.artAttempts.set("title", { status: "failed", error: "provider 503", failures: 1 });
        expect(mapViewArtLines(mapViewGame(), once, true, WHOLE).some((t) => t.includes("타이틀"))).toBe(true);
      });
      it("ignores requests that are not building a whole game", () => {
        const p = mapViewGame(); p.gameBlueprint = undefined;
        expect(mapViewArtLines(p, new V2Session(), true, "이 마을에 우물을 놓아 줘")).toEqual([]);
      });
    });
    describe("generate_art verb", () => {
      const envFor = (project: Project, generateImage?: unknown) => ({
        ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task: WHOLE, provider: "local-cli:claude", mapIds: [], project },
        emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, ...(generateImage ? { generateImage } : {}),
      }) as never;
      it("records a failure and keeps the picture when the generator throws", async () => {
        const project = mapViewGame(); const session = new V2Session();
        const env = envFor(project, async () => { throw new Error("provider 503"); });
        const verb = createV2Tools(env, session).find((t) => t.name === "generate_art")!;
        const res = await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
        expect(JSON.parse((res.content[0] as { text: string }).text).ok).toBe(false);
        expect(session.artAttempts.get("title")).toMatchObject({ status: "failed", failures: 1 });
      });
      it("a later failure never erases an earlier success, and one throw records 1/2 only", async () => {
        const project = mapViewGame(); const session = new V2Session();
        let calls = 0;
        const env = envFor(project, async () => { calls += 1; if (calls === 1) return { dataUrl: PNG, mimeType: "image/png", model: "m", provider: "p" }; throw new Error("provider 503"); });
        const verb = createV2Tools(env, session).find((t) => t.name === "generate_art")!;
        await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
        await verb.execute("b", { target: "title", prompt: "다른 장면으로 다시 그린 산골 마을의 저녁 풍경" } as never, undefined as never);
        expect(session.artAttempts.get("title")).toMatchObject({ status: "ok" });
      });
      it("records 'unavailable' when the run has no generator", async () => {
        const project = mapViewGame(); const session = new V2Session();
        const verb = createV2Tools(envFor(project), session).find((t) => t.name === "generate_art")!;
        await verb.execute("a", { target: "ending", prompt: "새벽 마을에 등불이 모두 켜지는 장면" } as never, undefined as never);
        expect(session.artAttempts.get("ending")).toMatchObject({ status: "unavailable" });
      });
      it("registers the generated picture and hangs it on the title", async () => {
        const project = mapViewGame(); const session = new V2Session();
        const env = envFor(project, async () => ({ dataUrl: PNG, mimeType: "image/png", model: "m", provider: "p" })) as { ctx: { project: Project } };
        const verb = createV2Tools(env as never, session).find((t) => t.name === "generate_art")!;
        const res = await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
        expect(JSON.parse((res.content[0] as { text: string }).text).ok).toBe(true);
        const bg = env.ctx.project.system.titleScreen?.backgroundResourceId;
        expect(bg).toMatch(/^gen-title-/);
        expect(JSON.stringify(env.ctx.project.assets ?? env.ctx.project)).toContain(bg!);
        expect(session.artAttempts.get("title")).toMatchObject({ status: "ok" });
        expect(mapViewArtLines(env.ctx.project, session, true, WHOLE).filter((t) => t.includes("타이틀"))).toEqual([]);
      });
    });
    // 리드 2026-11-09: 제공자가 돌려준 그림이 끝까지 오지 않았으면(잘린 JPEG 등) 등록하지 않고 타이틀·관문이 그대로여야 한다.
    // 실생성 한 장은 815 KB JPEG 였는데 위 시험은 1px PNG 만 썼다 — 두 형식 모두 «끝까지 온 파일» 조건을 본다.
    const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");
    const JPEG_OK = `data:image/jpeg;base64,${b64([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0xff, 0xd9])}`;
    const JPEG_CUT = `data:image/jpeg;base64,${b64([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 7, 7])}`;
    const WEBP_OK = `data:image/webp;base64,${b64([0x52, 0x49, 0x46, 0x46, 12, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3, 4, 5, 6, 7, 8])}`;
    const WEBP_CUT = `data:image/webp;base64,${b64([0x52, 0x49, 0x46, 0x46, 200, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3, 4, 5, 6, 7, 8])}`;
    describe("checkImageDataUrl", () => {
      it("accepts a complete PNG, JPEG and WEBP", () => {
        expect(checkImageDataUrl(PNG).ok).toBe(true);
        expect(checkImageDataUrl(JPEG_OK).ok).toBe(true);
        expect(checkImageDataUrl(WEBP_OK).ok).toBe(true);
      });
      it("rejects a truncated JPEG, a PNG without IEND, a short WEBP, broken base64 and a non-image", () => {
        expect(checkImageDataUrl(JPEG_CUT).ok).toBe(false);
        expect(checkImageDataUrl(PNG.slice(0, PNG.length - 24)).ok).toBe(false);
        expect(checkImageDataUrl(WEBP_CUT).ok).toBe(false);
        expect(checkImageDataUrl("data:image/jpeg;base64,@@@@").ok).toBe(false);
        expect(checkImageDataUrl("data:text/html;base64,PGI+").ok).toBe(false);
        expect(checkImageDataUrl(undefined).ok).toBe(false);
      });
    });
    describe("generate_art verb with an undecodable picture", () => {
      const envFor = (project: Project, generateImage: unknown) => ({
        ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task: WHOLE, provider: "local-cli:claude", mapIds: [], project },
        emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, generateImage,
      }) as never;
      // 도구 쓰기는 프로젝트를 새 객체로 갈아 끼운다(env.ctx.project) — 처음 만든 project 변수는 쓰기 전 사본이라, 결과는 실행 문맥의 프로젝트에서 읽는다.
      // (전에는 두 경우가 옛 project 를 읽었다: 성공 경우는 늘 map-view 라 떨어졌고, 잘린 그림 경우는 등록이 됐어도 통과했을 것이다.)
      const liveProject = (env: unknown): Project => (env as { ctx: { project: Project } }).ctx.project;
      it("does not register a truncated JPEG: the title stays map-view, one failure is recorded and the gate stays closed to finishing", async () => {
        const project = mapViewGame(); const session = new V2Session();
        const env = envFor(project, async () => ({ dataUrl: JPEG_CUT, mimeType: "image/jpeg", model: "m", provider: "p" }));
        const verb = createV2Tools(env, session).find((t) => t.name === "generate_art")!;
        const res = await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
        expect(JSON.parse((res.content[0] as { text: string }).text).ok).toBe(false);
        expect(liveProject(env).system.titleScreen?.backgroundResourceId).toBe(`map-view:${project.startMapId}`);
        expect(Object.keys(liveProject(env).assets.uploaded).filter((id) => id.startsWith("gen-"))).toEqual([]);
        expect(session.artAttempts.get("title")?.status).toBe("failed");
        expect(session.artAttempts.get("title")?.failures).toBe(1);
        expect(mapViewArtLines(liveProject(env), session, true, WHOLE).some((x) => x.includes("타이틀"))).toBe(true);
      });
      it("registers a complete JPEG and opens the gate for the title", async () => {
        const project = mapViewGame(); const session = new V2Session();
        const env = envFor(project, async () => ({ dataUrl: JPEG_OK, mimeType: "image/jpeg", model: "m", provider: "p" }));
        const verb = createV2Tools(env, session).find((t) => t.name === "generate_art")!;
        const res = await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
        expect(JSON.parse((res.content[0] as { text: string }).text).ok).toBe(true);
        const bg = liveProject(env).system.titleScreen?.backgroundResourceId;
        expect(bg).toMatch(/^gen-title-/);
        expect(liveProject(env).assets.uploaded[bg!]).toBeDefined();
        expect(mapViewArtLines(liveProject(env), session, true, WHOLE).filter((x) => x.includes("타이틀"))).toEqual([]);
      });
    });
  });
});
