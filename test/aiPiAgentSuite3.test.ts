import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { pngLargerThan } from "@/ai/piAgent/client";
import { PREVIEW_MAX } from "@/editor/openingAnimaticPreview";
import { PiRepeatBreaker, REPEAT_STEER_AT, REPEAT_STOP_AT } from "@/ai/piAgent/repeatBreaker";
import { defaultTeamSpec, enabledMembers, normalizeTeamSpec } from "@/ai/piAgent/teamSpec";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { type PiAgentDoneEvent, type PiAgentRequest, changedProjectKeys, encodePiAgentEvent, createPiAgentLineDecoder, type PiAgentEvent } from "@/ai/piAgent/protocol";
import { runPiTeam, type RunPiTeamOptions, missingReportSummary } from "../scripts/lib/piTeamRuntime";
import { mapCellApply } from "@/editor/incrementalMapApply";
import type { Project } from "@/project/types";
import { createPiAgentNdjsonStream } from "../scripts/lib/piAgentStream";
import { isolateTimers } from "./mergedTeardown";
import fs from "node:fs";
import { buildBrowserSeed, type QaBrief } from "../scripts/qa-game/lib/seed";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } from "../src/editor/welcomeGenrePresets";
import { buildPiRunRequest, buildUltrabrainPlanRequest, PLAN_MAX_TURNS, PLAN_ONLY_PREFIX } from "../src/ai/piAgent/plainTurn";

// 워커는 512×512 를 넘는 render PNG 를 거절하고(409) 그 거절이 턴 전체를 끊는다 — 2026-11-11 검수용 오프닝 표본이 384×648 이 돼 모든 턴이 끊겼다.
describe("piRenderSizeGuard", () => {
  isolateTimers();
  function png(width: number, height: number): string {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0); ihdr.write("IHDR", 4, "ascii"); ihdr.writeUInt32BE(width, 8); ihdr.writeUInt32BE(height, 12); ihdr[16] = 8; ihdr[17] = 6;
    return Buffer.concat([signature, ihdr, deflateSync(Buffer.alloc(8))]).toString("base64");
  }
  describe("pi render size guard", () => {
    it("names a PNG larger than the worker limit and lets one inside it through", () => {
      expect(pngLargerThan(png(384, 648), 512)).toBe("384×648");
      expect(pngLargerThan(png(513, 10), 512)).toBe("513×10");
      expect(pngLargerThan(png(512, 512), 512)).toBeUndefined();
      expect(pngLargerThan(png(303, 512), 512)).toBeUndefined();
      expect(pngLargerThan("not a png", 512)).toBeUndefined();
    });

    it("the review preview of a 384×216 stage fits the limit for 1–4 frames", () => {
      for (const rows of [1, 2, 3, 4]) {
        const tileWidth = Math.min(PREVIEW_MAX, 384, Math.floor(PREVIEW_MAX / rows * 384 / 216));
        expect(Math.ceil(tileWidth)).toBeLessThanOrEqual(PREVIEW_MAX);
        expect(Math.ceil(rows * tileWidth * 216 / 384)).toBeLessThanOrEqual(PREVIEW_MAX);
      }
    });
  });
  // 늦은 그림 한 장은 턴을 끊지 않는다 — 워커가 그 그림을 이미 버렸으면(409) 그 도구만 실패하고 실행은 끝까지 간다.
  describe("a render reply the worker no longer wants", () => {
    it("is dropped without ending the run", async () => {
      const { runPiAgentViaCompanion } = await import("@/ai/piAgent/client");
      const { resetHeavyWireForTests } = await import("@/ai/piAgent/heavyWire");
      const { createBlankProject } = await import("@/project/defaults");
      const enc = new TextEncoder();
      const line = (value: unknown) => enc.encode(JSON.stringify(value) + "\n");
      const project = createBlankProject();
      const renderPosts: string[] = [];
      const fetchImpl = (async (url: string, init?: RequestInit) => {
        if (String(url).includes("/v1/agent/render")) { renderPosts.push(String(init?.body)); return new Response(JSON.stringify({ error: "gone" }), { status: 409 }); }
        return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ seq: 0, type: "render_request", renderId: "r-1", toolName: "preview_opening_reference", data: {}, project: {}, unchangedKeys: [] }));
          setTimeout(() => { c.enqueue(line({ seq: 1, type: "done", project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] })); c.close(); }, 30);
        } }), { headers: { "X-Oprn-Run-Id": "run-1" } });
      }) as unknown as typeof fetch;
      const names: string[] = [];
      const result = await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, {
        fetchImpl, staleMs: 2_000, resumeDelayMs: 1, onEvent: (event) => { if (event.type === "execution_status") names.push(event.name); },
      });
      resetHeavyWireForTests();
      expect(renderPosts).toHaveLength(1);
      expect(JSON.parse(renderPosts[0]!).renderId).toBe("r-1");
      expect(names).toContain("render.dropped");
      expect(result.project).toBeTruthy();
    });
  });
});

