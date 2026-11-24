// @vitest-environment happy-dom

import { afterEach, describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";
import { actorBustImage } from "@/player/battleComboCutIn";
import type { Project, TilesetDef } from "@/project/types";
import { BATTLER_HIRES_SHEETS, battlerHiresSheet, battlerHiresSheetUrl, battlerSheetAssetScale } from "@/assets/battlerHiresSheets";
import { battlerIdleAnimation } from "@/assets/battlerIdleAnimations";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import { xbr2x } from "../scripts/lib/pixelUpscale.mjs";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { listBundledPlayAssetPaths, resetBundledPlayAssetWarmup, warmBundledPlayAssets } from "@/assets/bundledAssetWarmup";
import { createBlankProject } from "@/project/defaults";
import { readFileSync } from "node:fs";
import { createDialogueUI } from "@/player/dialogue";
import { loadBundledAssets, rawCharsetTextureKey, TEX_TILESET } from "@/assets/bundled";
import type Phaser from "phaser";
import { registerUploadedTilesets, uploadedTilesetTextureKey } from "@/assets/uploadedTilesets";
import { ensureTilesetTexture, tilesetAnimationKeyForTile, tilesetTextureKey } from "@/editor/tilesetImage";
import { isolateTimers } from "./mergedTeardown";

describe("battleBustPortraitPath", () => {
  isolateTimers();
  // 사장 1.37 VQA D3(2026-11-05): 전투 흉상 요청이 사이트 루트(/assets/...)로 나가 404.
  // 같은 파일은 게임이 실린 경로(/fallen-star/1.37/assets/...)에 있었다. 내보낸 게임은 하위 경로에
  // 실릴 수 있으므로, 흉상 주소도 내보내기 기준(assetBase)으로 해석돼야 한다.

  const BUST_SET = "shared-brown-headband-expressions";
  function projectWithBust(): Project {
    return {
      meta: { id: "d3-test", title: "d3", terms: { gold: "G", item: "아이템" } },
      system: {},
      database: {
        actors: [{ id: "actor_test", name: "테스트", appearanceId: "appearance_test" }],
        characterAppearances: [{ id: "appearance_test", bust: { resourceId: `${BUST_SET}-bust-base`, presentation: "bust" } }],
      },
      assets: { uploaded: {} },
    } as unknown as Project;
  }
  afterEach(() => {
    registerExportAssetBase(null);
    registerInlineAssets(null);
  });
  describe("battle bust portrait URL", () => {
    it("resolves against the shipped game directory, not the site root", () => {
      registerExportAssetBase(new URL("https://games.example.test/fallen-star/1.37/"));
      const bust = actorBustImage(projectWithBust(), "actor_test");
      expect(bust).toBeDefined();
      expect(bust!.url.startsWith("https://games.example.test/fallen-star/1.37/assets/shared/portraits/")).toBe(true);
      expect(bust!.url).not.toMatch(/^https:\/\/games\.example\.test\/assets\//u);
    });
  });
});

// Starter companions are retired; the reusable upscale kernel remains independent.
describe("battlerHiresSheets", () => {
  isolateTimers();
  describe("폐기된 starter 고해상도 짝", () => {
    it("전투 시트와 idle 스트립을 등록하지 않는다", () => {
      expect(BATTLER_HIRES_SHEETS).toEqual([]);
      for (const id of ["hero", ...[1, 2, 3, 4, 5, 6].map(i => `generated-actor-hero-0${i}-battle`)]) {
        expect(battlerHiresSheet(id)).toBeUndefined();
        expect(battlerIdleAnimation(id)).toBeUndefined();
      }
      expect(battlerHiresSheet(undefined)).toBeUndefined();
      expect(battlerSheetAssetScale(undefined)).toBe(2);
    });

    it("직접 등록한 짝의 URL과 논리 크기는 기존 계약을 유지한다", () => {
      const entry = { resourceId: "uploaded-custom-battler", path: "assets/custom/hires.png", cellWidth: 192, cellHeight: 192 };
      expect(battlerSheetAssetScale(entry)).toBe(0.5);
      expect(battlerHiresSheetUrl(entry)).toBe("/assets/custom/hires.png");
    });
  });
  describe("xBR 2배 커널", () => {
    /** 8×8: 좌하 삼각형(x <= y)은 검정, 나머지 투명 — 대각 계단 경계. */
    function staircase(): { width: number; height: number; data: Uint8Array } {
      const size = 8;
      const data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (x <= y) data.set([0, 0, 0, 255], (y * size + x) * 4);
        }
      }
      return { width: size, height: size, data };
    }

    it("대각 계단은 중간 알파로 이어지고, 경계에서 먼 안쪽·바깥은 그대로다", () => {
      const image = staircase();
      const up = xbr2x(image.width, image.height, image.data);
      expect(up.width).toBe(16);
      const alpha = (x: number, y: number) => up.data[(y * 16 + x) * 4 + 3]!;
      let blended = 0;
      for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) if (alpha(x, y) > 0 && alpha(x, y) < 255) blended += 1;
      expect(blended, "계단을 잇는 중간 알파 픽셀이 있어야 한다").toBeGreaterThan(0);
      // 안쪽(좌하 깊숙이)은 완전 불투명, 바깥(우상 깊숙이)은 완전 투명.
      expect(alpha(1, 14)).toBe(255);
      expect(alpha(14, 1)).toBe(0);
    });

    it("단색 면은 가장자리까지 그대로다 — 이미지 밖을 투명으로 보지 않는다", () => {
      const red = [200, 40, 40, 255];
      const data = new Uint8Array([...red, ...red, ...red, ...red]);
      const up = xbr2x(2, 2, data);
      for (let i = 0; i < 16; i += 1) expect([...up.data.subarray(i * 4, i * 4 + 4)]).toEqual(red);
    });
  });
  describe("런타임 — 필드의 액터 스프라이트", () => {
    function renderField(battleCharacterResourceId: string): HTMLElement {
      const project = deserialize(JSON.stringify(battleFixture));
      (project.system as { battleUiStyle?: string }).battleUiStyle = "retro2003";
      store.replace(project);
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
      const snapshot: BattleSnapshot = runtime.snapshot();
      const actor = snapshot.actors[0];
      expect(actor).toBeTruthy();
      (actor as { battleCharacterResourceId?: string }).battleCharacterResourceId = battleCharacterResourceId;
      return battleField(snapshot);
    }

    it("삭제된 영웅 시트는 starter URL을 그리지 않는다", () => {
      const field = renderField("generated-actor-hero-03-battle");
      expect(field.querySelector("[data-testid='battle-actor-sprite-generated-actor-hero-03-battle']")).toBeNull();
      expect(field.innerHTML).not.toContain("generated/starter/");
    });

    it("현재 걷기 칩 전투 시트는 48px 셀을 정수 배율로 그린다", () => {
      const field = renderField("charset-battler-actor1-0");
      const sprite = field.querySelector<HTMLElement>("[data-testid='battle-actor-sprite-charset-battler-actor1-0']");
      expect(sprite?.dataset.rendering).toBe("pixelated");
      expect(sprite?.dataset.battlerSheetSize).toBe("288px 768px");
      expect(sprite?.style.getPropertyValue("--battle-sprite-frame-width")).toBe("96px");
      expect(sprite?.style.backgroundImage).toContain("charset-battlers/actor1-0.png");
      expect(sprite?.style.backgroundImage).not.toContain("starter/");
    });
  });
});

