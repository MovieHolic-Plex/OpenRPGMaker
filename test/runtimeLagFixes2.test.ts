// 런타임 렉 수정 2차(2026-09-27)의 동등성 회귀. 기억(memo)은 입력이 바뀌면 반드시 무효가 되고,
// 나눠 굽기는 한 번에 굽기와 같은 결과를 내는지를 본다. 속도 자체는 단위 테스트로 증명하지 않는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { WORLD_COAST_GROUP_ID, withWorldCoastRenderPass, worldCoastAutotileGroup } from "@/project/defaults/worldCoastMapping";
import { setAutotileVariant } from "@/editor/tilesetActions";
import { committedEvents, mapWithCommittedEvents } from "@/project/eventDrafts";
import { ensureFogTexture } from "@/player/weather/fogTexture";
import { CLOUD_SHAPE_FRAMES, cloudShapeTextureKey, ensureCloudShapeTextures } from "@/player/weather/cloudShadowTexture";
import { AtmosphereAudio } from "@/player/audio/atmosphereAudio";
import { WeatherAudio } from "@/player/audio/weatherAudio";
import { lightingGradientParams } from "@/player/lighting";
import { M2_HISTORY_LIMIT, ensureM2Runtime, pushM2History } from "@/player/interpreter/m2RuntimeState";
import { executeModernCommand } from "@/player/interpreter/m2ModernRuntime";
import { parseLifeState } from "@/project/lifeStateReconciliation";
import { armTerrainComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import { findChasePath } from "@/player/chaseAi";
import { fitBattleEnemy } from "@/player/battleEnemyFit";
import { startSession } from "@/project/session";
import { createBlockingEventQuery, findBlockingEventOverlappingRect, initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { footprintBounds } from "@/project/footprint";
import { TILE } from "@/project/defaults/constants";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { applyChangeTileStep } from "@/player/playSceneMapCommands";
import { firstConnectionToward } from "@/player/npcLivingTravel";
import { pointRect } from "@/project/footprint";
import type { GameMap, MapConnection, Project } from "@/project/types";
import type { TileGraft, TilesetDef } from "@/project/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("이식 텍스처 suffix 기억", () => {
  const graft = (targetTile: number, sourceTile = 1): TileGraft => ({ sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile, targetTile });

  it("같은 배열이면 같은 답, push·새 배열이면 새 답", () => {
    const grafts = [graft(10)];
    const tileset: Pick<TilesetDef, "tileGrafts"> = { tileGrafts: grafts };
    const first = tileGraftsTextureSuffix(tileset);
    expect(first).not.toBe("");
    expect(tileGraftsTextureSuffix(tileset)).toBe(first);
    grafts.push(graft(11));
    const pushed = tileGraftsTextureSuffix(tileset);
    expect(pushed).not.toBe(first);
    expect(pushed).toBe(tileGraftsTextureSuffix({ tileGrafts: [graft(10), graft(11)] }));
    tileset.tileGrafts = [graft(10, 2)];
    expect(tileGraftsTextureSuffix(tileset)).toBe(tileGraftsTextureSuffix({ tileGrafts: [graft(10, 2)] }));
    expect(tileGraftsTextureSuffix(tileset)).not.toBe(first);
    tileset.tileGrafts = [];
    expect(tileGraftsTextureSuffix(tileset)).toBe("");
  });
});

