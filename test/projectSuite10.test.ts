import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { addFollowerToSession, followerPositions, recordFollowerPlayerStep, resetFollowerTrailNearPlayer, charsetFollowerGraphic } from "@/project/followers";
import { startSession } from "@/project/session";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isPassable } from "@/project/collision";
import { isolateTimers } from "./mergedTeardown";
import { buildGameDesignExecution } from "@/project/gameDesignExecution";
import { gameDesignBriefContext, GAME_PRESET_IDS } from "@/project/gameDesignBrief";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById, welcomeGenrePresetDisplayText } from "@/editor/welcomeGenrePresets";
import { interviewBrief } from "./helpers/gameDesignBrief";
import { graftSourceGeometry, uploadedGraftGeometryIn } from "@/assets/tileGrafts";
import { translateTiles } from "@/project/objectStamp";
import type { TilesetDef, EventPage, Project, ItemRecord, LightingState, GameMap, MapNamedLocation } from "@/project/types";
import { ProjectFormatError, deserialize, serialize } from "@/project/io";
import { normalizeItemTransitionState, transitionItemState, transitionItemStates, type ItemTransitionAction, type ItemTransitionState } from "@/project/itemTransitions";
import { lightingGradientParams, type LightingMaskContext, lightingMaskSignature } from "@/player/lighting";
import { lightAtTile, lightFalloffAt, darkenChannel, effectiveDarkness, normalizeLightingState, setSessionLighting } from "@/project/lightingRules";
import { isNpcSight, withinSightRange } from "@/project/npcBehavior";
import { runTool } from "@/editor/tools";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { collectMapLocationReferences, countLocationReferences, repairMapLocationReferences } from "@/project/mapLocationReferences";
import { hasLocationRole, locationRoleRects, locationRoleTag, projectLocationRoles } from "@/project/locationRoles";

