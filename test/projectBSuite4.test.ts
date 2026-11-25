import { describe, expect, it, afterEach, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession, setMapTileOverride } from "@/project/session";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { collectLifeRecoveryClaim, isLifeRecoveryJson, moveLifeRecoverySource, reconcileLifeState, LifeReconciliationError } from "@/project/lifeRecovery";
import { placeFarmBuilding, placeHomeDecoration, removeFarmBuilding, removeHomeDecoration } from "@/project/spatialPlacementTransactions";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot, latestResumableSave, readLatestSave, writeAutosave } from "@/player/saveSlots";
import { buildStandaloneHtml, inlineCssAssetUrls, standaloneAssetKey, standaloneHtmlFileName, STANDALONE_ASSETS_NODE_ID, STANDALONE_PROJECT_NODE_ID } from "@/project/standaloneHtml";
import { Script } from "node:vm";
import { briefTilesetHint, planStart, START_FORMS_BY_THEME, START_TERRAINS_BY_THEME, startPlanPrompt } from "@/project/startVariety";
import { paintStartRoute, routeStyleFor, startMapSizeFor } from "@/project/startRoutePaint";
import { depositToChest, ensureChest } from "@/project/placeables";
import { chestAcceptsNewStack, resolveStorageChest, storageChestLockState, storageChestTabOf, transferChestGold } from "@/project/storageChest";
import { recoverPlayerFromTerrain } from "@/project/terrainLandingRecovery";
import { setLayerTileAt } from "@/project/mapLayers";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { applyTerrainWalkDamage, scaledEncounterRate } from "@/project/terrainStep";
import { store } from "@/project/store";
import { CHASE_MAX_EXPANSIONS, findChasePath, nextChaseDecision } from "@/player/chaseAi";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { event, fixture, ticks, pos } from "./fixtures/npcChasePathfinding";
import { invalidateTilePassabilityComponents } from "@/project/tilePassabilityComponents";
import { tilesetKind } from "@/project/tilesetKind";
import type { TilesetDef, Project, SaveSnapshot, TitleScreenSettings, UploadedAsset } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { applyTitleVariant, normalizeTitleScreenVariants, resolveTitleVariant } from "@/project/titleVariants";
import { recordEndingClear, readClearRecord } from "@/player/clearRecord";
import { readLoadingInfo } from "@/player/bootLoader";
import { webUploadedAssetPath } from "@/project/webUploadedAssetPath";
import { isolateTimers } from "./mergedTeardown";

