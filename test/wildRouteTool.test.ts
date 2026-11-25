import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { JsonSchema, ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE, COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import type { ProposedCall } from "@/ai/assistantSession";
import { applyVocabularyCardEdits, callsWithVocabularyEdits, hasVocabularyEdits, reassembleSelectedProposalProject, renderVocabularyCardList, vocabularyCardsData, type VocabularyCardEdit } from "@/editor/panels/aiChatPanel";
import type { Project } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { eligibleEncounterEntries } from "@/player/encounters";
import { canMove } from "@/project/collision";
import { startSession } from "@/project/session";
import { isolateTimers } from "./mergedTeardown";

// test/toolsMapRegionMove.test.ts
// move_region 계약: 잘라내기+붙여넣기. 세 가지가 이 툴의 존재 이유이고 각각 아래 케이스가 잠근다.
// (1) 겹치는 같은-맵 이동에서 목적지에 쓴 칸은 비우지 않는다. (2) 원본 비우기는 layers 범위를
// 지킨다. (3) 원본 비우기도 통행 보장 칸(시작 위치·transfer 목적지)의 기록자다.
describe("toolsMapRegionMove", () => {
  isolateTimers();
  const SRC = "map_move_src";
  const DST = "map_move_dst";
  function context(size = 12): ToolContext {
    const context: ToolContext = { project: createBlankProject() };
    for (const [id, name] of [[SRC, "원본"], [DST, "대상"]] as const) {
      const created = runTool(context, "create_map", { name, width: size, height: size, id });
      expect(created.ok, created.summary).toBe(true);
    }
    return context;
  }
  /** 영역 각 칸에 고유 타일 id 를 심는다 — 이동 결과를 칸 단위로 식별하기 위한 픽스처. */
  function paintUnique(context: ToolContext, mapId: string, rect: { x: number; y: number; w: number; h: number }): void {
    const map = context.project.maps[mapId];
    for (let dy = 0; dy < rect.h; dy += 1) {
      for (let dx = 0; dx < rect.w; dx += 1) {
        const index = (rect.y + dy) * map.width + rect.x + dx;
        const serial = dy * rect.w + dx;
        map.lowerTiles[index] = 200 + serial;
        map.upperTiles[index] = 100 + serial;
      }
    }
  }
  function lowerAt(context: ToolContext, mapId: string, x: number, y: number): number {
    const map = context.project.maps[mapId];
    return map.lowerTiles[y * map.width + x];
  }
  function upperAt(context: ToolContext, mapId: string, x: number, y: number): number {
    const map = context.project.maps[mapId];
    return map.upperTiles[y * map.width + x];
  }
  describe("move_region", () => {
    it("스키마가 strict 제공자 규약(oneOf 없음, array는 items, object는 properties)을 지킨다", () => {
      const tool = getTool("move_region");
      expect(tool, "move_region 툴이 등록되어 있어야 한다").toBeDefined();
      if (!tool) return;
      expect(tool.mode).toBe("write");
      const visit = (node: JsonSchema, path: string): void => {
        expect(node.oneOf, `${path}: oneOf 금지`).toBeUndefined();
        if (node.type === "array") expect(node.items, `${path}: array는 items 필요`).toBeDefined();
        if (node.type === "object") expect(node.properties, `${path}: object는 properties 필요`).toBeDefined();
        for (const [key, child] of Object.entries(node.properties ?? {})) visit(child, `${path}.${key}`);
        if (node.items) visit(node.items, `${path}[]`);
      };
      visit(tool.parameters, "parameters");
    });

    it("정확한 이름으로 find_tools 하면 스키마가 돌아온다", () => {
      const ctx = context();
      const found = runTool(ctx, "find_tools", { query: "move_region" });
      expect(found.ok, found.summary).toBe(true);
      expect(JSON.stringify(found.data)).toContain("move_region");
    });

    it("다른 맵으로 옮기면 목적지에 찍히고 원본은 잔디로 비워진다", () => {
      const ctx = context();
      paintUnique(ctx, SRC, { x: 2, y: 3, w: 3, h: 2 });
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 2, y: 3, w: 3, h: 2 },
        to: { mapId: DST, x: 6, y: 7 },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(lowerAt(ctx, DST, 6, 7)).toBe(200);
      expect(upperAt(ctx, DST, 8, 8)).toBe(105);
      // 원본은 비워진다 — 기본 fill 은 clear_region 과 같은 잔디다.
      expect(lowerAt(ctx, SRC, 2, 3)).toBe(TILE.GRASS);
      expect(upperAt(ctx, SRC, 2, 3)).toBe(TILE.EMPTY);
      expect(lowerAt(ctx, SRC, 4, 4)).toBe(TILE.GRASS);
    });

    it("fill:empty 는 원본 하위 레이어를 빈 칸으로 비운다", () => {
      const ctx = context();
      paintUnique(ctx, SRC, { x: 1, y: 1, w: 2, h: 2 });
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 1, y: 1, w: 2, h: 2 },
        to: { mapId: DST, x: 5, y: 5 },
        fill: "empty",
      });
      expect(result.ok, result.summary).toBe(true);
      expect(lowerAt(ctx, SRC, 1, 1)).toBe(TILE.EMPTY);
      expect(result.summary).toContain("빈 칸");
    });

    it("같은 맵에서 겹치게 옮겨도 목적지에 쓴 칸은 비우지 않는다", () => {
      const ctx = context();
      // 3×1 을 오른쪽으로 한 칸 — 목적지 두 칸이 원본과 겹친다.
      paintUnique(ctx, SRC, { x: 2, y: 5, w: 3, h: 1 });
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 2, y: 5, w: 3, h: 1 },
        to: { mapId: SRC, x: 3, y: 5 },
      });
      expect(result.ok, result.summary).toBe(true);
      // 옮긴 내용이 그대로 살아 있어야 한다(원본 rect 를 통째로 지우면 여기가 잔디가 된다).
      expect(lowerAt(ctx, SRC, 3, 5)).toBe(200);
      expect(lowerAt(ctx, SRC, 4, 5)).toBe(201);
      expect(lowerAt(ctx, SRC, 5, 5)).toBe(202);
      // 겹치지 않은 원본 첫 칸만 비워진다.
      expect(lowerAt(ctx, SRC, 2, 5)).toBe(TILE.GRASS);
    });

    it("layers:upper 는 상위만 옮기고 원본 바닥을 보존한다", () => {
      const ctx = context();
      paintUnique(ctx, SRC, { x: 4, y: 4, w: 2, h: 1 });
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 4, y: 4, w: 2, h: 1 },
        to: { mapId: SRC, x: 8, y: 4 },
        layers: "upper",
      });
      expect(result.ok, result.summary).toBe(true);
      expect(upperAt(ctx, SRC, 8, 4)).toBe(100);
      expect(upperAt(ctx, SRC, 4, 4)).toBe(TILE.EMPTY);
      // 계단만 옮겼으므로 원래 자리 바닥에 구멍이 나지 않는다.
      expect(lowerAt(ctx, SRC, 4, 4)).toBe(200);
      // 목적지 바닥도 건드리지 않는다.
      expect(lowerAt(ctx, SRC, 8, 4)).not.toBe(200);
    });

    it("맵 밖 from/to 는 region-out-of-bounds 로 거절한다", () => {
      const ctx = context();
      const badFrom = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 10, y: 10, w: 5, h: 5 },
        to: { mapId: SRC, x: 0, y: 0 },
      });
      expect(badFrom.ok).toBe(false);
      expect(badFrom.summary).toContain("12×12");
      const badTo = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 0, y: 0, w: 3, h: 3 },
        to: { mapId: SRC, x: 11, y: 11 },
      });
      expect(badTo.ok).toBe(false);
      expect(badTo.summary).toContain("12×12");
    });

    it("제자리 이동은 invalid-args 로 거절한다", () => {
      const ctx = context();
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 2, y: 2, w: 2, h: 2 },
        to: { mapId: SRC, x: 2, y: 2 },
      });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("오프셋");
    });

    it("다른 맵으로 이벤트를 옮기라는 요청은 거절한다", () => {
      const ctx = context();
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 2, y: 2, w: 2, h: 2 },
        to: { mapId: DST, x: 5, y: 5 },
        withEvents: true,
      });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("같은 맵");
    });

    it("withEvents 는 id 를 보존하며 이벤트를 옮긴다", () => {
      const ctx = context();
      const created = runTool(ctx, "place_npc", { mapId: SRC, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_move_me" });
      expect(created.ok, created.summary).toBe(true);
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 3, y: 3, w: 1, h: 1 },
        to: { mapId: SRC, x: 7, y: 3 },
        withEvents: true,
      });
      expect(result.ok, result.summary).toBe(true);
      const events = ctx.project.maps[SRC].events;
      expect(events.filter((event) => event.id === "ev_move_me")).toHaveLength(1);
      const moved = events.find((event) => event.id === "ev_move_me");
      expect({ x: moved?.x, y: moved?.y }).toEqual({ x: 7, y: 3 });
    });

    it("withEvents 없이 옮기면 남은 이벤트를 경고로 알린다", () => {
      const ctx = context();
      const created = runTool(ctx, "place_npc", { mapId: SRC, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_stays" });
      expect(created.ok, created.summary).toBe(true);
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 3, y: 3, w: 1, h: 1 },
        to: { mapId: SRC, x: 7, y: 3 },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps[SRC].events.find((event) => event.id === "ev_stays")).toMatchObject({ x: 3, y: 3 });
      expect(result.diff?.warnings.join("\n")).toContain("ev_stays");
    });

    it("원본 쪽 시작 위치는 통행 불가로 비워지지 않고 경고로 보고된다", () => {
      const ctx = context();
      expect(runTool(ctx, "set_start_position", { mapId: SRC, x: 2, y: 2 }).ok).toBe(true);
      paintUnique(ctx, SRC, { x: 2, y: 2, w: 2, h: 1 });
      const result = runTool(ctx, "move_region", {
        from: { mapId: SRC, x: 2, y: 2, w: 2, h: 1 },
        to: { mapId: DST, x: 6, y: 6 },
        fill: "empty",
      });
      expect(result.ok, result.summary).toBe(true);
      // 빈 칸(-1)은 통행 불가라 시작 위치 칸은 원래 타일로 되돌아온다.
      expect(lowerAt(ctx, SRC, 2, 2)).toBe(200);
      expect(result.diff?.warnings.join("\n")).toContain("시작 위치");
      // 보호되지 않은 이웃 칸은 정상적으로 비워진다.
      expect(lowerAt(ctx, SRC, 3, 2)).toBe(TILE.EMPTY);
    });
  });
});

