import { describe, expect, it, vi, afterEach } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { preflightProjectForPlay } from "@/project/playPreflight";
import type { Project, GameEvent, UploadedAsset, SkillChoreographyRecord, Command } from "@/project/types";
import { calculatePlaySurfaceScale } from "@/player/playSurfaceScale";
import { normalizePlaySurfaceScale, resolvePlaySurfaceScaleMode } from "@/project/playSurfaceScaleMode";
import { PRODUCT_TERMINOLOGY, checkProductTerminology, generatedProductTerminologyMarkdown, terminologyByArea, terminologyByAssistantTool, terminologyByEnglish, terminologyByKey, terminologyByKorean, terminologyKoreanCollisions, terminologyReservedEnglishWords, type ProductTerminology, type TerminologyArea, type TerminologyEntry } from "@/project/terminology";
import { DEVELOPMENT_ONTOLOGY } from "@/project/ontology";
import { uiLabel } from "@/editor/uiCopy";
import { cloneProjectForMutation, cloneProjectSharingReferenceDocuments, finishProjectMutation } from "@/project/projectClone";
import { readTileset } from "@/project/lazyTilesetRead";
import { store } from "@/project/store";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { projectJsonWithoutEventDrafts, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { projectRecoveredPathFromHref } from "@/project/projectRecoveryLocation";
import { PROJECT_NAME_URL_PARAM, PROJECT_URL_PARAM, readProjectFromUrl, syncProjectToUrl } from "@/project/projectUrl";
import { readLoadingInfo } from "@/player/bootLoader";
import { webUploadedAssetPath } from "@/project/webUploadedAssetPath";
import { resolve } from "node:path";
import { formatLastOpenedTime } from "@/project/recentProjectTime";
import { containsPath, validateRecentFolder } from "../electron/main/projectFolderPath";
import { filterRecentProjects, upsertRecentProject, withoutRecentProject } from "../electron/shared/recentProjects";
import type { RecentProjectEntry } from "../electron/shared/start";
import { startSession, type PlaySession } from "@/project/session";
import { getRelationshipState, setRelationshipState, DEFAULT_RELATIONSHIP_STATE, evalRelationshipCondition, normalizeRelationships, RELATIONSHIP_STATES, relationshipRank, type RelationshipHost } from "@/project/relationshipState";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import { readStoredZipEntry, readStoredZipEntryNames, writeStoredZip } from "@/project/packageZip";
import { FACE_IMAGE_SIZE, RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { RESOURCE_PROFILE_SPECS, validateResourceDimensions } from "@/project/resourceProfiles";
import { resolveRetroClassChoreography, resolveSkillChoreography, retroChoreographyIdForClone } from "@/assets/retroSkillCatalog";
import { normalizeSkillChoreographyRecord } from "@/project/skillChoreographyRecords";
import { createInterpreter } from "@/player/interpreter";
import { advanceRoguelikeRunFloor, resetRoguelikeRunRoom, startRoguelikeRun } from "@/project/roguelikeRun";
import { isolateTimers } from "./mergedTeardown";

// test/playPreflight.test.ts
// 플레이 부팅 전 프로젝트 예비검사(순수) — 수리 코드별 1건, 차단 코드별 1건,
// 건강한 프로젝트 무수리 통과, 입력 불변성.
describe("playPreflight", () => {
  isolateTimers();
  function codes(list: readonly { code: string }[]): string[] {
    return list.map((entry) => entry.code);
  }
  describe("preflightProjectForPlay", () => {
    it("건강한 프로젝트는 수리도 차단도 없이 통과한다", () => {
      const project = createBlankProject();
      const result = preflightProjectForPlay(project);
      expect(result.repairs).toEqual([]);
      expect(result.blockers).toEqual([]);
      expect(result.project.startMapId).toBe(project.startMapId);
    });

    it("입력 프로젝트를 변형하지 않는다", () => {
      const project = createBlankProject();
      project.startMapId = "map_gone";
      project.session = { ...project.session, partyActorIds: [] };
      const before = JSON.stringify(project);
      preflightProjectForPlay(project);
      expect(JSON.stringify(project)).toBe(before);
    });

    it("없는 시작 맵은 맵 트리 루트로 재배선한다 (start-map-missing)", () => {
      const project = createBlankProject();
      const rootMapId = project.mapTree.mapId;
      project.startMapId = "map_gone";
      const result = preflightProjectForPlay(project);
      expect(codes(result.repairs)).toContain("start-map-missing");
      expect(result.project.startMapId).toBe(rootMapId);
      expect(result.blockers).toEqual([]);
    });

    it("시작 맵의 타일셋이 없으면 있는 타일셋으로 대체한다 (start-map-tileset-missing)", () => {
      const project = createBlankProject();
      const startMap = project.maps[project.startMapId]!;
      startMap.tilesetId = "tileset_gone";
      const result = preflightProjectForPlay(project);
      expect(codes(result.repairs)).toContain("start-map-tileset-missing");
      const repaired = result.project.maps[result.project.startMapId]!;
      expect(Object.keys(result.project.tilesets)).toContain(repaired.tilesetId);
    });

    it("빈 파티는 첫 액터로 채운다 (party-empty)", () => {
      const project = createBlankProject();
      project.session = { ...project.session, partyActorIds: [] };
      const result = preflightProjectForPlay(project);
      expect(codes(result.repairs)).toContain("party-empty");
      expect(result.project.session.partyActorIds).toEqual([project.database.actors[0]!.id]);
    });

    it("존재하지 않는 파티 액터 id 도 첫 액터로 되돌린다 (party-empty)", () => {
      const project = createBlankProject();
      project.session = { ...project.session, partyActorIds: ["actor_gone"] };
      const result = preflightProjectForPlay(project);
      expect(codes(result.repairs)).toContain("party-empty");
      expect(result.project.session.partyActorIds).toEqual([project.database.actors[0]!.id]);
    });

    it("맵 밖 시작 좌표는 통행 가능한 칸으로 옮긴다 (start-position-unreachable)", () => {
      const project = createBlankProject();
      project.startPos = { x: 999, y: 999 };
      const result = preflightProjectForPlay(project);
      expect(codes(result.repairs)).toContain("start-position-unreachable");
      const map = result.project.maps[result.project.startMapId]!;
      const pos = result.project.startPos;
      expect(isPassable(result.project, map, pos.x, pos.y)).toBe(true);
    });

    it("통행 불가 타일 위 시작 좌표는 가장 가까운 통행 가능 칸으로 옮긴다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      project.startPos = { x: 5, y: 5 };
      map.lowerTiles[5 * map.width + 5] = TILE.WATER;
      map.upperTiles[5 * map.width + 5] = TILE.EMPTY;
      const result = preflightProjectForPlay(project);
      expect(codes(result.repairs)).toContain("start-position-unreachable");
      const repairedMap = result.project.maps[result.project.startMapId]!;
      const pos = result.project.startPos;
      expect(isPassable(result.project, repairedMap, pos.x, pos.y)).toBe(true);
      const distance = Math.max(Math.abs(pos.x - 5), Math.abs(pos.y - 5));
      expect(distance).toBe(1);
    });

    it("startOverride 좌표도 같은 규칙으로 검증·수리한다", () => {
      const project = createBlankProject();
      const result = preflightProjectForPlay(project, { mapId: project.startMapId, x: -3, y: 40 });
      expect(codes(result.repairs)).toContain("start-position-unreachable");
      const map = result.project.maps[result.project.startMapId]!;
      expect(isPassable(result.project, map, result.project.startPos.x, result.project.startPos.y)).toBe(true);
    });

    it("startOverride 의 맵이 없으면 시작 맵을 재배선한다", () => {
      const project = createBlankProject();
      const result = preflightProjectForPlay(project, { mapId: "map_gone", x: 1, y: 1 });
      expect(codes(result.repairs)).toContain("start-map-missing");
      expect(result.project.maps[result.project.startMapId]).toBeTruthy();
    });

    it("맵이 하나도 없으면 던지지 않고 차단 사유를 보고한다 (no-maps)", () => {
      const project = createBlankProject();
      const broken: Project = { ...project, maps: {}, mapTree: { mapId: "", children: [] } };
      const result = preflightProjectForPlay(broken);
      expect(codes(result.blockers)).toContain("no-maps");
      expect(result.blockers[0]!.detail.length).toBeGreaterThan(0);
    });

    it("타일셋이 하나도 없으면 던지지 않고 차단 사유를 보고한다 (no-tilesets)", () => {
      const project = createBlankProject();
      const broken: Project = { ...project, tilesets: {} };
      const result = preflightProjectForPlay(broken);
      expect(codes(result.blockers)).toContain("no-tilesets");
    });

    it("액터가 하나도 없어도 던지지 않는다", () => {
      const project = createBlankProject();
      const broken: Project = {
        ...project,
        database: { ...project.database, actors: [] },
        session: { ...project.session, partyActorIds: [] },
      };
      expect(() => preflightProjectForPlay(broken)).not.toThrow();
    });
  });
});

describe("playSurfaceScaleModeResolve", () => {
  isolateTimers();
  type SurfaceProject = Parameters<typeof resolvePlaySurfaceScaleMode>[0];
  const project = (system: SurfaceProject["system"], meta: SurfaceProject["meta"] = {} as SurfaceProject["meta"]): SurfaceProject => ({ meta, system });
  describe("resolvePlaySurfaceScaleMode", () => {
    it("uses integer scaling for projects that store a play resolution (the 480x270 default)", () => {
      expect(resolvePlaySurfaceScaleMode(project({ playResolution: { width: 480, height: 270 } }))).toBe("integer");
    });

    it("keeps legacy 320x240 projects (no stored resolution) on fit", () => {
      expect(resolvePlaySurfaceScaleMode(project({}))).toBe("fit");
    });

    it("honours an authored choice", () => {
      expect(resolvePlaySurfaceScaleMode(project({ playResolution: { width: 480, height: 270 }, playSurfaceScale: "fit" }))).toBe("fit");
      expect(resolvePlaySurfaceScaleMode(project({ playSurfaceScale: "integer" }))).toBe("integer");
    });

    it("keeps monster-collect (emerald) projects on integer even if fit is authored", () => {
      const meta = { oprnMonsterStyle: { version: 1, reference: "emerald" } } as unknown as SurfaceProject["meta"];
      expect(resolvePlaySurfaceScaleMode(project({ playSurfaceScale: "fit" }, meta))).toBe("integer");
    });

    it("drops unknown values", () => {
      expect(normalizePlaySurfaceScale("fill")).toBeUndefined();
      expect(normalizePlaySurfaceScale("fit")).toBe("fit");
    });
  });
  describe("480x270 integer scaling at common window sizes", () => {
    it("is 4x at FHD, 5x at QHD, 8x at 4K and 2x at 1280x720", () => {
      expect(calculatePlaySurfaceScale(1920, 1080, 480, 270, "integer")).toBe(4);
      expect(calculatePlaySurfaceScale(2560, 1440, 480, 270, "integer")).toBe(5);
      expect(calculatePlaySurfaceScale(3840, 2160, 480, 270, "integer")).toBe(8);
      expect(calculatePlaySurfaceScale(1280, 720, 480, 270, "integer")).toBe(2);
    });

    it("only goes fractional when the window is smaller than 1x", () => {
      expect(calculatePlaySurfaceScale(400, 300, 480, 270, "integer")).toBeCloseTo(400 / 480);
    });
  });
});

/// <reference types="vite/client" />
describe("productTerminology", () => {
  isolateTimers();
  const REPO_FILE_PATHS = new Set(
    Object.keys(import.meta.glob(["../src/**/*", "../docs/**/*", "../index.html"], { query: "?raw", import: "default" })).map(
      (path) => path.replace(/^\.\.\//, "")
    )
  );
  function withEntries(entries: readonly TerminologyEntry[]): ProductTerminology {
    return { ...PRODUCT_TERMINOLOGY, entries };
  }
  function entry(overrides: Partial<TerminologyEntry> = {}): TerminologyEntry {
    return {
      key: "sample.term",
      ko: "표본",
      en: "sample",
      area: "EditorShell",
      partOfSpeech: "noun",
      surface: "editor",
      sources: ["src/editor/uiCopy.ts"],
      ...overrides,
    };
  }
  describe("product terminology", () => {
    it("passes its own well-formedness check", () => {
      expect(checkProductTerminology(PRODUCT_TERMINOLOGY)).toEqual([]);
    });

    it("cites only source paths that exist in the repository", () => {
      const cited = [
        ...PRODUCT_TERMINOLOGY.entries.flatMap((term) => term.sources),
        ...PRODUCT_TERMINOLOGY.localeSensitiveSurfaces.flatMap((surface) => surface.sources),
      ];

      expect(cited.filter((path) => !REPO_FILE_PATHS.has(path))).toEqual([]);
    });

    it("agrees with the uiCopy Korean label registry", () => {
      const published = PRODUCT_TERMINOLOGY.entries.flatMap((term) =>
        term.uiCopyKey ? [{ key: term.key, ko: term.ko, labels: [uiLabel(term.uiCopyKey, "plain"), uiLabel(term.uiCopyKey, "technical")] }] : []
      );

      expect(published.filter((term) => !term.labels.includes(term.ko)).map((term) => term.key)).toEqual([]);
      expect(published.length).toBeGreaterThanOrEqual(10);
    });

    it("files shared areas under the same names as the development ontology", () => {
      const capabilityIds = DEVELOPMENT_ONTOLOGY.capabilities.map((capability) => capability.id);
      const terminologyOnly: readonly TerminologyArea[] = ["AssistantStudio", "EditorShell"];
      const areas = [...new Set(PRODUCT_TERMINOLOGY.entries.map((term) => term.area))];

      expect(areas.filter((area) => !capabilityIds.includes(area) && !terminologyOnly.includes(area))).toEqual([]);
      for (const capabilityId of capabilityIds) {
        expect(areas).toContain(capabilityId);
        expect(terminologyByArea(PRODUCT_TERMINOLOGY, capabilityId as TerminologyArea).length).toBeGreaterThan(0);
      }
    });

    it("keeps the concepts that collide in English apart", () => {
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.map")?.rejectedEnAliases).toContain("scene");
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.toolPlaceEvent")?.en).toBe("place event");
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.layerEvent")?.en).toBe("event layer");
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "event.event")?.en).toBe("event");
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "tile.tileset")?.rejectedEnAliases).toEqual(
        expect.arrayContaining(["chipset", "tile palette"])
      );
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "db.element")?.rejectedEnAliases).toContain("property");
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "db.troop")?.rejectedEnAliases).toContain("party");
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "battle.party")?.rejectedEnAliases).toContain("troop");
    });

    it("records who owns a refused English word", () => {
      const reserved = terminologyReservedEnglishWords(PRODUCT_TERMINOLOGY);

      expect(reserved.find((word) => word.word === "party")).toEqual({
        word: "party",
        refusedBy: ["db.troop"],
        ownedBy: "battle.party",
      });
      expect(reserved.find((word) => word.word === "troop")).toEqual({
        word: "troop",
        refusedBy: ["battle.party"],
        ownedBy: "db.troop",
      });
    });

    it("reports the Korean words that carry two concepts", () => {
      const collisions = terminologyKoreanCollisions(PRODUCT_TERMINOLOGY).map((bucket) => bucket.map((term) => term.key));

      expect(collisions).toEqual(expect.arrayContaining([["map.layerEvent", "event.event"], ["battle.turn", "assistant.turn"]]));
    });

    it("resolves a concept from a key, a Korean string, or an English string", () => {
      expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.layerGround")?.ko).toBe("바닥");
      expect(terminologyByKorean(PRODUCT_TERMINOLOGY, "하위").map((term) => term.key)).toEqual(["map.layerGround"]);
      expect(terminologyByKorean(PRODUCT_TERMINOLOGY, "펜").map((term) => term.key)).toEqual(["map.toolPaint"]);
      expect(terminologyByEnglish(PRODUCT_TERMINOLOGY, "Tileset").map((term) => term.key)).toEqual(["tile.tileset"]);
      expect(terminologyByAssistantTool(PRODUCT_TERMINOLOGY, "place_concept").map((term) => term.key)).toEqual([
        "assistant.taskPlaceFacility",
      ]);
      expect(terminologyByAssistantTool(PRODUCT_TERMINOLOGY, "author_village").map((term) => term.key)).toEqual([
        "assistant.taskBuildVillage",
      ]);
    });

    it("separates locale-sensitive formatting from translatable labels", () => {
      const kinds = PRODUCT_TERMINOLOGY.localeSensitiveSurfaces.map((surface) => surface.kind);

      expect(kinds).toEqual(expect.arrayContaining(["currency", "date", "documentLanguage", "number", "time"]));
      expect(PRODUCT_TERMINOLOGY.localeSensitiveSurfaces.find((surface) => surface.id === "document-language")).toEqual(
        expect.objectContaining({ locale: "ko", sources: ["index.html"] })
      );
      expect(PRODUCT_TERMINOLOGY.entries.map((term) => term.key)).not.toContain("document-language");
    });

    it("protects user-authored project content from a future translation pass", () => {
      const boundary = PRODUCT_TERMINOLOGY.translationBoundary;
      const untranslated = boundary.filter((rule) => !rule.translated).map((rule) => rule.id);

      expect(boundary.filter((rule) => rule.translated).map((rule) => rule.id)).toContain("product-chrome");
      expect(untranslated).toEqual(
        expect.arrayContaining(["authored-in-game-terms", "authored-map-and-event-text", "authored-record-names", "stable-identifiers"])
      );
      expect(boundary.filter((rule) => rule.owner === "author").every((rule) => !rule.translated)).toBe(true);
      // Identifiers are product-owned yet untranslated — the two axes must stay separate.
      expect(boundary.find((rule) => rule.id === "stable-identifiers")).toEqual(
        expect.objectContaining({ owner: "product", translated: false })
      );
    });

    it("refuses a boundary rule that would let a translation pass rewrite authored content", () => {
      const broken: ProductTerminology = {
        ...PRODUCT_TERMINOLOGY,
        translationBoundary: [
          { id: "product-chrome", owner: "product", translated: true, description: "chrome", examples: ["보기"] },
          { id: "authored-names", owner: "author", translated: true, description: "record names", examples: ["스킬 이름"] },
        ],
      };

      expect(checkProductTerminology(broken)).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "author-content-marked-translatable" })])
      );
    });

    it("rejects a duplicate key", () => {
      const issues = checkProductTerminology(withEntries([entry(), entry({ ko: "다른", en: "other" })]));

      expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "duplicate-key" })]));
    });

    it("rejects an empty term and a missing source", () => {
      const issues = checkProductTerminology(withEntries([entry({ ko: "  ", sources: [] })]));

      expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["empty-term", "missing-source"]));
    });

    it("rejects a shared English term when either side lacks a note", () => {
      const shared = [
        entry({ key: "a.one", ko: "하나", en: "duplicate", note: "explained" }),
        entry({ key: "a.two", ko: "둘", en: "Duplicate" }),
      ];

      const issues = checkProductTerminology(withEntries(shared));

      expect(issues).toEqual([
        expect.objectContaining({ code: "duplicate-english-without-note", message: expect.stringContaining("a.two") }),
      ]);
    });

    it("accepts a shared English term when both sides explain themselves", () => {
      const shared = [
        entry({ key: "a.one", ko: "하나", en: "duplicate", note: "the first one" }),
        entry({ key: "a.two", ko: "둘", en: "duplicate", note: "the second one" }),
      ];

      expect(checkProductTerminology(withEntries(shared))).toEqual([]);
    });

    it("rejects a shared Korean term when either side lacks a note", () => {
      const shared = [entry({ key: "a.one", ko: "같음", en: "first" }), entry({ key: "a.two", ko: "같음", en: "second" })];

      expect(checkProductTerminology(withEntries(shared))).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "duplicate-korean-without-note" })])
      );
    });

    it("rejects an alias that is another concept's canonical Korean term", () => {
      const shared = [
        entry({ key: "a.one", ko: "장식", en: "decoration" }),
        entry({ key: "a.two", ko: "덧그림", en: "overlay", deprecatedKoAliases: ["장식"] }),
      ];

      expect(checkProductTerminology(withEntries(shared))).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "alias-shadows-canonical" })])
      );
    });

    it("rejects a Korean term that disagrees with uiCopy", () => {
      const issues = checkProductTerminology(withEntries([entry({ ko: "데이터 창고", en: "database", uiCopyKey: "database" })]));

      expect(issues).toEqual([
        expect.objectContaining({ code: "ui-copy-disagreement", message: expect.stringContaining("자료집") }),
      ]);
    });

    it("rejects two entries claiming the same uiCopy key", () => {
      const shared = [
        entry({ key: "a.one", ko: "자료집", en: "database", uiCopyKey: "database", note: "first" }),
        entry({ key: "a.two", ko: "데이터베이스", en: "record editor", uiCopyKey: "database" }),
      ];

      expect(checkProductTerminology(withEntries(shared))).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "duplicate-ui-copy-key" })])
      );
    });

    it("rejects a malformed key", () => {
      expect(checkProductTerminology(withEntries([entry({ key: "MapEditing/Layer" })]))).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "malformed-key" })])
      );
    });

    it("generates a readable terminology document", () => {
      const markdown = generatedProductTerminologyMarkdown(PRODUCT_TERMINOLOGY);

      expect(markdown).toContain("# Korean-English Product Terminology");
      expect(markdown).toContain("| key | 한국어 | English | role | surface | note |");
      expect(markdown).toContain("`map.layerGround`");
      expect(markdown).toContain("## Korean collisions");
      expect(markdown).toContain("## Reserved and refused English words");
      expect(markdown).toContain("## Locale-sensitive surfaces");
      expect(markdown).toContain("## Translation boundary");
      expect(markdown).toContain("authored-in-game-terms");
    });
  });
});