describe("piRepeatBreaker", () => {
  isolateTimers();
  describe("반복 루프 차단", () => {
    it("키 순서만 바꾼 같은 무변화 호출을 세어 한 번 일러 주고 멈춘다", () => {
      const breaker = new PiRepeatBreaker();
      const verdicts = [];
      for (let i = 0; i < REPEAT_STOP_AT; i++) {
        const args = i % 2 ? { x: 15, y: 4, layers: { 3: [[3380]] } } : { layers: { 3: [[3380]] }, y: 4, x: 15 };
        verdicts.push(breaker.observe("stamp_layer_block", args, i === 0));
      }
      // 첫 호출은 맵을 바꿨다 → 두 번째부터 센다.
      expect(verdicts.filter(v => v?.action === "steer")).toHaveLength(1);
      expect(verdicts.findIndex(v => v?.action === "steer")).toBe(REPEAT_STEER_AT);
      expect(verdicts.at(-1)).toBeNull();
      expect(breaker.observe("stamp_layer_block", { x: 15, y: 4, layers: { 3: [[3380]] } }, false)?.action).toBe("stop");
    });

    it("맵이 바뀌거나 다른 호출이 끼면 처음부터 센다", () => {
      const breaker = new PiRepeatBreaker();
      for (let i = 0; i < 20; i++) {
        expect(breaker.observe("show_map_region", { mapId: "m" }, false)?.action === "stop").toBe(i + 1 >= REPEAT_STOP_AT);
        if (i === 5) { breaker.observe("paint_tiles", { mapId: "m" }, true); }
        if (i === 5) break;
      }
      expect(breaker.observe("show_map_region", { mapId: "m" }, false)).toBeNull();
      expect(breaker.observe("show_map_region", { mapId: "n" }, false)).toBeNull();
    });
  });
});

