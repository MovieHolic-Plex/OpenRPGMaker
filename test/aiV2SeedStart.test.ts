// 빈 시작 맵이 게임에 남지 않는다 — 2026-11-11 map-vqa 깔기 24판: 야영지·알현실·숲→동굴 요청에서 첫 장소를 깐 뒤에도 빈 시드 맵이 남아
// 시작이 그 위에 서거나(숲→동굴: 동굴 출구가 빈 맵으로 이어졌다), 마을 요청은 시작 칸이 지붕 뒤에 섰다.
// 첫 장소를 짓는 쓰기 뒤에 빈 시드 맵을 치우고 시작을 그 장소로 옮긴다. 치운 맵 id 로 온 뒤따른 호출은 시작 맵으로 고쳐 받는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { coveredCell } from "@/ai/v2/place/underRoof";
import { isRoadGround } from "@/ai/v2/place/surface";
import { roadEntranceStart } from "@/ai/v2/place/startSpot";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";

const SLOW = 120_000;

function turn(task: string, project = createBlankProject()) {
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
    preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const call = async (name: string, args: unknown): Promise<{ ok: boolean; body: string }> => {
    const body = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)
      .then((r) => (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"), (e: Error) => JSON.stringify({ ok: false, summary: e.message }));
    let ok = !/^Rejected:/u.test(body);
    try { const j = JSON.parse(body.split("\n")[0]!) as { ok?: boolean; notFailure?: boolean }; ok = j.ok !== false || j.notFailure === true; } catch { /* 거절 글은 JSON 이 아니다 */ }
    return { ok, body };
  };
  const todo = (name: string, placeKind: string) => call("todo", { op: "init", list: [{ phase: "p", items: [{ content: `${name} 만들기`, id: "place", check: { kind: "place", name, placeKind, fresh: true } }] }] });
  return { ctx, call, todo };
}

describe("첫 장소를 지으면 빈 시작 맵은 사라진다", () => {
  it("마을을 지으면 시작이 그 마을의 걷는 칸(지붕 밑이 아닌 곳)으로 가고 빈 시드 맵이 지워진다", async () => {
    const t = turn("마을을 만들어 줘.");
    await t.todo("새벽 마을", "village");
    const made = await t.call("make_place", { type: "village", name: "새벽 마을", size: "small" });
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    const project = t.ctx.project, map = project.maps[project.startMapId]!;
    expect(map.name).toBe("새벽 마을");
    expect(project.maps.map_blank_start).toBeUndefined();
    expect(isPassable(project, map, project.startPos.x, project.startPos.y)).toBe(true);
    expect(coveredCell(project, map, project.startPos.x, project.startPos.y)).toBe(false);
    // 들어오는 길이 있는 맵이면 시작은 그 길 위다.
    const road = roadEntranceStart(project, map);
    if (road) expect(isRoadGround(project, map, project.startPos.x, project.startPos.y)).toBe(true);
  }, SLOW);

  it("치워진 빈 시작 맵 id 로 온 호출은 시작 맵으로 고쳐 받고 그렇게 알린다", async () => {
    const t = turn("마을을 만들어 줘.");
    await t.todo("새벽 마을", "village");
    await t.call("make_place", { type: "village", name: "새벽 마을", size: "small" });
    const seen = await t.call("inspect", { mapId: "map_blank_start" });
    expect(seen.ok, seen.body.slice(0, 400)).toBe(true);
    expect(seen.body).toContain("was removed when the first place was built");
    expect(seen.body).toContain(t.ctx.project.startMapId);
  }, SLOW);
});

// 2026-11-12 Haiku 작은 일 셋째 묶음(password-safe · life-petals · ending-by-talks): 시작 맵이 「잿불 마을」 인 프로젝트의 둘째 맵 「동쪽 들판」
// (id 는 map_blank_start, 아직 풀밭 한 장)을 짓기 도구가 끝날 때마다 지웠다 — 모델이 create_map 으로 되살리면 또 지웠다.
// 자리표시 맵은 «이 요청이 시작될 때 게임이 시작하던 빈 맵» 뿐이다.
describe("시작이 다른 맵에 있는 프로젝트의 빈 맵은 치우지 않는다", () => {
  it("시작 맵이 따로 있는 프로젝트에서 쓰기 도구가 끝나도 map_blank_start(「동쪽 들판」)와 시작 맵이 그대로다", async () => {
    const project = buildFixture("starter");
    const start = project.startMapId;
    expect(start).not.toBe("map_blank_start");
    expect(project.maps.map_blank_start?.name).toBe("동쪽 들판");
    // 시작 맵에 무언가 지어진 뒤(바닥이 한 가지가 아니다)의 쓰기 — 측정에서 지워진 때와 같은 상태.
    const tiles = project.maps[start]!.lowerTiles;
    tiles[0] = tiles[0]! + 1;
    const t = turn("마을에 약초꾼을 세워 줘.", project);
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "약초꾼 세우기", id: "person", check: { kind: "person", name: "약초꾼" } }] }] });
    const made = await t.call("add_people", { mapId: start, people: [{ role: "약초꾼", name: "약초꾼", where: "광장", firstTalk: ["약초가 필요하니?"] }] });
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    expect(made.body).not.toContain("[Start map]");
    expect(t.ctx.project.maps.map_blank_start?.name).toBe("동쪽 들판");
    expect(t.ctx.project.startMapId).toBe(start);
  }, SLOW);
});