describe("projectClone", () => {
  isolateTimers();
  describe("cloneProjectSharingReferenceDocuments", () => {
    it("shares reference document arrays and keeps database edits off the source", () => {
      const source = createBlankProject();
      const tiled = Object.values(source.tilesets).find((tileset) => tileset.referenceDocuments?.length);
      expect(tiled?.referenceDocuments?.length).toBeGreaterThan(0);
      const clone = cloneProjectSharingReferenceDocuments(source);
      const clonedTile = clone.tilesets[tiled!.id]!;
      expect(clonedTile.referenceDocuments).toBe(tiled!.referenceDocuments);

      clonedTile.referenceDocuments = [];
      expect(tiled!.referenceDocuments?.length).toBeGreaterThan(0);

      clone.database.skills[0]!.name = "clone-only";
      expect(source.database.skills[0]!.name).not.toBe("clone-only");
    });

    it("database updates do not rewrite the previous project's reference documents", () => {
      store.replace(createBlankProject());
      const before = store.getCurrent();
      const beforeDocs = Object.values(before.tilesets).find((tileset) => tileset.referenceDocuments)?.referenceDocuments;
      updateDatabaseRecord("skills", before.database.skills[0]!.id, { name: "parity-skill" });
      const after = store.getCurrent();
      expect(after).not.toBe(before);
      expect(after.database.skills[0]!.name).toBe("parity-skill");
      expect(before.database.skills[0]!.name).not.toBe("parity-skill");
      expect(Object.values(before.tilesets).find((tileset) => tileset.referenceDocuments)?.referenceDocuments).toBe(beforeDocs);
    });
  });
  describe("readTileset on a mutation draft", () => {
    it("reads an untouched tileset without cloning it, and sees the draft copy once a tool writes it", () => {
      const source = createBlankProject();
      const map = Object.values(source.maps)[0]!;
      const original = source.tilesets[map.tilesetId]!;
      const draft = cloneProjectForMutation(source);

      expect(readTileset(draft.tilesets, map.tilesetId)).toBe(original);
      isPassable(draft, draft.maps[map.id]!, 0, 0);
      // 통행 검사는 자리를 복제로 확정하지 않는다(접근자가 그대로 남는다).
      expect(Object.getOwnPropertyDescriptor(draft.tilesets, map.tilesetId)?.get).toBeTypeOf("function");
      expect(finishProjectMutation(draft)?.size).toBe(0);
      expect(draft.tilesets[map.tilesetId]).toBe(original);

      const written = cloneProjectForMutation(source);
      written.tilesets[map.tilesetId]!.name = "draft-only";
      expect(readTileset(written.tilesets, map.tilesetId)?.name).toBe("draft-only");
      expect(original.name).not.toBe("draft-only");
      expect([...finishProjectMutation(written)!]).toEqual([map.tilesetId]);
    });
  });
});

