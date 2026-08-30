// 컷신 중 필드 HUD 억제 — 2026-08-30 실측 회귀.
//
// Modern `Cutscene Control` 의 `HUD 숨김`(hideHud) 은 드롭다운 옵션으로만 존재하고 소비처가
// 없는 죽은 값이었다(전 소스 grep 결과 m2ModernCatalog 와 표면 기준선 두 곳뿐). 미니맵과 손
// 슬롯을 숨기는 유일한 경로는 `.play-stage:has(> .dialogue-overlay:not(:empty))` CSS 였고, 회상
// 컷신의 카메라 팬·픽처·틴트 비트에는 대사가 없어 오버레이가 비어 있다 — 그 구간 내내 HUD 가
// 떠 있었다. 여기서는 클래스 토글을 단정하고, 실제 display:none 렌더는 라이브 캡처가 증명한다.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { syncCutsceneHudVisibility } from "@/player/playSceneScreenEffects";
import {
  beginCutsceneControl,
  endCutsceneControl,
  CUTSCENE_HIDE_HUD_FLAG,
  CUTSCENE_HUD_HIDDEN_CLASS,
  isCutsceneHudHidden,
} from "@/player/cutsceneControl";
import { FakeElement, installFakeDom } from "./fakeDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

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

function mkScene(session: PlaySessionLike): { scene: PlaySceneContext; stage: FakeElement } {
  const stage = new FakeElement("div");
  stage.className = "play-stage";
  return {
    stage,
    scene: {
      session,
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? stage : undefined) } },
    } as unknown as PlaySceneContext,
  };
}

let restore: (() => void) | null = null;

beforeEach(() => {
  restore = installFakeDom();
});

afterEach(() => {
  restore?.();
  restore = null;
});

describe("컷신 HUD 억제", () => {
  it("입력 잠금이 걸리면 스테이지에 억제 클래스가 붙고 해제하면 사라진다", () => {
    const session = mkSession();
    const { scene, stage } = mkScene(session);

    syncCutsceneHudVisibility(scene);
    expect(stage.classList.contains(CUTSCENE_HUD_HIDDEN_CLASS)).toBe(false);

    beginCutsceneControl(session, "ev_memory", true);
    syncCutsceneHudVisibility(scene);
    expect(stage.classList.contains(CUTSCENE_HUD_HIDDEN_CLASS)).toBe(true);

    endCutsceneControl(session);
    syncCutsceneHudVisibility(scene);
    expect(stage.classList.contains(CUTSCENE_HUD_HIDDEN_CLASS)).toBe(false);
  });

  it("잠금 없이 hideHud 플래그만 켜도 억제된다 (Modern Cutscene Control 의 HUD 숨김)", () => {
    const session = mkSession();
    const { scene, stage } = mkScene(session);

    session.flags[CUTSCENE_HIDE_HUD_FLAG] = true;
    expect(isCutsceneHudHidden(session)).toBe(true);

    syncCutsceneHudVisibility(scene);
    expect(stage.classList.contains(CUTSCENE_HUD_HIDDEN_CLASS)).toBe(true);
  });

  it("대사가 없는 비트에서도 억제된다 — 대화창 :has() 규칙에 의존하지 않는다", () => {
    const session = mkSession();
    const { scene, stage } = mkScene(session);

    // 대화 오버레이가 비어 있는 상태(카메라 팬·픽처 전용 비트)를 그대로 둔다.
    expect(stage.childNodes.length).toBe(0);

    beginCutsceneControl(session, undefined, false);
    syncCutsceneHudVisibility(scene);

    expect(stage.classList.contains(CUTSCENE_HUD_HIDDEN_CLASS)).toBe(true);
  });

  it("반복 호출이 클래스를 중복으로 쌓지 않는다", () => {
    const session = mkSession();
    const { scene, stage } = mkScene(session);

    beginCutsceneControl(session, undefined, false);
    for (let i = 0; i < 5; i += 1) syncCutsceneHudVisibility(scene);

    const occurrences = stage.className.split(/\s+/).filter((token) => token === CUTSCENE_HUD_HIDDEN_CLASS);
    expect(occurrences).toHaveLength(1);
  });
});
