// 작은 일의 지시문·도구 예산 — 요청 한 줄에 실리는 지시문 글자 수와 처음 싣는 도구 수를 못박는다(모델 없음).
// 2026-11-11 구조 재점검: 「이 맵에 상점 주인 한 명 세워 줘」에 지시문 63,679자·도구 43개(97,272자)가 실렸다. 이제 그 일이 쓰는 카드·도구만 싣는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { V2_CORE_PROMPT } from "@/ai/v2/prompt/core";
import { GAME_CARD, gameCard } from "@/ai/v2/prompt/gameCard";
import { classifyRequest } from "@/ai/v2/request/intent";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";

type State = "blank" | "oneEvent";
function project(state: State): Project {
  const p = createBlankProject() as Project;
  if (state === "oneEvent") {
    const map = p.maps[p.startMapId]!;
    map.events = [...(map.events ?? []), { id: "ev_npc", name: "촌장", x: 2, y: 2, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "어서 오게." }] }] } as never];
  }
  return p;
}
function shoot(task: string, state: State) {
  const p = project(state);
  const env = { ctx: { project: p, currentMapId: p.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project: p, projectKey: "golden-key" },
    emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as never;
  const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
  const sys = buildV2SystemPrompt(p, p.startMapId, task, undefined, "golden-key");
  const toolChars = exposure.tools.reduce((n, t) => n + JSON.stringify({ n: t.name, d: t.description, p: t.parameters }).length, 0);
  return { text: sys.join("\n"), chars: sys.reduce((n, block) => n + block.length, 0), upFront: exposure.tools.map((t) => t.name), toolChars, lazy: exposure.lazy };
}

/** 작은 일 — [요청, 지시문 글자 상한]. 처음 싣는 도구는 모두 20개·40,000자 안. */
const SMALL_JOBS: readonly (readonly [string, number])[] = [
  ["이 맵에 상점 주인 한 명 세워 줘.", 15_000],
  ["이 NPC를 두 칸 왼쪽으로 옮겨 줘", 12_000],
  ["저 상자를 방 안쪽으로 옮겨 줘", 12_000],
  ["촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘", 15_000],
  ["여기 보물상자 하나 놓고 포션 3개 넣어 줘", 15_000],
  ["촌장한테 말 걸면 열쇠를 받게 해 줘", 15_000],
  ["슬라임 세 마리와 싸우는 전투 하나 넣어 줘", 15_000],
  ["게임 제목을 '별의 노래'로 바꿔 줘", 15_000],
  // 게임 낱말이 없는 작은 일도 게임 카드의 늘 싣는 줄(2,617자)을 받는다 — 이벤트 찾기·옮기기 도구와 함께(12,292자).
  ["광장 빈 곳에 나무랑 벤치 좀 놓아 줘", 13_000],
  ["이 게임 뭐가 부족한지 알려 줘", 12_000],
];
/** 작은 일에는 처음부터 싣지 않는 도구(필요할 때 싣는다). */
const HEAVY = ["write_blueprint", "build_blueprint_path", "make_place", "edit_place", "review_layout", "set_opening", "edit_opening", "author_opening_stage", "create_opening_animatic_shot"];

describe("small jobs get a small prompt and a short tool list", () => {
  for (const state of ["blank", "oneEvent"] as const) {
    it.each(SMALL_JOBS.map(([task, max]) => [task, max] as const))(`${state} | %s ≤ %d chars`, (task, max) => {
      const shot = shoot(task, state);
      expect(shot.chars).toBeLessThanOrEqual(max);
      // load_tools 포함 19개 — 실행기가 더하는 todo 한 자리까지 20개.
      expect(shot.upFront.length).toBeLessThanOrEqual(19);
      expect(shot.toolChars).toBeLessThanOrEqual(40_000);
      expect(shot.upFront[0]).not.toBe("write_blueprint");
      for (const name of HEAVY) expect(shot.upFront).not.toContain(name);
      expect(shot.upFront).toContain("load_tools");
      expect(shot.text).not.toContain("[Interior catalog —");
      // 그 요청이 말한 주제의 줄만 — 게임 하나에는 16줄이 다 실린다.
      expect(shot.text.split("\n").filter((line) => line.startsWith("  · ")).length).toBeLessThanOrEqual(2);
    });
  }

  it("keeps the heavy tools loadable by name", () => {
    const shot = shoot("이 맵에 상점 주인 한 명 세워 줘.", "oneEvent");
    for (const name of ["write_blueprint", "make_place", "edit_place", "upsert_event"]) expect(shot.lazy.has(name)).toBe(true);
  });

  it("gives each job the tools it names", () => {
    expect(shoot("이 NPC를 두 칸 왼쪽으로 옮겨 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["move_event", "find_events"]));
    expect(shoot("이 맵에 상점 주인 한 명 세워 줘.", "blank").upFront).toEqual(expect.arrayContaining(["add_people", "set_shop_stock", "list_npc_graphics"]));
    expect(shoot("촌장한테 말 걸면 열쇠를 받게 해 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["upsert_event", "patch_event_page", "run_scene_test"]));
    expect(shoot("여기 보물상자 하나 놓고 포션 3개 넣어 줘", "oneEvent").upFront).toContain("place_chest");
    // 줍는 물건도 같은 도구다(look:"item") — 그림을 그리게 하거나 투명 이벤트로 흉내 내지 않게 처음부터 싣는다.
    expect(shoot("여기 바닥에 낡은 열쇠가 떨어져 있게 해 줘. 조사하면 주워 가게 해 줘", "oneEvent").upFront).toContain("place_chest");
    expect(shoot("슬라임 세 마리와 싸우는 전투 하나 넣어 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["upsert_troop", "simulate_battle"]));
  });

  it("a snowfield with no «빈 곳» word still gets the filling tools; a wandering foe keeps its tool under the size cap", () => {
    expect(shoot("눈보라 마을 왼쪽 아래 빈 눈밭에 나무랑 바위를 좀 놓아 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["find_empty_ground", "furnish_outdoor_area"]));
    const foe = shoot("얼어붙은 호수에 돌아다니는 적을 하나 놓아 줘. 부딪히면 전투가 시작되게 해 줘", "oneEvent");
    expect(foe.upFront).toEqual(expect.arrayContaining(["place_field_enemy", "upsert_event"]));
    expect(foe.toolChars).toBeLessThanOrEqual(40_000);
  });

  it("dress words bring the outdoor filling tools and their card", () => {
    const shot = shoot("마을이 좀 허전해. 꾸며 줘", "oneEvent");
    expect(shot.upFront).toEqual(expect.arrayContaining(["find_empty_ground", "furnish_outdoor_area", "stamp_object"]));
    expect(shot.text).toContain("[Filling empty outdoor ground]");
  });

  it("on an empty project a bare description starts a first place; a clear small job stays small", () => {
    expect(classifyRequest("폐업 직전 태엽 장난감 가게", project("blank"))).toMatchObject({ scope: "place", editOnly: false });
    expect(classifyRequest("폐업 직전 태엽 장난감 가게", project("oneEvent"))).toMatchObject({ scope: "edit", editOnly: true });
    expect(classifyRequest("이 맵에 상점 주인 한 명 세워 줘.", project("blank"))).toMatchObject({ scope: "edit", editOnly: true });
    // 빈 프로젝트의 「계속」은 고칠 것이 없다 — 짓는 카드·도구를 그대로 싣는다.
    expect(classifyRequest("계속", project("blank"))).toMatchObject({ scope: "continue", editOnly: false });
    expect(classifyRequest("계속", project("oneEvent"))).toMatchObject({ scope: "continue", editOnly: true });
  });

  it("leaves out what small jobs never called and loads what they had to fetch (Terra small jobs, 2026-11-11)", () => {
    const keeper = shoot("이 맵에 상점 주인 한 명 세워 줘.", "oneEvent").upFront;
    for (const name of ["restore_event", "place_object", "remove_event", "move_object", "declare_story_flag"]) expect(keeper).not.toContain(name);
    expect(shoot("촌장 옆에 있는 경비병을 지워 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["remove_event", "restore_event", "move_object"]));
    expect(shoot("여기 보물상자 하나 놓고 포션 3개 넣어 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["find_empty_ground", "get_database_records"]));
    expect(shoot("촌장한테 말 걸면 열쇠를 받게 해 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["upsert_item", "get_database_records"]));
    // 게임 제목은 프로젝트 설정에 있다 — 제목을 말한 요청에만 싣는다.
    expect(shoot("게임 제목을 '별의 노래'로 바꿔 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["set_title_screen", "set_project_settings"]));
    expect(keeper).not.toContain("set_project_settings");
    // 「주워 가게 해 줘」의 「가게」는 상점이 아니다.
    expect(shoot("족장의 긴 집 바닥에 낡은 열쇠가 떨어져 있게 해 줘. 조사하면 주워 가게 해 줘", "oneEvent").upFront).not.toContain("set_shop_stock");
    expect(shoot("광장에 가게 하나 차려서 포션을 사게 해 줘", "oneEvent").upFront).toContain("set_shop_stock");
    // 물어야 풀리는 일(「내 이름」)의 ask_user 와 말한 음악의 도구는 글자 상한에 밀리지 않는다.
    expect(shoot("엔딩 크레딧 음악 넣고 크레딧에 내 이름도 넣어 줘", "oneEvent").upFront).toEqual(expect.arrayContaining(["ask_user", "store_find_music", "set_game_audio"]));
  });

  it("a small job with no game word still finds and moves events; a place build and a sound-only job are unchanged", () => {
    // 전에는 도구 6개(inspect·add_event·add_people·read_specs·ask_user·load_tools)뿐이었다 — 이벤트 찾기·옮기기 도구가 만들어지지도 않았다.
    const line = shoot('촌장이 "배경 음악이 참 좋지?"라고 말하게 해 줘', "oneEvent");
    expect(line.upFront).toEqual(expect.arrayContaining(["find_events", "get_event", "patch_event_page", "move_event", "upsert_event"]));
    for (const ask of ["계속", "썸네일 그림 하나 골라 줘", "광장 빈 곳에 나무랑 벤치 좀 놓아 줘"]) {
      const shot = shoot(ask, "oneEvent");
      expect(shot.upFront, ask).toEqual(expect.arrayContaining(["find_events", "move_event"]));
      expect(shot.lazy.has("remove_event"), ask).toBe(true);
      expect(shot.upFront.length, ask).toBeLessThanOrEqual(19);
    }
    expect(classifyRequest("계속", project("oneEvent")).tools.game).toBe(true);
    // 장소를 짓는 요청·빈 프로젝트의 «계속»·소리만 바라는 요청은 그대로다.
    expect(classifyRequest("작은 마을 하나 만들어 줘", project("oneEvent")).tools.game).toBe(false);
    expect(classifyRequest("계속", project("blank")).tools.game).toBe(false);
    // 소리만 바라는 요청은 소리 묶음만 싣는다(«음악» 이 게임 낱말이어도 이벤트 도구를 내놓지 않는다).
    const music = shoot("마을에 잔잔한 배경 음악 깔아 줘", "oneEvent");
    expect(music.upFront).not.toContain("move_event");
    expect(music.lazy.has("move_event")).toBe(false);
  });

  it("carries the people card for a new person and no event card for a bare move", () => {
    expect(shoot("이 맵에 상점 주인 한 명 세워 줘.", "blank").text).toContain("People spec:");
    const move = shoot("이 NPC를 두 칸 왼쪽으로 옮겨 줘", "oneEvent").text;
    expect(move).not.toContain("Events spec:");
    expect(move).not.toContain("People spec:");
  });
});

describe("place and whole-game requests", () => {
  it("an interior request carries the interior catalog; a village request does not", () => {
    expect(shoot("여관 1층 하나 지어 줘", "blank").text).toContain("[Interior catalog —");
    expect(shoot("작은 마을 하나 만들어 줘", "blank").text).not.toContain("[Interior catalog —");
    expect(shoot("이 맵에 상점 주인 한 명 세워 줘.", "blank").text).not.toContain("[Fallen-Star-style jobs");
  });

  // 2026-11-12: 실내 이야기 기물 8종(#4677)으로 방탈출 지시문이 67,493자가 됐다 — 상한을 올리지 않고 목록에서 «크기 표의 구운 크기» 52줄을 뺐다(66,610자).
  it("a whole-game prompt does not grow (main 2026-11-11 after #4556: 35,491 · 67,349 chars; 2026-11-12: 66,610)", () => {
    const fantasy = shoot("판타지 RPG 게임 하나 만들어 줘.", "blank");
    expect(fantasy.chars).toBeLessThanOrEqual(35_491);
    expect(fantasy.text).toContain("[Fallen-Star-style jobs");
    expect(fantasy.upFront).toContain("write_blueprint");
    const escape = shoot("방탈출 게임 만들어 줘.", "blank");
    expect(escape.chars).toBeLessThanOrEqual(66_700);
    // 크기 표는 한 줄이 말한다 — 놓는 법 글자가 붙고, 구운 크기(dining 2x1 2x1 f)는 목록에 다시 실리지 않는다.
    expect(escape.text).toMatch(/sized tables [^\n]*: dining f, [^\n]*sideboard\(1 row\) w\^1/u);
    expect(escape.text).not.toContain("dining 2x1 2x1");
  });

  it("a place request gets only the game-card lines its words name", () => {
    const inn = shoot("여관 1층 하나 지어 줘", "blank").text;
    expect(inn).toContain("[Game elements");
    expect(inn).not.toContain("[Fallen-Star-style jobs");
  });
});

describe("instructions agree with each other and with the tools", () => {
  it("coordinates come from a tool result, never a guess — and move_event needs none", () => {
    expect(V2_CORE_PROMPT).toContain("gets only cells a tool or the critic gave you");
    expect(V2_CORE_PROMPT).not.toContain("pass only coordinates the critic gave you");
    expect(GAME_CARD).toContain("move_event{eventId, dx,dy | where}");
  });
  it("a missing object is drawn first; the nearest existing object is the fallback, said in the report", () => {
    expect(V2_CORE_PROMPT).toContain("Do not quietly swap in a similar object");
    expect(GAME_CARD).toContain("draw_object first (core rule)");
    expect(GAME_CARD).not.toContain("do not stop at a draw_object card");
  });
  it("new NPCs are stood with add_people, not the hidden place_npc", () => {
    expect(GAME_CARD).not.toContain("place_npc");
    expect(GAME_CARD).toContain("add_people (a new NPC)");
  });
  it("the topic card is a subset of the full card", () => {
    const full = new Set(GAME_CARD.split("\n"));
    for (const line of gameCard(["items", "battle", "snow"]).split("\n")) expect(full.has(line)).toBe(true);
    expect(gameCard([]).length).toBeLessThan(3_000);
  });
});