describe("projectJsonWithoutEventDrafts", () => {
  isolateTimers();
  function makeEvent(id: string, x: number): GameEvent {
    return {
      id,
      x,
      y: 1,
      trigger: { kind: "action" },
      commands: [{ kind: "text", text: `body of ${id}` }],
    } as unknown as GameEvent;
  }
  /** 원본 깊은복제 경로와 **바이트 단위로 같은 JSON** 이어야 한다. */
  function expectSameJson(project: Project): void {
    expect(projectJsonWithoutEventDrafts(project)).toBe(JSON.stringify(projectWithoutEventDrafts(project)));
  }
  describe("projectJsonWithoutEventDrafts", () => {
    it("matches the deep-clone projection when no event carries a draft", () => {
      const project = createBlankProject();
      project.maps[project.startMapId].events = [makeEvent("event_a", 1), makeEvent("event_b", 2)];
      expectSameJson(project);
    });

    it("matches the deep-clone projection for new drafts, edit drafts and plain events", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const edited = makeEvent("event_edit", 3);
      const original = makeEvent("event_edit", 3);
      project.maps[mapId].events = [
        makeEvent("event_plain", 1),
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
        { ...edited, commands: [{ kind: "text", text: "working body" }], draft: { kind: "edit", original } } as unknown as GameEvent,
        { ...makeEvent("event_edit_no_original", 4), draft: { kind: "edit" } } as unknown as GameEvent,
      ];
      expectSameJson(project);
    });

    it("matches the deep-clone projection across several maps where only one holds drafts", () => {
      const project = createBlankProject();
      const first = project.startMapId;
      project.maps[first].events = [makeEvent("event_plain", 1)];
      project.maps.map_second = structuredClone(project.maps[first]);
      project.maps.map_second.id = "map_second";
      project.maps.map_second.events = [
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
      ];
      expectSameJson(project);
    });

    // 이 함수의 존재 이유 자체 — 드래그 한 번에 2~3회 도는 경로에서 프로젝트 전체 복제는
    // 120x100 맵 기준 비용의 62%였다(.probe/attribute-paint.json).
    it("does not deep-clone the project", () => {
      const project = createBlankProject();
      project.maps[project.startMapId].events = [
        makeEvent("event_plain", 1),
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
      ];
      const clone = vi.spyOn(globalThis, "structuredClone");
      projectJsonWithoutEventDrafts(project);
      expect(clone).not.toHaveBeenCalled();
      clone.mockRestore();
    });

    it("leaves the caller's project untouched", () => {
      const project = createBlankProject();
      project.maps[project.startMapId].events = [
        { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
      ];
      const before = JSON.stringify(project);
      projectJsonWithoutEventDrafts(project);
      expect(JSON.stringify(project)).toBe(before);
    });
  });
});

