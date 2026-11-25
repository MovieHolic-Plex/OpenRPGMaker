import { describe, expect, it } from "vitest";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { CHEST_OPEN_SE, LOOT_GOLD_SE, LOOT_ITEM_SE } from "@/editor/lootFeedback";
import { getTool, runTool } from "@/editor/tools";
import { resolveCc0IconAssetUrl } from "@/assets/cc0IconAssets";
import { createBlankProject } from "@/project/defaults";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import { charsetGraphicKey, jrpgHeroesCharsetHint, pickNpcGraphic, queryNpcGraphics, resolveNpcGraphic, withNpcGraphicCatalogFilter, unmatchedNpcGraphicTerms } from "@/assets/charsetQuery";
import pieces from "@/assets/desertEastPieces.json";
import { isPassable } from "@/project/collision";
import { composeDesertEast, composeDesertRoom, desertLookFor, desertPaletteFromTileset, type DesertKind, type DesertPieces, type DesertRoomKind } from "@/project/desertEastComposer";
import { kitVariants } from "@/project/kitLook";
import { tilesetSurface } from "@/project/tilesetSurface";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { cropGraphicIndexForStage, cropGraphicStages, normalizeCropRecord } from "@/project/farmModel";
import { isolateTimers } from "./mergedTeardown";