describe("월드 해안 그룹 기억", () => {
  function worldTileset(): TilesetDef {
    store.replace(createBlankProject());
    const found = Object.values(store.getCurrent().tilesets).find((tileset) => worldCoastAutotileGroup(tileset));
    if (!found) throw new Error("월드 해안 그룹이 있는 번들 타일셋이 없습니다");
    return found;
  }

  it("편집기가 같은 그룹의 variantMap 을 제자리 대입하면 판정이 다시 계산된다", () => {
    const tileset = worldTileset();
    expect(worldCoastAutotileGroup(tileset)?.id).toBe(WORLD_COAST_GROUP_ID);
    setAutotileVariant(tileset.id, WORLD_COAST_GROUP_ID, 0, 999);
    expect(worldCoastAutotileGroup(store.getCurrent().tilesets[tileset.id]!)).toBeUndefined();
  });

  it("그룹 필드·이식을 제자리에서 바꾸면 판정이 다시 계산된다", () => {
    const tileset = structuredClone(worldTileset());
    const group = tileset.autotileGroups!.find((entry) => entry.id === WORLD_COAST_GROUP_ID)!;
    expect(worldCoastAutotileGroup(tileset)).toBe(group);
    const members = group.memberTileIds;
    group.memberTileIds = members.slice(1);
    expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
    group.memberTileIds = members;
    expect(worldCoastAutotileGroup(tileset)).toBe(group);
    group.neighborhood = 4;
    expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
    group.neighborhood = 8;
    expect(worldCoastAutotileGroup(tileset)).toBe(group);
    tileset.tileGrafts = [{ sourceChipset: "x", sourceTile: 0, targetTile: group.memberTileIds[0]! }];
    expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
  });

  it("그리기 한 번 안에서만 판정을 고정하고, 끝나면 다시 내용을 본다", () => {
    const tileset = structuredClone(worldTileset());
    const group = tileset.autotileGroups!.find((entry) => entry.id === WORLD_COAST_GROUP_ID)!;
    withWorldCoastRenderPass(() => {
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
    });
    group.variantMap["255"] = 3;
    expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
    withWorldCoastRenderPass(() => expect(worldCoastAutotileGroup(tileset)).toBeUndefined());
  });
});

describe("mapWithCommittedEvents", () => {
  it("예전 구현(전체 복제 후 events 교체)과 같은 값·같은 키 순서를 낸다", () => {
    const project = createBlankProject();
    const map = createBlankMap("m", 12, 9, Object.keys(project.tilesets)[0]!);
    map.events = [
      { id: "a", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "showText", text: "hi" }], pages: [] },
      { id: "b", x: 2, y: 1, trigger: { kind: "action" }, commands: [], pages: [], draft: { kind: "new" } },
    ] as never;
    const legacy = structuredClone(map);
    legacy.events = committedEvents(map.events);
    const next = mapWithCommittedEvents(map);
    expect(JSON.stringify(next)).toBe(JSON.stringify(legacy));
    expect(next.lowerTiles).not.toBe(map.lowerTiles);
    expect(next.events[0]).not.toBe(map.events[0]);
  });
});

// ---- 캔버스·텍스처 가짜 ----
class FakeImageData {
  readonly data: Uint8ClampedArray;
  constructor(readonly width: number, readonly height: number) { this.data = new Uint8ClampedArray(width * height * 4); }
}
class FakeCanvas {
  width = 0;
  height = 0;
  image: FakeImageData | null = null;
  getContext() {
    return {
      createImageData: (width: number, height: number) => new FakeImageData(width, height),
      putImageData: (image: FakeImageData) => { this.image = image; },
    };
  }
}
function fakeTextures() {
  const added = new Map<string, FakeCanvas>();
  const textures = {
    exists: (key: string) => added.has(key),
    addCanvas: (key: string, canvas: FakeCanvas) => { added.set(key, canvas); return { setFilter() {} }; },
  } as unknown as Phaser.Textures.TextureManager;
  return { textures, added };
}
function stubCanvas() {
  vi.stubGlobal("document", { createElement: () => new FakeCanvas() });
}

describe("안개 나눠 굽기", () => {
  it("줄 단위로 나눠 구워도 한 번에 구운 것과 같은 픽셀이다", () => {
    stubCanvas();
    const whole = fakeTextures();
    expect(ensureFogTexture(whole.textures, "fog")).toBe("fog");
    const split = fakeTextures();
    let pendingSteps = 0;
    while (ensureFogTexture(split.textures, "fog", 64) === null) pendingSteps += 1;
    expect(pendingSteps).toBe(3);
    expect(split.added.get("fog")!.image!.data).toEqual(whole.added.get("fog")!.image!.data);
  });
});