describe("projectRecoveryLocation", () => {
  isolateTimers();
  describe("LegacyDb recovery URL", () => {
    it("leaves fresh project mode when DB connection succeeds", () => {
      expect(projectRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1")).toBe("/?projectRecovered=1");
    });

    it("preserves unrelated params and hash while enabling canonical LegacyDb load", () => {
      expect(projectRecoveredPathFromHref("http://127.0.0.1:5194/?freshProject=1&zoom=2#map")).toBe(
        "/?zoom=2&projectRecovered=1#map",
      );
    });
  });
});

describe("projectUrl", () => {
  isolateTimers();
  afterEach(() => {
    // jsdom / node: reset location search via history when available
    if (typeof window !== "undefined" && window.history?.replaceState) {
      window.history.replaceState(null, "", "/");
    }
  });
  describe("projectUrl", () => {
    it("reads project and name from the query string", () => {
      expect(readProjectFromUrl("?project=rpg-zzu-editor-demo-village&name=%EC%97%90%EB%94%94%ED%84%B0%20%EB%8D%B0%EB%AA%A8%20%EB%A7%88%EC%9D%84")).toEqual({
        projectId: "rpg-zzu-editor-demo-village",
        projectName: "에디터 데모 마을",
      });
    });

    it("accepts legacy projectId param", () => {
      expect(readProjectFromUrl("?projectId=legacy-id")).toEqual({
        projectId: "legacy-id",
        projectName: null,
      });
    });

    it("prefers project over projectId when both are set", () => {
      expect(readProjectFromUrl("?project=new-id&projectId=old-id").projectId).toBe("new-id");
    });

    it("writes project and name into the address bar", () => {
      if (typeof window === "undefined" || !window.history?.replaceState) return;
      syncProjectToUrl({
        projectId: "rpg-zzu-editor-demo-village",
        projectName: "에디터 데모 마을",
      });
      const params = new URLSearchParams(window.location.search);
      expect(params.get(PROJECT_URL_PARAM)).toBe("rpg-zzu-editor-demo-village");
      expect(params.get(PROJECT_NAME_URL_PARAM)).toBe("에디터 데모 마을");
      expect(params.get("projectId")).toBeNull();
    });

    it("clears project params when projectId is empty", () => {
      if (typeof window === "undefined" || !window.history?.replaceState) return;
      syncProjectToUrl({ projectId: "keep-me", projectName: "이름" });
      syncProjectToUrl({ projectId: null });
      const params = new URLSearchParams(window.location.search);
      expect(params.get(PROJECT_URL_PARAM)).toBeNull();
      expect(params.get(PROJECT_NAME_URL_PARAM)).toBeNull();
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

describe("recentProjects", () => {
  isolateTimers();
  const older: RecentProjectEntry = { projectDir: "/Games/Old", title: "모험 2", lastOpenedAt: "2026-11-15T12:00:00Z", updatedAt: "2026-11-19T12:00:00Z" };
  const newer: RecentProjectEntry = { projectDir: "/Games/New", title: "모험 10", lastOpenedAt: "2026-11-17T12:00:00Z" };
  const copy: RecentProjectEntry = { projectDir: "/Games/New 사본", title: "모험 10", lastOpenedAt: null };
  const missing: RecentProjectEntry = { projectDir: "/Moved/RPG", title: "사라진 게임", lastOpenedAt: "invalid", hiddenReason: "missing" };
  describe("최근 프로젝트 목록", () => {
    it("이름과 경로를 검색하고 한글 정규화와 대소문자 차이를 허용한다", () => {
      const entries = [older, newer, copy, missing];
      expect(filterRecentProjects(entries, "  모험 2 ".normalize("NFD"), "opened")).toEqual([older]);
      expect(filterRecentProjects(entries, "/games/NEW", "opened")).toEqual([newer, copy]);
      expect(filterRecentProjects(entries, "moved", "opened")).toEqual([missing]);
    });

    it("편집 시각 대신 마지막으로 연 시각으로 정렬하고 열기 기록이 없는 사본도 남긴다", () => {
      const entries = [older, copy, newer, missing];
      expect(filterRecentProjects(entries, "", "opened")).toEqual([newer, older, copy, missing]);
      expect(filterRecentProjects(entries, "모험", "name")).toEqual([older, copy, newer]);
      expect(entries).toEqual([older, copy, newer, missing]);
    });

    it("마지막으로 연 시각은 오래된 날짜도 한국어 상대 시각으로 표시한다", () => {
      const now = Date.parse("2026-11-19T12:00:00Z");
      expect(formatLastOpenedTime("2026-11-19T10:00:00Z", "ko", now)).toBe("2시간 전");
      expect(formatLastOpenedTime("2026-11-18T12:00:00Z", "ko", now)).toBe("어제");
      expect(formatLastOpenedTime("2026-09-19T12:00:00Z", "ko", now)).toBe("2개월 전");
      expect(formatLastOpenedTime(null, "ko", now)).toBe("");
    });

    it("같은 경로를 다시 열면 앞으로 옮기고 제거는 지정 경로에만 적용한다", () => {
      const entries = [newer, older];
      const reopened = { ...older, title: "새 제목", lastOpenedAt: "2026-11-19T13:00:00Z" };
      expect(upsertRecentProject(entries, reopened, 2)).toEqual([reopened, newer]);
      expect(upsertRecentProject(entries, copy, 2)).toEqual([copy, newer]);
      expect(withoutRecentProject([newer, copy, missing], missing.projectDir)).toEqual([newer, copy]);
      expect(withoutRecentProject(entries, missing.projectDir)).toEqual(entries);
      expect(entries).toEqual([newer, older]);
    });
  });
  describe("최근 프로젝트 폴더 검증", () => {
    const dir = resolve("games", "project");
    const another = resolve("games", "another");
    const recent = [{ projectDir: dir }];

    it("정확히 같은 최근 경로이며 프로젝트 검사에 통과한 폴더만 허용한다", () => {
      expect(validateRecentFolder(dir, recent, () => dir)).toBe(dir);
      expect(validateRecentFolder(dir, recent, () => null)).toBeNull();
      expect(validateRecentFolder(dir, recent, () => another)).toBeNull();
    });

    it("등록되지 않은 경로, 상대 경로, 우회 경로와 루트는 파일을 검사하기 전에 거절한다", () => {
      const inspect = vi.fn(() => dir);
      const root = resolve("/");
      for (const path of [another, "games/project", dir + "/../project", dir + "\0suffix", root, {}]) {
        const entries = path === another || typeof path !== "string" ? recent : [{ projectDir: path }];
        expect(validateRecentFolder(path, entries, inspect)).toBeNull();
      }
      expect(inspect).not.toHaveBeenCalled();
    });

    it("폴더 포함 관계는 이름 접두어가 아닌 경로 요소를 비교한다", () => {
      expect(containsPath(dir, resolve(dir, "nested"))).toBe(true);
      expect(containsPath(dir, dir)).toBe(true);
      expect(containsPath(dir, dir + " 사본")).toBe(false);
      expect(containsPath(dir, another)).toBe(false);
    });
  });
});

describe("relationshipPersistence", () => {
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
  /* 이 스위트는 반드시 saveToSlot → readSaveSlot 을 지나야 한다. createSaveSnapshot 을
     applySaveSnapshot 에 바로 넘기면 알려진 필드만 고르는 JSON 파서를 건너뛰어서,
     네 경계 중 파서만 빠뜨린 결함을 잡지 못한다. */
  describe("관계 상태 세이브 왕복", () => {
    it("네 경계를 모두 지나 살아남는다", () => {
      const project = createBlankProject();
      const storage = new MemoryStorage();
      const session = startSession(project);
      setRelationshipState(session, "npc_ha", "engaged");
      setRelationshipState(session, "npc_yu", "married");

      saveToSlot(storage, 1, createSaveSnapshot(project, session));
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;

      const restored = applySaveSnapshot(project, read.snapshot);
      expect(getRelationshipState(restored, "npc_ha")).toBe("engaged");
      expect(getRelationshipState(restored, "npc_yu")).toBe("married");
    });

    it("관계가 없는 낡은 세이브는 관계 없음으로 열린다", () => {
      const project = createBlankProject();
      const storage = new MemoryStorage();
      const snapshot = createSaveSnapshot(project, startSession(project));
      const legacy = {
        ...snapshot,
        session: Object.fromEntries(
          Object.entries(snapshot.session).filter(([key]) => key !== "relationships")
        ),
      } as typeof snapshot;
      expect("relationships" in legacy.session).toBe(false);

      saveToSlot(storage, 2, legacy);
      const read = readSaveSlot(storage, 2);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;

      const restored = applySaveSnapshot(project, read.snapshot);
      expect(getRelationshipState(restored, "npc_ha")).toBe("single");
    });

    it("열거 밖 값이 든 세이브는 그 항목만 버린다", () => {
      const project = createBlankProject();
      const storage = new MemoryStorage();
      const snapshot = createSaveSnapshot(project, startSession(project));
      const hostile = {
        ...snapshot,
        session: { ...snapshot.session, relationships: { npc_ha: "maried", npc_yu: "dating" } },
      } as unknown as typeof snapshot;

      saveToSlot(storage, 3, hostile);
      const read = readSaveSlot(storage, 3);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") return;

      const restored = applySaveSnapshot(project, read.snapshot);
      expect(getRelationshipState(restored, "npc_ha")).toBe("single");
      expect(getRelationshipState(restored, "npc_yu")).toBe("dating");
    });
  });
});

describe("relationshipState", () => {
  isolateTimers();
  describe("관계 상태 권위", () => {
    it("없으면 관계 없음으로 파생된다", () => {
      expect(getRelationshipState({}, "npc_a")).toBe("single");
      expect(getRelationshipState({ relationships: {} }, "npc_a")).toBe("single");
      expect(DEFAULT_RELATIONSHIP_STATE).toBe("single");
    });

    it("단계가 순서를 가진다", () => {
      expect(RELATIONSHIP_STATES).toEqual(["single", "dating", "engaged", "married"]);
      expect(relationshipRank("single")).toBeLessThan(relationshipRank("dating"));
      expect(relationshipRank("dating")).toBeLessThan(relationshipRank("engaged"));
      expect(relationshipRank("engaged")).toBeLessThan(relationshipRank("married"));
    });

    it("기본값으로 되돌리면 항목을 남기지 않는다", () => {
      const host: RelationshipHost = {};
      setRelationshipState(host, "npc_a", "married");
      expect(host.relationships).toEqual({ npc_a: "married" });
      setRelationshipState(host, "npc_a", "single");
      expect(host.relationships).toEqual({});
    });

    it("빈 키는 저장하지 않는다", () => {
      const host: RelationshipHost = {};
      setRelationshipState(host, "   ", "married");
      expect(host.relationships ?? {}).toEqual({});
    });

    it("이상 비교는 단계 순서를 따른다", () => {
      const host: RelationshipHost = { relationships: { npc_a: "engaged" } };
      for (const [state, expected] of [
        ["single", true],
        ["dating", true],
        ["engaged", true],
        ["married", false],
      ] as const) {
        expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state }, "npc_a")).toBe(expected);
      }
    });

    it("키가 없으면 닫힌 채로 거짓이다", () => {
      const host: RelationshipHost = { relationships: { npc_a: "married" } };
      expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state: "dating" }, null)).toBe(false);
    });

    /* 열거 밖 문자열을 통과시키면 relationshipRank 가 -1 을 돌려 모든 이상 비교가 참이 된다.
       문자열 상태에는 수치의 clamp 대응물이 없으므로 정규화가 유일한 방어선이다. */
    it("낡거나 적대적인 세이브 값은 버린다", () => {
      expect(normalizeRelationships({ npc_a: "maried", npc_b: "dating" })).toEqual({ npc_b: "dating" });
      expect(normalizeRelationships({ npc_a: 3 })).toEqual({});
      expect(normalizeRelationships({ "  ": "married" })).toEqual({});
      expect(normalizeRelationships({ npc_a: "single" })).toEqual({});
      expect(normalizeRelationships("nope")).toBeUndefined();
    });

    it("버려진 값은 조건을 참으로 만들지 않는다", () => {
      const host: RelationshipHost = { relationships: normalizeRelationships({ npc_a: "maried" }) };
      expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state: "married" }, "npc_a")).toBe(false);
      expect(getRelationshipState(host, "npc_a")).toBe("single");
    });

    it("조건 종류가 레지스트리에 등록돼 있다", () => {
      expect(CONDITION_KINDS).toContain("relationshipAtLeast");
    });
  });
});

