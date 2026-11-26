import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project, GameEvent, GameMap } from "@/project/types";
import { continuationPrompt } from "@/ai/v2/loop/continuation";
import { syncGateItems } from "@/ai/v2/judge/gates";
import { indexProject } from "@/ai/v2/loop/refs";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { carryOver, reviewKey, stampTargets } from "@/ai/v2/turn/carryOver";
import { handCarriedBlockers, loadVqaBook, noteVqaRound, saveVqaBook, vqaUnofferedBlockers, type VqaFinding } from "@/ai/v2/turn/vqaItems";
import type { VqaDefect, VqaRound } from "@/ai/v2/judge/vqa";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { classifyRequest, describeIntent, readRequest, type RequestIntent, type RequestScope } from "@/ai/v2/request/intent";
import { CONTINUE_WORDS, buildsWholeGame, editOnlyRequest, v2ExtraToolNames, wantsWholeGame } from "@/ai/v2/request/readers";
import { ROMANCE_SETUP_WORDS } from "@/ai/v2/request/genre";
import { INTERIOR_WORDS, TERRAIN_WORDS } from "@/ai/v2/request/place";
import { ONE_ROOM_GAME } from "@/ai/v2/request/scope";
import { startScreenPrompt } from "@/editor/startScreenPrompt";
import { restoreEventFromBefore } from "@/ai/v2/story/restoreEvent";
import { deserialize, serialize } from "@/project/io/serialize";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { loadPlaces, savePlaces, type PlaceMemory } from "@/ai/v2/tools/placeMemory";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { isolateTimers } from "./mergedTeardown";
import { runTool } from "@/editor/tools";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { isPassable } from "@/project/collision";
import { builderFor } from "@/ai/v2/place/builders";
import { groundBlocks, objectAt } from "@/ai/v2/place/cells";
import { declaredDoorCells, placeMarks } from "@/ai/v2/place/entrances";
import { personSpotContext, personSpotCost } from "@/ai/v2/place/personSpot";
import { clearTargetFronts } from "@/ai/v2/place/reachRepairs";
import { roadCells } from "@/ai/v2/place/surface";
import { resolveWhere } from "@/ai/v2/place/where";
import { WORLDS, worldPlaceSpec } from "@/ai/v2/place/world";
import type { BuildRun } from "@/ai/v2/shared/types";