describe("piTeamSharedControls", () => {
  isolateTimers();
  const stats = { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 };
  function request(reviewAfterWork: boolean): PiAgentRequest {
    return { mode: "team", provider: "test", task: "최종 결과 확인", project: createBlankProject(), mapIds: [],
      team: { ...defaultTeamSpec(), workBudget: 600, reviewAfterWork } };
  }
  function done(req: PiAgentRequest): PiAgentDoneEvent { return { type: "done", project: req.project, stats, changedKeys: [] }; }
  describe("shared team controls", () => {
    it("normalizes shared settings and applies budget without deleting reviewer configuration", () => {
      const saved = normalizeTeamSpec({ ...defaultTeamSpec(), workBudget: 600, reviewAfterWork: false });
      expect(enabledMembers(saved, "builder")[0]!.maxTurns).toBe(600);
      expect(enabledMembers(saved, "reviewer")).toEqual([]);
      expect(saved.members.find(m => m.kind === "reviewer")!.enabled).toBe(true);
      expect(enabledMembers({ ...saved, reviewAfterWork: true }, "reviewer")[0]!.maxTurns).toBe(600);
    });
    it("runs a final read-only review even when the orchestrator omits review tools", async () => {
      const seen: PiAgentRequest[] = [];
      const runAgent: NonNullable<RunPiTeamOptions["runAgent"]> = async (req, options) => {
        seen.push(req);
        if (req.readOnly) {
          expect(options?.readOnlyTools).toBe(true);
          expect(req.maxTurns).toBe(600);
          const report = options!.extraTools!.find(tool => tool.name === "report_task")!;
          await report.execute("review", { report: "최종 사본 확인 완료" });
        }
        return done(req);
      };
      await runPiTeam(request(true), { runAgent });
      expect(seen).toHaveLength(2);
      expect(seen[1]!.readOnly).toBe(true);
    });
    it("does not run a reviewer when review is off", async () => {
      const seen: PiAgentRequest[] = [];
      await runPiTeam(request(false), { runAgent: async req => { seen.push(req); return done(req); } });
      expect(seen).toHaveLength(1);
    });
    it("skips the final review with a report line when no reviewer is enabled, but never without a report", async () => {
      const req = request(true);
      const events: unknown[] = [];
      const seen: PiAgentRequest[] = [];
      await runPiTeam({ ...req, team: { ...req.team!, members: req.team!.members.filter(m => m.kind !== "reviewer") } },
        { runAgent: async r => { seen.push(r); return done(r); }, onEvent: e => events.push(e) });
      expect(seen).toHaveLength(1);
      expect(events).toContainEqual(expect.objectContaining({ type: "team_report", text: expect.stringContaining("검수 담당이 없어 생략") }));
      await expect(runPiTeam(req, { runAgent: async r => done(r) })).rejects.toThrow("완료 후 검토를 끝내지 못했습니다");
    });
    // 「마을 계약(villageContract) 벗기기」 사례는 은퇴 — author_village 와 villageContract 요청 필드가 2026-10-07 저작권 정리로 삭제됐다(toolRegistry CONSTRUCTION_WRITE_SUPERSEDED 주석).
  });
});