describe("releaseZipHeaders", () => {
  isolateTimers();
  describe("release ZIP structural integrity", () => {
    it("rejects a local filename that disagrees with the inventoried name", async () => {
      const bytes = new Uint8Array(await writeStoredZip([{ name: "safe.txt", bytes: new Uint8Array([1]) }]).arrayBuffer());
      bytes.set(new TextEncoder().encode("evil.txt"), 30);
      expect(() => readStoredZipEntry(bytes, "safe.txt")).toThrow();
    });
    it("rejects damaged stored content even without a release manifest", async () => {
      const bytes = new Uint8Array(await writeStoredZip([{ name: "safe.txt", bytes: new Uint8Array([1]) }]).arrayBuffer());
      bytes[38] = 2;
      expect(() => readStoredZipEntry(bytes, "safe.txt")).toThrow();
    });
    it("rejects undeclared trailing bytes", async () => {
      const original = new Uint8Array(await writeStoredZip([{ name: "safe.txt", bytes: new Uint8Array([1]) }]).arrayBuffer());
      const bytes = new Uint8Array(original.length + 2); bytes.set(original);
      expect(() => readStoredZipEntryNames(bytes)).toThrow();
    });
  });
});

describe("resourceProfiles", () => {
  isolateTimers();
  describe("RM2K3 resource profiles", () => {
    it("records slicing ontology for every resource profile kind", () => {
      for (const spec of RESOURCE_PROFILE_SPECS) {
        expect(spec.slicing).toBe(RESOURCE_SLICING[spec.kind]);
        if (spec.slicing.kind === "grid") {
          expect(spec.tileWidth).toBe(spec.slicing.cellWidth);
          expect(spec.tileHeight).toBe(spec.slicing.cellHeight);
        }
      }
    });

    it("records fixed pixel split units for grid-sliced RPG resources", () => {
      expect(RESOURCE_SLICING.chipset).toMatchObject({
        kind: "grid",
        unit: "tile",
        cellWidth: 16,
        cellHeight: 16,
        columns: 30,
        rows: 16,
        count: 480,
        sheetWidth: 480,
        sheetHeight: 256,
        subcell: { unit: "quarter-tile", cellWidth: 8, cellHeight: 8 },
      });
      expect(RESOURCE_SLICING.charset).toMatchObject({
        kind: "grid",
        unit: "charset-frame",
        cellWidth: 24,
        cellHeight: 32,
        columns: 12,
        rows: 8,
        count: 96,
      });
      expect(RESOURCE_SLICING.battleWeapon).toMatchObject({
        kind: "grid",
        unit: "battle-weapon",
        cellWidth: 64,
        cellHeight: 64,
        columns: 3,
        rows: 8,
        count: 24,
        sheetWidth: 192,
        sheetHeight: 512,
      });
      // battleWeapon 과 같은 3x8 이다. 이 선언이 없으면 imageSpec 이 expectedWidth/Height 를
      // 못 만들고, 런타임이 144x384 를 전제하는데도 아무 48 배수 시트가 import 를 통과한다.
      expect(RESOURCE_SLICING.battleCharset).toMatchObject({
        kind: "grid",
        unit: "battle-character",
        cellWidth: 48,
        cellHeight: 48,
        columns: 3,
        rows: 8,
        count: 24,
        sheetWidth: 144,
        sheetHeight: 384,
      });
    });

    it("accepts a 144x384 battle charset as 48x48 frames", () => {
      const result = validateResourceDimensions("battleCharset", 144, 384);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tilesPerRow).toBe(3);
        expect(result.tileCount).toBe(24);
      }
    });

    it("rejects a battle charset that is not 144x384", () => {
      // Break caught: battleCharset was the only grid resource without a declared sheet size,
      // so a 144x192 sheet imported cleanly and then rendered wrong — battleFieldDom sizes the
      // background as (frame*3)x(frame*8) and cannot adapt. chipset/charset/battleWeapon all
      // already pin their sheet size; this closes the gap.
      const result = validateResourceDimensions("battleCharset", 144, 192);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe("전투 캐릭터셋: 144x384 크기가 필요합니다. 현재 144x192입니다.");
    });

    it("accepts a 480x256 chipset as 16x16 tiles", () => {
      const result = validateResourceDimensions("chipset", 480, 256);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tilesPerRow).toBe(30);
        expect(result.tileCount).toBe(480);
      }
    });

    it("accepts a 288x256 charset as 24x32 frames", () => {
      const result = validateResourceDimensions("charset", 288, 256);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tilesPerRow).toBe(12);
        expect(result.tileCount).toBe(96);
      }
    });

    it("rejects a 320x240 chipset with an actionable message", () => {
      const result = validateResourceDimensions("chipset", 320, 240);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe("칩셋: 480x256 크기가 필요합니다. 현재 320x240입니다.");
    });

    it("treats a faceset as one whole 48x48 image", () => {
      expect(RESOURCE_SLICING.faceset).toEqual({ kind: "whole-image", unit: "image" });
      expect(FACE_IMAGE_SIZE).toBe(48);

      const result = validateResourceDimensions("faceset", FACE_IMAGE_SIZE, FACE_IMAGE_SIZE);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.tileCount).toBe(1);
        expect(result.tilesPerRow).toBe(1);
      }
    });

    it("still accepts the legacy 48-multiple square sheets left on disk", () => {
      const sheet = validateResourceDimensions("faceset", 192, 192);
      expect(sheet.ok).toBe(true);
      if (sheet.ok) {
        expect(sheet.tilesPerRow).toBe(4);
        expect(sheet.tileCount).toBe(16);
      }
    });

    it("rejects a faceset that is neither a 48x48 face nor a 48-multiple square", () => {
      const result = validateResourceDimensions("faceset", 96, 48);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toBe("얼굴 그래픽: 48x48 얼굴 한 장이 필요합니다. 현재 96x48입니다.");
    });
  });
});

