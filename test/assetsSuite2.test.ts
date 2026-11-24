import { describe, expect, it, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { CC0_AUDIO_ASSETS, CC0_MUSIC_ASSETS, isBrowserPlayableAudioPath, resolveCc0AudioAssetUrl } from "@/assets/cc0AudioAssets";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { queryNpcGraphics, resolveNpcGraphic, charsetGraphicKey, jrpgHeroesCharsetHint, pickNpcGraphic, withNpcGraphicCatalogFilter, unmatchedNpcGraphicTerms } from "@/assets/charsetQuery";
import { searchResources } from "@/assets/resourceSearch";
import { CHARSET_SEMANTICS, applyCharsetLabelOverrides, findCharsetSemantic, upsertCharsetLabelOverride } from "@/assets/charsetSemantics";
import { createBlankProject } from "@/project/defaults";
import type { CharsetLabelOverride, Project, StructureKitDef, TilesetDef } from "@/project/types";
import { applyTransparentColorKeys } from "@/assets/transparentColorKey";
import pieces from "@/assets/desertEastPieces.json";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { composeDesertEast, composeDesertRoom, desertLookFor, desertPaletteFromTileset, type DesertKind, type DesertPieces, type DesertRoomKind } from "@/project/desertEastComposer";
import { kitVariants } from "@/project/kitLook";
import { tilesetSurface } from "@/project/tilesetSurface";
import { findSharedPortrait } from "@/assets/sharedPortraitAssets";
import { deserialize } from "@/project/io";
import { build } from "vite";
import { battlerIdleAnimation, battlerIdleAnimationUrl } from "@/assets/battlerIdleAnimations";
import { battlerHiresSheet, battlerHiresSheetUrl } from "@/assets/battlerHiresSheets";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";
import spriteFiles from "@/assets/battleTrainerSpriteFiles.json";
import { collectWebExportAssets, trainerSpriteImagePaths } from "@/project/webExportAssets";
import { requiredRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import path from "node:path";
import { AUTHORABLE_FACESET_FACE_ASSETS, FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS, LEGACY_FACESET_SHEET_IDS, faceIdForSheetCell } from "@/assets/facesetFaceAssets";
import { faceCellSuffix, planFacesetSheetSplit } from "@/assets/facesetSheetSlicing";
import type Phaser from "phaser";
import { PNG } from "pngjs";
import { registerTilesetTextureFrames } from "@/assets/bundled";
import { chipsetBandRects, chipsetNeedsBands, tileFrameOrigin } from "@/assets/chipsetTextureBands";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { cropGraphicIndexForStage, cropGraphicStages, normalizeCropRecord } from "@/project/farmModel";
import { detectBackgroundKey, keyOutBackground } from "@/assets/generatedArtworkAlpha";
import { buildContactSheetMetadata, buildDryRunPathPlan, buildLiveAgyCommand, buildPromotionMetadata, createFakeGeneratedAsset, validateGeneratedAssetBytes } from "@/assets/generatedAssetHarness";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { createFakePngBytes } from "@/assets/pngFake";
import { validateGeneratedAssetManifest, type GeneratedAssetManifestInput } from "@/assets/generatedAssetManifest";
import { isolateTimers } from "./mergedTeardown";

// CC0 BGM 자산 가드 — 등록만 하고 파일이 없으면 게임은 조용히 무음이 된다(재생 실패는 콘솔 경고뿐).
// 그래서 "등록 ↔ 실제 파일" 을 테스트로 묶는다.
describe("cc0BgmAssets", () => {
  isolateTimers();
  // mapBgm 배선이 가리키는 장면별 곡 — 하나라도 사라지면 그 장면이 무음이 된다.
  const SCENE_BGM_IDS = [
    "cc0-bgm-field",
    "cc0-bgm-town",
    "cc0-bgm-inn",
    "cc0-bgm-dungeon",
    "cc0-bgm-battle",
  ] as const;
  describe("CC0 오디오 자산", () => {
    it("등록된 모든 파일이 public/ 아래에 실제로 존재한다", () => {
      const missing = CC0_AUDIO_ASSETS.filter((asset) => !existsSync(resolve("public", asset.path)));
      expect(missing.map((a) => a.path)).toEqual([]);
    });

    it("모든 경로가 브라우저에서 재생 가능한 컨테이너다", () => {
      const bad = CC0_AUDIO_ASSETS.filter((asset) => !isBrowserPlayableAudioPath(asset.path));
      expect(bad.map((a) => a.path)).toEqual([]);
    });

    it("장면별 BGM 5종이 모두 등록돼 있고 URL 로 해석된다", () => {
      for (const id of SCENE_BGM_IDS) {
        expect(resolveCc0AudioAssetUrl(id), `${id} 미등록`).toMatch(/^\/assets\/cc0\/audio\//);
      }
    });

    it("장면별 BGM 은 music kind 여야 한다 — sound 면 resolveAudioSource 가 BGM 채널로 안 보낸다", () => {
      const musicIds = new Set(CC0_MUSIC_ASSETS.map((asset) => asset.id));
      expect(SCENE_BGM_IDS.filter((id) => !musicIds.has(id))).toEqual([]);
    });

    it("모든 자산이 CC0 이며 출처가 비어 있지 않다", () => {
      for (const asset of CC0_AUDIO_ASSETS) {
        expect(asset.license).toBe("CC0-1.0");
        expect(asset.sourceName.trim().length).toBeGreaterThan(0);
      }
    });

    it("id 가 중복되지 않는다", () => {
      const ids = CC0_AUDIO_ASSETS.map((asset) => asset.id);
      expect(ids.length).toBe(new Set(ids).size);
    });
  });
});

describe("charsetLabelOverrides", () => {
  isolateTimers();
  const ACTOR4_0 = { textureKey: "tex_easyrpg_charset_actor4", characterIndex: 0 };
  const CHIEF: CharsetLabelOverride = {
    textureKey: ACTOR4_0.textureKey,
    characterIndex: ACTOR4_0.characterIndex,
    label: "우리 마을 촌장",
    tags: ["촌장", "노인"],
    origin: "user",
  };
  describe("charset label overrides", () => {
    it("번들 라벨이 기본값으로 그대로 나온다", () => {
      const base = CHARSET_SEMANTICS.find(
        (entry) =>
          entry.textureKey === ACTOR4_0.textureKey &&
          entry.characterIndex === ACTOR4_0.characterIndex,
      );
      expect(base?.label).toBe("파란 머리 청년");
      expect(findCharsetSemantic(ACTOR4_0.textureKey, ACTOR4_0.characterIndex)?.label).toBe(
        "파란 머리 청년",
      );
    });

    it("사용자 오버라이드가 라벨·태그를 덮어쓴다", () => {
      const applied = applyCharsetLabelOverrides(CHARSET_SEMANTICS, [CHIEF]);
      const hit = applied.find(
        (entry) =>
          entry.textureKey === ACTOR4_0.textureKey &&
          entry.characterIndex === ACTOR4_0.characterIndex,
      );
      expect(hit?.label).toBe("우리 마을 촌장");
      expect(hit?.tags).toContain("촌장");
      expect(hit?.gender).toBe(
        findCharsetSemantic(ACTOR4_0.textureKey, ACTOR4_0.characterIndex)?.gender,
      );
    });

    it("없는 슬롯·빈 라벨 오버라이드는 무시된다", () => {
      const applied = applyCharsetLabelOverrides(CHARSET_SEMANTICS, [
        { textureKey: "tex_nope", characterIndex: 0, label: "유령", origin: "user" },
        { textureKey: ACTOR4_0.textureKey, characterIndex: 0, label: "   ", origin: "user" },
      ]);
      expect(applied).toHaveLength(CHARSET_SEMANTICS.length);
      expect(findCharsetSemantic(ACTOR4_0.textureKey, ACTOR4_0.characterIndex)?.label).toBe(
        "파란 머리 청년",
      );
    });

    it("upsert 는 같은 슬롯을 덮어쓰고 빈 라벨이면 지운다", () => {
      const once = upsertCharsetLabelOverride([], CHIEF);
      expect(once).toHaveLength(1);
      const twice = upsertCharsetLabelOverride(once, { ...CHIEF, label: "새 촌장" });
      expect(twice).toHaveLength(1);
      expect(twice[0]?.label).toBe("새 촌장");
      expect(upsertCharsetLabelOverride(twice, { ...CHIEF, label: "  " })).toEqual([]);
    });

    it("queryNpcGraphics 가 가르친 이름으로 그 칸을 찾는다", () => {
      const match = resolveNpcGraphic("우리 마을 촌장", [CHIEF]);
      expect(match?.textureKey).toBe(ACTOR4_0.textureKey);
      expect(match?.characterIndex).toBe(ACTOR4_0.characterIndex);
      expect(queryNpcGraphics("촌장", 8, [CHIEF])[0]?.entry.label).toBe("우리 마을 촌장");
    });

    it("list_resources charset 검색이 가르친 라벨을 탄다", () => {
      const results = searchResources("charset", "우리 마을 촌장", { charsetLabels: [CHIEF] });
      expect(results[0]?.id).toBe(`charset:${ACTOR4_0.textureKey}:${ACTOR4_0.characterIndex}`);
    });

    it("animal#7 은 사자다", () => {
      expect(findCharsetSemantic("tex_easyrpg_charset_animal", 7)?.label).toBe("사자");
      expect(resolveNpcGraphic("사자")?.textureKey).toBe("tex_easyrpg_charset_animal");
      expect(resolveNpcGraphic("사자")?.characterIndex).toBe(7);
      expect(searchResources("charset", "사자")[0]?.id).toBe("charset:tex_easyrpg_charset_animal:7");
    });

    it("시스템 프롬프트에 가르친 캐릭터 칩이 실린다", () => {
      const project = createBlankProject();
      project.charsetLabels = [CHIEF];
      const prompt = buildSystemPrompt(project, { currentMapId: project.startMapId });
      expect(prompt).toContain("캐릭터 칩 지식");
      expect(prompt).toContain("우리 마을 촌장");
      expect(prompt).toContain(`${ACTOR4_0.textureKey}#${ACTOR4_0.characterIndex}`);
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

describe("chipsetTransparency", () => {
  isolateTimers();
  describe("chipset transparency", () => {
    it("makes only the EasyRPG interior object background transparent", () => {
      const pixels = new Uint8ClampedArray([
        60, 143, 75, 255,
        255, 103, 139, 255,
        0, 0, 0, 255,
        255, 103, 139, 128,
      ]);

      applyTransparentColorKeys(pixels, [{ r: 255, g: 103, b: 139 }]);

      expect(Array.from(pixels.slice(0, 4))).toEqual([60, 143, 75, 255]);
      expect(Array.from(pixels.slice(4, 8))).toEqual([255, 103, 139, 0]);
      expect(Array.from(pixels.slice(8, 12))).toEqual([0, 0, 0, 255]);
      expect(Array.from(pixels.slice(12, 16))).toEqual([255, 103, 139, 0]);
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

describe("dialoguePortraitDiscovery", () => {
  isolateTimers();
  describe("dialogue portrait discovery and authoring", () => {
    it("exposes bust and full portraits in the first browse page", () => {
      const result = runTool({ project: createBlankProject() }, "list_resources", { kind: "faceset", query: "*" });
      expect(result.ok, result.summary).toBe(true);
      const matches = (result.data as { matches: { id: string }[] }).matches;
      expect(matches.some(match => findSharedPortrait(match.id)?.mode === "bust")).toBe(true);
      expect(matches.some(match => findSharedPortrait(match.id)?.mode === "full")).toBe(true);
    });

    it("keeps dialogue and quest branches when only an existing villager's portrait changes", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const create = runTool(ctx, "make_villager", {
        mapId, id: "qa_portrait_villager", name: "수련생", home: { x: 3, y: 3 },
        graphic: { textureKey: "tex_easyrpg_charset_actor1", characterIndex: 0 },
        pages: [{ lines: ["수련을 시작하겠습니다."], commands: [{ kind: "choices", options: [
          { text: "계속", branch: [{ kind: "text", speaker: "수련생", body: "다음 수련입니다." }] },
          { text: "쉬기", branch: [] },
        ], cancelBehavior: "branch", cancelBranch: [] }] }],
      });
      expect(create.ok, create.summary).toBe(true);
      const event = () => ctx.project.maps[mapId]!.events.find(event => event.id === "qa_portrait_villager")!;
      const withoutFace = () => event().pages!.map(page => ({ ...page, commands: page.commands.filter(command => command.kind !== "changeFace") }));
      const before = structuredClone(withoutFace());
      const resourceId = "shared-brown-headband-expressions-bust-base";
      const update = runTool(ctx, "make_villager", { mapId, id: event().id, name: event().name, home: { x: 3, y: 3 }, face: { resourceId } });
      expect(update.ok, update.summary).toBe(true);
      expect(withoutFace()).toEqual(before);
      const reloaded = deserialize(JSON.stringify(ctx.project));
      expect(reloaded.maps[mapId]!.events.find(event => event.id === "qa_portrait_villager")!.pages![0]!.commands[0])
        .toMatchObject({ kind: "changeFace", resourceId });
    });
  });
});

describe("exportBattleAssetUrls", () => {
  isolateTimers();
  afterEach(() => {
    registerExportAssetBase(null);
    registerInlineAssets(null);
  });
  describe("export battle asset URLs", () => {
    it.each([
      ["nested", "https://games.example.test/games/demo/assets/generated/starter/hires/hero-01-battle.png"],
      ["embedded", "data:image/png;base64,AQ=="],
    ])("resolves high resolution sheets for %s exports", (kind, expected) => {
      // Given
      registerExportAssetBase(new URL("https://games.example.test/games/demo/"));
      // 번들 스타터 고해상도 시트는 2026-10-03 에 빠졌다(BATTLER_HIRES_SHEETS = []) — URL 해석 계약은 같은 모양의 시트 항목으로 본다.
      expect(battlerHiresSheet("generated-actor-hero-01-battle")).toBeUndefined();
      const sheet = { resourceId: "generated-actor-hero-01-battle", path: "assets/generated/starter/hires/hero-01-battle.png", cellWidth: 192, cellHeight: 192 };
      if (kind === "embedded") registerInlineAssets({ [sheet.path]: "data:image/png;base64,AQ==" });

      // When
      const url = battlerHiresSheetUrl(sheet);

      // Then
      expect(url).toBe(expected);
    });

    it("resolves the actual idle producer against the exported directory", () => {
      // Given
      registerExportAssetBase(new URL("https://games.example.test/games/demo/"));
      const animation = battlerIdleAnimation("generated-actor-hero-01-back");
      if (!animation) throw new Error("Expected authored idle animation");

      // When
      const url = battlerIdleAnimationUrl(animation);

      // Then
      expect(url).toBe("https://games.example.test/games/demo/assets/generated/battle-skins/sprites/idle/hero-01-back.png");
    });

    it("resolves the actual idle producer from the HTML asset table", () => {
      // Given
      const animation = battlerIdleAnimation("generated-actor-hero-01-back");
      if (!animation) throw new Error("Expected authored idle animation");
      registerInlineAssets({ [animation.path]: "data:image/png;base64,AQ==" });

      // When
      const url = battlerIdleAnimationUrl(animation);

      // Then
      expect(url).toBe("data:image/png;base64,AQ==");
    });

    // (은퇴) 「HUD 아이콘 URL 을 Vite 로 굽는다」 — 스타터 battle-icon-* 그림과 그 url() 이 2026-10-03 스타터 자산 정리로 빠졌다.

    it("builds runtime fonts and fallback window skin without root-only URLs", async () => {
      // Given
      // 글꼴은 fonts.css(편집기가 런타임 시트 없이 즉시 싣는다), 기본 윈도스킨은 system.css 가 소유한다.
      const input = [resolve("src/styles/runtime/fonts.css"), resolve("src/styles/runtime/system.css")];

      // When
      const built = await build({
        configFile: false, publicDir: false, base: "./", logLevel: "silent",
        build: { write: false, assetsInlineLimit: 0, rollupOptions: { input } },
      });
      const output = Array.isArray(built) ? built[0] : built;
      if (!output || !("output" in output)) throw new Error("Expected completed CSS build");
      const cssFiles = output.output.filter((file) => file.type === "asset" && file.fileName.endsWith(".css"));
      if (cssFiles.length === 0) throw new Error("CSS artifact missing");
      const text = cssFiles
        .map((css) => (css.type !== "asset" ? "" : typeof css.source === "string" ? css.source : new TextDecoder().decode(css.source)))
        .join("\n");

      // Then
      expect([...text.matchAll(/url\(["']?(\/assets\/[^"')]+)["']?\)/g)]).toEqual([]);
      // 2026-10-07 정리로 Neo둥근모가 빠지고 갈무리 셋(9·11·11 Bold)만 남았다(fonts.css).
      expect(output.output.filter((file) => file.fileName.endsWith(".woff2"))).toHaveLength(3);
    });
  });
});

// QA-AH119-001: the runtime builds /assets/battle-trainers/<role>/<file>.png from troop.trainerSprite
// (battleAssetPrefetch.ts:69, emeraldTrainerIntro.ts:40), so those paths never appear in project strings the
// dependency collector walks. The Astra 1.19 bundle shipped an empty battle-trainers folder and every trainer
// battle sprite 404'd. The collector must ship every committed file for a referenced role.
describe("exportBattleTrainerSprites", () => {
  isolateTimers();
  const PUBLIC_ROOT = join(process.cwd(), "public");
  const files = spriteFiles as Readonly<Record<string, readonly string[]>>;
  function projectWithTrainerSprite(sprite: { front: string; back?: string; throw?: string; backThrow?: string }) {
    const project = createBlankProject();
    project.database.troops = project.database.troops.map((troop, index) =>
      index === 0 ? { ...troop, trainerBattle: true, trainerSprite: sprite } : troop);
    return project;
  }
  describe("trainer battle sprite export dependencies", () => {
    it("ships both the front and back role files for a trainer troop", () => {
      // Given a monster-collect troop that shows a trainer in battle
      const project = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero" });

      // When the release dependency list is collected
      const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

      // Then the runtime-composed sprite URLs are all present
      expect(exported).toContain("assets/battle-trainers/astra_naru/front.png");
      expect(exported).toContain("assets/battle-trainers/astra_hero/back.png");
    });

    it("ships the throw sheet and orb of the throwing hero", () => {
      // Given the protagonist's back sprite carries a throw sheet and an orb cut-out
      const project = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero", backThrow: "astra_hero" });

      // When exported
      const exported = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

      // Then every file the capture cinematic can ask for is in the bundle
      expect(exported).toContain("assets/battle-trainers/astra_hero/throw.png");
      expect(exported).toContain("assets/battle-trainers/astra_hero/orb.png");
      expect(exported).toContain("assets/battle-trainers/astra_hero/back.png");
    });

    it("only lists files that exist on disk", () => {
      // Given the generated manifest
      // When comparing each entry against public/
      // Then no export path points at a missing file (a missing source would fail the whole export)
      const referenced = projectWithTrainerSprite({ front: "astra_naru", back: "astra_hero", backThrow: "astra_hero" });
      const paths = trainerSpriteImagePaths(referenced);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.filter((path) => !existsSync(join(PUBLIC_ROOT, path)))).toEqual([]);
    });

    it("keeps the manifest in sync with public/assets/battle-trainers", async () => {
      // Given the sprite folders on disk
      const { readSpriteFiles } = await import("../scripts/content/sync-battle-trainer-sprite-files.mjs");
      // Then the committed manifest matches exactly (regenerate with the script when art is added)
      expect(readSpriteFiles(join(PUBLIC_ROOT, "assets/battle-trainers"))).toEqual(files);
    });

    it("adds no battle-trainers paths for a project with no trainer sprite", () => {
      // Given a project whose troops are ordinary monster encounters
      const project = createBlankProject();
      project.database.troops = project.database.troops.map((troop) => ({ ...troop, trainerSprite: undefined }));

      // When exported
      const declared = requiredRuntimeAssetPaths(project);
      const paths = collectWebExportAssets(project).map((asset) => asset.zipPath).filter((path) => path.startsWith("assets/battle-trainers/"));

      // Then the sprite collector adds nothing: only the always-shipped default roles that src/player/runtimeAssets.json
      // declares (since 15f8ce5de1, the player prefetches them) are present, and no troop-derived path is.
      expect(trainerSpriteImagePaths(project)).toEqual([]);
      expect(paths.filter((path) => !declared.has(path))).toEqual([]);
    });

    it("ignores a role with no committed art instead of emitting a broken path", () => {
      // Given a troop naming a role that has no folder under public/assets/battle-trainers
      const project = projectWithTrainerSprite({ front: "role_that_does_not_exist" });

      // When the paths are collected
      const paths = trainerSpriteImagePaths(project);

      // Then no path is invented
      expect(paths).toEqual([]);
    });

    it("does not treat an Object.prototype name as a role", () => {
      // Given a role id that is a valid identifier but also an inherited property name
      const project = projectWithTrainerSprite({ front: "constructor", back: "toString" });

      // When the paths are collected
      // Then the export neither throws nor invents a path
      expect(trainerSpriteImagePaths(project)).toEqual([]);
    });

    it("lets an uploaded picture shadow a bundled role id", () => {
      // Given a project upload that reuses the bundled role id astra_naru
      const project = projectWithTrainerSprite({ front: "astra_naru" });
      project.assets.uploaded.astra_naru = { id: "astra_naru", name: "astra_naru.png", kind: "image", path: "uploaded/astra_naru.png" } as never;

      // When the paths are collected
      // Then the bundled folder is not shipped (the upload owns the id)
      expect(trainerSpriteImagePaths(project)).toEqual([]);
    });
  });
});

describe("facesetFaceAssets", () => {
  isolateTimers();
  describe("얼굴 낱장 에셋 목록", () => {
    it("84장의 시트를 16칸씩 쪼갠 1344개 낱장을 등록한다", () => {
      expect(LEGACY_FACESET_SHEET_IDS).toHaveLength(84);
      expect(FACESET_FACE_ASSETS).toHaveLength(1344);

      const ids = new Set(FACESET_FACE_ASSETS.map((face) => face.id));
      expect(ids.size).toBe(1344);
      for (const sheetId of LEGACY_FACESET_SHEET_IDS) {
        expect(FACESET_FACE_ASSETS.filter((face) => face.sheetResourceId === sheetId)).toHaveLength(16);
      }
      expect(FACESET_FACE_ASSETS.map((face) => face.sheetIndex)).toEqual(
        LEGACY_FACESET_SHEET_IDS.flatMap(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
      );
    });

    it("생성 시리즈 낱장을 저작 목록에 등록하지 않는다", () => {
      // 생성 시리즈(generated-faceset-missing-*)는 카탈로그에는 있지만 저작 목록에서는 뺀다.
      expect(GENERATED_FACESET_FACE_IDS.size).toBeGreaterThan(0);
      for (const id of GENERATED_FACESET_FACE_IDS) {
        expect(id.startsWith("generated-faceset-missing-")).toBe(true);
      }
      expect(AUTHORABLE_FACESET_FACE_ASSETS).toHaveLength(1344 - GENERATED_FACESET_FACE_IDS.size);
      for (const face of AUTHORABLE_FACESET_FACE_ASSETS) {
        expect(GENERATED_FACESET_FACE_IDS.has(face.id)).toBe(false);
      }
    });

    it("시트 id + 칸 번호를 낱장 id 로 바꾼다", () => {
      expect(faceIdForSheetCell("easyrpg-faceset-actor1", 7)).toBe("easyrpg-faceset-actor1-07");
      expect(faceIdForSheetCell("easyrpg-faceset-people1", 15)).toBe("easyrpg-faceset-people1-15");
      expect(faceIdForSheetCell("generated-actor-hero-01-face", 7)).toBe("generated-actor-hero-01-face");
    });

    it("칸 번호가 없거나 범위를 벗어나면 0..15 로 가둔다", () => {
      expect(faceIdForSheetCell("easyrpg-faceset-actor1", 99)).toBe("easyrpg-faceset-actor1-15");
      expect(faceIdForSheetCell("easyrpg-faceset-actor1", -1)).toBe("easyrpg-faceset-actor1-00");
      expect(faceIdForSheetCell("easyrpg-faceset-actor1", undefined)).toBe("easyrpg-faceset-actor1-00");
      expect(faceIdForSheetCell("easyrpg-faceset-actor1", Number.NaN)).toBe("easyrpg-faceset-actor1-00");
      expect(faceIdForSheetCell("easyrpg-faceset-actor1", Number.POSITIVE_INFINITY)).toBe("easyrpg-faceset-actor1-00");
      expect(faceIdForSheetCell("easyrpg-faceset-actor1", 7.9)).toBe("easyrpg-faceset-actor1-07");
    });

    it("시트가 아닌 id 는 그대로 돌려준다", () => {
      expect(faceIdForSheetCell("easyrpg-faceset-actor1-07", 3)).toBe("easyrpg-faceset-actor1-07");
      expect(faceIdForSheetCell("generated-face-actor1-bust", 3)).toBe("generated-face-actor1-bust");
      expect(faceIdForSheetCell("", 3)).toBe("");
    });

    it("등록된 낱장 파일이 모두 디스크에 있다", () => {
      const missing = FACESET_FACE_ASSETS
        .filter((face) => !existsSync(path.join("public", face.path)))
        .map((face) => `${face.id}:${face.path}`);

      expect(missing).toEqual([]);
    });

    it("낱장 이름은 시트 이름과 1-based 칸 번호를 담는다", () => {
      const actor1 = FACESET_FACE_ASSETS.find((face) => face.id === "easyrpg-faceset-actor1-07");
      expect(actor1).toMatchObject({
        name: "Actor1 얼굴 8 · EasyRPG",
        path: "assets/easyrpg/faceset/Actor1/07.png",
        sheetResourceId: "easyrpg-faceset-actor1",
        sheetIndex: 7,
      });

      const hero = FACESET_FACE_ASSETS.find((face) => face.id === "generated-actor-hero-01-face-00");
      expect(hero).toBeUndefined();
    });
  });
  // A surviving UI alone is not a complete import: all common character sets must
  // resolve to sixteen physical assets and retain their stable resource ids.
  describe("복구된 공용 표정", () => {
    it("76캐릭터의 1216표정을 중복 없이 제공한다", async () => {
      const { FACE_EXPRESSION_SETS } = await import("@/assets/faceExpressionSets");
      expect(FACE_EXPRESSION_SETS).toHaveLength(76);
      const allFaces = FACE_EXPRESSION_SETS.flatMap(set => [...set.faces]);
      expect(allFaces).toHaveLength(1216);
      expect(new Set(allFaces.map(face => face.id)).size).toBe(1216);
      for (const set of FACE_EXPRESSION_SETS) {
        expect(set.faces).toHaveLength(16);
        expect(set.faces.every(face => face.sheetResourceId === set.id)).toBe(true);
      }
      for (const stem of ["monster-white-dragon", "monster-hood-skeleton", "monster-beast", "monster-red-helm"]) {
        expect(FACE_EXPRESSION_SETS.some(set => set.id === `shared-${stem}-expressions`)).toBe(true);
      }
    });
  });
});

describe("facesetSheetSlicing", () => {
  isolateTimers();
  describe("planFacesetSheetSplit", () => {
    it("192×192 시트는 48px 낱장 16장으로 나눌 계획을 낸다", () => {
      expect(planFacesetSheetSplit(192, 192)).toEqual({ columns: 4, rows: 4, count: 16, cellSize: 48 });
    });

    it("96×96 시트는 4장으로 나눈다", () => {
      expect(planFacesetSheetSplit(96, 96)).toEqual({ columns: 2, rows: 2, count: 4, cellSize: 48 });
    });

    it("이미 낱장인 48×48 은 나눌 것이 없다", () => {
      expect(planFacesetSheetSplit(48, 48)).toBeNull();
    });

    it("비정사각 낱장 아트는 나누지 않는다", () => {
      expect(planFacesetSheetSplit(48, 96)).toBeNull();
      expect(planFacesetSheetSplit(240, 48)).toBeNull();
    });

    it("48 배수가 아닌 정사각형은 시트가 아니다", () => {
      expect(planFacesetSheetSplit(200, 200)).toBeNull();
    });

    it("유효하지 않은 크기는 나누지 않는다", () => {
      expect(planFacesetSheetSplit(Number.NaN, 192)).toBeNull();
      expect(planFacesetSheetSplit(0, 0)).toBeNull();
    });

    it("칸 번호는 파일 이름 규약대로 두 자리다", () => {
      expect(faceCellSuffix(0)).toBe("00");
      expect(faceCellSuffix(7)).toBe("07");
      expect(faceCellSuffix(15)).toBe("15");
    });
  });
});

describe("fallenStarTownTiles", () => {
  isolateTimers();
  const TILE = 16;
  const PER_ROW = 128;
  type FrozenTown = {
    map: {
      id: string;
      name: string;
      width: number;
      height: number;
      tilesetId: string;
      lowerTiles: number[];
      upperTiles: number[];
    };
    tilesets: Record<string, { baseCount: number; count: number }>;
  };
  /** frozenTowns.ts `shiftTile` 과 같다. 기록 때보다 시트가 길어진 덧붙임 칸만 지금 꼬리로 옮긴다. */
  function shiftTile(tile: number, base: number, delta: number, shift: number): number {
    return tile >= base && tile < base + delta ? tile + shift : tile;
  }
  function tileBox(tile: number): { x: number; y: number } {
    return { x: (tile % PER_ROW) * TILE, y: Math.floor(tile / PER_ROW) * TILE };
  }
  function opaquePixels(png: PNG, tile: number): { count: number; r: number; g: number; b: number } {
    const { x, y } = tileBox(tile);
    let count = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let py = y; py < y + TILE; py += 1) {
      for (let px = x; px < x + TILE; px += 1) {
        const i = (py * png.width + px) * 4;
        if ((png.data[i + 3] ?? 0) <= 200) continue;
        count += 1;
        r += png.data[i] ?? 0;
        g += png.data[i + 1] ?? 0;
        b += png.data[i + 2] ?? 0;
      }
    }
    return count === 0 ? { count, r: 0, g: 0, b: 0 } : { count, r: r / count, g: g / count, b: b / count };
  }
  describe("폴른 스타 왕도 아스텔 tiles", () => {
    const sheet = JSON.parse(readFileSync("src/assets/beodeulCitySheet.json", "utf8")) as { count: number; tilesPerRow: number };
    const town = (JSON.parse(readFileSync("src/project/flagship/fallen/frozenTowns.json", "utf8")) as { towns: Record<string, FrozenTown> }).towns.fs_hub!;
    const append = town.tilesets.beodeul_city!;
    const delta = append.count - append.baseCount;
    const shift = sheet.count - append.baseCount;
    const png = PNG.sync.read(readFileSync("public/assets/beodeul-city/beodeul-city-chipset.png"));
    const pngTiles = Math.floor(png.height / TILE) * sheet.tilesPerRow;
    const lower = town.map.lowerTiles.map((tile) => shiftTile(tile, append.baseCount, delta, shift));
    const upper = town.map.upperTiles.map((tile) => shiftTile(tile, append.baseCount, delta, shift));

    it("points the frozen town at opaque pixels on the live Beodeul sheet", () => {
      expect(town.map).toMatchObject({ id: "fs_hub", name: "왕도 아스텔", width: 56, height: 44, tilesetId: "beodeul_city" });
      expect(sheet).toMatchObject({ count: 61312, tilesPerRow: PER_ROW });
      expect(png.width).toBe(2048);
      expect(png.height).toBeGreaterThan(2048);
      expect(pngTiles).toBe(sheet.count);
      expect(lower.filter((tile) => tile === 737).length).toBeGreaterThan(1000);

      const inSheet = (tile: number) => tile >= 0 && tile < sheet.count;
      for (const tile of new Set(lower.filter(inSheet))) {
        expect(opaquePixels(png, tile).count, `lower tile ${tile}`).toBeGreaterThan(0);
      }
      for (const tile of new Set(upper.filter(inSheet))) {
        expect(opaquePixels(png, tile).count, `upper tile ${tile}`).toBeGreaterThan(0);
      }
      const grass = opaquePixels(png, 737);
      expect(grass.count).toBe(TILE * TILE);
      expect(grass.g).toBeGreaterThan(grass.r);
      expect(grass.g).toBeGreaterThan(grass.b);
      expect(upper.some((tile) => tile >= sheet.count)).toBe(true);
      expect(lower.every((tile) => tile < 0 || tile < sheet.count)).toBe(true);
    });

    it("addresses town tiles on 2048px bands, including ground past the first band and the graft tail", () => {
      expect(chipsetNeedsBands(png.width, png.height)).toBe(true);
      const rects = chipsetBandRects(png.width, png.height);
      expect(rects).not.toBeNull();
      expect(rects!.every((rect) => rect.width <= 2048 && rect.height <= 2048 && rect.height % TILE === 0)).toBe(true);
      expect(rects!.reduce((sum, rect) => sum + rect.height, 0)).toBe(png.height);

      const pastFirstBand = lower.find((tile) => tile >= 0 && tileBox(tile).y >= 2048);
      expect(pastFirstBand).toBeTypeOf("number");
      const ground = tileFrameOrigin(pastFirstBand!, PER_ROW, TILE, rects!.length, 2048, 2048, 1);
      expect(ground.sourceIndex).toBeGreaterThanOrEqual(1);
      expect(ground.y).toBe(tileBox(pastFirstBand!).y - ground.sourceIndex * 2048);
      expect(ground.y + TILE).toBeLessThanOrEqual(rects![ground.sourceIndex]!.height);

      const graftTile = upper.find((tile) => tile >= sheet.count)!;
      const bakedTiles = sheet.count + delta;
      const bakedHeight = Math.ceil(bakedTiles / PER_ROW) * TILE;
      const baked = chipsetBandRects(2048, bakedHeight)!;
      const graft = tileFrameOrigin(graftTile, PER_ROW, TILE, baked.length, 2048, 2048, 1);
      expect(graft.sourceIndex).toBe(baked.length - 1);
      expect(graft.y + TILE).toBeLessThanOrEqual(baked[graft.sourceIndex]!.height);
      expect(tileFrameOrigin(pastFirstBand!, PER_ROW, TILE, 1, 2048, png.height, 1).sourceIndex).toBe(0);
    });

    it("registers a lazy frame on the band that holds the town tile", () => {
      const tile = lower.find((index) => index >= 0 && tileBox(index).y >= 2048)!;
      const frames: Record<string, { name: string }> = {};
      const added: unknown[][] = [];
      const texture = {
        key: "tex_probe",
        source: [
          { width: 2048, height: 2048 },
          { width: 2048, height: 2048 },
          { width: 2048, height: 2048 },
          { width: 2048, height: png.height - 6144 },
        ],
        __oprnBandCols: 1,
        frames,
        get(name?: string | number) { return frames[String(name)]; },
        has(name: string) { return frames[name] !== undefined; },
        add(name: string, sourceIndex: number, x: number, y: number, width: number, height: number) {
          added.push([name, sourceIndex, x, y, width, height]);
          frames[name] = { name };
          return frames[name];
        },
        getFrameNames() { return Object.keys(frames); },
      };
      const scene = {
        textures: { get: () => texture, exists: () => true },
        anims: { exists: () => false, create: () => undefined },
      } as unknown as Phaser.Scene;

      registerTilesetTextureFrames(scene, "tex_probe", Math.max(tile + 1, 4097), TILE, PER_ROW);
      texture.get(`tile_${tile}`);

      const origin = tileFrameOrigin(tile, PER_ROW, TILE, texture.source.length, 2048, 2048, 1);
      expect(added).toContainEqual([`tile_${tile}`, origin.sourceIndex, origin.x, origin.y, TILE, TILE]);
      expect(origin.sourceIndex).toBeGreaterThanOrEqual(1);
    });

    it("keeps a 48px tile on one side of the band boundary", () => {
      const tile = 48;
      const perRow = 16;
      const width = perRow * tile;
      const height = 48 * tile;
      const rects = chipsetBandRects(width, height, tile);
      expect(rects).not.toBeNull();
      expect(rects![0]).toMatchObject({ x: 0, y: 0, width, height: 42 * tile });
      expect(rects![1]?.y).toBe(42 * tile);
      const index = 42 * perRow;
      const origin = tileFrameOrigin(index, perRow, tile, rects!.length, rects![0]!.width, rects![0]!.height, rects![0]!.columns);
      expect(origin).toMatchObject({ sourceIndex: 1, y: 0 });
      expect(origin.y + tile).toBeLessThanOrEqual(rects![1]!.height);
      const before = tileFrameOrigin(index - perRow, perRow, tile, rects!.length, rects![0]!.width, rects![0]!.height, rects![0]!.columns);
      expect(before.sourceIndex).toBe(0);
      expect(before.y + tile).toBeLessThanOrEqual(rects![0]!.height);
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

describe("generatedArtworkAlpha", () => {
  isolateTimers();
  function canvas(width: number, height: number, fill: readonly [number, number, number]): {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  } {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      data[index * 4] = fill[0];
      data[index * 4 + 1] = fill[1];
      data[index * 4 + 2] = fill[2];
      data[index * 4 + 3] = 255;
    }
    return { data, width, height };
  }
  function paint(
    target: { data: Uint8ClampedArray; width: number },
    x: number,
    y: number,
    color: readonly [number, number, number],
  ): void {
    const offset = (y * target.width + x) * 4;
    target.data[offset] = color[0];
    target.data[offset + 1] = color[1];
    target.data[offset + 2] = color[2];
    target.data[offset + 3] = 255;
  }
  function alphaAt(target: { data: Uint8ClampedArray; width: number }, x: number, y: number): number {
    return target.data[(y * target.width + x) * 4 + 3]!;
  }
  const WHITE = [255, 255, 255] as const;
  const GREEN = [40, 180, 90] as const;
  describe("generatedArtworkAlpha", () => {
    it("흰 배경 위의 피사체에서 배경만 투명으로 만든다", () => {
      const image = canvas(8, 8, WHITE);
      for (let y = 3; y <= 4; y += 1) {
        for (let x = 3; x <= 4; x += 1) paint(image, x, y, GREEN);
      }

      const cleared = keyOutBackground(image);

      expect(cleared).toBe(60);
      expect(alphaAt(image, 0, 0)).toBe(0);
      expect(alphaAt(image, 3, 3)).toBe(255);
      expect(alphaAt(image, 4, 4)).toBe(255);
    });

    it("피사체 내부의 배경색 픽셀은 테두리와 끊겨 있으므로 유지한다", () => {
      const image = canvas(9, 9, WHITE);
      for (let y = 2; y <= 6; y += 1) {
        for (let x = 2; x <= 6; x += 1) paint(image, x, y, GREEN);
      }
      paint(image, 4, 4, WHITE);

      keyOutBackground(image);

      expect(alphaAt(image, 4, 4)).toBe(255);
      expect(alphaAt(image, 0, 0)).toBe(0);
    });

    it("배경이 없는 꽉 찬 그림은 건드리지 않는다", () => {
      const image = canvas(6, 6, WHITE);
      for (let y = 0; y < 6; y += 1) {
        for (let x = 0; x < 6; x += 1) paint(image, x, y, x < 3 ? GREEN : [200, 40, 40]);
      }

      expect(detectBackgroundKey(image)).toBeNull();
      expect(keyOutBackground(image)).toBe(0);
      expect(alphaAt(image, 0, 0)).toBe(255);
    });
  });
});

describe("generatedAssetHarness", () => {
  isolateTimers();
  describe("generatedAssetHarness", () => {
    it("validates dry-run PNGs without re-promoting retired starter entries", async () => {
      const entry = GENERATED_ASSET_PLAN.assets[1];
      const plan = buildDryRunPathPlan(GENERATED_ASSET_PLAN, ".omo/evidence/oprn-generated-assets-execution/raw");
      const bytes = createFakeGeneratedAsset(entry);

      const validation = await validateGeneratedAssetBytes({ entry, path: plan[1]?.rawPath ?? "", bytes });
      const promotion = buildPromotionMetadata(entry, validation);
      const contactSheet = buildContactSheetMetadata(GENERATED_ASSET_PLAN);
      const command = buildLiveAgyCommand(entry, "C:/tmp/generated.png");

      expect(plan[1]?.rawPath).toMatch(/hero-01-charset-[0-9a-f]{8}\.png$/);
      expect(command).toContain("agy");
      expect(command.join(" ")).toContain("180s");
      expect(validation.ok).toBe(true);
      expect(validation.inspection?.width).toBe(288);
      expect(validation.inspection?.height).toBe(256);
      expect(validation.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(promotion).toBeNull();
      expect(contactSheet.cells).toHaveLength(GENERATED_ASSET_PLAN.assets.length);
    });

    it("rejects missing, non-PNG, wrong-size, blank, and unsafe generated outputs", async () => {
      const entry = GENERATED_ASSET_PLAN.assets.find((asset) => asset.id === "potion-red-icon");
      expect(entry).toBeDefined();
      if (!entry) return;
      const missing = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: null });
      const nonPng = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: new Uint8Array([1, 2, 3]) });
      const wrongSize = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: createFakePngBytes({ width: 64, height: 64 }) });
      const blank = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/item-a1b2c3d4.png", bytes: createFakePngBytes({ width: 32, height: 32, blank: true }) });
      const unsafeName = await validateGeneratedAssetBytes({ entry, path: "public/assets/generated/starter/output.png", bytes: createFakePngBytes({ width: 32, height: 32 }) });

      expect(missing.issues).toContain("file is missing");
      expect(nonPng.issues).toContain("file is not a PNG");
      expect(wrongSize.issues).toContain("PNG dimensions 64x64 do not match 32x32");
      expect(blank.issues).toContain("PNG appears blank");
      expect(unsafeName.issues).toContain("output path must be a unique generated PNG outside public/assets/easyrpg");
    });
  });
});

describe("generatedAssetManifest", () => {
  isolateTimers();
  describe("generatedAssetManifest", () => {
    it("accepts the planned Wave 1 RM2K3 asset batch when every target has contract metadata", () => {
      const result = validateGeneratedAssetManifest(GENERATED_ASSET_PLAN);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.manifest.assets.filter((entry) => entry.target === "actorFace")).toHaveLength(2);
        // hero-02-charset 는 나무 타일 무늬가 들어간 fake 승격본이라 뺐다. 남은 걷기 시트는 hero-01 하나.
        expect(result.manifest.assets.filter((entry) => entry.target === "actorCharset")).toHaveLength(1);
        // 4 → 6 (2026-08-29): 성직자·궁수 배틀러 추가. DB 액터 actor_cleric / actor_ranger 가
        // 여태 hero-02 / hero-01 시트를 돌려 써서 파티에 넣으면 같은 그림이 두 번 섰다.
        expect(result.manifest.assets.filter((entry) => entry.target === "actorBattleCharset")).toHaveLength(6);
        expect(result.manifest.assets.filter((entry) => entry.target === "enemyMonster")).toHaveLength(5);
        expect(result.manifest.assets.filter((entry) => entry.target === "itemImage" || entry.target === "itemIcon")).toHaveLength(4);
        expect(result.manifest.assets.filter((entry) => entry.target === "equipmentImage" || entry.target === "equipmentIcon")).toHaveLength(4);
        expect(result.manifest.assets.filter((entry) => entry.target === "troopPreview")).toHaveLength(1);
        expect(
          result.manifest.assets.every(
            (entry) =>
              entry.prompt.length > 0 &&
              (entry.provenance.generator === "agy" ||
                entry.provenance.generator === "imagegen" ||
                entry.provenance.generator === "grok" ||
                entry.provenance.generator === "native-pixel")
          )
        ).toBe(true);
        expect(result.manifest.assets.some((entry) => entry.provenance.generator === "imagegen")).toBe(true);
      }
    });

    it("rejects manifests with missing prompt, bad dimensions, or EasyRPG paths", () => {
      const invalid: GeneratedAssetManifestInput = {
        version: 1,
        assets: [
          {
            id: "bad-actor",
            target: "actorCharset",
            resourceKind: "charset",
            expectedDimensions: { width: 320, height: 240 },
            negativePrompt: "watermarks",
            status: "generated",
            rawPath: "public/assets/easyrpg/charset/output.png",
            resourceId: "bad-actor-resource",
            provenance: {
              generator: "agy",
              mode: "fake",
              promptVersion: "test",
              createdAt: "2026-06-22T00:00:00.000Z",
            },
          },
        ],
      };

      const result = validateGeneratedAssetManifest(invalid);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.map((issue) => issue.field)).toContain("prompt");
        expect(result.issues.map((issue) => issue.field)).toContain("expectedDimensions");
        expect(result.issues.map((issue) => issue.field)).toContain("path");
      }
    });

    it("registers the historical enemy IDs with native source and portrait provenance", () => {
      const enemies = GENERATED_ASSET_PLAN.assets.filter((entry) => entry.target === "enemyMonster" || entry.target === "troopPreview");
      expect(enemies).toHaveLength(6);
      expect(enemies.every(entry => entry.provenance.generator === "native-pixel")).toBe(true);
      expect(enemies.every(entry => entry.rawPath?.includes("pixel-enemies/") && entry.promotedPath?.includes("pixel-enemy-portraits/"))).toBe(true);
    });

    it("retains starter battle charset provenance while rejecting their promotion", () => {
      const result = validateGeneratedAssetManifest(GENERATED_ASSET_PLAN);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // promptVersion 이 "+grok-row1-v1" 로 늘어난 이유: 2026-08-29 에 행 1(defend/dead)을 grok 으로
      // 그려 같은 PNG 에 병합했다. 행 0 은 여전히 번들 캐릭터셋 추출본이라 출처가 섞였고,
      // 스키마는 자산 하나에 생성 패스 하나를 전제하므로 그 사실을 문자열로 남긴다.
      const extractedAssets = result.manifest.assets.filter((asset) =>
        asset.provenance.promptVersion.startsWith("bundled-charset-extract-v1")
      );
      expect(extractedAssets.map((asset) => asset.id).sort()).toEqual([
        "hero-01-battle",
        "hero-02-battle",
        "hero-03-battle",
        "hero-04-battle",
      ]);
      expect(extractedAssets.every((asset) => asset.provenance.promptVersion.endsWith("+grok-row1-v1"))).toBe(true);
      expect(extractedAssets.every((asset) => asset.status === "rejected")).toBe(true);
      expect(extractedAssets.every((asset) => asset.promotedPath === null && asset.sha256 === null)).toBe(true);
    });
  });
});
