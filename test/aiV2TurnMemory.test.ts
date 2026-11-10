// 턴 사이 기억(2026-11-11 B4): 막힌 항목은 막힌 채로 이어 받고, 대상이 바뀌었거나 요청이 짚은 것만 다시 연다. 화면 검수 장부도 이어 받는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { continuationPrompt } from "@/ai/v2/loop/continuation";
import { syncGateItems } from "@/ai/v2/loop/gates";
import { indexProject } from "@/ai/v2/loop/refs";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { carryOver, reviewKey, stampTargets } from "@/ai/v2/turn/carryOver";
import { handCarriedBlockers, loadVqaBook, noteVqaRound, saveVqaBook, vqaUnofferedBlockers, type VqaFinding } from "@/ai/v2/turn/vqaItems";
import type { VqaDefect, VqaRound } from "@/ai/v2/vqa";

const project = (() => { const p = createBlankProject() as Project; p.maps[p.startMapId]!.name = "황금궁 정원"; return p; })();
const mapId = project.startMapId;

/** 턴 1 끝: 조수 항목 셋·검토자 항목·관문 항목 둘이 막힌 채 저장된다. */
function turnOne(): unknown {
  const store = new TodoStore();
  store.init([{ phase: "짓기", items: [
    { content: "대장간을 짓는다", id: "smith", check: { kind: "place", name: "대장간" } },
    { content: "정원을 꾸민다", id: "garden" },
    { content: "촌장을 세운다", id: "chief", check: { kind: "person", name: "촌장" } },
  ] }]);
  const smith = store.get("smith")!, garden = store.get("garden")!, chief = store.get("chief")!;
  store.start(smith); store.noteTried(smith, "make_place");
  store.recordFailure(smith, "make_place:x", "make_place 거절: 자리가 없다", "make_place rejected: no room");
  store.noteTried(smith, "edit_place");
  store.block(smith, "3번 실패 — 자리가 없다", "auto");
  garden.refs = { mapIds: [mapId] }; store.block(garden, "꾸밀 물건을 못 찾음");
  store.block(chief, "세울 칸을 못 찾음");
  const [adv] = store.append("검토자", [{ content: "보고의 주장이 실제 변경과 반대다", key: reviewKey("adv", "보고의 주장이 실제 변경과 반대다|엔딩을 연결") }], "critic");
  store.block(adv!, "표현을 잘못 썼다");
  store.append("함수 검사", [{ content: "[scene repeat] 같은 대사 반복", key: "game:scene-repeat" }, { content: "[출하 차단 maps-min] 맵이 적다", key: "game:maps-min" }], "gate");
  store.block(store.byKey("game:scene-repeat")!, "고칠 대사를 못 정함");
  store.block(store.byKey("game:maps-min")!, "맵을 더 지을 수 없음");
  stampTargets(store, indexProject(project));
  return JSON.parse(JSON.stringify(store.serialize("판타지 RPG 게임 하나 만들어 줘.")));
}

function turnTwo(task: string, p: Project = project): TodoStore {
  const store = new TodoStore();
  store.restore(turnOne(), carryOver(task, p, indexProject(p)));
  return store;
}

describe("carrying the todo list into the next turn", () => {
  it("keeps blocked items blocked, with attempts, last failure, verbs tried and the reason", () => {
    const store = turnTwo("계속 해 줘");
    expect(["smith", "garden", "chief"].map((id) => store.get(id)!.status)).toEqual(["blocked", "blocked", "blocked"]);
    expect(store.get("smith")!.attempts).toBe(1);
    expect(store.get("smith")!.blockedReason).toContain("3번 실패");
    expect(store.meta.get("smith")!.lastFail).toContain("자리가 없다");
    expect(store.meta.get("smith")!.tried).toEqual(["make_place", "edit_place"]);
    expect(store.openCount()).toBe(0);
    expect(store.initialized).toBe(true);
  });

  it.each([
    ["nothing changed, nothing named", "계속 해 줘", false, []],
    ["the request names a check subject", "이어서 촌장 다시 세워 줘", false, ["chief"]],
    ["the request names an item id", "이어서 smith 다시 해 줘", false, ["smith"]],
    ["the request names the bound map", "계속. 황금궁 정원 좀 더 꾸며 줘", false, ["garden"]],
    ["the bound map changed since the block", "계속 해 줘", true, ["garden"]],
  ] as const)("reopens only what changed or was named — %s", (_name, task, changeMap, reopened) => {
    const p = structuredClone(project);
    if (changeMap) p.maps[mapId]!.width += 1;
    const store = turnTwo(task, p);
    expect(["smith", "garden", "chief"].filter((id) => store.get(id)!.status !== "blocked")).toEqual([...reopened]);
    for (const id of reopened) expect(store.get(id)!.attempts).toBe(0);
  });

  it("a reopened item shows what was tried in the earlier turn", () => {
    const store = turnTwo("이어서 smith 다시 해 줘");
    expect(continuationPrompt(store)).toContain("already tried in an earlier turn: make_place, edit_place");
  });

  it("drops reviews of the previous turn's report instead of carrying them", () => {
    const store = turnTwo("계속 해 줘");
    const adv = store.items.find((i) => i.source === "critic")!;
    expect(adv.status).toBe("dropped");
    expect(store.holds(adv)).toBe(false);
  });

  it("a new plan does not erase carried blocked items", () => {
    const store = turnTwo("계속 해 줘");
    store.init([{ phase: "새 계획", items: [{ content: "엔딩을 잇는다" }] }]);
    expect(store.get("smith")!.status).toBe("blocked");
    expect(store.items.some((i) => i.content === "엔딩을 잇는다")).toBe(true);
  });

  it("the finish gate neither re-adds a carried blocked problem nor keeps one it no longer reports", () => {
    const store = turnTwo("계속 해 줘");
    const before = store.items.length;
    const sync = syncGateItems(store, [{ key: "game:maps-min", text: "[출하 차단 maps-min] 맵이 적다", source: "gate" }], new Set());
    expect(sync.opened).toEqual([]);
    expect(store.items).toHaveLength(before);
    expect(store.byKey("game:maps-min")!.status).toBe("blocked");
    const gone = store.byKey("game:scene-repeat")!;
    expect(gone.status).toBe("dropped");
    expect(gone.blockedReason).toContain("기존 결함");
  });

  it("review item keys come from the note itself, so a later review cannot overwrite another note", () => {
    expect(reviewKey("adv", "a|b")).toBe(reviewKey("adv", "a|b"));
    expect(reviewKey("adv", "a|b")).not.toBe(reviewKey("adv", "a|c"));
    const store = new TodoStore();
    const [first] = store.append("검토자", [{ content: "시키지 않은 삭제", key: reviewKey("adv", "시키지 않은 삭제|") }], "critic");
    store.append("검토자 다시", [{ content: "요청 중 안 된 부분", key: reviewKey("adv", "요청 중 안 된 부분|") }], "critic");
    expect(first!.content).toBe("시키지 않은 삭제");
    expect(store.items).toHaveLength(2);
  });
});