describe("spatialRecoveryRights", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly data = new Map<string, string>();
    get length() { return this.data.size; }
    clear() { this.data.clear(); }
    getItem(key: string) { return this.data.get(key) ?? null; }
    key(index: number) { return [...this.data.keys()][index] ?? null; }
    removeItem(key: string) { this.data.delete(key); }
    setItem(key: string, value: string) { this.data.set(key, value); }
  }
  function fixture() {
    const project = createBlankProject();
    const item = project.database.items[0];
    if (!item) throw new Error("Missing baseline item");
    const itemId = item.id;
    project.database.farmBuildingTypes = [{ id: "building", name: "Building", levels: [{ level: 1, capacity: 1, footprint: { width: 1, height: 1 }, graphicResourceId: "easyrpg-picture-cloud", cost: { gold: 10, items: [{ itemId, count: 1 }] } }] }];
    project.database.homeDecorationTypes = [{ id: "rug", name: "Rug", footprint: { width: 1, height: 1 }, blocksMovement: false, allowedOrientations: ["down"], placementItemId: itemId, graphicResourceId: "easyrpg-picture-cloud" }];
    const session = startSession(project, 12948);
    session.gold = 100;
    session.inventory[itemId] = 10;
    const building = { instanceId: "b1", typeId: "building", mapId: project.startMapId, x: 8, y: 5, orientation: "down" } as const;
    const rug = { ...building, instanceId: "r1", typeId: "rug", x: 10 };
    return { project, session, itemId, item, building, rug };
  }
  const claims = (session: PlaySession) => Object.values(session.lifeRecovery?.claims ?? {});
  function roundtrip(project: ReturnType<typeof fixture>["project"], session: PlaySession) {
    const storage = new MemoryStorage();
    const before = structuredClone(session);
    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.schemaVersion).toBe(5);
    expect(project.version).toBe(4);
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    const raw = storage.getItem(saveSlotKey(1));
    const parsed = readSaveSlot(storage, 1);
    if (parsed.kind !== "present") throw new Error(parsed.kind);
    const restored = applySaveSnapshot(project, parsed.snapshot);
    expect(structuredClone(session)).toEqual(before);
    expect(storage.getItem(saveSlotKey(1))).toBe(raw);
    return restored;
  }
  function unpaid(session: PlaySession, original: unknown) {
    const retained = claims(session).filter(claim => claim.sourceId === "b1" && claim.items.length === 0);
    expect(retained).toHaveLength(1);
    expect(retained[0]?.unresolved?.record).toEqual(original);
    expect(retained[0]?.unresolved?.record).toMatchObject({ paymentReceipt: { gold: 10 } });
  }
  describe("spatial recovery conservation", () => {
    it("retains unpaid gold10 after mixed item collection and repeated Save5 resume", () => {
      const { project, session, itemId, building } = fixture();
      expect(placeFarmBuilding(project, session, building).ok).toBe(true);
      const original = structuredClone(session.farmBuildingPlacements?.b1);
      session.farmPlots = { [project.startMapId]: { "8,5": { tilled: true, watered: false } } };
      let restored = roundtrip(project, session);
      const payable = claims(restored).find(claim => claim.items.length > 0);
      if (!payable) throw new Error("Missing payable item claim");
      expect(collectLifeRecoveryClaim(project, restored, payable.id).ok).toBe(true);
      expect(restored.inventory[itemId]).toBe(10);
      expect(restored.gold).toBe(90);
      unpaid(restored, original);
      const before = structuredClone(restored);
      expect(collectLifeRecoveryClaim(project, restored, payable.id)).toEqual({ ok: false, reason: "missing-claim" });
      expect(structuredClone(restored)).toEqual(before);
      restored = roundtrip(project, roundtrip(project, restored));
      unpaid(restored, original);
      expect(restored.lifeRecovery).toEqual(before.lifeRecovery);
    });

    it("freezes the actual paid decoration item and recovers it after definition removal", () => {
      const { project, session, itemId, rug } = fixture();
      expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
      expect(session.inventory[itemId]).toBe(9);
      expect(session.homeDecorationPlacements?.r1?.recoveryItem).toEqual({ itemId, count: 1 });
      project.database.homeDecorationTypes = [];
      let restored = roundtrip(project, session);
      const claim = claims(restored)[0];
      if (!claim) throw new Error("Missing decoration claim");
      expect(claim.items).toEqual([{ itemId, count: 1 }]);
      expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(true);
      expect(restored.inventory[itemId]).toBe(10);
      expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(false);
      restored = roundtrip(project, roundtrip(project, restored));
      expect(claims(restored)).toEqual([]);
      expect(restored.inventory[itemId]).toBe(10);
    });

    it("retains gold-only proof without payout and keeps normal demolition claim-free", () => {
      const { project, session, building } = fixture();
      const type = project.database.farmBuildingTypes?.[0];
      if (!type) throw new Error("Missing type");
      project.database.farmBuildingTypes = [{ ...type, levels: type.levels.map(level => ({ ...level, cost: { gold: 10 } })) }];
      expect(placeFarmBuilding(project, session, building).ok).toBe(true);
      const original = structuredClone(session.farmBuildingPlacements?.b1);
      const demolition = structuredClone(session);
      expect(removeFarmBuilding(demolition, "b1").ok).toBe(true);
      expect(claims(demolition)).toEqual([]);
      expect(demolition.gold).toBe(90);
      project.database.farmBuildingTypes = [];
      const restored = roundtrip(project, session);
      unpaid(restored, original);
      const before = structuredClone(restored);
      for (const claim of claims(restored)) expect(collectLifeRecoveryClaim(project, restored, claim.id)).toEqual({ ok: false, reason: "unresolved" });
      expect(structuredClone(restored)).toEqual(before);
    });

    it("partitions split item batches from one gold proof through partial collect/save/resume", () => {
      const { project, session, itemId, building } = fixture();
      expect(placeFarmBuilding(project, session, building).ok).toBe(true);
      Object.assign(session.farmBuildingPlacements?.b1 ?? {}, { paymentReceipt: { gold: 10, items: [{ itemId, count: ITEM_QUANTITY_MAX + 1 }] } });
      const original = structuredClone(session.farmBuildingPlacements?.b1);
      session.inventory = {};
      project.database.farmBuildingTypes = [];
      let restored = roundtrip(project, session);
      const batches = claims(restored).filter(claim => claim.items.length > 0);
      expect(batches.map(claim => claim.items)).toEqual([[{ itemId, count: ITEM_QUANTITY_MAX }], [{ itemId, count: 1 }]]);
      unpaid(restored, original);
      const first = batches[0]; const second = batches[1];
      if (!first || !second) throw new Error("Missing split");
      expect(collectLifeRecoveryClaim(project, restored, first.id).ok).toBe(true);
      restored = roundtrip(project, restored);
      const before = structuredClone(restored);
      expect(collectLifeRecoveryClaim(project, restored, second.id)).toEqual({ ok: false, reason: "inventory-overflow" });
      expect(structuredClone(restored)).toEqual(before);
      restored.inventory = {}; // Spend the first batch before explicitly collecting the next.
      expect(collectLifeRecoveryClaim(project, restored, second.id).ok).toBe(true);
      restored = roundtrip(project, restored);
      unpaid(restored, original);
      expect(restored.lifeRecovery?.nextSequence).toBe(before.lifeRecovery?.nextSequence);
      expect(restored.gold).toBe(90);
    });

    it.each(["capacity", "sequence"] as const)("refuses %s exhaustion atomically including the additional unpaid owner", kind => {
      const { project, session, building } = fixture();
      expect(placeFarmBuilding(project, session, building).ok).toBe(true);
      session.lifeRecovery = kind === "sequence" ? { nextSequence: Number.MAX_SAFE_INTEGER - 1, claims: {} } : {
        nextSequence: 4096, claims: Object.fromEntries(Array.from({ length: 4095 }, (_, i) => {
          const id = `recovery:${i + 1}`;
          return [id, { id, sourceKind: "old", sourceId: "old", reason: "unknown", items: [], unresolved: { record: { amount: 7 }, detail: "unknown" } }];
        })),
      };
      const before = structuredClone(session);
      expect(moveLifeRecoverySource(project, session, { sourceKind: "farmBuildingPlacements", sourceId: "b1", reason: "removed" })).toEqual({ ok: false, reason: "capacity" });
      expect(structuredClone(session)).toEqual(before);
    });

    it("preserves each old mixed record without speculative deduplication or repeat payout", () => {
      const { project, session, itemId, building } = fixture();
      expect(placeFarmBuilding(project, session, building).ok).toBe(true);
      const original = structuredClone(session.farmBuildingPlacements?.b1);
      if (!original) throw new Error("Missing original");
      if (!isLifeRecoveryJson(original)) throw new Error("Non-JSON original");
      session.farmBuildingPlacements = {};
      session.lifeRecovery = { nextSequence: 3, claims: Object.fromEntries([1, 2].map(sequence => {
        const id = `recovery:${sequence}`;
        return [id, { id, sourceKind: "farmBuildingPlacements", sourceId: "b1", reason: "incompatible-placement", items: [{ itemId, count: 1 }], unresolved: { record: original, detail: "incompatible-placement" } }];
      })) };
      for (const id of ["recovery:1", "recovery:2"]) {
        expect(collectLifeRecoveryClaim(project, session, id).ok).toBe(true);
        expect(collectLifeRecoveryClaim(project, session, id).ok).toBe(false);
      }
      const restored = roundtrip(project, roundtrip(project, session));
      expect(restored.inventory[itemId]).toBe(11);
      expect(restored.gold).toBe(90);
      expect(restored.lifeRecovery?.nextSequence).toBe(5);
      expect(claims(restored)).toHaveLength(2);
      for (const claim of claims(restored)) {
        expect(claim.items).toEqual([]);
        expect(claim.unresolved?.record).toEqual(original);
      }
    });

    it.each(["legacy", "starting"] as const)("preserves missing-proof %s originals without historical inference", kind => {
      const { project, session, rug, itemId } = fixture();
      if (kind === "starting") project.session.homeDecorationPlacements = [rug];
      else session.homeDecorationPlacements = { r1: rug };
      const input = kind === "starting" ? startSession(project, 12948) : session;
      const before = structuredClone(input.homeDecorationPlacements?.r1);
      project.database.homeDecorationTypes = [];
      const restored = roundtrip(project, roundtrip(project, input));
      expect(claims(restored)).toHaveLength(1);
      expect(claims(restored)[0]?.items).toEqual([]);
      expect(claims(restored)[0]?.unresolved?.record).toEqual(before);
      expect(restored.inventory[itemId]).toBe(input.inventory[itemId]);
    });

    it.each(["changed", "deleted"] as const)("ordinary reclaim uses frozen evidence with a %s type", mode => {
      const { project, session, rug, itemId } = fixture();
      expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
      project.database.homeDecorationTypes = mode === "deleted" ? [] : (project.database.homeDecorationTypes ?? []).map(type => ({ ...type, placementItemId: "not-the-paid-item" }));
      expect(removeHomeDecoration(project, session, "r1").ok).toBe(true);
      expect(session.inventory[itemId]).toBe(10);
      expect(session.inventory["not-the-paid-item"]).toBeUndefined();
      expect(removeHomeDecoration(project, session, "r1")).toEqual({ ok: false, reason: "missing" });
    });

    it("keeps unknown paid items until restored and requires explicit collection", () => {
      const { project, session, rug, itemId, item } = fixture();
      expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
      project.database.homeDecorationTypes = [];
      project.database.items = project.database.items.filter(entry => entry.id !== itemId);
      const restored = roundtrip(project, session);
      const claim = claims(restored)[0];
      if (!claim) throw new Error("Missing claim");
      expect(claim.items).toEqual([{ itemId, count: 1 }]);
      const before = structuredClone(restored);
      expect(collectLifeRecoveryClaim(project, restored, claim.id)).toEqual({ ok: false, reason: "unresolved" });
      expect(structuredClone(restored)).toEqual(before);
      project.database.items.push(item);
      expect(reconcileLifeState(project, restored).inventory).toEqual(before.inventory);
      expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(true);
      expect(restored.inventory[itemId]).toBe((before.inventory[itemId] ?? 0) + 1);
    });

    it("refuses legacy mixed collection at exhausted sequence without inventory side effects", () => {
      const { project, session, itemId, building } = fixture();
      expect(placeFarmBuilding(project, session, building).ok).toBe(true);
      const original = session.farmBuildingPlacements?.b1;
      if (!original) throw new Error("Missing placement");
      if (!isLifeRecoveryJson(original)) throw new Error("Non-JSON placement");
      session.farmBuildingPlacements = {};
      session.lifeRecovery = { nextSequence: Number.MAX_SAFE_INTEGER, claims: { "recovery:1": {
        id: "recovery:1", sourceKind: "farmBuildingPlacements", sourceId: "b1", reason: "removed", items: [{ itemId, count: 1 }], unresolved: { record: original, detail: "removed" },
      } } };
      const before = structuredClone(session);
      expect(collectLifeRecoveryClaim(project, session, "recovery:1")).toEqual({ ok: false, reason: "capacity" });
      expect(structuredClone(session)).toEqual(before);
    });

    it("refuses ordinary decoration inventory overflow and missing paid item with whole-state equality", () => {
      const { project, session, itemId, rug } = fixture();
      expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
      session.inventory[itemId] = ITEM_QUANTITY_MAX;
      const before = structuredClone(session);
      expect(removeHomeDecoration(project, session, "r1")).toEqual({ ok: false, reason: "overflow" });
      expect(structuredClone(session)).toEqual(before);
      project.database.items = project.database.items.filter(item => item.id !== itemId);
      expect(removeHomeDecoration(project, session, "r1")).toEqual({ ok: false, reason: "invalid" });
      expect(structuredClone(session)).toEqual(before);
    });

    it("recovers the frozen decoration item after a changed type becomes persistently incompatible", () => {
      const { project, session, itemId, rug } = fixture();
      expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
      project.database.homeDecorationTypes = (project.database.homeDecorationTypes ?? []).map(type => ({ ...type, placementItemId: "new-cost" }));
      session.farmPlots = { [project.startMapId]: { "10,5": { tilled: true, watered: false } } };
      const restored = roundtrip(project, session);
      expect(claims(restored).flatMap(claim => claim.items)).toEqual([{ itemId, count: 1 }]);
      for (const claim of claims(restored)) expect(collectLifeRecoveryClaim(project, restored, claim.id).ok).toBe(true);
      expect(restored.inventory[itemId]).toBe(10);
      expect(restored.inventory["new-cost"]).toBeUndefined();
    });

    it("rejects missing placement items without spending or recording a placement", () => {
      const { project, session, rug } = fixture();
      project.database.homeDecorationTypes = (project.database.homeDecorationTypes ?? []).map(type => ({ ...type, placementItemId: "" }));
      const before = structuredClone(session);
      expect(placeHomeDecoration(project, session, rug)).toEqual({ ok: false, reason: "invalid" });
      expect(structuredClone(session)).toEqual(before);
    });

    it.each([null, { itemId: "", count: 1 }, { itemId: "item_potion", count: 0 }, { itemId: "item_potion", count: 2 }, { itemId: "item_potion", count: -1 }, { itemId: "item_potion", count: 0.5 }])("rejects malformed frozen proof %# repeatedly without changing raw or memory", recoveryItem => {
      const { project, session, rug } = fixture();
      expect(placeHomeDecoration(project, session, rug).ok).toBe(true);
      const storage = new MemoryStorage();
      const snapshot = createSaveSnapshot(project, session);
      expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
      const previous = storage.getItem(saveSlotKey(1));
      Object.assign(snapshot.session.homeDecorationPlacements?.r1 ?? {}, { recoveryItem });
      Object.assign(session.homeDecorationPlacements?.r1 ?? {}, { recoveryItem });
      const before = structuredClone(session);
      const corruptStorage = new MemoryStorage();
      const malformedRaw = JSON.stringify(snapshot);
      corruptStorage.setItem(saveSlotKey(1), malformedRaw);
      for (let i = 0; i < 2; i++) {
        expect(() => createSaveSnapshot(project, session)).toThrow(LifeReconciliationError);
        expect(() => applySaveSnapshot(project, snapshot)).toThrow(LifeReconciliationError);
        expect(readSaveSlot(corruptStorage, 1).kind).toBe("corrupt");
        expect(corruptStorage.getItem(saveSlotKey(1))).toBe(malformedRaw);
        expect(storage.getItem(saveSlotKey(1))).toBe(previous);
        expect(structuredClone(session)).toEqual(before);
      }
    });
  });
});

