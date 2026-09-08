import { describe, expect, it } from "vitest";
import {
  computeMapViewport,
  formatViewportContextBlock,
  mapRegionForContext,
  mapRegionImagePayload,
} from "@/ai/mapViewportContext";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { defaultAiConfig } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";

describe("computeMapViewport", () => {
  const map = { id: "map_a", width: 40, height: 30 };

  it("centers on camera world mid and reports visible tile rect", () => {
    // tileSize 16: 보이는 월드 사각형 320×240 → 20×15 칸, 좌상단 (160,80) = 타일 (10,5)
    const snap = computeMapViewport(map, {
      worldLeftPx: 160,
      worldTopPx: 80,
      worldWidthPx: 320,
      worldHeightPx: 240,
      tileSize: 16,
    });
    expect(snap.mapId).toBe("map_a");
    // world center (320, 200) / 16 → tile (20, 12)
    expect(snap.centerX).toBe(20);
    expect(snap.centerY).toBe(12);
    // maxSpan 16: visible was 20×15 → clamped
    expect(snap.w).toBeLessThanOrEqual(16);
    expect(snap.h).toBeLessThanOrEqual(16);
    expect(snap.x).toBeGreaterThanOrEqual(0);
    expect(snap.x + snap.w).toBeLessThanOrEqual(40);
  });

  it("clamps to map bounds near origin", () => {
    const snap = computeMapViewport(map, {
      worldLeftPx: 0,
      worldTopPx: 0,
      worldWidthPx: 64,
      worldHeightPx: 64,
      tileSize: 16,
    });
    expect(snap.centerX).toBe(2);
    expect(snap.centerY).toBe(2);
    expect(snap.x).toBe(0);
    expect(snap.y).toBe(0);
    expect(snap.w).toBe(4);
    expect(snap.h).toBe(4);
  });

  it("uses the zoom-corrected worldView so the reported center is the visual center", () => {
    // 실측 회귀(줌 2): scroll(400,300), 캔버스 1133×700 → worldView.x = 400 + 1133/2 - 1133/4 = 683.25.
    // 옛 입력 모양은 worldLeft=scrollX 라 중심을 (42,29)로 보고했다 — 실제 시각 중심은 (60,40)으로 18칸/11칸 어긋났다.
    const big = { id: "map_big", width: 200, height: 200 };
    const snap = computeMapViewport(big, {
      worldLeftPx: 683.25,
      worldTopPx: 475,
      worldWidthPx: 566.5,
      worldHeightPx: 350,
      tileSize: 16,
    });
    expect(snap.centerX).toBe(60);
    expect(snap.centerY).toBe(40);
    expect(snap.x).toBeLessThanOrEqual(60);
    expect(snap.x + snap.w).toBeGreaterThan(60);
    expect(snap.y).toBeLessThanOrEqual(40);
    expect(snap.y + snap.h).toBeGreaterThan(40);
  });
});