describe("placeChestSavepoint", () => {
  isolateTimers();
  // createBlankProject()가 기본 맵/타일셋/아이템 픽스처를 제공하는 기존 테스트 픽스처 패턴을 따른다
  // (place_npc 계열 테스트: test/placeNpcMalformedPage.test.ts)와 동일 소스.
  function projectWithMap(): { project: Project; mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    return { project, mapId };
  }
  describe("place_chest", () => {
    it("셀프스위치 2페이지 보물상자 이벤트를 만든다 (아이템+골드)", () => {
      const { project, mapId } = projectWithMap();
      const itemId = project.database.items[0]?.id ?? "item_potion";
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId, gold: 50 } });
      expect(result.summary).toContain("보물상자");
      const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
      expect(event.pages).toHaveLength(2);
      const closed = event.pages![0];
      expect(closed.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: false }]);
      const kinds = closed.commands.map((command) => command.kind);
      expect(kinds).toEqual([
        "playAudio",
        "setEventGraphicPattern",
        "wait",
        "setEventGraphicPattern",
        "wait",
        "playAudio",
        "changeItem",
        "wait",
        "playAudio",
        "changeGold",
        "text",
        "setSelfSwitch",
      ]);
      const audio = closed.commands.filter((command) => command.kind === "playAudio") as { resourceId: string }[];
      expect(audio.map((command) => command.resourceId)).toEqual([CHEST_OPEN_SE, LOOT_ITEM_SE, LOOT_GOLD_SE]);
      const frames = closed.commands.filter((command) => command.kind === "setEventGraphicPattern") as { eventId: string; pattern: number }[];
      expect(frames.every((command) => command.eventId === event.id)).toBe(true);
      expect(frames.map((command) => decodeCharsetFrameIndex(command.pattern).direction)).toEqual(["right", "up"]);
      const opened = event.pages![1];
      expect(opened.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
    });

    it("열림 페이지는 개방(up) 프레임을 그리고, 닫힘 페이지는 닫힘(down) 프레임을 그린다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { gold: 20 } });
      const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
      const [closed, opened] = event.pages!;
      expect(closed.graphic.direction).toBe("down");
      expect(opened.graphic.direction).toBe("up");
      expect(opened.graphic.sprite).toEqual(closed.graphic.sprite);
      expect(opened.graphic.pattern).not.toBe(closed.graphic.pattern);
      const closedFrame = decodeCharsetFrameIndex(closed.graphic.pattern as number);
      const openedFrame = decodeCharsetFrameIndex(opened.graphic.pattern as number);
      expect(openedFrame.characterIndex).toBe(closedFrame.characterIndex);
      expect(openedFrame.direction).toBe("up");
    });

    it("보상 텍스트는 아이템 id 가 아니라 데이터베이스 이름을 쓴다", () => {
      const { project, mapId } = projectWithMap();
      const item = project.database.items[0]!;
      expect(item.name.length).toBeGreaterThan(0);
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: item.id, gold: 50 } });
      const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
      const text = event.pages![0].commands.find((command) => command.kind === "text") as { body: string };
      expect(text.body).toContain(item.name);
      expect(text.body).not.toContain(item.id);
      expect(text.body).toContain("50G");
      expect(result.summary).toContain(item.name);
    });

    // 2026-11-14 폴른 스타 윤문: 「보물상자를 열었다! 불씨 병 · 60G를 손에 넣었다.」 — 얻은 것 알림은 과거형 한 줄, 조사는 받침을 본다.
    it("얻은 것 알림은 한 줄이고 조사를 받침에 맞춘다", () => {
      const bodyOf = (contents: Record<string, unknown>): string => {
        const { project, mapId } = projectWithMap();
        project.database.items.push({ ...project.database.items[0]!, id: "item_t_flask", name: "불씨 병" }, { ...project.database.items[0]!, id: "item_t_herb", name: "각성초" });
        const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents });
        const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
        return (event.pages![0].commands.find((command) => command.kind === "text") as { body: string }).body;
      };
      expect(bodyOf({ itemId: "item_t_flask", gold: 60 })).toBe("「불씨 병」과 60G를 얻었다.");
      expect(bodyOf({ itemId: "item_t_herb", gold: 120 })).toBe("「각성초」와 120G를 얻었다.");
      expect(bodyOf({ itemId: "item_t_flask" })).toBe("「불씨 병」을 얻었다.");
      expect(bodyOf({ itemId: "item_t_herb" })).toBe("「각성초」를 얻었다.");
      expect(bodyOf({ itemId: "item_t_herb", count: 2 })).toBe("「각성초」 2개를 얻었다.");
      expect(bodyOf({ gold: 150 })).toBe("150G를 얻었다.");
    });

    it("골드만 있으면 동전 SE → changeGold 만 지급한다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { gold: 20 } });
      const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
      const kinds = event.pages![0].commands.map((command) => command.kind);
      expect(kinds).toEqual([
        "playAudio",
        "setEventGraphicPattern",
        "wait",
        "setEventGraphicPattern",
        "wait",
        "playAudio",
        "changeGold",
        "text",
        "setSelfSwitch",
      ]);
      expect(kinds).not.toContain("changeItem");
    });

    it("contents가 비면 ToolError", () => {
      const { project, mapId } = projectWithMap();
      expect(() => getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: {} })).toThrow(/contents/);
    });

    it("DB에 없는 아이템이면 경고를 남긴다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: "item_없는것" } });
      expect(result.warnings?.some((warning) => warning.includes("item_없는것"))).toBe(true);
    });
  });
  // 2026-11-11 작은 일 재측정(pickup-key-built): 「바닥에 열쇠가 떨어져 있게」 를 조수는 draw_object(공방 카드 대기) + 투명 이벤트로 만들어 칸에 보이는 것이 없었다.
  describe("place_chest look:item — 바닥에 놓인 물건", () => {
    const eventOf = (project: Project, mapId: string, result: { data?: unknown }) =>
      project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;

    it("아이템 아이콘이 칸에 보이고, 주우면 한 번만 주고 그림과 막음이 사라진다", () => {
      const { project, mapId } = projectWithMap();
      const item = project.database.items.find((entry) => !!entry.iconResourceId && !!resolveCc0IconAssetUrl(entry.iconResourceId))!;
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: item.id }, look: "item" });
      expect(result.summary).toContain(item.name);
      expect(result.summary).not.toContain("보물상자");
      const [lying, taken] = eventOf(project, mapId, result).pages!;
      expect(lying.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: false }]);
      expect(lying.graphic).toEqual({ sprite: { type: "bundled", id: item.iconResourceId } });
      expect(lying.trigger).toEqual({ kind: "action" });
      expect(lying.commands.map((command) => command.kind)).toEqual(["playAudio", "changeItem", "text", "setSelfSwitch"]);
      expect(lying.commands.find((command) => command.kind === "changeItem")).toMatchObject({ itemId: item.id, op: "+=", amount: 1 });
      expect((lying.commands.find((command) => command.kind === "text") as { body: string }).body).toContain("주웠다");
      expect(taken.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
      expect(taken.graphic).toEqual({ transparent: true });
      expect(taken.priority).toBe("below");
      expect(taken.commands).toEqual([]);
    });

    it("돈만 놓으면 주머니 그림이다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { gold: 30 }, look: "item" });
      const [lying] = eventOf(project, mapId, result).pages!;
      expect(lying.graphic).toEqual({ sprite: { type: "bundled", id: "cc0-jetrel-coin-pouch" } });
      expect(lying.commands.map((command) => command.kind)).toEqual(["playAudio", "changeGold", "text", "setSelfSwitch"]);
    });

    it("아이콘이 없는 물건은 주머니 그림으로 놓고 그렇게 알린다", () => {
      const { project, mapId } = projectWithMap();
      const item = project.database.items[0]!;
      delete item.iconResourceId;
      delete item.imageResourceId;
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: item.id }, look: "item" });
      expect(eventOf(project, mapId, result).pages![0].graphic).toEqual({ sprite: { type: "bundled", id: "cc0-jetrel-coin-pouch" } });
      expect(result.warnings?.some((warning) => warning.includes("아이콘이 없어"))).toBe(true);
    });

    it("look 을 안 주면 보물상자 그대로다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { gold: 30 } });
      expect(result.summary).toContain("보물상자");
      expect(eventOf(project, mapId, result).pages![0].commands.some((command) => command.kind === "setEventGraphicPattern")).toBe(true);
    });
  });
  describe("place_savepoint", () => {
    it("checkpointSave 커맨드를 가진 이벤트를 만든다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_savepoint")!.run(project, { mapId, x: 2, y: 2 });
      const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
      const kinds = event.pages![0].commands.map((command) => command.kind);
      expect(kinds).toContain("checkpointSave");
    });
  });
  describe("place_storage_chest", () => {
    it("openChest 커맨드 1페이지 보관 상자 이벤트를 만든다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_storage_chest")!.run(project, { mapId, x: 4, y: 5, name: "창고" });
      expect(result.summary).toContain("보관 상자");
      const data = result.data as { eventId: string; chestId: string };
      const event = project.maps[mapId].events.find((entry) => entry.id === data.eventId)!;
      expect(event.pages).toHaveLength(1);
      expect(event.trigger).toEqual({ kind: "action" });
      const page = event.pages![0];
      expect(page.commands).toEqual([{ kind: "openChest", chestId: data.chestId, template: "farm", displayName: "창고" }]);
      expect(data.chestId).toBe(`storage_${data.eventId}`);
    });
    it("보물상자와 다른 그래픽을 쓴다 (보관함 식별)", () => {
      const { project, mapId } = projectWithMap();
      const itemId = project.database.items[0]?.id ?? "item_potion";
      const chest = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId } });
      const storage = getTool("place_storage_chest")!.run(project, { mapId, x: 5, y: 5, name: "창고" });
      const chestEvent = project.maps[mapId].events.find((entry) => entry.id === (chest.data as { eventId: string }).eventId)!;
      const storageEvent = project.maps[mapId].events.find((entry) => entry.id === (storage.data as { eventId: string }).eventId)!;
      const chestGraphic = chestEvent.pages![0].graphic;
      const storageGraphic = storageEvent.pages![0].graphic;
      // object2#7 은 광산 수레다(2026-11-07 화소 재대조) — 보관 상자는 빨간 상자(object1#6), 보물상자는 나무 상자(object1#7).
      expect(storageGraphic.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_object1" });
      expect(chestGraphic.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_object1" });
      expect(decodeCharsetFrameIndex(storageGraphic.pattern as number).characterIndex).toBe(6);
      expect(decodeCharsetFrameIndex(chestGraphic.pattern as number).characterIndex).not.toBe(6);
    });

    it("chestId를 지정하면 그대로 쓴다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_storage_chest")!.run(project, {
        mapId,
        x: 1,
        y: 1,
        id: "ev_box_home",
        chestId: "farm_main_chest",
      });
      const data = result.data as { eventId: string; chestId: string };
      expect(data.eventId).toBe("ev_box_home");
      expect(data.chestId).toBe("farm_main_chest");
      const event = project.maps[mapId].events.find((entry) => entry.id === data.eventId)!;
      expect(event.pages![0].commands[0]).toEqual({ kind: "openChest", chestId: "farm_main_chest", template: "farm" });
    });

    it("맵 밖이면 ToolError", () => {
      const { project, mapId } = projectWithMap();
      expect(() => getTool("place_storage_chest")!.run(project, { mapId, x: 999, y: 999 })).toThrow(/맵 밖/);
    });

    it("template·displayName 인자를 openChest에 싣는다", () => {
      const { project, mapId } = projectWithMap();
      const result = getTool("place_storage_chest")!.run(project, {
        mapId,
        x: 2,
        y: 2,
        name: "은행",
        template: "vault",
        displayName: "마을 금고",
      });
      const data = result.data as { eventId: string };
      const event = project.maps[mapId].events.find((entry) => entry.id === data.eventId)!;
      expect(event.pages![0].commands[0]).toEqual({
        kind: "openChest",
        chestId: `storage_${data.eventId}`,
        template: "vault",
        displayName: "마을 금고",
      });
    });
  });
});

