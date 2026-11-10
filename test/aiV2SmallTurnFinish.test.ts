// 작은 요청은 지은 게임에서도 청사진 끝맺음을 돌리지 않는다(2026-11-11 작은 일 기준선: 불합격 7건 중 2건이
// 모델이 맞게 끝낸 뒤 끝맺음 단계 lanes 가 요청과 무관한 사람을 옮겨서였다 — openwiki/assistant-v2.md 「작은 요청의 끝맺음」).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import { createV2Tools } from "@/ai/v2/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { finishBuildPending, runFinishAutoBuild } from "@/ai/v2/finishAutoBuild";
import { indexProject } from "@/ai/v2/loop/refs";
import type { PiAssistantV2Env } from "@/ai/v2/env";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";

const SLOW = 180_000;
const mapNamed = (project: Project, name: string) => Object.values(project.maps).find((m) => m?.name === name)!;

/** 지은 게임(《얼음 아래의 노래》)에서 도구 한 번을 부른 뒤, 그 요청 글로 끝맺음을 돌려 요청 밖에서 바뀐 것을 센다. */
async function finishAfter(task: string, act: (ctx: ToolContext) => void) {
  const project = buildFixture("built");
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env: PiAssistantV2Env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","small-finish"]` } as never,
    emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
  };
  const session = new V2Session();
  createV2Tools(env, session);
  act(ctx);
  const before = indexProject(ctx.project);
  await runFinishAutoBuild(env, session);
  const after = indexProject(ctx.project);
  const changed = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>) => [...b].filter(([k, v]) => a.get(k) !== v).map(([k]) => k);
  return { events: changed(before.events, after.events), maps: changed(before.maps, after.maps), pending: finishBuildPending(env, session) };
}

const backDoor = (ctx: ToolContext) => {
  const hall = mapNamed(ctx.project, "족장의 긴 집"), market = mapNamed(ctx.project, "겨울 시장");
  const made = runTool(ctx, "create_transfer_pair", { a: { mapId: hall.id, x: 3, y: 3 }, b: { mapId: market.id, x: 20, y: 12 } });
  expect(made.ok, made.summary).toBe(true);
};

describe("끝맺음 — 작은 요청은 요청한 것만 남긴다", () => {
  it("뒷문 하나: 끝맺음이 다른 사람·맵을 건드리지 않고, 뒤에 지을 것도 남기지 않는다", async () => {
    const out = await finishAfter("족장의 긴 집에 뒷문을 하나 만들어 줘. 그 문으로 나가면 겨울 시장으로 가게 해 줘", backDoor);
    expect(out.events).toEqual([]);
    expect(out.maps).toEqual([]);
    expect(out.pending).toBe(false);
  }, SLOW);

  it("사람 옮기기: 모델이 놓은 칸 그대로다", async () => {
    let at = "";
    const out = await finishAfter("떠돌이 상인을 족장의 긴 집 문 앞으로 옮겨 줘", (ctx) => {
      const map = Object.values(ctx.project.maps).find((m) => m?.events.some((e) => e.name === "떠돌이 상인"))!;
      const merchant = map.events.find((e) => e.name === "떠돌이 상인")!;
      const moved = runTool(ctx, "move_event", { mapId: map.id, eventId: merchant.id, x: 21, y: 17 });
      expect(moved.ok, moved.summary).toBe(true);
      at = `${map.id}:${merchant.id}`;
    });
    expect(at).not.toBe("");
    expect(out.events).toEqual([]);
  }, SLOW);

  it("이어 하기(게임 하나를 잇는 턴)는 전처럼 끝맺음이 돈다 — 새 문 앞 길목의 사람을 비킨다", async () => {
    const out = await finishAfter("계속", backDoor);
    expect(out.events.length).toBeGreaterThan(0);
  }, SLOW);
});
