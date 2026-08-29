// 주인공의 몸 사각과 통행 사각 — 2차 스펙 §9.
//
// 1차까지 발자국은 **이벤트만** 가질 수 있었고 주인공은 언제나 1x1 이었다. 그래서
// `resolveFootprintLanding` 은 프로덕션 호출부가 0 이었다(테스트만 불렀다).
//
// 판별력 규칙 둘:
//  ① 프로브는 앵커 칸/앵커 행을 겨냥하지 않는다 — 1x1 이어도 같은 결과라 아무것도 증명하지 않는다.
//  ② 스프라이트 x 는 **짝수 폭**으로만 프로브한다. 홀수 폭은 footprintSpriteX === characterSpriteX 다.

import { describe, expect, it } from "vitest";
import { canMove, canMoveFootprint } from "@/project/collision";
import { createBlankProject, TILE } from "@/project/defaults";
import { resolveFootprintLanding } from "@/project/footprintLanding";
import { playerBodyRect, playerPassageRect, resolvePlayerBody } from "@/project/playerFootprint";
import {
  findBlockingEventOverlappingRect,
  findBlockingRuntimeEventAtInMap,
  initialRuntimeEventPositions,
} from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot, type SaveSnapshot } from "@/player/saveSlots";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { transferTo } from "@/player/playSceneMapCommands";
import { findBlockingEventForPlayerBody, playerCanStep } from "@/player/playSceneMovement";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { CharacterFootprint, GameEvent, GameMap, Project } from "@/project/types";
import { resolveDiagonalStep } from "@/player/input";
import { mockSprite, type MockSprite } from "./runtimeEventPageFixtures";

const GOLEM: CharacterFootprint = { width: 3, height: 3 };
const UNIT: CharacterFootprint = { width: 1, height: 1 };

function grassProject(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.lowerTiles.fill(TILE.GRASS);
  map.events = [];
  store.replace(project);
  return { project, map };
}

function wall(map: GameMap, x: number, y: number): void {
  map.lowerTiles[y * map.width + x] = TILE.WALL;
}

describe("resolvePlayerBody — 세션 오버라이드 → 저작값 → 1x1", () => {
  it("둘 다 없으면 1x1 · 통행 1행이다(항등)", () => {
    const { project } = grassProject();
    expect(resolvePlayerBody(project)).toEqual({ footprint: UNIT, passRows: 1 });
    expect(resolvePlayerBody(project, {})).toEqual({ footprint: UNIT, passRows: 1 });
  });

  it("저작값을 읽는다", () => {
    const { project } = grassProject();
    project.system.playerFootprint = GOLEM;
    project.system.playerPassRows = 1;
    expect(resolvePlayerBody(project)).toEqual({ footprint: GOLEM, passRows: 1 });
  });

  it("세션 오버라이드가 저작값을 이긴다", () => {
    const { project } = grassProject();
    project.system.playerFootprint = GOLEM;
    project.system.playerPassRows = 1;
    expect(resolvePlayerBody(project, { playerFootprint: { width: 2, height: 2 }, playerPassRows: 2 })).toEqual({
      footprint: { width: 2, height: 2 },
      passRows: 2,
    });
  });

  it("통행 행은 **해소된** 몸 높이로 클램프된다 — 저작 3행 + 세션 2높이면 2다", () => {
    const { project } = grassProject();
    project.system.playerPassRows = 3;
    expect(resolvePlayerBody(project, { playerFootprint: { width: 1, height: 2 } }).passRows).toBe(2);
  });

  it("비정규 통행 행은 몸 높이 전체로 올라간다(fail-closed)", () => {
    const { project } = grassProject();
    project.system.playerFootprint = GOLEM;
    for (const rows of [0, -1, 2.5, Number.NaN, "2" as unknown as number, null as unknown as number]) {
      expect(resolvePlayerBody(project, { playerPassRows: rows }).passRows).toBe(3);
    }
  });

  it("비정규 몸 크기는 1x1 로 굳는다", () => {
    const { project } = grassProject();
    project.system.playerFootprint = { width: -5, height: 0 };
    expect(resolvePlayerBody(project)).toEqual({ footprint: UNIT, passRows: 1 });
  });
});

