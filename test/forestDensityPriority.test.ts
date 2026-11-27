import { describe, expect, it, afterEach } from "vitest";
import { forestPlacementPlan, treeFootprintCells } from "@/editor/tools/forestDensity";
import { broadleafCountFor, coniferCountFor, resolveWorldGenRules } from "@/project/worldGenRules";
import corrections from "@/assets/characterReferenceCorrections.json";
import previousNames from "@/assets/previousFaceReferenceNames.json";
import { GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { listEventResourceOptions } from "@/ai/eventResourceCatalog";
import { listDatabaseResourceOptions } from "@/editor/resourceOptions";
import { QUERY_TOOLS } from "@/editor/tools/queryTools";
import { createBlankProject, ensureBundledResourceProfiles } from "@/project/defaults";
import { defaultSharedCharacterGraphics, parseSharedCharacterGraphicsDocument } from "@/project/sharedCharacterGraphicsSchema";
import { acceptSharedCharacterGraphics, reconcileSharedFaceWithCharset, sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { PLAY_TOOLS } from "@/editor/tools/playTools";
import { functionalFixture, suspendedCorridorFixture } from "./fixtures/functionalAcceptance";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createInterpreter } from "@/player/interpreter";
import { startSession } from "@/project/session";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { isolateTimers } from "./mergedTeardown";

describe("forestDensityPriority", () => {
  isolateTimers();
  /**
   * PR #350 은 «울창한 숲» 이 잔디밭처럼 드물던 결함을 밀도 축으로 고쳤고, PR #355 는 그 수치를
   * DB 「세계 → 생성 규칙」 탭에서 저작하게 만들었다. 두 PR 은 같은 호출부를 서로 다르게 고쳐서
   * 충돌했다 — #355 가 #350 보다 먼저 갈라졌기 때문에 #355 쪽 코드는 «의도적 대체» 가 아니라
   * 그냥 구버전이다.
   *
   * 그래서 «모델이 넘긴 density enum이 저작 기본값을 이긴다» 로 합성했다. 이 테스트는 그
   * 우선순위가 필요하다는 근거(저작 기본값이 훨씬 드물다)를 숫자로 못 박는다. 순서가 뒤집히면
   * #350 이 되돌아간다. 사용자 문장 정규식은 쓰지 않는다.
   */
  describe("숲 밀도 — 모델 density enum이 저작 기본값을 이긴다", () => {
    const area = { x: 0, y: 0, w: 10, h: 10 } as const;
    const areaTiles = area.w * area.h;
    const forest = resolveWorldGenRules(undefined).forest;

    it("저작 기본값은 요청된 «통행 불가» 보다 훨씬 드물다 — 그래서 요청문이 이겨야 한다", () => {
      const requested = forestPlacementPlan({
        area,
        footprintCells: treeFootprintCells("침엽수"),
        density: "impassable",
        share: 0.45,
      });
      const authoredDefault = coniferCountFor(areaTiles, forest);

      expect(authoredDefault).toBeLessThan(requested.count);
      // 저작 기본값을 그대로 쓰면 그루 수가 절반도 안 된다. #350 이 고친 «잔디밭» 이 그 상태다.
      expect(authoredDefault * 2).toBeLessThan(requested.count);
    });

    it("«촘촘함» 요청도 저작 기본값보다 촘촘하다", () => {
      const requested = forestPlacementPlan({
        area,
        footprintCells: treeFootprintCells("침엽수"),
        density: "dense",
        share: 0.45,
      });
      expect(coniferCountFor(areaTiles, forest)).toBeLessThan(requested.count);
    });

    it("활엽수도 같은 방향이다 — 저작 기본값이 요청된 밀도보다 드물다", () => {
      const requested = forestPlacementPlan({
        area,
        footprintCells: treeFootprintCells("활엽수"),
        density: "impassable",
        share: 0.55,
      });
      expect(broadleafCountFor(areaTiles, forest)).toBeLessThan(requested.count);
    });

    it("밀도 축은 촘촘해질수록 그루 수가 늘고 간격이 좁아진다", () => {
      const plans = (["sparse", "normal", "dense", "impassable"] as const).map((density) =>
        forestPlacementPlan({
          area,
          footprintCells: treeFootprintCells("침엽수"),
          density,
          share: 1,
        }),
      );
      for (let i = 1; i < plans.length; i += 1) {
        expect(plans[i]!.count).toBeGreaterThan(plans[i - 1]!.count);
        expect(plans[i]!.minGap).toBeLessThanOrEqual(plans[i - 1]!.minGap);
      }
      // 통행 불가만 빈틈 채우기로 보낸다.
      expect(plans[3]!.packing).toBe("dense");
      expect(plans[2]!.packing).toBe("natural");
    });
  });
});

describe("fullCharacterReferenceAudit", () => {
  isolateTimers();
  const project = () => createBlankProject();
  const tool = (name: string) => QUERY_TOOLS.find(tool => tool.name === name)!;
  const search = async (p: ReturnType<typeof project>, query: string) =>
    (await tool("list_resources").run(p, {kind:"faceset",query,limit:50})).data as {matches:{id:string;label:string;description:string}[]};
  afterEach(() => acceptSharedCharacterGraphics(defaultSharedCharacterGraphics()));
  describe("Complete character reference census regressions", () => {
    it("migrates untouched old rows, preserves authored edits, and is idempotent", () => {
      const original = defaultSharedCharacterGraphics();
      original.mappings = corrections.mappings.map(change => structuredClone(change.before)) as typeof original.mappings;
      original.faces = corrections.faces.map(change => structuredClone(change.before));
      const migrated = parseSharedCharacterGraphicsDocument(original);
      // #2759: parse forward-fills the bundled modern-romance chip pairs (tex_oprn_charset_modern*) missing from old documents.
      const forwardFilled = (key: string) => /^tex_oprn_charset_modern\d+$/u.test(key);
      const shipped = defaultSharedCharacterGraphics();
      const addedMappings = shipped.mappings.filter(row => forwardFilled(row.textureKey));
      const addedFaceIds = new Set(addedMappings.map(row => row.faceResourceId));
      expect(migrated.mappings).toEqual([...corrections.mappings.map(change => change.after), ...addedMappings]);
      expect(migrated.faces).toEqual([...corrections.faces.map(change => change.after), ...shipped.faces.filter(face => addedFaceIds.has(face.resourceId))]);
      expect(parseSharedCharacterGraphicsDocument(migrated)).toEqual(migrated);
      original.mappings[0]!.note = "저자가 직접 검토한 짝";
      expect(parseSharedCharacterGraphicsDocument(original).mappings[0]).toEqual(original.mappings[0]);
    });

    it("upgrades hosts that saved the pre-2026-10-31 borrowed cross-sheet pairs to no-face", () => {
      const stored = defaultSharedCharacterGraphics();
      stored.mappings = corrections.revisions.map(change => structuredClone(change.before)) as typeof stored.mappings;
      stored.faces = [];
      const migrated = parseSharedCharacterGraphicsDocument(stored).mappings.filter(row => !/^tex_oprn_charset_modern\d+$/u.test(row.textureKey));
      expect(migrated).toEqual(corrections.revisions.map(change => change.after));
      expect(migrated.every(row => row.status === "no-face" && row.faceResourceId === null)).toBe(true);
    });

    it("removes 19 blank cells from picker, prompt and search despite stored profiles", async () => {
      expect(GENERATED_FACESET_FACE_IDS.size).toBe(19);
      const p = project();
      for (const id of GENERATED_FACESET_FACE_IDS) p.resourceProfiles.push({kind:"faceset",assetId:id,name:"빈 칸"});
      const picker = new Set(listDatabaseResourceOptions("faceset",p).map(row=>row.id));
      const prompt = new Set(listEventResourceOptions("faceset",p).map(row=>row.id));
      for (const id of GENERATED_FACESET_FACE_IDS) {
        expect(picker.has(id)).toBe(false);
        expect(prompt.has(id)).toBe(false);
        expect((await search(p,id)).matches).toEqual([]);
      }
    });

    it("does not mistake an uploaded replacement for the public blank/face pixels", async () => {
      const p = project(), id = "generated-faceset-missing-scarloxy-15";
      p.assets.uploaded[id] = {id,kind:"faceset",name:"우리 캐릭터",dataUrl:"data:image/png;base64,AA=="};
      p.resourceProfiles.push({kind:"faceset",assetId:id,name:"우리 캐릭터"});
      ensureBundledResourceProfiles(p);
      expect(p.resourceProfiles.some(row=>row.assetId===id)).toBe(true);
      expect(listDatabaseResourceOptions("faceset",p).find(row=>row.id===id)?.name).toBe("우리 캐릭터");
      expect((await search(p,id)).matches[0]).toMatchObject({id,label:"우리 캐릭터"});
      expect((await search(p,id)).matches[0]?.description).toContain("사용자 업로드");
    });

    it("updates seeded old face names in existing projects and retains custom names", async () => {
      const p = project(), id = "shared-actor2-blue-hat-woman-expressions-00";
      const profile = p.resourceProfiles.find(row=>row.assetId===id)!;
      profile.name = (previousNames as Record<string,string>)[id]!;
      expect((await search(p,id)).matches[0]?.label).toContain("붉은 모자 푸른 머리");
      ensureBundledResourceProfiles(p);
      expect(profile.name).toContain("붉은 모자 푸른 머리");
      profile.name = "우리 마법사";
      ensureBundledResourceProfiles(p);
      expect((await search(p,id)).matches[0]?.label).toBe("우리 마법사");
    });

    it("uses the accepted host mapping for search, NPC candidates, auto-face and reconciliation", async () => {
      const catalog = defaultSharedCharacterGraphics(), p = project();
      const row = catalog.mappings.find(row=>row.textureKey==="tex_easyrpg_charset_people3" && row.characterIndex===0)!;
      row.faceResourceId = "easyrpg-faceset-actor1-00";
      catalog.faces.find(face=>face.resourceId===row.faceResourceId)!.label="호스트 검토 얼굴";
      acceptSharedCharacterGraphics(catalog);
      expect(sharedFaceForCharset(row.textureKey,0)?.resourceId).toBe(row.faceResourceId);
      const npc = (await tool("list_npc_graphics").run(p,{query:"왕"})).data as {matches:{textureKey:string;face:{resourceId:string}}[]};
      expect(npc.matches.find(match=>match.textureKey===row.textureKey)?.face.resourceId).toBe(row.faceResourceId);
      // The longer reviewed actor1-00 face note now pushes the pair list past list_resources' 240-unit cut; the host pair is still listed, its label is cut.
      expect((await search(p,"호스트 검토 얼굴")).matches[0]?.description).toContain("tex_easyrpg_charset_people3");
      expect(reconcileSharedFaceWithCharset("easyrpg-faceset-people1-00",row.textureKey,0).faceResourceId).toBe(row.faceResourceId);
    });

    // 2026-10-31: 다른 시트의 다른 인물 얼굴을 빌리던 근사 짝(폴른 스타: 참회자 → 소년, 사제 → 할머니)은 얼굴 없음이다.
    it.each([["monster3",1]])("withholds incompatible %s #%s automatic face", (sheet,index) => {
      expect(sharedFaceForCharset(`tex_easyrpg_charset_${sheet}`,Number(index))).toBeNull();
    });

    it("offers source-linked original face portraits and searches non-base expressions", async () => {
      const p = project();
      const npc = (await tool("list_npc_graphics").run(p,{query:"청년 용사"})).data as {matches:{textureKey:string;characterIndex:number;portraitOptions:{mode:string;note?:string}[]}[]};
      const options = npc.matches.find(row=>row.textureKey==="tex_easyrpg_charset_actor1" && row.characterIndex===0)?.portraitOptions;
      expect(options?.map(row=>row.mode)).toEqual(["face","bust","full"]);
      expect(options?.[2]?.note).toContain("별도 그림");
      const id="shared-people1-boy-expressions-full-wink";
      expect((await search(p,id)).matches).toHaveLength(1);
      expect((await search(p,id)).matches[0]?.id).toBe(id);
      expect((await search(p,"generated-face-actor1-full")).matches[0]?.description).toContain("실제 그림은 흉상");
    });

    it.each([
      ["dragon-blue","푸른 드래곤","red"],
    ])("corrects replaced monster pixels: %s", (suffix,name,obsoleteTag) => {
      const row=listMonsterResources(project()).find(row=>row.resourceId===`generated-enemy-${suffix}`)!;
      expect(row.name).toContain(name); expect(row.tags).not.toContain(obsoleteTag);
    });

    it("resolves exact monster IDs without semantic tags", async () => {
      const p = project();
      for (const id of ["generated-enemy-golem-clay","scarloxy-monster-atrox"]) {
        const result = (await tool("list_resources").run(p,{kind:"monster",query:id,limit:50})).data as {matches:{id:string;label:string}[]};
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0]?.id).toBe(id);
        expect(result.matches[0]?.label).toBe(listMonsterResources(p).find(row=>row.resourceId===id)?.name);
      }
    });
  });
});

