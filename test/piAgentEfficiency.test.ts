import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { addPiAgentUsage, changedProjectKeys, createPiAgentLineDecoder, encodePiAgentEvent, restoreCheckpointProject, slimDoneEvent, slimProjectForWire, unchangedHeavyKeys, type PiAgentDoneEvent, type PiAgentEvent } from "@/ai/piAgent/protocol";
import { createDraft } from "@/editor/tools/changeset";
import { spatialToolFingerprint, adoptSpatialToolProof, authorMergedSpatialProposal, exportSpatialToolProof } from "@/editor/tools/spatialToolState";
import { createBlankProject } from "@/project/defaults";
import { contentFingerprint } from "@/util/fingerprint";
import { jsonEqual } from "@/util/structuralJson";
import { requestPiRender, resolvePiRender } from "../scripts/lib/piRenderBroker";
import type { Project } from "@/project/types";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { runTool } from "@/editor/tools/toolRunner";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { own } from "@/project/spatial/domain";
import { store } from "@/project/store";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { isolateTimers } from "./mergedTeardown";

describe("piAgentEfficiency", () => {
  isolateTimers();
  function doneFor(project: ReturnType<typeof createBlankProject>): PiAgentDoneEvent {
    return { type: "done", project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] };
  }
  describe("NDJSON 디코더", () => {
    it("조각을 어떻게 잘라도 같은 이벤트를 낸다", () => {
      const events: PiAgentEvent[] = [{ type: "turn", index: 1 }, { type: "assistant", text: "가\n나" }, { type: "heartbeat", at: 3 }];
      const wire = events.map(encodePiAgentEvent).join("");
      for (const size of [1, 2, 3, 7, 64, wire.length]) {
        const out: PiAgentEvent[] = [];
        const decoder = createPiAgentLineDecoder(event => out.push(event));
        for (let i = 0; i < wire.length; i += size) decoder.push(wire.slice(i, i + size));
        decoder.flush();
        expect(out, `조각 ${size}`).toEqual(events);
      }
    });

    it("끝 줄바꿈 없는 마지막 줄은 flush 가 낸다", () => {
      const out: PiAgentEvent[] = [];
      const decoder = createPiAgentLineDecoder(event => out.push(event));
      decoder.push(JSON.stringify({ type: "turn", index: 9 }));
      expect(out).toEqual([]);
      decoder.flush();
      expect(out).toEqual([{ type: "turn", index: 9 }]);
    });

    // Break: 조각마다 버퍼 처음부터 indexOf 하면 8 MB 줄 × 1 KiB 조각이 수십 초가 된다(실측 33.5 MB 에 51 s).
    it("큰 한 줄을 잘게 받아도 선형이다", () => {
      const line = encodePiAgentEvent({ type: "assistant", text: "x".repeat(8_000_000) });
      const out: PiAgentEvent[] = [];
      const decoder = createPiAgentLineDecoder(event => out.push(event));
      const started = performance.now();
      for (let i = 0; i < line.length; i += 1024) decoder.push(line.slice(i, i + 1024));
      const ms = performance.now() - started;
      expect(out).toHaveLength(1);
      expect(ms).toBeLessThan(3_000);
    });
  });
  describe("내용 판정", () => {
    it("jsonEqual 은 JSON 문자열 비교와 같은 답을 낸다(키 순서만 무시)", () => {
      const cases: [unknown, unknown][] = [
        [{ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }],
        [{ a: 1, b: undefined }, { a: 1 }],
        [[1, undefined], [1, null]],
        [{ a: 1 }, { a: 2 }],
        [{ a: [1, 2] }, { a: [1, 2, 3] }],
        ["x", "x"], [null, null], [0, -0], [{ a: {} }, { a: [] }],
      ];
      for (const [a, b] of cases) {
        const viaJson = JSON.stringify(a) === JSON.stringify(b) || JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
        expect(jsonEqual(a, b), JSON.stringify([a, b])).toBe(viaJson);
      }
    });

    it("지문은 같은 내용에 같고 한 글자 차이에 다르다", () => {
      const project = createBlankProject();
      expect(spatialToolFingerprint(project)).toBe(spatialToolFingerprint(structuredClone(project)));
      const changed = structuredClone(project);
      Object.values(changed.maps)[0]!.lowerTiles[0] += 1;
      expect(spatialToolFingerprint(changed)).not.toBe(spatialToolFingerprint(project));
      expect(contentFingerprint("ab")).not.toBe(contentFingerprint("ba"));
      expect(contentFingerprint("")).toMatch(/^[0-9a-f]{32}$/);
    });

    // Break: 쓰기 도구마다 createDraft 가 타일셋을 복제해 정체성 판정이 늘 실패했고, 체크포인트가 쓰기마다 33.5 MB 였다.
    it("초안으로 복제해도 안 바뀐 무거운 키는 빼고 보낸다", () => {
      const base = createBlankProject();
      const draft = createDraft(base);
      Object.values(draft.maps)[0]!.lowerTiles[0] += 1;
      expect(draft.tilesets).not.toBe(base.tilesets);
      expect(unchangedHeavyKeys(base, draft)).toEqual(["tilesets", "database", "assets"]);
      expect(changedProjectKeys(base, draft)).toEqual([`maps.${Object.keys(draft.maps)[0]}`]);
    });

    it("done 은 요청 그대로인 타일셋·DB 를 빼고 보내고 받는 쪽이 되붙인다", () => {
      const base = createBlankProject();
      const result = createDraft(base);
      const slim = slimDoneEvent(doneFor(result), base);
      expect(slim.unchangedKeys).toEqual(["tilesets", "database", "assets"]);
      expect(Object.keys(slim.project.tilesets)).toEqual([]);
      const wire = JSON.parse(encodePiAgentEvent(slim)) as PiAgentDoneEvent;
      const restored = restoreCheckpointProject(base, wire.project, wire.unchangedKeys);
      expect(restored.tilesets).toBe(base.tilesets);
      expect(jsonEqual(restored, result)).toBe(true);
      // 타일셋이 바뀌었으면 그대로 싣는다.
      const edited = createDraft(base);
      const firstTileset = Object.values(edited.tilesets)[0]!;
      firstTileset.name = `${firstTileset.name}!`;
      expect(slimDoneEvent(doneFor(edited), base).unchangedKeys).toEqual(["database", "assets"]);
    });

    // Break(2026-09-28 실측): 마을이 forest_harmony 하나에 이식을 더하자 39개 타일셋 25MB 가 체크포인트마다 통째로 실렸고,
    // 팀 중계를 지나며 101MB 줄이 되어 브라우저 워치독이 30초에 연결을 끊었다.
    it("타일셋 하나만 바뀌면 그 하나만 싣고 나머지는 받는 쪽이 되붙인다", () => {
      const base = createBlankProject();
      const edited = createDraft(base);
      const [changedId, ...rest] = Object.keys(edited.tilesets);
      edited.tilesets[changedId!]!.name += "!";
      const wire = slimProjectForWire(base, edited);
      expect(wire.unchangedKeys).toEqual(["database", "assets"]);
      expect(Object.keys(wire.project.tilesets)).toEqual([changedId]);
      expect(new Set(wire.unchangedTilesetIds)).toEqual(new Set(rest));
      const line = JSON.parse(JSON.stringify(wire.project));
      const restored = restoreCheckpointProject(base, line, wire.unchangedKeys, wire.unchangedTilesetIds);
      expect(jsonEqual(restored, edited)).toBe(true);
      expect(restored.tilesets[rest[0]!]).toBe(base.tilesets[rest[0]!]);
      const done = slimDoneEvent(doneFor(edited), base);
      expect(done.unchangedTilesetIds?.length).toBe(rest.length);
      // 받는 쪽 사본에 없는 타일셋을 뺐다고 하면 조용히 비우지 않고 멈춘다.
      expect(() => restoreCheckpointProject({ ...base, tilesets: {} }, line, wire.unchangedKeys, wire.unchangedTilesetIds)).toThrow(/사본에 없습니다/);
    });
  });
  describe("토큰 원장", () => {
    // Break: 마지막 호출의 usage 로 덮어써서 Pi 실행 41건의 토큰 원장이 0이었다.
    it("호출마다 더하고 호출 수를 센다", () => {
      let total = addPiAgentUsage(undefined, { input: 100, output: 10, cacheRead: 50, cacheWrite: 0, totalTokens: 160 });
      total = addPiAgentUsage(total, { input: 20, output: 5, cacheRead: 0, cacheWrite: 0 });
      total = addPiAgentUsage(total, undefined);
      expect(total).toEqual({ input: 120, output: 15, cacheRead: 50, cacheWrite: 0, totalTokens: 185, calls: 2 });
      expect(addPiAgentUsage(total, total)).toMatchObject({ input: 240, calls: 4 });
    });
  });
  function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys((value as Record<string, unknown>)[key])]));
    return value;
  }
});