// tryStartMove 는 대각을 손수 L자로 분해하던 코드를 canMoveFootprint 한 번으로 갈아탔다.
// 그 교체가 1x1 에서 **같은 값**인지가 회귀 게이트다 — resolveDiagonalStep 이 첫 구간
// 두 개(H1·V1)를 따로 묻기 때문에 전체 조건은 양쪽 모두 `H1 && V1 && (H2 || V2)` 가 된다.
describe("대각 통행 — canMoveFootprint 교체가 1x1 에서 항등이다", () => {
  const ORIGIN = { x: 10, y: 8 } as const;

  function stepResults(map: GameMap, project: Project, dx: number, dy: number) {
    const legacy = (sx: number, sy: number): boolean => {
      if (sx !== 0 && sy !== 0) {
        return (
          canMove(project, map, ORIGIN.x + sx, ORIGIN.y, ORIGIN.x + sx, ORIGIN.y + sy) ||
          canMove(project, map, ORIGIN.x, ORIGIN.y + sy, ORIGIN.x + sx, ORIGIN.y + sy)
        );
      }
      return canMove(project, map, ORIGIN.x, ORIGIN.y, ORIGIN.x + sx, ORIGIN.y + sy);
    };
    // 프로덕션 술어를 그대로 부른다 — tryStartMove·강제 이동 루트가 쓰는 그 함수다.
    const scene = { map, tileX: ORIGIN.x, tileY: ORIGIN.y } as unknown as PlaySceneContext;
    const footprint = (sx: number, sy: number): boolean =>
      playerCanStep(scene, { footprint: UNIT, passRows: 1 }, sx, sy);
    return {
      legacy: resolveDiagonalStep(dx as -1 | 0 | 1, dy as -1 | 0 | 1, legacy),
      footprint: resolveDiagonalStep(dx as -1 | 0 | 1, dy as -1 | 0 | 1, footprint),
    };
  }

  it("세 이웃 칸의 벽 조합 8가지 × 네 대각 모두에서 같은 걸음이 나온다", () => {
    for (const [dx, dy] of [[1, -1], [1, 1], [-1, -1], [-1, 1]] as const) {
      for (let mask = 0; mask < 8; mask += 1) {
        const { project, map } = grassProject();
        // 대각 판정이 보는 칸: 가로 이웃, 세로 이웃, 대각 목적지. 그 밖은 건드리지 않는다.
        if (mask & 1) wall(map, ORIGIN.x + dx, ORIGIN.y);
        if (mask & 2) wall(map, ORIGIN.x, ORIGIN.y + dy);
        if (mask & 4) wall(map, ORIGIN.x + dx, ORIGIN.y + dy);
        const { legacy, footprint } = stepResults(map, project, dx, dy);
        expect(footprint, `dir=${dx},${dy} mask=${mask}`).toEqual(legacy);
      }
    }
  });

  it("3x3 · 통행 1행은 발밑 줄만 본다 — 상체가 걸치는 벽은 무시한다", () => {
    const { project, map } = grassProject();
    // 오른쪽 한 칸 앞의 **상체 행**만 벽으로 막는다. 발밑(y=8)은 열려 있다.
    wall(map, 11, 6);
    const scene = { map, tileX: 10, tileY: 8 } as unknown as PlaySceneContext;
    expect(canMoveFootprint(project, map, 10, 8, GOLEM, 11, 8)).toBe(false); // 몸 전체(1차 동작)
    expect(playerCanStep(scene, { footprint: GOLEM, passRows: 1 }, 1, 0)).toBe(true); // 통행 1행
    // 발밑 줄을 막으면 통행 1행도 막힌다.
    wall(map, 11, 8);
    expect(playerCanStep(scene, { footprint: GOLEM, passRows: 1 }, 1, 0)).toBe(false);
  });
});

