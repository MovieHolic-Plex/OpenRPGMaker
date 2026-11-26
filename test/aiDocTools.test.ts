import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { resolveCommandKind } from "@/editor/tools/eventCompile";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { TILE, DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { Project, AiDocument, GameEvent, GameMap } from "@/project/types";
import { type ToolContext, ToolError } from "@/editor/tools/types";
import { deserialize, serialize } from "@/project/io";
import { getTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { formatViewportContextBlock, VIEWPORT_PASSABILITY_MARK, VIEWPORT_PASSABILITY_ORIGIN_PREFIX, type MapViewportSnapshot } from "@/ai/mapViewportContext";
import { isolateTimers } from "./mergedTeardown";
import { aiGateNoticeToPlainText, commitGateNotice, eventCommandGateNotice, turnErrorNotice, MAX_GATE_REASONS } from "@/ai/aiGateNotice";
import { showAiGateNotice } from "@/editor/ui/aiGateModal";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom } from "./fakeDom";
import { AssistantSession } from "@/ai/assistantSession";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";

describe("aiDocTools", () => {
  isolateTimers();
  // test/agentToolFollowups.test.ts
  //
  // 2026-08-28 실측(project oprn-4f65d09fb1, "음 다른맵을 더 만들자")에서 같이 드러난 결함들:
  //  - evaluate_game_quality 가 맵 **개수만** 세어 잔디 단색 맵 2장을 통과시켰다.
  //  - create_transfer_pair 가 3연속 실패했는데 안내는 원인과 무관하게 "주변 구조물·통행 지형 확인"이었다.
  //  - place_npc 가 kind:"dialogue" 로 한 번 튕겨 라운드를 낭비했다.
  describe("agentToolFollowups", () => {
    isolateTimers();
    function ctxWithMap(mapId: string, name = "숲길", size = 8): { project: Project } {
      const ctx = { project: createEmptyToolProject() };
      const result = runTool(ctx, "create_map", { id: mapId, name, width: size, height: size }, { dryRun: false });
      expect(result.ok).toBe(true);
      return ctx;
    }
    type QualityData = {
      verdict: { blocked: boolean };
      coverage: { content: { emptyMaps: number } };
    };
    const emptyMapIssueFor = (
      result: { issues?: readonly { code: string; mapId?: string; severity: string }[] },
      mapId: string,
    ) =>
      result.issues?.find((issue) => issue.code === "empty-map" && issue.mapId === mapId);
    describe("evaluate_game_quality — 빈 맵 감지", () => {
      /** 시작 맵 + 저작 중 만든 빈 맵. 실측 상황(마을 프로젝트에 잔디밭이 추가됨)과 같은 모양. */
      function ctxWithStartAndEmptyMap(): { project: Project } {
        const ctx = ctxWithMap("m_start", "마을");
        ctx.project.maps.m_start!.lowerTiles[0] = TILE.PATH; // 시작 맵은 저작된 상태로 둔다
        expect(runTool(ctx, "create_map", { id: "m_field", name: "숲길", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
        return ctx;
      }

      it("저작 중 만든 빈 맵을 차단 오류로 올리고 개수를 보고한다", () => {
        const result = runTool(ctxWithStartAndEmptyMap(), "evaluate_game_quality", {}, { dryRun: true });

        expect(result.ok).toBe(true);
        const data = result.data as QualityData;
        expect(data.coverage.content.emptyMaps).toBe(1);
        expect(data.verdict.blocked).toBe(true);
        expect(result.summary).toContain("빈 맵");
        expect(emptyMapIssueFor(result, "m_field")?.severity).toBe("error");
      });

      it("시작 맵만 비어 있는 새 프로젝트는 차단하지 않는다(warning)", () => {
        const ctx = { project: createBlankProject() };
        const startMapId = ctx.project.startMapId;
        const result = runTool(ctx, "evaluate_game_quality", {}, { dryRun: true });

        expect(emptyMapIssueFor(result, startMapId)?.severity).toBe("warning");
        expect((result.data as QualityData).verdict.blocked).toBe(false);
      });

      it("지형을 칠하면 빈 맵 오류가 사라진다", () => {
        const ctx = ctxWithStartAndEmptyMap();
        ctx.project.maps.m_field!.lowerTiles[0] = TILE.PATH;
        const result = runTool(ctx, "evaluate_game_quality", {}, { dryRun: true });

        expect(emptyMapIssueFor(result, "m_field")).toBeUndefined();
        expect((result.data as QualityData).coverage.content.emptyMaps).toBe(0);
        expect((result.data as QualityData).verdict.blocked).toBe(false);
      });
    });
    describe("create_transfer_pair — 실패 원인별 안내", () => {
      it("맵 밖 좌표는 맵 크기를 알려준다", () => {
        const ctx = ctxWithMap("m_a");
        runTool(ctx, "create_map", { id: "m_b", name: "여관", width: 8, height: 8 }, { dryRun: false });

        const result = runTool(
          ctx,
          "create_transfer_pair",
          { a: { mapId: "m_a", x: 99, y: 99 }, b: { mapId: "m_b", x: 4, y: 4 } },
          { dryRun: true },
        );

        expect(result.ok).toBe(false);
        const message = result.issues?.map((issue) => issue.message).join(" ") ?? result.summary;
        expect(message).toContain("A:");
        expect(message).toContain("맵 밖");
        expect(message).toContain("0..7");
        // 원인과 무관하던 종전 안내는 더 이상 나오지 않는다.
        expect(message).not.toContain("get_map_region으로 주변 구조물과 통행 지형을 확인");
      });

      it("실패한 쪽이 A/B 중 어디인지 짚는다", () => {
        const ctx = ctxWithMap("m_a");
        runTool(ctx, "create_map", { id: "m_b", name: "여관", width: 8, height: 8 }, { dryRun: false });

        const result = runTool(
          ctx,
          "create_transfer_pair",
          { a: { mapId: "m_a", x: 4, y: 4 }, b: { mapId: "m_b", x: -99, y: -99 } },
          { dryRun: true },
        );

        expect(result.ok).toBe(false);
        const message = result.issues?.map((issue) => issue.message).join(" ") ?? result.summary;
        expect(message).toContain("B:");
        expect(message).not.toContain("A:");
      });
    });
    describe("resolveCommandKind — 커맨드 kind 오표기 흡수", () => {
      it("정규 이름은 그대로 둔다", () => {
        expect(resolveCommandKind("text")).toBe("text");
        expect(resolveCommandKind("setSelfSwitch")).toBe("setSelfSwitch");
      });

      it("실측 오표기 dialogue 를 text 로 해석한다", () => {
        expect(resolveCommandKind("dialogue")).toBe("text");
      });

      it("구분자·대소문자만 다른 표기를 되돌린다", () => {
        expect(resolveCommandKind("change_gold")).toBe("changeGold");
        expect(resolveCommandKind("Change-Gold")).toBe("changeGold");
        expect(resolveCommandKind("TEXT")).toBe("text");
      });

      it("모르는 이름은 null 로 남겨 오류를 내게 한다", () => {
        expect(resolveCommandKind("teleportPlayerToTheMoon")).toBeNull();
        expect(resolveCommandKind("")).toBeNull();
      });
    });
    describe("place_npc — dialogue 표기로도 통과한다", () => {
      it("kind:\"dialogue\" 를 text 로 정규화해 배치가 성공한다", () => {
        const ctx = ctxWithMap("m_town", "마을", 12);
        const result = runTool(
          ctx,
          "place_npc",
          {
            mapId: "m_town",
            name: "상점 주인",
            x: 5,
            y: 5,
            pages: [{ commands: [{ kind: "dialogue", body: "어서 오세요" }] }],
          },
          { dryRun: false },
        );

        expect(result.ok).toBe(true);
        const placed = ctx.project.maps.m_town!.events.at(-1);
        expect(placed?.pages?.[0]?.commands?.some((command) => command.kind === "text")).toBe(true);
      });
    });
  });
  describe("aiDocTools", () => {
    isolateTimers();
    // New projects carry the default tileset instead of the retired EasyRPG interior sheet (2026-10-07 purge).
    const INTERIOR = DEFAULT_TILESET_ID;
    function ctxOf(): ToolContext {
      return { project: createBlankProject() };
    }
    describe("present_doc — AI 리치 문서 툴", () => {
      it("구조화 블록 문서를 만들어 project.aiDocuments에 영속하고 data.document로 반환한다", () => {
        const ctx = ctxOf();
        const result = runTool(ctx, "present_doc", {
          title: "오토타일 블록 안내",
          blocks: [
            { kind: "markdown", text: "## 다크월\n칩셋 6~8열 12~15행" },
            {
              kind: "sheetMap",
              tilesetId: INTERIOR,
              zones: [{ col: 6, row: 12, w: 3, h: 4, label: "다크월" }],
            },
            { kind: "tileBlockCard", tilesetId: INTERIOR, col: 6, row: 12, w: 3, h: 4, title: "다크월 블록", badge: "구현됨" },
            { kind: "paintDemo", tilesetId: INTERIOR, blockCol: 6, blockRow: 12 },
            { kind: "table", headers: ["타일", "역할"], rows: [["368", "오목 코너 소스"]] },
            { kind: "html", src: "<p>자유형 블록</p>" },
          ],
        });
        expect(result.ok).toBe(true);
        const docs = ctx.project.aiDocuments ?? [];
        expect(docs).toHaveLength(1);
        expect(docs[0]!.title).toBe("오토타일 블록 안내");
        expect(docs[0]!.blocks).toHaveLength(6);
        const data = result.data as { document: AiDocument };
        expect(data.document.id).toMatch(/^aidoc_/);
        expect(data.document.blocks[0]).toMatchObject({ kind: "markdown" });
      });

      it("알 수 없는 블록 kind와 없는 타일셋을 거부한다", () => {
        const ctx = ctxOf();
        expect(runTool(ctx, "present_doc", { title: "x", blocks: [{ kind: "video", src: "x" }] }).ok).toBe(false);
        expect(
          runTool(ctx, "present_doc", {
            title: "x",
            blocks: [{ kind: "tileBlockCard", tilesetId: "no_such_tileset", col: 0, row: 0, w: 1, h: 1, title: "t" }],
          }).ok,
        ).toBe(false);
        expect(ctx.project.aiDocuments ?? []).toHaveLength(0);
      });

      it("list_ai_docs가 저장된 문서 목록을 반환한다", () => {
        const ctx = ctxOf();
        runTool(ctx, "present_doc", { title: "문서 1", blocks: [{ kind: "markdown", text: "hello" }] });
        runTool(ctx, "present_doc", { title: "문서 2", blocks: [{ kind: "markdown", text: "world" }] });
        const result = runTool(ctx, "list_ai_docs", {});
        expect(result.ok).toBe(true);
        const data = result.data as { documents: { title: string; blockCount: number }[] };
        expect(data.documents.map((doc) => doc.title)).toEqual(["문서 1", "문서 2"]);
      });

      it("list_ai_docs가 query로 제목·마크다운 본문을 부분일치 검색한다(대소문자 무시)", () => {
        const ctx = ctxOf();
        runTool(ctx, "present_doc", { title: "오토타일 안내", blocks: [{ kind: "markdown", text: "다크월 블록 구조" }] });
        runTool(ctx, "present_doc", { title: "NPC Guide", blocks: [{ kind: "markdown", text: "주민 배치 요령" }] });

        const byTitle = runTool(ctx, "list_ai_docs", { query: "npc" });
        expect(byTitle.ok).toBe(true);
        expect((byTitle.data as { documents: { title: string }[] }).documents.map((doc) => doc.title)).toEqual(["NPC Guide"]);

        const byBody = runTool(ctx, "list_ai_docs", { query: "다크월" });
        expect((byBody.data as { documents: { title: string }[] }).documents.map((doc) => doc.title)).toEqual(["오토타일 안내"]);

        const miss = runTool(ctx, "list_ai_docs", { query: "존재하지않음" });
        expect((miss.data as { documents: unknown[] }).documents).toHaveLength(0);
      });

      it("aiDocuments가 직렬화 왕복에서 보존된다", () => {
        const ctx = ctxOf();
        runTool(ctx, "present_doc", {
          title: "왕복 문서",
          blocks: [
            { kind: "markdown", text: "지속성 테스트" },
            { kind: "tileBlockCard", tilesetId: INTERIOR, col: 0, row: 12, w: 3, h: 4, title: "산울타리" },
          ],
        });
        const restored = deserialize(serialize(ctx.project));
        expect(restored.aiDocuments).toHaveLength(1);
        expect(restored.aiDocuments?.[0]).toMatchObject({ title: "왕복 문서" });
        expect(restored.aiDocuments?.[0]?.blocks).toHaveLength(2);
      });
    });
  });
  describe("aiEventPlacementPassability", () => {
    isolateTimers();
    // AI 배치 툴이 캐릭터형 이벤트(몬스터·추격자·NPC)를 통행 불가 타일에 올리는 버그 계약.
    // RM2K3 의미: action 트리거 이벤트는 벽 위에 있어도 되지만(문·간판), 인접 칸 중 하나는 통행 가능해야 한다.
    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      return { project, map, mapId };
    }
    function setWall(map: GameMap, x: number, y: number): void {
      map.lowerTiles[y * map.width + x] = TILE.WALL;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    /** (cx,cy) 중심 체비셰프 반경 radius 전체를 벽으로 만든다. */
    function wallBlock(map: GameMap, cx: number, cy: number, radius: number): void {
      for (let y = cy - radius; y <= cy + radius; y += 1) {
        for (let x = cx - radius; x <= cx + radius; x += 1) {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          setWall(map, x, y);
        }
      }
    }
    function eventById(map: GameMap, id: string): GameEvent {
      const found = map.events.find((entry) => entry.id === id);
      if (!found) throw new Error(`event not found: ${id}`);
      return found;
    }
    function troopId(project: Project): string {
      const id = project.database.troops[0]?.id;
      if (!id) throw new Error("fixture troop missing");
      return id;
    }
    describe("place_battle_blocker 통행 가능 착지", () => {
      it("벽 위에 몬스터를 요청하면 근처 통행 가능 칸으로 자동 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 5, 5);
        expect(isPassable(project, map, 5, 5)).toBe(false);

        const result = getTool("place_battle_blocker")!.run(project, { mapId, x: 5, y: 5, troopId: troopId(project) });

        const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
        const event = eventById(map, data.eventId);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(data.adjusted).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("반경 5칸이 전부 벽이면 battle-blocker-impassable ToolError", () => {
        const { project, map, mapId } = fixture();
        // nearestPassableCell now searches a clean landing up to radius 5 before failing (#2894), so the blocked area must cover radius 5.
        wallBlock(map, 8, 7, 5);

        let error: unknown;
        try {
          getTool("place_battle_blocker")!.run(project, { mapId, x: 8, y: 7, troopId: troopId(project) });
        } catch (caught) {
          error = caught;
        }
        expect(error).toBeInstanceOf(ToolError);
        expect((error as ToolError).code).toBe("battle-blocker-impassable");
        expect((error as ToolError).message).toContain("(8, 7)");
        expect((error as ToolError).message).toContain("get_map_region");
        expect(map.events).toHaveLength(0);
      });

      it("추격자도 통행 가능 칸으로 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 6, 6);

        const result = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 6, y: 6 } } });

        const data = result.data as { eventId: string; adjusted: boolean };
        const event = eventById(map, data.eventId);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(data.adjusted).toBe(true);
      });
    });
    describe("상호작용 이벤트는 문 의미를 지킨다", () => {
      it("통행 가능 이웃이 있는 벽 위 보물상자는 옮기지 않는다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 4, 4);

        const itemId = project.database.items[0]?.id ?? "item_potion";
        const result = getTool("place_chest")!.run(project, { mapId, x: 4, y: 4, contents: { itemId } });

        const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
        expect([data.x, data.y]).toEqual([4, 4]);
        expect(data.adjusted).toBe(false);
        const event = eventById(map, data.eventId);
        expect([event.x, event.y]).toEqual([4, 4]);
      });

      it("사방이 벽으로 막힌 보물상자는 자동 조정되거나 ToolError", () => {
        const { project, map, mapId } = fixture();
        wallBlock(map, 8, 7, 1);

        const itemId = project.database.items[0]?.id ?? "item_potion";
        let error: ToolError | undefined;
        let data: { eventId: string; x: number; y: number; adjusted: boolean } | undefined;
        try {
          const result = getTool("place_chest")!.run(project, { mapId, x: 8, y: 7, contents: { itemId } });
          data = result.data as typeof data;
        } catch (caught) {
          if (!(caught instanceof ToolError)) throw caught;
          error = caught;
        }
        if (error) {
          expect(error.code).toBe("chest-impassable");
          expect(error.message).toContain("get_map_region");
        } else {
          expect(data?.adjusted).toBe(true);
          const event = eventById(map, data!.eventId);
          expect(isPassable(project, map, event.x, event.y)).toBe(true);
        }
      });

      it("touch 트랩은 밟을 수 있어야 하므로 벽에서 통행 가능 칸으로 옮긴다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 7, 3);

        const result = getTool("place_trap")!.run(project, { mapId, cells: [{ x: 7, y: 3 }], trigger: "touch" });

        const data = result.data as { eventIds: string[]; adjusted: boolean };
        const event = eventById(map, data.eventIds[0]);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(data.adjusted).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });
    });
    describe("이동·복제·upsert 배치", () => {
      it("move_event로 벽으로 옮기면 통행 가능 칸으로 자동 조정한다", () => {
        const { project, map, mapId } = fixture();
        map.events.push({
          id: "ev_walker",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "ev_walker_page",
              name: "주민",
              conditions: [],
              graphic: { transparent: true },
              trigger: { kind: "playerTouch" },
              priority: "below",
              overlapForbidden: false,
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
            },
          ],
        });
        setWall(map, 9, 9);

        const result = getTool("move_event")!.run(project, { mapId, eventId: "ev_walker", x: 9, y: 9 });

        const data = result.data as { x: number; y: number; adjusted: boolean };
        expect(data.adjusted).toBe(true);
        const event = eventById(map, "ev_walker");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("upsert_event로 새 이벤트를 벽에 만들면 자동 조정한다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 2, 6);

        const result = getTool("upsert_event")!.run(project, {
          mapId,
          event: {
            id: "ev_new_guard",
            x: 2,
            y: 6,
            trigger: { kind: "playerTouch" },
            commands: [],
            pages: [
              {
                id: "ev_new_guard_page",
                name: "경비",
                conditions: [],
                graphic: { transparent: true },
                trigger: { kind: "playerTouch" },
                priority: "below",
                overlapForbidden: false,
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        });

        const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
        expect(data.adjusted).toBe(true);
        const event = eventById(map, "ev_new_guard");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
      });

      it("upsert_event 부분 병합은 기존 이벤트 좌표를 절대 바꾸지 않는다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 3, 8);
        map.events.push({
          id: "ev_door",
          x: 3,
          y: 8,
          trigger: { kind: "action" },
          commands: [],
          pages: [],
        });

        getTool("upsert_event")!.run(project, { mapId, event: { id: "ev_door", pages: [] } });

        const event = eventById(map, "ev_door");
        expect([event.x, event.y]).toEqual([3, 8]);
      });
    });
    describe("place_examine_hotspots 도달 가능성", () => {
      it("사방이 벽으로 갇힌 조사 핫스팟은 통행 가능 칸으로 착지하거나 skip 된다", () => {
        const { project, map, mapId } = fixture();
        wallBlock(map, 9, 9, 1);
    globalThis.result = getTool("place_examine_hotspots")!.run(project, {
          mapId,
          hotspots: [{ at: { x: 9, y: 9 }, name: "갇힌 액자", lines: ["먼지가 쌓여 있다."] }],
        });
    globalThis.placed = map.events.filter((event) => event.id.startsWith("ev_examine"));
        for (const event of placed) {
    globalThis.reachable = [
            { x: event.x, y: event.y },
            { x: event.x, y: event.y + 1 },
            { x: event.x, y: event.y - 1 },
            { x: event.x + 1, y: event.y },
            { x: event.x - 1, y: event.y },
          ].some((cell) => isPassable(project, map, cell.x, cell.y));
          expect(reachable).toBe(true);
        }
        expect(result.warnings?.some((warning) => warning.includes("(9, 9)"))).toBe(true);
      });

      it("통행 가능 이웃이 있는 벽 위 조사 핫스팟은 그대로 둔다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 12, 12);

        getTool("place_examine_hotspots")!.run(project, {
          mapId,
          hotspots: [{ at: { x: 12, y: 12 }, name: "벽에 걸린 액자", lines: ["오래된 그림이다."] }],
        });
    globalThis.placed = map.events.filter((event) => event.id.startsWith("ev_examine"));
        expect(placed).toHaveLength(1);
        expect(placed[0].x).toBe(12);
        expect(placed[0].y).toBe(12);
      });
    });
  });
  describe("aiMapContextPassability", () => {
    isolateTimers();
    // 자동 주입 뷰포트 블록이 isPassable 과 같은 판정으로 통행 불가 칸을 기계가 읽을 수 있게 표시하는지.
    // 포맷 계약: `pass:x,y` 다음 h줄이 각 행. 칸마다 한 글자, `#`=불가 `.`=가능.
    // 산문 문구가 아니라 파싱된 마커·좌표만 검증한다.

    const BLOCKED = "#";
    const OPEN = ".";
    const ORIGIN_RE = /^pass:(\d+),(\d+)$/;
    const ROW_RE = /^[.#]+$/;
    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      return { project, map, mapId };
    }
    function setTile(map: GameMap, x: number, y: number, tile: number): void {
      map.lowerTiles[y * map.width + x] = tile;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function parsePassabilityGrid(block: string): {
      originX: number;
      originY: number;
      rows: string[];
    } | null {
      const lines = block.split("\n");
      const originAt = lines.findIndex((line) => ORIGIN_RE.test(line));
      if (originAt < 0) return null;
      const match = ORIGIN_RE.exec(lines[originAt]);
      if (!match) return null;
      const rows: string[] = [];
      for (let i = originAt + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!ROW_RE.test(line)) break;
        rows.push(line);
      }
      if (rows.length === 0) return null;
      return { originX: Number(match[1]), originY: Number(match[2]), rows };
    }
    function markAt(
      grid: { originX: number; originY: number; rows: string[] },
      x: number,
      y: number,
    ): string {
      const row = grid.rows[y - grid.originY];
      if (row === undefined) throw new Error(`row missing for y=${y}`);
      const ch = row[x - grid.originX];
      if (ch === undefined) throw new Error(`col missing for x=${x}`);
      return ch;
    }
    describe("뷰포트 컨텍스트 통행 불가 표시", () => {
      it("물이 있는 뷰포트는 해당 칸을 # 마커로 표시한다", () => {
        const { project, map, mapId } = fixture();
        setTile(map, 2, 1, TILE.WATER);
        setTile(map, 3, 2, TILE.WALL);
        expect(isPassable(project, map, 2, 1)).toBe(false);
        expect(isPassable(project, map, 3, 2)).toBe(false);
        expect(isPassable(project, map, 1, 1)).toBe(true);

        const viewport = {
          mapId,
          centerX: 2,
          centerY: 2,
          x: 1,
          y: 1,
          w: 4,
          h: 3,
        };
        const block = formatViewportContextBlock(viewport, map.name, project);
        const grid = parsePassabilityGrid(block);
        expect(grid).not.toBeNull();
        expect(grid!.originX).toBe(1);
        expect(grid!.originY).toBe(1);
        expect(markAt(grid!, 2, 1)).toBe(BLOCKED);
        expect(markAt(grid!, 3, 2)).toBe(BLOCKED);
        expect(markAt(grid!, 1, 1)).toBe(OPEN);
        expect(markAt(grid!, 4, 3)).toBe(OPEN);
      });

      it("전부 통행 가능한 뷰포트에는 # 마커가 없다", () => {
        const { project, map, mapId } = fixture();
        const viewport = {
          mapId,
          centerX: 3,
          centerY: 3,
          x: 0,
          y: 0,
          w: 5,
          h: 4,
        };
        for (let y = 0; y < viewport.h; y += 1) {
          for (let x = 0; x < viewport.w; x += 1) {
            expect(isPassable(project, map, x, y)).toBe(true);
          }
        }

        const block = formatViewportContextBlock(viewport, map.name, project);
        const grid = parsePassabilityGrid(block);
        expect(grid).not.toBeNull();
        expect(grid!.rows.join("")).not.toContain(BLOCKED);
        expect(grid!.rows.every((row) => [...row].every((ch) => ch === OPEN))).toBe(true);
      });

      it("추가 비용은 칸당 한 글자·행당 한 줄로 묶인다", () => {
        const { project, map, mapId } = fixture();
        setTile(map, 5, 5, TILE.WATER);
        const viewport = {
          mapId,
          centerX: 8,
          centerY: 6,
          x: 2,
          y: 2,
          w: 10,
          h: 8,
        };
        const base = formatViewportContextBlock(viewport, map.name);
        const block = formatViewportContextBlock(viewport, map.name, project);
        const grid = parsePassabilityGrid(block);
        expect(grid).not.toBeNull();
        expect(grid!.rows).toHaveLength(viewport.h);
        for (const row of grid!.rows) {
          expect(row).toHaveLength(viewport.w);
        }
        const added = block.length - base.length;
        const originOverhead = 24;
        expect(added).toBeLessThanOrEqual(viewport.w * viewport.h + viewport.h + originOverhead);
      });
    });
  });
  describe("aiPlacementCopyRegion", () => {
    isolateTimers();
    const SOURCE_MAP_ID = "map_blank_start";
    const TARGET_MAP_ID = "map_copy_target";
    function fixture(): { project: Project; source: GameMap; target: GameMap } {
      const project = createBlankProject();
      getTool("create_map")!.run(project, { id: TARGET_MAP_ID, name: "복사 대상", width: 20, height: 15 });
      return {
        project,
        source: project.maps[SOURCE_MAP_ID],
        target: project.maps[TARGET_MAP_ID],
      };
    }
    function characterEvent(id: string, x: number, y: number): GameEvent {
      return {
        id,
        x,
        y,
        trigger: { kind: "playerTouch" },
        commands: [],
      };
    }
    function setLower(map: GameMap, x: number, y: number, tile: number): void {
      map.lowerTiles[y * map.width + x] = tile;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    describe("copy_map_region 이벤트 통행 가능 착지", () => {
      it("목적 좌표가 물인 캐릭터형 이벤트는 통행 가능 칸에 착지한다", () => {
        const { project, source, target } = fixture();
        source.events.push(characterEvent("ev_source_guard", 3, 3));
        setLower(target, 9, 9, TILE.WATER);
        expect(isPassable(project, target, 9, 9)).toBe(false);

        const result = getTool("copy_map_region")!.run(project, {
          from: { mapId: SOURCE_MAP_ID, x: 2, y: 2, w: 3, h: 3 },
          to: { mapId: TARGET_MAP_ID, x: 8, y: 8 },
          layers: "upper",
          withEvents: true,
        });

        const copiedIds = (result.data as { events: string[] }).events;
        expect(copiedIds).toHaveLength(1);
        const clone = target.events.find((event) => event.id === copiedIds[0]);
        expect(clone).toBeDefined();
        expect(isPassable(project, target, clone!.x, clone!.y)).toBe(true);
      });

      it("실제 place_npc 이벤트를 물 위로 복사하면 통행 가능 칸에 착지시킨다", () => {
        const { project, target } = fixture();
        getTool("place_npc")!.run(project, {
          mapId: SOURCE_MAP_ID,
          x: 3,
          y: 3,
          id: "ev_source_npc",
          name: "강가 주민",
          graphic: { query: "people1" },
          pages: [{ text: "안녕하세요." }],
        });
        setLower(target, 9, 9, TILE.WATER);

        const result = getTool("copy_map_region")!.run(project, {
          from: { mapId: SOURCE_MAP_ID, x: 2, y: 2, w: 3, h: 3 },
          to: { mapId: TARGET_MAP_ID, x: 8, y: 8 },
          layers: "upper",
          withEvents: true,
        });

        const copiedIds = (result.data as { events: string[] }).events;
        const clone = target.events.find((event) => event.id === copiedIds[0]);
        expect(clone).toBeDefined();
        expect(isPassable(project, target, clone!.x, clone!.y)).toBe(true);
        expect([clone!.x, clone!.y]).not.toEqual([9, 9]);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("통행 가능한 평지에서는 모든 이벤트의 상대 좌표를 그대로 보존한다", () => {
        const { project, source, target } = fixture();
        source.events.push(characterEvent("ev_source_left", 3, 4), characterEvent("ev_source_right", 6, 6));

        const result = getTool("copy_map_region")!.run(project, {
          from: { mapId: SOURCE_MAP_ID, x: 2, y: 3, w: 6, h: 5 },
          to: { mapId: TARGET_MAP_ID, x: 10, y: 7 },
          withEvents: true,
        });

        const copiedIds = (result.data as { events: string[] }).events;
        expect(copiedIds).toHaveLength(2);
        expect(target.events.filter((event) => copiedIds.includes(event.id)).map((event) => [event.x, event.y])).toEqual([
          [11, 8],
          [14, 10],
        ]);
        for (const event of target.events.filter((entry) => copiedIds.includes(entry.id))) {
          expect(isPassable(project, target, event.x, event.y)).toBe(true);
        }
      });
    });
    describe("지형 편집으로 고립된 이벤트 경고", () => {
      it("기존 NPC 칸을 물로 칠하면 이벤트 id와 좌표를 경고한다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];
        map.events.push(characterEvent("ev_stranded_guard", 4, 5));

        const result = getTool("paint_tiles")!.run(project, {
          mapId: map.id,
          layer: "lower",
          mode: "cells",
          tile: TILE.WATER,
          cells: [{ x: 4, y: 5 }],
        });

        expect(isPassable(project, map, 4, 5)).toBe(false);
        const warning = result.warnings?.find((entry) => entry.includes("통행 불가"));
        expect(warning).toContain("ev_stranded_guard");
        expect(warning).toContain("(4,5)");
      });

      it("이벤트가 없는 칸은 기존 통행 불가 칸 수 경고 문구를 유지한다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];

        const result = getTool("paint_tiles")!.run(project, {
          mapId: map.id,
          layer: "lower",
          mode: "cells",
          tile: TILE.WATER,
          cells: [{ x: 7, y: 6 }],
        });

        expect(isPassable(project, map, 7, 6)).toBe(false);
        expect(result.warnings).toContain(`경고: 1개 칸이 통행 불가가 되었습니다(${map.id}).`);
      });
    });
  });
  describe("aiPlacementCutsceneCheckpoint", () => {
    isolateTimers();
    // script_cutscene / 맵 진입 체크포인트가 물·벽 위에 서는 버그 계약.
    // 체크포인트는 auto 트리거라 밟을 필요는 없지만 지형 안에 심으면 event-unreachable 린트가 난다.
    // 컷신은 트리거에 따라 갈린다: playerTouch/touch 는 밟을 수 있어야 하고, action 은 인접 통행 가능 칸만 있으면 된다.

    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      return { project, map, mapId };
    }
    function setWater(map: GameMap, x: number, y: number): void {
      map.lowerTiles[y * map.width + x] = TILE.WATER;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function eventById(map: GameMap, id: string): GameEvent {
      const found = map.events.find((entry) => entry.id === id);
      if (!found) throw new Error(`event not found: ${id}`);
      return found;
    }
    function checkpointId(map: GameMap): string {
      return `${map.id}_checkpoint_auto`;
    }
    function placeCheckpoint(project: Project, mapId: string, trapAt: { x: number; y: number }): void {
      getTool("place_trap")!.run(project, {
        mapId,
        cells: [trapAt],
        trigger: "touch",
        respawnCheckpoint: true,
      });
    }
    const SAY_BEAT = { kind: "say" as const, speaker: "나", text: "그날을 기억한다." };
    describe("ensureMapCheckpointEvent 통행 가능 착지", () => {
      it("(0,0)이 물이면 체크포인트 auto 이벤트는 통행 가능 칸에 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 0, 0);
        expect(isPassable(project, map, 0, 0)).toBe(false);

        placeCheckpoint(project, mapId, { x: 5, y: 5 });

        const checkpoint = eventById(map, checkpointId(map));
        expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
      });

      it("일반 맵에서는 체크포인트가 기존처럼 (0,0)에 선다", () => {
        const { project, map, mapId } = fixture();
        expect(isPassable(project, map, 0, 0)).toBe(true);

        placeCheckpoint(project, mapId, { x: 5, y: 5 });

        const checkpoint = eventById(map, checkpointId(map));
        expect([checkpoint.x, checkpoint.y]).toEqual([0, 0]);
      });

      // auto 트리거는 좌표와 무관하게 발동하므로, 좌상단 반경 3이 전부 막혔다고 트랩 배치 전체를
      // 실패시키면 고치려던 버그보다 나쁘다(동굴·두꺼운 벽 맵에서 place_trap 이 통째로 죽는다).
      it("좌상단 반경 3이 전부 막힌 맵에서도 트랩 배치는 성공하고 체크포인트가 남는다", () => {
        const { project, map, mapId } = fixture();
        for (let y = 0; y <= 3; y += 1) {
          for (let x = 0; x <= 3; x += 1) setWater(map, x, y);
        }
        expect(isPassable(project, map, 0, 0)).toBe(false);
        expect(isPassable(project, map, 3, 3)).toBe(false);

        expect(() => placeCheckpoint(project, mapId, { x: 8, y: 8 })).not.toThrow();

        const checkpoint = eventById(map, checkpointId(map));
        expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
        expect(map.events.some((event) => event.id.startsWith("ev_trap"))).toBe(true);
      });
    });
    describe("script_cutscene 통행 가능 착지", () => {
      it("물 위 playerTouch 컷신은 통행 가능 칸에 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 5, 5);
        expect(isPassable(project, map, 5, 5)).toBe(false);

        const result = getTool("script_cutscene")!.run(project, {
          mapId,
          x: 5,
          y: 5,
          trigger: "playerTouch",
          beats: [SAY_BEAT],
        });

        const data = result.data as { eventId: string };
        const event = eventById(map, data.eventId);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
      });

      it("물 위 기존 action 컷신에 playerTouch 페이지를 더하면 이벤트를 통행 가능 칸으로 옮긴다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 5, 5);

        getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_existing_water",
          x: 5,
          y: 5,
          trigger: "action",
          beats: [SAY_BEAT],
        });
        const result = getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_existing_water",
          mode: "append",
          trigger: "playerTouch",
          beats: [{ kind: "say", speaker: "나", text: "밟으면 시작한다." }],
        });

        const event = eventById(map, "ev_existing_water");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(event.pages).toHaveLength(2);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("통행 가능 이웃이 있는 물 위 action 컷신은 작성 좌표를 유지한다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 4, 4);
        expect(isPassable(project, map, 4, 4)).toBe(false);
        expect(isPassable(project, map, 4, 5)).toBe(true);

        const result = getTool("script_cutscene")!.run(project, {
          mapId,
          x: 4,
          y: 4,
          trigger: "action",
          beats: [SAY_BEAT],
        });

        const data = result.data as { eventId: string };
        const event = eventById(map, data.eventId);
        expect([event.x, event.y]).toEqual([4, 4]);
      });
    });
    describe("체크포인트·컷신 기존 이벤트 재사용", () => {
      it("이미 있는 체크포인트/컷신 이벤트는 재사용하고 복제하지 않는다", () => {
        const { project, map, mapId } = fixture();

        placeCheckpoint(project, mapId, { x: 5, y: 5 });
        placeCheckpoint(project, mapId, { x: 6, y: 6 });
        const checkpoints = map.events.filter((event) => event.id === checkpointId(map));
        expect(checkpoints).toHaveLength(1);

        getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_memory",
          x: 8,
          y: 8,
          trigger: "action",
          beats: [SAY_BEAT],
        });
        getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_memory",
          x: 1,
          y: 1,
          trigger: "action",
          beats: [{ kind: "say", speaker: "나", text: "두 번째 장면." }],
        });
        const cutscenes = map.events.filter((event) => event.id === "ev_memory");
        expect(cutscenes).toHaveLength(1);
        expect(cutscenes[0].pages).toHaveLength(1);
        expect(cutscenes[0].pages?.[0].commands).toEqual(expect.arrayContaining([
          expect.objectContaining({ kind: "text", body: "두 번째 장면." }),
        ]));
        expect([cutscenes[0].x, cutscenes[0].y]).toEqual([8, 8]);
      });
    });
  });
});

