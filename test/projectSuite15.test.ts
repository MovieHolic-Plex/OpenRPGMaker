import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession, setMapTileOverride } from "@/project/session";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { collectLifeRecoveryClaim, isLifeRecoveryJson, moveLifeRecoverySource, reconcileLifeState, LifeReconciliationError } from "@/project/lifeRecovery";
import { placeFarmBuilding, placeHomeDecoration, removeFarmBuilding, removeHomeDecoration } from "@/project/spatialPlacementTransactions";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { buildStandaloneHtml, inlineCssAssetUrls, standaloneAssetKey, standaloneHtmlFileName, STANDALONE_ASSETS_NODE_ID, STANDALONE_PROJECT_NODE_ID } from "@/project/standaloneHtml";
import { Script } from "node:vm";
import { runTool } from "@/editor/tools";
import { craftRecipe, canCraft } from "@/project/craftRecipes";
import { normalizeItemRecord, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { ensureChest, depositToChest, withdrawFromChest, placeObject, removeObjectAt, findChestAt, inventoryEntries } from "@/project/placeables";
import { hasFarmToolAvailable, setEquippedTool, toolActionRulesOf } from "@/project/toolActions";
import { applyItemUpgrade, resolveSellPrice } from "@/project/upgrades";
import { interactWithFarmPlot } from "@/player/farming";
import { briefTilesetHint, planStart, START_FORMS_BY_THEME, START_TERRAINS_BY_THEME, startPlanPrompt } from "@/project/startVariety";
import { paintStartRoute, routeStyleFor, startMapSizeFor } from "@/project/startRoutePaint";
import { chestAcceptsNewStack, resolveStorageChest, storageChestLockState, storageChestTabOf, transferChestGold } from "@/project/storageChest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyProjectFontTheme } from "@/app/fontTheme";
import { DEFAULT_FONT_SELECTION, FONT_REGISTRY, fontOptionsForRole, isFontFamilyId, projectFontStack, resolveFontSelection, resolveFontStack } from "@/project/fontRegistry";
import { installFakeDom } from "./fakeDom";
import { recoverPlayerFromTerrain } from "@/project/terrainLandingRecovery";
import { setLayerTileAt } from "@/project/mapLayers";
import { terrainRecordAt } from "@/project/terrainAt";
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

describe("stardewAuthoringTools", () => {
  isolateTimers();
  describe("P1 tool action table", () => {
    it("defaults to legacy hoe/can rules when system.toolActions absent", () => {
      const project = createBlankProject();
      const rules = toolActionRulesOf(project);
      expect(rules.some((r) => r.farmTool === "hoe" && r.action === "till")).toBe(true);
      expect(rules.some((r) => r.farmTool === "wateringCan" && r.action === "water")).toBe(true);
    });

    it("respects authored toolActions override", () => {
      const project = createBlankProject();
      project.system.toolActions = [
        { id: "custom-hoe", farmTool: "hoe", requiresFarmable: true, action: "till" },
      ];
      expect(toolActionRulesOf(project)).toHaveLength(1);
    });
  });
  describe("P2 equipped tool hand", () => {
    it("prefers equipped tool when present in inventory", () => {
      const project = createBlankProject();
      const session = startSession(project);
      session.inventory = { item_hoe: 1, item_watering_can: 1 };
      setEquippedTool(session, "item_hoe");
      expect(hasFarmToolAvailable(project, session, "hoe")).toBe(true);
      setEquippedTool(session, undefined);
      // empty hand falls back to any inventory hoe
      expect(hasFarmToolAvailable(project, session, "hoe")).toBe(true);
    });
  });
  describe("P3 craft recipes", () => {
    it("crafts when ingredients and optional gold present", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 }),
        normalizeItemRecord({ id: "item_fence", name: "울타리", scope: "none", price: 5 })
      );
      project.system.craftRecipes = [
        {
          id: "craft_fence",
          ingredients: [{ itemId: "item_wood", count: 2 }],
          outputItemId: "item_fence",
          outputCount: 1,
          goldCost: 10,
        },
      ];
      const session = startSession(project);
      session.gold = 100;
      session.inventory = { item_wood: 5 };
      expect(canCraft(project, session, "craft_fence").ok).toBe(true);
      const result = craftRecipe(project, session, "craft_fence");
      expect(result).toMatchObject({ ok: true, outputItemId: "item_fence" });
      expect(session.inventory.item_wood).toBe(3);
      expect(session.inventory.item_fence).toBe(1);
      expect(session.gold).toBe(90);
    });

    it("returns disabled when no recipes authored", () => {
      const project = createBlankProject();
      const session = startSession(project);
      expect(craftRecipe(project, session, "x")).toMatchObject({ ok: false, reason: "disabled" });
    });
  });
  describe("P4 chests and placeables", () => {
    it("deposits and withdraws chest items", () => {
      const session = startSession(createBlankProject());
      session.inventory = { item_a: 3 };
      ensureChest(session, { id: "chest_1", mapId: "m1", x: 1, y: 2 });
      expect(depositToChest(session, "chest_1", "item_a", 2)).toBe(true);
      expect(session.inventory.item_a).toBe(1);
      expect(session.chests?.chest_1.inventory.item_a).toBe(2);
      expect(withdrawFromChest(session, "chest_1", "item_a", 1)).toBe(true);
      expect(session.inventory.item_a).toBe(2);
    });

    it("places and removes objects at tile keys", () => {
      const session = startSession(createBlankProject());
      placeObject(session, { id: "obj1", mapId: "m1", x: 3, y: 4, kind: "chest", itemId: "item_chest" });
      expect(removeObjectAt(session, "m1", 3, 4)?.kind).toBe("chest");
      expect(removeObjectAt(session, "m1", 3, 4)).toBeUndefined();
    });
  });
  describe("P5 make_villager friendship wizard", () => {
    it("writes characterId, optional talkFriendship, and unlock pages", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps[ctx.project.startMapId];
      // ensure passable home
      const result = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_wizard_npc",
        name: "마을 주민",
        home: { x: 1, y: 1 },
        dialogue: [{ text: "안녕" }],
        talkFriendship: true,
        friendshipUnlock: 80,
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[map.id].events.find((e) => e.id === "ev_wizard_npc");
      expect(event?.characterId).toBeTruthy();
      expect(event?.talkFriendship).toBe(true);
      const kinds = (event?.pages ?? []).flatMap((p) => p.conditions.map((c) => c.kind));
      expect(kinds).toContain("friendshipAtLeast");
      expect(kinds).toContain("selfSwitch");
    });

    it("같은 characterId 재요청은 새 id를 받아도 기존 주민을 재사용하고 대사를 보존한다", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps[ctx.project.startMapId];
      const first = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_hana_guide",
        characterId: "hana_guide",
        name: "안내인 하나",
        home: { x: 2, y: 2 },
        dialogue: [{ text: "광장은 동쪽이에요." }],
      });
      expect(first.ok, first.summary).toBe(true);

      // Regression: explicit new id disabled nearby merging and allocateCharacterId
      // produced hana_guide_2, leaving two bodies for one authored character.
      const second = runTool(ctx, "make_villager", {
        mapId: map.id,
        id: "ev_hana_schedule_copy",
        characterId: "hana_guide",
        name: "안내인 하나",
        home: { x: 8, y: 8 },
        schedule: [
          { when: { hourRange: [8, 20] }, at: { mapId: map.id, x: 4, y: 2 }, activity: "guide" },
        ],
      });

      expect(second.ok, second.summary).toBe(true);
      expect(second.data).toMatchObject({ eventId: "ev_hana_guide", characterId: "hana_guide", reused: true });
      const updatedMap = ctx.project.maps[map.id];
      expect(updatedMap.events.filter((event) => event.characterId === "hana_guide")).toHaveLength(1);
      const hana = updatedMap.events.find((event) => event.id === "ev_hana_guide");
      expect(hana).toMatchObject({ x: 2, y: 2 });
      expect(JSON.stringify(hana?.pages)).toContain("광장은 동쪽이에요.");
      expect(hana?.schedule).toHaveLength(1);
    });
  });
  describe("P6 upgrades and sell prices", () => {
    it("applies upgrade and rewrites equipped tool", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_hoe", name: "괭이", scope: "none", price: 50, farmTool: "hoe" }),
        normalizeItemRecord({ id: "item_hoe_iron", name: "철 괭이", scope: "none", price: 200, farmTool: "hoe" })
      );
      project.system.itemUpgrades = [
        { id: "up_hoe", fromItemId: "item_hoe", toItemId: "item_hoe_iron", goldCost: 50 },
      ];
      const session = startSession(project);
      session.gold = 100;
      session.inventory = { item_hoe: 1 };
      setEquippedTool(session, "item_hoe");
      const result = applyItemUpgrade(project, session, "up_hoe");
      expect(result).toMatchObject({ ok: true, toItemId: "item_hoe_iron" });
      expect(session.inventory.item_hoe).toBeUndefined();
      expect(session.inventory.item_hoe_iron).toBe(1);
      expect(session.equippedToolItemId).toBe("item_hoe_iron");
      expect(session.gold).toBe(50);
    });

    it("resolves sell price from table or half item price", () => {
      const project = createBlankProject();
      // 기본 CC0 카탈로그에 item_potato 가 이미 있다. push 하면 items.find() 가 카탈로그의
      // 낡은 레코드를 먼저 집어 가격이 40 이 아닌 20 으로 읽힌다 — 반드시 upsert 해야 한다.
      const potato = normalizeItemRecord({ id: "item_potato", name: "감자", scope: "none", price: 40 });
      const existing = project.database.items.findIndex((item) => item.id === potato.id);
      if (existing >= 0) project.database.items[existing] = potato;
      else project.database.items.push(potato);
      project.system.sellPrices = [{ itemId: "item_potato", price: 30 }];
      expect(resolveSellPrice(project, "item_potato")).toBe(30);
      project.system.sellPrices = [];
      expect(resolveSellPrice(project, "item_potato")).toBe(20);
    });
  });
  describe("P1 placeable chop via toolActions", () => {
    it("chops tree placeable with axe equipped", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_axe", name: "도끼", scope: "none", price: 10, farmTool: "axe" as const }),
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 2 })
      );
      const session = startSession(project);
      session.inventory = { item_axe: 1 };
      setEquippedTool(session, "item_axe");
      const map = project.maps[project.startMapId];
      placeObject(session, { id: "t1", mapId: map.id, x: 2, y: 2, kind: "tree", itemId: "item_wood" });
      const result = interactWithFarmPlot(project, session, map, 2, 2);
      expect(result.kind).toBe("harvested");
      expect(session.inventory.item_wood).toBe(1);
      expect(session.placeables?.[map.id+":2,2"]).toBeUndefined();
    });
  });
  describe("craft/upgrade/equip commands via pure APIs (interpreter surface)", () => {
    it("equipTool helper sets hand; craft and upgrade still work", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 }),
        normalizeItemRecord({ id: "item_fence", name: "울타리", scope: "none", price: 5 }),
        normalizeItemRecord({ id: "item_hoe", name: "괭이", scope: "none", price: 50, farmTool: "hoe" }),
        normalizeItemRecord({ id: "item_hoe_iron", name: "철 괭이", scope: "none", price: 200, farmTool: "hoe" })
      );
      project.system.craftRecipes = [{ id: "craft_fence", ingredients: [{ itemId: "item_wood", count: 1 }], outputItemId: "item_fence" }];
      project.system.itemUpgrades = [{ id: "up_hoe", fromItemId: "item_hoe", toItemId: "item_hoe_iron", goldCost: 0 }];
      const session = startSession(project);
      session.inventory = { item_wood: 2, item_hoe: 1 };
      setEquippedTool(session, "item_hoe");
      expect(session.equippedToolItemId).toBe("item_hoe");
      expect(craftRecipe(project, session, "craft_fence").ok).toBe(true);
      expect(applyItemUpgrade(project, session, "up_hoe").ok).toBe(true);
      expect(session.equippedToolItemId).toBe("item_hoe_iron");
    });
  });
  describe("P4 chest play surface helpers", () => {
    it("finds chest by map tile and lists inventories", () => {
      const project = createBlankProject();
      project.database.items.push(
        normalizeItemRecord({ id: "item_wood", name: "나무", scope: "none", price: 1 })
      );
      const session = startSession(project);
      session.inventory = { item_wood: 3 };
      const mapId = project.startMapId;
      const chest = ensureChest(session, { id: "chest_farm_3_4", mapId, x: 3, y: 4 });
      expect(findChestAt(session, mapId, 3, 4)?.id).toBe(chest.id);
      expect(findChestAt(session, mapId, 9, 9)).toBeUndefined();
      expect(depositToChest(session, chest.id, "item_wood", 2)).toBe(true);
      expect(inventoryEntries(session.inventory)).toEqual([{ itemId: "item_wood", count: 1 }]);
      expect(inventoryEntries(chest.inventory)).toEqual([{ itemId: "item_wood", count: 2 }]);
      expect(withdrawFromChest(session, chest.id, "item_wood", 1)).toBe(true);
      expect(session.inventory.item_wood).toBe(2);
      expect(chest.inventory.item_wood).toBe(1);
    });

    it("stable openChest id uses map coords when empty chestId", () => {
      const mapId = "map_home";
      const x = 2;
      const y = 5;
      expect(`chest_${mapId}_${x}_${y}`).toBe("chest_map_home_2_5");
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

// 폰트 통일 계약 — 레지스트리 · SystemRecords.fonts 정규화 · DOM 적용.
//
// 지켜야 할 불변식:
//   1. 레지스트리가 선택 가능한 글꼴의 유일한 목록이다(에디터 UI · 런타임 · 캔버스 텍스트 공용).
//   2. 기본값은 이 변경 **이전의** 스택과 글자 단위로 같다 — 손대지 않은 프로젝트는 렌더가 안 바뀐다.
//   3. tokens.css 의 --font-ui / --font-pixel / --font-mono 선언이 레지스트리 기본 스택과 일치한다.
//      (JS 레지스트리와 CSS 단일 진실 공급원이 갈라지면 폰트 통일 자체가 무의미해진다.)
//   4. normalizeSystemRecords 는 화이트리스트다 — fonts 가 여기 없으면 저장/로드 1회 왕복에 사라진다.
//      실제로 skillSystem 이 그렇게 사라진 전례가 databaseRecordModel.ts 주석에 남아 있다.
//   5. 기본값과 같은 선택은 저장하지 않는다(battleUiStyle · battleModel 과 같은 관례).
describe("systemFontTheme", () => {
  isolateTimers();
  const repoRoot = resolve(__dirname, "..");
  const readText = (rel: string): string => readFileSync(resolve(repoRoot, rel), "utf8");
  /** tokens.css 의 커스텀 프로퍼티 값을 읽는다(여러 줄 선언 허용, 주석 제거 후). */
  function tokenValue(css: string, name: string): string {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//gu, "");
    const match = stripped.match(new RegExp(`${name}\\s*:\\s*([^;]+);`, "u"));
    if (!match) throw new Error(`tokens.css 에 ${name} 선언이 없다`);
    return match[1].replace(/\s+/gu, " ").trim();
  }
  describe("폰트 레지스트리", () => {
    it("id 가 중복되지 않고 모든 엔트리가 비어 있지 않은 스택과 역할을 갖는다", () => {
      const ids = FONT_REGISTRY.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const entry of FONT_REGISTRY) {
        expect(entry.stack.trim().length).toBeGreaterThan(0);
        expect(entry.label.trim().length).toBeGreaterThan(0);
        expect(entry.roles.length).toBeGreaterThan(0);
      }
    });

    it("번들된 픽셀 글꼴 3종이 pixel 역할로 선택 가능하다", () => {
      const pixelIds = fontOptionsForRole("pixel").map((entry) => entry.id);
      expect(pixelIds).toContain("neodgm");
      expect(pixelIds).toContain("galmuri11");
      expect(pixelIds).toContain("galmuri9");
    });

    it("역할별 기본 선택이 레지스트리에 존재하고 그 역할을 실제로 지원한다", () => {
      for (const role of ["ui", "pixel", "mono"] as const) {
        const id = DEFAULT_FONT_SELECTION[role];
        expect(isFontFamilyId(id)).toBe(true);
        const entry = FONT_REGISTRY.find((candidate) => candidate.id === id);
        expect(entry?.roles).toContain(role);
      }
    });

    it("isFontFamilyId 가 미등록 id 를 거부한다", () => {
      expect(isFontFamilyId("neodgm")).toBe(true);
      expect(isFontFamilyId("comic-sans")).toBe(false);
      expect(isFontFamilyId(undefined)).toBe(false);
      expect(isFontFamilyId(42)).toBe(false);
    });

    it("tokens.css 의 폰트 토큰이 레지스트리 기본 스택과 일치한다", () => {
      const tokens = readText("src/styles/tokens.css");
      expect(tokenValue(tokens, "--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
      expect(tokenValue(tokens, "--font-pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
      expect(tokenValue(tokens, "--font-mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
    });

    it("runtime/system.css 가 --runtime-pixel-font 를 --font-pixel 의 별칭으로 둔다", () => {
      const css = readText("src/styles/runtime/system.css");
      expect(tokenValue(css, "--runtime-pixel-font")).toBe("var(--font-pixel)");
    });
  });
  describe("SystemRecords.fonts 정규화", () => {
    it("등록된 선택을 저장/로드 왕복에서 보존한다", () => {
      const normalized = normalizeSystemRecords({
        startActorIds: [],
        fonts: { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" },
      });
      expect(normalized.fonts).toEqual({ ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" });

      // 두 번째 왕복에서도 동일해야 한다 — 화이트리스트 누락은 1회 왕복 뒤에 드러난다.
      expect(normalizeSystemRecords(normalized).fonts).toEqual({
        ui: "galmuri11",
        pixel: "galmuri9",
        mono: "neodgm",
      });
    });

    it("미등록 id 는 버리고 남은 유효 선택만 유지한다", () => {
      const normalized = normalizeSystemRecords({
        startActorIds: [],
        fonts: { ui: "comic-sans", pixel: "galmuri9" } as never,
      });
      expect(normalized.fonts).toEqual({ pixel: "galmuri9" });
    });

    it("기본값과 같은 선택은 저장하지 않는다", () => {
      const normalized = normalizeSystemRecords({
        startActorIds: [],
        fonts: { ui: DEFAULT_FONT_SELECTION.ui, pixel: "galmuri9" },
      });
      expect(normalized.fonts).toEqual({ pixel: "galmuri9" });
    });

    it("빈 객체 · 유효 선택 없음 · 비객체는 fonts 키 자체를 남기지 않는다", () => {
      expect(normalizeSystemRecords({ startActorIds: [], fonts: {} }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], fonts: { ui: "nope" } as never }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], fonts: "neodgm" as never }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], fonts: null as never }).fonts).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [] }).fonts).toBeUndefined();
    });

    it("resolveFontSelection 이 생략된 역할을 기본값으로 채운다", () => {
      expect(resolveFontSelection(undefined)).toEqual(DEFAULT_FONT_SELECTION);
      expect(resolveFontSelection({ pixel: "galmuri9" })).toEqual({
        ...DEFAULT_FONT_SELECTION,
        pixel: "galmuri9",
      });
      expect(resolveFontSelection({ ui: "comic-sans" } as never)).toEqual(DEFAULT_FONT_SELECTION);
    });

    // Phaser 캡버스 텍스트는 CSS 변수를 해석하지 못해 이 함수로 생성 시점의 스택을 집어온다.
    it("projectFontStack 은 자자 선택을 따르고 생략 시 기본값으로 돌아간다", () => {
      expect(projectFontStack({ ui: "galmuri11" }, "ui")).toBe(resolveFontStack("galmuri11"));
      expect(projectFontStack({ mono: "neodgm" }, "mono")).toBe(resolveFontStack("neodgm"));
      expect(projectFontStack({ ui: "galmuri11" }, "mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
      expect(projectFontStack(undefined, "pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
    });
  });
  describe("applyProjectFontTheme", () => {
    let cleanupDom: (() => void) | undefined;

    beforeEach(() => {
      cleanupDom = installFakeDom();
    });

    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
    });

    it("선택한 글꼴 스택을 세 CSS 변수로 루트에 심는다", () => {
      const project = createBlankProject();
      project.system.fonts = { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" };
      const root = document.createElement("div");

      applyProjectFontTheme(project, root);

      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack("galmuri11"));
      expect(root.style.getPropertyValue("--font-pixel")).toBe(resolveFontStack("galmuri9"));
      expect(root.style.getPropertyValue("--font-mono")).toBe(resolveFontStack("neodgm"));
    });

    it("fonts 가 없으면 기본 스택을 심어 tokens.css 와 같은 값을 유지한다", () => {
      const project = createBlankProject();
      delete project.system.fonts;
      const root = document.createElement("div");

      applyProjectFontTheme(project, root);

      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
      expect(root.style.getPropertyValue("--font-pixel")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.pixel));
      expect(root.style.getPropertyValue("--font-mono")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.mono));
    });

    it("선택을 되돌리면 이전 선택이 남지 않는다", () => {
      const project = createBlankProject();
      const root = document.createElement("div");

      project.system.fonts = { ui: "galmuri11" };
      applyProjectFontTheme(project, root);
      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack("galmuri11"));

      delete project.system.fonts;
      applyProjectFontTheme(project, root);
      expect(root.style.getPropertyValue("--font-ui")).toBe(resolveFontStack(DEFAULT_FONT_SELECTION.ui));
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

describe("terrainRecordAt", () => {
  isolateTimers();
  function tagTile(project: ReturnType<typeof createBlankProject>, tag: number): { mapId: string; x: number; y: number } {
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("missing start map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    const x = project.startPos.x;
    const y = project.startPos.y;
    const tile = map.lowerTiles[y * map.width + x] ?? 0;
    if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
    while (tileset.terrain.length <= tile) tileset.terrain.push(0);
    tileset.terrain[tile] = tag;
    const meta = [...(tileset.tileMeta ?? [])];
    while (meta.length <= tile) meta.push({ label: "", description: "" });
    meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: tag };
    tileset.tileMeta = meta;
    return { mapId, x, y };
  }
  describe("terrainRecordAt", () => {
    it("resolves tag N to the Nth authored terrain record", () => {
      const project = createBlankProject();
      const loc = tagTile(project, 2);
      project.database.terrains = [
        { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        { id: "t2", name: "독늪", damage: 10, encounterRatePercent: 50, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
      ];
      const found = terrainRecordAt(project, loc);
      expect(found?.record.id).toBe("t2");
      expect(found?.tag).toBe(2);
    });

    it("returns undefined when the tile has no tag", () => {
      const project = createBlankProject();
      const loc = tagTile(project, 0);
      expect(terrainRecordAt(project, loc)).toBeUndefined();
    });

    it("falls back to tileMeta.terrainTag over tileset.terrain", () => {
      const project = createBlankProject();
      const loc = tagTile(project, 0);
      const map = project.maps[loc.mapId];
      if (!map) throw new Error("missing map");
      const tileset = project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");
      const tile = map.lowerTiles[loc.y * map.width + loc.x] ?? 0;
      const meta = [...(tileset.tileMeta ?? [])];
      while (meta.length <= tile) meta.push({ label: "", description: "" });
      meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: 3 };
      tileset.tileMeta = meta;
      project.database.terrains = [
        { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        { id: "t2", name: "둘", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        { id: "t3", name: "셋", damage: 7, encounterRatePercent: 10, characterDisplay: "transparent", vehiclePassage: { boat: true, ship: false, airshipLand: false } },
      ];
      const found = terrainRecordAt(project, loc);
      expect(found?.tag).toBe(3);
      expect(found?.record.id).toBe("t3");
    });
  });
});