describe("standaloneHtml", () => {
  isolateTimers();
  const BASE = {
    title: "테스트 게임",
    css: "body{color:red}",
    script: "console.log(1)",
    projectJson: '{"meta":{"title":"테스트 게임"}}',
    inlineAssets: { "assets/a.png": "data:image/png;base64,AA==" },
  };
  describe("standalone html", () => {
    it("프로젝트와 에셋을 문서 안 노드로 싣는다", () => {
      // Given
      const input = BASE;

      // When
      const html = buildStandaloneHtml(input);

      // Then
      expect(html).toContain(`id="${STANDALONE_PROJECT_NODE_ID}"`);
      expect(html).toContain(`id="${STANDALONE_ASSETS_NODE_ID}"`);
      expect(html).toContain("data:image/png;base64,AA==");
      expect(html).toContain(input.script);
      expect(html).toContain(input.css);
    });

    // 저작자가 대사에 </script> 를 쓰면 문서가 거기서 끊긴다 — 게임이 통째로 안 열린다.
    it("프로젝트 JSON 의 </script> 가 문서를 끊지 않는다", () => {
      // Given
      const projectJson = JSON.stringify({ meta: { title: "x" }, note: "</script><script>alert(1)</script>" });

      // When
      const html = buildStandaloneHtml({ ...BASE, projectJson });

      // Then
      expect(html).not.toContain("</script><script>alert(1)");
      expect(html).toContain("\\u003c/script>");
      // 스크립트 태그는 본문 한 개 + JSON 노드 두 개 = 정확히 3쌍이어야 한다.
      expect(html.match(/<script/g)?.length).toBe(3);
    });

    // 플레이어 번들(한 줄짜리 IIFE)에 같은 글자가 있으면 JSON 과 같이 문서가 끊긴다.
    it("플레이어 스크립트와 스타일시트의 닫는 태그가 문서를 끊지 않는다", () => {
      const script = 'globalThis.seen = "</ScRiPt>"; globalThis.cmp = 1 < 2;';
      const css = 'body{content:"</STYLE><script>alert(1)"} i < b {}';
      const html = buildStandaloneHtml({ ...BASE, script, css });

      expect(html.match(/<\/script>/gi)).toHaveLength(3);
      expect(html.match(/<\/style>/gi)).toHaveLength(1);
      expect(html).not.toContain("</STYLE><script>");
      expect(html).toContain("<\\/ScRiPt>");
      expect(html).toContain("<\\/STYLE>");
      expect(html).toContain("1 < 2");
      expect(html).toContain("i < b {}");

      const afterApp = html.slice(html.indexOf('<div id="app"></div>'));
      const embedded = afterApp.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      const sandbox: { seen?: string; cmp?: boolean } = {};
      new Script(embedded ?? "").runInNewContext(sandbox);
      expect(sandbox.seen).toBe("</ScRiPt>");
      expect(sandbox.cmp).toBe(true);
    });

    it("제목의 태그 문자를 이스케이프한다", () => {
      // Given
      const title = "<img src=x onerror=alert(1)>";

      // When
      const html = buildStandaloneHtml({ ...BASE, title });

      // Then
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(html).not.toContain("<img src=x");
    });

    it("CSS 의 url() 을 data URL 로 바꾸고, 표에 없으면 한 번 더 구한다", async () => {
      // Given
      const inlineAssets: Record<string, string> = { "assets/a.png": "data:image/png;base64,AA==" };
      const css = `a{background:url(/assets/a.png)}b{src:url("/assets/fonts/f.woff2")}c{background:url(data:image/gif;base64,BB==)}`;
      const asked: string[] = [];

      // When
      const result = await inlineCssAssetUrls(css, inlineAssets, async (path) => {
        asked.push(path);
        return path === "assets/fonts/f.woff2" ? "data:font/woff2;base64,CC==" : null;
      });

      // Then
      expect(asked).toEqual(["assets/fonts/f.woff2"]);
      expect(result.css).toContain('url("data:image/png;base64,AA==")');
      expect(result.css).toContain('url("data:font/woff2;base64,CC==")');
      expect(result.css).toContain("url(data:image/gif;base64,BB==)"); // 이미 data URL 이면 그대로
      expect(result.missing).toEqual([]);
      expect(inlineAssets["assets/fonts/f.woff2"]).toBe("data:font/woff2;base64,CC==");
    });

    it("못 구한 url 은 원본을 남기고 목록으로 보고한다", async () => {
      // Given
      const css = "a{background:url(/assets/missing.png)}";

      // When
      const result = await inlineCssAssetUrls(css, {}, async () => null);

      // Then
      expect(result.css).toBe(css);
      expect(result.missing).toEqual(["assets/missing.png"]);
    });

    it("keeps local SVG filter fragments without requesting an asset", async () => {
      const css = 'a{filter:url(#battle-flash-tint)}b{filter:url("#battle-flash-tint")}';
      const asked: string[] = [];
      const result = await inlineCssAssetUrls(css, {}, async (path) => { asked.push(path); return null; });
      expect(asked).toEqual([]);
      expect(result).toEqual({ css, missing: [] });
    });

    it("경로 키를 한 가지로 맞춘다", () => {
      // Given
      const variants = ["/assets/a.png", "assets/a.png", "./assets/a.png", "assets/a.png?v=2"];

      // When
      const keys = new Set(variants.map(standaloneAssetKey));

      // Then
      expect([...keys]).toEqual(["assets/a.png"]);
    });

    it("파일명에 윈도우 금지문자를 남기지 않는다", () => {
      // Given
      const title = 'my:game/"제목"';

      // When
      const name = standaloneHtmlFileName(title);

      // Then
      expect(name.endsWith(".html")).toBe(true);
      expect(/[<>:"/\\|?*]/.test(name)).toBe(false);
      expect(standaloneHtmlFileName("   ")).toBe("oprn-game.html");
    });
  });
});

describe("startVariety", () => {
  isolateTimers();
  describe("planStart", () => {
    it("is deterministic for the same seed text and differs between texts", () => {
      expect(planStart({ seedText: "concept:a" })).toEqual(planStart({ seedText: "concept:a" }));
      const shapes = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(planStart({ seedText: `concept:${i}` }))));
      expect(shapes.size).toBeGreaterThan(40);
    });

    it("keeps route geometry inside the map and bends the road by at most 3 rows", () => {
      for (let i = 0; i < 200; i++) {
        const plan = planStart({ seedText: `x${i}` });
        expect(plan.routeW).toBeGreaterThanOrEqual(22);
        expect(plan.routeW).toBeLessThanOrEqual(34);
        expect(plan.routeH).toBeGreaterThanOrEqual(10);
        expect(plan.routeH).toBeLessThanOrEqual(16);
        expect(plan.entryY).toBeGreaterThanOrEqual(3);
        expect(plan.entryY).toBeLessThanOrEqual(plan.routeH - 4);
        expect(plan.endY).toBeGreaterThanOrEqual(3);
        expect(plan.endY).toBeLessThanOrEqual(plan.routeH - 4);
        expect(Math.abs(plan.endY - plan.entryY)).toBeLessThanOrEqual(3);
      }
    });

    it("only picks themes/forms/terrains the village builder accepts, and never defaults to plaza", () => {
      for (let i = 0; i < 300; i++) {
        const plan = planStart({ seedText: `y${i}`, stageText: i % 3 === 0 ? "눈 덮인 설원 마을" : i % 3 === 1 ? "사막 오아시스" : undefined });
        expect(START_FORMS_BY_THEME[plan.theme]).toContain(plan.form);
        expect(START_TERRAINS_BY_THEME[plan.theme]).toContain(plan.terrain);
        expect(plan.form).not.toBe("plaza");
      }
    });

    it("uses desert/snow/swamp only when the stage names them", () => {
      for (let i = 0; i < 100; i++) expect(["river", "coast"]).toContain(planStart({ seedText: `z${i}`, stageText: "방과 후 연금술 동아리" }).theme);
      expect(planStart({ seedText: "q", stageText: "설원 위의 항구" }).theme).toBe("snow");
    });

    it("prebuilds the beodeul town only when the concept has no other tileset", () => {
      expect(planStart({ seedText: "a" }).prebuildTown).toBe(true);
      expect(planStart({ seedText: "a", tilesetHint: "beodeul_city" }).prebuildTown).toBe(true);
      expect(planStart({ seedText: "a", tilesetHint: "jp_city" })).toMatchObject({ prebuildTown: false, tilesetId: "jp_city" });
    });

    it("reads the tileset line of a concept brief", () => {
      expect(briefTilesetHint("컨셉: x\n타일셋: jp_city (이 공용 번들 타일셋으로 맵을 깐다)\n주인공: y")).toBe("jp_city");
      expect(briefTilesetHint("컨셉: x")).toBeUndefined();
    });
  });
  describe("start prompt and kit maps", () => {
    it("never tells a kit concept to rebuild the start map with the beodeul tool", () => {
      for (const tilesetId of ["jp_city", "joseon_baram", "wizarding_world"]) {
        const text = startPlanPrompt(planStart({ seedText: "k", tilesetHint: tilesetId }));
        expect(text).toContain(tilesetId);
        expect(text).not.toContain("author_beodeul_town({");
      }
      expect(startPlanPrompt(planStart({ seedText: "k" }))).toContain("author_beodeul_town");
    });

    it("gives kit start maps room for a street and buildings", () => {
      for (const tilesetId of ["jp_city", "joseon_baram", "wizarding_world"]) {
        const size = startMapSizeFor(tilesetId, planStart({ seedText: "s", tilesetHint: tilesetId }))!;
        expect(size.width).toBeGreaterThanOrEqual(48);
        expect(size.height).toBeGreaterThanOrEqual(34);
      }
      expect(startMapSizeFor("beodeul_city", planStart({ seedText: "s" }))).toBeUndefined();
    });

    it("covers the entry cell, the end-event cell and bends between them", () => {
      const plan = planStart({ seedText: "p", tilesetHint: "joseon_baram" });
      const route = { width: plan.routeW, height: plan.routeH, entryY: plan.entryY, endY: plan.endY };
      const painted = new Set<string>();
      paintStartRoute((rect, _material, optional) => {
        if (optional) return;
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) painted.add(`${x},${y}`);
      }, routeStyleFor("joseon_baram")!, plan, route);
      expect(painted.has(`0,${route.entryY}`)).toBe(true);
      expect(painted.has(`${route.width - 2},${route.endY}`)).toBe(true);
    });
  });
});