describe("구름 모양 나눠 굽기", () => {
  it("예산만큼만 굽고, 지금 보이는 장부터 굽고, 한 번에 구운 것과 같다", () => {
    stubCanvas();
    const { textures, added } = fakeTextures();
    expect(ensureCloudShapeTextures(textures, 2, { budget: 1, firstFrame: 5 })).toBe(false);
    expect([...added.keys()]).toEqual([cloudShapeTextureKey(5, 2)]);
    let calls = 1;
    for (;;) {
      calls += 1;
      if (ensureCloudShapeTextures(textures, 2, { budget: 1, firstFrame: 5 })) break;
    }
    expect(calls).toBe(CLOUD_SHAPE_FRAMES);
    expect(added.size).toBe(CLOUD_SHAPE_FRAMES);
    const whole = fakeTextures();
    expect(ensureCloudShapeTextures(whole.textures, 2)).toBe(true);
    for (let frame = 0; frame < CLOUD_SHAPE_FRAMES; frame += 1) {
      const key = cloudShapeTextureKey(frame, 2);
      expect(added.get(key)!.image!.data).toEqual(whole.added.get(key)!.image!.data);
    }
  });
});

// ---- 오디오 가짜 ----
class FakeBuffer {
  readonly data: Float32Array[];
  constructor(channels: number, length: number, readonly sampleRate: number) {
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(channel: number) { return this.data[channel]!; }
}
class FakeParam {
  value = 0;
  setTargetAtTime() {}
  cancelScheduledValues() {}
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode { gain = new FakeParam(); frequency = new FakeParam(); type = ""; connect() {} disconnect() {} }
class FakeSource extends FakeNode { buffer: unknown; loop = false; onended: unknown; start() {} stop() {} }
function fakeAudioContext(rate: number, created: FakeBuffer[]) {
  return class {
    state = "running";
    currentTime = 0;
    destination = {};
    sampleRate = rate;
    createBuffer(channels: number, length: number, bufferRate: number) {
      const buffer = new FakeBuffer(channels, length, bufferRate);
      created.push(buffer);
      return buffer;
    }
    createGain() { return new FakeNode(); }
    createBiquadFilter() { return new FakeNode(); }
    createBufferSource() { return new FakeSource(); }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
}

describe("분위기 소리 나눠 합성", () => {
  it("여러 update 에 나눠 합성한 버퍼가 예전 한 번 합성과 같은 표본이다", () => {
    const created: FakeBuffer[] = [];
    vi.stubGlobal("AudioContext", fakeAudioContext(44100, created));
    const audio = new AtmosphereAudio();
    const effects = [{ kind: "fireflies", amount: 1, volume: 0.5, sound: "fire" }] as never;
    const voices = () => (audio as unknown as { voices: Map<string, unknown> }).voices.size;
    let updates = 0;
    while (voices() === 0 && updates < 100) { audio.update(effects, true); updates += 1; }
    expect(voices()).toBe(1);
    expect(updates).toBeGreaterThan(1);
    const buffer = created[0]!;
    expect(buffer.data[0]!.length).toBe(22050 * 12);
    // 예전 구현(한 번에 합성)으로 뽑아 둔 표본 지문.
    let hash = 0;
    for (const channel of buffer.data) for (let i = 0; i < channel.length; i += 97) hash = (hash * 31 + Math.round(channel[i]! * 1e6)) | 0;
    expect(hash).toBe(375032406);
    audio.stop();
  });
});

describe("빗소리 잡음 버퍼 재사용", () => {
  it("비가 그쳤다 다시 와도 같은 표본율이면 잡음을 다시 합성하지 않는다", () => {
    const created: FakeBuffer[] = [];
    vi.stubGlobal("AudioContext", fakeAudioContext(12345, created));
    const weather = new WeatherAudio();
    weather.update({ kind: "rain", intensity: 0.6 }, 0, true);
    expect(created).toHaveLength(1);
    weather.update({ kind: "none", intensity: 0 }, 16, true);
    weather.update({ kind: "rain", intensity: 0.6 }, 32, true);
    expect(created).toHaveLength(1);
    weather.stop();
  });
});

describe("3차: 화면 밖 광원", () => {
  it("화면과 겹치지 않는 광원은 서명·그리기 대상에서 빠지고, 반경이 걸치면 남는다", () => {
    const params = lightingGradientParams(
      { ambient: 0.8, sources: [
        { id: "far", at: { x: 1000, y: 1000 }, radius: 3, intensity: 1, flicker: true },
        { id: "edge", at: { x: -2, y: 2 }, radius: 3, intensity: 1 },
        { id: "near", at: { x: 2, y: 2 }, radius: 1, intensity: 1 },
      ] },
      { viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
        resolveAnchor: (anchor) => (anchor === "player" || "eventId" in anchor ? undefined : anchor) },
    );
    expect(params.gradients.map((entry) => entry.id)).toEqual(["edge", "near"]);
  });
});

describe("3차: 명령 이력 상한", () => {
  it("표현식 평가를 반복해도 이력은 상한에서 멈추고 가장 최근 것이 남는다", () => {
    const session = startSession(createBlankProject());
    const runtime = ensureM2Runtime(session);
    for (let index = 0; index < M2_HISTORY_LIMIT * 3; index += 1) {
      executeModernCommand(session, runtime, "Evaluate Expression", { expression: String(index), resultVariableId: "v" });
    }
    expect(runtime.expressions).toHaveLength(M2_HISTORY_LIMIT);
    expect(runtime.expressions.at(-1)?.expression).toBe(String(M2_HISTORY_LIMIT * 3 - 1));
    expect(session.variables.v).toBe(M2_HISTORY_LIMIT * 3 - 1);
  });

  it("상한 아래에서는 push 와 같다", () => {
    const list: number[] = [];
    for (let index = 0; index < 5; index += 1) pushM2History(list, index);
    expect(list).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("3차: 생활 상태 파서", () => {
  it("항목을 제자리에 붙여도 예전 펼침과 같은 사전이고, __proto__ id 도 평범한 키다", () => {
    const shipping = JSON.parse('{"a":1,"__proto__":2,"b":0,"c":3}') as Record<string, number>;
    const parsed = parseLifeState({ shippingQueue: shipping });
    expect(Object.keys(parsed.shippingQueue!)).toEqual(["a", "__proto__", "c"]);
    expect(Object.getPrototypeOf(parsed.shippingQueue)).toBe(Object.prototype);
    expect(parsed.shippingQueue!["__proto__"]).toBe(2);
    expect(parsed.shippingQueue).not.toBe(shipping);
  });
});

describe("3차: 한 방향 턱과 성분 색인", () => {
  it("색인을 만든 뒤에도 턱을 정해진 방향으로 넘는 경로를 막지 않는다", () => {
    const project = createBlankProject();
    const tilesetId = Object.keys(project.tilesets)[0]!;
    const tileset = project.tilesets[tilesetId]!;
    const floor = TILE.GRASS;
    const ledge = floor === 1 ? 2 : 1;
    const wall = floor === 3 || ledge === 3 ? 4 : 3;
    const open = { up: true, down: true, left: true, right: true };
    tileset.passability[floor] = open;
    tileset.passability[ledge] = open;
    tileset.passability[wall] = { up: false, down: false, left: false, right: false };
    tileset.ledgeDirections = { [String(ledge)]: "left" };
    const map = createBlankMap("m", 4, 1, tilesetId);
    map.id = "m";
    map.lowerTiles = [floor, ledge, floor, wall];
    map.upperTiles = [-1, -1, -1, -1];
    project.maps[map.id] = map;
    expect(findChasePath(project, map, { x: 2, y: 0 }, { x: 0, y: 0 })).toHaveLength(2);
    armTerrainComponents(project, map);
    expect(terrainMayReach(project, map, 2, 0, 0, 0)).toBe(true);
    expect(findChasePath(project, map, { x: 2, y: 0 }, { x: 0, y: 0 })).toHaveLength(2);
    // 반대 방향은 정말 막혀 있다 — 탐색이 스스로 빈 경로를 낸다.
    expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(0);
    // 턱을 제자리에서 지우면 지문이 바뀌어 색인이 다시 만들어진다.
    tileset.ledgeDirections = {};
    expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(2);
  });
});

describe("3차: 막는 이벤트 판정기", () => {
  it("모든 칸에서 이벤트별 원본 질의와 같은 답을 낸다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const pageOf = (id: string, priority: "same" | "below") => ({
      id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority,
      movement: { type: "fixed" as const, speed: 3, frequency: 3 }, commands: [],
    });
    map.events = [
      { id: "wall", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [pageOf("wall_p", "same")] },
      { id: "floor", x: 4, y: 3, trigger: { kind: "action" }, commands: [], pages: [pageOf("floor_p", "below")] },
      { id: "self", x: 5, y: 5, trigger: { kind: "action" }, commands: [], pages: [pageOf("self_p", "same")] },
      { id: "golem", x: 8, y: 8, trigger: { kind: "action" }, commands: [], pages: [{ ...pageOf("golem_p", "same"), footprint: { width: 3, height: 3 }, passRows: 1 }] },
    ] as never;
    const session = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);
    const query = createBlockingEventQuery(project, map, session, positions, "self");
    for (let y = 0; y < 12; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        const rect = footprintBounds(x, y, { width: 1, height: 1 });
        expect(query(rect), `${x},${y}`).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect, "self"));
      }
    }
  });
});