describe("retroChoreographyProjectRecordOverride", () => {
  isolateTimers();
  // 새라의 용기사 기술(skill_dragoon_*)은 id 자체가 계약 연출이라 프로젝트 연출 레코드를 붙여도 카엘 검 시트가 그려졌다.
  const lance = normalizeSkillChoreographyRecord({
    id: "chor_test_lance", name: "창", motion: "dash-strike",
    layers: [{ sheet: "valkyrie_thrust", anchor: "target" }],
  }) as SkillChoreographyRecord;
  describe("project choreography record named by a contract-id skill", () => {
    it("keeps the contract when no project record is named", () => {
      expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance" }, [lance])?.id).toBe("skill_dragoon_sweeping_lance");
      expect(resolveRetroClassChoreography({ id: "skill_dragoon_sweeping_lance" }, [lance])?.layers.map((l) => l.key)).toContain("hero_whirl");
    });

    it("lets the named project record win over the skill's own contract", () => {
      const resolved = resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, [lance]);
      expect(resolved?.origin).toBe("project");
      expect(resolved?.id).toBe(lance.id);
      const layers = resolveRetroClassChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, [lance])!.layers.map((l) => l.key);
      expect(layers).toContain("valkyrie_thrust");
      expect(layers).not.toContain("hero_whirl");
    });

    it("falls back to the contract when the named record does not exist", () => {
      expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: "chor_missing" }, [lance])?.id).toBe("skill_dragoon_sweeping_lance");
      expect(resolveSkillChoreography({ id: "skill_dragoon_sweeping_lance", retroChoreographyId: lance.id }, undefined)?.id).toBe("skill_dragoon_sweeping_lance");
    });

    it("a copy of a contract-id skill keeps the named project record", () => {
      expect(retroChoreographyIdForClone({ id: "skill_dragoon_jump", retroChoreographyId: lance.id })).toBe(lance.id);
      expect(retroChoreographyIdForClone({ id: "skill_dragoon_jump" })).toBe("skill_dragoon_jump");
    });

    it("still keeps an own contract ahead of another contract id", () => {
      expect(resolveRetroClassChoreography({ id: "skill_ranger_snipe", retroChoreographyId: "skill_gunner_snipe" })?.id).toBe("skill_ranger_snipe");
    });
  });
});

