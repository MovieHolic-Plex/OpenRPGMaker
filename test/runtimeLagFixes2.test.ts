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
