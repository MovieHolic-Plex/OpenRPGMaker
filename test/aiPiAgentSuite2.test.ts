import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { recordGalleryUnlock, GALLERY_UNLOCK_MAX } from "@/project/gallery";
import { endingChecklist, listGallerySlots, normalizeSceneLine, saveSceneLine, SCENE_LINE_MAX } from "@/project/vnExtras";
import { galleryRecordKey, readGalleryRecord, recordGalleryUnlockOnDevice, syncSessionWithDeviceRecords } from "@/player/deviceRecords";
import { recordEndingClear } from "@/player/clearRecord";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { statusMenuCommandLabel } from "@/player/playerStatusMenuModel";
import { VN_UI_STRINGS } from "@/player/vnExtrasStrings";
import { GAME_SYSTEM_REQUEST_PATTERN, PiGameSystemProduction } from "@/ai/piAgent/gameSystemProduction";
import type { Project } from "@/project/types";
import { PiRepeatBreaker, REPEAT_STEER_AT, REPEAT_STOP_AT } from "@/ai/piAgent/repeatBreaker";
import { gunzipSync } from "node:zlib";
import { createDeltaRelay, type PiDeltaEvent } from "@/ai/piAgent/deltaRelay";
import { PiAgentClientError, runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { createPiAgentLineDecoder, encodePiAgentEvent, type PiAgentEvent, type PiAgentDoneEvent, type PiAgentRequest } from "@/ai/piAgent/protocol";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { createPiAgentNdjsonStream } from "../scripts/lib/piAgentStream";
import { defaultTeamSpec, enabledMembers, normalizeTeamSpec } from "@/ai/piAgent/teamSpec";
import { runPiTeam, type RunPiTeamOptions } from "../scripts/lib/piTeamRuntime";
import { isolateTimers } from "./mergedTeardown";

// 미연시 수리(vn-review-2) — 기기 기록(엔딩·CG), 체크리스트 칸, 도구 경계, 요청 낱말, 장면 한 줄 정리 (2026-10-17).
describe("vnRepair", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly map = new Map<string, string>();
    get length(): number { return this.map.size; }
    clear(): void { this.map.clear(); }
    getItem(key: string): string | null { return this.map.get(key) ?? null; }
    key(index: number): string | null { return [...this.map.keys()][index] ?? null; }
    removeItem(key: string): void { this.map.delete(key); }
    setItem(key: string, value: string): void { this.map.set(key, value); }
  }
  function romance(): Project {
    const project = createBlankProject();
    project.system.genreLock = { preset: "romance" } as never;
    return project;
  }
  function addCg(project: Project, ids: readonly string[]): void {
    project.maps[project.startMapId]!.events.push({
      id: "ev_cg", name: "CG", x: 1, y: 1,
      pages: [{ commands: ids.map((resourceId, index) => ({ kind: "showPicture", pictureId: index + 1, resourceId, recordInGallery: true })) }],
    } as never);
  }
  describe("B1/B3 device records", () => {
    it("restores the ending history and the opened CGs after any session replace, across slots and new games", () => {
      const project = romance();
      project.endings = [{ id: "end_a", name: "A", priority: 1, conditions: [] }] as never;
      addCg(project, ["cg_a", "cg_b"]);
      const storage = new MemoryStorage();
      const first = startSession(project, 1);
      recordEndingClear(storage, project, first, "end_a");
      recordGalleryUnlockOnDevice(storage, "cg_a", listGallerySlots(project));
      // 불러온 세션은 clearHistory 도 해금도 없다(옛 저장).
      const loaded = startSession(project, 2);
      delete loaded.clearHistory;
      syncSessionWithDeviceRecords(storage, project, loaded);
      expect(loaded.clearHistory?.endingIds).toContain("end_a");
      expect(loaded.galleryUnlocks).toEqual(["cg_a"]);
      // 새 게임도 같다.
      const fresh = startSession(project, 3);
      syncSessionWithDeviceRecords(storage, project, fresh);
      expect(fresh.galleryUnlocks).toEqual(["cg_a"]);
      expect(fresh.clearHistory?.endingIds).toContain("end_a");
    });

    it("migrates a per-slot unlock into the device record and keeps old saves compatible", () => {
      const project = romance();
      addCg(project, ["cg_a", "cg_b"]);
      const storage = new MemoryStorage();
      const old = startSession(project, 1);
      old.galleryUnlocks = ["cg_b"];
      syncSessionWithDeviceRecords(storage, project, old);
      expect(readGalleryRecord(storage)).toEqual(["cg_b"]);
      // 다른 칸의 옛 세이브가 들어와도 합쳐진다.
      const other = startSession(project, 2);
      other.galleryUnlocks = ["cg_a"];
      syncSessionWithDeviceRecords(storage, project, other);
      expect([...readGalleryRecord(storage)].sort()).toEqual(["cg_a", "cg_b"]);
      expect([...other.galleryUnlocks!].sort()).toEqual(["cg_a", "cg_b"]);
    });

    it("writes nothing for a game without unlocks and ignores a corrupt record", () => {
      const project = createBlankProject();
      const storage = new MemoryStorage();
      syncSessionWithDeviceRecords(storage, project, startSession(project, 1));
      expect(storage.length).toBe(0);
      storage.setItem(galleryRecordKey(), "{not json");
      expect(readGalleryRecord(storage)).toEqual([]);
    });

    it("keeps live gallery ids when the unlock list overflows (C9)", () => {
      const session: { galleryUnlocks?: string[] } = { galleryUnlocks: Array.from({ length: GALLERY_UNLOCK_MAX }, (_, i) => `old_${i}`) };
      recordGalleryUnlock(session, "cg_live", new Set(["cg_live", "old_199"]));
      expect(session.galleryUnlocks).toHaveLength(GALLERY_UNLOCK_MAX);
      expect(session.galleryUnlocks).toContain("cg_live");
      expect(session.galleryUnlocks).toContain("old_199");
      expect(session.galleryUnlocks).not.toContain("old_0");
      expect(session.galleryUnlocks).toContain("old_198");
    });
  });
  describe("C2 ending checklist", () => {
    function twoPeople(): Project {
      const project = romance();
      project.endings = [
        { id: "ending_with_char_haru_normal", name: "하루와 평범", priority: 2, conditions: [{ kind: "friendshipAtLeast", npcKey: "char_haru", value: 25 }] },
        { id: "ending_with_char_mina_normal", name: "미나와 평범", priority: 2, conditions: [{ kind: "friendshipAtLeast", npcKey: "char_mina", value: 25 }] },
        { id: "ending_alone", name: "혼자", priority: 1, conditions: [] },
      ] as never;
      return project;
    }

    it("fills a person's cells only from that person's own endings and never shows a raw id", () => {
      const project = twoPeople();
      const rows = endingChecklist(project, ["ending_with_char_haru_normal"], "공통");
      const haru = rows.find((row) => row.characterId === "char_haru")!;
      const mina = rows.find((row) => row.characterId === "char_mina")!;
      expect(haru.tiers.find((t) => t.tier === "normal")?.seen).toBe(true);
      expect(mina.tiers.find((t) => t.tier === "normal")?.seen).toBe(false);
      expect(rows.some((row) => /char_/.test(row.name))).toBe(false);
      expect(haru.name).toBe("???");
      expect(rows.at(-1)?.name).toBe("공통");
    });

    it("uses a person's display name when the project knows one", () => {
      const project = twoPeople();
      project.maps[project.startMapId]!.events.push({ id: "ev_haru", name: "하루", x: 0, y: 0, npcKey: "char_haru", pages: [{ commands: [] }] } as never);
      const rows = endingChecklist(project, [], "공통");
      expect(rows.find((row) => row.characterId === "char_haru")?.name).not.toMatch(/^char_/);
    });
  });
  describe("B2 the ending list scrolls", () => {
    it("renders ten people without dropping any checklist row", () => {
      const project = romance();
      project.endings = Array.from({ length: 10 }, (_, i) => ({ id: `ending_with_c${i}_happy`, name: `해피 ${i}`, priority: 3, conditions: [{ kind: "friendshipAtLeast", npcKey: `c${i}`, value: 50 }] })) as never;
      const detail = createStatusMenuDetail({ project, session: startSession(project, 1), selectedCommand: "endings", slots: [], waitModeEnabled: true });
      expect(detail.entries.filter((entry) => entry.testId?.startsWith("status-menu-endings-checklist-"))).toHaveLength(10);
    });
  });
  describe("C3/C4 gallery rows", () => {
    it("does not repeat the picture number in the value column and carries no locked hint", () => {
      const project = romance();
      addCg(project, ["cg_a"]);
      const session = startSession(project, 1);
      session.galleryUnlocks = ["cg_a"];
      const detail = createStatusMenuDetail({ project, session, selectedCommand: "gallery", slots: [], waitModeEnabled: true });
      const row = detail.entries.find((entry) => entry.label.includes("1"));
      expect(row?.value ?? "").toBe("");
      expect(JSON.stringify(detail)).not.toContain("unavailableReason");
      expect(Object.keys(VN_UI_STRINGS)).not.toContain("gallery.lockedHint");
    });
  });
  describe("C5 default romance menu and save screens follow the authored language", () => {
    it("translates only the unauthored default labels", () => {
      const project = romance();
      project.meta.oprnDialogueSystem = { version: 1, language: "en", backlog: { enabled: true, limit: 100 }, auto: { enabled: true }, skip: { enabled: true }, hideButton: { enabled: true } } as never;
      expect(statusMenuCommandLabel("save", false, project)).toBe("Save");
      expect(statusMenuCommandLabel("relationships", false, project)).toBe("Affection");
      expect(statusMenuCommandLabel("to-title", false, project)).toBe("Title");
      const detail = createStatusMenuDetail({ project, session: startSession(project, 1), selectedCommand: "save", slots: [{ slot: 1, kind: "empty" } as never], waitModeEnabled: true });
      expect(detail.title).toBe("Save");
      expect(detail.entries[0]!.label).toBe("Slot 1");
      expect(detail.entries[0]!.value).toBe("Empty");
    });

    it("keeps Korean for ko, for a non-romance game, and for an author-written label", () => {
      const korean = romance();
      expect(statusMenuCommandLabel("save", false, korean)).toBe("저장");
      const plain = createBlankProject();
      plain.meta.oprnDialogueSystem = { version: 1, language: "en", backlog: { enabled: true, limit: 100 }, auto: { enabled: false }, skip: { enabled: false }, hideButton: { enabled: false } } as never;
      expect(statusMenuCommandLabel("save", false, plain)).toBe("저장");
      const authored = romance();
      authored.meta.oprnDialogueSystem = plain.meta.oprnDialogueSystem;
      authored.meta.oprnFieldMenu = { version: 1, entries: [{ command: "save", label: "기록" }] };
      expect(statusMenuCommandLabel("save", false, authored)).toBe("기록");
    });
  });
  describe("C1 review_game_systems", () => {
    const issues = (project: Project): string[] => ((runTool({ project }, "read_game_systems", {}).data as { issues: string[] }).issues);

    it("does not warn about missing CGs for the unauthored romance default", () => {
      const project = romance();
      expect(issues(project).some((text) => text.includes("CG 칸이 비어"))).toBe(false);
    });

    it("warns when the author turned the gallery on without any CG", () => {
      const project = romance();
      const ctx = { project };
      runTool(ctx, "set_vn_extras", { gallery: true });
      expect(issues(ctx.project).some((text) => text.includes("CG 칸이 비어"))).toBe(true);
    });

    it("flags an old authored menu without a gallery entry when there is something to open", () => {
      const project = romance();
      addCg(project, ["cg_a"]);
      project.meta.oprnFieldMenu = { version: 1, entries: [{ command: "items", label: "소지품" }, { command: "endings", label: "엔딩" }, { command: "save", label: "저장" }] };
      expect(issues(project).some((text) => text.includes("갤러리 항목이 없어"))).toBe(true);
    });
  });
  describe("C6 tool boundaries", () => {
    it("spells the menu notice without a stray particle", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "configure_field_menu", { preset: "romance" });
      expect(result.summary).toContain("갤러리·엔딩 항목이 있어");
      expect(result.summary).not.toContain("엔딩가");
    });

    it("does not turn an explicit off back on when the menu is re-applied", () => {
      const ctx = { project: romance() };
      runTool(ctx, "set_vn_extras", { gallery: false });
      const result = runTool(ctx, "configure_field_menu", { preset: "romance" });
      expect(ctx.project.meta.oprnVnExtras?.gallery.enabled).toBe(false);
      expect(result.summary).toContain("꺼 둔 상태");
    });

    it("writes nothing for an empty set_vn_extras on a non-romance project", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "set_vn_extras", {});
      expect(result.ok).toBe(true);
      expect(ctx.project.meta.oprnVnExtras).toBeUndefined();
    });

    it("clears and returns to automatic for preset default even with other fields", () => {
      const ctx = { project: romance() };
      runTool(ctx, "set_vn_extras", { saveCards: false });
      const result = runTool(ctx, "set_vn_extras", { preset: "default", gallery: true });
      expect(ctx.project.meta.oprnVnExtras).toBeUndefined();
      expect(result.summary).toContain("적용하지 않았습니다");
    });

    it("sees a set_vn_extras change in the completion fingerprint", () => {
      const ctx = { project: romance() };
      const production = new PiGameSystemProduction();
      const read = runTool(ctx, "read_game_systems", {});
      production.record("read_game_systems", read, ctx.project);
      production.record("review_game_systems", { ...read, data: { issues: [] } } as never, ctx.project);
      production.record("configure_field_menu", read, ctx.project);
      expect(production.inspect(ctx.project)).toEqual([]);
      runTool(ctx, "set_vn_extras", { saveCards: false });
      expect(production.inspect(ctx.project).length).toBeGreaterThan(0);
    });
  });
  describe("C8 request words", () => {
    it.each(["미술관 갤러리 호러 게임 만들어 줘", "make a horror gallery game", "저장 칸을 5개로", "ギャラリーを舞台にしたホラー"])("does not match %s", (text) => {
      expect(GAME_SYSTEM_REQUEST_PATTERN.test(text)).toBe(false);
    });
    it.each(["CG 갤러리 화면 추가해 줘", "갤러리 화면에 엔딩 회상", "add a CG gallery", "gallery screen with locked slots", "저장 칸 카드에 마지막 대사", "CGギャラリーを付けて", "엔딩 목록 만들어 줘"])("matches %s", (text) => {
      expect(GAME_SYSTEM_REQUEST_PATTERN.test(text)).toBe(true);
    });
  });
  describe("C9 scene lines and the slot cache", () => {
    it("drops bidirectional controls", () => {
      expect(normalizeSceneLine("abc‮def")).toBe("abcdef");
      expect(saveSceneLine([{ kind: "line", text: "x⁦y⁩z" }])).toBe("xyz");
    });

    it("never cuts an emoji sequence in the middle", () => {
      const family = "👨‍👩‍👧‍👦";
      const line = normalizeSceneLine(family.repeat(SCENE_LINE_MAX + 5))!;
      expect(line.endsWith("…")).toBe(true);
      const body = line.slice(0, -1);
      expect(body.length % family.length).toBe(0);
      expect(body.startsWith(family)).toBe(true);
    });

    it("notices an in-place edit of the same project object", () => {
      const project = romance();
      addCg(project, ["cg_a"]);
      expect(listGallerySlots(project)).toEqual(["cg_a"]);
      const event = project.maps[project.startMapId]!.events.find((e) => e.id === "ev_cg")!;
      event.pages[0]!.commands.push({ kind: "showPicture", pictureId: 9, resourceId: "cg_z", recordInGallery: true } as never);
      expect(listGallerySlots(project)).toEqual(["cg_a", "cg_z"]);
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

// Pi 스트림의 «살아 있음» 계약(2026-09-14). 실측: 런타임이 턴·툴 경계에만 줄을 써 모델이 생각하는 동안
// 와이어가 비었고, Bun 유휴 타임아웃이 그 침묵을 끊어 팀 모드 「마을 만들어줘」가 매번 `terminated` 로 죽었다.
// 세 겹으로 막는다: 델타 중계(내용) · 워커 heartbeat(맥박) · 브라우저 워치독(침묵 = 워커 사망).
describe("piAgentStreamLiveness", () => {
  isolateTimers();
  function nextEvent<T>(subscribe: (listener: (event: T) => void) => void): Promise<T> {
    return new Promise((resolve) => subscribe(resolve));
  }
  async function readAllLines(stream: ReadableStream<Uint8Array>, onEvent?: (event: PiAgentEvent) => void): Promise<PiAgentEvent[]> {
    const events: PiAgentEvent[] = [];
    const decoder = createPiAgentLineDecoder((event) => { events.push(event); onEvent?.(event); });
    const reader = stream.getReader();
    const text = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      decoder.push(text.decode(value, { stream: true }));
    }
    decoder.flush();
    return events;
  }
  function ndjsonResponse(feed: (write: (event: PiAgentEvent) => void, close: () => void) => void): Response {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        feed((event) => controller.enqueue(encoder.encode(encodePiAgentEvent(event))), () => controller.close());
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
  }
  const request = { provider: "google-antigravity", task: "t", mapIds: [], project: createBlankProject() } as const;
  describe("델타 중계 — 조각을 합쳐 delta 이벤트로", () => {
    it("같은 종류는 간격 안에서 하나로 합친다", async () => {
      const emitted: PiDeltaEvent[] = [];
      let notify: ((event: PiDeltaEvent) => void) | null = null;
      const relay = createDeltaRelay((event) => { emitted.push(event); notify?.(event); }, { flushMs: 10 });
      const first = nextEvent<PiDeltaEvent>((listener) => { notify = listener; });
      relay.push("thinking", "마을은 ");
      relay.push("thinking", "20x15");
      expect(emitted).toEqual([]);
      expect(await first).toEqual({ type: "delta", kind: "thinking", text: "마을은 20x15" });
      relay.dispose();
      expect(emitted).toHaveLength(1);
    });

    it("종류가 바뀌면 앞 조각을 즉시 비우고, flush/dispose 는 남은 것을 내보낸다", () => {
      const emitted: PiDeltaEvent[] = [];
      const relay = createDeltaRelay((event) => emitted.push(event), { flushMs: 60_000 });
      relay.push("thinking", "생각");
      relay.push("text", "본문");
      expect(emitted).toEqual([{ type: "delta", kind: "thinking", text: "생각" }]);
      relay.flush();
      expect(emitted[1]).toEqual({ type: "delta", kind: "text", text: "본문" });
      relay.push("text", "");
      relay.dispose();
      expect(emitted).toHaveLength(2);
    });

    it("상한을 넘으면 간격을 기다리지 않는다", () => {
      const emitted: PiDeltaEvent[] = [];
      const relay = createDeltaRelay((event) => emitted.push(event), { flushMs: 60_000, maxChars: 5 });
      relay.push("text", "12345678");
      expect(emitted).toEqual([{ type: "delta", kind: "text", text: "12345678" }]);
      relay.dispose();
    });
  });
  describe("워커 NDJSON 스트림 — 줄 사이에 heartbeat", () => {
    it("실행이 조용해도 heartbeat 줄이 흐르고, 끝나면 닫힌다", async () => {
      let finish: (() => void) | null = null;
      const stream = createPiAgentNdjsonStream(async (onEvent) => {
        await new Promise<void>((resolve) => { finish = resolve; });
        onEvent({ type: "assistant", text: "끝" });
      }, { heartbeatMs: 10 });
      let beats = 0;
      const events = await readAllLines(stream, (event) => {
        if (event.type === "heartbeat" && ++beats === 3) finish?.();
      });
      expect(events.filter((event) => event.type === "heartbeat").length).toBeGreaterThanOrEqual(3);
      expect(events.at(-1)).toEqual({ type: "assistant", text: "끝" });
    });

    it("실행이 던지면 error 줄로 바꿔 쓰고 닫힌다", async () => {
      const stream = createPiAgentNdjsonStream(async () => { throw new Error("제공자 401"); }, { heartbeatMs: 60_000 });
      const events = await readAllLines(stream);
      expect(events).toEqual([{ type: "error", message: "제공자 401" }]);
    });
  });
  describe("브라우저 워치독 — 침묵은 워커 사망", () => {
    it("staleMs 동안 줄이 없으면 명확한 오류로 끊는다", async () => {
      const fetchImpl = (async () => ndjsonResponse((write) => {
        write({ type: "start", provider: "p", model: "m", toolCount: 1 });
      })) as unknown as typeof fetch;
      await expect(runPiAgentViaCompanion(request, { fetchImpl, staleMs: 40 })).rejects.toSatisfy((error: unknown) =>
        error instanceof PiAgentClientError && /신호가 없어 연결을 끊었습니다/.test(error.message));
    });

    it("heartbeat 가 오는 동안은 끊지 않고 done 까지 기다린다", async () => {
      const seen: string[] = [];
      const fetchImpl = (async () => ndjsonResponse((write, close) => {
        let beats = 0;
        const timer = setInterval(() => {
          write({ type: "heartbeat", at: Date.now() });
          if (++beats === 8) {
            clearInterval(timer);
            write({ type: "done", project: request.project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] });
            close();
          }
        }, 10);
      })) as unknown as typeof fetch;
      const done = await runPiAgentViaCompanion(request, { fetchImpl, staleMs: 200, onEvent: (event) => seen.push(event.type) });
      expect(done.type).toBe("done");
      expect(seen.filter((type) => type === "heartbeat")).toHaveLength(8);
    });
  });
  describe("보드 — delta 는 「생각 중」 한 줄, heartbeat 는 무시", () => {
    it("delta 가 행의 마지막 줄을 갱신한다", () => {
      let state = createTeamBoardState("team", "마을");
      state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "m", mapName: "빈 맵", task: "집" });
      state = reduceTeamBoard(state, { type: "agent_event", agentId: "b1", event: { type: "delta", kind: "thinking", text: "**도로**를 먼저 깐다" } });
      expect(state.agents[0]?.lastLine).toBe("생각 중 · 도로를 먼저 깐다");
      expect(state.agents[0]?.lastKind).toBe("text");
      const before = state;
      state = reduceTeamBoard(state, { type: "heartbeat", at: 1 });
      expect(state).toBe(before);
    });
  });
  describe("브라우저 워치독 — 우리가 적용 중인 침묵은 끊지 않는다", () => {
    it("체크포인트 적용이 staleMs 보다 길어도 실행을 끊지 않고 done 을 받는다", async () => {
      let ackBody: { ok?: boolean } | null = null;
      const fetchImpl = (async (url: string, init?: RequestInit) => {
        if (String(url).includes("/v1/agent/checkpoint")) {
          // 큰 프로젝트를 실은 ACK 는 gzip 바이트로 간다(piRequestBody) — 몸통 모양대로 푼다.
          const raw = init?.body;
          ackBody = JSON.parse(raw instanceof ArrayBuffer || ArrayBuffer.isView(raw) ? gunzipSync(Buffer.from(raw as ArrayBuffer)).toString("utf8") : String(raw));
          return new Response("{}", { status: 200 });
        }
        return ndjsonResponse((write, close) => {
          write({ type: "checkpoint", checkpointId: "c1", project: request.project, label: "t", toolName: "t" } as never);
          // 워커는 ACK 를 기다리며 조용하다(heartbeat 도 페이지가 바빠 못 읽은 상황).
          const wait = setInterval(() => {
            if (!ackBody) return;
            clearInterval(wait);
            write({ type: "done", project: request.project, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [] });
            close();
          }, 5);
        });
      }) as unknown as typeof fetch;
      const done = await runPiAgentViaCompanion(request, {
        fetchImpl, staleMs: 30,
        onCheckpoint: () => new Promise(resolve => setTimeout(() => resolve(request.project), 120)),
      });
      expect(done.type).toBe("done");
      expect(ackBody).toMatchObject({ ok: true });
    });

    it("워치독이 끊은 뒤의 ACK 실패보다 끊긴 원인을 보고한다", async () => {
      const fetchImpl = (async (url: string) => {
        if (String(url).includes("/v1/agent/checkpoint")) return new Response("{}", { status: 409 });
        return ndjsonResponse((write) => {
          write({ type: "start", provider: "p", model: "m", toolCount: 1 });
          setTimeout(() => write({ type: "checkpoint", checkpointId: "c1", project: request.project, label: "t", toolName: "t" } as never), 80);
        });
      }) as unknown as typeof fetch;
      await expect(runPiAgentViaCompanion(request, { fetchImpl, staleMs: 40, onCheckpoint: async () => request.project }))
        .rejects.toSatisfy((error: unknown) => error instanceof PiAgentClientError && /신호가 없어 연결을 끊었습니다/.test(error.message));
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