describe("storageChest", () => {
  isolateTimers();
  describe("resolveStorageChest", () => {
    it("keeps unlimited capacity and center layout for legacy commands without template", () => {
      const resolved = resolveStorageChest({ chestId: "old_box" });
      expect(resolved.template).toBeUndefined();
      expect(resolved.capacity).toBeUndefined();
      expect(resolved.layout).toBe("center");
      expect(resolved.displayName).toBe("보관 상자");
      expect(resolved.showIcons).toBe(true);
    });

    it("fills farm / warehouse / vault template defaults", () => {
      expect(resolveStorageChest({ template: "farm" })).toMatchObject({
        displayName: "농장 상자",
        layout: "center",
        capacity: 24,
        allowBulk: true,
        goldVault: false,
      });
      expect(resolveStorageChest({ template: "warehouse" })).toMatchObject({
        displayName: "공동 창고",
        layout: "wide",
        capacity: 80,
        showCategories: true,
      });
      expect(resolveStorageChest({ template: "vault" })).toMatchObject({
        displayName: "금고",
        capacity: 16,
        allowBulk: false,
        goldVault: true,
      });
    });

    it("lets authored fields override the template", () => {
      const resolved = resolveStorageChest({
        template: "farm",
        displayName: "뒷마당",
        layout: "bottom",
        capacity: 4,
        allowedItemTypes: ["seed", "not-a-type"],
      });
      expect(resolved.displayName).toBe("뒷마당");
      expect(resolved.layout).toBe("bottom");
      expect(resolved.capacity).toBe(4);
      expect(resolved.allowedItemTypes).toEqual(["seed"]);
    });
  });
  describe("storage chest lock and gold", () => {
    it("locks on switch off or missing key item", () => {
      const session = startSession(createBlankProject());
      expect(storageChestLockState(session, resolveStorageChest({ lockSwitchId: "sw_key" })).locked).toBe(true);
      session.switches.sw_key = true;
      expect(storageChestLockState(session, resolveStorageChest({ lockSwitchId: "sw_key" })).locked).toBe(false);
      expect(storageChestLockState(session, resolveStorageChest({ lockItemId: "item_key" })).reason).toBe("열쇠가 필요합니다.");
      session.inventory.item_key = 1;
      expect(storageChestLockState(session, resolveStorageChest({ lockItemId: "item_key" })).locked).toBe(false);
    });

    it("moves gold into and out of the chest", () => {
      const session = startSession(createBlankProject());
      session.gold = 40;
      const chest = ensureChest(session, { id: "vault", mapId: "m1", x: 0, y: 0 });
      expect(transferChestGold(session, chest, "deposit", 15)).toBe(true);
      expect(session.gold).toBe(25);
      expect(chest.gold).toBe(15);
      expect(transferChestGold(session, chest, "withdraw", 5)).toBe(true);
      expect(session.gold).toBe(30);
      expect(chest.gold).toBe(10);
      expect(transferChestGold(session, chest, "withdraw", 99)).toBe(false);
    });
  });
  describe("storage chest capacity and types", () => {
    it("counts distinct stacks and rejects a new stack when full", () => {
      expect(chestAcceptsNewStack({ a: 1, b: 2 }, "c", 2)).toBe(false);
      expect(chestAcceptsNewStack({ a: 1, b: 2 }, "a", 2)).toBe(true);
      expect(chestAcceptsNewStack({ a: 1 }, "c", undefined)).toBe(true);
    });

    it("depositToChest honors capacity and allowedItemTypes", () => {
      const session = startSession(createBlankProject());
      session.inventory = { herb: 2, ore: 2 };
      ensureChest(session, { id: "box", mapId: "m1", x: 1, y: 1 });
      expect(depositToChest(session, "box", "herb", 1, { capacity: 1, allowedItemTypes: ["medicine"], itemType: "medicine" })).toBe(true);
      expect(depositToChest(session, "box", "ore", 1, { capacity: 1, allowedItemTypes: ["medicine"], itemType: "normalGoods" })).toBe(false);
      expect(depositToChest(session, "box", "ore", 1, { capacity: 1, itemType: "normalGoods" })).toBe(false);
    });

    it("maps item types onto category tabs", () => {
      expect(storageChestTabOf("medicine")).toBe("medicine");
      expect(storageChestTabOf("weapon")).toBe("gear");
      expect(storageChestTabOf("switch")).toBe("key");
      expect(storageChestTabOf("seed")).toBe("material");
    });
  });
});