describe("3차: 전투 적 맞춤", () => {
  it("배율이 1 이하면 필드 크기를 읽지 않는다", () => {
    let reads = 0;
    const field = { get clientWidth() { reads += 1; return 320; }, get clientHeight() { reads += 1; return 160; } } as unknown as HTMLElement;
    const node = { style: { getPropertyValue: () => "1" } } as unknown as HTMLElement;
    expect(fitBattleEnemy(field, node, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    expect(reads).toBe(0);
  });
});

describe("3차: 안개 프레임 예산", () => {
  it("같은 프레임의 두 번째 호출은 굽지 않는다", () => {
    stubCanvas();
    const shared = fakeTextures();
    const reference = fakeTextures();
    expect(ensureFogTexture(shared.textures, "fog", 64, 1)).toBeNull();
    expect(ensureFogTexture(shared.textures, "fog", 64, 1)).toBeNull();
    expect(ensureFogTexture(reference.textures, "fog", 64, 1)).toBeNull();
    // 둘 다 한 프레임에 64줄씩만 진행했으므로 같은 프레임 수에 끝난다.
    let frame = 2;
    while (ensureFogTexture(shared.textures, "fog", 64, frame) === null) {
      ensureFogTexture(shared.textures, "fog", 64, frame);
      expect(ensureFogTexture(reference.textures, "fog", 64, frame)).toBeNull();
      frame += 1;
    }
    expect(frame).toBe(4);
    expect(ensureFogTexture(reference.textures, "fog", 64, frame)).toBe("fog");
  });
});

describe("3차: 분위기 소리 합성 예산", () => {
  it("여러 소리가 한꺼번에 굽혀도 update 한 번의 합성 표본은 예산을 넘지 않는다", () => {
    const created: FakeBuffer[] = [];
    vi.stubGlobal("AudioContext", fakeAudioContext(44100, created));
    const audio = new AtmosphereAudio();
    const effects = [
      { kind: "fireflies", amount: 1, volume: 0.5, sound: "fire" },
      { kind: "fireflies", amount: 1, volume: 0.5, sound: "whisper" },
      { kind: "fireflies", amount: 1, volume: 0.5, sound: "breeze" },
    ] as never;
    const baking = () => (audio as unknown as { baking: Map<string, { channels: { index: number }[] }> }).baking;
    const progress = () => [...baking().values()].reduce((sum, bake) => sum + bake.channels.reduce((s, c) => s + c.index, 0), 0);
    audio.update(effects, true);
    expect(progress()).toBeLessThanOrEqual(100_000);
    expect(baking().size).toBe(1);
    audio.stop();
  });
});


describe("4차: 지형 성분 색인은 해시 충돌에 속지 않는다", () => {
  it("32비트 해시가 같던 두 통행 배열에서도 열린 길을 도달 불가로 막지 않는다", () => {
    // 무작위 퍼징 반례(시드 0xf1a62026). 예전 FNV 지문은 두 배열에 같은 값(1204537343)을 냈다.
    const before = [3, 14, 0, 3, 6, 11, 0, 1, 3];
    const after = [3, 3, 3, 15, 14, 7, 7, 8, 15];
    const flags = (n: number) => ({ up: !!(n & 1), down: !!(n & 2), left: !!(n & 4), right: !!(n & 8) });
    const tileset = { passability: before.map(flags), priority: Array(9).fill("lower") } as unknown as TilesetDef;
    const map = { id: "m", width: 3, height: 3, tilesetId: "t", lowerTiles: [0, 1, 2, 3, 4, 5, 6, 7, 8], upperTiles: Array(9).fill(-1) } as unknown as GameMap;
    const project = { maps: { m: map }, tilesets: { t: tileset } } as unknown as Project;
    armTerrainComponents(project, map);
    after.forEach((n, index) => Object.assign(tileset.passability[index]!, flags(n)));
    expect(terrainMayReach(project, map, 0, 0, 2, 2)).toBe(true);
    expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 2 }).length).toBeGreaterThan(0);
  });
});

