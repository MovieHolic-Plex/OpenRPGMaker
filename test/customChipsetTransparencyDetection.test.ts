/** @vitest-environment happy-dom */
// 커스텀 칩셋 투명도 픽셀 감지 — OPRN-OUT-026 후속.
//
// 이 스위트가 고정하는 계약 다섯 개:
//   1. 순수 판정이 합성 픽셀 버퍼에서 불투명/반투명/완전 빈 칸/가장자리만 부드러운 칸을 구분한다.
//   2. 감지는 **타일셋을 변형하지 않는다** — 검토 목록만 채운다(직렬화 비교로 고정).
//   3. 같은 이미지는 한 번만 스캔되고(캐시 히트), 이미지가 바뀌면 무효화된다.
//   4. 읽을 수 없는 이미지는 "모름" 이지 "불투명" 이 아니다.
//   5. 내장 칩셋 경로는 감지를 타지 않는다 — 생성 목록이 그대로 정본이다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedCustomChipsetAlphaScan,
  clearCustomChipsetAlphaCache,
  CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT,
  ensureCustomChipsetAlphaScan,
} from "@/editor/customChipsetTransparency";
import { backgroundlessLowerReviews, tileLayerPolicy } from "@/editor/tileLayerPolicy";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { store } from "@/project/store";
import {
  classifyTileAlpha,
  EMPTY_ALPHA,
  OPAQUE_ALPHA,
  scanTileAlpha,
  summarizeTileAlphaScan,
  unknownTileAlphaScan,
  type TileAlphaClass,
} from "@/project/tileAlphaScan";
import type { TilesetDef } from "@/project/types";

const TILE_SIZE = 4;
const TILES_PER_ROW = 4;
const SHEET_WIDTH = TILE_SIZE * TILES_PER_ROW;
const SHEET_HEIGHT = TILE_SIZE;
const TILE_PIXELS = TILE_SIZE * TILE_SIZE;

/** 4칸짜리 합성 시트: [0] 완전 불투명, [1] 반투명 절반, [2] 완전 빈 칸, [3] 가장자리 한 픽셀만 부드러움. */
function syntheticSheet(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(SHEET_WIDTH * SHEET_HEIGHT * 4);
  const setAlpha = (tile: number, dx: number, dy: number, alpha: number): void => {
    const x = tile * TILE_SIZE + dx;
    const index = (dy * SHEET_WIDTH + x) * 4;
    rgba[index] = 120;
    rgba[index + 1] = 120;
    rgba[index + 2] = 120;
    rgba[index + 3] = alpha;
  };
  for (let dy = 0; dy < TILE_SIZE; dy += 1) {
    for (let dx = 0; dx < TILE_SIZE; dx += 1) {
      setAlpha(0, dx, dy, 255);
      // 절반은 완전 투명, 절반은 알파 128 — "뚫린 투명" 과 "반투명" 을 한 칸에 섞는다.
      setAlpha(1, dx, dy, dy < 2 ? 0 : 128);
      setAlpha(2, dx, dy, 0);
      setAlpha(3, dx, dy, 255);
    }
  }
  // 16px 중 1px 만 반투명 = 비불투명 비율 6.25% → softEdge 상한과 정확히 같은 값.
  setAlpha(3, 0, 0, 128);
  return rgba;
}

const SHEET_GEOMETRY = {
  width: SHEET_WIDTH,
  height: SHEET_HEIGHT,
  tileSize: TILE_SIZE,
  tilesPerRow: TILES_PER_ROW,
  count: 4,
};

function customTileset(overrides: Partial<TilesetDef> = {}): TilesetDef {
  return {
    id: "tileset_custom_scan",
    name: "업로드 칩셋",
    image: { type: "uploaded", id: "img_custom_scan" },
    kind: "custom",
    tileSize: TILE_SIZE,
    tilesPerRow: TILES_PER_ROW,
    count: 4,
    passability: [15, 15, 15, 15],
    priority: ["lower", "lower", "lower", "lower"],
    terrain: [0, 0, 0, 0],
    ...overrides,
  } as TilesetDef;
}

// ── 1. 순수 판정 ────────────────────────────────────────────────────────────