describe("followers", () => {
  isolateTimers();
  // J9: 문·계단으로 막 들어와 주인공 뒤 칸이 막혔으면 파티 동료를 주인공 앞·옆에 세우지 않는다.
  // 예전에는 trailBehind 가 앞 칸으로 꺾어 세워서, 첫 걸음에 동료가 주인공을 뚫고 뒤로 튀었다.
  describe("followerDoorEntry", () => {
    isolateTimers();
    function partyAtTopEdge() {
      // 고른 풀밭 위에서 본다 — 2026-10-07 정리 뒤 기본 시작 맵(beodeul_city)에는 막힌 칸이 섞여 있어 옆·뒤 칸 판정이 달라진다.
      const project = startOnRetiredCombinedTown(createBlankProject());
      // J9 는 간격 따르기(spaced)의 계약이다 — #3509 부터 기본은 고전 빵부스러기(breadcrumb)라 짧은 궤적에선 동료가 주인공 칸에 겹친다.
      project.system.companions = { ...project.system.companions, followMode: "spaced" };
      const session = startSession(project);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "미아" });
      // 맵 위 끝에서 아래를 본다 — 뒤(위)는 맵 밖, 계단으로 내려온 자리와 같다.
      session.x = 10;
      session.y = 0;
      return { project, session, map: project.maps[session.currentMapId]! };
    }
    describe("문으로 들어온 직후 동료 자리", () => {
      it("뒤가 막혔으면 앞·옆에 세우지 않고 숨겼다가 첫 걸음에 떠난 칸에 나타난다", () => {
        const { project, session, map } = partyAtTopEdge();
        resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
        expect(session.followerTrail).toEqual([]);
        const world = { project, map };
        expect(followerPositions(session, project.system.companions, world)[0]).toMatchObject({ hidden: true });

        // 첫 걸음: (10,0) 을 떠나 (10,1) 로 — 동료는 주인공이 떠난 칸에 선다(앞에서 뒤로 튀지 않는다).
        recordFollowerPlayerStep(session, { x: 10, y: 0, direction: "down" });
        session.y = 1;
        const placed = followerPositions(session, project.system.companions, world)[0]!;
        expect(placed.hidden).toBeFalsy();
        expect({ x: placed.x, y: placed.y }).toEqual({ x: 10, y: 0 });
      });

      it("도착하자마자 이야기 장면이 돌면 액터 동료는 옆 빈 칸에 선다", () => {
        const { project, session, map } = partyAtTopEdge();
        resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
        const placed = followerPositions(session, project.system.companions, { project, map, storyScene: true })[0]!;
        expect(placed.hidden).toBeFalsy();
        expect({ x: placed.x, y: placed.y }).not.toEqual({ x: session.x, y: session.y });
      });

      it("뒤가 열려 있으면 예전처럼 바로 뒤 칸에 선다", () => {
        const { project, session, map } = partyAtTopEdge();
        session.y = 5;
        resetFollowerTrailNearPlayer(session, map, project.system.companions, { project, facing: "down" });
        const placed = followerPositions(session, project.system.companions, { project, map })[0]!;
        expect({ x: placed.x, y: placed.y }).toEqual({ x: 10, y: 4 });
      });
    });
  });
  describe("followersScenesOnly", () => {
    isolateTimers();
    // FF6 식 동료 표시(companions.display = "scenesOnly") — 필드에선 숨고, 이야기 장면에서만 주인공 옆에 선다.

    function fixture() {
      const project = createBlankProject();
      project.system.companions = { display: "scenesOnly" };
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("map fixture missing");
      const session = startSession(project);
      // 시작 칸 타일(통행 가능)로 맵을 덮는다 — 기본 칩셋이 바뀌어도 열린 들판이 된다.
      map.lowerTiles.fill(map.lowerTiles[session.y * map.width + session.x]!);
      map.events = [];
      session.x = 6;
      session.y = 6;
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      addFollowerToSession(project, session, { graphic: charsetFollowerGraphic("tex_easyrpg_charset_animal", 0), name: "야옹이" });
      for (let i = 0; i < 4; i += 1) recordFollowerPlayerStep(session, { x: 2 + i, y: 6, direction: "right" });
      if (!isPassable(project, map, 5, 6)) throw new Error("fixture: 들판이 통행 불가");
      return { project, map, session };
    }
    describe("동료 표시 scenesOnly", () => {
      it("이야기 장면이 아니면 동료는 모두 숨는다(궤적이 있어도)", () => {
        const { project, map, session } = fixture();
        const positions = followerPositions(session, project.system.companions, { project, map, storyScene: false });
        expect(positions).toHaveLength(2);
        expect(positions.every((entry) => entry.hidden === true)).toBe(true);
      });

      it("이야기 장면이면 주인공과 겹치지 않는 인접 칸에 나란히 선다", () => {
        const { project, map, session } = fixture();
        const positions = followerPositions(session, project.system.companions, { project, map, storyScene: true, playerFacing: "right" });
        expect(positions.every((entry) => entry.hidden !== true)).toBe(true);
        const cells = positions.map((entry) => `${entry.x},${entry.y}`);
        expect(new Set(cells).size).toBe(cells.length);
        expect(cells).not.toContain(`${session.x},${session.y}`);
        for (const entry of positions) {
          expect(Math.abs(entry.x - session.x) + Math.abs(entry.y - session.y)).toBeLessThanOrEqual(3);
          expect(entry.direction).toBe("right");
        }
      });

      it("follow(기본)는 기존처럼 궤적을 따라 보인다", () => {
        const { project, map, session } = fixture();
        const positions = followerPositions(session, { display: "follow" }, { project, map, storyScene: false });
        expect(positions.some((entry) => entry.hidden !== true)).toBe(true);
      });
    });
  });
});

describe("gameDesignExecution", () => {
  isolateTimers();
  describe("internal interview execution handoff", () => {
    it("derives a complete dependency graph for every saved preset without mutating the authored brief", () => {
      for (const id of GAME_PRESET_IDS) {
        const brief = interviewBrief(id);
        const original = structuredClone(brief);
        const plan = buildGameDesignExecution(brief);
        const seen = new Set<string>();
        for (const task of plan.tasks) {
          expect(seen.has(task.id)).toBe(false);
          expect(task.dependsOn.every(id => seen.has(id))).toBe(true);
          expect(task.action.length).toBeGreaterThan(0);
          expect(task.output.length).toBeGreaterThan(0);
          expect(task.acceptance.length).toBeGreaterThan(0);
          expect(task.requirements.every(slot => brief.answers[slot])).toBe(true);
          seen.add(task.id);
        }
        expect(seen.has("F03")).toBe(true);
        expect(brief).toEqual(original);
      }
    });
    it("automatically supplies model-only tasks while keeping the human display free of the contract", () => {
      const brief = interviewBrief();
      const preset = welcomeGenrePresetById(brief.presetId)!;
      const task = buildWelcomeGenrePresetPrompt(preset, brief);
      const display = welcomeGenrePresetDisplayText(preset, brief);
      expect(task).toContain('"id":"P03"');
      expect(task).toContain("검증 증거 없이 done/pass로 처리하지 않는다");
      expect(display).not.toContain('"id":"P03"');
      expect(display).not.toContain("조수 내부 제작 계약");
      expect(gameDesignBriefContext(undefined)).toBe("");
    });
    it("rebuilds from the latest edited summary, preserves recommendation provenance and scopes execution to the current request", () => {
      const brief = interviewBrief();
      brief.answers.detail.source = "recommended";
      brief.summary = "인물의 외형은 미정. 첫 대화 한 장면만 만든다.";
      const first = buildGameDesignExecution(brief);
      brief.summary = "첫 포획까지만, 공포 연출은 빼기.";
      const next = buildGameDesignExecution(brief);
      expect(first.requirements.summary).not.toEqual(next.requirements.summary);
      expect(next.requirements.summary).toBe(brief.summary);
      expect(next.requirements.answers.detail.source).toBe("recommended");
      expect(gameDesignBriefContext(brief)).toContain("읽기 전용·기획 상담·무관한 요청에서는 제작을 시작하지 않는다");
    });
  });
});