describe("통행 사각 — 이벤트 차단", () => {
  function blockerAt(x: number, y: number): GameEvent {
    return {
      id: "blocker",
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    };
  }

  it("1x1 주인공은 목적지 한 칸 질의와 완전히 같다(항등)", () => {
    const { project, map } = grassProject();
    map.events = [blockerAt(10, 8)];
    store.replace(project);
    const session = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);
    const body = resolvePlayerBody(project);
    const scene = { map, session, eventPositions: positions } as unknown as PlaySceneContext;
    for (let x = 8; x <= 12; x += 1) {
      for (let y = 6; y <= 10; y += 1) {
        // 프로덕션 술어 대 예전 한 칸 질의.
        const viaBody = findBlockingEventForPlayerBody(scene, body, x, y);
        const viaPoint = findBlockingRuntimeEventAtInMap(project, map, session, positions, x, y);
        expect(viaBody?.event.id).toBe(viaPoint?.event.id);
        // 통행 사각 자체도 한 칸이다.
        expect(playerPassageRect(body, x, y)).toEqual({ left: x, right: x, top: y, bottom: y });
      }
    }
  });

  it("통행 1행이면 상체 칸의 이벤트는 막지 않고 발밑 칸의 이벤트는 막는다", () => {
    const { project, map } = grassProject();
    project.system.playerFootprint = GOLEM;
    project.system.playerPassRows = 1;
    // 주인공 앵커 (10,8) → 몸 y 6..8, 통행 y 8. 상체 행(6)에 이벤트를 세운다.
    map.events = [blockerAt(10, 6)];
    store.replace(project);
    const session = startSession(project);
    const body = resolvePlayerBody(project);
    expect(body.passRows).toBe(1);
    const torsoScene = {
      map,
      session,
      eventPositions: initialRuntimeEventPositions(map.events),
    } as unknown as PlaySceneContext;
    expect(findBlockingEventForPlayerBody(torsoScene, body, 10, 8)).toBeUndefined();
    // 몸 사각으로 봤다면 막혔을 자리다 — 프로브가 무의미하지 않다는 확인.
    expect(
      findBlockingEventOverlappingRect(project, map, session, torsoScene.eventPositions, playerBodyRect(body, 10, 8))
        ?.event.id
    ).toBe("blocker");

    // 같은 이벤트를 발밑 행으로 내리면 막힌다 — 판정이 아예 죽은 게 아님을 보인다.
    map.events = [blockerAt(10, 8)];
    store.replace(project);
    const footScene = {
      map,
      session,
      eventPositions: initialRuntimeEventPositions(map.events),
    } as unknown as PlaySceneContext;
    expect(findBlockingEventForPlayerBody(footScene, body, 10, 8)?.event.id).toBe("blocker");
  });
});

describe("워프 착지 — 통행 사각으로 검사한다", () => {
  it("통행 1행이면 상체가 벽에 걸쳐도 지정 칸에 내린다", () => {
    const { project, map } = grassProject();
    wall(map, 10, 6); // 앵커 (10,8) 의 상체 행
    const session = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);
    // 몸 전체로 보면 (10,8) 은 불가 → 밀려난다.
    expect(resolveFootprintLanding(project, map, session, positions, 10, 8, GOLEM)).not.toEqual({ x: 10, y: 8 });
    // 통행 1행이면 발밑 줄만 보므로 그 자리에 내린다.
    expect(resolveFootprintLanding(project, map, session, positions, 10, 8, GOLEM, undefined, 1)).toEqual({ x: 10, y: 8 });
  });

  it("통행 1행이어도 몸이 맵을 벗어나면 밀려난다 — 경계는 몸 사각으로 본다", () => {
    const { project, map } = grassProject();
    const session = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);
    // 앵커 (10,1) → 몸 y -1..1 은 맵 밖이다. 통행 1행이어도 그림이 잘리므로 거른다.
    expect(resolveFootprintLanding(project, map, session, positions, 10, 1, GOLEM, undefined, 1)).not.toEqual({ x: 10, y: 1 });
  });
});

/** transferTo 가 요구하는 최소 장면. fade "none" 이라 카메라 대기가 없다. */
function transferScene(project: Project, map: GameMap): { scene: PlaySceneContext; player: MockSprite } {
  const player = mockSprite();
  const scene = {
    session: startSession(project),
    map,
    eventPositions: initialRuntimeEventPositions(map.events),
    tileX: 1,
    tileY: 1,
    facing: "down",
    moving: false,
    running: false,
    player,
    playerSprite: { idleFrameFor: () => 0, walkFrameFor: () => 0, walkFrameCount: 3, texture: "tex" },
    followerSprites: new Map(),
    autoStartedKeys: new Set<string>(),
    eventSprites: new Map(),
    add: { sprite: () => mockSprite() },
    cameras: { main: {} },
    loadMap: () => undefined,
    getMapId: () => map.id,
    centerCamera: () => undefined,
    runEvent: async () => undefined,
    refreshRuntimeSurfaces: () => undefined,
    syncRuntimeState: () => undefined,
  } as unknown as PlaySceneContext;
  return { scene, player };
}