describe("scanTileAlpha — 합성 픽셀 버퍼(브라우저 없이)", () => {
  it("불투명·부분 투명·완전 빈 칸·가장자리만 부드러운 칸을 서로 다르게 판정한다", () => {
    const scan = scanTileAlpha(syntheticSheet(), SHEET_GEOMETRY);
    expect(scan.status).toBe("scanned");
    const classes = scan.samples.map((sample) => sample.cls);
    expect(classes).toEqual<TileAlphaClass[]>(["opaque", "partial", "empty", "softEdge"]);
  });

  it("실측 픽셀 수를 그대로 보고한다 — 사용자가 근거를 보고 고른다", () => {
    const scan = scanTileAlpha(syntheticSheet(), SHEET_GEOMETRY);
    const [opaque, half, empty, soft] = scan.samples;
    expect(opaque).toMatchObject({ opaquePixels: TILE_PIXELS, softPixels: 0, emptyPixels: 0, coverage: 1 });
    // 절반 알파 128: 완전 투명 8px + 반투명 8px, 커버리지는 절반.
    expect(half).toMatchObject({ opaquePixels: 0, softPixels: 8, emptyPixels: 8, coverage: 0.5 });
    expect(empty).toMatchObject({ opaquePixels: 0, softPixels: 0, emptyPixels: TILE_PIXELS, coverage: 0 });
    expect(soft).toMatchObject({ opaquePixels: 15, softPixels: 1, emptyPixels: 0, coverage: 1 });
  });

  it("띠 경계는 실측 빈 구간에 있다 — 249는 불투명이 아니고 8은 비어 있다", () => {
    expect(OPAQUE_ALPHA).toBe(250);
    expect(EMPTY_ALPHA).toBe(8);
    const counts = (alpha: number) => {
      const rgba = new Uint8ClampedArray(TILE_PIXELS * 4);
      for (let i = 0; i < TILE_PIXELS; i += 1) rgba[i * 4 + 3] = alpha;
      return scanTileAlpha(rgba, { ...SHEET_GEOMETRY, width: TILE_SIZE, tilesPerRow: 1, count: 1 }).samples[0];
    };
    expect(counts(250).opaquePixels).toBe(TILE_PIXELS);
    expect(counts(249).softPixels).toBe(TILE_PIXELS);
    expect(counts(8).emptyPixels).toBe(TILE_PIXELS);
    expect(counts(9).softPixels).toBe(TILE_PIXELS);
  });

  it("거의 빈 칸(커버리지 ≤ 0.15)은 부분 투명과 따로 분류한다", () => {
    // 실측 근거: 0 이 아닌 최저 커버리지들이 0.043·0.109·0.121·0.129 로 붙어 있고
    // 그다음이 0.156 이다. 그 사이를 가르는 값이 0.15 다.
    expect(classifyTileAlpha({ opaquePixels: 33, softPixels: 0, emptyPixels: 223, totalPixels: 256, coverage: 33 / 256 }))
      .toBe("mostlyEmpty");
    expect(classifyTileAlpha({ opaquePixels: 40, softPixels: 0, emptyPixels: 216, totalPixels: 256, coverage: 40 / 256 }))
      .toBe("partial");
  });

  it("가장자리 다듬기(비불투명 ≤ 6.25%)는 하위 배치가 안전하므로 partial 이 아니다", () => {
    // 실측: 실제 시트에서 비불투명 픽셀 수는 2·4·5·6·7·8·11·12·16 에 몰려 있다.
    const softEdge = classifyTileAlpha({ opaquePixels: 240, softPixels: 16, emptyPixels: 0, totalPixels: 256, coverage: 1 });
    expect(softEdge).toBe("softEdge");
    const holed = classifyTileAlpha({ opaquePixels: 239, softPixels: 0, emptyPixels: 17, totalPixels: 256, coverage: 239 / 256 });
    expect(holed).toBe("partial");
  });

  it("버퍼가 이미지보다 작으면 모른다고 답한다 — 불투명으로 추측하지 않는다", () => {
    const scan = scanTileAlpha(new Uint8ClampedArray(8), SHEET_GEOMETRY);
    expect(scan.status).toBe("unknown");
    expect(scan.samples).toHaveLength(0);
  });

  it("요약은 부류별 칸 수를 센다", () => {
    expect(summarizeTileAlphaScan(scanTileAlpha(syntheticSheet(), SHEET_GEOMETRY))).toMatchObject({
      opaque: 1,
      partial: 1,
      empty: 1,
      softEdge: 1,
      mostlyEmpty: 0,
      unknown: 0,
    });
  });
});

// ── 브라우저 배선용 캔버스 스텁 ─────────────────────────────────────────────

type CanvasStub = {
  getImageDataCalls: number;
  imageLoads: number;
  /** getImageData 가 던지게 만들어 CORS 오염을 흉내 낸다. */
  taint: boolean;
  /** 이미지 로드를 실패시킨다. */
  failLoad: boolean;
  pixels: Uint8ClampedArray;
};