// 차단 게이트 경고의 순수 부분 — 사유를 요약해 버리지 않는지, append scope 의 구조적 한계를
// 사용자에게 말해 주는지, 모달이 한 장만 뜨고 Escape 로 닫히는지.
//
// 배치 검증 게이트는 없다(영역작업 검증게이트 배제) — 그 고지도 함께 사라졌다.
describe("aiGateNotice", () => {
  isolateTimers();
  describe("aiGateNotice — 사유를 버리지 않는다", () => {
    it("커밋 게이트: 사유가 상한을 넘으면 남은 건수를 마지막 줄에 적는다", () => {
      const messages = Array.from({ length: MAX_GATE_REASONS + 4 }, (_, index) => `오류 ${index}`);
      const notice = commitGateNotice(messages);
      expect(notice.reasons).toHaveLength(MAX_GATE_REASONS);
      expect(notice.reasons.at(-1)).toBe(`…외 ${messages.length - (MAX_GATE_REASONS - 1)}건`);
    });

    it("커밋 게이트: 사유가 비어도 «확인할 수 없다»고 말한다(빈 목록 금지)", () => {
      expect(commitGateNotice([]).reasons).toHaveLength(1);
    });

    it("중복 사유는 접는다 — 같은 문장이 맵마다 반복되면 화면만 밀린다", () => {
      expect(commitGateNotice(["같은 오류", "같은 오류", " 같은 오류 "]).reasons).toEqual(["같은 오류"]);
    });

    it("턴 오류: «찾을 수 없습니다» 계열이면 대상을 고르라고 안내한다", () => {
      const notFound = turnErrorNotice({ message: "제거할 이벤트를 찾을 수 없습니다: ev_9" });
      expect(notFound.nextSteps[0]).toContain("클릭해 고른");
      const other = turnErrorNotice({ message: "네트워크 오류" });
      expect(other.nextSteps[0]).toContain("한 번 더");
    });

    it("이벤트 명령 AI: append scope 는 지우기가 표현 불가라는 사실을 사유에 싣는다", () => {
      const notice = eventCommandGateNotice({ message: "빈 배열입니다.", scope: "append", commandCount: 120 });
      expect(notice.reasons.join("\n")).toContain("120개");
      expect(notice.reasons.join("\n")).toContain("지우기");
      expect(notice.nextSteps.join("\n")).toContain("직접 고른");
    });

    it("이벤트 명령 AI: page scope 는 목록이 그대로임을 알린다", () => {
      const notice = eventCommandGateNotice({ message: "kind 오류", scope: "page", commandCount: 4 });
      expect(notice.headline).toContain("그대로");
      expect(notice.reasons).toEqual(["kind 오류"]);
    });

    it("평문 복사에 사유·다음 행동이 모두 들어간다", () => {
      const text = aiGateNoticeToPlainText(commitGateNotice(["참조 검증 실패: itemId 없음"]));
      expect(text).toContain("[commit-rejected]");
      expect(text).toContain("- 참조 검증 실패: itemId 없음");
      expect(text).toContain("이렇게 해 보세요:");
    });
  });
  describe("showAiGateNotice — 모달", () => {
    let restoreDom: () => void;

    beforeEach(() => {
      resetModalStackForTest();
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom();
      resetModalStackForTest();
    });

    it("사유·다음 행동·게이트 종류를 렌더하고 모달 스택에 등록한다", () => {
      const overlay = showAiGateNotice(commitGateNotice(["[map_a] 참조 검증 실패: itemId 없음"]));
      expect(overlay).not.toBeNull();
      const root = document.body as unknown as Parameters<typeof findByTestId>[0];
      const modal = findByTestId(root, "ai-gate-modal");
      expect(modal).not.toBeNull();
      expect(modal?.dataset.gateKind).toBe("commit-rejected");
      expect(findByTestId(root, "ai-gate-modal-reasons")?.textContent).toContain("itemId 없음");
      expect(findByTestId(root, "ai-gate-modal-steps")).not.toBeNull();
      expect(modalStackDepthForTest()).toBe(1);
    });

    it("닫기 버튼이 모달과 스택 등록을 함께 정리한다", () => {
      showAiGateNotice(turnErrorNotice({ message: "네트워크 오류" }));
      const root = document.body as unknown as Parameters<typeof findByTestId>[0];
      findByTestId(root, "ai-gate-modal-close")?.dispatchEvent(new Event("click"));
      expect(findByTestId(root, "ai-gate-modal")).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("두 번 띄우면 한 장만 남는다 — 뒤엣것만 닫고 앞엣것을 못 읽는 일을 막는다", () => {
      showAiGateNotice(commitGateNotice(["첫 게이트"]));
      showAiGateNotice(turnErrorNotice({ message: "둘째 게이트" }));
      const root = document.body as unknown as Parameters<typeof findByTestId>[0];
      expect(findByTestId(root, "ai-gate-modal")?.dataset.gateKind).toBe("turn-error");
      expect(modalStackDepthForTest()).toBe(1);
    });

    it("원문이 사유와 다를 때만 접히는 원문 영역을 만든다", () => {
      showAiGateNotice(eventCommandGateNotice({ message: "kind 오류", scope: "page", commandCount: 2 }));
      const root = document.body as unknown as Parameters<typeof findByTestId>[0];
      // page scope 는 사유 == 원문이라 중복 영역을 만들지 않는다.
      expect(findByTestId(root, "ai-gate-modal-detail")).toBeNull();
    });
  });
});

// 통행 그리드가 **항상 최신인 턴 컨텍스트에만** 실리는지의 계약.
//
// 시스템 프롬프트는 세션 baseline으로 재조립될 수 있으므로 그리드를 넣으면 현재 draft와
// 모순된다. 모델이 배치에 쓰는 격자는 매 턴 live draft로 만드는 사용자 블록 하나뿐이어야 한다.
describe("aiMapContextPassabilityWiring", () => {
  isolateTimers();
  const CONFIG: AiConfig = {
    authMode: "apiKey",
    baseUrl: "x",
    model: "passability-wiring-model",
    liteModel: "passability-wiring-model",
    apiKey: "sk",
    maxToolCalls: 1,
    maxTokens: 10_000,
    agentMode: "chat",
  };
  function waterProject(): { project: Project; viewport: MapViewportSnapshot } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles[3 * map.width + 3] = TILE.WATER;
    map.upperTiles[3 * map.width + 3] = TILE.EMPTY;
    if (isPassable(project, map, 3, 3)) throw new Error("fixture 실패: (3,3)이 통행 가능하다");
    return {
      project,
      viewport: { mapId: project.startMapId, centerX: 4, centerY: 4, x: 0, y: 0, w: 8, h: 8 },
    };
  }
  function markAt(block: string, viewport: MapViewportSnapshot, x: number, y: number): string {
    const lines = block.split("\n");
    const head = lines.findIndex((line) => line.startsWith(VIEWPORT_PASSABILITY_ORIGIN_PREFIX));
    if (head < 0) throw new Error("통행 그리드가 없다");
    const row = lines[head + 1 + (y - viewport.y)];
    if (row === undefined) throw new Error(`그리드 행이 없다: y=${y}`);
    return row[x - viewport.x] ?? "";
  }
  function stubChat(): { chat: (config: AiConfig, req: ChatRequest) => Promise<ChatResult>; requests: ChatRequest[] } {
    const requests: ChatRequest[] = [];
    return {
      requests,
      chat: async (_config, req) => {
        requests.push(req);
        return { message: { role: "assistant", content: "확인했습니다." }, finishReason: "stop" };
      },
    };
  }
  beforeEach(() => {
    vi.stubEnv("VITE_LLM_API_URL", "");
    vi.stubEnv("VITE_LLM_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  describe("통행 그리드는 항상 최신 턴 컨텍스트에만 실린다", () => {
    it("buildSystemPrompt 의 뷰포트 머리 블록에는 통행 그리드를 넣지 않는다", () => {
      const { project, viewport } = waterProject();

      const prompt = buildSystemPrompt(project, { viewport, currentMapId: viewport.mapId });

      expect(prompt).not.toContain(VIEWPORT_PASSABILITY_ORIGIN_PREFIX);
      expect(prompt).toContain(`## 현재 맵 요약(${project.maps[viewport.mapId].name}`);
    });

    it("AssistantSession 이 턴마다 붙이는 뷰포트 블록도 그리드를 담는다", async () => {
      const { project, viewport } = waterProject();
      const stub = stubChat();
      const session = new AssistantSession(project, {
        config: CONFIG,
        chat: stub.chat,
        contextOptions: {
          getCurrentMapId: () => viewport.mapId,
          getViewport: () => viewport,
        },
      });

      await session.sendUserMessage("여기 NPC 하나 놓아줘");

      const request = stub.requests[0];
      if (!request) throw new Error("LLM 요청이 없다");
      // Grounded originals are appended after the live viewport message. Select the
      // machine grid, not the final user message (which now contains original JSON).
      const grids = request.messages.filter((message) => message.role === "user")
        .map((message) => typeof message.content === "string" ? message.content
          : (message.content ?? []).flatMap((part) => part.type === "text" ? [part.text] : []).join("\n"))
        .filter((content) => content.includes(VIEWPORT_PASSABILITY_ORIGIN_PREFIX));
      expect(grids).toHaveLength(1);
      const content = grids[0];

      expect(content).toContain(VIEWPORT_PASSABILITY_ORIGIN_PREFIX);
      expect(markAt(content, viewport, 3, 3)).toBe(VIEWPORT_PASSABILITY_MARK.blocked);
    });
  });
});