describe("graftSourceGeometry", () => {
  isolateTimers();
  // 2026-10-08: 768px(48칸) 공용 기물 아틀라스를 번들 기본(30칸)으로 읽어 찍은 냉장고·진열대가 투명 칸으로 그려졌다.
  function tileset(id: string, image: TilesetDef["image"], tilesPerRow: number, count: number): TilesetDef {
    return { id, name: id, image, tileSize: 16, tilesPerRow, count, passability: [], priority: [], terrain: [] } as unknown as TilesetDef;
  }
  describe("graft source geometry for uploaded sheets", () => {
    it("records the uploaded source sheet's layout on new grafts", () => {
      const source = tileset("shared", { type: "uploaded", id: "shared_atlas" }, 48, 8186);
      const target = tileset("jp_city", { type: "bundled", id: "tex_jp_city" }, 48, 9168);
      translateTiles(source, target, [7165]);
      const graft = target.tileGrafts!.at(-1)!;
      expect(graft).toMatchObject({ sourceChipset: "shared_atlas", sourceTile: 7165, sourceTileSize: 16, sourceTilesPerRow: 48 });
      expect(graftSourceGeometry(graft)).toEqual({ tileSize: 16, tilesPerRow: 48 });
    });

    it("finds the layout of grafts saved before it was recorded", () => {
      const source = tileset("shared", { type: "uploaded", id: "shared_atlas" }, 48, 8186);
      expect(uploadedGraftGeometryIn({ shared: source }, "shared_atlas")).toEqual({ tileSize: 16, tilesPerRow: 48 });
      expect(uploadedGraftGeometryIn({ shared: source }, "tex_jp_city")).toBeNull();
    });
  });
});

