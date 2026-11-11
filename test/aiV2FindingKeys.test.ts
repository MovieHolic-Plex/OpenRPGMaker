// 관문 열쇠는 글이 아니라 규칙·대상에서 나온다(2026-11-11 리팩토링 F3) — 글이 바뀌어도 같은 항목, 옛 열쇠로 저장된 할 일은 지금 열쇠로 옮긴다,
// 시작 저장본 대조는 글까지 같아야 «기존 결함» 이다.
import { describe, expect, it } from "vitest";
import { findingKey, tagged } from "@/ai/v2/judge/finding";
import { gateProblems } from "@/ai/v2/judge/finishGate";
import { splitPreexisting, syncGateItems } from "@/ai/v2/judge/gates";
import { TodoStore } from "@/ai/v2/loop/todoStore";

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
