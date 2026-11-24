import { describe, expect, it, afterEach, vi } from "vitest";
import { allTools, getTool, toOpenAiTools } from "@/editor/tools/toolRegistry";
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
