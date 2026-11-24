import { describe, expect, it, afterEach } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl, builtinGeneratedResourceIds, resolveGeneratedAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { searchResources } from "@/assets/resourceSearch";
import { captureActivityVisuals } from "@/ai/activityVisual";
import type { Project } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { FALLEN_MIRROR_TEXTURE } from "@/assets/fallenMirrorCharsets";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { hasInlineAssets, inlineAssetUrl, registerInlineAssets, withInlineAsset } from "@/assets/inlineAssetStore";
import { resolve, join } from "node:path";
import { mapBackgroundFromPanoramaSet, OPRN_PANORAMA_ASSETS, OPRN_PANORAMA_SETS } from "@/assets/oprnPanoramas";
import { applyMapBackgroundMotion, detectMapBackgroundMotion, mapBackgroundCoverCentre, mapBackgroundCoverScale, MAP_BACKGROUND_MOTIONS, normalizeMapBackground } from "@/project/mapBackground";
import { mapBackgroundVisibility, startPosAfterBackgroundClear } from "@/project/mapBackgroundVisibility";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { PLAYER_RUNTIME_AUDIO_RESOURCE_IDS } from "@/player/playerRuntimeAudioIds";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { startSession, type PlaySession } from "@/project/session";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import type { StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("activityVisual", () => {
  isolateTimers();
  const project = { maps: {}, tilesets: {}, assets: { uploaded: {} }, database: {} } as unknown as Project;
  function preview(kind: "backdrop" | "charset" | "monster" | "tile", query: string) {
    const matches = searchResources(kind, query, { monsterProject: { resourceProfiles: [], assets: { uploaded: {} } } });
    return captureActivityVisuals(project, "list_resources", { kind, query }, { ok: true, data: { matches } });
  }
  describe("captureActivityVisuals resource search", () => {
    it("draws a charset hit from the sheet file, not the search id", () => {
      const [visual] = preview("charset", "남자아이");
      expect(visual?.title).toBe("남자아이");
      expect(visual?.caption).toBe("검색된 소재");
      expect(visual?.resourceId).toBe("tex_easyrpg_charset_people1");
      expect(visual?.pattern).toBe(charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }));
      expect(resolveAssetResourceUrl(visual?.resourceId)).toBe("/assets/easyrpg/charset/People1.png");
      expect(resolveAssetResourceUrl("charset:tex_easyrpg_charset_people1:0")).toBeNull();
    });

    it("draws a backdrop hit from the asset id behind the search prefix", () => {
      const [visual] = preview("backdrop", "oprn-pano-sky-day");
      expect(visual?.resourceId).toBe("oprn-pano-sky-day");
      expect(resolveAssetResourceUrl(visual?.resourceId)).toBe("/assets/panoramas/oprn-pano-sky-day.png");
    });

    it("keeps a monster catalog id that already resolves", () => {
      const [visual] = preview("monster", "slime");
      expect(visual?.resourceId).toMatch(/^generated-enemy-slime/);
      expect(resolveAssetResourceUrl(visual?.resourceId)).toMatch(/\.png$/);
    });

    it("does not attach a tile card whose search id is not a file", () => {
      expect(searchResources("tile", "표지판").some((match) => match.id === "tile:320")).toBe(true);
      expect(preview("tile", "표지판").some((visual) => visual.resourceId?.startsWith("tile:"))).toBe(false);
    });
  });
});