describe("aiV2TurnMemory", () => {
  isolateTimers();
  // 턴 사이 기억(2026-11-11 B4): 막힌 항목은 막힌 채로 이어 받고, 대상이 바뀌었거나 요청이 짚은 것만 다시 연다. 화면 검수 장부도 이어 받는다.
  describe("aiV2TurnMemory", () => {
    isolateTimers();
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
  });
  // 요청 분류 말뭉치 — 실제로 들어올 만한 요청 한 줄마다 «범위와 그 요청이 가르는 결정» 을 못박는다(모델 없음).
  // 2026-11-11 구조 재점검에서 잘못 갈린 문장(제목 속 「노래」, 「엔딩까지 가는 길」, 「독서실」의 독, 「썸네일」의 썸 …)이 모두 여기 있다.
  // 낱말 규칙을 고칠 때는 여기에 줄을 더하고, 기대가 바뀌는 줄은 PR 에서 하나씩 설명한다.
  describe("aiV2RequestIntent", () => {
    isolateTimers();
    type State = "blank" | "event" | "built";
    const made = new Map<State, Project>();
    /** 상태마다 프로젝트 하나 — 분류는 프로젝트를 읽기만 한다. */
    function project(state: State): Project {
      const hit = made.get(state);
      if (hit) return hit;
      const p = createBlankProject() as Project;
      if (state !== "blank") {
        const map = p.maps[p.startMapId]!;
        map.events = [...(map.events ?? []), { id: "ev_npc", name: "촌장", x: 2, y: 2, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "어서 오게." }] }] } as never];
      }
      if (state === "built") {
        p.gameBlueprint = normalizeGameBlueprint({
          title: "시험 게임", genre: "판타지 RPG", playerGoal: "샘을 되찾자.", request: "판타지 RPG 게임 하나 만들어 줘.",
          steps: [{ id: "s1", place: "시작", event: "촌장", action: "촌장에게 묻는다", gives: "실마리", needs: [], feeling: "궁금함" }, { id: "s2", place: "시작", event: "샘", action: "샘을 살핀다", gives: "끝", needs: ["실마리"], feeling: "안도" }],
          ending: { name: "끝", how: "샘을 살핀다", feeling: "안도" },
        });
      }
      made.set(state, p);
      return p;
    }
    /** 첫 화면에서 장르 포스터를 골라 보낸 첫 지시(«사용자 의도 + 선택한 시작 장르») — 만들라는 동사가 없다. */
    const POSTER_STORY = startScreenPrompt({ choiceId: "story-cutscene", intent: "회상 스토리" })!;
    const POSTER_STORY_LONG = startScreenPrompt({ choiceId: "story-cutscene", intent: "바닷가 등대지기의 마지막 여름을 회상하는 게임" })!;
    const POSTER_JRPG = startScreenPrompt({ choiceId: "adventure-jrpg", intent: "모험 JRPG" })!;
    const FOLLOW = "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을 처음부터 엔딩까지 실제로 플레이할 수 있게 해 줘.";
    /** 기대 칸 — 적은 것만 본다. whole = 이번 턴이 게임 하나를 짓는가(프로젝트까지 본 답). */
    interface Want { scope: RequestScope; on?: State; whole?: boolean; audioOnly?: boolean; music?: boolean; game?: boolean; encounters?: boolean; oneRoom?: boolean; editOnly?: boolean; continuation?: boolean; terrain?: boolean; store?: boolean; puzzle?: boolean; horror?: boolean; combat?: boolean; art?: boolean }
    const CORPUS: readonly (readonly [string, Want])[] = [
      // ── 작은 고치기: 사람·물건·사건·대사·데이터 ──
      ["이 맵에 상점 주인 한 명 세워 줘.", { scope: "edit", whole: false, game: true }],
      ["이 NPC를 두 칸 왼쪽으로 옮겨 줘", { scope: "edit", whole: false }],
      ["저 상자를 방 안쪽으로 옮겨 줘", { scope: "edit" }],
      ["촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘", { scope: "edit" }],
      ["광장 빈 곳에 나무랑 벤치 좀 놓아 줘", { scope: "edit" }],
      ["여기 보물상자 하나 놓고 포션 3개 넣어 줘", { scope: "edit", game: true }],
      ["이 문을 지나면 동굴로 가게 이어 줘", { scope: "edit" }],
      ["촌장한테 말 걸면 열쇠를 받게 해 줘", { scope: "edit", puzzle: true }],
      ["슬라임 세 마리와 싸우는 전투 하나 넣어 줘", { scope: "edit", combat: true, game: true }],
      ["오프닝 장면 하나 만들어 줘", { scope: "edit", whole: false }],
      ["주인공 이름을 하린으로 바꿔 줘", { scope: "edit" }],
      ["이 맵 이름을 '안개 마을'로 바꿔 줘", { scope: "edit" }],
      ["레버를 당기면 다리가 내려오게 해 줘", { scope: "edit", terrain: true }],
      ["여관 주인 추가해 줘", { scope: "edit" }],
      ["마을 사람 세 명 추가해 줘", { scope: "edit" }],
      ["집사 NPC 한 명 추가해 줘", { scope: "edit" }],
      ["성격이 급한 상인으로 바꿔 줘", { scope: "edit" }],
      ["방금 만든 NPC 지워 줘", { scope: "edit" }],
      ["숲에 약초 캐는 곳 몇 군데 놓아 줘", { scope: "edit", game: true }],
      ["버튼 효과 고쳐 (액션)", { scope: "edit", whole: false }],
      ["게임 타이틀 화면 만들어 줘", { scope: "edit", whole: false }],
      ["게임 시작할 때 나오는 오프닝 만들어 줘", { scope: "edit", whole: false }],
      ["게임 오버 화면 문구 바꿔 줘", { scope: "edit", whole: false }],
      ["마을 이름을 게임으로 바꿔", { scope: "edit", whole: false }],
      ["타이틀 화면 그림 새로 그려 줘", { scope: "edit", art: true }],
      ["타이틀 화면 그림 새로 그려 줘", { scope: "edit", on: "built", whole: false, art: true }],
      ["엔딩 그림을 노을 지는 언덕으로 바꿔 줘", { scope: "edit", art: true }],
      ["촌장 얼굴 그림 바꿔 줘", { scope: "edit", art: false }],
      ["상점에서 회복약을 50골드에 팔게 해 줘", { scope: "edit", game: true }],
      ["촌장에게 약초 다섯 개 모아 오는 퀘스트 넣어 줘", { scope: "edit", game: true }],
      ["독에 걸리는 늪 함정 넣어 줘", { scope: "edit", game: true }],
      ["한 방에 보스를 쓰러뜨리는 필살기 넣어 줘", { scope: "edit", oneRoom: false, combat: true }],
      // ── 2026-11-11 재점검에서 잘못 갈린 문장 ──
      ["게임 제목을 '별의 노래'로 바꿔 줘", { scope: "edit", audioOnly: false, music: false, game: true }],
      ["엔딩까지 가는 길에 표지판 하나 세워 줘", { scope: "edit", whole: false }],
      ["처음부터 끝까지 대사 맞춤법 검토해 줘", { scope: "edit", whole: false, continuation: false }],
      ["게임 속 상점 NPC 만들어 줘", { scope: "edit", whole: false }],
      // 작은 일 하네스 실측(2026-11-11): 집에 문을 내는 말은 그 집을 짓는 말이 아니다.
      ["족장의 긴 집에 뒷문을 하나 만들어 줘. 그 문으로 나가면 겨울 시장으로 가게 해 줘", { scope: "edit", whole: false }],
      ["독서실 실내 하나 지어 줘", { scope: "place", game: false }],
      // 지은 것을 고치는 작은 일은 게임 낱말이 없어도 게임 도구 묶음을 받는다(이벤트 찾기·옮기기가 거기 있다).
      ["썸네일 그림 하나 골라 줘", { scope: "edit", game: true }],
      ["사냥터에서 경험치 쌓게 해 줘", { scope: "edit", encounters: true, game: true }],
      ["상자 하나 옮겨 줘", { scope: "edit", on: "built", whole: false, editOnly: true }],
      ["이 맵에 상점 주인 한 명 세워 줘.", { scope: "edit", on: "built", whole: false, editOnly: true }],
      ["엔딩 크레딧 음악 넣고 크레딧에 내 이름도 넣어 줘", { scope: "edit", audioOnly: false, music: true }],
      // ── 이름·대사 속 낱말은 주제가 아니다 ──
      ["'승리의 음악'이라는 책을 책장에 놓아 줘", { scope: "edit", music: false, audioOnly: false }],
      ["촌장이 \"배경 음악이 참 좋지?\"라고 말하게 해 줘", { scope: "edit", music: false }],
      ["오프닝에서 \"게임을 만들어 줘서 고마워\"라고 말하는 장면 넣어 줘", { scope: "edit", whole: false }],
      ["경비병이 \"무작위 조우를 조심해\"라고 말하게 해 줘", { scope: "edit", encounters: false }],
      ["보스 이름을 '효과음 대왕'으로 바꿔 줘", { scope: "edit", audioOnly: false }],
      // ── 장소 하나 ──
      ["여관 1층 하나 지어 줘", { scope: "place", whole: false }],
      ["작은 마을 하나 만들어 줘", { scope: "place" }],
      ["3층짜리 동굴 던전 만들어 줘", { scope: "place" }],
      ["숲길 하나 만들어 줘", { scope: "place" }],
      ["편의점 앞 밤거리 하나 만들어 줘", { scope: "place" }],
      ["마을에 대장간 하나 추가해 줘", { scope: "place", on: "built", whole: false, editOnly: false }],
      ["새 맵에 동굴을 만들어 줘", { scope: "place" }],
      ["마왕성 꼭대기 방 하나 더 만들어 줘", { scope: "place" }],
      ["빵집 실내를 좀 더 넓혀 줘", { scope: "place" }],
      ["다락방 하나 지어 줘", { scope: "place" }],
      ["이 방을 좀 더 아늑하게 꾸며 줘", { scope: "place" }],
      ["계곡 맵 만들어 줘", { scope: "place", music: false }],
      ["이 게임에 상점 하나 추가해 줘", { scope: "place", whole: false }],
      ["힐링 게임의 시골 마을에 있는 작은 잡화점 실내를 만들어 줘.", { scope: "place", whole: false }],
      ["방탈출 게임에 쓸 작은 잠긴 서재를 만들어 줘. 단서 두 개, 금고 하나, 잠긴 문이 있어.", { scope: "place", whole: false }],
      ["공포 게임에 나오는 버려진 병원의 병실 실내를 만들어 줘. 다른 맵은 만들지 말고 이 장소 하나만 지어 줘.", { scope: "place", whole: false, oneRoom: true }],
      ["택배 배달 게임에서 소포를 받는 동네 빵집 실내를 만들어 줘.", { scope: "place", whole: false }],
      // ── 게임 하나 ──
      ["판타지 RPG 게임 하나 만들어 줘.", { scope: "wholeGame", whole: true, game: true }],
      ["재밌는 게임 만들어 줘.", { scope: "wholeGame", whole: true }],
      ["방탈출 게임 만들어 줘.", { scope: "wholeGame", oneRoom: true, puzzle: true }],
      ["추리 게임 하나 만들어 줘", { scope: "wholeGame" }],
      ["학교 괴담 모험 게임 하나 만들어 줘.", { scope: "wholeGame" }],
      ["북방 설원에서 벌어지는 게임 하나 만들어 줘.", { scope: "wholeGame" }],
      ["연애 시뮬레이션 게임 만들어 줘", { scope: "wholeGame" }],
      ["몬스터를 잡아 모으는 게임 만들어 줘", { scope: "wholeGame", combat: true }],
      ["카페 경영 게임 만들어 줘", { scope: "wholeGame" }],
      ["짧은 JRPG 하나 만들어 줘", { scope: "wholeGame" }],
      ["마을에서 시작해서 동굴 속 마왕을 쓰러뜨리는 짧은 판타지 RPG 만들어 줘.", { scope: "wholeGame" }],
      ["폐병원에서 탈출하는 짧은 공포 게임 만들어 줘. 귀신한테 잡히면 게임 오버야.", { scope: "wholeGame", horror: true }],
      ["폐업 직전 태엽 장난감 가게, 밤마다 손님이 깨어난다 (회상 스토리)", { scope: "wholeGame" }],
      ["마을 하나 만들어줘. 거기서 시작하는 모험 게임으로", { scope: "wholeGame" }],
      ["방 하나만 있는 방탈출 게임 만들어 줘", { scope: "wholeGame", oneRoom: true }],
      ["밀실 살인 사건 추리 게임 만들어 줘", { scope: "wholeGame", oneRoom: true }],
      ["택배 배달 게임을 엔딩까지 만들어 줘", { scope: "wholeGame" }],
      ["엔딩까지 이어지게 해 줘", { scope: "wholeGame" }],
      ["게임을 도트 그래픽으로 만들어 줘", { scope: "wholeGame" }],
      ["힐링 게임 하나 만들어 줘. 잡화점 실내도 만들어 줘.", { scope: "wholeGame" }],
      ["make me a fun game", { scope: "wholeGame" }],
      ["판타지 RPG 게임 하나 만들어 줘.", { scope: "wholeGame", on: "built", whole: true, editOnly: false }],
      // 첫 화면 포스터 요청 — 빈 프로젝트에서 게임 하나(지은 것이 있는 프로젝트에서는 아래 별도 시험)
      [POSTER_STORY, { scope: "wholeGame", whole: true }],
      [POSTER_STORY_LONG, { scope: "wholeGame", whole: true }],
      [POSTER_JRPG, { scope: "wholeGame", whole: true }],
      // ── 소리만 ──
      ["마을에 잔잔한 배경 음악 깔아 줘", { scope: "audio", audioOnly: true, music: true }],
      ["보스 전투 음악을 더 긴박하게 바꿔 줘", { scope: "audio", audioOnly: true }],
      ["타격음 더 묵직하게 해 줘", { scope: "audio", audioOnly: true }],
      ["효과음 전부 레트로로 바꿔 줘", { scope: "audio", audioOnly: true }],
      ["투더문처럼 잔잔하게 엔딩곡 넣어 줘", { scope: "audio", audioOnly: true }],
      ["아오오니 느낌으로 추격 음악", { scope: "audio", audioOnly: true }],
      ["마을에 잔잔한 배경 음악 깔아 줘", { scope: "audio", on: "built", whole: false, editOnly: true }],
      ["보스 만들고 보스곡 넣어 줘", { scope: "edit", audioOnly: false, music: true }],
      ["NPC가 노래를 부르는 장면 만들어 줘", { scope: "edit", music: false }],
      // ── 질문 ──
      ["이 게임 뭐가 부족한지 알려 줘", { scope: "question", whole: false }],
      ["지금 맵이 몇 개야?", { scope: "question" }],
      ["촌장 이벤트가 어디 있어?", { scope: "question" }],
      ["엔딩 조건 설명해 줘", { scope: "question" }],
      ["이 프로젝트 요약해 줘", { scope: "question" }],
      ["왜 문이 안 열려?", { scope: "question" }],
      // ── 이어 하기 — 게임 하나로 시작한 프로젝트에서만 게임 하나 범위를 물려받는다 ──
      ["계속", { scope: "continue", on: "built", whole: true, continuation: true }],
      ["계속", { scope: "continue", on: "blank", whole: false, continuation: true }],
      ["계속", { scope: "continue", on: "event", whole: false }],
      ["남은 거 마저 해 줘", { scope: "continue", on: "built", whole: true }],
      ["끝까지 만들어 줘", { scope: "continue", on: "built", whole: true }],
      ["끝까지 만들어 줘", { scope: "continue", on: "blank", whole: false }],
      ["이어서 만들어 줘", { scope: "continue", on: "built", whole: true }],
      ["다시 해 줘", { scope: "continue", on: "built", whole: true }],
      ["아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을", { scope: "continue", on: "built", whole: true }],
      ["아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을", { scope: "continue", on: "blank", whole: false }],
      [FOLLOW, { scope: "wholeGame", on: "built", whole: true, continuation: true }],
      [FOLLOW, { scope: "wholeGame", on: "blank", whole: true }],
      ["이 대사 계속 나오게 해 줘", { scope: "edit", on: "built", whole: false, continuation: false }],
      ["계속 따라오는 동료 하나 추가해 줘", { scope: "edit", on: "built", whole: false, continuation: false }],
      // ── 전투·조우·스토어 ──
      ["풀숲에서 슬라임이 튀어나오게 해 줘", { scope: "edit", encounters: true, game: true }],
      ["숲길에서는 무작위 조우는 없게 해 줘", { scope: "edit", encounters: false }],
      ["약한 몬스터가 나오는 사냥터로 만들어 줘", { scope: "edit", encounters: true, combat: true }],
      ["내 게임 평가 좀 보여 줘", { scope: "question", store: true }],
      ["비추천 리뷰에 답글 써 줘", { scope: "edit", store: true }],
    ];
    describe("request intent — routing corpus", () => {
      it("has at least 80 requests", () => {
        expect(CORPUS.length).toBeGreaterThanOrEqual(80);
      });

      it.each(CORPUS.map(([ask, want]) => [`${want.on ?? "blank"} | ${ask}`, ask, want] as const))("%s", (_label, ask, want) => {
        const intent: RequestIntent = classifyRequest(ask, project(want.on ?? "blank"));
        const got: Want = { scope: intent.scope };
        if (want.whole !== undefined) got.whole = intent.wholeGame;
        if (want.audioOnly !== undefined) got.audioOnly = intent.audio.only;
        if (want.music !== undefined) got.music = intent.audio.music;
        if (want.game !== undefined) got.game = intent.tools.game;
        if (want.encounters !== undefined) got.encounters = intent.combat.encounters;
        if (want.oneRoom !== undefined) got.oneRoom = intent.oneRoom;
        if (want.editOnly !== undefined) got.editOnly = intent.editOnly;
        if (want.continuation !== undefined) got.continuation = intent.continuation;
        if (want.terrain !== undefined) got.terrain = intent.tools.terrain;
        if (want.store !== undefined) got.store = intent.tools.store;
        if (want.puzzle !== undefined) got.puzzle = intent.puzzle;
        if (want.horror !== undefined) got.horror = intent.horror;
        if (want.combat !== undefined) got.combat = intent.combat.mentioned;
        if (want.art !== undefined) got.art = intent.art;
        const { on: _on, ...expected } = want;
        expect(got, describeIntent(intent)).toEqual(expected);
      });
    });
    describe("request intent — one record, every reader agrees", () => {
      it("the old reader names answer from the same record", () => {
        const built = project("built");
        for (const [ask] of CORPUS) {
          const intent = classifyRequest(ask, built);
          expect(buildsWholeGame(built, ask)).toBe(intent.wholeGame);
          // 글만 보는 읽기는 프로젝트를 모른다: 빈 프로젝트의 기록과는 늘 같은 답이다. 지은 게임이 있는 프로젝트에서만 «…게임으로 만들어»·첫 화면 포스터 꼴이
          // 고치기로 내려간다(intent.ts reshape, #4977) — 그 하나만 글 기록(intoGame)과 달라지고, 그 밖의 요청은 지은 게임이 있어도 같은 답이다.
          expect(wantsWholeGame(ask)).toBe(classifyRequest(ask, project("blank")).scope === "wholeGame");
          const text = readRequest(ask);
          expect(wantsWholeGame(ask)).toBe(intent.scope === "wholeGame" || (text.scope === "wholeGame" && text.intoGame));
          expect(editOnlyRequest(built, ask)).toBe(intent.editOnly);
          expect(CONTINUE_WORDS.test(ask)).toBe(intent.continuation);
          // 글만 보는 읽기 함수는 글의 기록과 같다. 프로젝트를 같이 본 기록은 게임 하나를 잇는 이어 하기와 지은 것을 고치는 작은 일에 게임 도구를 더한다.
          expect(v2ExtraToolNames(ask)).toEqual([...readRequest(ask).tools.extra]);
          if (intent.wholeGame || (intent.editOnly && !intent.audio.only)) expect(intent.tools.game).toBe(true);
          else expect([...intent.tools.extra]).toEqual(v2ExtraToolNames(ask));
        }
      });

      it("a first-screen poster request is a whole game on an empty project and a change on a built one", () => {
        for (const poster of [POSTER_STORY, POSTER_STORY_LONG, POSTER_JRPG]) {
          expect(readRequest(poster)).toMatchObject({ scope: "wholeGame", intoGame: true });
          expect(classifyRequest(poster, project("blank"))).toMatchObject({ scope: "wholeGame", wholeGame: true });
          expect(classifyRequest(poster, project("built"))).toMatchObject({ scope: "edit", wholeGame: false });
        }
        // 시작 장르 줄이 없는 자유글 묘사는 여전히 첫 장소를 짓는 시작이다.
        expect(classifyRequest(startScreenPrompt({ choiceId: null, intent: "풀숲 마을" })!, project("blank")).wholeGame).toBe(false);
      });

      it("classifies once per (request, project state) and says why", () => {
        const p = project("built");
        const first = classifyRequest("계속", p);
        expect(classifyRequest("계속", p)).toBe(first);
        expect(first.why).toMatch(/carry on.*blueprint/u);
        expect(classifyRequest("계속", project("blank"))).not.toBe(first);
        expect(readRequest("엔딩까지 가는 길에 표지판 하나 세워 줘").why).toMatch(/small change/u);
      });

      it("a request that needs encounters can reach the encounter tool", () => {
        expect(v2ExtraToolNames("사냥터에서 경험치 쌓게 해 줘")).toContain("set_encounter_table");
      });

      it("a sound-only request carries only sound tools; a title with a music word carries none", () => {
        expect(v2ExtraToolNames("마을에 잔잔한 배경 음악 깔아 줘")).toContain("set_game_audio");
        expect(v2ExtraToolNames("마을에 잔잔한 배경 음악 깔아 줘")).not.toContain("upsert_event");
        expect(v2ExtraToolNames("게임 제목을 '별의 노래'로 바꿔 줘")).toContain("upsert_event");
        expect(v2ExtraToolNames("게임 제목을 '별의 노래'로 바꿔 줘")).not.toContain("store_find_music");
      });
    });
    describe("linking maps that already exist is a small job", () => {
      /** 마을(주민 하나)과 이어지지 않은 들판 — 작은 일 하네스의 starter 와 같은 모양. */
      function twoMaps(): Project {
        const p = createBlankProject() as Project;
        const village = p.maps[p.startMapId]!;
        village.name = "잿불 마을";
        village.events = [{ id: "ev_npc", name: "촌장", x: 2, y: 2, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "어서 오게." }] }] } as never];
        p.maps.map_field = { ...structuredClone(village), id: "map_field", name: "동쪽 들판", events: [] };
        return p;
      }
      const ROUND_TRIP = "잿불 마을 동쪽 끝에서 동쪽 들판으로 넘어갈 수 있게 해 줘. 들판에서 마을로 돌아오는 길도 만들어 줘";

      it("both maps named + a link word = edit with the transfer tools; the words alone still read as a place build", () => {
        // 글만 보면 «마을 … 만들어» 가 장소 짓기 낱말에 맞는다 — 프로젝트를 같이 봐야 잇기만 하는 일인 줄 안다.
        expect(readRequest(ROUND_TRIP).scope).toBe("place");
        const intent = classifyRequest(ROUND_TRIP, twoMaps());
        expect(intent).toMatchObject({ scope: "edit", editOnly: true, wholeGame: false });
        expect(intent.why).toMatch(/links maps that already exist/u);
        expect(intent.smallTools).toEqual(expect.arrayContaining(["create_transfer_pair", "list_map_locations"]));
        // 「동쪽 끝에서」의 끝은 자리다 — 엔딩 도구를 끌어오지 않는다.
        expect(intent.topics).not.toContain("ending");
        expect(intent.smallTools).not.toContain("define_ending");
      });

      it("one map missing, a new place, or a rebuild stays a place build", () => {
        // 같은 글이라도 들판이 없는 프로젝트에서는 들판을 지어야 한다(기억 열쇠가 맵 이름을 본다).
        expect(classifyRequest(ROUND_TRIP, project("event")).scope).toBe("place");
        expect(classifyRequest("잿불 마을 옆에 새 마을을 만들고 동쪽 들판과 이어 줘", twoMaps()).scope).toBe("place");
        expect(classifyRequest("잿불 마을을 더 넓혀서 동쪽 들판까지 이어지게 만들어 줘", twoMaps()).scope).toBe("place");
        // 두 맵 말고 다른 장소를 지으라는 말이 남으면 그대로다.
        expect(classifyRequest("잿불 마을과 동쪽 들판 사이에 숲길 맵을 하나 만들어서 이어 줘", twoMaps()).scope).toBe("place");
        // 잇는 낱말이 없으면 맵 이름이 둘이어도 그대로다.
        expect(classifyRequest("잿불 마을이랑 동쪽 들판에 집을 더 지어 줘", twoMaps()).scope).toBe("place");
      });

      it("«가게 해 줘» · «가게 이어 줘» is not a shop; «가게 하나» is; «끝에 가서» is still the ending", () => {
        expect(readRequest("족장의 긴 집에 뒷문을 하나 만들어 줘. 그 문으로 나가면 겨울 시장으로 가게 해 줘").topics).not.toContain("items");
        expect(readRequest("이 문을 지나면 동굴로 가게 이어 줘").topics).not.toContain("items");
        expect(readRequest("광장에 가게 하나 차려 줘").topics).toContain("items");
        expect(readRequest("끝에 가서 촌장이 고맙다고 말하게 해 줘").topics).toContain("ending");
        expect(readRequest("복도 맨 끝에 상자를 놓아 줘").topics).not.toContain("ending");
      });
    });
    describe("request word lists — one-syllable entries match as words", () => {
      it.each([
        ["썸네일 그림 하나 골라 줘", ROMANCE_SETUP_WORDS, false],
        ["썸 타는 사이인 두 사람 이야기", ROMANCE_SETUP_WORDS, true],
        ["방법을 알려 줘", INTERIOR_WORDS, false],
        ["가방을 열면 열쇠가 나오게 해 줘", INTERIOR_WORDS, false],
        ["이 문을 지나면 동굴로 가게 이어 줘", INTERIOR_WORDS, false],
        ["방 안쪽에 침대 놓아 줘", INTERIOR_WORDS, true],
        ["방탈출 게임 만들어 줘.", INTERIOR_WORDS, true],
        ["다락방을 꾸며 줘", INTERIOR_WORDS, true],
        ["건강을 회복하는 샘", TERRAIN_WORDS, false],
        ["강을 건너는 다리를 놓아 줘", TERRAIN_WORDS, true],
        ["한 방에 끝내는 필살기", ONE_ROOM_GAME, false],
        ["방 하나에서 벌어지는 이야기", ONE_ROOM_GAME, true],
        ["잠긴 방에서 나가는 게임", ONE_ROOM_GAME, true],
      ] as const)("%s", (text, words, hit) => {
        expect(words.test(text)).toBe(hit);
      });
    });
  });
  describe("aiV2RestoreEvent", () => {
    isolateTimers();
    const withEvent = (): Project => {
      const p = createBlankProject() as Project;
      const map = Object.values(p.maps)[0]!;
      map.events = [{ id: "ev_memory", name: "깨어난 손님의 기억", x: 12, y: 6, pages: [{ id: "p0", conditions: { switchId: "sw_v2scene_329777_shown" }, movement: { type: "fixed" }, commands: [{ kind: "showText", text: "a" }, { kind: "showText", text: "b" }, { kind: "showText", text: "c" }] }] } as never];
      return p;
    };
    describe("restore_event (toy-shop advisor turn 2)", () => {
      it("re-adds a deleted event exactly as it was before the request", () => {
        const before = withEvent();
        const after = structuredClone(before);
        Object.values(after.maps)[0]!.events = [];
        const r = restoreEventFromBefore(before, after, "ev_memory");
        expect(r.ok).toBe(true);
        expect(Object.values(after.maps)[0]!.events).toEqual(Object.values(before.maps)[0]!.events);
      });
      it("overwrites a rewritten event and accepts the event name", () => {
        const before = withEvent();
        const after = structuredClone(before);
        const ev = Object.values(after.maps)[0]!.events![0]! as unknown as { name?: string; pages: { conditions: unknown }[] };
        ev.name = undefined; ev.pages[0]!.conditions = { switchId: "sw_0003" };
        expect(restoreEventFromBefore(before, after, "깨어난 손님의 기억").ok).toBe(true);
        expect(Object.values(after.maps)[0]!.events).toEqual(Object.values(before.maps)[0]!.events);
      });
      it("refuses an id that did not exist before and lists what did", () => {
        const before = withEvent();
        const r = restoreEventFromBefore(before, structuredClone(before), "ev_nope");
        expect(r.ok).toBe(false);
        expect(r.summary).toContain("ev_memory");
      });
    });
  });
  // 장소 설계는 턴을 넘어 남는다(2026-11-11 B4b, openwiki/assistant-v2.md 「장소 설계는 턴을 넘어 남는다」):
  // 앞 턴이 지은 장소를 다음 턴(새 세션)의 edit_place 가 그 설계에서 고친다. 조수 밖에서 바뀐 맵은 설계를 버리고 이유와 되는 도구를 이른다.
  describe("aiV2PlaceMemory", () => {
    isolateTimers();
    const SLOW = 120_000;
    type Reply = { ok?: boolean; summary?: string; warnings?: string[]; record?: { name?: string } };
    function turn(project: Project, task: string, session = new V2Session()) {
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      const env: PiAssistantV2Env = {
        ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","place-memory"]` } as never,
        emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
      };
      const tools = createV2Tools(env, session);
      const call = async (name: string, args: unknown): Promise<Reply> => {
        const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
        return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as Reply;
      };
      /** 설계를 되돌려 보내는 장소(실내·동굴)는 몇 번 다시 부르면 기본 설계로 짓는다. */
      const make = async (spec: Record<string, unknown>): Promise<Reply> => {
        let r: Reply = {};
        for (let i = 0; i < 5 && !r.ok; i++) r = await call("make_place", { spec });
        return r;
      };
      return { ctx, session, call, make };
    }
    /** 턴 끝의 저장 → 진짜 저장본 왕복 → 다음 턴 시작의 읽기. */
    function nextTurn(prev: ReturnType<typeof turn>, task: string, change?: (project: Project) => void) {
      const memory = savePlaces(prev.session, prev.ctx.project, indexProject(prev.ctx.project));
      const project = deserialize(serialize({ ...prev.ctx.project, assistantTodo: { version: 1, task: "앞 턴", at: 1, items: [], meta: {}, ...(memory ? { memory: { places: memory } } : {}) } } as Project));
      change?.(project);
      const session = new V2Session();
      const carried = loadPlaces((project as { assistantTodo?: { memory?: { places?: PlaceMemory } } }).assistantTodo?.memory?.places, session, project, indexProject(project));
      return { ...turn(project, task, session), carried, memory };
    }
    describe("장소 설계 기억 — 다음 턴의 edit_place", () => {
      it("앞 턴이 지은 실내를 새 세션에서 그 설계로 고친다", async () => {
        const first = turn(createBlankProject(), "여관 실내 하나 지어 줘");
        expect((await first.make({ type: "interior", name: "달빛 여관", zones: [{ kind: "tavern", purpose: "손님이 먹고 마시는 홀" }, { kind: "bedroom", purpose: "손님 방" }] })).ok).toBe(true);
        const mapId = [...first.session.places.keys()][0]!;

        const second = nextTurn(first, "달빛 여관에 벽난로 하나 더 놓아 줘");
        expect(second.carried).toEqual({ restored: 1, stale: 0 });
        // 이어 받은 기록은 «이번 턴에 지은 것»이 아니다 — 끝맺음 단계·관문이 읽는 places 는 비어 있다.
        expect(second.session.places.size).toBe(0);
        expect((await second.call("inspect", { mapId })).record?.name).toBe("달빛 여관");
        const before = JSON.stringify(second.ctx.project.maps[mapId]!.upperTiles);
        const edited = await second.call("edit_place", { patch: { mapId, addAnchors: [{ what: "벽난로", zone: "tavern" }] } });
        expect(edited.ok, edited.summary).toBe(true);
        expect(JSON.stringify(second.ctx.project.maps[mapId]!.upperTiles)).not.toBe(before);
        expect((edited.warnings ?? []).join(" ")).toContain("design saved when this place was built in an earlier turn");
        // 고친 뒤에는 이번 턴 기록이고, 턴 끝에 다시 저장된다.
        expect(second.session.places.has(mapId)).toBe(true);
        expect(savePlaces(second.session, second.ctx.project, indexProject(second.ctx.project))?.places.map((p) => p.mapIds[0])).toEqual([mapId]);
      }, SLOW);

      it("조수 밖에서 바뀐 맵은 설계를 버리고, 거절 글이 이유와 되는 도구를 이른다", async () => {
        const first = turn(createBlankProject(), "여관 실내 하나 지어 줘");
        expect((await first.make({ type: "interior", name: "달빛 여관", zones: [{ kind: "tavern", purpose: "홀" }] })).ok).toBe(true);
        const mapId = [...first.session.places.keys()][0]!;
        // 사람이 그 뒤에 벽 한 칸을 손으로 바꿨다(방 구성 꼬리표도 지웠다 — 다시 지을 구성을 읽을 수 없다).
        const second = nextTurn(first, "달빛 여관을 좀 더 넓게 해 줘", (project) => {
          const map = project.maps[mapId]!;
          project.maps[mapId] = { ...map, locations: [], lowerTiles: map.lowerTiles.map((t, i) => (i === 0 ? t + 1 : t)) };
        });
        expect(second.carried).toEqual({ restored: 0, stale: 1 });
        const refused = await second.call("edit_place", { patch: { mapId, variant: 2 } });
        expect(refused.ok).toBe(false);
        expect(refused.summary).toContain("changed outside the assistant");
        expect(refused.summary).toContain("Nothing was changed");
        expect(refused.summary).toContain("move_event");
        expect(refused.summary).toContain(`spec.mapId="${mapId}"`);
      }, SLOW);

      it("구성기가 한 번에 짠 마을은 다시 짓지 않고, 그 맵에서 되는 도구를 이른다(맵은 그대로)", async () => {
        const first = turn(createBlankProject(), "사막 마을 하나 지어 줘");
        expect((await first.make({ type: "village", name: "모래 마을", style: "pool:desert_east" })).ok).toBe(true);
        const mapId = [...first.session.places.keys()][0]!;
        const second = nextTurn(first, "모래 마을의 빈 땅을 좀 채워 줘");
        expect(second.carried.restored).toBe(1);
        const before = JSON.stringify(second.ctx.project.maps[mapId]);
        const refused = await second.call("edit_place", { patch: { mapId, variant: 2 } });
        expect(refused.ok).toBe(false);
        expect(refused.summary).toContain("laid by its composer in one pass");
        expect(refused.summary).toContain("furnish_outdoor_area");
        expect(JSON.stringify(second.ctx.project.maps[mapId])).toBe(before);
        // 거절은 앞 턴 기록을 «이번 턴에 지은 것»으로 옮기지 않는다.
        expect(second.session.places.size).toBe(0);
      }, SLOW);
    });
    describe("savePlaces · loadPlaces", () => {
      const record = (mapIds: string[], ok = true) => ({ builder: "interior", spec: { type: "interior" as const, name: "방" }, rounds: 2, result: { ok, mapIds, summary: "", warnings: [], missingArt: [], calls: [], state: { tilesetId: "t", mapId: mapIds[0] } } });

      it("없는 맵·실패한 짓기는 넘기지 않고, 고치기 바퀴 수는 새로 센다", () => {
        const project = createBlankProject();
        const session = new V2Session();
        session.places.set(project.startMapId, record([project.startMapId]) as never);
        session.places.set("gone", record(["gone"]) as never);
        session.places.set("failed", record([project.startMapId], false) as never);
        const memory = savePlaces(session, project, indexProject(project));
        expect(memory?.places.map((p) => p.mapIds)).toEqual([[project.startMapId]]);
        const next = new V2Session();
        expect(loadPlaces(memory, next, project, indexProject(project))).toEqual({ restored: 1, stale: 0 });
        expect(next.placeOf(project.startMapId)?.rounds).toBe(0);
        expect(next.placeOf(project.startMapId)?.result.state).toEqual({ tilesetId: "t", mapId: project.startMapId });
      });

      it("사람을 더한 것(이벤트)은 맵이 바뀐 것으로 치지 않는다", () => {
        const project = createBlankProject();
        const session = new V2Session();
        session.places.set(project.startMapId, record([project.startMapId]) as never);
        const memory = savePlaces(session, project, indexProject(project));
        const map = project.maps[project.startMapId]!;
        const later = { ...project, maps: { ...project.maps, [map.id]: { ...map, events: [...(map.events ?? []), { ...(map.events?.[0] ?? { pages: [] }), id: "ev_new", name: "새 사람", x: 1, y: 1 }] } } } as Project;
        expect(loadPlaces(memory, new V2Session(), later, indexProject(later))).toEqual({ restored: 1, stale: 0 });
      });

      it("이어 받고 손대지 않은 장소도 다음 저장에 남는다(이번 턴에 지은 것과 함께)", () => {
        const project = createBlankProject();
        const first = new V2Session();
        first.places.set(project.startMapId, record([project.startMapId]) as never);
        const second = new V2Session();
        loadPlaces(savePlaces(first, project, indexProject(project)), second, project, indexProject(project));
        expect(second.places.size).toBe(0);
        expect(savePlaces(second, project, indexProject(project))?.places).toHaveLength(1);
      });

      it("깨진 기억은 조용히 무시한다", () => {
        const project = createBlankProject();
        expect(loadPlaces({ places: [null, 3, { builder: "x" }, { builder: "x", spec: {}, mapIds: [], prints: [] }] }, new V2Session(), project, indexProject(project))).toEqual({ restored: 0, stale: 0 });
        expect(loadPlaces("nope", new V2Session(), project, indexProject(project))).toEqual({ restored: 0, stale: 0 });
      });
    });
  });
});