describe("bundledAssetWarmup", () => {
  isolateTimers();
  describe("bundledAssetWarmup", () => {
    let project: ReturnType<typeof createBlankProject>;

    beforeAll(() => {
      project = createBlankProject();
    });

    afterEach(() => {
      resetBundledPlayAssetWarmup();
    });

    it("lists core chipset path and project-referenced textures only", () => {
      const paths = listBundledPlayAssetPaths(project);
      expect(paths).toContain("assets/blank-chipset.png");
      expect(paths).toContain("assets/dialogue-frame.png");
      // blank project still references default actor charset / tileset strings
      expect(paths.length).toBeGreaterThan(2);
      expect(paths.some(path => path.startsWith("assets/beodeul-objects/"))).toBe(false);
    });

    it("shares one in-flight warm promise per asset set", async () => {
      const first = warmBundledPlayAssets(project);
      const second = warmBundledPlayAssets(project);
      expect(second).toBe(first);
      // 테스트 환경 Image 로드는 타임아웃 폴백으로 끝난다.
      await expect(first).resolves.toBeUndefined();
    }, 5_000);
  });
});

describe("dialogueImageUrls", () => {
  isolateTimers();
  const resourceId = "easyrpg-faceset-people1-06";
  const assetPath = "/assets/easyrpg/faceset/People1/06.png";
  const inlinePng = `data:image/png;base64,${readFileSync(`public${assetPath}`).toString("base64")}`;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });
  afterEach(() => {
    registerExportAssetBase(null);
    registerInlineAssets(null);
    vi.useRealTimers();
    document.body.replaceChildren();
  });
  async function renderPortrait() {
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText({
      face: { resourceId }, body: "A", playerTileY: 0, mapHeight: 20,
      reducedMotion: true,
    });
    // Real input skips typing synchronously; no clock-dependent readiness wait.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const face = host.querySelector<HTMLElement>('[data-testid="dialogue-face"]');
    const ready = host.querySelector(".dialogue-box")?.classList.contains("page-ready");
    // Always remove the document key listener, including on assertion failure.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    dialogue.hide();
    return { face, ready };
  }
  describe("dialogue portrait resource resolution", () => {
    it.each([
      { name: "editor root", base: null, inline: false, expected: assetPath },
      { name: "HTTP root export", base: "http://127.0.0.1:42873/", inline: false,
        expected: `http://127.0.0.1:42873${assetPath}` },
      { name: "HTTPS nested export", base: "https://games.example.test/games/demo/", inline: false,
        expected: `https://games.example.test/games/demo${assetPath}` },
      { name: "encoded deployment subpath", base: "https://games.example.test/my game/마을/", inline: false,
        expected: `https://games.example.test/my%20game/%EB%A7%88%EC%9D%84${assetPath}` },
      { name: "inline export", base: "file:///games/demo/", inline: true, expected: inlinePng },
    ])("renders the compiled chief portrait through $name", async ({ base, inline, expected }) => {
      // Given: the real resource resolver and export registration, not mocked URLs.
      registerExportAssetBase(base === null ? null : new URL(base));
      if (inline) registerInlineAssets({ [assetPath.slice(1)]: inlinePng });

      // When
      const { face, ready } = await renderPortrait();

      // Then
      expect(ready).toBe(true);
      expect(face?.classList.contains("dialogue-face-image")).toBe(true);
      expect(face?.classList.contains("missing")).toBe(false);
      expect(face?.style.getPropertyValue("--face-url")).toBe(`url("${expected}")`);
      expect(face?.style.getPropertyValue("--face-width")).toBe("48px");
      expect(face?.style.getPropertyValue("--face-height")).toBe("48px");
    });

    it.each([
      "javascript:alert(1)", "vbscript:msgbox(1)", "file:///assets/face.png",
      "ftp://example.test/face.png", "blob:https://example.test/face.png",
      "data:image/svg+xml;base64,PHN2Zy8+", "data:audio/ogg;base64,AQ==",
      "https://example.test/face.svg", "https://example.test/face.ogg",
      'https://example.test/face.png");color:red;--x:url("face.png',
      "https://example.test/face\\.png", "https://example.test/face\n.png",
      "https://[invalid/face.png",
      "oprn-asset://project/not-a-sha",
      `oprn-asset://project/${"ab".repeat(32)}");color:red`,
      `/__oprn/asset/${"ab".repeat(31)}`,
    ])("keeps invalid image URLs rejected: %s", async (url) => {
      // Given: exercise the resolver's inline boundary, including non-image resources.
      registerInlineAssets({ [assetPath.slice(1)]: url });

      // When
      const { face, ready } = await renderPortrait();

      // Then
      expect(ready).toBe(true);
      expect(face?.classList.contains("missing")).toBe(true);
      expect(face?.style.getPropertyValue("--face-url")).toBe("");
    });

    const sha = "ab".repeat(32);
    it.each([
      `oprn-asset://550e8400-e29b-41d4-a716-446655440000/${sha}`,
      `/__oprn/asset/${encodeURIComponent("/projects/My Game")}/${sha}`,
      `/__oprn/asset/${sha}`,
      "data:image/webp;base64,UklGRgAAAA==",
      "https://games.example.test/faces/hero.webp",
      "/assets/uploaded/hero.gif",
    ])("draws an uploaded face from %s", async (expected) => {
      registerInlineAssets({ [assetPath.slice(1)]: expected });

      const { face, ready } = await renderPortrait();

      expect(ready).toBe(true);
      expect(face?.classList.contains("dialogue-face-image")).toBe(true);
      expect(face?.classList.contains("missing")).toBe(false);
      expect(face?.style.getPropertyValue("--face-url")).toBe(`url("${expected}")`);
    });
  });
});