describe("carrying the screen-review ledger into the next turn", () => {
  const on = (what: string, severity: VqaDefect["severity"] = "polish"): VqaDefect => ({ where: "맵 «황금궁 정원» (20×15칸) · 어딘가", what, severity, target: { kind: "map", ref: mapId } });
  const round = (n: number, defects: VqaDefect[]): VqaRound => ({ round: n, shots: [{ where: "", kind: "map", ref: mapId }], defects, ms: 0, reviewer: "test" });
  const dragon = on("붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "blocker");
  const dragonAgain = on("붉은 용 스프라이트의 머리가 윗벽 장식 띠에 맞닿아 벽에 박힌 것처럼 보인다.", "blocker");
  const sparse = on("정원 대부분이 빈 잔디 바닥이라 휑하다.");
  const boat = on("배가 물 위가 아니라 눈밭과 나무 사이에 놓여 있어 배치가 어색하다.");
  const chest = on("보물상자가 방의 오른쪽 벽 경계에 걸쳐 있어 벽에 묻힌 것처럼 보이고 다가가기 어렵다.", "blocker");

  /** 턴 1: 용·빈 정원은 건네져 막혔고, 상자는 판이 남지 않은 판에 처음 보였다. */
  function saved(): unknown {
    const store = new TodoStore();
    const book: VqaFinding[] = [];
    store.init([{ phase: "짓기", items: [{ content: "마을" }] }]);
    store.done(store.items[0]!, undefined);
    noteVqaRound(book, store, round(1, [dragon, sparse, boat]), project);
    store.markOffered();
    for (const item of store.items.filter((i) => i.source === "vqa")) store.block(item, "옮길 칸을 못 찾음");
    noteVqaRound(book, store, round(5, [dragon, sparse, boat, chest]), project);
    expect(vqaUnofferedBlockers(book, store)).toHaveLength(1);
    store.memory.vqa = saveVqaBook(book, store, project, "fp-turn1");
    return JSON.parse(JSON.stringify(store.serialize("게임 만들어 줘")));
  }
  const continued = () => { const store = new TodoStore(); const state = saved(); store.loadMemory(state); store.restore(state, carryOver("계속 해 줘", project, indexProject(project))); return store; };

  it("stays small", () => {
    expect(JSON.stringify((saved() as { memory: unknown }).memory).length).toBeLessThan(2500);
  });

  it("round 1 of the next turn does not turn already-handed complaints into new items", () => {
    const store = continued();
    const { book, reviewedFp } = loadVqaBook(store.memory.vqa, store);
    expect(reviewedFp).toBe("fp-turn1");
    expect(book.filter((f) => f.itemId)).toHaveLength(2);
    const before = store.items.length;
    const out = noteVqaRound(book, store, round(1, [dragonAgain, sparse, boat, chest]), project);
    expect(out.offered).toEqual([chest]);
    expect(store.items).toHaveLength(before + 1);
    expect(store.items.filter((i) => i.source === "vqa" && i.status === "blocked")).toHaveLength(2);
  });

  it("hands over a blocker the previous turn could not, without photographing again", () => {
    const store = continued();
    const { book } = loadVqaBook(store.memory.vqa, store);
    const first = handCarriedBlockers(book, store, project);
    expect(first.offered).toEqual([chest]);
    expect(handCarriedBlockers(book, store, project).opened).toEqual([]);
    expect(vqaUnofferedBlockers(book, store)).toEqual([]);
  });

  it("a turn that did not carry the list re-hands a blocker with no item, but never polish handed once", () => {
    const store = new TodoStore();
    store.loadMemory(saved());
    const { book } = loadVqaBook(store.memory.vqa, store);
    expect(book.every((f) => !f.itemId)).toBe(true);
    const out = noteVqaRound(book, store, round(1, [dragon, sparse]), project);
    expect(out.opened).toHaveLength(1);
    expect(out.opened[0]!.content).toContain("붉은 용");
    expect(store.items.some((i) => i.severity === "polish")).toBe(false);
  });

  it("ignores a malformed saved ledger", () => {
    expect(loadVqaBook({ findings: "x" }, new TodoStore()).book).toEqual([]);
    expect(loadVqaBook(undefined, new TodoStore()).book).toEqual([]);
    expect(loadVqaBook({ findings: [{ key: 1 }, null] }, new TodoStore()).book).toEqual([]);
  });
});
