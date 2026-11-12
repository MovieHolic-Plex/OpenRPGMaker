// 게임 하나 요청의 처음 도구 목록 — 짓는 턴은 안 쓰는 것 · 드물게 쓰는 큰 것을 뒤로, 청사진의 단계가 다 지어진 뒤의 턴은 고치는 도구만 처음부터(모델 없음).
// 2026-11-12 Haiku 게임 r1v-fun: 도구 56개·12.3만 자가 모델 호출 272번에 매번 실렸다. 문서 openwiki/assistant-v2.md 「게임 하나 요청의 처음 목록」.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import type { Project } from "@/project/types";
import { ArgShapeError } from "@/ai/piAgent/argRepair";
import { callToolFailureText } from "@/ai/piAgent/cliToolFreeze";
import { classifyRequest } from "@/ai/v2/request/intent";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";

const MAKE = "재밌는 게임 만들어 줘.";
const FINISH = "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을 처음부터 엔딩까지 실제로 플레이할 수 있게 해 줘.";

/** built: 청사진 단계 가운데 지은 이벤트가 적힌 수(undefined = 청사진 없음). */
function project(built?: number): Project {
  const p = createBlankProject() as Project;
  if (built === undefined) return p;
  const place = p.maps[p.startMapId]!.name || p.startMapId;
  p.gameBlueprint = normalizeGameBlueprint({
    title: "달샘", genre: "모험", playerGoal: "샘을 되살리자.", ending: { name: "달샘", how: "물이 돌아왔다.", feeling: "안도" },
    steps: ["나디아", "자히르", "수호자"].map((name, i) => ({ id: `s${i + 1}`, kind: "talk", who: name, place, event: name, action: `${name}에게 말을 건다`, gives: `${name}의 말`, feeling: "설렘" })),
  });
  p.gameBlueprint.steps.slice(0, built).forEach((step, i) => { step.built = { mapId: p.startMapId, eventId: `ev_${i}` }; });
  return p;
}
function offer(p: Project, task: string) {
  const env = {
    ctx: { project: p, currentMapId: p.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project: p, projectKey: "k3" }, lazyToolsVia: "call_tool",
    emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => 0,
  } as never;
  const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
  const chars = exposure.tools.reduce((n, t) => n + JSON.stringify({ n: t.name, d: t.description, p: t.parameters }).length, 0);
  return { intent: classifyRequest(task, p), exposure, upFront: exposure.tools.map((t) => t.name), chars, loadTools: exposure.tools.find((t) => t.name === "load_tools")!.description };
}

const LATER = ["edit_place", "make_place", "set_project_settings", "upsert_event", "set_opening", "upsert_actor", "add_scene", "draw_object", "place_object", "dungeon_parts",
  "set_start_position", "place_chest", "furnish_outdoor_area", "create_opening_animatic_shot", "place_opening_background", "place_opening_charset_actor"];

describe("게임 하나 요청 — 짓는 턴", () => {
  const first = offer(project(), MAKE);
  it("게임 하나 요청이다", () => expect(first.intent.wholeGame).toBe(true));
  it("안 쓰는 것 · 드물게 쓰는 큰 것은 처음부터 싣지 않고 load_tools 로 닿는다", () => {
    for (const name of LATER) { expect(first.upFront, name).not.toContain(name); expect(first.exposure.lazy.has(name), name).toBe(true); }
  });
  it("뒤로 돌린 v2 동사는 load_tools 설명에 한 줄 뜻과 함께 든다", () => {
    expect(first.loadTools).toMatch(/edit_place — /u);
    expect(first.loadTools).toMatch(/make_place — /u);
  });
  // todo 는 할 일 고리(withTodoLoop)가 더한다 — 여기서는 동사 목록만 본다.
  it("짓는 동사 · 엔딩 · 목표 · 돌려 보기는 그대로 처음부터 싣는다", () => {
    for (const name of ["write_blueprint", "build_blueprint_path", "add_event", "add_people", "define_ending", "set_objective", "run_scene_test", "patch_event_page", "list_endings"]) expect(first.upFront, name).toContain(name);
  });
  it("처음 목록은 7만 자 안이다(전에는 12만 자)", () => expect(first.chars).toBeLessThan(70_000));
  it("단계가 하나라도 안 지어졌으면 아직 짓는 턴이다", () => {
    const partial = offer(project(2), FINISH);
    expect(partial.intent.wholeGame).toBe(true);
    for (const name of ["write_blueprint", "build_blueprint_path", "add_event"]) expect(partial.upFront, name).toContain(name);
  });
});

