import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { SCREEN_EFFECT_Z_INDEX, syncScreenEffects } from "@/player/playSceneScreenEffects";
import { FakeElement, installFakeDom, findByTestId } from "./fakeDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

// syncScreenEffects 는 dialogueHost(scene) → host 에 풀스크린 DOM 오버레이를 추가/제거한다.
// FakeElement 의 querySelector 는 속성 선택자([data-testid=...])를 지원하지 않으므로,
// 테스트 전용 host 로 querySelector 를 dataset 기반으로 오버라이드한다.
class TestHost extends FakeElement {
  constructor() {
    super("div");
  }
  override querySelector(selector: string): FakeElement | null {
    const match = selector.match(/data-testid=['"]([^'"]+)['"]/);
    if (match) {
      const found = findByTestId(this, match[1]!);
      return found ?? null;
    }
    return super.querySelector(selector);
  }
}

function mkScene(session: PlaySessionLike): PlaySceneContext {
  const host = new TestHost();
  // dialogueHost(scene) 은 scene.game.registry.get("dialogueHost") 를 읽는다.
  // 인터페이스만 충족하는 최소 scene 을 만든다.
  return {
    session,
    game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
  } as unknown as PlaySceneContext;
}

function hostOf(scene: PlaySceneContext): TestHost {
  return (scene.game as unknown as { registry: { get: (k: string) => TestHost } }).registry.get("dialogueHost");
}

let restore: (() => void) | null = null;

beforeEach(() => {
  restore = installFakeDom();
});

afterEach(() => {
  restore?.();
  restore = null;
});

function mkSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorExperience: {},
    actorLevels: {},
    actorEquipment: {},
    actorVitals: {},
    currentMapId: "m1",
    x: 0,
    y: 0,
    m2Runtime: { screen: {}, access: {}, audio: {}, actors: {}, events: {}, map: {}, system: {}, session: {}, camera: {}, screenEffects: [], pathfinding: [], waits: [], regions: [], quests: {}, dialogue: [], cutscene: {}, checkpoints: [], ui: [], debug: [], expressions: [], fallbacks: [] },
  };
}

describe("syncScreenEffects — DOM 오버레이", () => {
  it("tint 가 neutral 이면 오버레이를 추가하지 않는다", () => {
    const session = mkSession();
    session.m2Runtime!.screen.tint = "neutral";
    const scene = mkScene(session);

    syncScreenEffects(scene);

    expect(hostOf(scene).childNodes.length).toBe(0);
  });

  it("tint 가 색상이면 반투명 오버레이를 추가한다", () => {
    const session = mkSession();
    session.m2Runtime!.screen.tint = "red";
    const scene = mkScene(session);

    syncScreenEffects(scene);

    const layer = findByTestId(hostOf(scene), "runtime-screen-effect");
    expect(layer).not.toBeNull();
    expect(layer!.style.background).toContain("255,0,0");
    expect(layer!.dataset.mode).toBe("screen-tint");
  });

  it("색조는 대사창 아래에 깔린다 — 회상 세피아가 대사까지 물들이면 안 된다", () => {
    const session = mkSession();
    session.m2Runtime!.screen.tint = "sepia";
    const scene = mkScene(session);

    syncScreenEffects(scene);

    const layer = findByTestId(hostOf(scene), "runtime-screen-effect")!;
    const zOf = (file: string, selector: string): number => {
      const css = readFileSync(file, "utf8");
      const block = css.slice(css.indexOf(`${selector} {`));
      return Number(/z-index:\s*(\d+)/.exec(block.slice(0, block.indexOf("}")))?.[1]);
    };
    const dialogueZ = zOf("src/styles/dialogue.css", ".dialogue-overlay");
    const pictureZ = zOf("src/styles/database/tabs-b-status-menu-main.css", ".picture-layer");
    expect(Number(layer.style.zIndex)).toBe(SCREEN_EFFECT_Z_INDEX);
    expect(zOf("src/styles/database/tabs-b-status-menu-main.css", ".runtime-screen-effect")).toBe(SCREEN_EFFECT_Z_INDEX);
    expect(SCREEN_EFFECT_Z_INDEX).toBeLessThan(dialogueZ);
    expect(SCREEN_EFFECT_Z_INDEX).toBeGreaterThan(pictureZ);
  });

  it("hidden 이 true 면 검정 오버레이로 덮는다", () => {
    const session = mkSession();
    session.m2Runtime!.screen.hidden = true;
    const scene = mkScene(session);

    syncScreenEffects(scene);

    const layer = findByTestId(hostOf(scene), "runtime-screen-effect");
    expect(layer).not.toBeNull();
    expect(layer!.style.background).toBe("rgba(0,0,0,1)");
    expect(layer!.dataset.mode).toBe("screen-hidden");
  });

  it("tint 에서 해제(neutral)하면 오버레이가 제거된다", () => {
    const session = mkSession();
    session.m2Runtime!.screen.tint = "blue";
    const scene = mkScene(session);

    syncScreenEffects(scene);
    expect(findByTestId(hostOf(scene), "runtime-screen-effect")).not.toBeNull();

    session.m2Runtime!.screen.tint = "neutral";
    syncScreenEffects(scene);
    expect(findByTestId(hostOf(scene), "runtime-screen-effect")).toBeNull();
  });

  it("hidden 이 해제되면 오버레이가 제거된다", () => {
    const session = mkSession();
    session.m2Runtime!.screen.hidden = true;
    const scene = mkScene(session);

    syncScreenEffects(scene);
    expect(findByTestId(hostOf(scene), "runtime-screen-effect")).not.toBeNull();

    session.m2Runtime!.screen.hidden = false;
    syncScreenEffects(scene);
    expect(findByTestId(hostOf(scene), "runtime-screen-effect")).toBeNull();
  });

  it("r,g,b 형태의 tint 값이 rgba 로 변환된다", () => {
    const session = mkSession();
    session.m2Runtime!.screen.tint = "128,64,32";
    const scene = mkScene(session);

    syncScreenEffects(scene);

    const layer = findByTestId(hostOf(scene), "runtime-screen-effect");
    expect(layer!.style.background).toBe("rgba(128,64,32,0.45)");
  });
});