function installCanvasStub(): { stub: CanvasStub; restore: () => void } {
  const stub: CanvasStub = {
    getImageDataCalls: 0,
    imageLoads: 0,
    taint: false,
    failLoad: false,
    pixels: syntheticSheet(),
  };
  const realCreateElement = document.createElement.bind(document);
  const createElement = ((tagName: string, options?: ElementCreationOptions) => {
    const element = realCreateElement(tagName as "canvas", options);
    if (tagName !== "canvas") return element;
    (element as HTMLCanvasElement).getContext = ((kind: string) => {
      if (kind !== "2d") return null;
      return {
        drawImage: () => {},
        getImageData: () => {
          stub.getImageDataCalls += 1;
          if (stub.taint) throw new Error("SecurityError: tainted canvas");
          // 실제 getImageData 는 매번 새 사본을 준다. 호출자가 색상 키를 제자리에서
          // 적용하므로 스텁도 사본을 줘야 한다(공유 버퍼면 호출 간에 오염된다).
          return { data: stub.pixels.slice(), width: SHEET_WIDTH, height: SHEET_HEIGHT };
        },
      };
    }) as HTMLCanvasElement["getContext"];
    return element;
  }) as typeof document.createElement;
  document.createElement = createElement;

  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string | null = null;
    naturalWidth = SHEET_WIDTH;
    naturalHeight = SHEET_HEIGHT;
    width = SHEET_WIDTH;
    height = SHEET_HEIGHT;
    set src(_value: string) {
      stub.imageLoads += 1;
      // 로드 완료는 마이크로태스크로 — 실제 브라우저와 같은 비동기 순서를 유지한다.
      queueMicrotask(() => (stub.failLoad ? this.onerror?.() : this.onload?.()));
    }
  }
  const realImage = globalThis.Image;
  (globalThis as { Image: unknown }).Image = StubImage;

  return {
    stub,
    restore: () => {
      document.createElement = realCreateElement;
      (globalThis as { Image: unknown }).Image = realImage;
    },
  };
}

