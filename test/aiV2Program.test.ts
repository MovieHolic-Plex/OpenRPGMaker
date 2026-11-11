// 조수 v2 목적표(place/program.ts) — 청사진에서 장소마다 역할 건물을 정하고, 그 건물과 채움 집만 지어지며, 역할 건물은 들어갈 수 있거나 그 사람이 문 앞에 선다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import type { GameBlueprint } from "@/project/gameBlueprint";
import { desertProgramSize, type DesertKind } from "@/project/desertEastComposer";
import type { Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { countMaps } from "@/ai/v2/judge/mapCount";
import { vqaShotPlan } from "@/ai/v2/judge/vqa";
import { HOME_CAP, planPrograms, programAnchor, programGaps, roleDoors, roomBehind, serviceNeeds, serviceRoom } from "@/ai/v2/place/program";
import { isProgramRoom, programRoomKind } from "@/ai/v2/place/programMark";
import { worldById } from "@/ai/v2/place/world";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";

const PLACES = [
  { name: "달샘 오아시스", kind: "oasis" }, { name: "황금 모래 시장", kind: "bazaar" }, { name: "바람 대상 숙영지", kind: "caravanserai" },
  { name: "초승달 궁전", kind: "palace" }, { name: "잠든 태양의 피라미드", kind: "pyramid" }, { name: "별의 매장실", kind: "tomb", from: "잠든 태양의 피라미드" },
];
const step = (id: string, kind: string, place: string, who?: string, event?: string) => ({ id, kind, place, ...(who ? { who } : {}), event: event ?? who ?? `${place}의 단서`, action: "한다", gives: `${id} 결과`, feeling: "궁금함" });
const STEPS = [
  step("s1", "talk", "달샘 오아시스", "나지라"), step("s2", "choice", "황금 모래 시장", "파리드"), step("s3", "puzzle", "바람 대상 숙영지", undefined, "대상 숙영지의 번호 자물쇠"),
  step("s4", "talk", "초승달 궁전", "자라"), step("s5", "battle", "잠든 태양의 피라미드", "모래 수호자"), step("s6", "find", "별의 매장실", undefined, "별의 석관"),
];
const blueprint = (steps = STEPS, places = PLACES, setting = "desert_east"): GameBlueprint =>
  ({ version: 1, title: "달샘과 잠든 태양", genre: "모험", setting, playerGoal: "샘을 되살린다.", places, steps, ending: { name: "되살아난 달샘", how: "샘이 다시 솟는다.", feeling: "안도" } }) as unknown as GameBlueprint;
const planOf = (bp: GameBlueprint) => planPrograms({ gameBlueprint: bp })!;
const ids = (bp: GameBlueprint, place: string) => planOf(bp).places.get(place)!.program.roles.map((need) => need.id);

describe("조수 v2 목적표 — 계획", () => {
  it("장소마다 역할: 얼굴 건물 → 쉴 곳·가게(본업인 종류에) → 청사진의 방 → 사람들의 집", () => {
    const bp = blueprint();
    expect(ids(bp, "달샘 오아시스")).toEqual(["home:나지라"]);
    expect(ids(bp, "황금 모래 시장")).toEqual(["svc:shop", "home:파리드"]);
    expect(ids(bp, "바람 대상 숙영지")).toEqual(["svc:inn"]);
    expect(ids(bp, "초승달 궁전")).toEqual(["landmark"]);
    expect(ids(bp, "잠든 태양의 피라미드")).toEqual(["landmark"]);
    const plan = planOf(bp);
    // 궁전의 첫 사람은 궁전 문 앞, 묘실은 피라미드 입구에 달린다.
    expect(plan.places.get("초승달 궁전")!.people.get("자라")).toBe("landmark");
    expect(plan.rooms.get("별의 매장실")).toEqual({ host: "잠든 태양의 피라미드", needId: "landmark" });
  });

  it("집은 단계마다가 아니라 사람마다 한 채, 한 장소에 HOME_CAP 채까지(넘으면 빈칸으로 적는다)", () => {
    const twice = blueprint([...STEPS, step("s7", "choice", "달샘 오아시스", "나지라", "나지라의 부탁")]);
    expect(ids(twice, "달샘 오아시스")).toEqual(["home:나지라"]);
    const crowd = blueprint([...STEPS, ...["가온", "나래", "다솜"].map((who, i) => step(`s${7 + i}`, "talk", "달샘 오아시스", who))]);
    expect(ids(crowd, "달샘 오아시스").filter((id) => id.startsWith("home:"))).toHaveLength(HOME_CAP);
    expect(planOf(crowd).gaps.filter((g) => g.kind === "home-cap").map((g) => g.detail).join()).toContain("다솜");
  });

  it("청사진이 방을 적으면 그 역할의 건물이 그 장소에 서고, 그 방이 쉴 곳이면 여관을 따로 두지 않는다", () => {
    const bp = blueprint(STEPS, [...PLACES, { name: "모래찻집", kind: "teahouse", from: "황금 모래 시장" }, { name: "별빛 여관", kind: "inn", from: "달샘 오아시스" }]);
    expect(ids(bp, "황금 모래 시장")).toEqual(["svc:shop", "room:모래찻집", "home:파리드"]);
    expect(ids(bp, "달샘 오아시스")).toEqual(["room:별빛 여관", "home:나지라"]);
    expect(ids(bp, "바람 대상 숙영지")).toEqual([]);
    expect(planOf(bp).rooms.get("모래찻집")).toEqual({ host: "황금 모래 시장", needId: "room:모래찻집" });
  });

  it("싸움이 없는 게임에는 가게·쉴 곳을 세우지 않고, 선언이 없는 세계는 목적표가 없다", () => {
    const calm = blueprint(STEPS.filter((st) => st.kind !== "battle"), PLACES.filter((pl) => pl.kind !== "pyramid" && pl.kind !== "tomb"));
    expect(serviceNeeds({ gameBlueprint: calm } as Project, "plan")).toEqual({ rest: false, supply: false });
    expect([...planOf(calm).places.values()].flatMap((pl) => pl.program.roles).some((need) => need.id.startsWith("svc:"))).toBe(false);
    expect(worldById("snow_north")?.program).toBeUndefined();
    expect(planPrograms({ gameBlueprint: blueprint(STEPS, [{ name: "눈보라 마을", kind: "village" }], "snow_north") })).toBeUndefined();
  });
});

/** 청사진을 실제 동사(write_blueprint → build_places → build_blueprint_path)로 짓는다(모델 없음). */
async function buildGame(): Promise<Project> {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env = {
    ctx, request: { task: "사막 오아시스에서 벌어지는 게임 하나 만들어 줘.", provider: "local-cli:claude", mapIds: [], project, projectKey: '["project","program-test"]' },
    emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }), render: async () => "", checkpoint: async () => {},
  } as unknown as PiAssistantV2Env;
  const tools = createV2Tools(env, session);
  const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
    const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
    return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}") as { ok?: boolean; summary?: string };
  };
  const bp = blueprint();
  const wrote = await call("write_blueprint", { title: bp.title, genre: bp.genre, playerGoal: bp.playerGoal, places: bp.places, steps: bp.steps, ending: bp.ending });
  expect(wrote.ok, String(wrote.summary)).toBe(true);
  const built = await call("build_places", {});
  expect(built.ok, String(built.summary)).toBe(true);
  const path = await call("build_blueprint_path", { steps: [
    { id: "s1", lines: ["샘이 마르고 있어요."] }, { id: "s2", lines: ["무엇을 고르겠소?"], choices: [{ text: "등불", lines: ["밤길엔 등불이지."], later: "등불이 길을 밝혔다." }, { text: "지도", lines: ["길을 잃지 않겠군."], later: "지도가 길을 가리켰다." }] },
    { id: "s4", lines: ["수호자의 비밀을 알려 주겠네."] }, { id: "s5", lines: ["돌아가라."], winLines: ["…지나가라."] },
  ] });
  expect(path.ok, String(path.summary)).toBe(true);
  return ctx.project;
}

