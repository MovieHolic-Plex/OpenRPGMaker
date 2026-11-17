// 버들항 마을을 지은 턴의 집 안 — 2026-11-16 r6 실모델(포구 마을 «갈매나루», Sonnet 5.5 high)에서 본 것과 오너 방향 「에셋들을 되게 자유롭게 쓰는 방향」.
//  · 지시문의 실내 카드는 턴을 시작할 때의 맵으로 고른 v5 표였고, 마을을 지은 뒤 집 안은 버들항 표로 검사돼 첫 두 장소가 세 번 거절됐다.
//  · 마을 결과의 문 목록이 킷 id 뿐이라 어느 문이 어떤 건물인지 읽을 수 없었고, 모델이 직접 부른 실내에는 크기 단이 붙지 않았다.
// 이제: 마을 결과가 그 마을의 실내 카드와 건물 이름 · 단을 싣고, v5 낱말로 쓴 방은 v5 표로 그대로 깔리고, 없는 이름은 가까운 것으로 바꿔 깔고 알리고,
// hints.door 로 문을 고르면 그 건물의 크기 단을 따른다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { doorHouses, thinInsideNote, TIER_MIN_ROOMS } from "@/ai/v2/place/doorHouse";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";

const SLOW = 300_000;
const TASK = "바닷가 포구 마을과 그 마을 성당 실내를 만들어 줘.";

function turn() {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task: TASK, provider: "local-cli:claude", mapIds: [], project, projectKey: "house-door-card" } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
    preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const call = async (name: string, args: unknown): Promise<string[]> => (await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)).content.filter((c) => c.type === "text").map((c) => (c as { text?: string }).text ?? "");
  const village = async (): Promise<string[]> => {
    await call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을", id: "v", check: { kind: "none" } }] }] });
    const spec = { type: "village", name: "갈매나루", hints: { theme: "coast" } };
    const first = await call("make_place", spec);
    return /"ok":true/u.test(first[0]!) ? first : call("make_place", spec);   // 첫 답은 땅 그림(짓기 전)일 수 있다 — 같은 호출을 다시 보내면 짓는다
  };
  return { ctx, call, village, start: project.startMapId };
}
const mill = (wall: string, floor: string, objects: unknown[], wallItems: unknown[] = []) => ({ map: { w: 14, h: 12 }, landmark: { id: "barrel stack", x: 1, y: 8 }, outer_wall: { material: wall, path: [[0, 0], [13, 0], [13, 11], [0, 11]] }, entrance: { x: 6, y: 11 },
  rooms: [{ id: "mill", at: [6, 5], floor, purpose: "mill" }], wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }, ...wallItems], objects });