describe("defaultMonsterSpeciesDiversity", () => {
  isolateTimers();
  // 기본 DB 종족 다양성 계약. 2026-08-28 다이어트 때 6종 전부가
  // normal/포획 0.4/skill_attack 하나로 평탄화된 회귀를 막는다.
  describe("default monster species diversity", () => {
    it("ships starter trio plus wild species with distinct types, capture rates, and skills", () => {
      const project = createBlankProject();
      const species = project.database.monsterSpecies ?? [];
      const byId = new Map(species.map((record) => [record.id, record]));

      // 스타터 3종 + 야생 5종 + 광산 해골이 전부 있어야 한다.
      for (const id of [
        "species_leafling",
        "species_sparkit",
        "species_aqualing",
        "species_wild_slime",
        "species_king_slime",
        "species_cave_bat",
        "species_stone_golem",
        "species_ember_drake",
        "species_forest_hornet",
        "species_mine_skeleton",
      ]) {
        expect(byId.has(id), `missing ${id}`).toBe(true);
      }

      // 타입이 한 가지로 뭉개지지 않는다 — 기본 차트(fire/water/grass)가 전부 등장한다.
      const types = new Set(species.flatMap((record) => record.types ?? []));
      expect([...types].sort()).toEqual(["fire", "grass", "water"]);

      // 포획률이 전원 동일하지 않다 — 잡기 쉬운 잡몹부터 보스급까지 구배가 있다.
      const rates = new Set(species.map((record) => record.captureRate));
      expect(rates.size).toBeGreaterThanOrEqual(5);
      expect(byId.get("species_wild_slime")!.captureRate).toBeGreaterThan(
        byId.get("species_king_slime")!.captureRate,
      );
      expect(byId.get("species_ember_drake")!.captureRate).toBeLessThanOrEqual(0.15);

      // L1 skill_attack 외에 종족 정체성 기술이 있다.
      const skillSets = new Set(
        species.flatMap((record) => (record.skillsByLevel ?? []).map((entry) => entry.skillId)),
      );
      expect(skillSets.has("skill_leaf")).toBe(true);
      expect(skillSets.has("skill_fire")).toBe(true);
      expect(skillSets.has("skill_water")).toBe(true);

      // 슬라임 진화 데모 체인이 살아 있다.
      expect(byId.get("species_wild_slime")!.evolutions?.[0]).toMatchObject({
        toSpeciesId: "species_king_slime",
        requires: { level: 7 },
      });

      // 참조 무결성: 종족 기술·아트가 전부 실재한다.
      const skillIds = new Set(project.database.skills.map((skill) => skill.id));
      for (const record of species) {
        for (const entry of record.skillsByLevel ?? []) {
          expect(skillIds.has(entry.skillId), `${record.id} missing skill ${entry.skillId}`).toBe(true);
        }
        expect(
          resolveAssetResourceUrl(record.graphic.monsterResourceId),
          `${record.id} missing art ${record.graphic.monsterResourceId}`,
        ).toBeTruthy();
      }
    });
  });
});

describe("fallenTowerMirror", () => {
  isolateTimers();
  // fs-vqa-obs(2026-11-10): 하늘탑 3층 거울이 RTP 누름 버튼·바위 칸이라 거울로 읽히지 않았다 — 렌즈 거울 칩 FallenMirror1.
  describe("fallen tower lens mirror charset", () => {
    it("is a bundled object chip that the player can load", () => {
      const asset = CHARSET_ASSETS.find((a) => a.textureKey === FALLEN_MIRROR_TEXTURE);
      expect(asset?.path).toBe("assets/generated/charsets/FallenMirror1.png");
      expect(resolveAssetResourceUrl(FALLEN_MIRROR_TEXTURE)).toMatch(/assets\/generated\/charsets\/FallenMirror1\.png$/u);
      expect(charsetFamilyOf(undefined, FALLEN_MIRROR_TEXTURE)).toBe("object");
      for (const index of [0, 1]) expect(findCharsetSemantic(FALLEN_MIRROR_TEXTURE, index)?.tags).toContain("거울");
    });
  });
});

describe("heroBattleSheetContract", () => {
  isolateTimers();
  // The old painted hero sheets were removed by user request. Their IDs still load,
  // while the bundled catalog and renderer cannot request those PNGs.
  describe("retired starter hero sheets", () => {
    const ids = ["hero", ...[1, 2, 3, 4, 5, 6].map(i => `generated-actor-hero-0${i}-battle`)];

    it("removes the directory and excludes retired IDs from available artwork", () => {
      expect(existsSync(new URL("../public/assets/generated/starter", import.meta.url))).toBe(false);
      for (const id of ids) {
        expect(resolveGeneratedAssetResourceUrl(id)).toBeNull();
        expect(builtinGeneratedResourceIds()).not.toContain(id);
        expect(builtinGeneratedResourceIds(true)).toContain(id);
      }
    });

    it("still loads projects that refer to retired hero IDs", () => {
      expect(() => deserialize(JSON.stringify(battleFixture))).not.toThrow();
    });
  });
});