describe("playBootAssetSelection", () => {
  isolateTimers();
  describe("play boot asset selection", () => {
    it("does not preload catalog chipsets and charsets the starting map never uses", () => {
      // Given a blank project whose tileset catalog and resource profiles list unused art.
      const project = createBlankProject();
      // 2026-10-07 저작권 정리 뒤 시작 맵은 버들항이고 배·숲마을 시트는 지워졌다. 기본 DB 의 「쪽배」 배우가 탈것 칩을 실제로
      // 쓰므로(actor_skiff) 탈것 대신 아무도 쓰지 않는 상자 칩·일본 도시 시트를 목록 전용 그림으로 둔다.
      project.resourceProfiles = [
        ...project.resourceProfiles,
        { kind: "chipset", name: "일본 도시", assetId: "tex_jp_city" },
        { kind: "charset", name: "상자", assetId: "tex_easyrpg_charset_object1" },
      ];
      const keys = new Set<string>();

      // When the play preloader queues images.
      loadBundledAssets({
        load: {
          image(key: string) {
            keys.add(key);
          },
          on() {
            return undefined;
          },
        },
      }, project);

      // Then the start map's chipset and the hero charset load, and catalog-only art does not.
      expect(keys.has("tex_beodeul_city")).toBe(true);
      expect(keys.has(rawCharsetTextureKey("tex_easyrpg_charset_actor1"))).toBe(true);
      expect(keys.has("tex_jp_city")).toBe(false);
      expect(keys.has(rawCharsetTextureKey("tex_easyrpg_charset_object1"))).toBe(false);
    });

    it("does not preload field sprites for enemies that are only in the catalog", () => {
      // Given the blank database, whose enemy and species rows name every starter monster.
      const project = createBlankProject();
      const keys = new Set<string>();

      // When the play preloader queues images.
      loadBundledAssets({
        load: {
          image(key: string) {
            keys.add(key);
          },
          on() {
            return undefined;
          },
        },
      }, project);

      // Then no generated field sprite is queued. The blank map has no field spawn.
      expect([...keys].some((key) => key.startsWith("generated-enemy-"))).toBe(false);
    });
  });
});