// 발자국 필드의 로드 시점 검증 — 2차 스펙 §6.
//
// 왕복(serialize/deserialize)은 JSON.stringify 전체 직렬화라 이미 보존됐다. 빠져 있던 것은
// **검증**이다. `footprint: {width: -5}` 가 로드 검증을 통과해 런타임 정규화만이 막고 있었고,
// 그래서 작성자는 자기 프로젝트가 왜 1x1 로 보이는지 알 방법이 없었다.
describe("ioFootprintValidation", () => {
  isolateTimers();
  function projectWithPage(overrides: Partial<EventPage>): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events = [
      {
        id: "ev_golem",
        x: 5,
        y: 7,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "골렘",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
            ...overrides,
          },
        ],
      },
    ];
    return project;
  }
  /** 타입을 우회해 손으로 고친 JSON 을 흉내낸다 — 로드 검증이 막아야 하는 입력이다. */
  function loadWithRawPage(raw: Record<string, unknown>): Project {
    const project = projectWithPage({});
    const text = serialize(project);
    const parsed = JSON.parse(text) as {
      maps: Record<string, { events: { pages: Record<string, unknown>[] }[] }>;
    };
    const page = parsed.maps[project.startMapId]!.events[0]!.pages[0]!;
    Object.assign(page, raw);
    return deserialize(JSON.stringify(parsed));
  }
  describe("발자국 왕복", () => {
    it.each(["auto", "manual"] as const)("%s 배율 모드를 저장하고 다시 읽는다", (scaleMode) => {
      const project = projectWithPage({ graphic: { scale: 1, scaleMode } });
      const graphic = deserialize(serialize(project)).maps[project.startMapId]!.events[0]!.pages![0]!.graphic;
      expect(graphic).toMatchObject({ scale: 1, scaleMode });
    });

    it("잘못된 배율 모드를 거부한다", () => {
      expect(() => loadWithRawPage({ graphic: { scaleMode: "stretch" } })).toThrow(ProjectFormatError);
    });
    it("몸 크기·통행 행·배율이 그대로 복원된다", () => {
      const project = projectWithPage({
        footprint: { width: 3, height: 3 },
        passRows: 1,
        graphic: { scale: 3 },
      });
      const page = deserialize(serialize(project)).maps[project.startMapId]!.events[0]!.pages![0]!;
      expect(page.footprint).toEqual({ width: 3, height: 3 });
      expect(page.passRows).toBe(1);
      expect(page.graphic.scale).toBe(3);
    });

    it("발자국 없는 페이지는 필드가 생기지 않는다(항등)", () => {
      const project = projectWithPage({});
      const page = deserialize(serialize(project)).maps[project.startMapId]!.events[0]!.pages![0]!;
      expect(page.footprint).toBeUndefined();
      expect(page.passRows).toBeUndefined();
      expect(page.graphic.scale).toBeUndefined();
    });
  });
  describe("로드 검증 — 몸 크기", () => {
    it("음수 축을 거부한다 — 예전에는 통과해서 런타임 정규화만이 막았다", () => {
      expect(() => loadWithRawPage({ footprint: { width: -5, height: 3 } })).toThrow(ProjectFormatError);
    });

    it("0 과 8 초과를 거부한다", () => {
      expect(() => loadWithRawPage({ footprint: { width: 0, height: 1 } })).toThrow(ProjectFormatError);
      expect(() => loadWithRawPage({ footprint: { width: 9, height: 1 } })).toThrow(ProjectFormatError);
    });

    it("정수가 아닌 축을 거부한다", () => {
      expect(() => loadWithRawPage({ footprint: { width: 2.5, height: 1 } })).toThrow(ProjectFormatError);
    });

    it("축이 문자열이면 거부한다", () => {
      expect(() => loadWithRawPage({ footprint: { width: "3", height: 3 } })).toThrow(ProjectFormatError);
    });

    it("1..8 경계는 받는다", () => {
      expect(() => loadWithRawPage({ footprint: { width: 1, height: 1 } })).not.toThrow();
      expect(() => loadWithRawPage({ footprint: { width: 8, height: 8 } })).not.toThrow();
    });
  });
  describe("로드 검증 — 통행 행", () => {
    it("몸 높이를 넘는 통행 행을 거부한다", () => {
      expect(() => loadWithRawPage({ footprint: { width: 3, height: 2 }, passRows: 3 }))
        .toThrow(ProjectFormatError);
    });

    it("0 이하를 거부한다", () => {
      expect(() => loadWithRawPage({ footprint: { width: 3, height: 3 }, passRows: 0 }))
        .toThrow(ProjectFormatError);
      expect(() => loadWithRawPage({ footprint: { width: 3, height: 3 }, passRows: -1 }))
        .toThrow(ProjectFormatError);
    });

    it("몸 크기 없이 통행 행만 있으면 1 만 허용한다 — 몸 높이가 1 이므로", () => {
      expect(() => loadWithRawPage({ passRows: 1 })).not.toThrow();
      expect(() => loadWithRawPage({ passRows: 2 })).toThrow(ProjectFormatError);
    });

    it("1..몸 높이 경계는 받는다", () => {
      expect(() => loadWithRawPage({ footprint: { width: 1, height: 3 }, passRows: 1 })).not.toThrow();
      expect(() => loadWithRawPage({ footprint: { width: 1, height: 3 }, passRows: 3 })).not.toThrow();
    });
  });
  describe("로드 검증 — 배율", () => {
    it("0 과 음수를 거부한다", () => {
      expect(() => loadWithRawPage({ graphic: { scale: 0 } })).toThrow(ProjectFormatError);
      expect(() => loadWithRawPage({ graphic: { scale: -2 } })).toThrow(ProjectFormatError);
    });

    it("범위를 넘는 배율을 거부한다 — 조용히 8 로 잘리면 저장값과 화면이 어긋난다", () => {
      expect(() => loadWithRawPage({ graphic: { scale: 500 } })).toThrow(ProjectFormatError);
      expect(() => loadWithRawPage({ graphic: { scale: 0.1 } })).toThrow(ProjectFormatError);
    });

    it("0.25..8 경계는 받는다", () => {
      expect(() => loadWithRawPage({ graphic: { scale: 0.25 } })).not.toThrow();
      expect(() => loadWithRawPage({ graphic: { scale: 8 } })).not.toThrow();
    });

    it("배율 없는 그림은 그대로 통과한다(항등)", () => {
      expect(() => loadWithRawPage({ graphic: { pattern: 4 } })).not.toThrow();
    });
  });
});