describe("charsetQuery", () => {
  isolateTimers();
  describe("charsetQuery", () => {
    it("할머니 질의를 elder+female 엔트리로 해석한다", () => {
      const entry = resolveNpcGraphic("할머니");
      expect(entry?.gender).toBe("female");
      expect(entry?.age).toBe("elder");
    });

    it("old man 질의를 elder+male 엔트리로 해석한다", () => {
      const entry = resolveNpcGraphic("old man");
      expect(entry?.gender).toBe("male");
      expect(entry?.age).toBe("elder");
    });

    it("소녀 질의를 child+female 엔트리로 해석한다", () => {
      const entry = resolveNpcGraphic("소녀");
      expect(entry?.gender).toBe("female");
      expect(entry?.age).toBe("child");
    });

    it("기사 질의를 기사 태그 엔트리로 해석한다", () => {
      const entry = resolveNpcGraphic("기사");
      expect(entry?.tags).toContain("기사");
    });

    it("0점 질의는 null을 반환한다", () => {
      expect(resolveNpcGraphic("존재하지않는차셋질의xyz")).toBeNull();
    });

    it("generic villager with seed diversifies across top-K", () => {
      const a = pickNpcGraphic("villager", { seed: "map:Alice:1,1" });
      const b = pickNpcGraphic("villager", { seed: "map:Bob:2,2" });
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      // same seed is stable
      expect(pickNpcGraphic("villager", { seed: "map:Alice:1,1" })?.characterIndex).toBe(a?.characterIndex);
      expect(pickNpcGraphic("villager", { seed: "map:Alice:1,1" })?.textureKey).toBe(a?.textureKey);
    });

    it("avoidKeys skips already-used slots when alternatives exist", () => {
      const first = pickNpcGraphic("villager", { seed: "fixed" })!;
      const second = pickNpcGraphic("villager", {
        seed: "fixed",
        avoidKeys: new Set([charsetGraphicKey(first)]),
      })!;
      expect(charsetGraphicKey(second)).not.toBe(charsetGraphicKey(first));
    });

    it("specific role query keeps top match when not avoided", () => {
      const elder = pickNpcGraphic("할머니");
      expect(elder?.gender).toBe("female");
      expect(elder?.age).toBe("elder");
    });

    it("finds each golem and never a king, in Korean and English", () => {
      for (const query of ["골렘", "golem"]) {
        expect(queryNpcGraphics(query, 100).map(match => charsetGraphicKey(match.entry)).sort()).toEqual([
          "tex_easyrpg_charset_monster2#4", "tex_easyrpg_charset_monster4#5",
        ]);
      }
      expect(charsetGraphicKey(resolveNpcGraphic("king")!)).toBe("tex_easyrpg_charset_people3#0");
    });

    it("keeps literal hair and prop searches on the visually audited slots", () => {
      expect(charsetGraphicKey(resolveNpcGraphic("보라 머리 여성 마법사")!)).toBe("tex_easyrpg_charset_actor4#6");
      expect(charsetGraphicKey(resolveNpcGraphic("파란 머리 여성 마법사")!)).toBe("tex_easyrpg_charset_actor4#3");
      expect(queryNpcGraphics("흑발 여성 마법사", 100).some(match => match.entry.textureKey === "tex_easyrpg_charset_actor4")).toBe(false);
      expect(charsetGraphicKey(resolveNpcGraphic("나무 보물상자")!)).toBe("tex_easyrpg_charset_object1#7");
      // 나무 통 칩은 없다. 여러 낱말 질의에 모든 낱말이 맞는 칸이 없으면 검색은 가장 가까운 칸을 주되(#3522, J66 「하얀 드레스 여자 유령」)
      // 그 칸이 질의 전체를 가리키지 않는다는 것을 unmatchedNpcGraphicTerms 로 가른다 — 준 칸마다 「통」이 안 맞은 낱말로 남아야 한다.
      // 어느 칸이든 「통」까지 맞는 칸으로 나오면(라벨·꼬리표가 통을 말하면) 떨어진다.
      const barrel = queryNpcGraphics("나무 통", 100);
      expect(barrel.map(match => unmatchedNpcGraphicTerms("나무 통", match.entry))).toEqual(barrel.map(() => ["통"]));
      expect(barrel.map(match => match.entry.label).filter(label => /통/u.test(label))).toEqual([]);
      expect(queryNpcGraphics("금고", 100)).toEqual([]);
      expect(queryNpcGraphics("후드", 100).map(match => charsetGraphicKey(match.entry))).not.toContain("tex_easyrpg_charset_actor2#5");
      expect(queryNpcGraphics("날개", 100).map(match => charsetGraphicKey(match.entry))).not.toContain("tex_easyrpg_charset_people3#7");
    });

    it("includes Scarloxy residents and farm animals in their actual categories", () => {
      const people = queryNpcGraphics("people", 100).filter(match => match.entry.textureKey.startsWith("tex_scarloxy_"));
      expect(people).toHaveLength(10);
      expect(queryNpcGraphics("object", 100).some(match => match.entry.textureKey.startsWith("tex_scarloxy_"))).toBe(false);
      expect(queryNpcGraphics("animal", 100).filter(match => match.entry.textureKey.startsWith("tex_farming_")).map(match => match.entry.label).sort()).toEqual(["농장 닭", "농장 젖소"]);
    });
  });
  describe("CT·FF6풍 영웅 칩(Heroes1) 검색 — jrpg-real-1 J02", () => {
    it("hero·actor·주인공 같은 일반 질의가 Heroes1 을 RTP Actor 보다 앞에 보여 준다", () => {
      for (const query of ["hero", "actor", "주인공", "영웅"]) {
        const keys = queryNpcGraphics(query, 20).map((match) => match.entry.textureKey);
        expect(keys.slice(0, 8).every((key) => key === "tex_oprn_charset_heroes1"), query).toBe(true);
        expect(keys).toContain("tex_easyrpg_charset_actor1");
      }
    });
    it("heroes·heroes1 은 시트 전체 8칸을 돌려준다", () => {
      for (const query of ["heroes", "heroes1"]) {
        expect(queryNpcGraphics(query, 20).map((match) => charsetGraphicKey(match.entry))).toEqual(
          Array.from({ length: 8 }, (_, index) => `tex_oprn_charset_heroes1#${index}`),
        );
      }
    });
    it("장르 잠금이 영웅 칩을 가리면 안내도 없다", () => {
      expect(jrpgHeroesCharsetHint(undefined, "hero")).toContain("tex_oprn_charset_heroes1");
      expect(jrpgHeroesCharsetHint(undefined, "할머니")).toBeNull();
      const hint = withNpcGraphicCatalogFilter((entry) => !entry.textureKey.startsWith("tex_oprn_charset_heroes"), () => jrpgHeroesCharsetHint(undefined, "hero"));
      expect(hint).toBeNull();
    });
  });
});

