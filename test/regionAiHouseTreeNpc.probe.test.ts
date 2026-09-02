import { declaredIntent } from "./intentFixture";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { TILE } from "@/project/defaults/constants";
import { approvedVocabulary, unapprovedVocabulary } from "@/project/tileVocabulary";
import { buildRegionTaskMessage, ensureRegionPlacementHarness, runRegionTask, type RegionTaskDeps } from "@/editor/regionTask/runRegionTask";
import { AssistantSession } from "@/ai/assistantSession";
import { loadAiConfig, configForLiteModel, AI_CONFIG_STORAGE_KEY, DEFAULT_BASE_URL } from "@/ai/llmClient";
import { toOpenAiTools } from "@/editor/tools";
import { beginAssistantToolDomainTurn, computeActiveToolDomains } from "@/editor/assistantToolMode";
import type { Project } from "@/project/types";
import fs from "node:fs";

const MAP_ID = "map_probe";
const REGION = { x: 2, y: 2, width: 12, height: 10 };

function makeMapProject(): Project {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: MAP_ID, name: "프로브", width: 20, height: 16 });
  expect(created.ok).toBe(true);
  context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
  context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
  return context.project;
}

function loadLLMKey(): { apiKey: string; baseUrl: string } | null {
  try {
    const raw = fs.readFileSync(".env.local", "utf8");
    const key = raw.match(/^\s*VITE_LLM_API_KEY\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
    const base = raw.match(/^\s*VITE_LLM_API_URL\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") || DEFAULT_BASE_URL;
    if (!key) return null;
    return { apiKey: key, baseUrl: base.startsWith("http") ? base : DEFAULT_BASE_URL };
  } catch {
    return null;
  }
}

describe("region AI house/tree/npc probe", () => {
  it("reports approved vocab + direct tool success for place_props/place_npc/build_house_kit", () => {
    const project = makeMapProject();
    const tilesetId = project.maps[MAP_ID].tilesetId;
    const tileset = project.tilesets[tilesetId];
    const approved = approvedVocabulary(tileset);
    const unapproved = unapprovedVocabulary(tileset, 20);
    const report = {
      tilesetId,
      groups: (tileset.tileGroups ?? []).map((g) => ({ id: g.id, name: g.name, origin: (g as { origin?: string }).origin })),
      approvedGroups: approved.groups.map((g) => ({ id: g.id, role: g.role })),
      approvedTilesSample: approved.tiles.slice(0, 15),
      unapprovedSample: unapproved,
    };
    // eslint-disable-next-line no-console
    console.log("VOCAB", JSON.stringify(report, null, 2));

    const ctx = { project };
    const house = runTool(ctx, "build_house_kit", {
      mapId: MAP_ID,
      kitId: "blue-stone",
      wings: [{ x: 3, y: 3, w: 6, h: 6 }],
    });
    console.log("HOUSE", house.ok, house.summary);

    ensureRegionPlacementHarness(tileset);
        const props = runTool(ctx, "place_props", {
      mapId: MAP_ID,
      area: { x: 10, y: 3, w: 6, h: 6 },
      material: "침엽수",
      count: 1,
      seed: 1,
    });
    console.log("PROPS", props.ok, props.summary, "material=침엽수");

    const npc = runTool(ctx, "place_npc", {
      mapId: MAP_ID,
      x: 12,
      y: 12,
      name: "테스트주민",
      pages: [{ lines: ["안녕"] }],
    });
    console.log("NPC", npc.ok, npc.summary);
    if (npc.ok) {
      const ev = ctx.project.maps[MAP_ID].events?.find((e) => e.pages?.[0]?.name === "테스트주민");
      console.log("NPC_GRAPHIC", JSON.stringify(ev?.pages?.[0]?.graphic ?? null));
      expect(ev?.pages?.[0]?.graphic && "transparent" in (ev.pages[0].graphic as object)
        ? (ev.pages[0].graphic as { transparent?: boolean }).transparent
        : false).not.toBe(true);
    }

    // domain exposure for region message
    const msg = buildRegionTaskMessage("집과 나무 1개, npc 배치", "프로브", MAP_ID, REGION, tileset);
    const intent = declaredIntent({ space: "outdoor", useSelection: true, tools: ["author_house", "place_props", "place_npc"] });
    beginAssistantToolDomainTurn(intent);
    const domains = computeActiveToolDomains(intent);
    console.log("MSG_HEAD", msg.slice(0, 80));
    const tools = toOpenAiTools(undefined, { domains }).map((t) => t.function.name);
    console.log("DOMAINS", [...domains]);
    console.log("HAS_TOOLS", {
      place_props: tools.includes("place_props"),
      place_npc: tools.includes("place_npc"),
      build_house_kit: tools.includes("build_house_kit"),
      toolCount: tools.length,
    });

    expect(house.ok).toBe(true);
    expect(props.ok).toBe(true);
    expect(npc.ok).toBe(true);
    expect(tools).toContain("place_props");
    expect(tools).toContain("place_npc");
    expect(tools).toContain("build_house_kit");
  });

  it("live region task LLM: 집과 나무 1개 npc 배치", async () => {
    const creds = loadLLMKey();
    if (!creds) {
      console.log("SKIP live LLM: no VITE_LLM_API_KEY");
      return;
    }
    const project = makeMapProject();
    // inject config into localStorage for loadAiConfig
    const storage = new Map<string, string>();
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({
        authMode: "apiKey",
        apiKey: creds.apiKey,
        baseUrl: creds.baseUrl,
        model: "stub-model",
        liteModel: "google/gemini-3.1-flash-lite",
        maxTokens: 8192,
        maxToolCalls: 40,
        reasoningEffort: "low",
      }),
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
        removeItem: (k: string) => storage.delete(k),
        clear: () => storage.clear(),
      },
    });

    const toolCalls: string[] = [];
    const deps: RegionTaskDeps = {
      getProject: () => project,
      applyProject: (p) => {
        Object.assign(project, p);
      },
      createSession: (p, mapId) =>
        new AssistantSession(p, {
          config: configForLiteModel(loadAiConfig()),
          contextOptions: { currentMapId: mapId },
        }),
    };

    const result = await runRegionTask(
      {
        mapId: MAP_ID,
        region: REGION,
        instruction: "집과 나무 1개, npc 배치",
        onEvent: (ev) => {
          if (ev.type === "tool_call") toolCalls.push(ev.name);
          if (ev.type === "status") console.log("STATUS", ev.text);
        },
      },
      deps,
    );

    // 영역 작업 자체의 pending/apply 계약은 채팅 승인 카드와 별개다. 라이브 결과를
    // 실제 프로젝트에 반영해 배치 결과를 검증한다.
    result.pending?.apply();

    const map = project.maps[MAP_ID];
    const upperNonEmpty = map.upperTiles.filter((t) => t >= 0 && t !== TILE.EMPTY).length;
    const lowerDiff = map.lowerTiles.filter((t) => t !== TILE.GRASS).length;
    const events = map.events ?? [];
    console.log(
      "LIVE_RESULT",
      JSON.stringify(
        {
          ok: result.ok,
          applied: result.applied,
          changedCells: result.changedCells,
          changedEvents: result.changedEvents,
          clippedCells: result.clippedCells,
          proposedCalls: result.proposedCalls,
          error: result.error,
          toolCalls,
          assistantText: result.assistantText?.slice(0, 400),
          upperNonEmpty,
          lowerDiff,
          events: events.map((e) => ({
            id: e.id,
            name: e.pages?.[0]?.name ?? e.id,
            x: e.x,
            y: e.y,
            graphic: e.pages?.[0]?.graphic ?? null,
          })),
        },
        null,
        2,
      ),
    );

    expect(result.ok).toBe(true);
    expect(toolCalls.length).toBeGreaterThan(0);
    // After harness: tree placement and non-transparent NPC are expected when lite model cooperates.
    const treeCalls = toolCalls.filter((name) => name === "place_props").length;
    console.log("TREE_CALLS", treeCalls, "upperNonEmpty", upperNonEmpty);
    if (toolCalls.includes("place_props") || toolCalls.includes("build_house_kit")) {
      expect(result.applied || result.changedCells + result.changedEvents > 0).toBe(true);
    }
    const villager = events.find((event) => event.pages?.[0]?.graphic && !("transparent" in (event.pages[0].graphic as object) && (event.pages[0].graphic as { transparent?: boolean }).transparent));
    if (toolCalls.includes("place_npc") || toolCalls.includes("make_villager")) {
      expect(events.length).toBeGreaterThan(0);
      // graphic may still be door object; at least one non-transparent character-ish event preferred
      console.log("NON_TRANSPARENT_EVENTS", events.filter((e) => {
        const g = e.pages?.[0]?.graphic as { transparent?: boolean } | undefined;
        return g && !g.transparent;
      }).length);
    }
    void villager;
  }, 180_000);
});