describe("inlineAssetStore", () => {
  isolateTimers();
  const DATA_URL = "data:image/png;base64,AA==";
  afterEach(() => registerInlineAssets(null));
  describe("inline asset store", () => {
    // 표가 없을 때 아무 것도 바뀌지 않아야 한다. 웹 서버 배포는 이 경로로 돈다.
    it("표가 없으면 경로를 그대로 둔다", () => {
      // Given
      const path = "assets/a.png";

      // When
      const kept = withInlineAsset(path);

      // Then
      expect(hasInlineAssets()).toBe(false);
      expect(kept).toBe(path);
      expect(inlineAssetUrl(path)).toBeNull();
    });

    it("앞의 슬래시 유무와 무관하게 같은 항목을 찾는다", () => {
      // Given
      registerInlineAssets({ "assets/a.png": DATA_URL });

      // When
      const found = ["assets/a.png", "/assets/a.png", "./assets/a.png"].map(withInlineAsset);

      // Then
      expect(found).toEqual([DATA_URL, DATA_URL, DATA_URL]);
    });

    it("이미 data URL 이거나 외부 주소면 건드리지 않는다", () => {
      // Given
      registerInlineAssets({ "assets/a.png": DATA_URL });

      // When
      const passthrough = [DATA_URL, "https://cdn.example.com/a.png"].map(withInlineAsset);

      // Then
      expect(passthrough).toEqual([DATA_URL, "https://cdn.example.com/a.png"]);
    });

    it("표에 없는 경로는 원본을 남긴다", () => {
      // Given
      registerInlineAssets({ "assets/a.png": DATA_URL });

      // When
      const kept = withInlineAsset("assets/b.png");

      // Then
      expect(kept).toBe("assets/b.png");
    });

    // 리소스 id → URL 을 만드는 곳이 곧 인라인 교체 지점이다. 여기가 끊기면 소비처 13곳이 전부
    // 원본 경로로 요청해 file:// 에서 통째로 깨진다.
    it("리소스 해석 결과가 인라인 표를 거친다", () => {
      // Given
      const before = resolveAssetResourceUrl("easyrpg-sound-decision1");
      expect(before?.startsWith("/")).toBe(true);
      registerInlineAssets({ [before!.slice(1)]: "data:audio/wav;base64,BB==" });

      // When
      const after = resolveAssetResourceUrl("easyrpg-sound-decision1");

      // Then
      expect(after).toBe("data:audio/wav;base64,BB==");
    });
  });
});