describe("itemTransitions", () => {
  isolateTimers();
  function finiteItem(limit: 1 | 2 | 3 | 4 | 5): ItemRecord {
    const item = structuredClone(createBlankProject().database.items[0]!);
    item.id = "finite";
    item.consumable = true;
    item.consumptionLimit = limit;
    return item;
  }
  describe("item transition authority", () => {
    it("counts successful uses on the FIFO copy and consumes exactly at its limit", () => {
      const item = finiteItem(3);
      const first = transitionItemState({ inventory: { finite: 2 } }, [item], { kind: "successfulUse", itemId: item.id });
      expect(first).toEqual({ inventory: { finite: 2 }, itemUseCharges: { finite: 1 } });
      const second = transitionItemState(first, [item], { kind: "successfulUse", itemId: item.id });
      expect(second).toEqual({ inventory: { finite: 2 }, itemUseCharges: { finite: 2 } });
      const third = transitionItemState(second, [item], { kind: "successfulUse", itemId: item.id });
      expect(third).toEqual({ inventory: { finite: 1 }, itemUseCharges: {} });
    });

    it("preserves a partial current copy on grant and removes uncharged tail copies first", () => {
      const item = finiteItem(4);
      const granted = transitionItemState(
        { inventory: { finite: 1 }, itemUseCharges: { finite: 2 } },
        [item],
        { kind: "grant", itemId: item.id, amount: 2 },
      );
      expect(granted).toEqual({ inventory: { finite: 3 }, itemUseCharges: { finite: 2 } });
      const removedTail = transitionItemState(granted, [item], { kind: "remove", itemId: item.id, amount: 2 });
      expect(removedTail).toEqual({ inventory: { finite: 1 }, itemUseCharges: { finite: 2 } });
      const removedCurrent = transitionItemState(removedTail, [item], { kind: "remove", itemId: item.id, amount: 1 });
      expect(removedCurrent).toEqual({ inventory: {}, itemUseCharges: {} });
    });

    it("applies a readonly action batch in the same order as individual transitions", () => {
      const item = finiteItem(3);
      const initial = { inventory: { finite: 1 }, itemUseCharges: { finite: 1 } };
      const actions = [
        { kind: "grant", itemId: item.id, amount: 2 },
        { kind: "successfulUse", itemId: item.id },
        { kind: "remove", itemId: item.id, amount: 1 },
        { kind: "successfulUse", itemId: item.id },
      ] as const satisfies readonly ItemTransitionAction[];
      const individual = actions.reduce<ItemTransitionState>(
        (state, action) => transitionItemState(state, [item], action),
        initial,
      );

      expect(transitionItemStates(initial, [item], actions)).toEqual(individual);
      expect(transitionItemStates(initial, [item], actions)).toEqual({
        inventory: { finite: 1 },
        itemUseCharges: {},
      });
    });

    it("normalizes lowered limits and prunes malformed, unknown, unlimited, and empty entries independently", () => {
      const finite = finiteItem(2);
      const unlimited = { ...finiteItem(3), id: "unlimited", consumptionLimit: "noLimit" as const };
      expect(normalizeItemTransitionState({
        inventory: { finite: 4, unlimited: 1, unknown: 1 },
        itemUseCharges: { finite: 5, unlimited: 1, unknown: 1, malformed: -4 },
      }, [finite, unlimited])).toEqual({
        inventory: { finite: 2, unlimited: 1, unknown: 1 },
        itemUseCharges: { finite: 1 },
      });
    });
  });
});