describe("protocol", () => {
  isolateTimers();
  describe("incrementalMapApply", () => {
    isolateTimers();
    function project(): Project {
      const map = createBlankMap("m1", 8, 6);
      map.id = "m1";
      return { maps: { m1: map }, tilesets: { ts: { id: "ts", image: "x" } }, database: { actors: [] } } as unknown as Project;
    }
    describe("mapCellApply", () => {
      it("returns only the painted cells when the rest of the project is the same object", () => {
        const before = project();
        const map = { ...before.maps.m1!, lowerTiles: before.maps.m1!.lowerTiles.slice() };
        map.lowerTiles[3] = 9;
        const after = { ...before, maps: { ...before.maps, m1: map } };
        const cells = mapCellApply(before, after, "m1");
        expect(cells?.mapId).toBe("m1");
        expect(cells?.cells.some((cell) => cell.x === 3 && cell.y === 0 && cell.layer === "lower")).toBe(true);
        expect(cells!.cells.filter((cell) => cell.layer === "lower")).toHaveLength(1);
      });

      it("keeps a full redraw when the tileset object changes", () => {
        const before = project();
        const after = { ...before, tilesets: { ...before.tilesets } };
        expect(mapCellApply(before, after, "m1")).toBeNull();
      });
    });
    describe("changedProjectKeys", () => {
      it("does not treat a shared tileset reference as a change", () => {
        const before = project();
        const map = { ...before.maps.m1!, lowerTiles: before.maps.m1!.lowerTiles.slice() };
        map.lowerTiles[0] = 4;
        const after = { ...before, maps: { ...before.maps, m1: map } };
        expect(changedProjectKeys(before, after)).toEqual(["maps.m1"]);
      });
    });
    describe("toolMapCellApply", () => {
      it("recognizes cloned inputs and covers overlays, shadows and stacks", async () => {
        const { toolMapCellApply } = await import("@/editor/incrementalMapApply");
        const { setLayerTileAt, setShadowAt } = await import("@/project/mapLayers");
        const before = project();
        const after = structuredClone(before);
        const map = after.maps.m1!;
        setLayerTileAt(map, 2, 9, 10);
        setLayerTileAt(map, 4, 10, 11);
        setShadowAt(map, 11, 3);
        map.upperTileStacks = { 12: [1, 2] };
        expect(toolMapCellApply(before, after)).toEqual({ mapId: "m1", cells: [
          { x: 1, y: 1, layer: "lower" }, { x: 2, y: 1, layer: "upper" },
          { x: 3, y: 1, layer: "lower" }, { x: 4, y: 1, layer: "upper" },
        ] });
        expect(before.maps.m1!.lowerOverlayTiles).toBeUndefined();
      });
      it("keeps full notifications for multiple maps, events, metadata and project data", async () => {
        const { toolMapCellApply } = await import("@/editor/incrementalMapApply");
        const before = project();
        before.maps.m2 = { ...before.maps.m1!, id: "m2" };
        for (const edit of [
          (p: Project) => { p.maps.m2!.lowerTiles[0] = 8; },
          (p: Project) => { p.maps.m1!.name = "renamed"; },
          (p: Project) => { p.maps.m1!.width += 1; },
          (p: Project) => { p.maps.m1!.events.push({ id: "new", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }); },
          (p: Project) => { p.database.actors = [{ id: "new" }] as never; },
          (p: Project) => { delete p.maps.m2; },
        ]) {
          const after = structuredClone(before);
          after.maps.m1!.lowerTiles[0] = 7;
          edit(after);
          expect(toolMapCellApply(before, after)).toBeNull();
        }
      });
    });
  });
  // 오너 2026-11-09 monster «terminated» 조사: 이벤트 하나가 인코딩에서 던지면 예전 write() 가 stop() 으로 heartbeat 까지 영구 중지했다.
  // 이 시험은 인코더가 한 번 던져도 heartbeat 가 계속 나가고 뒤 이벤트가 도착하며, 빠진 줄이 error 줄로 알려지는 것을 단언한다.
  describe("piAgentStreamGuard", () => {
    isolateTimers();
    async function collect(stream: ReadableStream<Uint8Array>, until: (events: PiAgentEvent[]) => boolean): Promise<PiAgentEvent[]> {
      const events: PiAgentEvent[] = [];
      const decoder = createPiAgentLineDecoder((event) => events.push(event));
      const reader = stream.getReader();
      const text = new TextDecoder();
      while (!until(events)) {
        const { value, done } = await reader.read();
        if (done) break;
        decoder.push(text.decode(value, { stream: true }));
      }
      await reader.cancel();
      return events;
    }
    describe("worker NDJSON stream survives an event that cannot be encoded", () => {
      it("keeps the heartbeat running, reports the dropped event, and delivers later events", async () => {
        let encodes = 0;
        const encodeEvent = (event: PiAgentEvent): string => {
          encodes += 1;
          if ((event as { type?: string }).type === "execution_status" && (event as { name?: string }).name === "poison") throw new RangeError("Invalid string length");
          return encodePiAgentEvent(event);
        };
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => { finish = resolve; });
        const stream = createPiAgentNdjsonStream(async (onEvent) => {
          onEvent({ type: "execution_status", name: "poison", ok: true, summary: "x" } as PiAgentEvent);
          await finished;
        }, { heartbeatMs: 15, encodeEvent });
        const reader = collect(stream, (events) => {
          const beats = events.filter((e) => e.type === "heartbeat").length;
          if (beats >= 3) finish();
          return beats >= 3 && events.some((e) => e.type === "error");
        });
        const events = await reader;
        expect(events.filter((e) => e.type === "heartbeat").length).toBeGreaterThanOrEqual(3);
        const error = events.find((e) => e.type === "error") as { message?: string } | undefined;
        expect(error?.message).toContain("could not be encoded");
        expect(error?.message).toContain("execution_status");
        expect(encodes).toBeGreaterThan(1);
      });

      it("a later event after the failed one still arrives", async () => {
        let calls = 0;
        const encodeEvent = (event: PiAgentEvent): string => {
          calls += 1;
          if (calls === 1) throw new Error("boom");
          return encodePiAgentEvent(event);
        };
        const stream = createPiAgentNdjsonStream(async (onEvent) => {
          onEvent({ type: "execution_status", name: "first", ok: true, summary: "dropped" } as PiAgentEvent);
          onEvent({ type: "execution_status", name: "second", ok: true, summary: "kept" } as PiAgentEvent);
        }, { heartbeatMs: 1000, encodeEvent });
        const events = await collect(stream, () => false);
        const names = events.filter((e) => e.type === "execution_status").map((e) => (e as { name?: string }).name);
        expect(names).toEqual(["second"]);
        expect(events.some((e) => e.type === "error")).toBe(true);
      });
    });
  });
  // report_task 없이 끝난 팀원 — 이미 반영된 변경을 팀장에게 밝힌다(2026-10-05: 재배정이 세계관을 덮어쓰고 맵을 한 벌 더 만들었다).
  describe("piTeamMissingReport", () => {
    isolateTimers();
    describe("보고 없이 끝난 팀원 요약", () => {
      it("새 맵·고친 맵·바뀐 데이터와 팀원의 마지막 말을 전한다", () => {
        const before = createBlankProject();
        const after = structuredClone(before);
        const first = Object.keys(after.maps)[0]!;
        after.maps.map_town = { ...structuredClone(after.maps[first]!), id: "map_town", name: "마을" };
        after.maps[first]!.name = "시작 바뀜";
        (after as unknown as { worldCanon: unknown }).worldCanon = { title: "아르테리아" };
        const summary = missingReportSummary(before, after, changedProjectKeys(before, after), "동굴은 칩셋 변경 확인이 필요합니다.");
        expect(summary).toContain("새 맵 마을(map_town)");
        expect(summary).toContain(`고친 맵 시작 바뀜(${first})`);
        expect(summary).toContain("worldCanon");
        expect(summary).not.toContain("maps.");
        expect(summary).toContain("다시 맡기지 말고");
        expect(summary).toContain("칩셋 변경 확인");
      });

      it("반영된 변경이 없으면 그렇게 말한다", () => {
        const project = createBlankProject();
        expect(missingReportSummary(project, project, [], undefined)).toBe("report_task 없이 끝나 완료로 치지 않았다. 프로젝트에 반영된 변경은 없다.");
      });
    });
  });
});

