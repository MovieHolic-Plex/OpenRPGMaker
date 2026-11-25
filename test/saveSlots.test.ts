import { describe, expect, it, afterEach } from "vitest";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { startSession, DEFAULT_MESSAGE_WINDOW_SETTINGS, type PlaySession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot, saveSlotKey, snapshotLoadBlocker, type SaveSnapshot } from "@/player/saveSlots";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { parseAst } from "rolldown/parseAst";
import { Window } from "happy-dom";
import * as saves from "@/player/saveSlots";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { isolateTimers } from "./mergedTeardown";

describe("customSeasonSave", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();
    get length(): number { return this.values.size; }
    clear(): void { this.values.clear(); }
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string): void { this.values.delete(key); }
    setItem(key: string, value: string): void { this.values.set(key, value); }
  }
  describe("custom season save compatibility", () => {
    it("preserves day 40 through wire parsing and applies the current project calendar", () => {
      const project = createBlankProject();
      project.system.timeSystem = { enabled: true, daysPerSeason: 40, dayStartHour: 6, dayEndHour: 26 };
      const session = startSession(project, 41);
      session.gameTime = { minute: 30, hour: 18, day: 40, season: "spring", year: 2 };
      session.farmPlotsAdvancedThrough = { day: 40, season: "spring", year: 2 };

      const storage = new MemoryStorage();
      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;
      expect(read.snapshot.session.gameTime?.day).toBe(40);
      expect(read.snapshot.session.farmPlotsAdvancedThrough?.day).toBe(40);
      expect(applySaveSnapshot(project, read.snapshot).gameTime).toEqual(session.gameTime);

      project.system.timeSystem = { ...project.system.timeSystem, daysPerSeason: 28 };
      const restoredUnderShorterCalendar = applySaveSnapshot(project, read.snapshot);
      expect(restoredUnderShorterCalendar.gameTime?.day).toBe(28);
      expect(restoredUnderShorterCalendar.farmPlotsAdvancedThrough?.day).toBe(28);
    });
  });
});