describe("조수 v2 목적표 — 짓기", () => {
  it("장소는 목적표 크기로 지어지고, 역할 건물은 들어갈 수 있거나 그 사람이 문 옆에 서며, 빌더가 지은 방은 세지 않는다", async () => {
    const project = await buildGame();
    const mapOf = (name: string) => Object.values(project.maps).find((m) => m.name === name)!;
    const plan = planPrograms(project)!;
    // 크기 = 목적표가 정한 크기.
    for (const pl of PLACES.filter((p) => p.kind !== "tomb")) {
      const size = desertProgramSize(pl.kind as DesertKind, plan.places.get(pl.name)!.program), map = mapOf(pl.name);
      expect([map.width, map.height], pl.name).toEqual([size.w, size.h]);
    }
    // 가게·여관·궁전은 빌더가 방을 지어 이었고(양쪽), 묘실은 청사진의 방이 피라미드 입구에 달렸다.
    const rooms: string[] = [];
    for (const [name, role] of [["황금 모래 시장", "shop"], ["바람 대상 숙영지", "inn"], ["초승달 궁전", "throne"]] as const) {
      const host = mapOf(name), door = roleDoors(project, host).find((d) => d.role === role)!;
      const roomId = roomBehind(host, door)!;
      expect(isProgramRoom(project, roomId), name).toBe(true);
      expect(JSON.stringify(project.maps[roomId]!.events), `${name} 방에서 돌아오는 이동`).toContain(`"mapId":"${host.id}"`);
      rooms.push(roomId);
    }
    const pyramid = mapOf("잠든 태양의 피라미드");
    expect(roomBehind(pyramid, roleDoors(project, pyramid).find((d) => d.need === "landmark")!)).toBe(mapOf("별의 매장실").id);
    expect(isProgramRoom(project, mapOf("별의 매장실").id)).toBe(false);
    // 세는 맵: 빌더의 방은 빠지고 청사진의 장소 여섯은 센다.
    const counted = countMaps(project);
    for (const id of rooms) expect(counted.uncounted.find((u) => u.id === id)?.reason).toBe("program-room");
    for (const pl of PLACES) expect(counted.counted, pl.name).toContain(mapOf(pl.name).id);
    // 검수 그림: 빌더의 방은 청사진의 맵 뒤에, 방 종류마다 한 장.
    const shots = vqaShotPlan(project, new Set()).filter((s) => s.kind === "map").map((s) => s.ref!);
    const firstRoom = shots.findIndex((ref) => isProgramRoom(project, ref));
    expect(firstRoom).toBeGreaterThan(0);
    expect(shots.slice(firstRoom).every((ref) => isProgramRoom(project, ref))).toBe(true);
    expect(new Set(shots.slice(firstRoom).map((ref) => programRoomKind(project, ref))).size).toBe(shots.length - firstRoom);
    // 사람은 제 집(얼굴 건물) 문 옆에 선다.
    for (const [name, who] of [["달샘 오아시스", "나지라"], ["황금 모래 시장", "파리드"], ["초승달 궁전", "자라"]] as const) {
      const map = mapOf(name), door = roleDoors(project, map).find((d) => d.need === plan.places.get(name)!.people.get(who))!;
      const person = map.events.find((e) => e.name === who)!;
      expect(person.y - door.front.y, `${who} 줄`).toBeGreaterThanOrEqual(0);
      expect(person.y - door.front.y, `${who} 줄`).toBeLessThanOrEqual(1);
      expect(person.x >= door.front.x - 1 && person.x <= door.front.x + door.width, `${who} 칸 ${person.x},${person.y} 문 앞 ${door.front.x},${door.front.y}`).toBe(true);
      const bare = { ...map, events: map.events.filter((e) => e.id !== person.id) };
      expect(programAnchor({ ...project, maps: { ...project.maps, [map.id]: bare } }, bare, who)).toEqual({ x: person.x, y: person.y });
    }
    // 가게 주인·여관 주인은 그 방 안에 — 시작 맵의 샘·떠돌이 상인은 없다(쉴 곳·가게의 결정은 하나).
    const shop = serviceRoom(project, "shop")!, inn = serviceRoom(project, "inn")!;
    expect(JSON.stringify(project.maps[shop.mapId]!.events)).toContain('"kind":"shop"');
    expect(JSON.stringify(project.maps[inn.mapId]!.events)).toContain('"kind":"recoverAll"');
    const startEvents = project.maps[project.startMapId]!.events.map((e) => e.id);
    expect(startEvents).not.toContain("ev_heal_spring");
    expect(startEvents).not.toContain("ev_supply_shop");
    expect(serviceNeeds(project, "built")).toEqual({ rest: false, supply: false });
    // 실내 종류가 없는 역할(살림집)은 덮지 않고 빈칸으로 적는다.
    expect(programGaps(project).filter((g) => g.kind === "no-room-kind").map((g) => g.need).sort()).toEqual(["home:나지라", "home:파리드"]);
    expect(programGaps(project).some((g) => g.kind === "unplaced")).toBe(false);
  }, 240_000);
});