describe("qaGameGen", () => {
  isolateTimers();
  const brief = JSON.parse(fs.readFileSync("scripts/qa-game/briefs/lighthouse-jrpg.json", "utf8")) as QaBrief;
  describe("qa-game gen — 브라우저 「이 기획으로 시작」과 같은 출발점", () => {
    it("시드는 기획을 품고 generationPending 을 지운 채 시작한다", () => {
      const { project, brief: normalized } = buildBrowserSeed(brief);
      expect(project.meta.title).toBe(brief.title);
      expect(project.gameDesignBrief?.presetId).toBe(brief.presetId);
      expect(project.gameDesignBrief).not.toHaveProperty("generationPending");
      expect(Object.keys(project.maps).length).toBeGreaterThan(0);
      const preset = welcomeGenrePresetById(brief.presetId);
      expect(preset).toBeTruthy();
      expect(buildWelcomeGenrePresetPrompt(preset!, normalized).length).toBeGreaterThan(200);
    });

    it("계획 턴·실행 요청은 패널과 같은 빌더에서 나온다", () => {
      const { project } = buildBrowserSeed(brief);
      const brain = { provider: "google-antigravity", model: "gemini-3.8-flash", effort: "high" } as never;
      const plan = buildUltrabrainPlanRequest({ brain, modelTask: "과제", mapIds: [project.startMapId], project, scopedByUser: false });
      expect(plan.readOnly).toBe(true);
      expect(plan.maxTurns).toBe(PLAN_MAX_TURNS);
      expect(plan.task.startsWith(PLAN_ONLY_PREFIX)).toBe(true);
      const run = buildPiRunRequest({
        team: false, planOnly: false, readOnly: false, applyMode: "default", villageContract: undefined,
        brain, deep: { provider: "google-antigravity", model: "gemini-3.7-flash" }, writer: undefined,
        modelTask: "과제", executionTask: "실행 과제", mapIds: [project.startMapId], project, scopedByUser: false, mapBundleMerge: true,
      } as never);
      expect(run.task).toBe("실행 과제");
    });
  });
});