describe("terrainLandingRecovery", () => {
  isolateTimers();
  describe('runtime terrain landing recovery', () => {
    const fixture = () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const tileset = project.tilesets[map.tilesetId]!;
      const floor = Object.entries(tileset.passability).find(([, p]) => p.up && p.down && p.left && p.right)?.[0];
      const wall = Object.entries(tileset.passability).find(([, p]) => !p.up && !p.down && !p.left && !p.right)?.[0];
      if (floor === undefined || wall === undefined) throw Error('Fixture needs floor and wall tiles');
      for (let i = 0; i < map.width * map.height; i++) {
        setLayerTileAt(map, 1, i, Number(floor));
        setLayerTileAt(map, 3, i, -1);
      }
      const session = startSession(project);
      session.x = 5; session.y = 5;
      return { project, map, session, wall: Number(wall) };
    };
    it('moves off a saved runtime wall without undoing the device tile', () => {
      const { project, map, session, wall } = fixture();
      setMapTileOverride(session, map.id, 'upper', 5 * map.width + 5, wall);
      expect(recoverPlayerFromTerrain(project, session)).toEqual({ x: 5, y: 6 });
      expect(session.mapOverrides[map.id]!.upper[5 * map.width + 5]).toBe(wall);
    });
    it('preserves valid floors and authored impassable placement', () => {
      const { project, map, session, wall } = fixture();
      setMapTileOverride(session, map.id, 'upper', 0, wall);
      expect(recoverPlayerFromTerrain(project, session)).toBeUndefined();
      setLayerTileAt(map, 3, 5 * map.width + 5, wall);
      expect(recoverPlayerFromTerrain(project, session)).toBeUndefined();
      expect([session.x, session.y]).toEqual([5, 5]);
    });
  });
});