// OPRN 자체 파노라마 견본·움직임 프리셋·비칠 칸 판정 (2026-10-21 파노라마 사용성 감사).
describe("mapBackgroundPanoramas", () => {
  isolateTimers();
  describe("OPRN 파노라마 견본", () => {
    it("다섯 세트(하늘·노을·밤하늘·바다·구름)가 있고 그림 파일이 저장소에 있다", () => {
      // + oprn-sky-day-city (rooftop street view, #3375); + cloud sea / far mountains / far forest (sheer terrain backdrops, #4757).
      expect(OPRN_PANORAMA_SETS.map((set) => set.id)).toEqual(["oprn-sky-day", "oprn-sky-day-city", "oprn-sunset", "oprn-night-stars", "oprn-sea", "oprn-clouds", "oprn-cloud-sea", "oprn-far-mountains", "oprn-far-forest"]);
      for (const asset of OPRN_PANORAMA_ASSETS) expect(existsSync(resolve("public", asset.path)), asset.path).toBe(true);
    });

    it("그림 id 가 런타임 URL 로 풀리고 내보내기에 실린다", () => {
      const project = createBlankProject();
      const map = Object.values(project.maps)[0]!;
      map.background = mapBackgroundFromPanoramaSet("oprn-sunset");
      expect(resolveAssetResourceUrl("oprn-pano-sunset", { project })).toBe("/assets/panoramas/oprn-pano-sunset.png");
      const paths = collectWebExportAssets(project).map((asset) => asset.zipPath);
      expect(paths).toContain("assets/panoramas/oprn-pano-sunset.png");
      expect(paths).toContain("assets/panoramas/oprn-pano-sunset-skyline.png");
    });

    it("세트를 펴면 빈 칸에도 보이고 정규화를 그대로 통과한다", () => {
      for (const set of OPRN_PANORAMA_SETS) {
        const background = mapBackgroundFromPanoramaSet(set.id)!;
        expect(background.showInEmptyCells).toBe(true);
        expect(normalizeMapBackground(background)).toEqual(background);
      }
    });

    it("지평선 세트는 320×240 화면에 배율 1 로 깔린다(도트가 뭉개지지 않는다)", () => {
      const sky = OPRN_PANORAMA_SETS.find((set) => set.view === "horizon")!.layers[0]!;
      expect(mapBackgroundCoverScale(sky.fit, { width: 320, height: 240 }, sky)).toBe(1);
    });

    it("sheer-terrain backdrops are 640x240 horizon layers that wrap without a seam", async () => {
      const { PNG } = await import("pngjs");
      const { readFileSync } = await import("node:fs");
      for (const id of ["oprn-cloud-sea", "oprn-far-mountains", "oprn-far-forest"]) {
        const set = OPRN_PANORAMA_SETS.find((entry) => entry.id === id)!;
        expect(set.view).toBe("horizon");
        for (const layer of set.layers) {
          const png = PNG.sync.read(readFileSync(resolve("public", layer.path)));
          expect([png.width, png.height, layer.fit, layer.loopY], layer.id).toEqual([640, 240, "cover", false]);
          // seam: the last column and the first column differ no more than neighbouring columns do on average
          const px = (x: number, y: number) => png.data.readUInt32BE((y * png.width + x) * 4);
          const diff = (a: number, b: number) => { let n = 0; for (let y = 0; y < png.height; y++) if (px(a, y) !== px(b, y)) n++; return n; };
          let mean = 0;
          for (let x = 0; x + 1 < png.width; x++) mean += diff(x, x + 1);
          mean /= png.width - 1;
          expect(diff(png.width - 1, 0), layer.id).toBeLessThanOrEqual(Math.max(4, mean * 3));
        }
      }
    });
  });
  describe("화면에 맞춤 가운데 맞춤", () => {
    it("16:9 그림을 4:3 화면에 깔면 넘치는 가로를 반씩 자른다(왼쪽 위 고정 아님)", () => {
      expect(mapBackgroundCoverCentre("cover", { width: 320, height: 240 }, { width: 1920, height: 1080 })).toEqual({ x: 53, y: 0 });
      expect(mapBackgroundCoverCentre("cover", { width: 320, height: 240 }, { width: 640, height: 240 })).toEqual({ x: 160, y: 0 });
      expect(mapBackgroundCoverCentre("native", { width: 320, height: 240 }, { width: 1920, height: 1080 })).toEqual({ x: 0, y: 0 });
    });
  });
  describe("움직임 프리셋", () => {
    const base = mapBackgroundFromPanoramaSet("oprn-sky-day")!;

    it("프리셋을 걸면 같은 프리셋으로 다시 알아본다", () => {
      for (const motion of MAP_BACKGROUND_MOTIONS) {
        expect(detectMapBackgroundMotion(applyMapBackgroundMotion(base, motion))).toBe(motion);
      }
    });

    it("고정은 모든 층의 흐름·깊이를 지우고, 타일과 같이는 깊이 1", () => {
      const fixed = applyMapBackgroundMotion(base, "fixed");
      for (const layer of [fixed, ...(fixed.layers ?? [])]) {
        expect(layer.scrollX ?? 0).toBe(0);
        expect(layer.cameraFollow ?? 0).toBe(0);
      }
      const follow = applyMapBackgroundMotion(base, "followCamera");
      for (const layer of [follow, ...(follow.layers ?? [])]) expect(layer.cameraFollow).toBe(1);
    });

    it("세로 흐름은 세로 반복을 켠다(지평선 그림의 loopY:false 를 지운다)", () => {
      const flowY = applyMapBackgroundMotion(base, "flowY");
      expect(base.loopY).toBe(false);
      expect(flowY.loopY).toBeUndefined();
      expect(flowY.scrollY).toBeGreaterThan(0);
    });
  });
  describe("비칠 칸 판정", () => {
    it("빈 칸에도 보이기가 꺼져 있으면 0칸, 켜면 빈 칸 수", () => {
      const map = { lowerTiles: [0, -1, -1, 5], upperTiles: [-1, -1, -1, -1], background: { imageId: "oprn-pano-sky-day" } };
      expect(mapBackgroundVisibility(map, { image: { type: "bundled", id: "beodeul_city" } } as never)).toEqual({ visible: 0, empty: 2, total: 4 });
      expect(mapBackgroundVisibility({ ...map, background: { imageId: "x", showInEmptyCells: true } }).visible).toBe(2);
    });

    it("합본 마을이 아닌 칩셋에서는 #233 을 창 타일로 세지 않는다", () => {
      const map = { lowerTiles: [233], upperTiles: [-1], background: { imageId: "x" } };
      expect(mapBackgroundVisibility(map, { image: { type: "bundled", id: "beodeul_city" } } as never).visible).toBe(0);
    });
  });
  describe("배경 자리 비우기와 시작 위치", () => {
    const map = { id: "m", width: 4, height: 4, lowerTiles: Array.from({ length: 16 }, () => 1), upperTiles: Array.from({ length: 16 }, () => -1), events: [] } as never;
    const topTwoRows = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    const standOnTiles = (m: { width: number; lowerTiles: number[] }, x: number, y: number): boolean => (m.lowerTiles[y * m.width + x] ?? -1) >= 0;

    it("시작 칸이 비울 자리면 설 수 있는 가장 가까운 칸으로 옮긴다", () => {
      expect(startPosAfterBackgroundClear(map, { x: 1, y: 0 }, topTwoRows, standOnTiles as never)).toEqual({ kind: "moved", x: 1, y: 2, reason: "cleared" });
    });

    it("타일이 남아도 설 수 없는 칸(벽 줄)은 건너뛴다", () => {
      const wallRow = (m: { width: number; lowerTiles: number[] }, x: number, y: number): boolean => y !== 2 && standOnTiles(m, x, y);
      expect(startPosAfterBackgroundClear(map, { x: 1, y: 0 }, topTwoRows, wallRow as never)).toEqual({ kind: "moved", x: 1, y: 3, reason: "cleared" });
    });

    it("시작 칸이 비울 자리 밖이면 그대로, 설 칸이 하나도 안 남으면 stuck", () => {
      expect(startPosAfterBackgroundClear(map, { x: 1, y: 3 }, topTwoRows, standOnTiles as never)).toEqual({ kind: "unaffected" });
      const all = new Set(Array.from({ length: 16 }, (_, index) => index));
      expect(startPosAfterBackgroundClear(map, { x: 1, y: 3 }, all, standOnTiles as never)).toEqual({ kind: "stuck" });
    });
  });
});

