import { describe, expect, it, afterEach, vi } from "vitest";
import { allTools, getTool, toOpenAiTools, TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { generateToolCatalogMarkdown } from "@/editor/tools/toolCatalog";
import { runTool } from "@/editor/tools/toolRunner";
import { listHeadlessMcpTools, runHeadlessTool, isHeadlessPackagePath, listHeadlessTools, loadHeadlessProject, loadHeadlessProjectFromPackage } from "@/headless";
import { audioDescriptionToolProject, MUSIC_ID } from "./support/audioDescriptionToolProject";
import { createInterpreter } from "@/player/interpreter";
import { EventRunLog, activeEventRunLog, installEventRunLog, type EventRunCommandEntry } from "@/player/eventRunLog";
import { installPlaySceneTestHooks } from "@/player/playSceneTestHooks";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { goblinId, monsterContext, monsterWriters } from "./monsterAiFixture";
import { isolateTimers } from "./mergedTeardown";
import { createPiToolset, harvestFindToolsNames, resolvePiToolShape, selectPiToolDefinitions } from "@/ai/piAgent/toolAdapter";
import { piMapScopeGuard } from "@/ai/piAgent/protocol";
import assert from "node:assert/strict";
import { deserialize, serialize } from "@/project/io";
import type { ToolContext } from "@/editor/tools/types";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

describe("eventRunLog", () => {
  isolateTimers();
  describe("audioDescriptionToolExposure", () => {
    isolateTimers();
    describe("audio description tool exposure", () => {
      it.each([
        ["get_audio_resource", "read"],
        ["set_audio_description", "write"],
      ] as const)("exposes %s through registry, schema, catalog, and discovery", (name, mode) => {
        // Given
        const project = audioDescriptionToolProject();
        // When
        const discovery = runTool({ project }, "find_tools", { query: name, domain: "system" });
        // Then
        expect(getTool(name)?.mode).toBe(mode);
        expect(allTools().some(tool => tool.name === name)).toBe(true);
        expect(toOpenAiTools().find(tool => tool.function.name === name)?.function.parameters.required)
          .toEqual(expect.arrayContaining(["kind", "resourceId"]));
        expect(toOpenAiTools(undefined, { mode: "system" }).some(tool => tool.function.name === name)).toBe(true);
        expect(listHeadlessMcpTools().some(tool => tool.name === name)).toBe(true);
        expect(generateToolCatalogMarkdown()).toContain(`\`${name}\``);
        expect(discovery.data).toMatchObject({ matches: expect.arrayContaining([expect.objectContaining({ name, mode })]) });
      });

      it("reports a headless description-only preview without modifying the supplied project", () => {
        // Given
        const project = audioDescriptionToolProject();
        const before = structuredClone(project);
        // When
        const result = runHeadlessTool(project, "set_audio_description", {
          kind: "music", resourceId: MUSIC_ID, action: "set", description: "headless sentinel",
        });
        // Then
        expect(result.ok, result.summary).toBe(true);
        expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
        expect(project).toEqual(before);
      });

      it("exposes the nested upsert description schema", () => {
        // Given
        const tools = toOpenAiTools();
        // When
        const resourceSchema = tools.find(tool => tool.function.name === "upsert_resource")
          ?.function.parameters.properties?.resource;
        // Then
        expect(resourceSchema?.properties?.description).toMatchObject({ type: "string" });
        expect(resourceSchema?.required).not.toContain("description");
      });
    });
  });
  // test/eventRunLog.test.ts
  // 테스트 플레이 이벤트 실행 기록(ED5 #1): 인터프리터 추적·한 단계 멈춤·손 편집 표시·조수 읽기 도구·설치 경계.
  describe("eventRunLog", () => {
    isolateTimers();
    function session(): PlaySessionLike {
      return { currentMapId: "map_a", x: 0, y: 0, switches: {}, variables: {}, selfSwitches: {}, inventory: {}, gold: 0, flags: {}, timers: {} } as unknown as PlaySessionLike;
    }
    const commands: Command[] = [
      { kind: "setSwitch", switchId: "sw_door", value: true },
      { kind: "setVariable", variableId: "v_gold", op: "+=", value: 5 },
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_door", value: true },
        then: [{ kind: "setVariable", variableId: "v_gold", op: "+=", value: 1 }],
        else: [{ kind: "setVariable", variableId: "v_gold", op: "=", value: 0 }],
      } as Command,
    ];
    function drain(interpreter: ReturnType<typeof createInterpreter>): void {
      let result = interpreter.start();
      for (let guard = 0; result.kind !== "done" && guard < 100; guard += 1) result = interpreter.resume(undefined);
    }
    let uninstall: (() => void) | undefined;
    afterEach(() => {
      uninstall?.();
      uninstall = undefined;
    });
    describe("event run log", () => {
      it("records each executed command with switch/variable effects and the fork branch taken", () => {
        const log = new EventRunLog(() => 0);
        const s = session();
        const trace = log.trace("foreground", s, "ev_gate");
        drain(createInterpreter(commands, s, undefined, { trace, currentEventId: "ev_gate" }));
        trace.end("completed");

        const entries = log.query().entries;
        expect(entries.map((entry) => entry.type)).toEqual(["runStart", "command", "command", "command", "command", "runEnd"]);
        const executed = entries.filter((entry): entry is EventRunCommandEntry => entry.type === "command");
        expect(executed.map((entry) => entry.kind)).toEqual(["setSwitch", "setVariable", "fork", "setVariable"]);
        expect(executed[0]?.effect).toEqual({ switchId: "sw_door", before: false, after: true });
        expect(executed[1]?.effect).toEqual({ variableId: "v_gold", before: 0, after: 5 });
        expect(executed[2]?.branch).toBe("then");
        expect(executed[3]).toMatchObject({ depth: 1, effect: { variableId: "v_gold", before: 5, after: 6 } });
        expect(log.query({ kind: "fork" }).entries).toHaveLength(1);
      });

      it("single-step pauses a foreground event before each command and runs the released command exactly once", () => {
        const log = new EventRunLog(() => 0);
        const s = session();
        log.setStepping(true);
        const interpreter = createInterpreter(commands, s, undefined, { trace: log.trace("foreground", s, "ev_gate") });

        expect(interpreter.start()).toEqual({ kind: "debugStep" });
        expect(log.stepState().paused).toMatchObject({ kind: "setSwitch", pc: 0 });
        expect(s.switches.sw_door).toBeUndefined();

        log.next();
        expect(interpreter.resume(undefined)).toEqual({ kind: "debugStep" });
        expect(s.switches.sw_door).toBe(true);
        expect(log.stepState().paused).toMatchObject({ kind: "setVariable", pc: 1 });
        expect(s.variables.v_gold ?? 0).toBe(0);

        log.setStepping(false);
        let result = interpreter.resume(undefined);
        for (let guard = 0; result.kind !== "done" && guard < 10; guard += 1) result = interpreter.resume(undefined);
        expect(result.kind).toBe("done");
        expect(s.variables.v_gold).toBe(6);
      });

      it("never pauses parallel events, even in single-step mode", () => {
        const log = new EventRunLog(() => 0);
        const s = session();
        log.setStepping(true);
        const result = createInterpreter(commands, s, undefined, { trace: log.trace("parallel", s, "ev_clock") }).start();
        expect(result.kind).toBe("done");
        expect(s.variables.v_gold).toBe(6);
        expect(log.query({ source: "parallel", type: "command" }).entries).toHaveLength(4);
      });

      it("an interpreter without a trace never yields debugStep", () => {
        const s = session();
        expect(createInterpreter(commands, s).start().kind).toBe("done");
      });

      it("keeps only the newest entries past capacity and reports how many were dropped", () => {
        const log = new EventRunLog(() => 0, 3);
        const s = session();
        const trace = log.trace("foreground", s);
        drain(createInterpreter(commands, s, undefined, { trace }));
        const result = log.query();
        expect(result.entries).toHaveLength(3);
        expect(result.dropped).toBe(2);
        expect(result.entries.at(-1)?.seq).toBe(result.lastSeq);
      });
    });
    describe("test-play install boundary and hand edits", () => {
      const previousWindow = globalThis.window;
      afterEach(() => {
        if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
        else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
      });

      it("is installed only by the QA hook installer and marks debug-panel switch/variable edits", () => {
        const testWindow = { location: { search: "" } } as unknown as Window & { __oprnEventRunLog?: unknown; __oprnDebug?: { setSwitch(id: string, v: boolean): void; setVariable(id: string, v: number): void } };
        Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
        expect(activeEventRunLog()).toBeUndefined();
        expect(testWindow.__oprnEventRunLog).toBeUndefined();

        const s = { currentMapId: "map_a", x: 1, y: 1, switches: {} as Record<string, boolean>, variables: {} as Record<string, number>, inventory: {}, gold: 0, flags: {}, timers: {} };
        const shutdown: Array<() => void> = [];
        const scene = { events: { once: vi.fn((_name: string, fn: () => void) => shutdown.push(fn)) }, getMapId: () => s.currentMapId, tileX: 1, tileY: 1 };
        installPlaySceneTestHooks(scene as never, { injectActionEdge: vi.fn() } as never, () => s as never, vi.fn());
        expect(activeEventRunLog()).toBeDefined();
        expect(testWindow.__oprnEventRunLog).toBeDefined();

        testWindow.__oprnDebug!.setSwitch("sw_door", true);
        testWindow.__oprnDebug!.setVariable("v_gold", 7);
        expect(activeEventRunLog()!.query({ type: "handEdit" }).entries.map((entry) => entry.type === "handEdit" && entry.effect)).toEqual([
          { switchId: "sw_door", before: false, after: true },
          { variableId: "v_gold", before: 0, after: 7 },
        ]);

        for (const fn of shutdown) fn();
        expect(activeEventRunLog()).toBeUndefined();
        expect(testWindow.__oprnEventRunLog).toBeUndefined();
      });

      it("read_event_run_log returns available=false without a test play and the structured log with one", () => {
        const tool = getTool("read_event_run_log");
        expect(tool?.mode).toBe("read");
        Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
        const project = createBlankProject();
        expect(tool!.run(project, {})).toMatchObject({ data: { available: false } });

        const log = new EventRunLog(() => 0);
        uninstall = installEventRunLog(log);
        const s = session();
        const trace = log.trace("foreground", s, "ev_gate");
        drain(createInterpreter(commands, s, undefined, { trace }));
        const result = tool!.run(project, { eventId: "ev_gate", kind: "setSwitch" }) as { data: { available: boolean; entries: EventRunCommandEntry[] } };
        expect(result.data.available).toBe(true);
        expect(result.data.entries.map((entry) => entry.effect)).toEqual([{ switchId: "sw_door", before: false, after: true }]);
      });
    });
  });
  describe("headlessTools", () => {
    isolateTimers();
    describe("headless tool runner", () => {
      it("loads project JSON through deserialize validation", () => {
        const project = createScarloxyDemoProject();
        const loaded = loadHeadlessProject(JSON.stringify(project));
        expect(loaded.meta.title).toBe(project.meta.title);
        expect(Object.keys(loaded.maps)).toEqual(Object.keys(project.maps));
      });

      // 헤드리스 CLI/MCP 가 --project 로 받는 패키지 판정. 현재 확장자 .oprn 이 우선이고 옛 .rpgzzu 도 계속 연다.
      it("treats .oprn as the package extension and still accepts legacy .rpgzzu", () => {
        expect(isHeadlessPackagePath("/tmp/game.oprn")).toBe(true);
        expect(isHeadlessPackagePath("/tmp/legacy.rpgzzu")).toBe(true);
        expect(isHeadlessPackagePath("/tmp/Game.OPRN")).toBe(true);
        expect(isHeadlessPackagePath("/tmp/project.json")).toBe(false);
        expect(isHeadlessPackagePath("/tmp/game.oprn.json")).toBe(false);
      });

      it("names the current package extension when a package lacks project.json", () => {
        expect(() => loadHeadlessProjectFromPackage(new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])))
          .toThrow(/\.oprn/);
      });

      it("exposes every registry tool with accurate read/write mode metadata", () => {
        const headlessTools = listHeadlessTools();
        expect(headlessTools).toHaveLength(allTools().length);
        for (const tool of allTools()) {
          expect(headlessTools.find((entry) => entry.name === tool.name)).toMatchObject({
            name: tool.name,
            mode: tool.mode,
            parameters: tool.parameters,
          });
        }

        const mcpTools = listHeadlessMcpTools();
        expect(mcpTools).toHaveLength(allTools().length);
        for (const tool of allTools()) {
          const listed = mcpTools.find((entry) => entry.name === tool.name);
          expect(listed?.inputSchema).toBe(tool.parameters);
          if (tool.mode === "write") expect(listed?.description).toContain("[dry-run only]");
          else expect(listed?.description).not.toContain("[dry-run only]");
        }
      });

      it("runs write tools as dry-run diff only and preserves the original project", () => {
        const project = createScarloxyDemoProject();
        const before = JSON.stringify(project);
        const result = runHeadlessTool(project, "create_map", { name: "헤드리스 실험", width: 12, height: 10 });

        expect(result.ok).toBe(true);
        expect(result.diff?.mapsAdded).toBe(1);
        expect(result.data).toBeUndefined();
        expect(JSON.stringify(project)).toBe(before);
      });

      it("new headless surfaces do not import write commit or remote transport paths", async () => {
        const fsModule = "node:fs";
        const pathModule = "node:path";
        const fs = (await import(fsModule)) as {
          readFileSync(path: string, encoding: "utf8"): string;
          readdirSync(path: string, options?: { withFileTypes?: false }): string[];
          statSync(path: string): { isDirectory(): boolean };
        };
        const path = (await import(pathModule)) as {
          join(...segments: string[]): string;
        };
        const targets = [
          ...collectFiles(fs, path, "src/headless"),
          "scripts/oprn-tools.mjs",
          "scripts/oprn-mcp-server.mjs",
        ];
        const forbidden = [
          /import\s+.*applyChangesetToStore/,
          /import\s+.*commitChangeset/,
          /import\s+.*legacyDb/i,
          /from\s+["'][^"']*legacyDb[^"']*["']/i,
        ];

        for (const target of targets) {
          const source = fs.readFileSync(target, "utf8");
          const importLines = source.split("\n").filter((line) => /^\s*import\b/.test(line)).join("\n");
          for (const pattern of forbidden) {
            expect(importLines, target).not.toMatch(pattern);
          }
        }
      });
    });
    function collectFiles(
      fs: {
        readdirSync(path: string, options?: { withFileTypes?: false }): string[];
        statSync(path: string): { isDirectory(): boolean };
      },
      path: { join(...segments: string[]): string },
      root: string
    ): string[] {
      const files: string[] = [];
      for (const entry of fs.readdirSync(root)) {
        const fullPath = path.join(root, entry);
        if (fs.statSync(fullPath).isDirectory()) files.push(...collectFiles(fs, path, fullPath));
        else files.push(fullPath);
      }
      return files;
    }
  });
  describe("monsterResourceTools", () => {
    isolateTimers();
    describe("monster resource lookup", () => {
      it("returns every entry when no pagination is requested", () => {
        // Given a project exceeding the generic lookup cap.
        const ctx = monsterContext();
        const ids = Array.from({ length: 61 }, (_, i) => `upload-monster-${i}`);
        for (const id of ids) ctx.project.assets.uploaded[id] = { id, name: id, kind: "monster", dataUrl: "", meta: {} };
        // When the model asks for the default index.
        const result = runTool(ctx, "list_monster_resources", {});
        // Then no registered entry is silently paginated.
        expect(result.ok).toBe(true);
        expect(result.data).toMatchObject({ complete: true, nextOffset: null, unknownIds: [], resources: expect.arrayContaining(ids.map(resourceId => expect.objectContaining({ resourceId, name: resourceId, tags: expect.any(Array), origin: "uploaded", reviewStatus: "unreviewed", sources: expect.any(Object) }))) });
      });

      it.each([{ limit: 0 }, { offset: -1 }, { offset: 0.5 }, { include: "summary" }, { ids: [1] }, { query: {} }, { surprise: true }])(
        "rejects malformed arguments %j", args => {
          // Given a registered lookup boundary.
          const ctx = monsterContext();
          // When malformed arguments cross it.
          const result = runTool(ctx, "list_monster_resources", args);
          // Then the failure is argument validation, not an unknown tool.
          expect(result.issues?.[0]?.code).toBe("invalid-args");
        },
      );

      it("reports exact unknown IDs when an explicit ID query contains missing resources", () => {
        // Given known and unknown exact identities.
        const ctx = monsterContext();
        // When querying them together.
        const result = runTool(ctx, "list_monster_resources", { ids: [goblinId, "missing"], include: "full" });
        // Then the missing identity is not replaced by a fuzzy match.
        expect(result.data).toMatchObject({ total: 1, returned: 1, unknownIds: ["missing"], complete: true, resources: [expect.objectContaining({ resourceId: goblinId })] });
      });

      it("reports explicit pagination without pretending the page is complete", () => {
        // Given more resources than the requested page.
        const ctx = monsterContext();
        // When requesting one entry.
        const result = runTool(ctx, "list_monster_resources", { limit: 1 });
        // Then the continuation describes the exact returned page.
        expect(result.data).toMatchObject({ returned: 1, nextOffset: 1, complete: false });
      });

      it("rejects a missing exact detail instead of substituting a similar identity", () => {
        // Given only real registered resources.
        const ctx = monsterContext();
        // When requesting an invented identity.
        const result = runTool(ctx, "get_monster_resource", { resourceId: `${goblinId}-missing` });
        // Then lookup fails explicitly.
        expect(result.issues?.[0]?.code).toBe("monster-resource-not-found");
      });

      it("exposes monster reads in trimmed database tools", () => {
        // Given the production trimmed exposure.
        const tools = toOpenAiTools(undefined, { domains: new Set(["core", "database"]) });
        // When inspecting the machine-consumed function names.
        const names = tools.map(tool => tool.function.name);
        // Then all appearance writers can discover full selected metadata.
        expect(names).toEqual(expect.arrayContaining(["list_monster_resources", "get_monster_resource", ...monsterWriters.map(writer => writer.name)]));
      });
    });
    describe.each(monsterWriters)("$name monster-kind safety", writer => {
      it.each(["picture", "music"] as const)("rejects uploaded %s even with a monster-looking ID", kind => {
        // Given an explicitly non-monster upload with a misleading identity.
        const ctx = monsterContext();
        ctx.project.assets.uploaded[goblinId].kind = kind;
        ctx.project.resourceProfiles.push({ kind: "monster", name: "Misleading profile", assetId: goblinId });
        const before = ctx.project;
        // When attempting to persist it as monster art.
        const result = runTool(ctx, writer.name, writer.args({ monsterResourceId: goblinId }));
        // Then no mutation escapes the transactional runner.
        expect(result.ok).toBe(false);
        expect(ctx.project).toBe(before);
      });
    });
  });
});