describe("커스텀 칩셋 감지 — 캐시·비변형·정직한 저하", () => {
  let canvas: ReturnType<typeof installCanvasStub>;

  beforeEach(() => {
    store.replace(createBlankProject());
    clearCustomChipsetAlphaCache();
    canvas = installCanvasStub();
  });

  afterEach(() => {
    canvas.restore();
    clearCustomChipsetAlphaCache();
  });

  function registerUploaded(dataUrl: string): void {
    store.update((project) => {
      project.assets.uploaded.img_custom_scan = {
        id: "img_custom_scan",
        name: "custom.png",
        kind: "chipset",
        dataUrl,
      } as never;
    });
  }

  // ── 2. 비변형 ─────────────────────────────────────────────────────────────

  it("감지가 검토 목록을 채워도 타일셋 메타는 그대로다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    const tileset = customTileset();
    await ensureCustomChipsetAlphaScan(tileset);

    const before = JSON.stringify({
      priority: tileset.priority,
      tileMeta: tileset.tileMeta ?? null,
      passability: tileset.passability,
    });
    const reviews = backgroundlessLowerReviews(tileset, {
      classOf: (tile) => cachedCustomChipsetAlphaScan(tileset)?.samples[tile]?.cls ?? null,
    });
    // 뚫린 투명이 있는 1번 칸만 검토 대상이다.
    expect(reviews.map((review) => review.tile)).toEqual([1]);
    expect(reviews[0]?.detected).toBe("partial");
    expect(JSON.stringify({
      priority: tileset.priority,
      tileMeta: tileset.tileMeta ?? null,
      passability: tileset.passability,
    })).toBe(before);
  });

  it("가장자리만 부드러운 칸과 완전히 빈 칸은 검토 목록을 오염시키지 않는다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    const tileset = customTileset();
    await ensureCustomChipsetAlphaScan(tileset);
    const reviews = backgroundlessLowerReviews(tileset, {
      classOf: (tile) => cachedCustomChipsetAlphaScan(tileset)?.samples[tile]?.cls ?? null,
    });
    expect(reviews.some((review) => review.tile === 2)).toBe(false);
    expect(reviews.some((review) => review.tile === 3)).toBe(false);
  });

  it("근거 문장에 실측 커버리지와 픽셀 수가 들어간다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    const tileset = customTileset();
    const scan = await ensureCustomChipsetAlphaScan(tileset);
    const policy = tileLayerPolicy(tileset, 1, {
      classOf: (tile) => scan.samples[tile]?.cls ?? null,
      sampleOf: (tile) => scan.samples[tile] ?? null,
    });
    expect(policy.source).toBe("detected");
    expect(policy.transparent).toBe(true);
    expect(policy.reason).toContain("커버리지 50%");
    expect(policy.reason).toContain("투명 8px");
  });

  // ── 3. 캐시 ───────────────────────────────────────────────────────────────

  it("같은 이미지는 한 번만 스캔한다(캐시 히트)", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    const tileset = customTileset();
    await ensureCustomChipsetAlphaScan(tileset);
    await ensureCustomChipsetAlphaScan(tileset);
    await ensureCustomChipsetAlphaScan(customTileset());
    expect(canvas.stub.getImageDataCalls).toBe(1);
  });

  it("동시에 요청해도 한 번만 스캔한다 — 큰 아틀라스를 렌더마다 다시 읽지 않는다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    const tileset = customTileset();
    await Promise.all([
      ensureCustomChipsetAlphaScan(tileset),
      ensureCustomChipsetAlphaScan(tileset),
      ensureCustomChipsetAlphaScan(tileset),
    ]);
    expect(canvas.stub.imageLoads).toBe(1);
  });

  it("이미지가 바뀌면 캐시가 무효화되고 다시 스캔한다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    const tileset = customTileset();
    await ensureCustomChipsetAlphaScan(tileset);
    expect(canvas.stub.getImageDataCalls).toBe(1);

    // 같은 타일셋, 다른 이미지 바이트 → 다른 캐시 키.
    registerUploaded("data:image/png;base64,BBBBBBBB");
    await ensureCustomChipsetAlphaScan(tileset);
    expect(canvas.stub.getImageDataCalls).toBe(2);
  });

  it("아틀라스 기하가 바뀌어도 캐시가 무효화된다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    await ensureCustomChipsetAlphaScan(customTileset());
    await ensureCustomChipsetAlphaScan(customTileset({ tileSize: 8, count: 2 }));
    expect(canvas.stub.getImageDataCalls).toBe(2);
  });

  // ── 3-b. 투명색 키(color key) ────────────────────────────────
  //
  // 런타임은 `transparentColor` 를 베이크 시점에 키아웃하지만 `tilesetImageUrl` 은 키아웃 이전
  // 바이트를 준다. 스캔이 같은 키를 적용하지 않으면 마젠타 배경 시트는 전부 불투명으로 읽혀
  // 정작 투명한 칸이 검토 목록에서 사라진다 — 가장 위험한 거짓 음성이다.

  /** 알파는 전부 255, 반은 마젠타(#ff00ff) 배경인 칸 하나짜리 시트. */
  function magentaBackedSheet(): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(SHEET_WIDTH * SHEET_HEIGHT * 4);
    for (let y = 0; y < SHEET_HEIGHT; y += 1) {
      for (let x = 0; x < SHEET_WIDTH; x += 1) {
        const index = (y * SHEET_WIDTH + x) * 4;
        const magenta = x % TILE_SIZE < 2; // 칸마다 왜쪽 절반이 배경색
        rgba[index] = magenta ? 255 : 60;
        rgba[index + 1] = magenta ? 0 : 60;
        rgba[index + 2] = magenta ? 255 : 60;
        rgba[index + 3] = 255; // 알파로는 투명한 것이 하나도 없다
      }
    }
    return rgba;
  }

  it("투명색 키로 배경을 만든 칩셋은 부분 투명으로 잡힌다 — 알파만 보면 전부 불투명이다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    canvas.stub.pixels = magentaBackedSheet();

    // 키 지정 없이 읽으면: 알파가 전부 255 이니 모든 칸이 opaque — 검토할 것이 없다고 말한다.
    const untagged = await ensureCustomChipsetAlphaScan(customTileset());
    expect(untagged.samples.map((sample) => sample.cls)).toEqual(["opaque", "opaque", "opaque", "opaque"]);

    // 같은 바이트, `transparentColor` 만 붙이면 런타임과 같은 답이 나와야 한다.
    const keyed = customTileset({ transparentColor: "#FF00FF" });
    const scan = await ensureCustomChipsetAlphaScan(keyed);
    expect(scan.status).toBe("scanned");
    // 칸마다 절반(8/16px)이 키아웃되므로 쯤리 부분 투명이다.
    expect(scan.samples.map((sample) => sample.cls)).toEqual(["partial", "partial", "partial", "partial"]);
    expect(scan.samples[0]?.emptyPixels).toBe(TILE_PIXELS / 2);

    // 그리고 그 칸들이 실제로 검토 목록에 오른다.
    const reviews = backgroundlessLowerReviews(keyed, {
      classOf: (tile) => cachedCustomChipsetAlphaScan(keyed)?.samples[tile]?.cls ?? null,
    });
    expect(reviews.map((review) => review.tile)).toEqual([0, 1, 2, 3]);
  });

  it("투명색만 바뀌어도 캐시가 무효화된다 — 같은 이미지를 다른 답으로 재해석한다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    canvas.stub.pixels = magentaBackedSheet();
    await ensureCustomChipsetAlphaScan(customTileset());
    await ensureCustomChipsetAlphaScan(customTileset({ transparentColor: "#FF00FF" }));
    expect(canvas.stub.getImageDataCalls).toBe(2);
  });

  it("스캔은 원본 픽셀 버팜를 오염시키지 않는다 — 키아웃은 사본에서만 일어난다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    canvas.stub.pixels = magentaBackedSheet();
    await ensureCustomChipsetAlphaScan(customTileset({ transparentColor: "#FF00FF" }));
    // 마젠타 픽셀의 알파가 원본에선 그대로 255 여야 한다(제자리 수정 금지).
    expect(canvas.stub.pixels[3]).toBe(255);
  });

  it("스캔이 끝나면 이벤트를 쏜다 — 검토 목록이 그때 다시 그려진다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    const seen: string[] = [];
    const listener = (event: Event): void => {
      seen.push(String((event as CustomEvent<{ tilesetId?: string }>).detail?.tilesetId));
    };
    window.addEventListener(CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT, listener);
    try {
      await ensureCustomChipsetAlphaScan(customTileset());
    } finally {
      window.removeEventListener(CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT, listener);
    }
    expect(seen).toEqual(["tileset_custom_scan"]);
  });

  // ── 4. 정직한 저하 ────────────────────────────────────────────────────────

  it("CORS 오염 이미지는 unknown 이다 — opaque 로 낙관하지 않는다", async () => {
    registerUploaded("https://other.example/chipset.png");
    canvas.stub.taint = true;
    const scan = await ensureCustomChipsetAlphaScan(customTileset());
    expect(scan.status).toBe("unknown");
    expect(scan.unknownReason).toContain("교차 출처");
    expect(scan.samples).toHaveLength(0);
  });

  it("오염된 칩셋의 타일은 '알 수 없음' 으로 표시되고 불투명이라 말하지 않는다", async () => {
    registerUploaded("https://other.example/chipset.png");
    canvas.stub.taint = true;
    const tileset = customTileset();
    await ensureCustomChipsetAlphaScan(tileset);
    const policy = tileLayerPolicy(tileset, 0, { classOf: () => "unknown" });
    expect(policy.detected).toBe("unknown");
    expect(policy.reason).toContain("알 수 없습니다");
    // 모른다고 해서 투명하다고 주장하지도 않는다 — 자동 재분류가 생기면 안 된다.
    expect(policy.transparent).toBe(false);
  });

  it("이미지 로드 실패도 unknown 이다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    canvas.stub.failLoad = true;
    const scan = await ensureCustomChipsetAlphaScan(customTileset());
    expect(scan.status).toBe("unknown");
    expect(scan.unknownReason).toContain("불러오지 못했습니다");
  });

  it("unknown 결과도 캐시된다 — 실패한 이미지를 매 렌더마다 다시 때리지 않는다", async () => {
    registerUploaded("data:image/png;base64,AAAA");
    canvas.stub.failLoad = true;
    await ensureCustomChipsetAlphaScan(customTileset());
    await ensureCustomChipsetAlphaScan(customTileset());
    expect(canvas.stub.imageLoads).toBe(1);
    expect(unknownTileAlphaScan("x").status).toBe("unknown");
  });

  // ── 5. 내장 칩셋 경로 불변 ────────────────────────────────────────────────

  it("내장 칩셋은 스캔하지 않는다 — 생성된 투명 목록이 정본이다", async () => {
    const bundled = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    const scan = await ensureCustomChipsetAlphaScan(bundled);
    expect(scan.status).toBe("unknown");
    expect(canvas.stub.imageLoads).toBe(0);
    expect(cachedCustomChipsetAlphaScan(bundled)).toBeNull();
  });

  it("감지를 주입해도 내장 칩셋 판정은 바뀌지 않는다", () => {
    const bundled = defaultTileset();
    const spy = vi.fn(() => "partial" as const);
    // 잔디 240 은 생성 목록상 불투명이다. 감지가 뭐라 하든 내장 경로는 흔들리지 않는다.
    const policy = tileLayerPolicy(bundled, 240, { classOf: spy });
    expect(policy.transparent).toBe(false);
    expect(policy.kind).toBe("opaqueFloor");
    expect(policy.detected).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