// desert_east 첫 판 늘리기(2026-11-13): 같은 종류의 다른 그림(변형)·새 집·새 기물·게임마다 고르는 바닥 재질, 그리고 구성기가 그것을 게임 열쇠로 고르는 길.
// 지키는 것: ① 열쇠가 없으면 구성기 사전이 예전과 똑같은 칸을 준다(옛 그림이 기본) ② 변형은 원본 자리에 그대로 들어간다(칸 크기·채운 칸·칸마다 통행·층)
// ③ 열쇠가 다르면 그림이 갈리고 통행은 같다 ④ 열쇠가 있으면 방은 배치가 둘이고 둘 다 문에서 모든 바닥에 닿는다 ⑤ 새 종류는 열쇠가 있을 때 구성기가 실제로 놓는다
// ⑥ 이어 붙는 벽면 가족은 한 게임에서 같은 순번이다(ai.lookWith).
describe("desertEastVariety", () => {
  isolateTimers();
  const blank = createBlankProject() as Project;
  const ts = blank.tilesets.desert_east as TilesetDef;
  const kits = ts.structureKits as StructureKitDef[];
  const P = pieces as unknown as DesertPieces;
  const GAMES = Array.from({ length: 12 }, (_, n) => JSON.stringify(["project", `desert-variety-${n}`]));
  const tilesOf = (kit: StructureKitDef, x: number, y: number) => [kit.rows[y]!.tiles[x] ?? -1, kit.rows[y]!.upperTiles?.[x] ?? -1] as const;
  const walk = (t: number) => t < 0 || !!ts.passability[t]?.up;
  describe("desert_east 변형 키트", () => {
    const variants = kits.filter((k) => k.ai?.variantOf);
    it("변형이 여럿 구워졌고 원본마다 kitVariants 가 그대로 받는다(칸 크기·채운 칸)", () => {
      expect(variants.length).toBeGreaterThanOrEqual(60);
      for (const v of variants) expect(kitVariants(ts, v.ai!.variantOf!).map((k) => k.id), v.id).toContain(v.id);
    });
    it("변형의 칸마다 통행·층이 원본과 같다(갈아 끼워도 걷는 칸·가리는 칸이 그대로)", () => {
      for (const v of variants) {
        const base = kits.find((k) => k.id === v.ai!.variantOf)!;
        for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
          const [bl, bu] = tilesOf(base, x, y), [vl, vu] = tilesOf(v, x, y);
          expect([vl >= 0, vu >= 0], `${v.id} (${x},${y}) 층`).toEqual([bl >= 0, bu >= 0]);
          expect(walk(vl) && walk(vu), `${v.id} (${x},${y}) 통행`).toBe(walk(bl) && walk(bu));
          if (bu >= 0) expect(ts.priority[vu], `${v.id} (${x},${y}) 위층 그리기`).toBe(ts.priority[bu]);
        }
        const door = (k: StructureKitDef) => JSON.stringify((k.parts ?? []).filter((p) => p.kind === "entrance").map((p) => [p.dx, p.dy, p.w]));
        expect(door(v), `${v.id} 문 칸`).toBe(door(base));
      }
    });
  });
  describe("desert_east 구성기 사전 — 게임 열쇠", () => {
    it("열쇠가 없으면 원본 키트와 원래 바닥 칸 그대로", () => {
      const pal = desertPaletteFromTileset(ts, P, undefined);
      for (const k of kits) expect(pal.kit(k.id)!.rows, k.id).toBe(k.rows);
      for (const [piece, t] of Object.entries(P.tiles)) expect(pal.tile(piece), piece).toBe(t);
      for (const [set, row] of Object.entries(P.wang)) row.forEach((t, i) => expect(pal.wang(set, i), `${set}#${i}`).toBe(t));
      expect(desertLookFor(P, undefined)).toEqual({});
    });
    it("열쇠가 있으면 원본 id 로 물은 키트가 그 게임의 그림이고(크기 같음) 게임마다 갈린다", () => {
      const base = kits.find((k) => k.id === "de-well")!;
      const seen = new Set<string>();
      for (const key of GAMES) {
        const got = desertPaletteFromTileset(ts, P, key).kit("de-well")!;
        expect([got.id, got.width, got.height]).toEqual([base.id, base.width, base.height]);
        seen.add(JSON.stringify(got.rows));
      }
      expect(seen.size).toBeGreaterThanOrEqual(2);
    });
    it("바닥 재질: 갈래마다 고른 재질의 한 칸 바닥·왕 타일을 주고, 모든 칸은 걸을 수 있는 아래층 바닥이다", () => {
      expect(P.looks, "겉모습 표").toBeTruthy();
      const looks = new Set<string>();
      for (const key of GAMES) {
        const look = desertLookFor(P, key);
        looks.add(JSON.stringify(look));
        const pal = desertPaletteFromTileset(ts, P, key);
        for (const piece of ["de-sand", "de-sand-b", "de-sand-ripple", "de-road", "de-road-b", "de-flag", "de-flag-b"]) {
          const t = pal.tile(piece);
          expect(t, piece).toBeGreaterThanOrEqual(0);
          expect(ts.passability[t]!.up && ts.priority[t] === "lower", `${piece} → ${t}`).toBe(true);
        }
        for (const set of ["road", "grass", "dune", "flag", "water"]) for (let i = 0; i < 16; i++) {
          const t = pal.wang(set, i), old = P.wang[set]![i]!;
          expect(t, `${set}#${i}`).toBeGreaterThanOrEqual(0);
          expect(!!ts.passability[t]!.up, `${set}#${i} 통행`).toBe(!!ts.passability[old]!.up);
        }
        if (!look.ground && !look.road && !look.plaza) expect(pal.tile("de-sand")).toBe(P.tiles["de-sand"]);
        if (look.ground) expect(pal.tile("de-sand")).not.toBe(P.tiles["de-sand"]);
      }
      expect(looks.size).toBeGreaterThanOrEqual(4);
    });
  });
  describe("desert_east 재질 칸 — 원래 칸의 길 판정을 물려받는다", () => {
    it("재질을 바꿔도 길 칸은 길로, 길이 아닌 칸은 길이 아닌 것으로 읽힌다(tilesetSurface)", () => {
      const road = tilesetSurface(ts).road;
      let roads = 0;
      for (const [name, table] of Object.entries(P.looks!.tiles)) for (const [piece, cell] of Object.entries(table)) {
        expect(road.has(cell), `${name} ${piece}`).toBe(road.has(P.tiles[piece]!));
        if (road.has(cell)) roads += 1;
      }
      for (const [set, sets] of Object.entries(P.looks!.wang)) for (const [name, cells] of Object.entries(sets)) cells.forEach((cell, i) => {
        expect(road.has(cell), `${set} ${name} #${i}`).toBe(road.has(P.wang[set]![i]!));
        if (road.has(cell)) roads += 1;
      });
      expect(roads).toBeGreaterThan(50);
    });
  });
  describe("desert_east 구성 — 같은 씨앗, 다른 게임", () => {
    const compose = (kind: DesertKind, key: string | undefined) => composeDesertEast({ width: 56, height: 44, kind, seed: 3 }, desertPaletteFromTileset(ts, P, key));
    const NEW_KINDS = ["de-notice-board", "de-house-wide-5", "de-house-hut-2", "de-barrel", "de-barrels"];
    it("같은 씨앗이면 게임이 달라도 건물·소품 자리와 걷는 칸은 같고 그림만 다르다", () => {
      const pass = (r: { lower: number[]; upper: number[] }) => r.lower.map((lo, i) => (walk(lo) && walk(r.upper[i]!) ? 1 : 0)).join("");
      for (const kind of ["oasis", "bazaar"] as const) {
        const a = compose(kind, GAMES[1]), b = compose(kind, GAMES[2]);
        expect(JSON.stringify(a.props), kind).toBe(JSON.stringify(b.props));
        expect(JSON.stringify(a.buildings.map((d) => [d.kit, d.rect, d.doors]))).toBe(JSON.stringify(b.buildings.map((d) => [d.kit, d.rect, d.doors])));
        expect(pass(a), `${kind} 통행`).toBe(pass(b));
        expect(a.upper.join(",") === b.upper.join(",") && a.lower.join(",") === b.lower.join(","), `${kind}: 두 게임의 그림이 같다`).toBe(false);
      }
    });
    it("열쇠가 없으면 구성기가 새 종류를 스스로 섞지 않는다(옛 구성 그대로) — 열쇠가 있으면 통·게시판·새 집 둘을 실제로 놓는다", () => {
      const placed = (key: (seed: number) => string | undefined) => {
        const ids = new Set<string>();
        for (const kind of ["oasis", "bazaar", "caravanserai"] as const) for (let seed = 1; seed <= 8; seed++) {
          const r = composeDesertEast({ width: 56, height: 44, kind, seed }, desertPaletteFromTileset(ts, P, key(seed)));
          for (const p of r.props) ids.add(p.kit);
          for (const d of r.buildings) ids.add(d.kit);
        }
        return ids;
      };
      const plain = placed(() => undefined);
      for (const id of NEW_KINDS) expect(plain.has(id), `열쇠 없음: ${id}`).toBe(false);
      const keyed = placed((seed) => GAMES[seed]);
      for (const id of ["de-notice-board", "de-house-wide-5", "de-house-hut-2"]) expect(keyed.has(id), id).toBe(true);
      expect(keyed.has("de-barrel") || keyed.has("de-barrels"), "통").toBe(true);
    });
    it("도구로 지은 맵: 열쇠가 있어도 시작 칸에서 모든 문 접근칸에 닿는다(도구가 엔진 통행으로 다시 본다)", () => {
      for (const key of GAMES.slice(0, 4)) {
        const ctx = { project: structuredClone(blank), currentMapId: "m", assistantRun: true, lookKey: key };
        expect(runTool(ctx, "create_map", { id: "m", name: "사막", width: 56, height: 44, tilesetId: "desert_east" }).ok).toBe(true);
        const r = runTool(ctx, "compose_desert_east_map", { mapId: "m", kind: "bazaar", seed: 2 });
        expect(r.ok, String((r as { error?: string }).error)).toBe(true);
        const map = ctx.project.maps.m!;
        expect(isPassable(ctx.project, map, ctx.project.startPos.x, ctx.project.startPos.y)).toBe(true);
      }
    }, 60_000);
  });
  describe("desert_east 방 — 배치 둘", () => {
    const SIZE: Record<DesertRoomKind, [number, number]> = { teahouse: [16, 12], shop: [14, 10], palace_hall: [20, 14], tomb: [15, 16], hammam: [14, 11], inn: [16, 11] };
    const ALT_ONLY = ["de-barrel", "de-barrels"];
    it("열쇠가 있으면 방 종류마다 씨앗에 따라 가구 자리가 두 가지 이상이다", () => {
      const pal = desertPaletteFromTileset(ts, P, GAMES[0]);
      for (const kind of Object.keys(SIZE) as DesertRoomKind[]) {
        const layouts = new Set<string>();
        for (let seed = 1; seed <= 10; seed++) {
          const r = composeDesertRoom({ width: SIZE[kind][0], height: SIZE[kind][1], kind, seed }, pal);
          layouts.add(JSON.stringify(r.props.map((p) => [p.kit, p.x, p.y])));
          expect(r.doors.length, `${kind} 문`).toBeGreaterThan(0);
        }
        expect(layouts.size, `${kind} 배치 가짓수`).toBeGreaterThanOrEqual(2);
      }
    });
    it("열쇠가 없으면 둘째 배치를 쓰지 않는다(통이 놓이지 않는다) · 찻집은 16×12·24×16 에서도 짜인다(막는 가구를 걷어 낸다)", () => {
      const pal = desertPaletteFromTileset(ts, P, undefined);
      for (const kind of Object.keys(SIZE) as DesertRoomKind[]) for (let seed = 1; seed <= 6; seed++) {
        const r = composeDesertRoom({ width: SIZE[kind][0], height: SIZE[kind][1], kind, seed }, pal);
        for (const p of r.props) expect(ALT_ONLY.includes(p.kit), `${kind} 씨앗 ${seed}: ${p.kit}`).toBe(false);
      }
      for (const [w, h] of [[16, 12], [20, 14], [24, 16]] as const) for (let seed = 1; seed <= 4; seed++) {
        for (const key of [undefined, GAMES[seed]]) expect(() => composeDesertRoom({ width: w, height: h, kind: "teahouse", seed }, desertPaletteFromTileset(ts, P, key)), `찻집 ${w}×${h} 씨앗 ${seed}`).not.toThrow();
      }
    });
  });
  describe("desert_east 벽면 가족 — 함께 바뀐다(ai.lookWith)", () => {
    it("창 난 벽·벽감 벽의 변형은 벽면 원본을 가리키고, 어느 게임에서나 벽면과 같은 순번의 그림이다", () => {
      const rowsOf = (id: string) => JSON.stringify(kits.find((k) => k.id === id)!.rows);
      for (const [accent, wall] of [["de-wall-window-plaster", "de-wall-plaster"], ["de-wall-niche-stone", "de-wall-stone"]] as const) {
        const av = kitVariants(ts, accent), wv = kitVariants(ts, wall);
        expect(av.length, accent).toBe(wv.length);
        expect(av.length).toBeGreaterThan(0);
        for (const v of av) expect(v.ai?.lookWith, v.id).toBe(wall);
        const picks = new Set<string>();
        for (const key of GAMES) {
          const pal = desertPaletteFromTileset(ts, P, key);
          const a = [rowsOf(accent), ...av.map((k) => JSON.stringify(k.rows))].indexOf(JSON.stringify(pal.kit(accent)!.rows));
          const w = [rowsOf(wall), ...wv.map((k) => JSON.stringify(k.rows))].indexOf(JSON.stringify(pal.kit(wall)!.rows));
          expect(a, `${accent} @ ${key}`).toBe(w);
          picks.add(String(w));
        }
        expect(picks.size, `${wall}: 열두 게임이 두 그림으로 갈린다`).toBe(2);
      }
    });
  });
});

