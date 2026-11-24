import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools";
import { ToolError, type ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { EventPageGraphic, Project, Command } from "@/project/types";
import { existsSync } from "node:fs";
import path from "node:path";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { resourceReferenceMessage } from "@/editor/databaseReferences";
import { updateDatabaseRecord, duplicateDatabaseRecord } from "@/editor/databaseActions";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { store } from "@/project/store";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { BADGE_HALO_PICTURE_ID, BADGE_MEDAL_PICTURE_ID, badgeAwardCommands, badgeIconResourceId, findBadgeCeremony, installBadgeCeremonies, isBadgeCeremonyCommand } from "@/project/monsterBadgeCeremony";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { BGM_STARTER_TRACK_IDS } from "@/assets/bgmStarterTracks";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { buildOpeningPresetSequence, openingPresetCoverResourceId, openingPresetDurationSeconds, OPENING_PRESETS, OPENING_PRESET_TITLE_FALLBACK, OPENING_PRESET_TITLE_TOKEN } from "@/editor/openingPresets";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { CINEMATIC_DURATION_MAX_MS, CINEMATIC_SCENE_LIMIT, normalizeCinematicSequence } from "@/project/cinematicSettings";
import * as modal from "@/editor/ui/modal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

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

describe("openingPresets", () => {
  isolateTimers();
  let restoreDom: () => void;
  let host: FakeElement;
  function node(id: string, root = host): FakeElement {
    const result = findByTestId(root, id);
    expect(result, `missing DOM control ${id}`).not.toBeNull();
    return result!;
  }
  function openTab(target: "opening" | "game-over"): void {
    node(`db-tab-${target}`).click();
  }
  function mount(): void {
    resetMapEditHistory();
    setDatabaseActiveTab("system");
    host = document.createElement("div") as unknown as FakeElement;
    document.body.append(host as unknown as Node);
    renderDatabasePanel(host as unknown as HTMLElement);
  }
  describe("opening preset catalogue", () => {
    // 등록되지 않은 리소스 id 는 그림만 비는 게 아니라 프로젝트 **역직렬화 자체를 실패**시킨다
    // (resourceReferenceValidation 의 validateOptionalResource 가 assert 로 던진다).
    it("only references resources a project can actually deserialize", () => {
      const known = collectResourceIds(createBlankProject());
      for (const preset of OPENING_PRESETS) {
        for (const scene of preset.scenes) {
          if (scene.resourceId) expect(known, `${preset.id}: ${scene.resourceId}`).toContain(scene.resourceId);
        }
        if (preset.musicResourceId) {
          expect(known, `${preset.id}: ${preset.musicResourceId}`).toContain(preset.musicResourceId);
          // CDN 미설정 환경에서도 소리가 나야 «눌렀더니 화려하다»가 성립한다.
          expect(BGM_STARTER_TRACK_IDS).toContain(preset.musicResourceId);
        }
      }
    });

    it("keeps every preset self-playing and within the authoring limits", () => {
      expect(OPENING_PRESETS.length).toBeGreaterThan(0);
      expect(new Set(OPENING_PRESETS.map(preset => preset.id)).size).toBe(OPENING_PRESETS.length);
      for (const preset of OPENING_PRESETS) {
        expect(preset.scenes.length).toBeGreaterThan(1);
        expect(preset.scenes.length).toBeLessThanOrEqual(CINEMATIC_SCENE_LIMIT);
        // 카드가 그림으로 팔리는 기능이다 — 대표 그림 없는 프리셋은 고를 근거가 없다.
        // 예외: 「편지로 시작하는 이야기」(written-prologue)는 그림 없는 명조 서문이 의도다 — 그런 프리셋은 장면마다 글자 연출(presentation.preset)을 가져야 한다.
        if (!openingPresetCoverResourceId(preset)) expect(preset.scenes.every(scene => scene.presentation?.preset)).toBe(true);
        expect(openingPresetDurationSeconds(preset)).toBeGreaterThan(0);
        for (const scene of preset.scenes) {
          // 0이면 키를 눌러야 넘어간다 — 프리셋은 가만히 둬도 흘러가야 한다.
          expect(scene.durationMs).toBeGreaterThan(0);
          expect(scene.durationMs).toBeLessThanOrEqual(CINEMATIC_DURATION_MAX_MS);
          if (scene.resourceId) expect(scene.motion).toBeTruthy();
        }
        expect(preset.scenes.some(scene => scene.narration.includes(OPENING_PRESET_TITLE_TOKEN))).toBe(true);
      }
    });

    it("builds an enabled sequence with the project title and fresh scene ids", () => {
      const preset = OPENING_PRESETS[0];
      const built = buildOpeningPresetSequence(preset, { title: "은빛 회랑" });

      expect(built.enabled).toBe(true);
      expect(built.skippable).toBe(true);
      expect(built.musicResourceId).toBe(preset.musicResourceId);
      expect(built.scenes).toHaveLength(preset.scenes.length);
      expect(built.scenes.some(scene => scene.narration.includes("은빛 회랑"))).toBe(true);
      expect(built.scenes.some(scene => scene.narration.includes(OPENING_PRESET_TITLE_TOKEN))).toBe(false);
      // 저장 경로가 다시 손대지 않는 모양이어야 한다(공백·빈 값 정리로 장면이 바뀌면 안 된다).
      expect(normalizeCinematicSequence(built)).toEqual(built);

      const again = buildOpeningPresetSequence(preset, { title: "은빛 회랑" });
      const ids = built.scenes.map(scene => scene.id);
      expect(again.scenes.map(scene => scene.id).some(id => ids.includes(id))).toBe(false);
    });

    it("falls back to a readable title card when the project has no title", () => {
      for (const title of [undefined, "", "   "]) {
        const built = buildOpeningPresetSequence(OPENING_PRESETS[0], { title });
        expect(built.scenes.some(scene => scene.narration.includes(OPENING_PRESET_TITLE_FALLBACK))).toBe(true);
      }
    });
  });
  describe("opening preset gallery in the Database editor", () => {
    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      project.meta.title = "달빛 서약";
      delete project.system.opening;
      store.replace(project);
      mount();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      restoreDom();
    });

    it("fills an empty opening from one click and undoes in one step", () => {
      // 그림 장면이 있는 프리셋으로 잰다 — 첫 프리셋(written-prologue)은 글자만 있는 서문이다.
      const preset = OPENING_PRESETS.find(entry => openingPresetCoverResourceId(entry))!;
      openTab("opening");
      node(`db-cinematic-preset-${preset.id}`).click();

      const opening = store.getCurrent().system.opening;
      expect(opening?.enabled).toBe(true);
      expect(opening?.musicResourceId).toBe(preset.musicResourceId);
      expect(opening?.scenes).toHaveLength(preset.scenes.length);
      expect(opening?.scenes.filter(scene => scene.kind === "image")).not.toHaveLength(0);
      expect(opening?.scenes.some(scene => scene.narration.includes("달빛 서약"))).toBe(true);

      // 장면마다 되돌리기가 쌓이면 실수로 누른 작성자가 네 번을 눌러야 한다.
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().system.opening).toBeUndefined();
    });

    it("asks before replacing authored scenes and leaves them alone on cancel", async () => {
      const [first, second] = OPENING_PRESETS;
      openTab("opening");
      node(`db-cinematic-preset-${first.id}`).click();
      const applied = store.getCurrent().system.opening;

      // 확인은 window.confirm 이 아니라 편집기 모달(showConfirm)이다 — 그 결정을 대신 내려 준다.
      const confirm = vi.spyOn(modal, "showConfirm").mockResolvedValue(false);
      node(`db-cinematic-preset-${second.id}`).click();
      await Promise.resolve(); await Promise.resolve();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(store.getCurrent().system.opening).toEqual(applied);

      confirm.mockResolvedValue(true);
      node(`db-cinematic-preset-${second.id}`).click();
      await vi.waitFor(() => expect(store.getCurrent().system.opening?.scenes).toHaveLength(second.scenes.length));
      expect(store.getCurrent().system.opening).not.toEqual(applied);
    });

    it("stays out of the game over tab, whose menu text is authored per project", () => {
      openTab("game-over");
      expect(findByTestId(host, "db-cinematic-preset-gallery")).toBeNull();
      openTab("opening");
      expect(findByTestId(host, "db-cinematic-preset-gallery")).not.toBeNull();
    });
  });
});