describe("roguelikeRun", () => {
  isolateTimers();
  type ExpectedRunState = {
    readonly version: 1;
    readonly runId: string;
    readonly seed: number;
    readonly floor: number;
    readonly status: "active" | "completed" | "failed" | "abandoned";
    readonly flags: Record<string, boolean>;
    readonly roomResetCounts: Record<string, number>;
    readonly roomEventGenerationKeys: Record<string, string>;
  };
  type SessionWithRun = PlaySession & { roguelikeRun?: ExpectedRunState };
  function asCommand(value: unknown): Command {
    return value as Command;
  }
  describe("roguelike run lifecycle", () => {
    it("executes start, flag, floor advance, run condition, and completion in one real event flow", () => {
      // Break named: an unknown runControl command currently terminates the interpreter without creating run state.
      const project = createBlankProject();
      const session = startSession(project, 99) as SessionWithRun;
      const commands = [
        asCommand({ kind: "runControl", action: "start", seed: 123, startFloor: 2 }),
        asCommand({ kind: "runControl", action: "setFlag", flag: "bossDoor", value: true }),
        asCommand({ kind: "runControl", action: "advance", amount: 2 }),
        asCommand({
          kind: "fork",
          condition: { kind: "run", query: "floor", op: ">=", value: 4 },
          then: [{ kind: "setSwitch", switchId: project.switches[0]!.id, value: true }],
        }),
        asCommand({ kind: "runControl", action: "end", result: "completed" }),
      ];

      expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
      expect(session.roguelikeRun).toEqual({
        version: 1,
        runId: "run-0000007b",
        seed: 123,
        floor: 4,
        status: "completed",
        flags: { bossDoor: true },
        roomResetCounts: {},
        roomEventGenerationKeys: {},
      });
      expect(session.switches[project.switches[0]!.id]).toBe(true);
    });

    it("preserves active run state through a save snapshot roundtrip", () => {
      // Break named: createSaveSnapshot omits run state, so applying the snapshot loses the active run.
      const project = createBlankProject();
      const session = startSession(project) as SessionWithRun;
      session.roguelikeRun = {
        version: 1,
        runId: "run-save",
        seed: 0xffff_ffff,
        floor: 7,
        status: "active",
        flags: { treasureTaken: true },
        roomResetCounts: { room_a: 2 },
        roomEventGenerationKeys: { map_blank_start: "run-save:4294967295:7:room_a:2" },
      };

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session)) as SessionWithRun;

      expect(restored.roguelikeRun).toEqual(session.roguelikeRun);
    });

    it("loads legacy version-one run saves without event generation markers", () => {
      const project = createBlankProject();
      const session = startSession(project);
      startRoguelikeRun(session, { seed: 5 });
      const snapshot = createSaveSnapshot(project, session);
      const legacyRun = snapshot.session.roguelikeRun as unknown as Record<string, unknown>;
      delete legacyRun.roomEventGenerationKeys;

      expect(applySaveSnapshot(project, snapshot).roguelikeRun?.roomEventGenerationKeys).toEqual({});
    });

    it("treats advance as forward-only and records the current room id on reset", () => {
      const host: SessionWithRun = startSession(createBlankProject()) as SessionWithRun;
      startRoguelikeRun(host, { seed: 7, startFloor: 3 });

      expect(advanceRoguelikeRunFloor(host, -5)).toBe(true);
      expect(host.roguelikeRun?.floor).toBe(4);
      expect(resetRoguelikeRunRoom(host, " room-a ")).toBe(true);
      expect(host.roguelikeRun?.currentRoomId).toBe("room-a");
      expect(host.roguelikeRun?.roomResetCounts).toEqual({ "room-a": 1 });
    });
  });
});