// test/vocabCardEditV3.test.ts
// 어휘 프로포절 카드 인라인 편집 (타일 툴 v3 설계 축 6 — V3B).
// 고정하는 계약: (1) data.cards가 카드 UI로 렌더된다(AI 추정 표기 + 사실 배지 + 편집 필드
// testid ai-vocab-card-<n>/ai-vocab-edit-<field>-<n>) (2) 편집값이 수락 시 커밋되는 값 —
// 편집된 args 재조립(UXD 부분 수락 재실행 패턴)이 origin:"user"와 함께 프로젝트에 반영된다.
describe("vocabCardEditV3", () => {
  isolateTimers();
  // 어휘 카드는 합본 마을 하네스 그룹(석벽 9분할)을 편집한다 — 정리 전 빈 프로젝트처럼 합본 마을 시작 맵에서 잰다.
  const blankCombinedTownProject = () => withRetiredCombinedTownMaps(createBlankProject());
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  // propose_tile_vocabulary를 실제 실행해 ProposedCall 모양의 픽스처를 만든다.
  function proposeCall(project: Project): { call: ProposedCall; groupId: string } {
    const groupId = project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups![0].id;
    const args = {
      items: [{ kind: "group", groupId, name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }],
    };
    const ctx: ToolContext = { project: structuredClone(project) };
    const result = runTool(ctx, "propose_tile_vocabulary", structuredClone(args));
    expect(result.ok, result.summary).toBe(true);
    return { call: { name: "propose_tile_vocabulary", args, summary: result.summary, result, destructive: false }, groupId };
  }
  describe("어휘 카드 렌더 + 인라인 편집", () => {
    it("data.cards가 카드로 렌더되고(AI 추정/사실 배지/편집 필드) 편집 이벤트가 편집값으로 수집된다", () => {
      const project = blankCombinedTownProject();
      const { call } = proposeCall(project);
      expect(vocabularyCardsData(call)?.cards).toHaveLength(1);

      const edits = new Map<number, VocabularyCardEdit>();
      const rendered = renderVocabularyCardList(project, call, 1, (cardIndex, field, value) => {
        const entry = edits.get(cardIndex) ?? {};
        entry[field] = value;
        edits.set(cardIndex, entry);
      });
      expect(rendered).not.toBeNull();
      const root = rendered!.element as unknown as FakeElement;
      const card = findByTestId(root, "ai-vocab-card-1") as unknown as FakeElement;
      expect(card).toBeTruthy();
      expect(card.textContent).toContain("AI 추정"); // 추정 표기(원칙 0)
      expect(card.textContent).toContain("사실"); // 결정론 사실 배지 병기

      const nameInput = findByTestId(root, "ai-vocab-edit-name-1") as unknown as FakeElement;
      nameInput.value = "돌담";
      nameInput.dispatchEvent(new Event("change"));
      const layerSelect = findByTestId(root, "ai-vocab-edit-layerHome-1") as unknown as FakeElement;
      layerSelect.value = "perCell";
      layerSelect.dispatchEvent(new Event("change"));
      const roleSelect = findByTestId(root, "ai-vocab-edit-role-1") as unknown as FakeElement;
      expect(roleSelect).toBeTruthy();
      expect(findByTestId(root, "ai-vocab-edit-patternKind-1")).toBeTruthy();

      expect(edits.get(0)).toMatchObject({ name: "돌담", layerHome: "perCell" });
    });

    it("편집값이 수락 시 커밋되는 값이다 — 재조립 재실행 경로가 편집된 이름/layerHome을 origin:user로 반영", () => {
      const project = blankCombinedTownProject();
      const { call, groupId } = proposeCall(project);
      const editsByCall = new Map<number, Map<number, VocabularyCardEdit>>([
        [0, new Map([[0, { name: "돌담", layerHome: "upper" }]])],
      ]);
      expect(hasVocabularyEdits(editsByCall)).toBe(true);
      const effective = callsWithVocabularyEdits([call], editsByCall);
      expect(effective).not.toBe([call]);
      const editedItem = (effective[0].args.items as Record<string, unknown>[])[0];
      expect(editedItem).toMatchObject({ name: "돌담", layerHome: "upper" });
      // 원본 call.args는 오염되지 않는다(구조 복제).
      expect((call.args.items as Record<string, unknown>[])[0].name).toBe("석벽");

      // 수락 경로와 동일한 재조립 재실행(reassembleSelectedProposalProject) — 커밋값 검증.
      const reassembled = reassembleSelectedProposalProject(project, effective, [true]);
      expect(reassembled.ok).toBe(true);
      if (!reassembled.ok) return;
      const group = reassembled.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups!.find((entry) => entry.id === groupId)!;
      expect(group).toMatchObject({ name: "돌담", layerHome: "upper", origin: "user" });
    });

    it("applyVocabularyCardEdits: 빈 이름은 무시하고 patternKind ''는 제거로 취급한다", () => {
      const args = { items: [{ kind: "group", name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }] };
      const next = applyVocabularyCardEdits(args, new Map([[0, { name: "   ", patternKind: "" }]]));
      const item = (next.items as Record<string, unknown>[])[0];
      expect(item.name).toBe("석벽");
      expect(item.patternKind).toBeUndefined();
    });
  });
});