describe("recommendBgm", () => {
  isolateTimers();
  describe("piAgentToolAdapter", () => {
    isolateTimers();
    describe("piAgent toolAdapter", () => {
      it("살아 있는 레지스트리 툴을 전부 Pi 툴 모양으로 감싼다", () => {
        const live = TOOL_REGISTRY.filter((tool) => !tool.deprecated && tool.supersededBy === undefined);
        const tools = createPiToolset({ project: createBlankProject() });
        expect(tools.map((tool) => tool.name).sort()).toEqual([...new Set(live.map((tool) => tool.name))].sort());
        expect(tools.length).toBe(new Set(tools.map(tool => tool.name)).size);
        expect(selectPiToolDefinitions(undefined, { toolNames: [] })).toEqual([]);
        for (const tool of tools) {
          expect(tool.label).toBe(tool.name);
          expect(typeof tool.description).toBe("string");
          expect(tool.parameters).toBeTruthy();
          expect(typeof tool.execute).toBe("function");
          // Every registry tool, including newly discovered tools, must carry a policy.
          expect(tool.concurrency).toBe(live.find(def => def.name === tool.name)!.mode === "read" ? "shared" : "exclusive");
        }
      });

      it("도메인을 주면 그 도메인 + 범용 툴만 고른다", () => {
        const selected = selectPiToolDefinitions(["tile"]);
        expect(selected.length).toBeGreaterThan(0);
        for (const tool of selected) {
          expect(tool.deprecated).not.toBe(true);
          expect(!tool.domains || tool.domains.length === 0 || tool.domains.includes("tile")).toBe(true);
        }
        expect(selected.some((tool) => !tool.domains || tool.domains.length === 0)).toBe(true);
      });

      it("성공은 JSON 본문으로, 실패는 issues 를 실은 예외로 옮긴다", async () => {
        const ctx = { project: createBlankProject() };
        const calls: string[] = [];
        const tools = createPiToolset(ctx, { onCall: (record) => calls.push(`${record.name}:${record.result.ok}`) });
        const byName = new Map(tools.map((tool) => [tool.name, tool]));

        const create = byName.get("create_map");
        expect(create).toBeTruthy();
        const ok = await create!.execute("c1", { id: "map_pi", name: "파이 마을", width: 12, height: 10 });
        const body = JSON.parse(ok.content[0]!.text) as { ok: boolean; summary: string };
        expect(body.ok).toBe(true);
        expect(ctx.project.maps.map_pi).toBeTruthy();

        await expect(create!.execute("c2", { id: "map_pi", name: "중복", width: 12, height: 10 }))
          .rejects.toThrow(/"ok":false/);
        expect(calls).toEqual(["create_map:true", "create_map:false"]);
      });

      it("긴 읽기 data 는 잘라서 힌트를 붙인다", async () => {
        const ctx = { project: createBlankProject() };
        const tools = createPiToolset(ctx, { maxDataChars: 64 });
        const read = tools.find((tool) => tool.name === "get_database_records");
        expect(read).toBeTruthy();
        const out = await read!.execute("r1", { collection: "maps", include: "full" });
        const body = JSON.parse(out.content[0]!.text) as { dataTruncated?: boolean; dataPreview?: string; hint?: string };
        expect(body.dataTruncated).toBe(true);
        expect(body.dataPreview?.length).toBe(64);
        expect(body.hint).toMatch(/잘렸습니다/);
      });

      describe("에스컬레이션 해석기", () => {
        it("find_tools 결과에서 후보 이름을 수확한다", () => {
          const found = harvestFindToolsNames({
            ok: true,
            summary: "3개 발견",
            data: { matches: [{ name: "fill_region" }, { name: "set_project_settings" }, { noName: true }, "junk"] },
          });
          expect(found).toEqual(["fill_region", "set_project_settings"]);
          expect(harvestFindToolsNames({ ok: false, summary: "x" })).toEqual([]);
          expect(harvestFindToolsNames({ ok: true, summary: "x" })).toEqual([]);
          expect(harvestFindToolsNames({ ok: true, summary: "x", data: {} })).toEqual([]);
        });

        it("실행 경계 안의 이름만 셰이프로 만든다", async () => {
          const ctx = { project: createBlankProject() };
          // 쓰기 가능 실행 — 쓰기 툴도 만든다.
          expect(resolvePiToolShape(ctx, "set_project_settings")).toBeTruthy();
          expect(resolvePiToolShape(ctx, "set_project_settings")?.concurrency).toBe("exclusive");
          expect(resolvePiToolShape(ctx, "get_project_summary")?.concurrency).toBe("shared");
          // 읽기 전용 실행 — 쓰기 툴은 절대 못 만든다(질문 승격의 구조적 보장).
          expect(resolvePiToolShape(ctx, "set_project_settings", { readOnly: true })).toBeUndefined();
          expect(resolvePiToolShape(ctx, "get_project_summary", { readOnly: true })).toBeTruthy();
          // toolNames 는 하드 경계다 — 목록 밖 이름은 못 만든다(팀 역할 제한).
          expect(resolvePiToolShape(ctx, "set_project_settings", { toolNames: ["get_project_summary"] })).toBeUndefined();
          expect(resolvePiToolShape(ctx, "get_project_summary", { toolNames: ["get_project_summary"] })).toBeTruthy();
          // 레지스트리에 없는 이름·빈 이름은 언제나 undefined.
          expect(resolvePiToolShape(ctx, "not_a_tool")).toBeUndefined();
          expect(resolvePiToolShape(ctx, "")).toBeUndefined();
          // 만들어진 셰이프는 실제로 실행된다 — 같은 ctx·onCall 배선을 탄다.
          const calls: string[] = [];
          const shape = resolvePiToolShape(ctx, "set_project_settings", { onCall: (record) => calls.push(record.name) });
          const out = await shape!.execute("e1", { title: "승격됨" });
          expect(JSON.parse(out.content[0]!.text)).toMatchObject({ ok: true });
          expect(ctx.project.meta.title).toBe("승격됨");
          expect(calls).toEqual(["set_project_settings"]);
        });
      });

      describe("맵 묶음 범위 가드", () => {
        // run10 재현: 빈 시작 맵(map_blank_start)은 묶음 밖인데 문을 달았고, 병합이 그 맵을 버려 길이 끊겼다.
        function townProject() {
          const ctx = { project: createBlankProject() };
          const [create] = createPiToolset(ctx, { toolNames: ["create_map"] });
          return { ctx, create: create! };
        }

        it("묶음 밖 맵을 바꾸는 쓰기는 되돌리고 실패로 돌려준다", async () => {
          const { ctx, create } = townProject();
          await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
          const startMapId = ctx.project.startMapId;
          expect(startMapId).not.toBe("town");
          const before = ctx.project;
          const results: boolean[] = [];
          const tools = createPiToolset(ctx, { scopeMapIds: ["town"], onCall: (record) => results.push(record.result.ok) });
          const pair = tools.find((tool) => tool.name === "create_transfer_pair")!;
          await expect(pair.execute("t1", { a: { mapId: startMapId, x: 10, y: 8 }, b: { mapId: "town", x: 24, y: 22 } }))
            .rejects.toThrow(new RegExp(`${startMapId}.*set_start_position`, "s"));
          expect(ctx.project).toBe(before);
          expect(results).toEqual([false]);
        });

        it("묶음 안 맵과 묶음 아래 새 실내 맵은 통과한다", async () => {
          const { ctx, create } = townProject();
          await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
          await create.execute("c1", { id: "house", name: "집", width: 12, height: 10 });
          // 실내 맵을 마을 아래로 옮긴다 — 묶음(mapTree 부분 트리) 안이다.
          const root = ctx.project.mapTree;
          root.children = root.children.filter((child) => child.mapId !== "house");
          root.children.find((child) => child.mapId === "town")!.children.push({ mapId: "house", children: [] });
          const tools = createPiToolset(ctx, { scopeMapIds: ["town"] });
          const pair = tools.find((tool) => tool.name === "create_transfer_pair")!;
          const out = await pair.execute("t2", { a: { mapId: "house", x: 6, y: 9 }, b: { mapId: "town", x: 24, y: 22 } });
          expect(JSON.parse(out.content[0]!.text)).toMatchObject({ ok: true });
          const start = tools.find((tool) => tool.name === "set_start_position")!;
          await start.execute("s1", { mapId: "town", x: 5, y: 5 });
          expect(ctx.project.startMapId).toBe("town");
        });

        it("평문(scopeStrict=false)이라도 병합 실행이면 가드가 켜지고, 거부 문구는 DB·시스템은 된다고 말한다", async () => {
          const guard = piMapScopeGuard({ mapIds: ["town"], scopeStrict: false, mapBundleMerge: true });
          expect(guard).toEqual({ scopeMapIds: ["town"], scopeAllowsSystem: true });
          const { ctx, create } = townProject();
          await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
          const startMapId = ctx.project.startMapId;
          const before = ctx.project;
          const tools = createPiToolset(ctx, guard);
          const pair = tools.find((tool) => tool.name === "create_transfer_pair")!;
          const error = await pair.execute("t1", { a: { mapId: startMapId, x: 10, y: 8 }, b: { mapId: "town", x: 24, y: 22 } }).catch((e: Error) => e);
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/DB·시스템.*(편집|수정).*할 수 있/s);
          expect((error as Error).message).toMatch(/다른 맵/);
          expect(ctx.project).toBe(before);
          // 묶음 안 맵·DB 쓰기는 통과한다.
          const start = tools.find((tool) => tool.name === "set_start_position")!;
          await start.execute("s1", { mapId: "town", x: 5, y: 5 });
          const settings = tools.find((tool) => tool.name === "set_project_settings")!;
          await settings.execute("p1", { title: "승격됨" });
          expect(ctx.project.meta.title).toBe("승격됨");
        });

        it("단일 평문 턴(scopeStrict=false, 병합 없음)은 가드를 켜지 않는다", () => {
          expect(piMapScopeGuard({ mapIds: ["town"], scopeStrict: false })).toEqual({});
          expect(piMapScopeGuard({ mapIds: [], scopeStrict: true, mapBundleMerge: true })).toEqual({});
          // 옛 호출자(CLI·팀원)는 scopeStrict 를 비워 보낸다 — 기존처럼 계약 가드.
          expect(piMapScopeGuard({ mapIds: ["town"] })).toEqual({ scopeMapIds: ["town"], scopeAllowsSystem: false });
        });

        it("묶음 밖에 새로 만든 맵은 막지 않고 경고를 붙인다", async () => {
          const { ctx, create } = townProject();
          await create.execute("c0", { id: "town", name: "마을", width: 48, height: 36 });
          const results: Array<{ ok: boolean; warnings?: readonly string[] }> = [];
          const tools = createPiToolset(ctx, { scopeMapIds: ["town"], onCall: (record) => results.push(record.result) });
          const createMap = tools.find((tool) => tool.name === "create_map")!;
          const out = await createMap.execute("c1", { id: "house", name: "집", width: 12, height: 10 });
          const body = JSON.parse(out.content[0]!.text) as { ok: boolean; warnings?: string[] };
          expect(body.ok).toBe(true);
          expect(ctx.project.maps.house).toBeTruthy();
          const warning = body.warnings?.find((w) => w.includes("house"));
          expect(warning).toMatch(/작업 범위.*밖.*버려.*manage_map_tree.*town/s);
          expect(results[0]!.warnings).toContain(warning);
        });
      });
    });
  });
  // 계약: upsert_event 로 만든 presentItem 이 run_scene_test 로 끝까지 검증된다.
  // 추리 게임 도그푸딩에서 「증거를 들이민다」가 choices + 소지 조건 흉내뿐이라 틀린 증거·
  // 안 낸 경우를 헤드리스로 가를 수 없었다. 이 테스트가 도구 → 저장 → 실행 → 검증 한 바퀴를 잠근다.
  describe("presentItemToolContract", () => {
    isolateTimers();
    function fixture() {
      const ctx = { project: createBlankProject() };
      const template = ctx.project.database.items[0];
      assert(template);
      ctx.project.database.items.push(
        { ...template, id: "item_knife", name: "피 묻은 칼" },
        { ...template, id: "item_letter", name: "찢긴 편지" },
      );
      ctx.project.switches.push({ id: "sw_confessed", name: "자백" }, { id: "sw_wrong", name: "헛짚음" }, { id: "sw_silent", name: "안 냄" });
      const mapId = ctx.project.startMapId;
      const { x, y } = ctx.project.startPos;
      const upsert = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_suspect", name: "용의자", x, y: y - 1,
          pages: [{
            id: "p1", name: "심문", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{
              kind: "presentItem",
              prompt: "증거를 제시하라",
              itemIds: ["item_knife", "item_letter"],
              options: [{ itemId: "item_knife", branch: [{ kind: "setSwitch", switchId: "sw_confessed", value: true }] }],
              otherwiseBranch: [{ kind: "setSwitch", switchId: "sw_wrong", value: true }],
              cancelBranch: [{ kind: "setSwitch", switchId: "sw_silent", value: true }],
              consume: true,
            }],
          }],
        },
      });
      assert(upsert.ok, upsert.summary);
      const scene = (steps: unknown[]) => {
        const tool = runTool(ctx, "run_scene_test", {
          mapId, start: { x, y },
          steps: [{ kind: "set", inventory: { item_knife: 1, item_letter: 1 }, facing: "up" }, { kind: "interact", eventId: "ev_suspect" }, ...steps],
        });
        assert(tool.ok, tool.summary);
        return tool.data as { ok: boolean; failureReason?: string; stepsRun: number; totalSteps: number };
      };
      return { ctx, mapId, scene };
    }
    describe("presentItem: upsert_event → run_scene_test", () => {
      it("도구 설명과 스키마가 presentItem 을 안내한다", () => {
        const upsert = getTool("upsert_event");
        expect(JSON.stringify(upsert?.parameters)).toContain("presentItem");
        expect(getTool("run_scene_test")?.description).toContain("{kind:'present',itemId?}");
      });

      it("맞는 증거 → 정답 분기, consume 으로 소모", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present", itemId: "item_knife" }, { kind: "expect", switchOn: "sw_confessed", switchOff: ["sw_wrong", "sw_silent"], inventoryCount: { item_knife: 0, item_letter: 1 }, interactionComplete: true }]);
        expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
      });

      it("틀린 증거 → otherwiseBranch", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present", itemId: "item_letter" }, { kind: "expect", switchOn: "sw_wrong", switchOff: "sw_confessed", inventoryCount: { item_letter: 1 } }]);
        expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
      });

      it("안 내고 닫음 → cancelBranch", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present" }, { kind: "expect", switchOn: "sw_silent" }]);
        expect(result, result.failureReason).toMatchObject({ ok: true, stepsRun: result.totalSteps });
      });

      it("목록에 없는 아이템을 내려 하면 그 스텝에서 실패한다", () => {
        const { scene } = fixture();
        const result = scene([{ kind: "present", itemId: "item_ghost" }]);
        expect(result.ok).toBe(false);
        expect(result.failureReason).toMatch(/item_ghost/);
      });

      it("저장 왕복 후에도 같은 이벤트가 남는다", () => {
        const { ctx, mapId } = fixture();
        const restored = deserialize(serialize(ctx.project));
        const event = restored.maps[mapId]?.events.find((entry) => entry.id === "ev_suspect");
        expect(event?.pages?.[0]?.commands[0]).toMatchObject({ kind: "presentItem", consume: true, options: [{ itemId: "item_knife" }] });
      });

      it("없는 아이템을 정답으로 넣으면 upsert_event 가 거부한다", () => {
        const ctx = { project: createBlankProject() };
        const result = runTool(ctx, "upsert_event", {
          mapId: ctx.project.startMapId,
          event: { id: "ev_bad", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "presentItem", options: [{ itemId: "item_nope", branch: [] }] }] },
        });
        expect(result.ok).toBe(false);
      });
    });
    describe("presentItem lint", () => {
      it("없는 아이템은 참조 오류, 후보 밖 정답·정답 없음은 경고", async () => {
        const { projectLint } = await import("@/project/lint/projectLint");
        const { ctx, mapId } = fixture();
        const page = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_suspect")!.pages![0]!;
        expect(projectLint(ctx.project, { skipRoundtrip: true }).filter((issue) => issue.code.startsWith("presentItem"))).toEqual([]);

        page.commands = [
          { kind: "presentItem", itemIds: ["item_letter"], options: [{ itemId: "item_knife", branch: [] }] },
          { kind: "presentItem", options: [] },
          { kind: "presentItem", options: [{ itemId: "item_ghost", branch: [] }] },
        ];
        const issues = projectLint(ctx.project, { skipRoundtrip: true });
        expect(issues.filter((issue) => issue.code.startsWith("presentItem")).map((issue) => [issue.severity, issue.code]))
          .toEqual([["warning", "presentItem.option-not-offered"], ["warning", "presentItem.no-options"]]);
        expect(issues.some((issue) => issue.code === "reference-validation" && issue.message.includes("item_ghost"))).toBe(true);
      });
    });
  });
  // recommend_bgm — 분위기/장면 질의 → 후보 10곡 + 전체 설명 1호출.
  // list_resources(제목만, 240자 잘림) + get_audio_resource N번의 1+N 호출을
  // 한 번으로 합친 읽기 툴. 제목 먼저 훑고 설명까지 보고 고르는 계약을 강제한다.
  describe("recommendBgm", () => {
    isolateTimers();
    function run(ctx: ToolContext, args: Record<string, unknown>) {
      return runTool(ctx, "recommend_bgm", args, { dryRun: false });
    }
    describe("recommend_bgm RED", () => {
      it("등록된 읽기 툴이다", () => {
        expect(getTool("recommend_bgm")?.mode).toBe("read");
      });

      it("분위기 질의에 후보 10곡 + 전체 설명을 한 번에 돌려준다", () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = run(ctx, { query: "슬픈 마을", limit: 10 });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as {
          candidates: Array<{
            resourceId: string; name: string; score: number;
            description: string; descriptionTruncated: boolean; descriptionSource: string;
          }>;
          total: number;
        };
        expect(data.candidates).toHaveLength(10);
        for (const candidate of data.candidates) {
          // 전체 설명 — 잘림 없음
          expect(candidate.descriptionTruncated).toBe(false);
          expect(candidate.description.length).toBeGreaterThan(0);
          expect(typeof candidate.score).toBe("number");
        }
      });

      it("query 없이 장면만으로도 후보를 돌려준다", () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = run(ctx, { scene: "village", limit: 10 });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { candidates: unknown[] };
        expect(data.candidates).toHaveLength(10);
      });

      it("query도 scene도 없으면 거절한다", () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = run(ctx, { limit: 10 });
        expect(result.ok).toBe(false);
      });
    });
  });
});
