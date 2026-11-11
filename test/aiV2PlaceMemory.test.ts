// 장소 설계는 턴을 넘어 남는다(2026-11-11 B4b, openwiki/assistant-v2.md 「장소 설계는 턴을 넘어 남는다」):
// 앞 턴이 지은 장소를 다음 턴(새 세션)의 edit_place 가 그 설계에서 고친다. 조수 밖에서 바뀐 맵은 설계를 버리고 이유와 되는 도구를 이른다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import type { Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { indexProject } from "@/ai/v2/loop/refs";
import { loadPlaces, savePlaces, type PlaceMemory } from "@/ai/v2/tools/placeMemory";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";

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