describe("4차: 지형이 바뀌면 생활 NPC 는 남은 경로를 다시 짠다", () => {
  it("changeTile 로 길이 막히면 막힌 경로를 재사용하지 않고 우회한다", () => {
    const project = createBlankProject();
    const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
    project.tilesets.t = { ...base, id: "t", count: 2,
      passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
      priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
    const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
      movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 0 }], repeat: false } } };
    const map = { ...createBlankMap("m", 3, 2, "t"), id: "m", lowerTiles: [0, 0, 0, 0, 0, 0], upperTiles: Array(6).fill(-1),
      events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
    project.maps = { m: map };
    project.startMapId = "m";
    store.replace(project);
    const live = store.getCurrent().maps.m!;
    const session = startSession(store.getCurrent());
    session.currentMapId = "m";
    const movers = new Map<string, { moves: unknown[]; step: number }>();
    const scene = {
      map: live, session, eventPositions: { npc: { x: 0, y: 0 } },
      pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
      autonomousNPCs: movers,
      getMapId: () => "m",
      registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
        movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 } as never);
      },
    };
    registerPageMoveRoutes(scene as never);
    expect(movers.get("npc")?.moves).toEqual([{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }]);
    applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 1, y: 0, tile: 1 } as never);
    registerPageMoveRoutes(scene as never);
    expect(movers.get("npc")?.moves.map((move) => (move as { dir: string }).dir)).toEqual(["down", "right", "right", "up"]);
  });
});

