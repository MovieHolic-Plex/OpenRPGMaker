// 요청 분류 말뭉치 — 실제로 들어올 만한 요청 한 줄마다 «범위와 그 요청이 가르는 결정» 을 못박는다(모델 없음).
// 2026-11-11 구조 재점검에서 잘못 갈린 문장(제목 속 「노래」, 「엔딩까지 가는 길」, 「독서실」의 독, 「썸네일」의 썸 …)이 모두 여기 있다.
// 낱말 규칙을 고칠 때는 여기에 줄을 더하고, 기대가 바뀌는 줄은 PR 에서 하나씩 설명한다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import type { Project } from "@/project/types";
import { classifyRequest, describeIntent, readRequest, type RequestIntent, type RequestScope } from "@/ai/v2/request/intent";
import { CONTINUE_WORDS, buildsWholeGame, editOnlyRequest, v2ExtraToolNames, wantsWholeGame } from "@/ai/v2/request/readers";
import { ROMANCE_SETUP_WORDS } from "@/ai/v2/request/genre";
import { INTERIOR_WORDS, TERRAIN_WORDS } from "@/ai/v2/request/place";
import { ONE_ROOM_GAME } from "@/ai/v2/request/scope";

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
  ["독서실 실내 하나 지어 줘", { scope: "place", game: false }],
  ["썸네일 그림 하나 골라 줘", { scope: "edit", game: false }],
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
      expect(wantsWholeGame(ask)).toBe(intent.scope === "wholeGame");
      expect(editOnlyRequest(built, ask)).toBe(intent.editOnly);
      expect(CONTINUE_WORDS.test(ask)).toBe(intent.continuation);
      expect(v2ExtraToolNames(ask)).toEqual([...intent.tools.extra]);
    }
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