describe("playerRuntimeAudioIds", () => {
  isolateTimers();
  const AUDIO_ID_PATTERN = /"(easyrpg-sound|easyrpg-music|cc0-bgm|cc0-se)-[a-z0-9-]+"/g;
  const PLAYER_DIR = "src/player";
  // 목록 파일 자신과 카탈로그 정의는 「재생」 이 아니라 「선언」 이다.
  const NOT_PLAYBACK = new Set(["playerRuntimeAudioIds.ts"]);
  function playerSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { out.push(...playerSourceFiles(path)); continue; }
      if (!entry.name.endsWith(".ts") || NOT_PLAYBACK.has(entry.name)) continue;
      out.push(path);
    }
    return out;
  }
  // 플레이어가 재생하지만 src/player 밖으로 옮긴 정의 — FALLBACK_BGM_RESOURCE_ID 는 project/mapMusic.ts 로 옮겨
  // player/mapBgm.ts 가 다시 내보낸다(공개 기준 커밋 0d4f13e7c8 시점부터).
  // containerFx·mapDoorKinds·liftRide 는 플레이어가 기본값으로 재생하는 cc0-se 표다(상자 획득음이 출하본에서 404 였다, 2026-11-08).
  const PLAYER_PLAYBACK_FILES_OUTSIDE_PLAYER = [
    "src/project/mapMusic.ts",
    "src/project/containerFx.ts",
    "src/project/mapDoorKinds.ts",
    "src/project/eventCommands/liftRide.ts",
  ];
  function hardcodedIdsInPlayerSource(): Map<string, string[]> {
    const found = new Map<string, string[]>();
    for (const file of [...playerSourceFiles(PLAYER_DIR), ...PLAYER_PLAYBACK_FILES_OUTSIDE_PLAYER]) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(AUDIO_ID_PATTERN)) {
        const id = match[0].slice(1, -1);
        found.set(id, [...(found.get(id) ?? []), file]);
      }
    }
    return found;
  }
  describe("player runtime audio ids", () => {
    // 이 테스트가 드리프트 방지 장치다. src/player 어딘가에 오디오 id 를 새로 박으면 여기서
    // 먼저 걸린다 — 그러지 않으면 내보낸 게임에서만 404 로 드러난다(실제로 그렇게 났다).
    it("소스에 박힌 오디오 id 를 하나도 빠뜨리지 않는다", () => {
      // Given
      const listed = new Set(PLAYER_RUNTIME_AUDIO_RESOURCE_IDS);

      // When
      const found = hardcodedIdsInPlayerSource();

      // Then
      expect(found.size).toBeGreaterThan(0);
      const missing = [...found.entries()]
        .filter(([id]) => !listed.has(id))
        .map(([id, files]) => `${id} (${files.join(", ")})`);
      expect(missing).toEqual([]);
    });

    it("목록에 죽은 id 를 남겨두지 않는다", () => {
      // Given
      const found = hardcodedIdsInPlayerSource();

      // When
      const stale = PLAYER_RUNTIME_AUDIO_RESOURCE_IDS.filter((id) => !found.has(id));

      // Then
      expect(stale).toEqual([]);
    });

    it("목록의 모든 id 가 내보내기 산출물에 실린다", () => {
      // Given
      const project = createBlankProject();

      // When
      const shipped = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

      // Then
      const missing = PLAYER_RUNTIME_AUDIO_RESOURCE_IDS
        .map((id) => ({ id, url: resolveAssetResourceUrl(id, { project }) }))
        .filter(({ url }) => url?.startsWith("/") === true)
        .filter(({ url }) => !shipped.has(url!.slice(1)))
        .map(({ id, url }) => `${id} -> ${url}`);
      expect(missing).toEqual([]);
    });
  });
});