describe("4차: 칸 격자 막힘 판정기", () => {
  it("무작위 몸 크기·위치에서 모든 질의 사각이 원본 질의와 같다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    let seed = 0x5eed4;
    const rand = () => { seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
    map.events = Array.from({ length: 40 }, (_, index) => ({
      id: "e" + index, x: Math.floor(rand() * 14) - 1, y: Math.floor(rand() * 14) - 1, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p" + index, name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: rand() < 0.7 ? "same" : "below",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
        footprint: { width: 1 + Math.floor(rand() * 4), height: 1 + Math.floor(rand() * 4) }, passRows: 1 + Math.floor(rand() * 3) }],
    })) as never;
    const session = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);
    const query = createBlockingEventQuery(project, map, session, positions, "e3");
    for (let trial = 0; trial < 600; trial += 1) {
      const x = Math.floor(rand() * 16) - 2;
      const y = Math.floor(rand() * 16) - 2;
      const rect = footprintBounds(x, y, { width: 1 + Math.floor(rand() * 3), height: 1 + Math.floor(rand() * 3) });
      expect(query(rect), JSON.stringify(rect)).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect, "e3"));
    }
  });
});


describe("4차 리뷰 반례", () => {
  it("소수 좌표 이벤트도 칸 격자 판정기가 놓치지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events = [{ id: "half", x: 1.5, y: 1, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [], footprint: { width: 2, height: 1 } }] }] as never;
    const session = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);
    const query = createBlockingEventQuery(project, map, session, positions);
    for (const rect of [pointRect(2, 1), pointRect(1, 1), pointRect(3, 1), pointRect(2, 2)]) {
      expect(query(rect), JSON.stringify(rect)).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect));
    }
  });

  it("같은 길이의 우회로도 지형이 바뀐 뒤에는 새로 깐다", () => {
    const project = createBlankProject();
    const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
    project.tilesets.t = { ...base, id: "t", count: 2,
      passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
      priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
    const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
      movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 2 }], repeat: false } } };
    const map = { ...createBlankMap("m", 3, 3, "t"), id: "m", lowerTiles: Array(9).fill(0), upperTiles: Array(9).fill(-1),
      events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
    project.maps = { m: map };
    project.startMapId = "m";
    store.replace(project);
    const session = startSession(store.getCurrent());
    session.currentMapId = "m";
    const movers = new Map<string, { moves: { dir: string }[] }>();
    const scene = {
      map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
      pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
      autonomousNPCs: movers, getMapId: () => "m",
      registerAutonomousMover(id: string, moves: { dir: string }[], repeat: boolean) {
        movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 } as never);
      },
    };
    registerPageMoveRoutes(scene as never);
    const first = movers.get("npc")!.moves.map((move) => move.dir);
    expect(first).toEqual(["down", "down", "right", "right"]);
    applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 0, y: 1, tile: 1 } as never);
    registerPageMoveRoutes(scene as never);
    expect(movers.get("npc")!.moves.map((move) => move.dir)).toEqual(["right", "down", "down", "right"]);
  });

  it("맵 id 에 구분자가 있어도 연결 기억이 제자리 편집을 놓치지 않는다", () => {
    const connection = { id: "c", from: { mapId: "a|b", x: 1, y: 1 }, to: { mapId: "c", x: 0, y: 0, direction: "down" }, npcEnabled: true, playerEnabled: true };
    const connections = [connection] as never as MapConnection[];
    expect(firstConnectionToward(connections, "a|b", "c")?.first).toBe(connection);
    connection.from.mapId = "a";
    connection.to.mapId = "b|c";
    expect(firstConnectionToward(connections, "a", "b|c")?.first).toBe(connection);
    expect(firstConnectionToward(connections, "a|b", "c")).toBeNull();
  });
});