describe("functionalScenePurchase", () => {
  isolateTimers();
  function purchase(options: { seller?: string; itemId?: string; count?: number; unitPrice?: number; gold?: number; blocked?: boolean; single?: boolean } = {}) {
    const fixture = functionalFixture();
    const { project, seller, origin } = fixture;
    if (options.gold !== undefined) project.session.gold = options.gold;
    const shop = seller.pages?.[0]?.commands[0];
    if (options.single && shop?.kind === "shop") shop.quantityMode = "single";
    if (options.blocked) origin.events.unshift({ ...structuredClone(seller), id: "wrong_seller" });
    const tool = PLAY_TOOLS.find(tool => tool.name === "run_scene_test");
    if (!tool) throw new Error("Missing public scene tool");
    const before = structuredClone(project);
    const output = tool.run(project, { mapId: project.startMapId, start: project.startPos, steps: [
      { kind: "walk", to: { x: seller.x, y: seller.y }, adjacent: true },
      { kind: "snapshotRewards" },
      { kind: "interact", eventId: seller.id },
      { kind: "purchase", eventId: options.seller ?? seller.id, itemId: options.itemId ?? "item_potion", count: options.count ?? 2, unitPrice: options.unitPrice ?? 10 },
      { kind: "expect", goldDelta: -20, inventoryDelta: { item_potion: 2 }, interactionComplete: true },
    ] });
    expect(project).toEqual(before);
    return output;
  }
  describe("public scene purchase transaction", () => {
    it("walks to the seller and buys exact stock with real gold and inventory deltas", () => {
      const output = purchase();
      expect(output.data, JSON.stringify(output.data)).toMatchObject({ ok: true, finalState: { inventory: { item_potion: 2 }, gold: 80 } });
    });
    it("buys the requested total through repeated production transactions in a single-quantity shop", () => {
      expect(purchase({ single: true }).data).toMatchObject({ ok: true, finalState: { gold: 80, inventory: { item_potion: 2 } } });
    });
    it.each([
      { seller: "wrong_seller" }, { itemId: "item_capture_orb" }, { unitPrice: 9 }, { count: 1 }, { gold: 19 }, { blocked: true },
    ])("rejects wrong target, stock, price/count or funds: %j", options => {
      expect(purchase(options).data).toMatchObject({ ok: false });
    });
    it("does not treat opening an untransacted shop as a completed interaction", () => {
      const { project, seller } = functionalFixture();
      const tool = PLAY_TOOLS.find(tool => tool.name === "run_scene_test");
      if (!tool) throw new Error("Missing public scene tool");
      expect(tool.run(project, { mapId: project.startMapId, start: project.startPos, steps: [
        { kind: "walk", to: { x: seller.x, y: seller.y }, adjacent: true }, { kind: "interact", eventId: seller.id },
        { kind: "expect", interactionComplete: true },
      ] }).data).toMatchObject({ ok: false });
    });
  });
});