describe("mapRegionForContext / formatViewportContextBlock", () => {
  it("uses viewport clip when map matches", () => {
    const map = { id: "m", width: 50, height: 50 };
    const region = mapRegionForContext(map, {
      mapId: "m",
      centerX: 20,
      centerY: 10,
      x: 12,
      y: 4,
      w: 16,
      h: 12,
    });
    expect(region).toEqual({ x: 12, y: 4, w: 16, h: 12 });
  });

  it("falls back to top-left when no viewport", () => {
    const map = { id: "m", width: 50, height: 50 };
    expect(mapRegionForContext(map, null)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it("formats Korean viewport block with center coords", () => {
    const text = formatViewportContextBlock(
      { mapId: "map_market", centerX: 7, centerY: 4, x: 2, y: 1, w: 10, h: 8 },
      "장터",
    );
    // 마지막 칸은 x+w-1 / y+h-1 — 반열림 끝값(12,9)은 영역에 없는 칸이라 찍히면 모델이 한 칸 밀린다.
    expect(text).toContain("(2,1)~(11,8)");
    expect(text).not.toContain("(2,1)~(12,9)");
    expect(text).toContain("(7, 4)");
    expect(text).toContain("map_market");
    expect(text).toContain("장터");
  });
});

describe("buildSystemPrompt with viewport", () => {
  it("summarizes around viewport instead of always (0,0)", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    // paint a unique lower tile far from origin so grid summary differs
    const farX = 18;
    const farY = 18;
    map.lowerTiles[farY * map.width + farX] = 222;

    const without = buildSystemPrompt(project, { currentMapId: mapId, budgetChars: 50_000 });
    expect(without).toContain("좌상단");

    const withVp = buildSystemPrompt(project, {
      currentMapId: mapId,
      budgetChars: 50_000,
      viewport: {
        mapId,
        centerX: farX,
        centerY: farY,
        x: farX - 4,
        y: farY - 4,
        w: 8,
        h: 8,
      },
    });
    expect(withVp).toContain("뷰포트");
    expect(withVp).toContain(`(${farX}, ${farY})`);
    expect(withVp).not.toContain("좌상단 일부만 표시(뷰포트 없음)");
  });
});

describe("mapRegionImagePayload", () => {
  it("exports lower/upper grids for vision render", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    map.lowerTiles[0] = 240;
    map.upperTiles[1] = 237;
    const payload = mapRegionImagePayload(project, mapId, { x: 0, y: 0, w: 2, h: 1 });
    expect(payload).not.toBeNull();
    expect(payload!.lower[0]![0]).toBe(240);
    expect(payload!.upper[0]![1]).toBe(237);
    expect(payload!.tilesetId).toBe(map.tilesetId);
  });
});

describe("AssistantSession viewport user turn", () => {
  it("prepends viewport block to the user message text", async () => {
    const { AssistantSession } = await import("@/ai/assistantSession");
    const project = createBlankProject();
    const mapId = project.startMapId;
    const session = new AssistantSession(project, {
      contextOptions: {
        currentMapId: mapId,
        viewport: {
          mapId,
          centerX: 5,
          centerY: 6,
          x: 1,
          y: 2,
          w: 8,
          h: 6,
        },
      },
      chat: async () => ({
        message: { role: "assistant", content: "ok" },
        finishReason: "stop",
      }),
    });
    await session.sendUserMessage("여기 나무 심어줘");
    const user = session.getMessages().find((m) => m.role === "user");
    expect(typeof user?.content).toBe("string");
    expect(String(user?.content)).toContain("화면 중앙 타일");
    expect(String(user?.content)).toContain("(5, 6)");
    expect(String(user?.content)).toContain("여기 나무 심어줘");
  });

  it.each([
    { reference: "explicit viewport", requestText: "화면 오른쪽 위에 숲을깔라", hasViewSpec: true },
    { reference: "unspecified direction", requestText: "오른쪽 위에 숲을깔라", hasViewSpec: false },
    { reference: "map despite screen reference", requestText: "화면을 참고해서 맵 오른쪽 위에 숲을깔라", hasViewSpec: false },
    { reference: "quoted sign text", requestText: "표지판 문구를 정확히 「화면 오른쪽 위에 숲을깔라」로 만들어 줘.", hasViewSpec: false },
    { reference: "separate objects", requestText: "화면 오른쪽에 연못을 만들고 위에 나무를 심어 줘.", hasViewSpec: false },
  ])("uses visible-camera geometry, not the 16-tile clip, only for $reference", async ({ requestText, hasViewSpec }) => {
    const { AssistantSession } = await import("@/ai/assistantSession");
    const project = createBlankProject();
    const mapId = project.startMapId;
    // Keep both the visible frame and context clip inside the actual map.
    project.maps[mapId] = { ...createBlankMap("Viewport test", 40, 30), id: mapId };
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 1 },
      declareIntent: fixedDeclarer({ mode: "modify" }),
      contextOptions: {
        currentMapId: mapId,
        viewport: {
          mapId,
          centerX: 20,
          centerY: 12,
          x: 12,
          y: 4,
          w: 16,
          h: 16,
          viewX: 10,
          viewY: 4,
          viewW: 20,
          viewH: 12,
        },
      },
      chat: async () => ({
        message: { role: "assistant", content: "ok" },
        finishReason: "stop",
      }),
    });
    await session.sendUserMessage(requestText);
    // Inspect the real turn's machine-consumed obligation, not prompt wording.
    expect(session["turnImplicitSpec"]).toBeNull();
    const spec = session["turnViewSpec"];
    if (hasViewSpec) {
      expect(spec?.mapId).toBe(mapId);
      // The clip's northeast quadrant is (20,4) 8x8; the camera's is 10x6.
      expect(spec?.assets.map(({ kind, x, y, w, h }) => ({ kind, x, y, w, h }))).toEqual([
        { kind: "prop", x: 20, y: 4, w: 10, h: 6 },
      ]);
    } else {
      expect(spec).toBeNull();
    }
  });
});