describe("wildRouteTool", () => {
  isolateTimers();
  function monsterProject() {
    const choice = newProjectChoiceById("monster-collect")!;
    const project = createNewProjectSeed(choice.packId, "도로 시험");
    const troopId = project.database.troops[0]!.id;
    return { context: { project }, troopId };
  }
  describe("author_wild_route", () => {
    it("lays a road, forest and tall-grass patches whose encounters only fire inside the grass", () => {
      const { context, troopId } = monsterProject();
      const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
      expect(created.ok, created.summary).toBe(true);
      const result = runTool(context, "author_wild_route", {
        mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
      });
      expect(result.ok, result.summary).toBe(true);
      const map = context.project.maps.map_route_1!;
      const data = result.data as { grassPatches: { id: string; x: number; y: number; w: number; h: number }[]; trainerSpots: unknown[] };
      expect(data.grassPatches.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));
      expect(map.lowerTiles.filter(tile => tile !== TILE.GRASS).length).toBeGreaterThan(40);
      expect(map.upperTiles.some(tile => tile !== TILE.EMPTY)).toBe(true);
      expect(map.encounterTable?.every(entry => entry.conditions?.locationId?.startsWith("loc_wild_grass_"))).toBe(true);
      const session = startSession(context.project);
      const patch = data.grassPatches[0]!;
      expect(eligibleEncounterEntries(map, session, { x: patch.x, y: patch.y })).not.toHaveLength(0);
      expect(eligibleEncounterEntries(map, session, { x: 14, y: 21 })).toHaveLength(0);
    });

    it("refuses to repaint an authored map without replace", () => {
      const { context } = monsterProject();
      // 몬스터 프로젝트의 시작 맵은 monster_overworld(#2232)라 도로 시공 대상이 아니다 — 시공 가능한 새 맵에서 본다.
      expect(runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 }).ok).toBe(true);
      const map = context.project.maps.map_route_1!;
      map.upperTiles[0] = 5;
      const result = runTool(context, "author_wild_route", { mapId: "map_route_1", exits: [{ x: 0, y: 1 }, { x: map.width - 1, y: 1 }] });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("replace:true");
    });

    // 2026-09-24 포켓몬풍 r3: 동굴 파이프라인이 먼저 만든 링크 문(1,1)이 author_wild_route(replace)의
    // 숲 우물에 갇혀 autoplay 가 1번 도로 → 동굴 문으로 못 넘어갔다(check.txt 막힘). 시공은 기존
    // transfer 문까지 흙길로 이어야 한다.
    it("keeps a pre-existing transfer door walk-connected when repainting", () => {
      const { context, troopId } = monsterProject();
      const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
      expect(created.ok, created.summary).toBe(true);
      const targetMap = context.project.startMapId;
      const door = runTool(context, "upsert_event", {
        mapId: "map_route_1",
        event: {
          id: "ev_map_route_1_link", x: 1, y: 1,
          pages: [{ trigger: { kind: "playerTouch" }, conditions: [], priority: "below", overlapForbidden: false, commands: [{ kind: "transfer", mapId: targetMap, x: 1, y: 1 }] }],
        },
      });
      expect(door.ok, door.summary).toBe(true);
      const result = runTool(context, "author_wild_route", {
        mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));

      // 남쪽 출구 (14,21) 에서 문 (1,1) 까지 실제로 걸어 닿는지 BFS 로 확인한다.
      const map = context.project.maps.map_route_1!;
      const seen = new Set<number>([21 * map.width + 14]);
      const queue: Array<{ x: number; y: number }> = [{ x: 14, y: 21 }];
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = p.x + dx, ny = p.y + dy, key = ny * map.width + nx;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key)) continue;
          if (!canMove(context.project, map, p.x, p.y, nx, ny)) continue;
          seen.add(key); queue.push({ x: nx, y: ny });
        }
      }
      expect(seen.has(1 * map.width + 1)).toBe(true);
    });
  });
  describe("monster-collect brief prompt", () => {
    // #2232: 새 수집 게임은 build_monster_game(mode:create)이 검토된 캠페인 전체(도로 풀숲·트레이너 포함)를 짓는다.
    it("names the campaign builder so its schema is exposed on the first turn", async () => {
      const { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } = await import("@/editor/welcomeGenrePresets");
      const preset = welcomeGenrePresetById("monster-collect")!;
      const prompt = buildWelcomeGenrePresetPrompt(preset, {
        version: 1, presetId: "monster-collect", summary: "첫 체육관까지",
        answers: { scope: { question: "범위", label: "첫 제작 범위", text: "첫 도전장", source: "user" } },
      } as never);
      expect(prompt).toContain("build_monster_game");
    });
  });
});