describe("functionalWalkSuspension", () => {
  isolateTimers();
  describe("functional walking preserves blocking interpreter ownership", () => {
    it("rejects the forced-shop corridor rather than overwriting its pending continuation with the outgoing transfer", () => {
      const f = suspendedCorridorFixture();
      const ledger = new AssistantAcceptanceLedger("corridor", "Round trip", f.project);
      ledger.adopt([{ id: "trip", title: "Trip", criteria: [{ kind: "mapRoundTrip", target: { mapId: f.origin.id },
        start: f.project.startPos, destination: { mapId: f.destination.id }, outgoing: { eventId: f.outgoing.id }, returning: { eventId: f.returning.id } }] }]);
      expect(ledger.evaluate(f.project).items[0].evidence[0].passed).toBe(false);
    });
    it("split and unsplit public walks both stop at the same suspended shop without executing the transfer", () => {
      const f = suspendedCorridorFixture();
      const tool = PLAY_TOOLS.find(tool => tool.name === "run_scene_test");
      if (!tool) throw new Error("Missing scene tool");
      const results = [false, true].map(split => tool.run(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [
        ...(split ? [{ kind: "walk", to: { x: 1, y: 2 } }] : []),
        { kind: "walk", to: { x: 1, y: 4 } },
        { kind: "expect", mapId: f.destination.id },
      ] }).data);
      for (const result of results) expect(result).toMatchObject({ ok: false, finalState: { mapId: f.origin.id, x: 1, y: 2, gold: 100, gameOver: false } });
    });
    it("cannot start another autorun over an already held shop interpreter", () => {
      const f = suspendedCorridorFixture();
      f.corridor.pages![0].trigger = { kind: "auto" };
      f.outgoing.pages![0].trigger = { kind: "auto" };
      f.origin.events = [f.corridor, f.outgoing];
      const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [] });
      expect(result).toMatchObject({ ok: false, finalState: { mapId: f.origin.id, gold: 100 } });
    });
    it("fails closed when transfer-triggered autorun suspension cannot preserve the outer continuation", () => {
      const f = suspendedCorridorFixture();
      f.origin.events = [f.outgoing];
      f.corridor.pages![0].trigger = { kind: "auto" };
      f.destination.events.push(f.corridor);
      const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [
        { kind: "walk", to: { x: 1, y: 4 } }, { kind: "expect", interactionComplete: true },
      ] });
      expect(result).toMatchObject({ ok: false, finalState: { mapId: f.destination.id, gold: 100, gameOver: false } });
    });
    it("a real purchase resumes the held shop's game-over command rather than dropping it", () => {
      const f = suspendedCorridorFixture();
      const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [
        { kind: "walk", to: { x: 1, y: 2 } },
        { kind: "expect", interactionComplete: false, gameOver: false },
        { kind: "purchase", eventId: f.corridor.id, itemId: "item_potion", count: 1, unitPrice: 10 },
        { kind: "expect", gameOver: true, goldDelta: -10, inventoryDelta: { item_potion: 1 } },
      ] });
      expect(result.ok).toBe(true);
      const commands = f.corridor.pages?.[0]?.commands;
      if (!commands) throw new Error("Missing corridor commands");
      const interpreter = createInterpreter([...commands], startSession(f.project, 1), f.project, { currentEventId: f.corridor.id });
      expect(interpreter.start().kind).toBe("shop");
      expect(interpreter.resume(false).kind).toBe("gameOver");
    });
  });
});