describe("transferTo — 주인공 발자국을 존중한다", () => {
  it("몸이 안 들어가는 칸으로 워프하면 가까운 유효 칸으로 내려앉는다", async () => {
    const { project, map } = grassProject();
    project.system.playerFootprint = GOLEM; // passRows 생략 → 몸 전체가 통행 사각
    wall(map, 10, 6);
    store.replace(project);
    const { scene } = transferScene(project, map);

    await transferTo(scene, { kind: "transfer", mapId: map.id, x: 10, y: 8, fade: "none" });

    // (10,8) 은 몸(y 6..8)이 벽을 물어 불가하다. 링 순서상 첫 유효 칸은 (9,9).
    expect({ x: scene.session.x, y: scene.session.y }).toEqual({ x: 9, y: 9 });
    expect({ x: scene.tileX, y: scene.tileY }).toEqual({ x: 9, y: 9 });
  });

  it("통행 1행이면 같은 칸에 그대로 내린다 — 사각이 둘이라는 증명", async () => {
    const { project, map } = grassProject();
    project.system.playerFootprint = GOLEM;
    project.system.playerPassRows = 1;
    wall(map, 10, 6);
    store.replace(project);
    const { scene } = transferScene(project, map);

    await transferTo(scene, { kind: "transfer", mapId: map.id, x: 10, y: 8, fade: "none" });

    expect({ x: scene.session.x, y: scene.session.y }).toEqual({ x: 10, y: 8 });
  });

  it("1x1 은 착지 검사를 아예 하지 않는다(항등)", async () => {
    const { project, map } = grassProject();
    wall(map, 10, 6);
    store.replace(project);
    const { scene } = transferScene(project, map);

    await transferTo(scene, { kind: "transfer", mapId: map.id, x: 10, y: 8, fade: "none" });

    expect({ x: scene.session.x, y: scene.session.y }).toEqual({ x: 10, y: 8 });
  });

  it("스프라이트는 몸 중앙에 놓인다 — 폭 2 로 프로브", async () => {
    const { project, map } = grassProject();
    const body: CharacterFootprint = { width: 2, height: 1 };
    project.system.playerFootprint = body;
    store.replace(project);
    const { scene, player } = transferScene(project, map);

    await transferTo(scene, { kind: "transfer", mapId: map.id, x: 10, y: 8, fade: "none" });

    expect(player.x).toBe(footprintSpriteX(10, body));
    expect(player.x).not.toBe(characterSpriteX(10));
    expect(player.y).toBe(characterSpriteY(8));
  });
});

describe("세이브 왕복 — 주인공 몸 오버라이드", () => {
  it("세션 오버라이드가 저장·복원을 통과한다", () => {
    const { project } = grassProject();
    const session = startSession(project);
    session.playerFootprint = GOLEM;
    session.playerPassRows = 1;

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.playerFootprint).toEqual(GOLEM);
    expect(restored.playerPassRows).toBe(1);
    expect(resolvePlayerBody(project, restored)).toEqual({ footprint: GOLEM, passRows: 1 });
  });

  it("오버라이드가 없으면 스냅샷에도 없고, 복원 후엔 저작값이 이긴다(항등)", () => {
    const { project } = grassProject();
    project.system.playerFootprint = GOLEM;
    project.system.playerPassRows = 1;
    const snapshot = createSaveSnapshot(project, startSession(project));
    expect(snapshot.session.playerFootprint).toBeUndefined();

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.playerFootprint).toBeUndefined();
    expect(resolvePlayerBody(project, restored)).toEqual({ footprint: GOLEM, passRows: 1 });
  });

  it("복원은 이전 오버라이드를 지운다 — 조건부 대입이면 낡은 몸이 살아남는다", () => {
    const { project } = grassProject();
    const snapshot = createSaveSnapshot(project, startSession(project));
    // applySaveSnapshot 은 startSession 으로 새 세션을 만들지만, 저작값이 세션에 실리는
    // 구조로 바뀌면 이 단정이 그 회귀를 잡는다.
    expect(applySaveSnapshot(project, snapshot).playerFootprint).toBeUndefined();
  });

  it("손상된 오버라이드는 버려지고 저작값이 이긴다", () => {
    const { project } = grassProject();
    project.system.playerFootprint = GOLEM;
    const storage = new Map<string, string>();
    const fake = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    } as unknown as Storage;
    const snapshot = createSaveSnapshot(project, startSession(project));
    const corrupted = {
      ...snapshot,
      session: { ...snapshot.session, playerFootprint: "3x3", playerPassRows: 2.5 },
    } as unknown as SaveSnapshot;
    expect(saveToSlot(fake, 1, corrupted)).toEqual({ ok: true });

    const read = readSaveSlot(fake, 1);
    if (read.kind !== "present") throw new Error(`expected present save, got ${read.kind}`);
    expect(read.snapshot.session.playerFootprint).toBeUndefined();
    expect(read.snapshot.session.playerPassRows).toBeUndefined();
    expect(resolvePlayerBody(project, applySaveSnapshot(project, read.snapshot))).toEqual({
      footprint: GOLEM,
      passRows: 3,
    });
  });
});