describe("terrainStep", () => {
  isolateTimers();
  function sessionWithParty(project: ReturnType<typeof createBlankProject>): PlaySessionLike {
    const actorId = project.database.actors[0]?.id;
    if (!actorId) throw new Error("missing default actor");
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [actorId],
      actorVitals: {},
      currentMapId: project.startMapId,
      x: 0,
      y: 0,
    };
  }
  describe("scaledEncounterRate", () => {
    it("multiplies map rate by terrain percent", () => {
      expect(scaledEncounterRate(1000, 50)).toBe(500);
      expect(scaledEncounterRate(1000, undefined)).toBe(1000);
      expect(scaledEncounterRate(1000, 0)).toBe(0);
      expect(scaledEncounterRate(0, 100)).toBe(0);
    });
  });
  describe("applyTerrainWalkDamage", () => {
    it("reduces party hp by terrain damage", () => {
      const project = createBlankProject();
      const session = sessionWithParty(project);
      const result = applyTerrainWalkDamage(project, session, 5);
      expect(result.applied).toBe(5);
      const actorId = session.partyActorIds[0] as string;
      const vitals = session.actorVitals[actorId];
      expect(vitals).toBeDefined();
      expect(vitals?.hp).toBe((vitals?.maxHp ?? 0) - 5);
      expect(result.defeated).toBe(false);
    });

    it("reports defeat when damage wipes the party", () => {
      const project = createBlankProject();
      const session = sessionWithParty(project);
      const result = applyTerrainWalkDamage(project, session, 99999);
      expect(result.defeated).toBe(true);
      const actorId = session.partyActorIds[0] as string;
      expect(session.actorVitals[actorId]?.hp).toBe(0);
    });

    it("ignores zero damage", () => {
      const project = createBlankProject();
      const session = sessionWithParty(project);
      const result = applyTerrainWalkDamage(project, session, 0);
      expect(result.applied).toBe(0);
      expect(result.defeated).toBe(false);
    });
  });
});

describe("npcPathfinding8", () => {
  isolateTimers();
  const original = store.getCurrent;
  afterEach(() => { store.getCurrent = original; });
  const living = (x: number, y: number) => ({ movement: { type: 'living', speed: 8, frequency: 8, living: { destinations: [{ mapId: 'm', x, y }], repeat: false } } });
  function corridor(pocket: number | null, three = false, reverse = false) {
   const events = [event('a',3,1,living(8,1)), event('b',4,1,living(0,1))];
   if (three) events.push(event('c',5,1,living(1,1)));
   if (reverse) events.reverse();
   const f = fixture(9,3,events,-10,-10);
   f.map.lowerTiles.fill(1);
   for(let x=0;x<9;x++) f.map.lowerTiles[9+x]=0;
   if(pocket!==null) f.map.lowerTiles[pocket]=0;
   // Rebuild routes after the terrain fixture changes.
   f.scene.autonomousNPCs.clear(); f.scene.pageMoveRouteKeys.clear(); f.scene.pageMoveRouteEventIds.clear();
   registerPageMoveRoutes(f.scene);
   return f;
  }
  function run(s:any, n=500) {for(let i=0;i<n;i++){ticks(s,1);registerPageMoveRoutes(s);}}
  it.each([false,true])('backs up several steps into a pocket; reverse=%s', reverse => {
   const f=corridor(1,false,reverse); run(f.scene);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1}); expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});
  });
  it.each([false,true])('resolves three-person chain at its free end; reverse=%s', reverse => {
   const f=corridor(2,true,reverse); run(f.scene,900);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1}); expect(pos(f.scene,'b')).toMatchObject({x:0,y:1}); expect(pos(f.scene,'c')).toMatchObject({x:1,y:1});
  });
  it('impossible corridor stays still rather than oscillating',()=>{
   const f=corridor(null,true);run(f.scene,60);const before=JSON.stringify(f.scene.eventPositions);run(f.scene,400);expect(JSON.stringify(f.scene.eventPositions)).toBe(before);
  });
  it('fixed blocker is bypassed when a detour exists and waits otherwise',()=>{
   for(const detour of [false,true]){
    const f=fixture(7,3,[event('a',0,1,living(6,1)),event('fixed',3,1,{movement:{type:'fixed'}})],-10,-10);
    if(!detour){for(let x=0;x<7;x++){f.map.lowerTiles[x]=1;f.map.lowerTiles[14+x]=1;}}
    run(f.scene);expect(pos(f.scene,'a').x).toBe(detour?6:2);expect(pos(f.scene,'fixed').x).toBe(3);
   }
  });
  it.each([false,true])('pathfind=false escapes a wall without an immediate reverse step; mirrored=%s', mirrored=>{
   const f=fixture(7,7,[],5,3);for(let y=1;y<=5;y++)f.map.lowerTiles[y*7+3]=1;
   const target={x:mirrored?1:5,y:3};
   let from={x:mirrored?4:2,y:3};const mover={timer:0,moveIntervalMs:80};const trail=[from];let touched=false;
   for(let i=0;i<60;i++) {const d=nextChaseDecision({...f,from,player:target,mover,deltaMs:80,pathfind:false});if(d.kind==='touch'){touched=true;break;}if(d.kind==='move'){from={x:d.x,y:d.y};trail.push(from);}}
   for(let i=2;i<trail.length;i++)expect(trail[i]).not.toEqual(trail[i-2]);
   expect(touched).toBe(true);
  });
  it('caps a single unreachable A* to 2048 node expansions',()=>{
   const f=fixture(100,100,[],50,50);let queries=0;
   const path=findChasePath(f.project,f.map,{x:0,y:0},{x:50,y:50},{footprint:{width:1,height:1},passRows:1,blocked:(x,y)=>{queries++;return Math.abs(x-50)+Math.abs(y-50)===1;}},undefined,CHASE_MAX_EXPANSIONS);
   expect(path).toEqual([]);expect(queries).toBeLessThanOrEqual(2048*4);
   console.log('bounded A* passage queries',queries);
  });
  it('uncapped callers (schedules, coordinate moves, doors) still find long detours past 2048 expansions',()=>{
   // 100x100 serpentine: walls on every other row leave one gap, alternating ends — the path is ~5000 cells.
   const f=fixture(100,100,[],99,99);
   const blocked=(x:number,y:number)=>y%2===1&&(Math.floor(y/2)%2===0?x!==99:x!==0);
   const pass={footprint:{width:1,height:1},passRows:1,blocked};
   const path=findChasePath(f.project,f.map,{x:0,y:0},{x:99,y:98},pass);
   expect(path.length).toBeGreaterThan(2048);
   expect(path.at(-1)).toEqual({x:99,y:98});
   expect(findChasePath(f.project,f.map,{x:0,y:0},{x:99,y:98},pass,undefined,CHASE_MAX_EXPANSIONS)).toEqual([]);
  });
  it('the trailing end yields first when only that end has spare space',()=>{
   const f=corridor(6,true);f.map.lowerTiles[7]=0;run(f.scene,1200);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1});expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});expect(pos(f.scene,'c')).toMatchObject({x:1,y:1});
  });
  // Oracle captured from ef5375b2fa, seed 928, LCG 1664525/1013904223; 70/80 targets reachable.
  it('keeps legacy A* bytes on 80 deterministic small maps', async()=>{
   const {default:cases}=await import('./fixtures/npcChasePathfinding8Oracle.json');
   for(const sample of cases){const f=fixture(12,12,[],11,11);f.map.lowerTiles=sample.tiles;expect(JSON.stringify(findChasePath(f.project,f.map,{x:0,y:0},{x:11,y:11}))).toBe(JSON.stringify(sample.path));}
  });
  it('does not park on a peer destination even when that side pocket is nearer',()=>{
   const f=corridor(1);f.map.lowerTiles[2]=0;
   f.map.events.find((e:any)=>e.id==='b').pages[0].movement=living(2,0).movement;
   registerPageMoveRoutes(f.scene);run(f.scene,700);
   expect(pos(f.scene,'a')).toMatchObject({x:8,y:1});expect(pos(f.scene,'b')).toMatchObject({x:2,y:0});
  });
  it('backs up a wide body into a full-width pocket, never the narrow opening',()=>{
   const body={footprint:{width:2,height:1},passRows:1};
   const f=fixture(11,3,[event('a',4,1,{...living(9,1),...body}),event('b',6,1,{...living(0,1),...body})],-10,-10);
   f.map.lowerTiles.fill(1);for(let x=0;x<11;x++)f.map.lowerTiles[11+x]=0;for(const x of [2,3,4])f.map.lowerTiles[x]=0;
   f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
   run(f.scene,700);expect(pos(f.scene,'a')).toMatchObject({x:9,y:1});expect(pos(f.scene,'b')).toMatchObject({x:0,y:1});
  });
  it('capped chase A* widens its cap on following frames and still reaches a 198-cell detour',()=>{
   // Adversarial review repro: a 100x100 wall with one gap at the far end. The first capped search fails;
   // before the fix every 500ms retry repeated the same 2048 cap and the chaser waited forever.
   const f=fixture(100,100,[],51,1);for(let y=0;y<99;y++)f.map.lowerTiles[y*100+50]=1;
   const player={x:51,y:1};let from={x:49,y:1};const mover:any={timer:0,moveIntervalMs:80};let touched=false;let searchesFrame1=0;
   for(let i=0;i<600&&!touched;i++){const d=nextChaseDecision({...f,from,player,mover,deltaMs:80});if(i===0)searchesFrame1=mover.chaseExpansionCap??0;if(d.kind==='touch')touched=true;else if(d.kind==='move')from={x:d.x,y:d.y};}
   expect(searchesFrame1).toBe(CHASE_MAX_EXPANSIONS*2);
   expect(touched).toBe(true);
  });
  it('pathfind=false keeps touching an adjacent stationary target',()=>{
   const f=fixture(5,3,[],2,1);const mover={timer:0,moveIntervalMs:80};const kinds:string[]=[];
   for(let i=0;i<8;i++)kinds.push(nextChaseDecision({...f,from:{x:1,y:1},player:{x:2,y:1},mover,deltaMs:500,pathfind:false}).kind);
   expect(kinds).toEqual(Array(8).fill('touch'));
  });
  it('a yielder resumes once a detour opens even when the peer parks on its original cell',()=>{
   // Adversarial review repro: width-2 bodies, b's destination is a's original cell.
   const body={footprint:{width:2,height:1},passRows:1};
   const f=fixture(11,3,[event('a',4,1,{...living(9,1),...body}),event('b',6,1,{...living(4,1),...body})],-10,-10);
   f.map.lowerTiles.fill(1);for(let x=0;x<11;x++)f.map.lowerTiles[11+x]=0;for(const x of [2,3,4,5])f.map.lowerTiles[x]=0;
   f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
   for(let i=0;i<1000;i++){if(i===200){for(let x=6;x<11;x++)f.map.lowerTiles[x]=0;invalidateTilePassabilityComponents(f.map);}ticks(f.scene,1);registerPageMoveRoutes(f.scene);}
   expect(pos(f.scene,'a')).toMatchObject({x:9,y:1});expect(pos(f.scene,'b')).toMatchObject({x:4,y:1});
  });
  it.each([32,33])('a %i-NPC head-on line still resolves (group cap falls back to the pair)',n=>{
   const start=n+1,w=2*n+5,events=[event('a',start,1,living(w-1,1))];for(let k=1;k<n;k++)events.push(event('e'+k,start+k,1,living(k-1,1)));
   const f=fixture(w,3,events,-10,-10);f.map.lowerTiles.fill(1);for(let x=0;x<w;x++)f.map.lowerTiles[w+x]=0;f.map.lowerTiles[start]=0;
   f.scene.autonomousNPCs.clear();f.scene.pageMoveRouteKeys.clear();f.scene.pageMoveRouteEventIds.clear();registerPageMoveRoutes(f.scene);
   for(let i=0;i<3500;i++){ticks(f.scene,1);registerPageMoveRoutes(f.scene);}
   const reached=events.filter(e=>{const p=pos(f.scene,e.id),d=(e.pages[0] as any).movement.living.destinations[0];return p.x===d.x&&p.y===d.y}).length;
   expect(reached).toBe(n);
  },120_000);
});