describe("knownWeaknessSaveRestore", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }
  describe("세이브/로드 — 알아낸 약점", () => {
    it("흡수(음수 배율)가 있어도 약점 장부가 슬롯을 왕복한다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.gold = 40;
      session.knownWeaknesses = {
        wolf: { "element:fire": -0.5, "type:physical": 0.5 },
        slime: { "element:fire": 2 },
        ghost: { "type:magic": 0 },
      };

      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const saved = readSaveSlot(storage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
      expect(saved.snapshot.session.knownWeaknesses).toEqual(session.knownWeaknesses);

      const restored = applySaveSnapshot(project, saved.snapshot);
      expect(restored.knownWeaknesses).toEqual(session.knownWeaknesses);
      expect(restored.gold).toBe(40);
    });

    it("깨진 약점 칸은 장부만 버리고 나머지 세이브는 읽는다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.gold = 9;
      session.knownWeaknesses = { slime: { "element:fire": 2 } };
      const raw = JSON.parse(JSON.stringify(createSaveSnapshot(project, session))) as {
        session: { knownWeaknesses: { slime: Record<string, unknown> }; gold: number };
      };
      raw.session.knownWeaknesses.slime["element:fire"] = "no";
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), JSON.stringify(raw));

      const saved = readSaveSlot(storage, 1);
      if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}: ${saved.kind === "corrupt" ? saved.message : ""}`);
      expect(saved.snapshot.session.knownWeaknesses).toBeUndefined();
      expect(saved.snapshot.session.gold).toBe(9);
      expect(applySaveSnapshot(project, saved.snapshot).gold).toBe(9);
    });
  });
});

describe("lifeSaveConsumers", () => {
  isolateTimers();
  const scripts = ["verify-gate-transfer.cjs", "capture-uiux-evidence.cjs", "playtest-driver2.cjs"];
  // Execute the tracked consumers, not a second implementation of their predicates/loops.
  // TypeScript 7(#2396)에는 JS 컴파일러 API(createSourceFile·transpileModule)가 없다 — 같은 일을 rolldown 의 ESTree 파서와 esbuild 로 한다.
  type EsNode = { readonly type: string; readonly start: number; readonly end: number; readonly [key: string]: unknown };
  function isEsNode(value: unknown): value is EsNode {
    return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
  }
  function walk(node: EsNode, visit: (node: EsNode) => void): void {
    visit(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) if (isEsNode(child)) walk(child, visit); }
      else if (isEsNode(value)) walk(value, visit);
    }
  }
  function parseScript(file: string): { readonly ast: EsNode; readonly text: (node: EsNode) => string } {
    const source = readFileSync(new URL(`../scripts/${file}`, import.meta.url), "utf8");
    return { ast: parseAst(source, { lang: "js" }) as unknown as EsNode, text: (node) => source.slice(node.start, node.end) };
  }
  function toCommonJs(code: string): string {
    // TS 의 CommonJS 변환처럼 import() 도 require 로 바꾼다(vm 문맥에는 동적 import 콜백이 없다).
    return transformSync(code, { format: "cjs", target: "es2022", loader: "js", supported: { "dynamic-import": false } }).code;
  }
  function extract(file: string, kind: "observation" | "cleanup"): string {
    const { ast, text } = parseScript(file);
    const matches: string[] = [];
    walk(ast, (node) => {
      const id = node.id;
      if (kind === "observation" && node.type === "VariableDeclarator" && isEsNode(id) && id.type === "Identifier" && id.name === "saved") {
        const initializer = node.init;
        if (!isEsNode(initializer) || initializer.type !== "AwaitExpression" || !isEsNode(initializer.argument) || initializer.argument.type !== "CallExpression") throw new Error("Missing saved evaluation");
        const [first] = initializer.argument.arguments as unknown[];
        if (!isEsNode(first)) throw new Error("Missing saved evaluation");
        matches.push(text(first));
      }
      if (kind === "cleanup" && node.type === "ForStatement" && text(node).includes("localStorage.removeItem") && text(node).includes("save-slot:")) matches.push(text(node));
    });
    expect(matches).toHaveLength(1);
    return matches[0]!;
  }
  const observation = extract(scripts[0], "observation");
  const windows: Window[] = [];
  function fixture() {
    const window = new Window();
    windows.push(window);
    const storage = window.localStorage;
    const project = createBlankProject();
    const snapshot = saves.createSaveSnapshot(project, startSession(project, 205));
    expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
    const raw = storage.getItem(saves.saveSlotKey(1))!;
    return { storage, snapshot, raw };
  }
  function observe(storage: Storage): Promise<boolean> | boolean {
    // Transpile only the browser import transport; the reader is the real public module.
    const code = toCommonJs(`(${observation})()`);
    return vm.runInNewContext(code, {
      localStorage: storage,
      require: (id: string) => {
        expect(id).toBe("/src/player/saveSlots.ts");
        return saves;
      },
    });
  }
  afterEach(async () => {
    saves.setSaveSlotStorageNamespace(null);
    for (const window of windows.splice(0)) {
      window.localStorage.clear();
      await window.happyDOM.close();
    }
  });
  describe("tracked Save5 QA consumers", () => {
    it("observes real current writer bytes without relying on a legacy key", async () => {
      const { storage, raw } = fixture();
      expect(JSON.parse(raw).schemaVersion).toBe(5);
      expect(storage.getItem("oprn:save-slot:1")).toBeNull();
      expect(saves.readSaveSlot(storage, 1).kind).toBe("present");
      expect(await observe(storage)).toBe(true);
      expect(storage.getItem("oprn:save-slot:v5:1")).toBe(raw);
    });

    it("does not report legacy or another namespace's current save as the default save", async () => {
      const { storage, snapshot, raw } = fixture();
      storage.clear();
      saves.setSaveSlotStorageNamespace("  custom:other  ");
      expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
      saves.setSaveSlotStorageNamespace(null);
      storage.setItem("oprn:save-slot:1", raw);
      expect(await observe(storage)).toBe(false);
      expect(storage.getItem("custom:other:save-slot:v5:1")).toBe(raw);
    });

    it.each(["", "{broken", "null", "[]", '{"schemaVersion":5}'])("rejects malformed current bytes %j even with legacy progress", async (invalid) => {
      const { storage, raw } = fixture();
      storage.setItem("oprn:save-slot:1", raw);
      storage.setItem("oprn:save-slot:v5:1", invalid);
      expect(await observe(storage)).toBe(false);
      expect(storage.getItem("oprn:save-slot:v5:1")).toBe(invalid);
      expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
    });

    it.each([4, 6, 999, "5"])("rejects non-current schema %j on actual writer payload", async (schemaVersion) => {
      const { storage, snapshot, raw } = fixture();
      const invalid = JSON.stringify({ ...snapshot, schemaVersion });
      storage.setItem("oprn:save-slot:1", raw);
      storage.setItem("oprn:save-slot:v5:1", invalid);
      expect(await observe(storage)).toBe(false);
      expect(storage.getItem("oprn:save-slot:v5:1")).toBe(invalid);
    });

    it("validates the session schema rather than accepting a version-only object", async () => {
      const { storage, snapshot, raw } = fixture();
      storage.setItem("oprn:save-slot:1", raw);
      storage.setItem("oprn:save-slot:v5:1", JSON.stringify({ ...snapshot, session: {} }));
      expect(await observe(storage)).toBe(false);
    });

    it.each(scripts)("%s clears both manual families only", (file) => {
      const { storage, snapshot, raw } = fixture();
      for (const namespace of [null, "  custom:other  "]) {
        saves.setSaveSlotStorageNamespace(namespace);
        for (const slot of [1, 2, 3] as const) {
          expect(saves.saveToSlot(storage, slot, snapshot)).toEqual({ ok: true });
          storage.setItem(`${namespace?.trim() ?? "oprn"}:save-slot:${slot}`, raw);
        }
      }
      saves.setSaveSlotStorageNamespace(null);
      const preserved = ["oprn:save-slot:v5:auto", "oprn:save-slot:auto", "oprn:preferences", "other:key", "oprn:save-slot:v5:4"];
      for (const key of preserved) storage.setItem(key, raw);
      vm.runInNewContext(extract(file, "cleanup"), { localStorage: storage });
      for (const slot of [1, 2, 3]) {
        expect(storage.getItem(`oprn:save-slot:v5:${slot}`)).toBeNull();
        expect(storage.getItem(`oprn:save-slot:${slot}`)).toBeNull();
        expect(storage.getItem(`custom:other:save-slot:v5:${slot}`)).toBe(raw);
        expect(storage.getItem(`custom:other:save-slot:${slot}`)).toBe(raw);
      }
      for (const key of preserved) expect(storage.getItem(key)).toBe(raw);
    });
  });
  const remainingScripts = ["playtest-driver3.cjs", "playtest-driver4.cjs", "playtest-driver5.cjs", "playtest-driver6.cjs", "capture-fullscreen-scale.cjs"];
  const mutatingScripts = ["playtest-driver4.cjs", "playtest-driver6.cjs"];
  function currentCallback(file: string, mutation = false): string {
    const { ast, text } = parseScript(file);
    const matches: string[] = [];
    walk(ast, (node) => {
      if (node.type === "CallExpression" && isEsNode(node.callee) && text(node.callee) === "page.evaluate") {
        const [first] = node.arguments as unknown[];
        const callback = isEsNode(first) ? text(first) : "";
        if (callback.includes("localStorage.getItem") && callback.includes("localStorage.setItem") === mutation) matches.push(callback);
      }
    });
    expect(matches).toHaveLength(1);
    return matches[0]!;
  }
  function runCurrent(file: string, storage: Storage, mutation = false): Promise<unknown> {
    const callback = currentCallback(file, mutation);
    const code = toCommonJs(`(${callback})(["map_warp", 7, 9, { switch_probe: true }])`);
    return Promise.resolve(vm.runInNewContext(code, {
      localStorage: storage,
      require: (id: string) => {
        expect(id).toBe("/src/player/saveSlots.ts");
        return saves;
      },
    }));
  }
  describe("remaining actual Save5 consumers (task40)", () => {
    it.each(remainingScripts)("%s removes only owned manual families", (file) => {
      const { storage, snapshot, raw } = fixture();
      expect(raw).not.toBeNull();
      const owned: string[] = [];
      const other: string[] = [];
      for (const namespace of [null, "custom:other"]) {
        saves.setSaveSlotStorageNamespace(namespace);
        for (const slot of [1, 2, 3] as const) {
          expect(saves.saveToSlot(storage, slot, snapshot)).toEqual({ ok: true });
          const key = saves.saveSlotKey(slot);
          expect(storage.getItem(key)).toBe(raw);
          const legacy = `${namespace ?? "oprn"}:save-slot:${slot}`;
          storage.setItem(legacy, raw);
          (namespace ? other : owned).push(key, legacy);
        }
        const auto = saves.autosaveKey();
        storage.setItem(auto, raw);
        other.push(auto);
      }
      saves.setSaveSlotStorageNamespace(null);
      for (const key of ["oprn:save-slot:auto", "oprn:save-slot:v5:4", "oprn:preferences", "unrelated"]) {
        storage.setItem(key, raw);
        other.push(key);
      }
      const cleanup = extract(file, "cleanup");
      vm.runInNewContext(cleanup, { localStorage: storage });
      console.log(JSON.stringify({ file, cleanup, remainingOwned: owned.filter((key) => storage.getItem(key) !== null), preserved: other.every((key) => storage.getItem(key) === raw) }));
      expect(owned.map((key) => storage.getItem(key))).toEqual(owned.map(() => null));
      for (const key of other) expect(storage.getItem(key)).toBe(raw);
    });

    describe.each(mutatingScripts)("%s", (file) => {
      it("observes the real default writer without legacy bytes", async () => {
        const { storage, raw } = fixture();
        expect(raw).not.toBeNull();
        const observed = await runCurrent(file, storage);
        console.log(JSON.stringify({ file, observer: currentCallback(file), observed, key: saves.saveSlotKey(1), schemaVersion: JSON.parse(raw).schemaVersion }));
        expect(observed).toBe(true);
      });

      it("mutates the exact current owner preferred by the reader, preserving legacy and other namespaces", async () => {
        const { storage, snapshot, raw } = fixture();
        const key = saves.saveSlotKey(1);
        expect(storage.getItem(key)).not.toBeNull();
        storage.setItem("oprn:save-slot:1", raw);
        saves.setSaveSlotStorageNamespace("custom:other");
        expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
        const otherKey = saves.saveSlotKey(1);
        expect(storage.getItem(otherKey)).toBe(raw);
        saves.setSaveSlotStorageNamespace(null);
        await runCurrent(file, storage, true);
        const current = JSON.parse(storage.getItem(key)!);
        console.log(JSON.stringify({ file, mutation: currentCallback(file, true), currentPosition: [current.session.currentMapId, current.session.x, current.session.y], legacyPreserved: storage.getItem("oprn:save-slot:1") === raw }));
        expect(current.session).toMatchObject({ currentMapId: "map_warp", x: 7, y: 9 });
        if (file === "playtest-driver4.cjs") expect(current.session.switches.switch_probe).toBe(true);
        expect(current).toEqual({ ...snapshot, session: { ...snapshot.session, currentMapId: "map_warp", x: 7, y: 9, switches: file === "playtest-driver4.cjs" ? { ...snapshot.session.switches, switch_probe: true } : snapshot.session.switches } });
        const read = saves.readSaveSlot(storage, 1);
        expect(read.kind).toBe("present");
        if (read.kind === "present") expect(read.snapshot.session).toMatchObject({ currentMapId: "map_warp", x: 7, y: 9 });
        expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
        expect(storage.getItem(otherKey)).toBe(raw);
      });

      it.each(["", "{broken", "null", "[]", '{"schemaVersion":5}', 4, 6, 999, "5", "invalid-session"])("rejects invalid current bytes %j without mutation or legacy fallback", async (invalid) => {
        const { storage, snapshot, raw } = fixture();
        const key = saves.saveSlotKey(1);
        const bytes = invalid === "invalid-session" ? JSON.stringify({ ...snapshot, session: {} })
          : typeof invalid === "number" || invalid === "5" ? JSON.stringify({ ...snapshot, schemaVersion: invalid }) : invalid;
        storage.setItem(key, bytes);
        storage.setItem("oprn:save-slot:1", raw);
        expect(await runCurrent(file, storage)).toBe(false);
        await expect(runCurrent(file, storage, true)).rejects.toThrow();
        expect(storage.getItem(key)).toBe(bytes);
        expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
      });

      it("does not observe or mutate legacy-only or other namespace saves", async () => {
        const { storage, snapshot, raw } = fixture();
        storage.clear();
        saves.setSaveSlotStorageNamespace("custom:other");
        expect(saves.saveToSlot(storage, 1, snapshot)).toEqual({ ok: true });
        const otherKey = saves.saveSlotKey(1);
        saves.setSaveSlotStorageNamespace(null);
        storage.setItem("oprn:save-slot:1", raw);
        expect(await runCurrent(file, storage)).toBe(false);
        await expect(runCurrent(file, storage, true)).rejects.toThrow();
        expect(storage.getItem(saves.saveSlotKey(1))).toBeNull();
        expect(storage.getItem(otherKey)).toBe(raw);
        expect(storage.getItem("oprn:save-slot:1")).toBe(raw);
      });
    });
  });
});

describe("messageWindowSaveRestore", () => {
  isolateTimers();
  function mkSession(project = createBlankProject()): PlaySession {
    return {
      switches: {},
      selfSwitches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      monsterInstances: {},
      monsterParty: [],
      monsterBox: [],
      classOverrides: {},
      actorSkillIds: {},
      actorExperience: {},
      actorLevels: {},
      actorVitals: {},
      eventLocations: {},
      erasedEventIds: [],
      npcTravelStates: {},
      followers: [],
      followerTrail: [],
      actorEquipment: {},
      actorRows: {},
      currentMapId: project.startMapId,
      x: project.startPos.x,
      y: project.startPos.y,
      lighting: { ambient: 0, sources: [] },
      mapOverrides: {},
      flags: {},
      audio: {},
      pictures: {},
      playTimeSeconds: 0,
    };
  }
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number {
      return this.store.size;
    }
    clear(): void {
      this.store.clear();
    }
    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }
    key(index: number): string | null {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }
  }
  const pinnedWindow = {
    format: "transparent" as const,
    position: "top" as const,
    preventObscuringPlayer: false,
    allowEventMovementDuringWait: true,
  };
  describe("세이브/로드 — 문장 표시 설정", () => {
    it("기본 대사창은 세이브에 적지 않고, 불러오면 기본 창이다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      session.messageWindowSettings = { ...DEFAULT_MESSAGE_WINDOW_SETTINGS };

      const snapshot = createSaveSnapshot(project, session);
      expect(snapshot.session.messageWindowSettings).toBeUndefined();

      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.messageWindowSettings).toEqual(DEFAULT_MESSAGE_WINDOW_SETTINGS);
    });

    it("바꿔 둔 대사창은 슬롯을 다시 읽어도 그대로다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      session.messageWindowSettings = pinnedWindow;

      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;

      expect(result.snapshot.session.messageWindowSettings).toEqual(pinnedWindow);
      expect(applySaveSnapshot(project, result.snapshot).messageWindowSettings).toEqual(pinnedWindow);
    });

    it("가림 방지만 끈 창도 저장된다", () => {
      const project = createBlankProject();
      const session = mkSession(project);
      session.messageWindowSettings = { ...DEFAULT_MESSAGE_WINDOW_SETTINGS, preventObscuringPlayer: false };

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.messageWindowSettings).toEqual({
        ...DEFAULT_MESSAGE_WINDOW_SETTINGS,
        preventObscuringPlayer: false,
      });
    });

    it("깨진 대사창 칸은 슬롯 전체를 손상으로 보지 않고 기본 창으로 불러온다", () => {
      const project = createBlankProject();
      const storage = new MemoryStorage();
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, mkSession(project)))).toEqual({ ok: true });
      const key = saveSlotKey(1);
      const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: Record<string, unknown> };
      raw.session.messageWindowSettings = { format: "nope", position: "top", preventObscuringPlayer: false };
      storage.setItem(key, JSON.stringify(raw));

      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;
      expect(result.snapshot.session.messageWindowSettings).toBeUndefined();
      expect(applySaveSnapshot(project, result.snapshot).messageWindowSettings).toEqual(DEFAULT_MESSAGE_WINDOW_SETTINGS);
    });
  });
});

describe("playerSaveSlotLegacyFace", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly map = new Map<string, string>();
    get length(): number {
      return this.map.size;
    }
    clear(): void {
      this.map.clear();
    }
    getItem(key: string): string | null {
      return this.map.get(key) ?? null;
    }
    key(index: number): string | null {
      return [...this.map.keys()][index] ?? null;
    }
    removeItem(key: string): void {
      this.map.delete(key);
    }
    setItem(key: string, value: string): void {
      this.map.set(key, value);
    }
  }
  /** 옛 세이브는 (시트 리소스 id, 셀 번호) 짝을 따로 들고 있었다. 얼굴이 낱장 파일이 된 뒤에도
   *  그 세이브를 열면 같은 얼굴이 보여야 한다 — 짝을 낱장 id 하나로 접어서 읽는다. */
  function legacySlotPayload(faceMaps: {
    readonly ids: Record<string, string>;
    readonly indices?: Record<string, number>;
  }): string {
    const project = createBlankProject();
    const session = startSession(project);
    const snapshot = createSaveSnapshot(project, session);
    const payload = JSON.parse(JSON.stringify(snapshot)) as {
      session: Record<string, unknown>;
    };
    payload.session.actorFaceResourceIds = faceMaps.ids;
    if (faceMaps.indices) payload.session.actorFaceIndices = faceMaps.indices;
    return JSON.stringify(payload);
  }
  describe("save slot legacy faceset payloads", () => {
    it("folds a legacy (sheet id, cell) pair into the per-face id", () => {
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), legacySlotPayload({
        ids: { actor_hero: "easyrpg-faceset-actor1", actor_second: "easyrpg-faceset-people1" },
        indices: { actor_hero: 7, actor_second: 15 },
      }));
      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;
      expect(result.snapshot.session.actorFaceResourceIds).toEqual({
        actor_hero: "easyrpg-faceset-actor1-07",
        actor_second: "easyrpg-faceset-people1-15",
      });
      expect(result.snapshot.session).not.toHaveProperty("actorFaceIndices");
    });

    it("clamps an out-of-range legacy cell instead of dropping the face", () => {
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), legacySlotPayload({
        ids: { actor_hero: "easyrpg-faceset-actor1" },
        indices: { actor_hero: 99 },
      }));
      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;
      expect(result.snapshot.session.actorFaceResourceIds).toEqual({
        actor_hero: "easyrpg-faceset-actor1-15",
      });
    });

    it("leaves an already-split per-face id untouched when no legacy cell map exists", () => {
      const storage = new MemoryStorage();
      storage.setItem(saveSlotKey(1), legacySlotPayload({
        ids: { actor_hero: "easyrpg-faceset-actor1-03" },
      }));
      const result = readSaveSlot(storage, 1);
      expect(result.kind).toBe("present");
      if (result.kind !== "present") return;
      expect(result.snapshot.session.actorFaceResourceIds).toEqual({
        actor_hero: "easyrpg-faceset-actor1-03",
      });
    });
  });
});

describe("playerSaveSlotLoadGuard", () => {
  isolateTimers();
  // 실측 결함: 저장 당시의 맵이 지워진 슬롯을 그대로 적용하면 부팅이 project.maps[id].width 에서
  // 터져 배포 플레이어가 "맵·에셋 불러오는 중…" 화면에 영구히 갇혔다. 로드는 적용 전에 막아야 한다.
  describe("snapshotLoadBlocker", () => {
    const project = createScarloxyDemoProject();

    function snapshotOnMap(mapId: string): SaveSnapshot {
      const session = startSession(project);
      session.currentMapId = mapId;
      return createSaveSnapshot(project, session);
    }

    it("허용: 저장 당시의 맵이 아직 프로젝트에 있다", () => {
      expect(snapshotLoadBlocker(project, snapshotOnMap(project.startMapId))).toBeNull();
    });

    it("차단: 저장 당시의 맵이 프로젝트에서 사라졌다", () => {
      const snapshot = snapshotOnMap(project.startMapId);
      const stale: SaveSnapshot = {
        ...snapshot,
        session: { ...snapshot.session, currentMapId: "map_deleted_by_author" },
      };
      expect(snapshotLoadBlocker(project, stale)).toBe("저장 당시의 맵이 이 프로젝트에 없습니다");
    });
  });
  // 수동 저장은 quota 초과·프라이빗 모드에서 예외를 던졌고 상태 메뉴가 잡지 않아 성공도 실패도
  // 표시되지 않았다. 오토세이브(performAutosave)처럼 결과를 돌려준다.
  describe("saveToSlot", () => {
    const project = createScarloxyDemoProject();

    function throwingStorage(error: unknown): Storage {
      const backing = new Map<string, string>();
      return {
        get length() {
          return backing.size;
        },
        clear: () => backing.clear(),
        getItem: (key: string) => backing.get(key) ?? null,
        key: (index: number) => [...backing.keys()][index] ?? null,
        removeItem: (key: string) => void backing.delete(key),
        setItem: () => {
          throw error;
        },
      } satisfies Storage;
    }

    it("성공하면 ok 를 돌려준다", () => {
      const storage = new Map<string, string>();
      const fake = {
        get length() {
          return storage.size;
        },
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => [...storage.keys()][index] ?? null,
        removeItem: (key: string) => void storage.delete(key),
        setItem: (key: string, value: string) => void storage.set(key, value),
      } satisfies Storage;
      const result = saveToSlot(fake, 1, createSaveSnapshot(project, startSession(project)));
      expect(result).toEqual({ ok: true });
      expect(storage.size).toBe(1);
    });

    it("저장 공간이 부족하면 사람이 읽을 수 있는 실패를 돌려준다(예외를 던지지 않는다)", () => {
      const quota = new DOMException("exceeded", "QuotaExceededError");
      const result = saveToSlot(throwingStorage(quota), 1, createSaveSnapshot(project, startSession(project)));
      expect(result).toEqual({ ok: false, message: "저장 공간이 부족합니다" });
    });

    it("그 밖의 저장 실패도 던지지 않고 실패로 보고한다", () => {
      const result = saveToSlot(throwingStorage(new Error("boom")), 1, createSaveSnapshot(project, startSession(project)));
      expect(result.ok).toBe(false);
    });
  });
});