describe("farmingSprites", () => {
  isolateTimers();
  type BinaryFsReader = {
    readonly readFileSync: (path: URL) => Uint8Array;
  };
  const loadBinaryFs = async (): Promise<BinaryFsReader> => {
    const moduleName = "node:fs";
    return (await import(moduleName)) as BinaryFsReader;
  };
  const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const CROP_SHEETS = [
    { file: "crop_potato.png", width: 32, height: 16 },
    { file: "crop_strawberry.png", width: 32, height: 16 },
    { file: "crop_tomato.png", width: 48, height: 16 },
    { file: "crop_corn.png", width: 48, height: 16 },
    { file: "crop_blueberry.png", width: 32, height: 16 },
    { file: "crop_melon.png", width: 48, height: 16 },
    { file: "crop_pumpkin.png", width: 48, height: 16 },
    { file: "crop_eggplant.png", width: 32, height: 16 },
  ] as const;
  const ANIMAL_SHEETS = [
    { file: "chicken.png", width: 288, height: 256 },
    { file: "cow.png", width: 288, height: 256 },
  ] as const;
  describe("farming crop sprite sheets", () => {
    for (const sheet of CROP_SHEETS) {
      it(`ships a valid ${sheet.width}x${sheet.height} RGBA PNG for ${sheet.file}`, async () => {
        const fs = await loadBinaryFs();
        const bytes = fs.readFileSync(new URL(`../public/assets/farming/crops/${sheet.file}`, import.meta.url));

        expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
        expect(readUint32BE(bytes, 16)).toBe(sheet.width);
        expect(readUint32BE(bytes, 20)).toBe(sheet.height);
        expect(bytes[24]).toBe(8);
        expect(bytes[25]).toBe(6);
        expect(hasChunk(bytes, "IDAT")).toBe(true);
      });
    }
  });
  describe("registered farming crop sprite assets", () => {
    it("registers one asset per shipped sheet with a frameCount matching the sheet width", () => {
      expect(FARMING_CROP_SPRITE_ASSETS).toHaveLength(CROP_SHEETS.length);
      const sheetByFile = new Map<string, { readonly width: number; readonly height: number }>(
        CROP_SHEETS.map((sheet) => [sheet.file, sheet]),
      );
      for (const asset of FARMING_CROP_SPRITE_ASSETS) {
        const sheet = sheetByFile.get(asset.path.split("/").pop() ?? "");
        expect(sheet, asset.id).toBeDefined();
        expect(asset.frameCount, asset.id).toBe((sheet?.width ?? 0) / asset.frameWidth);
        expect(asset.frameHeight).toBe(sheet?.height);
      }
    });
  });
  describe("farming animal charsets", () => {
    for (const sheet of ANIMAL_SHEETS) {
      it(`ships a valid ${sheet.width}x${sheet.height} RM2K3 charset PNG for ${sheet.file}`, async () => {
        const fs = await loadBinaryFs();
        const bytes = fs.readFileSync(new URL(`../public/assets/farming/animals/${sheet.file}`, import.meta.url));

        expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
        expect(readUint32BE(bytes, 16)).toBe(sheet.width);
        expect(readUint32BE(bytes, 20)).toBe(sheet.height);
        expect(bytes[24]).toBe(8);
        expect(bytes[25]).toBe(6);
        expect(hasChunk(bytes, "IDAT")).toBe(true);
      });
    }
  });
  describe("farming demo crop graphics wiring", () => {
    it("derives graphic stages for an unauthored crop at read time, clamping frames to the sheet", () => {
      // 저작 graphicStages 없이 id 만으로 스프라이트가 붙어야 한다(감자 시트 = 2 프레임).
      const crop = normalizeCropRecord({
        id: "crop_potato",
        name: "감자",
        harvestItemId: "item_potato",
        stages: [{ days: 1 }, { days: 1 }, { days: 1 }],
      });
      const stages = cropGraphicStages(crop);
      expect(stages.length).toBe(crop.stages.length);
      expect(stages.map((stage) => stage.frame)).toEqual([0, 1, 1]);
      for (const stage of stages) expect(stage.resourceId).toBe("farming-crop-potato");

      // 등록된 스프라이트가 없는 작물은 아무 stage 도 만들지 않는다.
      const unknown = normalizeCropRecord({ id: "crop_durian", name: "두리안", stages: [{ days: 1 }] });
      expect(cropGraphicStages(unknown)).toEqual([]);
    });

    it("never writes derived graphic stages into the record, and honors an empty authored list as opt-out", () => {
      // 저작하지 않은 아트가 레코드에 심기면 직렬화가 그것을 프로젝트에 새기고 작가는 되돌릴 수 없다.
      const inferred = normalizeCropRecord({ id: "crop_melon", name: "수박", stages: [{ days: 1 }, { days: 1 }] });
      expect(inferred.graphicStages).toBeUndefined();
      expect(JSON.parse(JSON.stringify(inferred))).not.toHaveProperty("graphicStages");
      // 그래도 화면에는 등록 스프라이트가 붙는다.
      expect(cropGraphicStages(inferred).map((stage) => stage.resourceId)).toEqual([
        "farming-crop-melon",
        "farming-crop-melon",
      ]);

      // 번 배열은 "아트 없음" 선언이다 — 자동 배선이 다시 끊어들면 opt-out 이 불가능해진다.
      const optedOut = normalizeCropRecord({
        id: "crop_melon",
        name: "수박",
        stages: [{ days: 1 }],
        graphicStages: [],
      });
      expect(optedOut.graphicStages).toEqual([]);
      expect(cropGraphicStages(optedOut)).toEqual([]);
    });
  });
  describe("cropGraphicIndexForStage", () => {
    // 마지막 그림은 수확 가능 전용이다. 예약하지 않으면 익기 전 마지막 단계와 수확기가
    // 같은 그림이 되어 플레이어가 익은 것을 구별할 수 없다.
    it("reserves the last graphic for the ready stage when graphics match growth stages", () => {
      // 감자: 성장 단계 2 · 그림 2
      expect(cropGraphicIndexForStage(2, 2, 0)).toBe(0);
      expect(cropGraphicIndexForStage(2, 2, 1)).toBe(0);
      expect(cropGraphicIndexForStage(2, 2, 2)).toBe(1); // 수확 가능
      expect(cropGraphicIndexForStage(2, 2, 9)).toBe(1); // 단계가 넘쳐도 수확기 그림
    });

    it("maps stages straight through when the author supplied a ready frame", () => {
      // 그림 3 · 단계 2 — 중간 단계에 자기 그림이 있는 배선은 그대로 존중한다.
      expect(cropGraphicIndexForStage(3, 2, 0)).toBe(0);
      expect(cropGraphicIndexForStage(3, 2, 1)).toBe(1);
      expect(cropGraphicIndexForStage(3, 2, 2)).toBe(2);
    });

    it("uses the only graphic when there is nothing to reserve", () => {
      expect(cropGraphicIndexForStage(1, 3, 0)).toBe(0);
      expect(cropGraphicIndexForStage(1, 3, 3)).toBe(0);
    });

    it("reports no graphic when the crop has none", () => {
      expect(cropGraphicIndexForStage(0, 2, 1)).toBe(-1);
    });

    it("treats a negative or fractional stage as the first growing stage", () => {
      expect(cropGraphicIndexForStage(3, 3, -2)).toBe(0);
      expect(cropGraphicIndexForStage(3, 3, 1.9)).toBe(1);
    });
  });
  function hasChunk(bytes: Uint8Array, type: string): boolean {
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= bytes.length) {
      const length = readUint32BE(bytes, offset);
      const chunkType = ascii(bytes, offset + 4, offset + 8);
      if (chunkType === type) return true;
      offset += length + 12;
    }
    return false;
  }
  function readUint32BE(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] ?? 0) * 0x1000000) + (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0));
  }
  function ascii(bytes: Uint8Array, start: number, end: number): string {
    return String.fromCharCode(...bytes.slice(start, end));
  }
});