// 그림 요청 줄은 «마지막 적용본» 과 비교해 줄인다 — 처음 요청과만 비교하면 마을이 타일셋을 한 번 바꾼 뒤로
// 그림마다 그 타일셋(버들항 26.8MB)이 실려 한 장 왕복이 약 21초였다(2026-11-25 draft-10min m3 실측).
describe("piRenderLatestBase", () => {
  isolateTimers();
  const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  function withChangedTileset(project: Project): Project {
    const next = structuredClone(project);
    const id = Object.keys(next.tilesets)[0]!;
    next.tilesets[id] = { ...next.tilesets[id]!, name: `${next.tilesets[id]!.name ?? id} (마을이 바꿈)` };
    return next;
  }
  async function capture(project: Project, base: Project, latest: boolean) {
    let sent: Extract<PiAgentEvent, { type: "render_request" }> | undefined;
    const reply = requestPiRender(project, base, "show_map_region", {}, (event) => { sent = event as typeof sent; }, new AbortController().signal, 45_000, latest);
    expect(sent).toBeDefined();
    expect(resolvePiRender({ renderId: sent!.renderId, png: PNG_1x1 })).toBe(true);
    await reply;
    return sent!;
  }
  describe("render request slimmed against the last applied checkpoint", () => {
    it("leaves out a tileset the editor already got in a checkpoint and marks the base", async () => {
      const request = createBlankProject() as Project;
      const changed = withChangedTileset(request);
      const id = Object.keys(changed.tilesets)[0]!;
      // 처음 요청과 비교하면 바뀐 타일셋이 실린다(예전 모양).
      const old = await capture(structuredClone(changed), request, false);
      expect(old.baseIsLatest).toBeUndefined();
      expect(Object.keys(old.project.tilesets ?? {})).toContain(id);
      // 그 타일셋이 이미 적용된 체크포인트와 비교하면 빠지고, 편집기가 그 적용본에서 되붙이도록 표시한다.
      const now = await capture(structuredClone(changed), changed, true);
      expect(now.baseIsLatest).toBe(true);
      expect(Object.keys(now.project.tilesets ?? {})).not.toContain(id);
    });
  });
});