describe("playerStatusMenuEntryIcons", () => {
  isolateTimers();
  type DetailOverrides = Omit<StatusMenuDetailOptions, "project" | "session" | "slots" | "waitModeEnabled">;
  function renderDetail(project: Project, session: PlaySession, overrides: DetailOverrides) {
    const detail = createStatusMenuDetail({
      project,
      session,
      slots: [],
      waitModeEnabled: true,
      ...overrides,
    });
    return { detail, panel: renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail)) };
  }
  describe("status menu entry icons", () => {
    it.each([
      { frameWidth: 384, frameHeight: 384, columns: 10, width: 100, height: 100 },
      { frameWidth: 96, frameHeight: 48, columns: 3, width: 100, height: 50 },
      { frameWidth: 48, frameHeight: 96, columns: 3, width: 50, height: 100 },
      { frameWidth: 96, frameHeight: 96, columns: 5, width: 100, height: 100, legacy: true },
    ])("crops one skill animation cell in the row and showcase for $frameWidth x $frameHeight", (sheet) => {
      const project = createBlankProject();
      const actor = project.database.actors[0];
      const skill = project.database.skills[0];
      if (!actor || !skill) throw new Error("The starter project must have an actor and skill");
      const animation = normalizeBattleAnimationRecord({
        id: "anim_menu_crop",
        name: "Menu crop",
        resourceId: "generated-battle-anim-fire-burst",
        sheet,
      });
      if ("legacy" in sheet) delete animation.sheet;
      project.database.battleAnimations.push(animation);
      skill.animationId = animation.id;
      actor.learnedSkills = [{ level: 1, skillId: skill.id }];
      const session = startSession(project);
      const detail = createStatusMenuDetail({
        project, session, slots: [], waitModeEnabled: true,
        selectedCommand: "skills", skillActorId: actor.id, onSelectSkill: () => {},
      });
      const restoreDom = installFakeDom();
      try {
        const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail, { showcase: true }));
        for (const testId of [`status-menu-entry-icon-skill-${skill.id}`, "status-menu-showcase-art"]) {
          const icon = findByTestId(panel, testId);
          const crop = icon?.children[0];
          expect(crop, `${testId} must isolate one cell instead of containing the entire sheet`).toBeDefined();
          expect(crop?.getAttribute("style")).toContain(`width:${sheet.width}%`);
          expect(crop?.getAttribute("style")).toContain(`height:${sheet.height}%`);
          expect(crop?.getAttribute("style")).toContain(`background-size:${sheet.columns * 100}% auto`);
          expect(crop?.getAttribute("style")).toContain("background-position:0 0");
          expect(crop?.getAttribute("style")).toContain('background-image:url("/assets/generated/effects/effect-fire-burst.png")');
        }
      } finally {
        restoreDom();
      }
    });

    it.each(["missing-animation", "missing-resource"])("keeps the skill placeholder for %s", (missing) => {
      const project = createBlankProject();
      const actor = project.database.actors[0];
      const skill = project.database.skills[0];
      if (!actor || !skill) throw new Error("The starter project must have an actor and skill");
      skill.animationId = "anim_menu_missing";
      if (missing === "missing-resource") {
        project.database.battleAnimations.push({ id: skill.animationId, name: "Missing resource" });
      }
      actor.learnedSkills = [{ level: 1, skillId: skill.id }];
      const restoreDom = installFakeDom();
      try {
        const { panel } = renderDetail(project, startSession(project), {
          selectedCommand: "skills", skillActorId: actor.id,
        });
        const icon = findByTestId(panel, `status-menu-entry-icon-skill-${skill.id}`);
        expect(icon?.className).toContain("missing");
        expect(icon?.getAttribute("style") ?? "").not.toContain("background-image");
      } finally {
        restoreDom();
      }
    });

    it("carries the authored item icon resource id on every inventory row", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const potion = project.database.items.find((record) => record.id === "item_potion")!;
      session.inventory[potion.id] = 2;

      const detail = createStatusMenuDetail({
        project,
        session,
        slots: [],
        waitModeEnabled: true,
        selectedCommand: "items",
      });

      const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-item-${potion.id}`);
      expect(potion.iconResourceId).toBeTruthy();
      expect(entry?.icon?.resourceId).toBe(potion.iconResourceId);
      expect(entry?.icon?.testId).toBe(`status-menu-entry-icon-item-${potion.id}`);
      expect(entry?.icon?.alt).toBe(potion.name);
    });

    it("paints the resolved item icon url inline on the rendered row", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const session = startSession(project);
        const potion = project.database.items.find((record) => record.id === "item_potion")!;
        session.inventory[potion.id] = 3;
        const url = resolveAssetResourceUrl(potion.iconResourceId, { project });
        expect(url).toBeTruthy();

        const { panel } = renderDetail(project, session, { selectedCommand: "items" });

        const icon = findByTestId(panel, `status-menu-entry-icon-item-${potion.id}`);
        expect(icon).not.toBeNull();
        expect(icon?.className).toContain("status-menu-entry-icon");
        expect(icon?.className).not.toContain("missing");
        expect(icon?.getAttribute("style")).toContain(`background-image:url("${url}")`);
        expect(icon?.getAttribute("style")).toContain("image-rendering:pixelated");
        expect(icon?.getAttribute("role")).toBe("img");
        expect(icon?.getAttribute("aria-label")).toBe(potion.name);
      } finally {
        restoreDom();
      }
    });

    it("paints the resolved equipment icon url on candidate rows", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const session = startSession(project);
        const actorId = session.partyActorIds[0]!;
        const weapon = project.database.equipment.find((record) => record.id === "equip_sword")!;
        session.inventory[weapon.id] = 1;
        const url = resolveAssetResourceUrl(weapon.iconResourceId, { project });
        expect(url).toBeTruthy();

        const { detail, panel } = renderDetail(project, session, {
          selectedCommand: "equipment",
          equipmentActorId: actorId,
          equipmentSlotId: "weapon",
        });

        const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-equipment-item-${weapon.id}`);
        expect(entry?.icon?.resourceId).toBe(weapon.iconResourceId);
        const icon = findByTestId(panel, `status-menu-entry-icon-equipment-${weapon.id}`);
        expect(icon).not.toBeNull();
        expect(icon?.getAttribute("style")).toContain(`background-image:url("${url}")`);
        expect(icon?.getAttribute("aria-label")).toBe(weapon.name);
      } finally {
        restoreDom();
      }
    });

    it("marks a graphic-less record with the missing class and no background image", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const session = startSession(project);
        const plain = project.database.items.find((record) => record.id === "item_old_key")!;
        delete plain.iconResourceId;
        delete plain.imageResourceId;
        session.inventory[plain.id] = 1;

        const { panel } = renderDetail(project, session, { selectedCommand: "items" });

        const icon = findByTestId(panel, `status-menu-entry-icon-item-${plain.id}`);
        expect(icon).not.toBeNull();
        expect(icon?.className).toContain("missing");
        expect(icon?.getAttribute("style") ?? "").not.toContain("background-image");
        expect(icon?.getAttribute("aria-label")).toBe(`${plain.name} missing`);
      } finally {
        restoreDom();
      }
    });
  });
});