// 자리 낱말은 칸의 구조와 칩셋이 적어 둔 것으로 푼다 — 이름표의 「벽」「계단」「의자」「창」 글자가 아니다.
// 2026-11-11 자리 낱말×테마 표: 「벽돌 포장」 위의 분수·노점이 벽이어서 「한쪽」이 광장 한가운데였고(스팀펑크·서울 골목), 「바닥 · 벽 밑 그늘」 위의 사물함이 벽이어서
// 「구석」이 가구 사이였다. 「나무 옆」은 「회칠 벽(나무 격자 창)」, 「문 옆」은 걸어서 지나는 성문, 「책 옆」은 설원 목책이었고, 창 없는 무덤의 벽 앞이 「창가」로 보고됐다.
describe("aiV2WhereDeclared", () => {
  isolateTimers();
  type Ctx = { project: Project };
  type Meta = { label?: string } | undefined;
  const SLOW = 60_000;
  /** 그 칩셋에서 이름표가 맞는 첫 타일(pass 를 주면 걸을 수 있는지도 맞는 것). */
  function tileOf(project: Project, tilesetId: string, label: RegExp, pass?: boolean): number {
    const tileset = project.tilesets[tilesetId]!;
    const tile = (tileset.tileMeta as unknown as Meta[]).findIndex((m, t) => !!m?.label && label.test(m.label) && (pass === undefined || Object.values(tileset.passability[t] ?? {}).some(Boolean) === pass));
    expect(tile, `${tilesetId} ${label}`).toBeGreaterThanOrEqual(0);
    return tile;
  }
  /** 빈 맵 한 장에 윗층 타일을 놓는다 — [x, y, 타일]. */
  function mapWith(tilesetId: string, upper: readonly (readonly [number, number, number])[], make: (project: Project) => readonly (readonly [number, number, number])[] = () => upper): { project: Project; map: GameMap } {
    const ctx: Ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_t", name: "시험", width: 12, height: 8, tilesetId }).ok).toBe(true);
    const map = structuredClone(ctx.project.maps.map_t!);
    for (const [x, y, tile] of make(ctx.project)) (map.upperTiles as number[])[y * map.width + x] = tile;
    return { project: { ...ctx.project, maps: { ...ctx.project.maps, map_t: map } } as Project, map };
  }
  /** 세계 표의 장소 한 곳을 실제 빌더로 짓고, 들어오는 칸을 시작으로 둔다. */
  function place(worldId: string, kindId: string): { project: Project; map: GameMap } {
    const world = WORLDS.find((w) => w.id === worldId)!;
    const kind = world.kinds.find((k) => k.id === kindId)!;
    const ctx: Ctx = { project: createBlankProject() };
    const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
    const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
    const built = builderFor(spec)!.build(run, spec);
    expect(built.ok, built.summary).toBe(true);
    const mapId = built.entrance?.mapId ?? built.mapIds[0]!;
    const map = ctx.project.maps[mapId]!;
    let start = built.entrance && isPassable(ctx.project, map, built.entrance.x, built.entrance.y) ? { x: built.entrance.x, y: built.entrance.y } : undefined;
    for (let y = map.height - 1; y >= 0 && !start; y--) for (let x = 0; x < map.width && !start; x++) if (isPassable(ctx.project, map, x, y)) start = { x, y };
    const project = { ...ctx.project, startMapId: mapId, startPos: start } as Project;
    return { project, map: project.maps[mapId]! };
  }
  const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  describe("stairs, seats and windows are read from what the chipset wrote down", () => {
    it("a trapezoid roof is not a ladder, a tram shelter is not a bench", () => {
      const { project, map } = mapWith("steampunk_city", [], (p) => [
        [2, 2, tileOf(p, "steampunk_city", /^전차 정류장 지붕/u)], [4, 2, tileOf(p, "steampunk_city", /^둥근 걸상/u)], [6, 2, tileOf(p, "steampunk_city", /^오르는 나무 계단/u)],
      ]);
      const marks = placeMarks(project, map);
      expect(marks.seats[2 * map.width + 2]).toBe(0); // 「전차 정류장 지붕(무쇠 기둥 + 녹청 철판 지붕 + 벤치)」
      expect(marks.seats[2 * map.width + 4]).toBe(1);
      expect(marks.stairs[2 * map.width + 6]).toBe(1);
      const sf = mapWith("sf_station", [], (p) => [[2, 2, tileOf(p, "sf_station", /^에어록 모듈\(사다리꼴/u)]]);
      expect(placeMarks(sf.project, sf.map).stairs[2 * sf.map.width + 2]).toBe(0);
    });

    it("a window is a hung window — not a spear rack tagged 「창」, not a service counter, and the stained glass counts", () => {
      const edo = mapWith("sengoku_edo", [], (p) => [[2, 2, tileOf(p, "sengoku_edo", /^목검·창 걸이/u)], [4, 2, tileOf(p, "sengoku_edo", /^장지 창/u)]]);
      const edoMarks = placeMarks(edo.project, edo.map);
      expect(edoMarks.windows[2 * edo.map.width + 2]).toBe(0);
      expect(edoMarks.windows[2 * edo.map.width + 4]).toBe(1);
      const home = mapWith("atlas_biome_interior", [], (p) => {
        const spec = roomSpecOf(p.tilesets.atlas_biome_interior)!;
        // 「커튼 창」 · 「큰 색유리창(2칸)」(이름표는 한 낱말 — 키트의 이름 tall stained window 로 읽는다) · 「길드 접수 창구」
        return [[2, 2, spec.objects["curtained window"]!.cells[0]![2]!], [4, 2, spec.objects["tall stained window"]!.cells[0]![2]!], [6, 2, spec.objects["guild counter"]!.cells[0]![2]!]];
      });
      const marks = placeMarks(home.project, home.map);
      expect([marks.windows[2 * home.map.width + 2], marks.windows[2 * home.map.width + 4], marks.windows[2 * home.map.width + 6]]).toEqual([1, 1, 0]);
    });
  });
  describe("a wall is blocked ground or a building — furniture standing on walkable floor is not", () => {
    /** 벽면 테두리 안에 「… 바닥 · 벽 밑 그늘」 바닥 — 이름표에 「벽」 이 든 바닥 위에 사물함을 놓는다. */
    function room(lockers: readonly (readonly [number, number])[]): { project: Project; map: GameMap } {
      const ctx: Ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_r", name: "방", width: 10, height: 10, tilesetId: "modern_campus" }).ok).toBe(true);
      const floor = tileOf(ctx.project, "modern_campus", /바닥 · 벽 밑 그늘$/u, true), wall = tileOf(ctx.project, "modern_campus", /벽면 아랫줄$/u, false), locker = tileOf(ctx.project, "modern_campus", /사물함/u, false);
      const map = structuredClone(ctx.project.maps.map_r!);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
        (map.lowerTiles as number[])[y * 10 + x] = x === 0 || y === 0 || x === 9 || y === 9 ? wall : floor;
        (map.upperTiles as number[])[y * 10 + x] = -1;
      }
      for (const [x, y] of lockers) (map.upperTiles as number[])[y * 10 + x] = locker;
      const project = { ...ctx.project, maps: { ...ctx.project.maps, map_r: map }, startMapId: "map_r", startPos: { x: 2, y: 7 } } as Project;
      return { project, map: project.maps.map_r! };
    }

    it("the corner is the room's corner, not the nook of an L of lockers", () => {
      const { project, map } = room([[4, 4], [5, 4], [4, 5]]);
      expect(groundBlocks(project, map, { x: 4, y: 4 })).toBe(false);
      expect(groundBlocks(project, map, { x: 0, y: 3 })).toBe(true);
      // 전에는 (5,5) — 서쪽·북쪽이 사물함이라 「구석」 이었다.
      const corner = resolveWhere(project, map, "구석").cell;
      expect([1, 8]).toContain(corner.x);
      expect([1, 8]).toContain(corner.y);
      for (const word of ["한쪽", "북쪽 벽", "서쪽 벽"]) {
        const c = resolveWhere(project, map, word).cell;
        expect(c.x === 1 || c.x === 8 || c.y === 1 || c.y === 8, `${word} (${c.x},${c.y})`).toBe(true);
      }
    });

    it("a person on the only cell in front of a locker blocks it — the shaded floor under it does not make it a wall picture", () => {
      const { project, map } = room([[3, 1], [4, 1], [5, 1]]);
      expect(personSpotCost(project, map, { x: 4, y: 2 }, personSpotContext(project, map))).toBeGreaterThanOrEqual(6);
    });

    it("on a brick-paved street 「한쪽」 stands by a building, not by a market stall in the square", () => {
      const { project, map } = place("steampunk_city", "street");
      const marks = placeMarks(project, map);
      for (const word of ["한쪽", "구석", "서쪽 벽"]) {
        const found = resolveWhere(project, map, word);
        if (found.fallback) continue;
        const c = found.cell;
        const walls = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ x: c.x + dx!, y: c.y + dy! }))
          .filter((n) => n.x >= 0 && n.y >= 0 && n.x < map.width && n.y < map.height && !isPassable(project, map, n.x, n.y))
          .filter((n) => !objectAt(map, n) || groundBlocks(project, map, n) || !!marks.buildings[n.y * map.width + n.x]);
        expect(walls.length, `${word} (${c.x},${c.y}) ${found.how}`).toBeGreaterThan(0);
        // 드나드는 문 앞과 맵 가장자리 칸에는 서지 않는다.
        expect(declaredDoorCells(project, map).some((d) => d.x === c.x && (c.y === d.y + 1 || c.y === d.y + 2)), `${word} doorway`).toBe(false);
        expect(c.x === 0 || c.y === 0 || c.x === map.width - 1 || c.y === map.height - 1, `${word} edge`).toBe(false);
      }
      expect(resolveWhere(project, map, "한쪽").fallback).toBeUndefined();
    }, SLOW);
  });
  describe("「X 옆」 finds the thing by its name as a whole word, or by what the chipset declares", () => {
    it("「나무 옆」 is not the lattice window made of wood, 「책 옆」 is not the palisade", () => {
      const tea = place("desert_east", "teahouse");
      const tree = resolveWhere(tea.project, tea.map, "나무 옆");
      expect(tree.fallback).toBe(true);
      expect(tree.how).not.toContain("회칠 벽");
      const snow = place("snow_north", "village");
      expect(resolveWhere(snow.project, snow.map, "책 옆").how ?? "").not.toContain("목책");
    }, SLOW);

    it("「문 옆」 is beside a building's door, off the cells people walk through; 「길 옆」 is the roadside", () => {
      const { project, map } = place("desert_east", "bazaar");
      const doors = declaredDoorCells(project, map);
      expect(doors.length).toBeGreaterThan(0);
      const door = resolveWhere(project, map, "문 옆");
      expect(door.fallback).toBeUndefined();
      expect(door.how).not.toContain("문루"); // 전에는 「둥근 지붕 회당(큰 돔·아치 문루)」
      // 바자르의 문은 길로 바로 열린다 — 벽 밑 길 칸(문 앞의 옆)에 서고, 집 사이 틈(문에서 세 칸)으로 밀려나지 않는다.
      expect(Math.min(...doors.map((d) => cheb(d, door.cell)))).toBeLessThanOrEqual(1);
      expect(doors.some((d) => d.x === door.cell.x && door.cell.y === d.y + 1)).toBe(false);

      const roads = roadCells(project, map);
      for (const word of ["길 옆", "동굴 입구로 가는 길 옆"]) {
        const c = resolveWhere(project, map, word);
        expect(c.fallback, word).toBeUndefined();
        expect(roads.has(c.cell.y * map.width + c.cell.x), `${word} on the road`).toBe(false);
        expect([[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => roads.has((c.cell.y + dy!) * map.width + c.cell.x + dx!)), `${word} beside a road`).toBe(true);
      }
    }, SLOW);
  });
  describe("「창가」 is by a window, and says so when the map has none", () => {
    it("stands next to the teahouse's lattice window — the cell right under it holds a divan", () => {
      const { project, map } = place("desert_east", "teahouse");
      const marks = placeMarks(project, map);
      const found = resolveWhere(project, map, "창가");
      expect(found.fallback).toBeUndefined();
      expect(found.how).toContain("창가");
      let near = false;
      for (let dy = 0; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) if (marks.windows[(found.cell.y - dy) * map.width + found.cell.x + dx]) near = true;
      expect(near).toBe(true);
    }, SLOW);

    it("in a tomb with no window it goes to a wall and reports that — not 「창가」", () => {
      const { project, map } = place("desert_east", "tomb");
      const found = resolveWhere(project, map, "창가");
      expect(found.fallback).toBe(true);
      expect(found.how).not.toContain("창가");
      expect(found.note).toContain("No window");
    }, SLOW);
  });
  describe("clearing the cell in front of a person removes a seat, never a shelter that has a bench in its description", () => {
    const npc = (x: number, y: number): GameEvent => ({
      id: "ev_npc", name: "단서를 아는 사람", x, y, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "ev_npc_p0", name: "", conditions: [], graphic: { sprite: { id: "tex_x", frame: 0 } }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "…" }] }],
    }) as unknown as GameEvent;
    function blocked(label: RegExp): { run: BuildRun; before: number } {
      const { project, map } = mapWith("steampunk_city", [], (p) => [[4, 4, tileOf(p, "steampunk_city", label, false)]]);
      const ground = tileOf(project, "steampunk_city", /^판석 보도/u, true);
      const laid = structuredClone(map);
      for (let i = 0; i < laid.width * laid.height; i++) (laid.lowerTiles as number[])[i] = ground;
      laid.events = [npc(4, 3)];
      const ctx: Ctx = { project: { ...project, maps: { ...project.maps, map_t: laid }, startMapId: "map_t", startPos: { x: 1, y: 6 } } as Project };
      return { run: { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun, before: laid.upperTiles[4 * laid.width + 4]! };
    }

    it("moves the stool away", () => {
      const { run } = blocked(/^둥근 걸상/u);
      expect(clearTargetFronts(run, "map_t").length).toBeGreaterThan(0);
      expect(isPassable(run.ctx.project, run.ctx.project.maps.map_t!, 4, 4)).toBe(true);
    });

    it("leaves the tram shelter", () => {
      const { run, before } = blocked(/^전차 정류장 지붕/u);
      expect(clearTargetFronts(run, "map_t")).toEqual([]);
      expect(run.ctx.project.maps.map_t!.upperTiles[4 * 12 + 4]).toBe(before);
    });
  });
});