describe("piSpatialProofWire", () => {
  isolateTimers();
  const ROOM = "Accepted room";
  function options(...toolNames: string[]) {
    const live = store.getCurrent();
    return {
      base: captureProposalBase(live),
      baseline: new AuthoredProjectBaseline(live),
      source: "agent" as const,
      summary: "Canonical wire probe",
      toolNames,
    };
  }
  /** 동반 서비스가 돌려주는 모양: JSON 사본이고, 편집기 전용 메모리는 실리지 않는다. */
  function wire(project: Project): Project {
    return JSON.parse(JSON.stringify(project)) as Project;
  }
  function authoredDraft(): Project {
    const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
    const design = own(fixtureDocument(ctx.project).library.spaces, spaceDesign);
    const result = runTool(ctx, "upsert_spatial_design", {
      kind: "space", expectedRevision: 1, space: { ...design, revision: 2, name: ROOM },
    });
    expect(result.ok, result.summary).toBe(true);
    return ctx.project;
  }
  function renamedMapDraft(): Project {
    const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
    const result = runTool(ctx, "set_map_properties", { mapId: ctx.project.startMapId, name: "MERGED title" });
    expect(result.ok, result.summary).toBe(true);
    return ctx.project;
  }
  beforeEach(() => {
    vi.stubEnv("VITE_LEGACY_DB_URL", "");
    vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
    vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(spaceCompilerFixture());
    resetMapEditHistory();
  });
  afterEach(() => { vi.unstubAllEnvs(); resetMapEditHistory(); });
  it("동반 서비스가 실어 보낸 증거로 계층 변경이 적용된다", async () => {
    // Given: the worker ran the canonical tool and sealed the proposal in its own process.
    const draft = authoredDraft();
    const proof = exportSpatialToolProof(draft);
    expect(proof).not.toBeNull();
    // When: the browser adopts the wire digests, as the /pi client does before applying.
    const incoming = wire(draft);
    adoptSpatialToolProof(incoming, proof, store.getCurrent());
    const applied = await applyProposedProject(incoming, options("upsert_spatial_design"));
    // Then
    expect(applied.ok, JSON.stringify(applied)).toBe(true);
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.revision).toBe(2);
  });
  it("증거 없는 계층 제안은 반려된다", async () => {
    // Given: the same worker output without its proof.
    const incoming = wire(authoredDraft());
    // When
    const applied = await applyProposedProject(incoming, options("upsert_spatial_design"));
    // Then
    expect(applied).toMatchObject({ ok: false, reason: "commit-rejected", issue: "Spatial hierarchy changes require the validated spatial tools" });
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.revision).toBe(1);
  });
  it("증거 없는 일반 편집도 canonical 프로젝트에서는 반려된다", async () => {
    // Given: map-only work, which is what /pi team does on a canonical project.
    const incoming = wire(renamedMapDraft());
    // When
    const applied = await applyProposedProject(incoming, options("set_map_properties"));
    // Then: the exact message the /pi panel renders as 적용 실패.
    expect(applied).toMatchObject({ ok: false, reason: "commit-rejected", issue: "Canonical AI acceptance requires an issued tool proposal" });
  });
  it("기준이 움직인 뒤의 증거는 되붙지 않는다", async () => {
    // Given: a live edit between the worker run and adoption.
    const draft = authoredDraft();
    const proof = exportSpatialToolProof(draft);
    store.update(project => { project.meta.author = "LIVE EDIT"; });
    // When
    const incoming = wire(draft);
    adoptSpatialToolProof(incoming, proof, store.getCurrent());
    // Then
    expect(exportSpatialToolProof(incoming)).toBeNull();
  });
  it("병합을 거친 제안은 살아있는 문서 기준으로 승인을 다시 받는다", async () => {
    // Given: the same merge the /pi client performs for a map-scoped run.
    const live = store.getCurrent();
    const merged = mergeMapBundles(live, [{ mapIds: [live.startMapId], project: renamedMapDraft() }]);
    expect(exportSpatialToolProof(merged.project)).toBeNull();
    // When
    authorMergedSpatialProposal(merged.project, live);
    const applied = await applyProposedProject(merged.project, options("set_map_properties"));
    // Then
    expect(applied.ok, JSON.stringify(applied)).toBe(true);
    expect(store.getCurrent().maps[store.getCurrent().startMapId]?.name).toBe("MERGED title");
  });
  it("병합이 실어 온 계층 편집은 병합 승인으로 세탁되지 않는다", async () => {
    // Given: a hierarchy edit riding along with a bundle merge.
    const live = store.getCurrent();
    const merged = mergeMapBundles(live, [{ mapIds: [live.startMapId], project: renamedMapDraft() }]);
    const document = fixtureDocument(store.getCurrent());
    merged.project.spatialAuthoring = { ...document, library: { ...document.library, spaces: { ...document.library.spaces, [spaceDesign]: { ...own(document.library.spaces, spaceDesign), revision: 2 } } } };
    // When
    authorMergedSpatialProposal(merged.project, live);
    const applied = await applyProposedProject(merged.project, options("set_map_properties"));
    // Then
    expect(applied).toMatchObject({ ok: false, reason: "commit-rejected", issue: "Spatial hierarchy changes require the validated spatial tools" });
  });
});