describe("lightingRules", () => {
  isolateTimers();
  describe("lightFollowsFigure", () => {
    isolateTimers();
    const context = (resolveAnchor: LightingMaskContext["resolveAnchor"]): LightingMaskContext => ({
      viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0, resolveAnchor,
    });
    const lamp: LightingState = { ambient: 0.8, color: "#000000", sources: [{ id: "lamp", at: { eventId: "ev_guard" }, radius: 3.5, intensity: 0.8 }] };
    describe("event-anchored light follows the figure", () => {
      it("dims with the carrier's opacity and goes out with it", () => {
        const at = (fade?: number) => () => ({ x: 4, y: 4, ...(fade === undefined ? {} : { fade }) });
        expect(lightingGradientParams(lamp, context(at())).gradients[0]?.intensity).toBeCloseTo(0.8);
        expect(lightingGradientParams(lamp, context(at(0.5))).gradients[0]?.intensity).toBeCloseTo(0.4);
        expect(lightingGradientParams(lamp, context(() => undefined)).gradients).toEqual([]);
        expect(lightAtTile(lamp, 4, 5, at(0))).toBe(false);
        expect(lightAtTile(lamp, 4, 5, at(1))).toBe(true);
      });
    });
    describe("hard-edged sight light and circular sight agree", () => {
      it("keeps the hard edge readable at the rim while the inside falls off like a lantern", () => {
        // 끝 가까이에도 빛이 남아 테두리가 읽힌다(부드러운 곡선은 거의 0).
        expect(lightFalloffAt(0.9, "hard")).toBeGreaterThan(0.2);
        expect(lightFalloffAt(0.9)).toBeLessThan(0.1);
        // 안쪽은 고른 판이 아니라 들고 있는 사람 곁이 밝다.
        expect(lightFalloffAt(0.1, "hard")).toBeGreaterThan(lightFalloffAt(0.5, "hard") * 2);
        // 안쪽 낙차(가운데 → 끝 띠 직전)가 끝 계단보다 훨씬 커야 판이 아니라 등불로 읽힌다.
        expect(lightFalloffAt(0.05, "hard") - lightFalloffAt(0.92, "hard")).toBeGreaterThan(lightFalloffAt(0.92, "hard") * 3);
        expect(lightFalloffAt(0.5, "hard")).toBeGreaterThan(lightFalloffAt(0.85, "hard"));
        // 끝 띠는 짧다 — 반지름 94% 너머에서 끊긴다.
        expect(lightFalloffAt(0.99, "hard")).toBeLessThan(0.05);
        const hard = lightingGradientParams({ ...lamp, sources: [{ ...lamp.sources[0]!, at: { x: 1, y: 1 }, edge: "hard" }] }, context((a) => (a === "player" || "eventId" in a ? undefined : a)));
        expect(hard.gradients[0]?.edge).toBe("hard");
      });

      it("circle sight sees exactly the cells whose centre is inside the range + 0.5 lamp", () => {
        const range = 3;
        for (let dx = -5; dx <= 5; dx += 1) for (let dy = -5; dy <= 5; dy += 1) {
          expect(withinSightRange(dx, dy, range, "circle")).toBe(Math.hypot(dx, dy) <= range + 0.5);
        }
        // 맨해튼은 빛 한가운데 대각선(2,2)을 못 보고, 원은 본다.
        expect(withinSightRange(2, 2, range, undefined)).toBe(false);
        expect(withinSightRange(2, 2, range, "circle")).toBe(true);
        expect(withinSightRange(3, 2, range, "circle")).toBe(false);
      });

      it("validates the sight shape", () => {
        expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "circle" })).toBe(true);
        expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "square" })).toBe(false);
      });
    });
  });
  describe("runtimeLightingBlend", () => {
    isolateTimers();
    const context = {
      viewportWidth: 320, viewportHeight: 180, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
      resolveAnchor: () => undefined,
    };
    describe("lighting blend · vignette", () => {
      it("곱하기 막은 밝은 색도 색조로 묶지 않고 화면 색에 곱한다", () => {
        expect(effectiveDarkness("#8090ff", 0.9, "multiply")).toEqual({ color: "#8090ff", ambient: 0.9 });
        expect(effectiveDarkness("#8090ff", 0.9).ambient).toBeLessThan(0.9);
        // 흰 눈(255)은 막 색 그대로, 검은 바닥(0)은 검게 남는다 — 덮기 막처럼 회색 판으로 뭉개지지 않는다.
        expect(darkenChannel(255, 64, 1, "multiply")).toBeCloseTo(64);
        expect(darkenChannel(0, 64, 1, "multiply")).toBe(0);
        expect(darkenChannel(0, 64, 1, "over")).toBe(64);
      });

      it("마스크 인자·서명에 섞기와 비네트가 실린다(생략은 예전과 같다)", () => {
        const plain = lightingGradientParams({ ambient: 0.8, color: "#000000", sources: [] }, context);
        expect(plain.blend).toBe("over");
        expect(plain.vignette).toBe(0);
        const night = lightingGradientParams({ ambient: 0.8, color: "#203060", sources: [], blend: "multiply", vignette: 0.6 }, context);
        expect(night.blend).toBe("multiply");
        expect(night.vignette).toBeCloseTo(0.6);
        expect(lightingMaskSignature(night)).not.toBe(lightingMaskSignature(plain));
      });

      it("setLighting(진하기·색만)은 맵 기본 조명의 섞기·비네트를 지우지 않는다", () => {
        const session = { lighting: normalizeLightingState({ ambient: 0.5, sources: [], blend: "multiply", vignette: 0.4 }) } as PlaySessionLike;
        const next = setSessionLighting(session, { ambient: 0.9, color: "#101830" });
        expect(next.blend).toBe("multiply");
        expect(next.vignette).toBeCloseTo(0.4);
      });

      it("set_lighting_volume 가 blend·vignette 를 기본 조명에 저장하고 모르는 섞기는 거절한다", () => {
        const ctx = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        const ok = runTool(ctx, "set_lighting_volume", { mapId, ambient: 0.9, color: "#263a70", blend: "multiply", vignette: 0.5, sources: [] });
        expect(ok.ok, ok.summary).toBe(true);
        expect(ctx.project.maps[mapId]!.defaultLighting).toMatchObject({ blend: "multiply", vignette: 0.5 });
        const bad = runTool(ctx, "set_lighting_volume", { mapId, ambient: 0.9, blend: "screen", sources: [] });
        expect(bad.ok).toBe(false);
      });
    });
  });
});

