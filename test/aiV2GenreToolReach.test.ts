// JRPG 가 아닌 게임의 장치 — 작은 일 셋째 묶음 36건이 작은 일로 갈리고, 그 장치를 짓는 도구가 처음부터 실린다(모델 없음).
// 2026-11-11 출발점: 손 풀이 도구가 처음부터 다 실린 일 8 · v2 어디에도 없는 도구가 든 일 14 · 작은 일로 안 갈린 요청 3 (openwiki/assistant-v2-genre-tools.md).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isMonsterRequestTurn } from "@/ai/piAgent/monsterGameRequest";
import { classifyRequest } from "@/ai/v2/request/intent";
import { v2ToolPool } from "@/ai/v2/request/toolGroups";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { V2_TOOL_EN } from "@/ai/v2/tools/toolTextEn";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";

interface Job { readonly id: string; readonly fixture: FixtureId; readonly request: string; readonly reference?: readonly { readonly tool: string }[] }
const SET_3 = (JSON.parse(readFileSync("harness-data/assistant-capability/small-jobs-3.json", "utf8")) as { jobs: Job[] }).jobs;

function offer(fixture: FixtureId, task: string) {
  const project = buildFixture(fixture);
  // 몬스터 수집 도구는 그 요청 턴에만 보인다(역방향 장르 잠금) — 실제 세션과 같은 신호를 준다.
  const env = {
    ctx: { project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: isMonsterRequestTurn(task) }, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: "genre-tool-reach" },
    emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => 0,
  } as never;
  const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
  return { intent: classifyRequest(task, project), upFront: exposure.tools.map((t) => t.name), lazy: exposure.lazy };
}

const GENRE_TOOLS = ["place_trap", "lock_door", "place_storage_chest", "create_farm_plot", "define_crop", "upsert_fish_species", "configure_fishing", "set_deadline_ending",
  "set_dialogue_system", "set_action_combat", "make_action_enemy", "configure_monster_system", "give_starter_monsters", "place_trainer", "manage_flag_slot",
  // 이벤트 명령을 손으로 조립하던 장치의 좁은 도구 넷(src/editor/tools/genreDeviceTools.ts).
  "set_npc_affection", "set_present_reactions", "set_time_limit", "add_hud_gauge"] as const;

describe("장치 도구 — 풀에 있고 영어 글이 있다", () => {
  it("v2 풀에 든다", () => {
    expect(GENRE_TOOLS.filter((name) => !v2ToolPool().includes(name))).toEqual([]);
  });
  it("영어 사본이 있고 한글이 없다(게임에 넣을 예시 낱말 제외)", () => {
    expect(GENRE_TOOLS.filter((name) => !V2_TOOL_EN[name]?.d)).toEqual([]);
    expect(GENRE_TOOLS.filter((name) => /[가-힣]/u.test(`${V2_TOOL_EN[name]!.d}${Object.values(V2_TOOL_EN[name]!.p ?? {}).join("")}`))).toEqual([]);
  });
});

describe("셋째 묶음 36건 — 작은 일로 갈리고 도구가 20개 안이다", () => {
  it.each(SET_3.map((job) => [job.id, job] as const))("%s", (_id, job) => {
    const { intent, upFront } = offer(job.fixture, job.request);
    expect(intent.scope).toBe("edit");
    expect(intent.wholeGame).toBe(false);
    // load_tools 포함 19개 — 실행기가 더하는 todo 한 자리까지 20개.
    expect(upFront.length).toBeLessThanOrEqual(19);
  }, 60_000);
});