describe("4차 2차 리뷰 반례", () => {
  it("지형이 바뀌어 경로를 다시 짜도 진행 중인 걸음과 방향은 그대로다", () => {
    const project = createBlankProject();
    const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
    project.tilesets.t = { ...base, id: "t", count: 2,
      passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
      priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
    const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
      movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 4, y: 0 }], repeat: false } } };
    const map = { ...createBlankMap("m", 5, 2, "t"), id: "m", lowerTiles: Array(10).fill(0), upperTiles: Array(10).fill(-1),
      events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
    project.maps = { m: map };
    project.startMapId = "m";
    store.replace(project);
    const session = startSession(store.getCurrent());
    session.currentMapId = "m";
    const movers = new Map<string, Record<string, unknown>>();
    const scene = {
      map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
      pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
      autonomousNPCs: movers, getMapId: () => "m",
      registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
        movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 });
      },
    };
    registerPageMoveRoutes(scene as never);
    const mover = movers.get("npc")!;
    // 한 칸 걷는 중: 논리 위치는 이미 (1,0), 보간은 반쯤.
    const walking = { fromX: 0, fromY: 0, toX: 1, toY: 0, elapsedMs: 100, durationMs: 400 };
    mover.activeMove = walking;
    mover.facing = "right";
    mover.step = 1;
    mover.timer = 55;
    scene.eventPositions.npc = { x: 1, y: 0 };
    applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 3, y: 0, tile: 1 } as never);
    registerPageMoveRoutes(scene as never);
    const after = movers.get("npc")!;
    expect(after).toBe(mover);
    expect(after.activeMove).toBe(walking);
    expect(after.facing).toBe("right");
    expect(after.timer).toBe(55);
    expect(after.step).toBe(0);
    expect((after.moves as { dir: string }[]).map((move) => move.dir)).toEqual(["down", "right", "right", "right", "up"]);
  });
});