describe("tilesetKind", () => {
  isolateTimers();
  function tileset(overrides: Partial<TilesetDef> = {}): TilesetDef {
    const count = overrides.count ?? 480;
    return {
      id: "legacy_tileset",
      name: "Legacy tileset",
      image: { type: "bundled", id: "legacy_sheet" },
      tileSize: 16,
      tilesPerRow: 30,
      count,
      passability: Array.from({ length: count }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: count }, () => "lower" as const),
      terrain: Array.from({ length: count }, () => 0),
      ...overrides,
    };
  }
  describe("tilesetKind legacy inference", () => {
    it("keeps a kind-less bundled 480-chip sheet RPG2K-compatible", () => {
      expect(tilesetKind(tileset())).toBe("rpg2k");
    });

    it("infers a kind-less uploaded atlas as custom", () => {
      expect(tilesetKind(tileset({ image: { type: "uploaded", id: "upload_legacy" } }))).toBe("custom");
    });

    it("infers a kind-less non-480 bundled atlas as custom", () => {
      expect(tilesetKind(tileset({ count: 256 }))).toBe("custom");
    });
  });
});

describe("mgL7sysTitleVariants", () => {
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
  function titleProject(): Project {
    const project = createBlankProject();
    const title = project.system.titleScreen!;
    title.backgroundResourceId = "bg_default";
    title.musicResourceId = "bgm_default";
    title.variants = [
      { when: { kind: "endingSeen", endingId: "ending_true" }, backgroundResourceId: "bg_true", musicResourceId: "bgm_true" },
      { when: { kind: "clearCount", atLeast: 2 }, backgroundResourceId: "bg_two" },
      { when: { kind: "saveMapId", mapId: "map_castle" }, musicResourceId: "bgm_castle" },
    ];
    return project;
  }
  function snapshotAt(project: Project, mapId: string, savedAt: string): SaveSnapshot {
    const session = startSession(project, 1);
    session.currentMapId = mapId;
    return { ...createSaveSnapshot(project, session), savedAt };
  }
  describe("title variants and resume on launch (#17)", () => {
    it("picks the first matching variant by ending, clear count and last save map", () => {
      const title = titleProject().system.titleScreen!;
      expect(resolveTitleVariant(title, {})).toBeUndefined();
      expect(applyTitleVariant(title, { endingIds: ["ending_true"] }).backgroundResourceId).toBe("bg_true");
      const two = applyTitleVariant(title, { endingIds: ["ending_a", "ending_b"] });
      expect(two.backgroundResourceId).toBe("bg_two");
      // 변형이 음악을 비워 두면 기본 음악 그대로.
      expect(two.musicResourceId).toBe("bgm_default");
      const castle = applyTitleVariant(title, { lastSaveMapId: "map_castle" });
      expect(castle.backgroundResourceId).toBe("bg_default");
      expect(castle.musicResourceId).toBe("bgm_castle");
      // 순서가 우선순위다 — 참 엔딩이 성 저장보다 앞선다.
      expect(applyTitleVariant(title, { endingIds: ["ending_true"], lastSaveMapId: "map_castle" }).musicResourceId).toBe("bgm_true");
    });

    it("reads the ending ids that recordEndingClear writes", () => {
      const project = titleProject();
      const storage = new MemoryStorage();
      recordEndingClear(storage, project, startSession(project, 1), "ending_true");
      const endingIds = readClearRecord(storage)?.endingIds ?? [];
      expect(applyTitleVariant(project.system.titleScreen!, { endingIds }).backgroundResourceId).toBe("bg_true");
    });

    it("readLatestSave returns the newest of the manual slots and the autosave", () => {
      const project = titleProject();
      const storage = new MemoryStorage();
      expect(readLatestSave(storage)).toBeUndefined();
      saveToSlot(storage, 1, snapshotAt(project, project.startMapId, "2026-01-01T00:00:00.000Z"));
      writeAutosave(storage, snapshotAt(project, project.startMapId, "2026-03-01T00:00:00.000Z"));
      saveToSlot(storage, 2, snapshotAt(project, project.startMapId, "2026-02-01T00:00:00.000Z"));
      expect(readLatestSave(storage)?.source).toBe("autosave");
      saveToSlot(storage, 3, snapshotAt(project, project.startMapId, "2026-04-01T00:00:00.000Z"));
      const latest = readLatestSave(storage);
      expect(latest?.source === "slot" ? latest.slot : undefined).toBe(3);
    });

    it("resume on launch targets the newest save only when the option is on", () => {
      const project = titleProject();
      const storage = new MemoryStorage();
      saveToSlot(storage, 2, snapshotAt(project, project.startMapId, "2026-02-01T00:00:00.000Z"));
      expect(latestResumableSave(project, storage)).toBeUndefined();
      project.system.titleScreen!.resumeOnLaunch = true;
      const latest = latestResumableSave(project, storage);
      expect(latest?.source === "slot" ? latest.slot : undefined).toBe(2);
      expect(latestResumableSave(project, new MemoryStorage())).toBeUndefined();
    });

    it("keeps variants and resumeOnLaunch through serialize/deserialize and drops invalid rows", () => {
      // 로드 검증은 리소스 id 가 실재하는지 본다 — 기본 프로젝트가 가진 타이틀 배경·음악 id 를 변형에 쓴다.
      const project = createBlankProject();
      const title = project.system.titleScreen!;
      const background = title.backgroundResourceId ?? project.system.titleResourceId;
      const music = title.musicResourceId;
      title.variants = [
        { when: { kind: "clearCount", atLeast: 1 }, ...(background ? { backgroundResourceId: background } : {}), ...(music ? { musicResourceId: music } : {}) },
        { when: { kind: "saveMapId", mapId: project.startMapId } },
      ];
      title.resumeOnLaunch = true;
      const reloaded = deserialize(serialize(project)).system.titleScreen as TitleScreenSettings;
      expect(reloaded.variants).toEqual(project.system.titleScreen!.variants);
      expect(reloaded.resumeOnLaunch).toBe(true);
      const legacy = deserialize(serialize(createBlankProject())).system.titleScreen!;
      expect(legacy.variants).toBeUndefined();
      expect(legacy.resumeOnLaunch).toBeUndefined();
      const broken = createBlankProject();
      broken.system.titleScreen!.variants = [{ when: { kind: "clearCount", atLeast: 1 }, backgroundResourceId: "missing_bg" }];
      expect(() => deserialize(serialize(broken))).toThrow(/variants\[0\]\.backgroundResourceId/);
      expect(normalizeTitleScreenVariants([
        { when: { kind: "endingSeen", endingId: " " } },
        { when: { kind: "nope" } },
        { when: { kind: "clearCount", atLeast: 0 }, backgroundResourceId: " bg " },
      ])).toEqual([{ when: { kind: "clearCount", atLeast: 1 }, backgroundResourceId: "bg" }]);
    });
  });
});

