// 끝맺음 자동 짓기는 장소 종류를 «아는 사실» 에서 읽는다(2026-11-16, openwiki/assistant-v2.md 「자동 짓기는 종류를 아는 사실에서 읽는다」):
// 모델이 make_place 로 청한 명세(거절됐어도) · 청사진에 적은 종류 · 이름이 말하는 종류 차례다. 그래도 모르면 짓지 않고 모델에게 돌려준다.
// 종전에는 이름 낱말이 맞지 않으면 모험 장르는 마을 한 장으로 떨어졌다 — r5a 재생에서 실내로 청했다 거절된 「방앗간 안」 이 42×45 강마을로 섰다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { isIndoorMap, placeSpecFor, placeTypeFromName } from "@/ai/v2/place/placeGuess";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { PlaceSpec } from "@/ai/v2/shared/types";

const SLOW = 180_000;
const TASK = "강가 마을에서 시작하는 짧은 JRPG 모험 게임을 만들어 줘. 방앗간과 동굴이 나와.";
/** 플레이에서 마을로 선 다섯 이름(r5a·r5b). */
const FIVE = ["방앗간 안", "바닷가 등대", "물때 어물전", "포구 회관", "말순네 농가"];
const NOTE = (names: string[]) => `NOT built, place type unknown: ${names.map((n) => `"${n}"`).join(", ")}. Build each with make_place and a type (interior, village, dungeon, cave).`;

describe("장소 종류 — 아는 사실이 추측보다 먼저다(placeSpecFor)", () => {
  const project = createBlankProject();
  const spec = (name: string, facts = {}, genre = "JRPG") => placeSpecFor(name, project, genre, TASK, facts);

  it("다섯 이름은 아는 것이 없어도 마을이 되지 않는다", () => {
    for (const name of FIVE) expect(spec(name)?.type, name).not.toBe("village");
    // 「○○ 안」 은 이름이 스스로 실내라고 말한다. 나머지 넷은 모른다 = 짓지 않는다.
    expect(spec("방앗간 안")?.type).toBe("interior");
    for (const name of FIVE.slice(1)) expect(spec(name), name).toBeUndefined();
  });

  it("모델이 make_place 로 청한 명세가 가장 먼저다 — 종류·방·칸 배치를 그대로, 맵 id 와 씨앗은 뺀다", () => {
    const asked = { type: "interior", name: "바닷가 등대", zones: [{ kind: "study", purpose: "등대지기 방" }], mapId: "map_x", salt: 7, variety: "v" } as unknown as PlaceSpec;
    const got = spec("바닷가 등대", { asked, kind: "village" })!;
    expect(got.type).toBe("interior");
    expect(got.zones).toEqual(asked.zones);
    expect(got).not.toHaveProperty("mapId");
    expect(got).not.toHaveProperty("salt");
    expect(got).not.toHaveProperty("variety");
  });

  it("청사진·할 일에 적은 종류가 이름보다 먼저다", () => {
    expect(spec("말순네 농가", { kind: "interior" })?.type).toBe("interior");
    expect(spec("포구 회관", { kind: "Interior " })?.type).toBe("interior");
    expect(spec("달빛 여관", { kind: "village" })?.type).toBe("village");
    expect(spec("바람 언덕", { kind: "field" })).toMatchObject({ type: "dungeon", theme: "forest" });
    // 짓는 종류의 이름이 아닌 낱말(세계의 종류 id 따위)은 사실로 읽지 않는다.
    expect(spec("물때 어물전", { kind: "lake" })).toBeUndefined();
  });

  it("이름이 말하는 종류는 그대로 읽는다 — 마을은 끝 낱말이 마을 낱말일 때만", () => {
    expect(placeTypeFromName("수정 동굴")).toBe("cave");
    expect(placeTypeFromName("달빛 여관")).toBe("interior");
    expect(placeTypeFromName("잊힌 유적")).toBe("dungeon");
    expect(placeTypeFromName("물레강 마을")).toBe("village");
    expect(placeTypeFromName("갈매기 포구")).toBe("village");
    expect(placeTypeFromName("버들항구")).toBe("village");
    expect(placeTypeFromName("포구 회관")).toBeUndefined();
    expect(placeTypeFromName("마을 회관 내부")).toBe("interior");
    expect(placeTypeFromName("동굴 안")).toBe("cave");
  });

  it("건물 안이 기본인 장르는 모르는 장소를 실내로 짓는다(종전 그대로)", () => {
    expect(spec("물때 어물전", {}, "추리")?.type).toBe("interior");
    expect(spec("포구 회관", {}, "방탈출")?.type).toBe("interior");
  });
});