describe("게임 하나 요청 — 청사진의 단계가 다 지어진 뒤(고치는 턴)", () => {
  const repair = offer(project(3), FINISH);
  it("게임 하나 요청이다", () => expect(repair.intent.wholeGame).toBe(true));
  it("읽기 · 돌려 보기 · 이벤트와 목표 고치기 · 엔딩만 처음부터 싣는다", () => {
    for (const name of ["get_event", "find_events", "inspect", "run_scene_test", "patch_event_page", "move_event", "set_objective", "define_ending", "list_endings", "generate_art", "load_tools"]) expect(repair.upFront, name).toContain(name);
    for (const name of ["write_blueprint", "build_blueprint_path", "add_event", "add_people", "edit_place", "make_place", "upsert_event", "set_opening"]) {
      expect(repair.upFront, name).not.toContain(name);
      expect(repair.exposure.lazy.has(name), name).toBe(true);
    }
  });
  it("처음 목록은 4만 5천 자 안이다(전에는 12만 6천 자)", () => expect(repair.chars).toBeLessThan(45_000));
});

describe("게임 하나가 아닌 요청은 그대로다", () => {
  it("장소 하나를 지어 달라는 요청은 make_place · edit_place 를 처음부터 받는다", () => {
    const place = offer(project(), "여관 하나 만들어 줘");
    expect(place.intent.wholeGame).toBe(false);
    for (const name of ["make_place", "edit_place"]) expect(place.upFront, name).toContain(name);
  });
});

describe("call_tool 로 부른 도구의 인자 모양 거절은 그 도구의 매개변수를 싣는다", () => {
  const { exposure } = offer(project(), MAKE);
  it("목록에 없는 도구만 매개변수 글을 준다 — 검증하는 스키마와 같은 모양, 영어", () => {
    expect(exposure.callSchema("define_ending")).toBeUndefined();
    const text = exposure.callSchema("set_map_properties")!;
    const strip = (v: unknown): unknown => Array.isArray(v) ? v.map(strip) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "description").map(([k, x]) => [k, strip(x)])) : v;
    expect(strip(JSON.parse(text))).toEqual(strip(exposure.lazy.get("set_map_properties")!.parameters));
    expect(text).toContain('"enum":["parent","none","custom"]');
    expect(text).not.toMatch(/[ㄱ-ㆎ가-힣]/u);
  });
  it("첫 번째와 세 번째 인자 모양 거절에만 붙인다 — 두 번째 · 다른 실패 · 목록에 있는 도구에는 붙이지 않는다", () => {
    const fail = (streak: number) => callToolFailureText(new ArgShapeError("bgm: expected object or null, received string", streak), "set_map_properties", true, exposure.callSchema);
    expect(fail(1)).toContain("Parameters of set_map_properties");
    expect(fail(1)).toContain('"bgm":');
    expect(fail(2)).toBe("bgm: expected object or null, received string");
    expect(fail(3)).toContain("Parameters of set_map_properties");
    expect(fail(4)).not.toContain("Parameters of");
    expect(callToolFailureText(new Error("참고문서 선행 읽기 필요"), "place_door", true, exposure.callSchema)).toBe("참고문서 선행 읽기 필요");
    expect(callToolFailureText(new ArgShapeError("x", 1), "set_map_properties", false, exposure.callSchema)).toBe("x");
    expect(callToolFailureText(new ArgShapeError("x", 1), "define_ending", true, exposure.callSchema)).toBe("x");
  });
});