describe("버들항 마을을 지은 턴의 집 안 — 카드 · 문 목록 · 자유롭게 쓰는 낱말 · 문이 고르는 크기 단", () => {
  // 마을 빌더의 씨앗은 Math.random 에서 온다 — 같은 시험이 같은 마을을 짓게 못박는다.
  beforeEach(() => { let s = 20261116; vi.spyOn(Math, "random").mockImplementation(() => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("마을 결과가 그 마을의 실내 카드를 싣고(지시문의 카드는 v5), 문 목록은 건물 이름과 단을 싣는다", async () => {
    const t = turn();
    // 지시문: 빈 프로젝트에서는 턴을 시작할 때 v5 카드가 실린다(마을이 아직 없다)
    expect(buildV2SystemPrompt(t.ctx.project, t.start, TASK, undefined, "house-door-card").join("\n")).toContain(`[Interior catalog — chipset ${HAND_INTERIOR_TILESET_ID}`);
    const built = await t.village();
    expect(built[0]).toContain('"ok":true');
    const card = built.find((p) => p.includes("[Interior catalog — chipset beodeul_city"));
    expect(card, built.map((p) => p.slice(0, 80)).join(" | ")).toBeTruthy();
    expect(card).toContain("checked against chipset beodeul_city, not the [Interior catalog] card in your instructions");
    expect(card).toMatch(/^floors: dplank, plank, flag/mu);
    // 문 목록: 킷 id(좌표) «건물 이름» [단]
    const doors = /건물 크기를 따른다\): ([^"]*)"/u.exec(built[0]!)?.[1] ?? "";
    expect(doors).toMatch(/house-[\w-]+\(\d+,\d+\) «[^»]+»/u);
    expect(built[0]).toContain("hints.door [x,y]");
    // 문 목록의 좌표와 건물은 맵에서 읽은 문과 같다
    const houses = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]);
    for (const m of doors.matchAll(/(house-[\w-]+)\((\d+),(\d+)\)/gu)) expect(houses.some((h) => h.kit === `bd-${m[1]}` && h.front.x === Number(m[2]) && h.front.y === Number(m[3])), m[0]).toBe(true);
    // 같은 턴에 한 번만 싣는다
    const again = await t.call("make_place", { type: "interior", name: "방앗간", layout: mill("log", "plank", [{ id: "crate", x: 9, y: 9 }]) });
    expect(again.some((p) => p.includes("[Interior catalog — chipset"))).toBe(false);
  }, SLOW);

  it("v5 조각 이름으로 쓴 방과 없는 이름을 쓴 방이 거절 없이 지어지고, 바꾼 것은 결과 글에 한 줄씩 적힌다", async () => {
    const t = turn();
    await t.village();
    // v5 카드의 낱말로 쓴 선술집 — 이 게임의 집 안 표(버들항)로 깔고, v5 낱말은 버들항의 가장 가까운 조각으로 바꿔 한 줄씩 알린다(한 게임 한 실내 칩셋, 2026-11-17 r8 D2)
    const v5 = { map: { w: 12, h: 10 }, landmark: { id: "counter 4x1", x: 3, y: 5 }, outer_wall: { material: "logdark", path: [[0, 0], [11, 0], [11, 9], [0, 9]] }, entrance: { x: 5, y: 9 },
      rooms: [{ id: "hall", at: [5, 7], floor: "boards", purpose: "tavern" }], wall_items: [{ id: "keg rack", wall: "outer", x: 1, y: 3 }],
      objects: [{ id: "roundtable", x: 2, y: 7 }, { id: "chair E", x: 1, y: 7 }, { id: "bar stool", x: 6, y: 7 }, { id: "barrel", x: 9, y: 7 }] };
    const a = JSON.parse((await t.call("make_place", { type: "interior", name: "선술집", layout: v5 }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
    expect(a.ok, a.summary).toBe(true);
    expect(t.ctx.project.maps[a.mapIds[0]!]!.tilesetId).toBe("beodeul_city");
    expect(a.warnings.join(" ")).toContain("laid with this game's interior chipset beodeul_city");
    expect(a.warnings).toContain('swapped piece "roundtable" → "round table" (not in this chipset\'s table — its nearest id)');
    expect(a.warnings).toContain('swapped piece "keg rack" → "ale kegs rack" (not in this chipset\'s table — its nearest id)');
    // 버들항 낱말에 없는 이름이 섞인 방 — 버들항 표로 깔고, 없는 이름은 가장 가까운 것으로 바꿔 알린다
    const mixed = mill("logdark", "plank", [{ id: "bar counter", x: 3, y: 6 }, { id: "milking stool", x: 4, y: 8 }, { id: "wooden chair", x: 8, y: 8 }, { id: "crate", x: 9, y: 9 }], [{ id: "ale kegs rack", wall: "outer", x: 8, y: 3 }]);
    const b = JSON.parse((await t.call("make_place", { type: "interior", name: "방앗간", layout: mixed }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
    expect(b.ok, b.summary).toBe(true);
    expect(t.ctx.project.maps[b.mapIds[0]!]!.tilesetId).toBe("beodeul_city");
    expect(b.summary).toContain("swapped");
    expect(b.warnings).toContain('swapped wall "logdark" → "log" (not in this chipset\'s table — its nearest id)');
    expect(b.warnings).toContain('swapped piece "wooden chair" → "chair" (not in this chipset\'s table — its nearest id)');
  }, SLOW);

  it("hints.door 로 큰 건물의 문을 고르면 그 건물의 크기 단으로 짓고, 방이 모자란 실내를 큰 문에 이으면 그 사실과 고칠 호출을 알린다", async () => {
    const t = turn();
    await t.village();
    const big = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]).find((d) => d.tier === "large" || d.tier === "xlarge");
    expect(big, "이 씨앗의 마을에는 큰 건물이 있어야 한다").toBeTruthy();
    const need = TIER_MIN_ROOMS[big!.tier!]!;
    // 모델의 한 방 배치: 거절하지 않고 깔되 그 건물의 단을 알린다
    const one = JSON.parse((await t.call("make_place", { type: "interior", name: "큰 집", layout: mill("log", "plank", [{ id: "crate", x: 9, y: 9 }]), hints: { door: [big!.front.x, big!.front.y] } }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
    expect(one.ok, one.summary).toBe(true);
    expect(one.warnings.join(" ")).toContain(`hints.door (${big!.front.x},${big!.front.y}) = «${big!.label}»`);
    expect(one.warnings.join(" ")).toMatch(new RegExp(`the building outside is ${big!.tier} \\(${big!.kit}\\) — ${big!.tier} buildings have ${need} or more rooms`, "u"));
    // 그 한 방을 큰 문에 이으면: 건물 이름 · 단 · 방 수 · 고칠 호출
    const note = thinInsideNote(t.ctx.project, { a: { mapId: t.start, x: big!.front.x, y: big!.front.y }, b: { mapId: one.mapIds[0]!, x: 6, y: 11 } });
    expect(note).toContain(`«${big!.label}» (${big!.kit}), a ${big!.tier} building`);
    expect(note).toContain(`"hints":{"door":[${big!.front.x},${big!.front.y}]}`);
    // 작은 집의 문에 이은 것은 알리지 않는다
    const small = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]).find((d) => d.tier === "small");
    if (small) expect(thinInsideNote(t.ctx.project, { a: { mapId: t.start, x: small.front.x, y: small.front.y }, b: { mapId: one.mapIds[0]!, x: 6, y: 11 } })).toBeUndefined();
    // 배치 없이 그 문으로 다시 지으면 그 단의 구성(방 여럿)으로 선다
    const plan = JSON.parse((await t.call("make_place", { type: "interior", name: "큰 집", mapId: one.mapIds[0]!, hints: { door: [big!.front.x, big!.front.y] } }))[0]!) as { ok: boolean; mapIds: string[]; summary: string };
    expect(plan.ok, plan.summary).toBe(true);
    const rooms = plan.mapIds.flatMap((id) => (t.ctx.project.maps[id]?.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")));
    expect(rooms.length).toBeGreaterThanOrEqual(need);
    // 문이 아닌 칸은 무시하고 알린다
    const off = JSON.parse((await t.call("make_place", { type: "interior", name: "헛간", layout: mill("log", "plank", [{ id: "crate", x: 9, y: 9 }]), hints: { door: [0, 0] } }))[0]!) as { ok: boolean; warnings: string[] };
    expect(off.ok).toBe(true);
    expect(off.warnings.join(" ")).toContain("hints.door (0,0) is not a house door");
  }, SLOW);

  // r6 결함 4: 손으로 찍은 큰 건물(stamp_object — 놓기 기록이 남지 않는다)의 문도 그 킷 · 단으로 읽힌다. 같은 문 그림을 쓰는 킷이 여럿이라
  // (첨탑 성당 12×13 · 성당 블록 14×17 · 20×17 이 같은 문 칸) 입구 타일 이름만으로는 블록을 찍어도 «첨탑 성당» 이었다 — 맵의 칸과 겹쳐 고른다.
  it("손으로 찍은 성당 킷의 문: 그 킷과 초대형 단으로 읽히고, 그 문 뒤 실내는 hints.door 로 초대형 구성을 탄다", async () => {
    const t = turn();
    const map = t.ctx.project.maps[t.start]!;
    const W = 40, H = 30, grass = map.lowerTiles[0]!;
    const m = map as unknown as Record<string, number[]>;
    for (const k of ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"]) if (Array.isArray(m[k])) m[k] = Array<number>(W * H).fill(k === "lowerTiles" ? grass : -1);
    map.width = W; map.height = H;
    for (const [kit, x] of [["bd-house-cathedral", 2], ["bd-block-church-14x17", 20]] as const) {
      const r = await runToolAsync(t.ctx, "stamp_object", { mapId: t.start, objectId: `kit:beodeul_city/${kit}`, x, y: 1, onOverlap: "replace" });
      expect(r.ok, r.summary).toBe(true);
    }
    expect(t.ctx.project.maps[t.start]!.structurePlacements ?? []).toEqual([]);   // 손 찍기는 놓기 기록을 남기지 않는다 — 맵의 칸으로 읽는다
    const doors = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]);
    const spire = doors.find((d) => d.front.x === 9 && d.front.y === 14), block = doors.find((d) => d.front.x === 28 && d.front.y === 14);
    expect(spire, JSON.stringify(doors)).toMatchObject({ kit: "bd-house-cathedral", label: "첨탑 성당", tier: "xlarge" });
    expect(block, JSON.stringify(doors)).toMatchObject({ kit: "bd-block-church-14x17", tier: "xlarge" });
    // 그 문 뒤 실내: 배치 없이 hints.door 로 부르면 초대형 구성(방 8개 이상)
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "성당 실내", id: "c", check: { kind: "none" } }] }] });
    const plan = JSON.parse((await t.call("make_place", { type: "interior", name: "대성당", hints: { door: [9, 14] } }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
    expect(plan.ok, plan.summary).toBe(true);
    expect(plan.warnings.join(" ")).toContain("hints.door (9,14) = «첨탑 성당» (bd-house-cathedral, xlarge)");
    const rooms = plan.mapIds.flatMap((id) => (t.ctx.project.maps[id]?.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")));
    expect(rooms.length).toBeGreaterThanOrEqual(TIER_MIN_ROOMS.xlarge!);
  }, SLOW);
});