function turn() {
  const project = createBlankProject();
  const session = new V2Session();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env: PiAssistantV2Env = {
    ctx, request: { task: TASK, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","place-type-known"]` } as never,
    emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
  };
  const tools = createV2Tools(env, session);
  const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
    const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
    return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as { ok?: boolean; summary?: string };
  };
  const maps = () => Object.values(ctx.project.maps);
  const mapNamed = (name: string) => maps().find((m) => m.name === name);
  return { ctx, session, call, maps, mapNamed };
}

/** 세계 없는 모험 청사진 — 단계의 장소가 여섯(마을 하나와 다섯 이름). places 는 모델이 적은 종류다. */
function blueprint(places?: { name: string; kind: string; from?: string }[]) {
  const rows = [["s1", "talk", "방앗간 안", "방앗간 주인 한씨"], ["s2", "talk", "물레강 마을", "어부 도윤"], ["s3", "find", "말순네 농가", "빈 솥"],
    ["s4", "talk", "바닷가 등대", "등대지기"], ["s5", "find", "물때 어물전", "장부"], ["s6", "battle", "포구 회관", "밀수꾼 두목"]] as const;
  const steps = rows.map(([id, kind, place, event], i) => ({ id, kind, place, event, ...(kind === "find" ? {} : { who: event }), action: `${event} 를 만난다`, feeling: "궁금함", gives: `flag${i + 1}`, needs: i ? `flag${i}` : "" }));
  return { title: "물레강", genre: "JRPG", playerGoal: "강을 되살린다", steps,
    ending: { name: "다시 도는 물레방아", how: "두목을 이긴다", feeling: "뿌듯함", closing: ["강이 다시 흐른다.", "물레방아가 돈다."] }, ...(places ? { places } : {}) };
}

async function writeBlueprint(t: ReturnType<typeof turn>, bp: unknown) {
  let r = await t.call("write_blueprint", bp);
  if (!r.ok) r = await t.call("write_blueprint", bp);
  expect(r.ok, r.summary).toBe(true);
}

/** r5a 재생에서 거절된 「방앗간 안」 호출의 칸 배치(14×12) — 맵 밖 기물 하나를 더해 이 가지에서도 거절되게 한다. */
const MILL: Record<string, unknown> = { type: "interior", name: "방앗간 안", layout: { map: { w: 14, h: 12 }, landmark: { id: "work 3x1", x: 5, y: 6, purpose: "밀을 빻는 방앗간 작업대" },
  outer_wall: { material: "log", path: [[0, 0], [13, 0], [13, 11], [0, 11]] }, entrance: { x: 6, y: 11 },
  rooms: [{ id: "mill", at: [6, 5], floor: "plank", purpose: "물레방아와 이어진 방앗간 작업장", role: "main" }],
  wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }, { id: "window", wall: "outer", x: 11, y: 1 }],
  objects: [{ id: "sack pile", x: 10, y: 3, purpose: "곡식 자루 더미" }, { id: "barrel stack", x: 1, y: 8 }, { id: "crate stack", x: 11, y: 8 }, { id: "crate", x: 9, y: 6 }, { id: "stool", x: 4, y: 8 }, { id: "stool", x: 30, y: 30 }] } };