describe("readLoadingInfo", () => {
  isolateTimers();
  const base = "https://games.example/play/project.json";
  function uploaded(id: string, extension: string): UploadedAsset {
    return {
      id,
      name: id,
      kind: "picture",
      meta: { width: 1, height: 1 },
      ref: { sha256: "a".repeat(64), mime: "image/webp", bytes: 3, extension },
    };
  }
  function stubLoading(body: unknown, ok = true): void {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 404 })));
  }
  afterEach(() => { vi.unstubAllGlobals(); });
  describe("readLoadingInfo", () => {
    it("keeps an exported cover whose file name is not ASCII", async () => {
      const cover = webUploadedAssetPath(uploaded("회중 시계/그림", "webp"));
      const titled = webUploadedAssetPath(uploaded("hero's portrait", "png"));
      stubLoading({ title: "회중 시계", cover, projectBytes: 12 });

      const info = await readLoadingInfo(base);

      expect(cover).toBe("assets/uploaded/회중-시계-그림.webp");
      expect(info.title).toBe("회중 시계");
      expect(info.projectBytes).toBe(12);
      expect(info.cover).toBe(new URL(cover, base).href);
      expect(info.cover).toContain("%ED%9A%8C%EC%A4%91");

      stubLoading({ title: "Portrait", cover: titled });
      expect((await readLoadingInfo(base)).cover).toBe(new URL(titled, base).href);
    });

    it("keeps an audio alias whose packaged name is not ASCII", async () => {
      const from = "assets/uploaded/효과음.wav";
      const to = "assets/uploaded/효과음.web.mp3";
      stubLoading({ aliases: { [from]: to, "assets/ok.wav": "assets/ok.mp3" } });

      expect((await readLoadingInfo(base)).aliases).toEqual({ [from]: to, "assets/ok.wav": "assets/ok.mp3" });
    });

    it("drops a cover or alias that leaves the package and still reads the title", async () => {
      stubLoading({
        title: "Still named",
        cover: "../secret.png",
        aliases: {
          "assets/real.wav": "assets/%2e%2e/secret.mp3",
          "https://evil.example/a.wav": "assets/a.mp3",
          "assets/a#b.wav": "assets/a.mp3",
          "assets/ok.wav": "assets/ok.mp3",
        },
      });

      const info = await readLoadingInfo(base);
      expect(info.title).toBe("Still named");
      expect(info.cover).toBeUndefined();
      expect(info.aliases).toEqual({ "assets/ok.wav": "assets/ok.mp3" });
    });
  });
});