// 로케이션 ID 는 맵 안에서만 유일하다(loc1, loc2 …). 편집기 참조 화면과 복구가
// 맵 경계를 넘으면 다른 맵의 **다른 장소**를 같은 것으로 취급한다(2026-09-11 적대적 리뷰).
describe("locationReferenceScope", () => {
  isolateTimers();
  function mapWith(id: string, locationId: string, extra: Partial<GameMap> = {}): GameMap {
    return {
      id,
      name: id,
      width: 10,
      height: 10,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(100).fill(0),
      upperTiles: new Array(100).fill(0),
      events: [],
      locations: [{ id: locationId, name: id + " 광장", x: 1, y: 1, w: 2, h: 2 }],
      ...extra,
    };
  }
  function projectWithSharedId(): Project {
    const project = createBlankProject();
    const a = mapWith("map_a", "loc1", {
      encounterTable: [{ troopId: "troop_slime", weight: 1, conditions: { locationId: "loc1" } }],
    });
    const b = mapWith("map_b", "loc1", {
      encounterTable: [{ troopId: "troop_bat", weight: 1, conditions: { locationId: "loc1" } }],
    });
    project.maps = { map_a: a, map_b: b };
    project.startMapId = "map_a";
    return project;
  }
  describe("location reference scope", () => {
    it("mapId 를 주면 그 맵의 참조만 센다", () => {
      const project = projectWithSharedId();
      expect(countLocationReferences(project, "loc1")).toBe(2);
      expect(countLocationReferences(project, "loc1", "map_a")).toBe(1);
      expect(countLocationReferences(project, "loc1", "map_b")).toBe(1);
    });

    it("복구도 그 맵만 고친다 — 다른 맵의 동명 ID 를 건드리지 않는다", () => {
      const project = projectWithSharedId();
      const result = repairMapLocationReferences(project, "loc1", { kind: "detach" }, "map_a");
      expect(result.repaired).toBe(1);
      expect(project.maps.map_a.encounterTable?.[0]?.conditions?.locationId).toBeUndefined();
      expect(project.maps.map_b.encounterTable?.[0]?.conditions?.locationId).toBe("loc1");
    });

    it("mapId 없이 부르면 전량을 복구한다 — 삭제 영향 계산은 그게 맞다", () => {
      const project = projectWithSharedId();
      const result = repairMapLocationReferences(project, "loc1", { kind: "detach" });
      expect(result.repaired).toBe(2);
      expect(collectMapLocationReferences(project)).toHaveLength(0);
    });
  });
});