describe("끝맺음 자동 짓기 — 종류를 모르는 장소는 마을로 세우지 않는다", () => {
  it("아는 것이 없으면 짓지 않고, 종류를 적어 지으라는 글 한 줄을 맨 앞에 돌려준다", async () => {
    const t = turn();
    await writeBlueprint(t, blueprint());
    const notes = await t.session.buildPlaces!();
    // 청사진 단계 차례로 적는다.
    expect(notes[0]).toBe(NOTE(["말순네 농가", "바닷가 등대", "물때 어물전", "포구 회관"]));
    // 바깥 맵은 마을 하나뿐이다 — 종전에는 여섯 장소가 모두 마을 한 장씩이었다.
    expect(t.maps().filter((m) => !isIndoorMap(m)).map((m) => m.name)).toEqual(["물레강 마을"]);
    expect(isIndoorMap(t.mapNamed("방앗간 안")!)).toBe(true);
    for (const name of ["말순네 농가", "바닷가 등대", "물때 어물전", "포구 회관"]) expect(t.mapNamed(name), name).toBeUndefined();
  }, SLOW);

  it("실내로 청했다 거절된 장소는 그 칸 배치의 실내로 선다 — 마을이 아니다", async () => {
    const t = turn();
    await writeBlueprint(t, blueprint());
    const asked = await t.call("make_place", { spec: MILL });
    expect(asked.ok, asked.summary).toBe(false);
    expect(t.mapNamed("방앗간 안")).toBeUndefined();
    expect(t.session.placeFacts.get("방앗간안")?.asked?.type).toBe("interior");
    await t.session.buildPlaces!();
    const mill = t.mapNamed("방앗간 안")!;
    expect(isIndoorMap(mill)).toBe(true);
    // 모델이 그린 방 크기 그대로다(걸리는 기물만 빠진다).
    expect([mill.width, mill.height]).toEqual([14, 12]);
  }, SLOW);

  it("방 모양 자체가 깔리지 않는 칸 배치여도 종류는 그대로다 — 기본 실내로 선다", async () => {
    const t = turn();
    await writeBlueprint(t, blueprint());
    const layout = MILL.layout as { outer_wall: { path: number[][] } };
    const asked = await t.call("make_place", { spec: { ...MILL, layout: { ...layout, outer_wall: { ...layout.outer_wall, path: [[0, 0], [13, 0]] } } } });
    expect(asked.ok, asked.summary).toBe(false);
    await t.session.buildPlaces!();
    expect(isIndoorMap(t.mapNamed("방앗간 안")!)).toBe(true);
    expect(t.maps().filter((m) => !isIndoorMap(m)).map((m) => m.name)).toEqual(["물레강 마을"]);
  }, SLOW);

  it("청사진에 적은 종류와 칸 배치 없이 청한 종류로 실내를 짓는다 — 모르는 둘만 남는다", async () => {
    const t = turn();
    await writeBlueprint(t, blueprint([{ name: "물레강 마을", kind: "village" }, { name: "방앗간 안", kind: "interior", from: "물레강 마을" }, { name: "말순네 농가", kind: "interior", from: "물레강 마을" }]));
    // 세계 없는 청사진은 장소 목록을 남기지 않는다 — 종류는 이 실행의 사실로만 남는다.
    expect((t.ctx.project.gameBlueprint as { places?: unknown }).places).toBeUndefined();
    expect(t.session.placeFacts.get("말순네농가")).toMatchObject({ kind: "interior", from: "물레강 마을" });
    // 칸 배치 없이 온 실내는 돌려보내진다 — 종류는 남는다.
    expect((await t.call("make_place", { spec: { type: "interior", name: "바닷가 등대" } })).ok).toBe(false);
    const notes = await t.session.buildPlaces!();
    expect(notes[0]).toBe(NOTE(["물때 어물전", "포구 회관"]));
    for (const name of ["방앗간 안", "말순네 농가", "바닷가 등대"]) expect(isIndoorMap(t.mapNamed(name)!), name).toBe(true);
    expect(t.maps().filter((m) => !isIndoorMap(m)).map((m) => m.name)).toEqual(["물레강 마을"]);
    // 청사진이 마을에서 들어간다고 적은 농가는 마을 집 문에 달린다.
    expect(notes.some((n) => n.includes("물레강 마을 집 문") && n.includes("말순네 농가"))).toBe(true);
  }, SLOW);
});