// 내보낸 게임에서 맵 배경(파노라마) PNG 를 실제로 찾을 수 있는지.
//
// 왜 이 테스트가 필요한가: 맵 배경은 번들 자산이 아니라 public 아래 낱장 파일
// (assets/easyrpg/backdrop/Sky1.png)이다. vite.player.config.ts 는 publicDir:false 라 플레이어
// 번들이 public/ 를 복사하지 않으므로, 내보내기 자산 목록에 그 경로가 없으면 내보낸 게임에서
// 하늘만 404 로 사라진다 — 런타임은 조용히 아무것도 그리지 않아 화면만 보고는 알 수 없다.
//
// 실측(2026-09-14): 빈 프로젝트도 배경 프로필 13개를 등록하므로(`resourceProfiles`) 배경 PNG 는
// **맵 배경을 저작하지 않아도** 내보내기에 들어간다(총 688개 자산). 그래서 «저작하면 담긴다» 는
// 단정은 아무것도 증명하지 못한다. 여기서 못박는 것은 **런타임이 만드는 URL 과 내보낸 경로가
// 같은가**, 그리고 스탠드얼론 인라인 표가 그 경로를 키로 받는가다.
describe("webExportMapBackground", () => {
  isolateTimers();
  // EasyRPG 배경(Sky1)은 2026-10-07 저작권 정리로 지웠다 — 지금 맵 배경 고르기에 나오는 OPRN 파노라마로 잰다.
  const BACKDROP_ID = "oprn-pano-sky-day";
  const BACKDROP_PATH = "assets/panoramas/oprn-pano-sky-day.png";
  /** 시작 맵 배경을 이 그림으로 저작한 빈 프로젝트. */
  function projectWithBackdrop() {
    const project = createBlankProject();
    project.maps[project.startMapId]!.background = { imageId: BACKDROP_ID };
    return project;
  }
  describe("내보내기의 맵 배경", () => {
    it("런타임이 배경 id 로 만드는 경로가 내보내기 자산 목록에 있다", () => {
      const url = resolveAssetResourceUrl(BACKDROP_ID, { project: createBlankProject() });
      expect(url).toBe(`/${BACKDROP_PATH}`);
      const paths = collectWebExportAssets(projectWithBackdrop()).map((asset) => asset.zipPath);
      expect(paths).toContain(BACKDROP_PATH);
    });

    it("런타임 URL 이 스탠드얼론 인라인 표의 키(= zip 경로)로 치환된다", () => {
      // 스탠드얼론 HTML 은 zip 경로를 키로 data URL 을 심는다. 런타임이 만드는 URL 이 그 키로
      // 해석되지 않으면 실행형 HTML 에서만 배경이 사라진다(출하 경로 전용 결함).
      const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
      registerInlineAssets({ [BACKDROP_PATH]: dataUrl });
      try {
        expect(resolveAssetResourceUrl(BACKDROP_ID, { project: createBlankProject() })).toBe(dataUrl);
      } finally {
        registerInlineAssets(null);
      }
    });
  });
});