// 로케이션 역할 → safeZones/farmableArea 투영 (2026-09-12).
describe("locationRoles", () => {
  isolateTimers();
  function location(id: string, extra: Partial<MapNamedLocation> = {}): MapNamedLocation {
    return { id, name: id, x: 1, y: 1, w: 3, h: 2, ...extra };
  }
  function mapWith(locations: MapNamedLocation[], extra: Partial<GameMap> = {}): GameMap {
    return {
      id: "map_a",
      name: "맵",
      width: 20,
      height: 20,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(400).fill(0),
      upperTiles: new Array(400).fill(0),
      events: [],
      locations,
      ...extra,
    };
  }
  describe("location roles", () => {
    it("역할은 태그 하나로 표현되고 정의된 낱말만 인정한다", () => {
      expect(locationRoleTag({ tags: ["safeZone"] })).toBe("safeZone");
      expect(locationRoleTag({ tags: ["아무말"] })).toBeUndefined();
      expect(hasLocationRole({ tags: ["farmable"] }, "farmable")).toBe(true);
      expect(hasLocationRole({ tags: ["farmable"] }, "safeZone")).toBe(false);
    });

    it("역할 구역이 해당 배열로 투영된다", () => {
      const map = mapWith([location("loc1", { tags: ["safeZone"] }), location("loc2", { x: 5, y: 5, tags: ["farmable"] })]);
      // 배열 2건 + 기록 1건. 반환값은 «바뀐 것» 의 수다(무변경 판정에만 쓰인다).
      expect(projectLocationRoles(map)).toBe(3);
      expect(map.safeZones).toEqual([{ x: 1, y: 1, w: 3, h: 2 }]);
      expect(map.farmableArea).toEqual([{ x: 5, y: 5, w: 3, h: 2 }]);
      expect(locationRoleRects(map, "safeZone")).toHaveLength(1);
    });

    it("두 번 투영해도 늘지 않는다(멱등)", () => {
      const map = mapWith([location("loc1", { tags: ["safeZone"] })]);
      // 배열 1건 + 기록 1건.
      expect(projectLocationRoles(map)).toBe(2);
      expect(projectLocationRoles(map)).toBe(0);
      expect(map.safeZones).toHaveLength(1);
    });

    it("손으로 넣은 사각형은 지우지 않는다 — 출처가 다르다", () => {
      // 추격자 툴(make_chase_scene)이 넣은 사각형을 흉내낸다(출처 없는 배열 항목).
      const map = mapWith([location("loc1", { tags: ["safeZone"] })], {
        safeZones: [{ x: 9, y: 9, w: 2, h: 2 }],
      });
      projectLocationRoles(map);
      expect(map.safeZones).toEqual([{ x: 9, y: 9, w: 2, h: 2 }, { x: 1, y: 1, w: 3, h: 2 }]);
    });

    it("역할을 뗀 구역의 사각형은 그 출처의 것만 사라진다", () => {
      const map = mapWith([location("loc1")], {
        safeZones: [{ x: 1, y: 1, w: 3, h: 2 }, { x: 9, y: 9, w: 2, h: 2 }],
        // loc1 이 예전에는 역할이었고 그 흔적이 남아 있다고 가정한다.
      });
      // 출처 표시가 남아 있어야 «우리 것» 으로 식별된다.
      map.locationRoleProjection = { safeZone: { loc1: { x: 1, y: 1, w: 3, h: 2 } } };
      projectLocationRoles(map);
      expect(map.safeZones).toEqual([{ x: 9, y: 9, w: 2, h: 2 }]);
    });

    it("역할이 없는 맵은 아무것도 바꾸지 않는다", () => {
      const map = mapWith([location("loc1")]);
      expect(projectLocationRoles(map)).toBe(0);
      expect(map.safeZones).toBeUndefined();
      expect(map.farmableArea).toBeUndefined();
    });

    it("구역을 옮기면 투영도 따라간다 — 복사본이 아니라 투영이다", () => {
      const map = mapWith([location("loc1", { tags: ["safeZone"] })]);
      projectLocationRoles(map);
      map.locations![0] = { ...map.locations![0]!, x: 7, y: 8 };
      projectLocationRoles(map);
      expect(map.safeZones).toEqual([{ x: 7, y: 8, w: 3, h: 2 }]);
      expect(map.safeZones).toHaveLength(1);
    });

    it("마지막 역할 구역이 사라지면 키 자체가 없어진다 — 빈 배열을 남기지 않는다", () => {
      // 역할을 떼고 구역도 지운 상태 — 기록만 남아 있다.
      const map = mapWith([], {
        safeZones: [{ x: 1, y: 1, w: 3, h: 2 }],
      });
      map.locationRoleProjection = { safeZone: { loc1: { x: 1, y: 1, w: 3, h: 2 } } };
      projectLocationRoles(map);
      expect(map.safeZones).toBeUndefined();
    });
  });
});
