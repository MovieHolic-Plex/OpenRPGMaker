import { describe, expect, it, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { BGM_CATALOG, BGM_CATALOG_LICENSE, bgmTrackLabel, bgmTracksByCategory, findBgmTrack } from "@/assets/bgmCatalog";
import { BGM_CATALOG_TOTAL_SECONDS, BGM_CATALOG_TRACK_COUNT, bgmCatalogResourceIds, findBgmRuntimeEntry, isBgmCatalogResourceId } from "@/assets/bgmCatalogRuntime";
import { BGM_CDN_PREFIX, BGM_LOCAL_FALLBACK_PREFIX, bgmCdnBase, bgmTrackUrl } from "@/assets/bgmCdn";
import { BGM_STARTER_TRACK_IDS, STARTER_TITLE_BGM_ID } from "@/assets/bgmStarterTracks";
import { resolveBgmCatalogAssetUrl } from "@/assets/bgmCatalogResolver";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { searchResources } from "@/assets/resourceSearch";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { createBlankProject } from "@/project/defaults";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools";
import { ToolError, type ToolContext } from "@/editor/tools/types";
import type { EventPageGraphic, Project, Command } from "@/project/types";
import path from "node:path";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { resourceReferenceMessage } from "@/editor/databaseReferences";
import { updateDatabaseRecord, duplicateDatabaseRecord } from "@/editor/databaseActions";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { store } from "@/project/store";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { BADGE_HALO_PICTURE_ID, BADGE_MEDAL_PICTURE_ID, badgeAwardCommands, badgeIconResourceId, findBadgeCeremony, installBadgeCeremonies, isBadgeCeremonyCommand } from "@/project/monsterBadgeCeremony";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { isolateTimers } from "./mergedTeardown";

// CC0 BGM 카탈로그(281곡) 배선 가드.
//
// 이 파일이 지키는 것은 세 가지다.
//  1) 카탈로그 자체가 줄거나 깨지지 않는다(생성 스크립트 회귀).
//  2) 카탈로그 곡을 지정한 프로젝트가 **역직렬화에 성공**한다 — 알려진 리소스 id 집합에 들어 있어야 한다.
//     여기서 빠지면 곡이 안 들리는 게 아니라 프로젝트 로드 자체가 assert 로 실패한다.
//  3) CDN 미설정 환경에서도 기본 프로젝트는 소리가 난다(스타터 곡이 레포에 있다).
describe("bgmCatalog", () => {
  isolateTimers();
  /** 카탈로그 곡의 로컬 폴백 경로(public/ 기준). env 를 비워 CDN 설정에 흔들리지 않게 한다. */
  function localPathFor(resourceId: string): string {
    const entry = findBgmRuntimeEntry(resourceId);
    expect(entry, `${resourceId} 가 카탈로그에 없다`).toBeDefined();
    const url = bgmTrackUrl(entry!.fileName, {});
    expect(url).not.toBeNull();
    return decodeURIComponent(url!.replace(/^\//, ""));
  }
  describe("BGM release manifest", () => {
    const manifest = JSON.parse(readFileSync(resolve("assets/bgm-release-v1.json"), "utf8")) as {
      schemaVersion: number; version: number; repo: string; tag: string; count: number;
      totalBytes: number; license: string;
      archive: { fileName: string; bytes: number; sha256: string };
      tracks: { id: string; fileName: string; bytes: number; sha256: string }[];
    };

    it("pins the complete sorted catalog with real digests and runtime filenames", () => {
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.version).toBe(1);
      // 공개 저장소 이름이 OpenRPGMaker 로 바뀌었다(0d4f13e7c8 공개 기준 커밋) — 매니페스트도 그 저장소를 가리킨다.
      expect(manifest.repo).toBe("MovieHolic-Plex/OpenRPGMaker");
      expect(manifest.tag).toBe("bgm-v1");
      expect(manifest.license).toBe(BGM_CATALOG_LICENSE);
      expect(manifest.count).toBe(BGM_CATALOG_TRACK_COUNT);
      expect(manifest.tracks.map((track) => track.id)).toEqual(BGM_CATALOG.map((track) => track.id).sort());
      expect(new Set(manifest.tracks.map((track) => track.fileName)).size).toBe(manifest.count);
      let upstreamHashes = 0;
      for (const track of manifest.tracks) {
        const catalog = findBgmTrack(track.id)!;
        expect(track.fileName).toBe(findBgmRuntimeEntry(track.id)!.fileName);
        expect(track.bytes).toBe(catalog.bytes);
        expect(track.sha256).toMatch(/^[a-f0-9]{64}$/);
        if (/^[a-f0-9]{64}$/.test(catalog.sha256)) {
          expect(track.sha256).toBe(catalog.sha256);
          upstreamHashes++;
        }
      }
      expect(upstreamHashes).toBe(221);
      expect(manifest.totalBytes).toBe(1303934164);
      expect(manifest.totalBytes).toBe(manifest.tracks.reduce((sum, track) => sum + track.bytes, 0));
      expect(manifest.archive.fileName).toBe("rpg-zzu-bgm-v1.tar");
      expect(manifest.archive.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.archive.bytes).toBe(manifest.tracks.reduce((sum, track) => sum + 512 + Math.ceil(track.bytes / 512) * 512, 1024));
    });

    it("matches the committed starter bytes, not just their paths", () => {
      for (const id of BGM_STARTER_TRACK_IDS) {
        const track = manifest.tracks.find((entry) => entry.id === id)!;
        const data = readFileSync(resolve("public", localPathFor(id)));
        expect(data.length).toBe(track.bytes);
        expect(createHash("sha256").update(data).digest("hex")).toBe(track.sha256);
      }
    });
  });
  describe("CC0 BGM 카탈로그", () => {
    it("281곡이 실려 있고 런타임/메타데이터 목록이 일치한다", () => {
      expect(BGM_CATALOG_TRACK_COUNT).toBe(281);
      expect(BGM_CATALOG).toHaveLength(BGM_CATALOG_TRACK_COUNT);
      expect(new Set(bgmCatalogResourceIds())).toEqual(new Set(BGM_CATALOG.map((track) => track.id)));
    });

    it("리소스 id 와 트랙 코드가 중복되지 않는다", () => {
      expect(new Set(BGM_CATALOG.map((t) => t.id)).size).toBe(BGM_CATALOG.length);
      expect(new Set(BGM_CATALOG.map((t) => t.trackCode)).size).toBe(BGM_CATALOG.length);
      expect(new Set(BGM_CATALOG.map((t) => t.id.replace(/^cc0-bgm-/, ""))).size).toBe(BGM_CATALOG.length);
    });

    it("모든 곡이 재생 가능한 확장자와 양수 길이를 가진다", () => {
      for (const track of BGM_CATALOG) {
        const entry = findBgmRuntimeEntry(track.id);
        expect(entry, track.id).toBeDefined();
        // MIDI 를 기본 세트에 넣으면 브라우저에서 무음이 된다 — EasyRPG RTP 로 이미 겪은 함정이다.
        expect(entry!.fileName).toMatch(/\.(mp3|ogg|wav|m4a)$/i);
        expect(track.durationSeconds, track.id).toBeGreaterThan(0);
        expect(track.bytes, track.id).toBeGreaterThan(0);
      }
    });

    it("총 재생 시간이 곡 수와 함께 기록돼 있다", () => {
      const sum = Math.round(BGM_CATALOG.reduce((total, track) => total + track.durationSeconds, 0));
      expect(BGM_CATALOG_TOTAL_SECONDS).toBe(sum);
      // 11시간 이상 — 곡 수는 같은데 파일이 통째로 바뀌는 회귀를 잡는다.
      expect(BGM_CATALOG_TOTAL_SECONDS).toBeGreaterThan(11 * 3600);
    });

    it("라이선스가 CC0 로 못박혀 있다", () => {
      expect(BGM_CATALOG_LICENSE).toBe("CC0-1.0");
    });

    it("모든 곡이 카테고리와 검색 태그를 갖는다", () => {
      for (const track of BGM_CATALOG) {
        expect(track.category.trim(), track.id).not.toBe("");
        expect(track.tags.length, track.id).toBeGreaterThan(2);
        expect(track.tags, track.id).toContain("bgm");
      }
    });

    it("카테고리 그룹이 전곡을 빠짐없이 담는다", () => {
      const groups = bgmTracksByCategory();
      const total = [...groups.values()].reduce((sum, list) => sum + list.length, 0);
      expect(total).toBe(BGM_CATALOG.length);
      expect(groups.size).toBeGreaterThan(50);
    });

    it("표시 라벨에 제목·장면·길이가 모두 들어간다", () => {
      const track = BGM_CATALOG[0]!;
      const label = bgmTrackLabel(track);
      expect(label).toContain(track.title);
      expect(label).toContain(track.category);
      expect(label).toMatch(/\(\d+:\d{2}\)$/);
    });

    it("id 로 트랙을 찾을 수 있고 카탈로그 밖 id 는 undefined 다", () => {
      expect(findBgmTrack(BGM_CATALOG[0]!.id)?.trackCode).toBe(BGM_CATALOG[0]!.trackCode);
      expect(findBgmTrack("cc0-bgm-does-not-exist")).toBeUndefined();
      expect(isBgmCatalogResourceId(BGM_CATALOG[0]!.id)).toBe(true);
      expect(isBgmCatalogResourceId("cc0-bgm-field")).toBe(false);
    });
  });
  describe("BGM CDN 경로 해석", () => {
    const fileName = "rtp-fld-001-meadow-guild-square_f5d3e29d.mp3";

    it("CDN 미설정이면 같은 오리진 로컬 폴백으로 떨어진다", () => {
      expect(bgmCdnBase({})).toBeNull();
      expect(bgmTrackUrl(fileName, {})).toBe(`${BGM_LOCAL_FALLBACK_PREFIX}/${fileName}`);
    });

    it("CDN 이 설정되면 절대 URL 을 만들고 끝의 슬래시를 정리한다", () => {
      const env = { VITE_BGM_CDN_BASE: "https://cdn.example.com/rpg-zzu///" };
      expect(bgmCdnBase(env)).toBe("https://cdn.example.com/rpg-zzu");
      expect(bgmTrackUrl(fileName, env)).toBe(`https://cdn.example.com/rpg-zzu/${BGM_CDN_PREFIX}/${fileName}`);
    });

    it("http(s) 가 아닌 베이스는 무시한다", () => {
      // 오타로 javascript:/file: 같은 스킴이 들어가면 절대 URL 로 새 나가지 않게 막는다.
      expect(bgmCdnBase({ VITE_BGM_CDN_BASE: "javascript:alert(1)" })).toBeNull();
      expect(bgmCdnBase({ VITE_BGM_CDN_BASE: "   " })).toBeNull();
    });

    it("경로 조작이 섞인 파일명은 거부한다", () => {
      for (const bad of ["../secret.mp3", "a/b.mp3", "a\\b.mp3", "  "]) {
        expect(bgmTrackUrl(bad, {}), bad).toBeNull();
      }
    });

    it("리졸버가 카탈로그 id 를 재생 URL 로 바꾼다", () => {
      const track = BGM_CATALOG[0]!;
      expect(resolveBgmCatalogAssetUrl(track.id)).toContain(findBgmRuntimeEntry(track.id)!.fileName);
      expect(resolveBgmCatalogAssetUrl("cc0-bgm-not-a-track")).toBeNull();
    });

    it("공용 리소스 해석기도 같은 URL 을 돌려준다", () => {
      const track = BGM_CATALOG[0]!;
      const url = resolveAssetResourceUrl(track.id, { project: { assets: { uploaded: {}, sprites: {} } } as never });
      expect(url).toBe(resolveBgmCatalogAssetUrl(track.id));
    });
  });
  describe("카탈로그 곡을 프로젝트에서 쓸 수 있다", () => {
    it("알려진 리소스 id 집합에 281곡이 모두 들어 있다", () => {
      // 이게 깨지면 곡이 안 들리는 게 아니라 프로젝트 역직렬화가 assert 로 실패한다.
      const known = collectResourceIds(createBlankProject());
      const missing = BGM_CATALOG.filter((track) => !known.has(track.id)).map((track) => track.id);
      expect(missing).toEqual([]);
    });

    it("리소스 검색이 장면 낱말로 카탈로그 곡을 찾는다", () => {
      for (const query of ["던전", "전투", "마을", "동굴"]) {
        const hits = searchResources("bgm", query);
        const fromCatalog = hits.filter((hit) => isBgmCatalogResourceId(hit.id.replace(/^bgm:/, "")));
        expect(fromCatalog.length, `"${query}" 로 카탈로그 곡을 못 찾았다`).toBeGreaterThan(0);
      }
    });

    it("전체 브라우징 질의가 카탈로그 전곡을 포함한다", () => {
      const all = searchResources("bgm", "*").map((hit) => hit.id.replace(/^bgm:/, ""));
      expect(all.filter((id) => isBgmCatalogResourceId(id))).toHaveLength(BGM_CATALOG.length);
    });
  });
  describe("스타터 곡 — CDN 없이도 소리가 난다", () => {
    it("기본 맵/전투 BGM 이 스타터 곡이다", () => {
      const system = defaultSystem();
      for (const id of [system.defaultBgmResourceId, system.battleBgmResourceId]) {
        expect(id, "기본 BGM 슬롯이 비어 있다").toBeTruthy();
        expect(BGM_STARTER_TRACK_IDS, `${id} 는 레포에 파일이 없는 곡이다(CDN 전용)`).toContain(id);
      }
    });

    it("타이틀 BGM: 새 프로젝트만 스타터 곡으로 채우고, 옛 문서 기준 기본값은 비어 있다", () => {
      // titleScreenMusic.test.ts 의 계약(2026-11-24 "채운다")과 짝. 새 프로젝트의 타이틀 곡은 레포에
      // 파일이 있는 스타터 곡이어야 하고(CDN 없는 환경에서도 재생), normalize 기준인
      // defaultTitleScreenSettings() 는 비어 있어야 저장된 프로젝트의 빈 칸이 채워지지 않는다.
      const title = defaultSystem(true).titleScreen;
      expect(title?.musicResourceId).toBe(STARTER_TITLE_BGM_ID);
      expect(BGM_STARTER_TRACK_IDS).toContain(title?.musicResourceId);
      expect(defaultTitleScreenSettings().musicResourceId).toBeUndefined();
    });

    it("스타터 곡 파일이 public/ 에 실제로 존재한다", () => {
      for (const id of BGM_STARTER_TRACK_IDS) {
        const path = localPathFor(id);
        expect(existsSync(resolve("public", path)), `${path} 없음`).toBe(true);
      }
    });

    it("스타터 곡은 카탈로그 소속이다", () => {
      for (const id of BGM_STARTER_TRACK_IDS) expect(isBgmCatalogResourceId(id)).toBe(true);
    });
  });
});

describe("eventCompileGraphic", () => {
  isolateTimers();
  function expectKnownBundledSprite(graphic: EventPageGraphic, knownIds: ReadonlySet<string>): string {
    expect(graphic.sprite?.type).toBe("bundled");
    const id = graphic.sprite?.id;
    expect(id).toBeDefined();
    if (id === undefined) return "";
    expect(knownIds.has(id)).toBe(true);
    return id;
  }
  describe("eventCompile graphic resolution", () => {
    it("resolves abbreviated textureKey input to a validator-known bundled charset id", () => {
      const knownIds = collectResourceIds(createBlankProject());

      const graphic = resolveGraphic({ textureKey: "people1", characterIndex: 0 });

      expect(expectKnownBundledSprite(graphic, knownIds)).toBe("tex_easyrpg_charset_people1");
    });

    // 2026-09-24 헤드리스 「등대지기의 겨울」: 리소스 id 표기를 textureKey 로 보낸 place_npc 가 거부됐다.
    it("resolves resource-id spelling (prefix/separators differ) to the one matching texture key", () => {
      const knownIds = collectResourceIds(createBlankProject());
      for (const textureKey of ["easyrpg-charset-people1", "EasyRPG_Charset_People1", "tex-easyrpg-charset-people1"]) {
        expect(expectKnownBundledSprite(resolveGraphic({ textureKey, characterIndex: 0 }), knownIds)).toBe("tex_easyrpg_charset_people1");
      }
    });

    it("resolves full charset search ids passed as textureKey and adopts their index when caller index is zero", () => {
      const knownIds = collectResourceIds(createBlankProject());

      const graphic = resolveGraphic({ textureKey: "charset:tex_easyrpg_charset_people1:7", characterIndex: 0 });

      expect(expectKnownBundledSprite(graphic, knownIds)).toBe("tex_easyrpg_charset_people1");
      expect(graphic.pattern).toBe(charsetFrameIndex({ characterIndex: 7, direction: "down", pattern: 1 }));
    });

    it("throws a tool-time graphic-not-found error with charset candidates for garbage texture keys", () => {
      try {
        resolveGraphic({ textureKey: "not-a-real-charset", characterIndex: 0 });
        expect.unreachable("garbage texture keys must fail before commit");
      } catch (error) {
        expect(error).toBeInstanceOf(ToolError);
        if (error instanceof ToolError) {
          expect(error.code).toBe("graphic-not-found");
          expect(error.message).toContain("tex_easyrpg_charset_");
          expect(error.message).toContain('list_resources(kind:"charset")');
          expect(error.message).toContain("{query}");
          return;
        }
        throw error;
      }
    });

    it("keeps graphic query resolution on validator-known bundled charset ids", () => {
      const knownIds = collectResourceIds(createBlankProject());

      const graphic = resolveGraphic({ query: "상인" });

      expect(knownIds.has(expectKnownBundledSprite(graphic, knownIds))).toBe(true);
    });
  });
  // 감사 로그 회귀(BUG A): place_npc가 축약 textureKey로도 커밋 게이트(직렬화 왕복/참조 검증)를 통과한다.
  // 이전에는 sprite.id가 "people1"로 남아 "graphic.sprite가 존재하지 않습니다"로 커밋 거부됐다.
  describe("place_npc 그래픽 커밋 회귀(BUG A)", () => {
    function withMap() {
      const ctx = { project: createBlankProject() };
      const created = runTool(ctx, "create_map", { id: "m_npc", name: "NPC 테스트", width: 8, height: 8 });
      expect(created.ok).toBe(true);
      return ctx;
    }

    it("축약 textureKey('people1')로도 place_npc가 커밋된다", () => {
      const ctx = withMap();
      const result = runTool(ctx, "place_npc", {
        mapId: "m_npc",
        x: 3,
        y: 3,
        name: "촌장",
        graphic: { textureKey: "people1", characterIndex: 0 },
        pages: [{ lines: ["안녕하세요."] }],
      });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    });

    it("전체 검색 id를 textureKey에 넣어도 place_npc가 커밋된다", () => {
      const ctx = withMap();
      const result = runTool(ctx, "place_npc", {
        mapId: "m_npc",
        x: 3,
        y: 3,
        name: "촌장",
        graphic: { textureKey: "charset:tex_easyrpg_charset_people1:7", characterIndex: 7 },
        pages: [{ lines: ["안녕."] }],
      });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    });
  });
});

describe("generatedAssetReferences", () => {
  isolateTimers();
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
  function record(value: unknown, label: string): Record<string, unknown> {
    if (isRecord(value)) return value;
    throw new Error(`${label} fixture was not an object`);
  }
  function array(value: unknown, label: string): unknown[] {
    if (Array.isArray(value)) return value;
    throw new Error(`${label} fixture was not an array`);
  }
  function firstRecord(value: unknown, label: string): Record<string, unknown> {
    return record(array(value, label)[0], `${label}[0]`);
  }
  function addGeneratedResources(project: Project, ids: readonly string[]): void {
    for (const id of ids) {
      project.assets.uploaded[id] = {
        id,
        name: id,
        kind: "picture",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        meta: { width: 32, height: 32 },
      };
    }
  }
  describe("generated item and equipment image resources", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("imports old database data when item and equipment image fields are absent", () => {
      // Given: a schema-v3 project shaped like older exports without item/equipment art fields.
      const rawProject: unknown = JSON.parse(serialize(createBlankProject()));
      const database = record(record(rawProject, "project").database, "database");
      const item = firstRecord(database.items, "database.items");
      const equipment = firstRecord(database.equipment, "database.equipment");
      delete item.imageResourceId;
      delete item.iconResourceId;
      delete equipment.imageResourceId;
      delete equipment.iconResourceId;

      // When: the project is imported through the real deserializer.
      const restored = deserialize(JSON.stringify(rawProject));

      // Then: the new fields are safely empty.
      expect(restored.database.items[0]?.imageResourceId).toBeUndefined();
      expect(restored.database.items[0]?.iconResourceId).toBeUndefined();
      expect(restored.database.equipment[0]?.imageResourceId).toBeUndefined();
      expect(restored.database.equipment[0]?.iconResourceId).toBeUndefined();
    });

    it("round-trips exported item and equipment image fields without overloading animation ids", () => {
      // Given: generated image/icon resources assigned to the default item and equipment.
      const resourceIds = ["gen_item_image", "gen_item_icon", "gen_equipment_image", "gen_equipment_icon"] as const;
      store.update((project) => addGeneratedResources(project, resourceIds));
      const project = store.getCurrent();
      const itemId = project.database.items[0]?.id ?? "";
      const equipmentId = project.database.equipment[0]?.id ?? "";
      const animationId = project.database.battleAnimations[0]?.id;

      updateDatabaseRecord("items", itemId, {
        imageResourceId: "gen_item_image",
        iconResourceId: "gen_item_icon",
        animationId,
      });
      updateDatabaseRecord("equipment", equipmentId, {
        imageResourceId: "gen_equipment_image",
        iconResourceId: "gen_equipment_icon",
      });

      // When: the project is exported and imported again.
      const restored = deserialize(serialize(store.getCurrent()));
      const item = restored.database.items.find((record) => record.id === itemId);
      const equipment = restored.database.equipment.find((record) => record.id === equipmentId);

      // Then: generated art fields survive separately from the battle animation reference.
      expect(item?.imageResourceId).toBe("gen_item_image");
      expect(item?.iconResourceId).toBe("gen_item_icon");
      expect(item?.animationId).toBe(animationId);
      expect(equipment?.imageResourceId).toBe("gen_equipment_image");
      expect(equipment?.iconResourceId).toBe("gen_equipment_icon");
    });

    it("duplicates item and equipment generated image fields", () => {
      // Given: standalone item and equipment records with generated image/icon ids.
      const resourceIds = ["dup_item_image", "dup_item_icon", "dup_equipment_image", "dup_equipment_icon"] as const;
      store.update((project) => addGeneratedResources(project, resourceIds));
      const itemId = store.getCurrent().database.items[0]?.id ?? "";
      const equipmentId = store.getCurrent().database.equipment[0]?.id ?? "";
      updateDatabaseRecord("items", itemId, { imageResourceId: "dup_item_image", iconResourceId: "dup_item_icon" });
      updateDatabaseRecord("equipment", equipmentId, {
        imageResourceId: "dup_equipment_image",
        iconResourceId: "dup_equipment_icon",
      });

      // When: the records are duplicated through database actions.
      const itemCopyId = duplicateDatabaseRecord("items", itemId);
      const equipmentCopyId = duplicateDatabaseRecord("equipment", equipmentId);

      // Then: the generated art references are preserved in the copied records.
      const restored = deserialize(serialize(store.getCurrent()));
      expect(restored.database.items.find((item) => item.id === itemCopyId)).toMatchObject({
        imageResourceId: "dup_item_image",
        iconResourceId: "dup_item_icon",
      });
      expect(restored.database.equipment.find((equipment) => equipment.id === equipmentCopyId)).toMatchObject({
        imageResourceId: "dup_equipment_image",
        iconResourceId: "dup_equipment_icon",
      });
    });

    it("normalizes malformed optional item and equipment resource ids to empty fields", () => {
      // Given: imported data with blank and non-string generated art ids.
      const rawProject: unknown = JSON.parse(serialize(createBlankProject()));
      const database = record(record(rawProject, "project").database, "database");
      const item = firstRecord(database.items, "database.items");
      const equipment = firstRecord(database.equipment, "database.equipment");
      item.imageResourceId = "   ";
      item.iconResourceId = 42;
      equipment.imageResourceId = "";
      equipment.iconResourceId = false;

      // When: the project is imported through the real deserializer.
      const restored = deserialize(JSON.stringify(rawProject));

      // Then: malformed optional ids do not survive as stale references.
      expect(restored.database.items[0]?.imageResourceId).toBeUndefined();
      expect(restored.database.items[0]?.iconResourceId).toBeUndefined();
      expect(restored.database.equipment[0]?.imageResourceId).toBeUndefined();
      expect(restored.database.equipment[0]?.iconResourceId).toBeUndefined();
    });

    it("rejects stale generated item and equipment resource references", () => {
      // Given: imported data with non-empty resource ids that do not exist in assets or profiles.
      const rawProject: unknown = JSON.parse(serialize(createBlankProject()));
      const database = record(record(rawProject, "project").database, "database");
      firstRecord(database.items, "database.items").imageResourceId = "missing_item_image";
      firstRecord(database.equipment, "database.equipment").iconResourceId = "missing_equipment_icon";

      // When/Then: project reference validation reports the stale generated resource id.
      expect(() => deserialize(JSON.stringify(rawProject))).toThrow(ProjectFormatError);
      expect(() => deserialize(JSON.stringify(rawProject))).toThrow(/missing_item_image|missing_equipment_icon/);
    });

    it("detects item and equipment image usage in resource reference checks", () => {
      // Given: generated item/equipment image resources assigned to records.
      const resourceIds = ["ref_item_image", "ref_equipment_icon"] as const;
      store.update((project) => addGeneratedResources(project, resourceIds));
      const itemId = store.getCurrent().database.items[0]?.id ?? "";
      const equipmentId = store.getCurrent().database.equipment[0]?.id ?? "";
      updateDatabaseRecord("items", itemId, { imageResourceId: "ref_item_image" });
      updateDatabaseRecord("equipment", equipmentId, { iconResourceId: "ref_equipment_icon" });

      // When/Then: resource reference checks block referenced generated art but not unrelated ids.
      expect(resourceReferenceMessage("ref_item_image")).toContain("아이템");
      expect(resourceReferenceMessage("ref_equipment_icon")).toContain("장비");
      expect(resourceReferenceMessage("unrelated_generated")).toBeNull();
    });

    it("imports default EasyRPG runtime package actor resources as known references", () => {
      const restored = deserialize(serialize(createBlankProject()));

      // 한 얼굴 = 한 파일: 기본 얼굴은 낱장 리소스 id(칸 0)다.
      expect(restored.database.actors[0]?.faceResourceId).toBe("easyrpg-faceset-actor1-00");
      expect(restored.database.actors[0]?.characterResourceId).toBe("easyrpg-charset-actor1");
    });

    it("resolves every sliced face id to its own file", () => {
      const unresolved = FACESET_FACE_ASSETS
        .filter((face) => resolveAssetResourceUrl(face.id) !== `/${face.path}`)
        .map((face) => `${face.id}:${resolveAssetResourceUrl(face.id)}`);
      const missingFiles = FACESET_FACE_ASSETS
        .filter((face) => !existsSync(path.join("public", face.path)))
        .map((face) => face.path);

      expect(unresolved).toEqual([]);
      expect(missingFiles).toEqual([]);
    });

    it("registers every sliced face id as a known project reference", () => {
      const knownIds = collectResourceIds(createBlankProject());
      const unregistered = FACESET_FACE_ASSETS.filter((face) => !knownIds.has(face.id)).map((face) => face.id);

      expect(unregistered).toEqual([]);
    });

    it("deserializes a project whose actor points at a sliced face", () => {
      const rawProject = record(JSON.parse(serialize(createBlankProject())), "project");
      const database = record(rawProject.database, "database");
      firstRecord(database.actors, "database.actors").faceResourceId = "easyrpg-faceset-people1-15";

      const restored = deserialize(JSON.stringify(rawProject));

      expect(restored.database.actors[0]?.faceResourceId).toBe("easyrpg-faceset-people1-15");
    });
  });
});

// 체육관 클리어 → 「배지 획득」 연출 레시피(2026-10-16). 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterBadgeCeremony", () => {
  isolateTimers();
  const kinds = (list: readonly Command[]): string[] => list.map((c) => c.kind);
  function leaderLists(project: Project, switchId: string): Command[][] {
    const found: Command[][] = [];
    const walk = (list: Command[]): void => {
      if (list.some((c) => c.kind === "setSwitch" && c.switchId === switchId && c.value !== false)) found.push(list);
      for (const c of list) for (const nested of nestedCommandLists(c)) walk(nested as Command[]);
    };
    for (const map of Object.values(project.maps)) for (const event of map.events) { walk(event.commands); for (const page of event.pages ?? []) walk(page.commands); }
    return found;
  }
  describe("badgeAwardCommands — 연출 명령 배열", () => {
    const base = { badgeName: "새잎 배지", badgeIndex: 1, badgeTotal: 8, type: "grass", fanfareResourceId: "mx_audio_victory" } as const;

    it("섬광 → 징글 → 배지가 떠오름 → 빛 → 문장 → 그림 치우기 순서이고 새 런타임 명령을 쓰지 않는다", () => {
      const list = badgeAwardCommands(base);
      expect(list[0]).toMatchObject({ kind: "m2Command", commandId: "m2-047-flash-screen" });
      expect(list.find((c) => c.kind === "playAudio" && c.channel === "me")).toMatchObject({ resourceId: "mx_audio_victory" });
      const pictures = list.filter((c) => c.kind === "showPicture");
      expect(pictures.some((c) => c.kind === "showPicture" && c.pictureId === BADGE_HALO_PICTURE_ID && c.blendMode === "add")).toBe(true);
      const rise = pictures.filter((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID);
      expect(rise.length).toBeGreaterThanOrEqual(2);
      expect(list.filter((c) => c.kind === "text").map((c) => (c.kind === "text" ? c.body : ""))).toEqual(["새잎 배지를 받았다!", "배지 케이스에 1/8번째 배지가 채워졌다."]);
      expect(kinds(list).slice(-2)).toEqual(["erasePicture", "erasePicture"]);
      for (const c of list) expect(["m2Command", "playAudio", "showPicture", "text", "erasePicture"]).toContain(c.kind);
    });

    it("받침 있는 이름은 「을」, 없는 이름은 「를」로 말한다", () => {
      const text = (name: string) => badgeAwardCommands({ badgeName: name }).filter((c) => c.kind === "text").map((c) => (c.kind === "text" ? c.body : ""))[0];
      expect(text("새잎 배지")).toBe("새잎 배지를 받았다!");
      expect(text("바위 훈장")).toBe("바위 훈장을 받았다!");
    });

    it("체육관 타입이 아이콘을 정하고, iconResourceId 가 타입보다 앞선다", () => {
      expect(badgeIconResourceId("water")).toBe("cc0-jetrel-gen-gem-sapphire");
      expect(badgeIconResourceId("nope")).toBe("cc0-jetrel-badge");
      const icon = (c: Command) => (c.kind === "showPicture" ? c.resourceId : undefined);
      expect(icon(badgeAwardCommands({ badgeName: "a", type: "fire" }).find((c) => c.kind === "showPicture")!)).toBe("cc0-jetrel-gen-gem-ruby");
      expect(icon(badgeAwardCommands({ badgeName: "a", type: "fire", iconResourceId: "cc0-jetrel-crystal" }).find((c) => c.kind === "showPicture")!)).toBe("cc0-jetrel-crystal");
    });

    it("그림은 화면 가운데 위쪽에 놓인다(해상도 따라)", () => {
      const medal = (screen: { width: number; height: number }) => badgeAwardCommands({ badgeName: "a", screen }).filter((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID).at(-1) as Extract<Command, { kind: "showPicture" }>;
      const wide = medal({ width: 480, height: 320 });
      expect(wide.x! + 64).toBe(240); // 400% × 32px = 128px 폭
      const small = medal({ width: 320, height: 240 });
      expect(small.x! + 64).toBe(160);
    });

    it("연출 구간을 찾는다(앞쪽 섬광·징글 포함, 마지막 그림 치우기까지)", () => {
      const ceremony = badgeAwardCommands(base);
      const list: Command[] = [{ kind: "setSwitch", switchId: "s", value: true }, ...ceremony, { kind: "wait" } as unknown as Command];
      expect(findBadgeCeremony(list)).toEqual({ start: 1, end: ceremony.length });
      expect(findBadgeCeremony([{ kind: "setSwitch", switchId: "s", value: true }])).toBeUndefined();
      expect(ceremony.filter(isBadgeCeremonyCommand).length).toBeGreaterThan(0);
    });
  });
  describe("build_monster_game 의 관장 승리 분기", () => {
    const { project } = createMonsterExpedition({ gymCount: 2 });
    const badges = project.system.monsterCampaign!.badges;

    it("모든 배지의 승리 분기에 연출이 스위치 켜기 바로 뒤에 들어 있다", () => {
      expect(badges.length).toBe(2);
      for (const badge of badges) {
        const lists = leaderLists(project, badge.switchId);
        expect(lists.length, badge.id).toBeGreaterThan(0);
        for (const list of lists) {
          const at = list.findIndex((c) => c.kind === "setSwitch" && c.switchId === badge.switchId && c.value !== false);
          expect(list.slice(at + 1).some((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID), badge.id).toBe(true);
        }
      }
    });

    it("캠페인 배지는 번들에 있는 아이콘을 가지고 저장·재로드해도 남는다", () => {
      const ids = collectResourceIds(project);
      for (const badge of badges) {
        expect(badge.iconResourceId).toBeTruthy();
        expect(ids.has(badge.iconResourceId!), badge.iconResourceId).toBe(true);
      }
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.monsterCampaign!.badges.map((b) => b.iconResourceId)).toEqual(badges.map((b) => b.iconResourceId));
    });

    it("배지 스위치 규칙: 배지 N 의 스위치는 mx_badge_N", () => {
      badges.forEach((badge, index) => expect(badge.switchId).toBe(`mx_badge_${index + 1}`));
    });
  });
  describe("installBadgeCeremonies / configure_monster_campaign {badgeCeremony}", () => {
    const fresh = (): Project => deserialize(serialize(createMonsterExpedition({ gymCount: 1 }).project));
    const ceremonyCount = (project: Project, switchId: string): number => leaderLists(project, switchId).reduce((n, list) => n + list.filter((c) => c.kind === "showPicture" && c.pictureId === BADGE_MEDAL_PICTURE_ID).length, 0);

    it("걷었다 다시 심으면 원래 모양이고(멱등), 두 번 심어도 겹치지 않는다", () => {
      const project = fresh();
      const switchId = project.system.monsterCampaign!.badges[0]!.switchId;
      const before = ceremonyCount(project, switchId);
      expect(before).toBeGreaterThan(0);
      expect(installBadgeCeremonies(project, { remove: true }).removed).toEqual(["badge_1"]);
      expect(ceremonyCount(project, switchId)).toBe(0);
      expect(installBadgeCeremonies(project).installed).toEqual(["badge_1"]);
      installBadgeCeremonies(project);
      expect(ceremonyCount(project, switchId)).toBe(before);
    });

    it("스위치를 켜는 이벤트가 없는 배지는 missing, 없는 badgeId 는 거부", () => {
      const project = fresh();
      project.system.monsterCampaign!.badges.push({ id: "badge_x", name: "빈 배지", switchId: "mx_badge_x", cityMapId: project.system.monsterCampaign!.badges[0]!.cityMapId });
      expect(installBadgeCeremonies(project).missing).toEqual(["badge_x"]);
      expect(() => installBadgeCeremonies(project, { badgeId: "nope" })).toThrow(/없는 배지 id/);
    });

    it("도구가 같은 일을 하고 요약에 결과를 적는다", () => {
      const project = fresh();
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true };
      const removed = runTool(ctx, "configure_monster_campaign", { badgeCeremony: { remove: true } }, { dryRun: false });
      expect(removed.ok, removed.summary).toBe(true);
      expect(removed.summary).toContain("걷음");
      const planted = runTool(ctx, "configure_monster_campaign", { badgeCeremony: { badgeId: "badge_1", line: "별빛이 손에 들어왔다!" } }, { dryRun: false });
      expect(planted.ok, planted.summary).toBe(true);
      const texts = leaderLists(ctx.project, "mx_badge_1").flatMap((l) => l.filter((c) => c.kind === "text").map((c) => (c.kind === "text" ? c.body : "")));
      expect(texts).toContain("별빛이 손에 들어왔다!");
    });

    it("definition.badges 의 없는 아이콘은 참조 검사에서 막힌다", () => {
      const project = fresh();
      project.system.monsterCampaign!.badges[0]!.iconResourceId = "no-such-icon";
      expect(() => deserialize(serialize(project))).toThrow();
    });
  });
});