describe("uploadedTilesetRendering", () => {
  isolateTimers();
  function fixture() {
    const project = createBlankProject();
    const tileset: TilesetDef = {
      id: 'reference', name: 'Reference field', kind: 'custom', image: { type: 'uploaded', id: 'field-atlas' },
      tileSize: 16, tilesPerRow: 30, count: 540,
      passability: Array.from({ length: 540 }, () => ({ up: true, down: true, left: true, right: true })),
      priority: Array(540).fill('lower'), terrain: Array(540).fill(0),
      animationStrips: [{ baseTile: 510, frames: 4, fps: 4 }],
    };
    project.tilesets[tileset.id] = tileset;
    project.assets.uploaded['field-atlas'] = { id: 'field-atlas', name: 'Atlas', kind: 'tileset', dataUrl: 'data:image/png;base64,AA==', meta: { width: 480, height: 288 } };
    return { project, tileset };
  }
  function textureScene(keys: string[]) {
    const frames = new Map(keys.map(key => [key, new Map<string, number[]>()]));
    const animations = new Map<string, { key: string; frameRate: number; frames: { key: string; frame: string }[] }>();
    const scene = {
      textures: {
        exists: (key: string) => frames.has(key),
        get: (key: string) => ({
          getFrameNames: () => [...frames.get(key)!.keys()],
          add: (name: string, ...rectangle: number[]) => frames.get(key)!.set(name, rectangle),
        }),
      },
      anims: { exists: (key: string) => animations.has(key), create: (value: { key: string; frameRate: number; frames: { key: string; frame: string }[] }) => animations.set(value.key, value) },
    } as unknown as Phaser.Scene;
    return { scene, frames, animations };
  }
  describe('uploaded tilesets in Phaser editor and player', () => {
    it('preloads the saved atlas under the exact key used to draw it, not the bundled exterior', () => {
      const { project, tileset } = fixture();
      const image = vi.fn();
      loadBundledAssets({ load: { image, on: vi.fn() } }, project);
      const key = tilesetTextureKey(tileset);
      expect(key).not.toBe(TEX_TILESET);
      expect(image).toHaveBeenCalledWith(key, project.assets.uploaded['field-atlas'].dataUrl);
      const { scene } = textureScene([key, TEX_TILESET]);
      expect(ensureTilesetTexture(scene, tileset)).toBe(key);
    });

    it('editor preload queues only the uploaded atlases a map uses; the player keeps every atlas for transfers', () => {
      const { project, tileset } = fixture();
      const unused: TilesetDef = { ...tileset, id: 'unused', image: { type: 'uploaded', id: 'unused-atlas' } };
      project.tilesets[unused.id] = unused;
      project.assets.uploaded['unused-atlas'] = { ...project.assets.uploaded['field-atlas']!, id: 'unused-atlas' };
      project.maps[project.startMapId]!.tilesetId = tileset.id;
      const queue = (options?: { onlyMapTilesets?: boolean }) => {
        const keys: string[] = [];
        loadBundledAssets({ load: { image: (key: string) => { keys.push(key); }, on: vi.fn() } as never }, project, options);
        return keys;
      };
      const editor = queue({ onlyMapTilesets: true });
      expect(editor).toContain(uploadedTilesetTextureKey(tileset));
      expect(editor).not.toContain(uploadedTilesetTextureKey(unused));
      expect(queue()).toContain(uploadedTilesetTextureKey(unused));
    });

    it('preserves the authored atlas geometry and registers tiles beyond the old 480-frame limit', () => {
      const { project, tileset } = fixture();
      const key = uploadedTilesetTextureKey(tileset);
      const { scene, frames } = textureScene([key]);
      registerUploadedTilesets(scene, project);
      expect(frames.get(key)!.get('tile_510')).toEqual([0, 0, 272, 16, 16]);
      expect(frames.get(key)!.get('tile_539')).toEqual([0, 464, 272, 16, 16]);
      expect(frames.get(key)!.size).toBe(540);
      registerUploadedTilesets(scene, project);
      expect(frames.get(key)!.size).toBe(540);
    });

    it.each([32, 48])('keeps two uploaded images and a %ipx slicing independent', (size) => {
      const { project, tileset } = fixture();
      const other = { ...tileset, id: 'other', image: { type: 'uploaded' as const, id: 'other-image' } };
      const large = { ...tileset, id: 'large', tileSize: size, tilesPerRow: 480 / size, count: (480 / size) * (288 / size), animationStrips: [] };
      project.tilesets.other = other; project.tilesets.large = large;
      const keys = [tileset, other, large].map(tilesetTextureKey);
      expect(new Set(keys).size).toBe(3);
      const { scene, frames } = textureScene(keys);
      registerUploadedTilesets(scene, project);
      expect(frames.get(keys[2])!.get('tile_16')).toEqual([0, (16 % large.tilesPerRow) * size, Math.floor(16 / large.tilesPerRow) * size, size, size]);
      expect(frames.get(keys[0])!.get('tile_16')).toEqual([0, 256, 0, 16, 16]);
    });

    it('binds an authored waterfall strip to the same uploaded frames the renderer requests', () => {
      const { project, tileset } = fixture();
      const key = tilesetTextureKey(tileset);
      const { scene, animations } = textureScene([key]);
      registerUploadedTilesets(scene, project);
      const requested = `${key}:${tilesetAnimationKeyForTile(tileset, 510)}`;
      expect(animations.get(requested)).toMatchObject({ frameRate: 4, frames: [510, 511, 512, 513].map(tile => ({ key, frame: `tile_${tile}` })) });
      expect(tilesetAnimationKeyForTile(tileset, 240)).toBeNull();
      expect(tilesetAnimationKeyForTile(tileset, 513)).toBe(tilesetAnimationKeyForTile(tileset, 510));
    });

    it('does not silently draw the default atlas when uploaded bytes are missing', () => {
      const { project, tileset } = fixture();
      delete project.assets.uploaded['field-atlas'];
      const image = vi.fn();
      loadBundledAssets({ load: { image, on: vi.fn() } }, project);
      expect(image.mock.calls.some(([key]) => key === tilesetTextureKey(tileset))).toBe(false);
      const { scene } = textureScene([TEX_TILESET]);
      expect(ensureTilesetTexture(scene, tileset)).not.toBe(TEX_TILESET);
    });
  });
});