describe("그 장치를 짓는 도구를 처음부터 싣는다", () => {
  /** [일, 처음부터 실려 있어야 하는 도구]. */
  const DOING: readonly (readonly [string, readonly string[]])[] = [
    ["trap-checkpoint-starter", ["place_trap"]],
    ["lock-door-key-built", ["lock_door"]],
    ["storage-chest-starter", ["place_storage_chest"]],
    ["farm-plot-starter", ["create_farm_plot"]],
    ["crop-turnip-starter", ["define_crop", "upsert_item"]],
    ["fishing-built", ["configure_fishing", "upsert_fish_species", "upsert_item"]],
    ["craft-station-starter", ["upsert_craft_recipe"]],
    ["sell-price-built", ["set_sell_prices"]],
    ["deadline-ending-starter", ["set_deadline_ending"]],
    ["npc-night-schedule-starter", ["set_npc_schedule", "configure_time_system"]],
    ["backlog-on-built", ["set_dialogue_system"]],
    ["action-map-starter", ["set_action_combat"]],
    ["action-slimes-starter", ["make_action_enemy", "set_action_combat"]],
    ["capture-on-blank", ["configure_monster_system"]],
    ["trainer-sight-blank", ["place_trainer"]],
    ["hunger-hud-starter", ["add_hud_gauge", "manage_flag_slot"]],
    ["evidence-present-starter", ["set_present_reactions"]],
    ["affection-grows-starter", ["set_npc_affection"]],
    ["gift-affection-starter", ["set_npc_affection"]],
    ["confess-ending-starter", ["set_npc_affection"]],
    ["affection-two-pages-built", ["set_npc_affection"]],
    ["time-limit-starter", ["set_time_limit"]],
    ["hiding-spot-starter", ["configure_object_behavior"]],
    ["push-rock-starter", ["configure_object_behavior"]],
    ["chaser-starter", ["make_chase_scene"]],
    ["chase-after-key-starter", ["make_chase_scene"]],
    ["life-petals-starter", ["set_life_flower"]],
    ["password-safe-starter", ["compile_puzzle"]],
  ];
  it.each(DOING)("%s", (id, names) => {
    const job = SET_3.find((entry) => entry.id === id)!;
    expect(offer(job.fixture, job.request).upFront).toEqual(expect.arrayContaining([...names]));
  }, 60_000);

  it("몬스터 수집 요청이 아닌 턴에는 몬스터 전용 도구가 보이지 않는다(역방향 장르 잠금은 그대로다)", () => {
    const job = SET_3.find((entry) => entry.id === "starter-pick-blank")!;
    expect(isMonsterRequestTurn(job.request)).toBe(false);
    const { upFront, lazy } = offer(job.fixture, job.request);
    expect(upFront.includes("give_starter_monsters") || lazy.has("give_starter_monsters")).toBe(false);
  }, 60_000);
});

describe("장치 하나를 있는 맵에 더하는 요청은 장소 짓기·게임 하나가 아니다", () => {
  const starter = buildFixture("starter"), blank = buildFixture("blank");
  it("장소 낱말이 «어디에» 로만 나오고 장치 낱말이 있으면 작은 일이다", () => {
    expect(classifyRequest("마을 빈 땅에 밭을 6칸 만들어 줘. 괭이로 갈아서 씨앗을 심을 수 있게 해 줘", starter)).toMatchObject({ scope: "edit", editOnly: true });
    expect(classifyRequest("동쪽 들판을 실시간 액션 전투 맵으로 만들고, 덤벼드는 슬라임을 두 마리 풀어 줘", starter)).toMatchObject({ scope: "edit", editOnly: true });
    expect(classifyRequest("들판을 액션 전투 맵으로 바꿔 줘", starter).scope).toBe("edit");
  });
  it("지을 것이 장소면 장소 짓기 그대로다 — 장치 낱말이 있어도", () => {
    expect(classifyRequest("마을 옆에 농장 맵을 하나 만들고 밭도 만들어 줘", starter).scope).toBe("place");
    expect(classifyRequest("마을에 낚시터가 있는 호숫가 맵을 새로 지어 줘", starter).scope).toBe("place");
    expect(classifyRequest("함정이 가득한 동굴을 하나 만들어 줘", starter).scope).toBe("place");
  });
  it("장치 낱말이 없으면 «어디에» 꼴이어도 종전대로 장소 짓기다(가구·길은 장소 동사가 맡는다)", () => {
    expect(classifyRequest("여관에 침대를 더 추가해 줘", starter).scope).toBe("place");
    expect(classifyRequest("마을에 집을 하나 지어 줘", starter).scope).toBe("place");
  });
  it("«…게임으로 만들어 줘» 는 지은 것이 있는 프로젝트에서 고치기, 빈 프로젝트에서 게임 하나다", () => {
    const ask = "꽃잎 5장을 체력으로 쓰는 게임으로 만들어 줘. 0장이 되면 게임 오버가 되게 해 줘";
    expect(classifyRequest(ask, starter)).toMatchObject({ scope: "edit", wholeGame: false, editOnly: true });
    expect(classifyRequest(ask, blank)).toMatchObject({ scope: "wholeGame", wholeGame: true });
    // 게임이 만들 대상인 글은 그대로다.
    expect(classifyRequest("꽃잎을 체력으로 쓰는 공포 게임 하나 만들어 줘", starter)).toMatchObject({ scope: "wholeGame", wholeGame: true });
    expect(classifyRequest("추리 게임 만들어 줘", starter).scope).toBe("wholeGame");
  });
  it("「얘기한 뒤에만」의 «기한» 은 기한이 아니다", () => {
    expect(classifyRequest("꼬마 미루와 먼저 얘기한 뒤에만 파수꾼 데릭이 지나가게 해 줘", starter).topics).not.toContain("deadline");
    expect(classifyRequest("7일이 지나면 게임이 끝나게 해 줘", starter).topics).toContain("deadline");
  });
});
