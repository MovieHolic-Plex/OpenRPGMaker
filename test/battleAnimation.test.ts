// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { battleAnimationChainDurationMs, battleAnimationDurationMs, activeTimingEffects } from "@/battle/animationTiming";
import { GENERATED_EFFECT_SHEETS, generatedEffectFollowUps } from "@/assets/generatedEffectSheets";
import { recoverMsForAnimation } from "@/player/battleActionBeats";
import { battleAnimationLeadPlan, mountBattleAnimationPlayback, battleAnimationFrameMs } from "@/player/battleAnimationDom";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { createBlankProject } from "@/project/defaults";
import { defaultBattleAnimationRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { store } from "@/project/store";
import type { BattleAnimationRecord, BattleAnimationFlash, BattleAnimationTiming, BattleAnimationSheet } from "@/project/types";
import { BATTLE_ANIMATION_FRAME_MS, battleAnimationSheetAssetScale, battleAnimationSheetRendering, battleAnimationSheetRmScale } from "@/player/battleAnimationPlayback";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";
import { mountBattleScene } from "@/player/battleDom";
import { BATTLE_FLASH_FILTER_ID } from "@/player/battleFlashFilter";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { isolateTimers } from "./mergedTeardown";

/**
 * 연출 합성(followUps) 계약 — 2026-09-03.
 * 레코드가 후속 애니메이션을 선언하면 본체의 startFrame 에서 같은 앵커에 겹쳐 시작하고, 전체 길이는
 * 둘 중 늦은 끝이며, 시퀀서는 그만큼 recover 비트를 늘린다. 본체의 프레임 전환이 후속 프레임을 건드리지 않는다.
 */
describe("battleAnimationFollowUps", () => {
  isolateTimers();
  function record(id: string, frameCount: number, extra: Partial<BattleAnimationRecord> = {}): BattleAnimationRecord {
    return normalizeBattleAnimationRecord({
      id,
      name: id,
      resourceId: "scarloxy-battle-anim-scratch",
      sheet: { frameWidth: 96, frameHeight: 96, columns: frameCount },
      frames: Array.from({ length: frameCount }, (_u, pattern) => ({ cells: [{ pattern, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] })),
      ...extra,
    });
  }
  describe("정규화", () => {
    it("followUps 를 보존하고 자기 참조·빈 id 는 버린다", () => {
      const normalized = normalizeBattleAnimationRecord({
        id: "a",
        name: "a",
        followUps: [{ animationId: "b", startFrame: 4 }, { animationId: "a", startFrame: 0 }, { animationId: " ", startFrame: 2 }, { animationId: "c", startFrame: -3 }],
      });
      expect(normalized.followUps).toEqual([{ animationId: "b", startFrame: 4 }, { animationId: "c", startFrame: 0 }]);
    });

    it("없으면 빈 배열", () => {
      expect(normalizeBattleAnimationRecord({ id: "a", name: "a" }).followUps).toEqual([]);
    });
  });
  describe("길이", () => {
    const main = record("main", 10, { followUps: [{ animationId: "tail", startFrame: 6 }] });
    const tail = record("tail", 8);
    const records = [main, tail];

    it("본체 10프레임(1200ms)보다 6프레임에서 시작하는 8프레임 후속(720+960)이 길면 그 끝이 전체 길이다", () => {
      expect(battleAnimationDurationMs(main)).toBe(1200);
      expect(battleAnimationChainDurationMs(main, records)).toBe(6 * 120 + 8 * 120);
    });

    it("후속이 본체 안에서 끝나면 본체 길이 그대로", () => {
      const short = record("short", 2);
      const host = record("host", 10, { followUps: [{ animationId: "short", startFrame: 1 }] });
      expect(battleAnimationChainDurationMs(host, [host, short])).toBe(1200);
    });

    it("없는 후속 id 는 무시한다", () => {
      const host = record("host", 4, { followUps: [{ animationId: "ghost", startFrame: 2 }] });
      expect(battleAnimationChainDurationMs(host, [host])).toBe(480);
    });

    it("스냅샷이 전체 길이를 싣는다", () => {
      expect(createBattleAnimationSnapshot(records, "main", "enemy_1").durationMs).toBe(1680);
    });

    it("recover 비트는 애니메이션이 비트 총합보다 길 때만 늘어난다", () => {
      expect(recoverMsForAnimation(undefined, 470, 110, 430)).toBe(430);
      expect(recoverMsForAnimation(600, 470, 110, 430)).toBe(430);
      expect(recoverMsForAnimation(1680, 470, 110, 430)).toBe(1100);
    });
  });
  describe("기본 카탈로그", () => {
    it("후속 slug 는 카탈로그 안의 다른 항목이고, 시작 프레임은 본체 안이다", () => {
      const withChains = GENERATED_EFFECT_SHEETS.filter((effect) => (effect.followUps?.length ?? 0) > 0);
      expect(withChains.length).toBeGreaterThanOrEqual(6);
      for (const effect of withChains) {
        for (const followUp of effect.followUps ?? []) {
          expect(GENERATED_EFFECT_SHEETS.some((other) => other.slug === followUp.slug && other.slug !== effect.slug), `${effect.slug} → ${followUp.slug}`).toBe(true);
          expect(followUp.startFrame).toBeGreaterThan(0);
          expect(followUp.startFrame).toBeLessThan(effect.frameCount);
        }
        expect(generatedEffectFollowUps(effect).every((entry) => entry.animationId.startsWith("anim_"))).toBe(true);
      }
    });

    it("기본 DB 레코드에 후속이 실리고 그 id 가 존재한다", () => {
      const records = defaultBattleAnimationRecords();
      const fire = records.find((entry) => entry.resourceId === "generated-battle-anim-fire-burst");
      expect(fire?.followUps?.[0]?.animationId).toBe("anim_gen_smoke_vanish");
      for (const entry of records) {
        for (const followUp of entry.followUps ?? []) {
          expect(records.some((other) => other.id === followUp.animationId), `${entry.id} → ${followUp.animationId}`).toBe(true);
        }
      }
      // 후속이 있는 본체의 전체 길이는 본체보다 길다 — 아니면 합성이 눈에 보이지 않는다.
      expect(battleAnimationChainDurationMs(fire, records)).toBeGreaterThan(battleAnimationDurationMs(fire));
    });
  });
  describe("DOM 재생", () => {
    const TARGET = "enemy_1";
    beforeEach(() => {
      vi.useFakeTimers();
      document.body.innerHTML = "";
      const project = createBlankProject();
      project.database.battleAnimations = [
        record("main", 4, { followUps: [{ animationId: "tail", startFrame: 2 }] }),
        record("tail", 3),
      ];
      store.replace(project);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function mount(): HTMLElement {
      const scene = document.createElement("section");
      const target = document.createElement("div");
      target.dataset.testid = TARGET;
      scene.append(target);
      document.body.append(scene);
      const playback = mountBattleAnimationPlayback(
        { lastAnimation: { animationId: "main", targetId: TARGET, name: "main", soundResourceIds: [], flashTargets: [], screenShake: false, frameCount: 4 } } as never,
        scene
      );
      if (!playback) throw new Error("재생 엘리먼트가 없다");
      // 실제 흐름(syncBattleAnimationLayer)은 마운트 직후 레이어에 붙인다. 후속은 붙어 있는 본체에만 달린다.
      scene.append(playback.element);
      return playback.element;
    }

    it("후속은 startFrame 시각에 본체 안에 붙고, 본체 프레임 전환이 후속 프레임을 건드리지 않는다", () => {
      const element = mount();
      expect(element.querySelector(".battle-animation-followup")).toBeNull();
      vi.advanceTimersByTime(2 * 120);
      const follow = element.querySelector<HTMLElement>(".battle-animation-followup");
      expect(follow?.dataset.animationId).toBe("tail");
      expect(follow?.dataset.startFrame).toBe("2");
      // 본체는 프레임 2, 후속은 프레임 0 이 보인다 — 서로 다른 시트의 프레임이 독립적으로 켜진다.
      const mainFrames = [...element.querySelectorAll<HTMLElement>(":scope > .battle-animation-sheet > .battle-animation-frame")];
      const followFrames = [...follow!.querySelectorAll<HTMLElement>(".battle-animation-frame")];
      expect(mainFrames.filter((f) => !f.hidden).map((f) => f.dataset.frameIndex)).toEqual(["2"]);
      expect(followFrames.filter((f) => !f.hidden).map((f) => f.dataset.frameIndex)).toEqual(["0"]);
      vi.advanceTimersByTime(120);
      expect(mainFrames.filter((f) => !f.hidden).map((f) => f.dataset.frameIndex)).toEqual(["3"]);
      expect(followFrames.filter((f) => !f.hidden).map((f) => f.dataset.frameIndex)).toEqual(["1"]);
    });

    it("본체는 후속까지 끝난 뒤에야 playbackFinished 를 단다", () => {
      const element = mount();
      vi.advanceTimersByTime(4 * 120);
      // 본체(4프레임 = 480ms)는 끝났지만 후속(240ms 시작 + 360ms)은 600ms 에 끝난다.
      expect(element.dataset.playbackFinished).toBeUndefined();
      vi.advanceTimersByTime(130);
      expect(element.dataset.playbackFinished).toBe("true");
      expect(element.querySelector<HTMLElement>(".battle-animation-followup")?.dataset.playbackFinished).toBe("true");
    });
  });
  describe("앞 프레임 건너뛰기 (battleAnimationSkipFrames · battleAnimationLeadPlan)", () => {
    // 포켓몬 안무는 이펙트를 착탄 직전에 올린다. approach 안에 다 들어가지 않는 앞 프레임까지 0번부터 돌리면
    // 착탄 효과음이 타격보다 160~420ms 뒤에 났다(2026-10-02 실측). 들어가지 않는 만큼만 건너뛴다.
    const TARGET = "enemy_1";
    beforeEach(() => {
      vi.useFakeTimers();
      document.body.innerHTML = "";
      const project = createBlankProject();
      project.database.battleAnimations = [
        record("main", 6, { timings: [{ frameIndex: 3, soundResourceId: "se-test" }], followUps: [{ animationId: "tail", startFrame: 4 }] } as Partial<BattleAnimationRecord>),
        record("tail", 3),
      ];
      store.replace(project);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function mount(skipFrames: number): HTMLElement {
      const scene = document.createElement("section");
      if (skipFrames > 0) scene.dataset.battleAnimationSkipFrames = String(skipFrames);
      const target = document.createElement("div");
      target.dataset.testid = TARGET;
      scene.append(target);
      document.body.append(scene);
      const playback = mountBattleAnimationPlayback(
        { lastAnimation: { animationId: "main", targetId: TARGET, name: "main", soundResourceIds: ["se-test"], flashTargets: [], screenShake: false, frameCount: 6 } } as never,
        scene
      );
      if (!playback) throw new Error("재생 엘리먼트가 없다");
      scene.append(playback.element);
      return playback.element;
    }

    const visibleMain = (element: HTMLElement) =>
      [...element.querySelectorAll<HTMLElement>(":scope > .battle-animation-sheet > .battle-animation-frame")].filter((f) => !f.hidden).map((f) => f.dataset.frameIndex);

    it("계획: 착탄 프레임 앞을 쓸 수 있는 시간만큼 앞당기고 나머지만 건너뛴다", () => {
      // main: 6프레임 · 착탄(효과음) 3번 · 프레임 120ms.
      expect(battleAnimationLeadPlan("main", 0)).toEqual({ leadMs: 0, skipFrames: 3, skippedMs: 360 }); // 접촉·발사체 — 착탄 프레임부터
      expect(battleAnimationLeadPlan("main", 250)).toEqual({ leadMs: 240, skipFrames: 1, skippedMs: 120 }); // 두 프레임만 들어간다
      expect(battleAnimationLeadPlan("main", 1000)).toEqual({ leadMs: 360, skipFrames: 0, skippedMs: 0 }); // 다 들어가면 0번부터
      expect(battleAnimationLeadPlan("tail", 1000)).toEqual({ leadMs: 0, skipFrames: 0, skippedMs: 0 }); // 타이밍 없는 레코드
    });

    it("건너뛸 프레임 수가 있으면 거기서 시작하고 그 프레임의 소리가 마운트 즉시 걸린다", () => {
      const element = mount(3);
      expect(element.dataset.playbackStartFrame).toBe("3");
      expect(visibleMain(element)).toEqual(["3"]);
      expect(element.dataset.activeSoundResourceId).toBe("se-test");
      vi.advanceTimersByTime(120);
      expect(visibleMain(element)).toEqual(["4"]);
    });

    it("후속은 건너뛴 프레임만큼 당겨진다", () => {
      const element = mount(3);
      // 후속 startFrame 4 − 건너뜀 3 = 1프레임(120ms) 뒤.
      vi.advanceTimersByTime(119);
      expect(element.querySelector(".battle-animation-followup")).toBeNull();
      vi.advanceTimersByTime(1);
      expect(element.querySelector<HTMLElement>(".battle-animation-followup")?.dataset.animationId).toBe("tail");
    });

    it("건너뛴 지점보다 먼저 시작했어야 할 후속은 그만큼 진행된 프레임부터 바로 튼다", () => {
      // 후속 startFrame 4 · 건너뜀 5 → 후속은 이미 1프레임 지났어야 한다.
      const element = mount(5);
      const follow = element.querySelector<HTMLElement>(".battle-animation-followup");
      expect(follow?.dataset.animationId).toBe("tail");
      const followFrames = [...follow!.querySelectorAll<HTMLElement>(".battle-animation-frame")];
      expect(followFrames.filter((f) => !f.hidden).map((f) => f.dataset.frameIndex)).toEqual(["1"]);
    });

    it("늦게 온 틱은 흐른 시간만큼 프레임을 따라잡는다(부하 때 착탄 프레임이 밀리지 않는다)", () => {
      const element = mount(0);
      // 틱이 4프레임(480ms) 늦게 왔다고 치고 다음 틱을 돌린다 — 흐른 시간은 600ms = 5프레임.
      vi.setSystemTime(new Date(Date.now() + 4 * 120));
      vi.advanceTimersByTime(120);
      expect(visibleMain(element)).toEqual(["5"]);
    });

    it("값이 없으면 기존대로 프레임 0부터 돈다", () => {
      const element = mount(0);
      expect(element.dataset.playbackStartFrame).toBe("0");
      expect(visibleMain(element)).toEqual(["0"]);
    });
  });
});

/**
 * 전투 이펙트 재생의 세 가지 계약.
 *
 * 1. 배속을 켜면 이펙트도 같이 빨라진다 — 예전에는 시퀀서만 배율을 먹고 애니메이션은
 *    상수 120ms 라, 3배속에서 이펙트만 원속도로 남아 다음 행동 위로 겹쳤다.
 * 2. 재생이 끝나면 그림을 걷는다 — 예전에는 clearInterval 만 해서 마지막 컷이 약 1초 남았다.
 * 3. flash.target 을 지킨다 — 예전에는 대상 지정을 무시하고 무조건 화면 전체를 번쩍였다.
 */
describe("battleAnimationPlaybackFixes", () => {
  isolateTimers();
  const TARGET_ID = "enemy_1";
  function sceneWithTarget(speed?: string): { scene: HTMLElement; target: HTMLElement } {
    const scene = document.createElement("section");
    scene.className = "battle-scene";
    if (speed) scene.dataset.battleSpeed = speed;
    const target = document.createElement("div");
    target.dataset.testid = TARGET_ID;
    scene.append(target);
    document.body.append(scene);
    return { scene, target };
  }
  /** 3프레임짜리 최소 레코드. 시트가 있어야 재생 경로를 탄다. */
  function seedAnimation(
    timings: BattleAnimationTiming[],
    options: { readonly resourceId?: string; readonly frameCount?: number } = {}
  ): void {
    const frameCount = options.frameCount ?? 3;
    const project = createBlankProject();
    project.database.battleAnimations = [
      normalizeBattleAnimationRecord({
        id: "anim_test",
        name: "테스트",
        resourceId: options.resourceId ?? "scarloxy-battle-anim-scratch",
        sheet: { frameWidth: 96, frameHeight: 96, columns: frameCount },
        frames: Array.from({ length: frameCount }, (_unused, pattern) => ({
          cells: [{ pattern, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }],
        })),
        timings,
      }),
    ];
    store.replace(project);
  }
  function snapshotWith(): never | Record<string, unknown> {
    return {
      lastAnimation: {
        animationId: "anim_test",
        targetId: TARGET_ID,
        name: "테스트",
        soundResourceIds: [],
        flashTargets: [],
        screenShake: false,
        frameCount: 3,
      },
    };
  }
  function flashTiming(target: BattleAnimationFlash["target"]): BattleAnimationTiming {
    return { frameIndex: 0, flash: { target, color: { red: 120, green: 180, blue: 255, gray: 0 }, durationFrames: 4 } };
  }
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  describe("battleAnimationFrameMs — 배속이 이펙트에도 걸린다", () => {
    it("배율이 없으면 기본 간격", () => {
      const { scene } = sceneWithTarget();
      expect(battleAnimationFrameMs(scene)).toBe(BATTLE_ANIMATION_FRAME_MS);
      expect(battleAnimationFrameMs(null)).toBe(BATTLE_ANIMATION_FRAME_MS);
    });

    it("배율이 커질수록 간격이 짧아진다", () => {
      const fast = battleAnimationFrameMs(sceneWithTarget("3.0").scene);
      document.body.innerHTML = "";
      const mid = battleAnimationFrameMs(sceneWithTarget("1.8").scene);
      expect(fast).toBeLessThan(mid);
      expect(mid).toBeLessThan(BATTLE_ANIMATION_FRAME_MS);
    });

    it("에디터가 제공하는 3단계가 서로 다른 간격이 된다", () => {
      const values = ["1.0", "1.8", "3.0"].map((speed) => {
        document.body.innerHTML = "";
        return battleAnimationFrameMs(sceneWithTarget(speed).scene);
      });
      expect(new Set(values).size).toBe(3);
    });

    it("비정상 배율은 기본 간격으로 떨어진다", () => {
      for (const bad of ["0", "-2", "abc", ""]) {
        document.body.innerHTML = "";
        expect(battleAnimationFrameMs(sceneWithTarget(bad).scene)).toBe(BATTLE_ANIMATION_FRAME_MS);
      }
    });

    it("하한 아래 배율에서도 간격이 무한정 늘지 않는다", () => {
      // 시퀀서와 같은 하한(0.2)을 쓴다 — 여기만 다르면 서로 어긋난다.
      expect(battleAnimationFrameMs(sceneWithTarget("0.01").scene)).toBe(BATTLE_ANIMATION_FRAME_MS / 0.2);
    });
  });
  describe("flash.target 라우팅", () => {
    it('target="target" 은 대상만 물들이고 화면은 건드리지 않는다', () => {
      seedAnimation([flashTiming("target")]);
      const { scene, target } = sceneWithTarget();

      mountBattleAnimationPlayback(snapshotWith() as never, scene);

      expect(target.classList.contains("battle-animation-target-flash")).toBe(true);
      expect(scene.classList.contains("battle-screen-flash")).toBe(false);
      // 저작한 색이 대상 노드로 간다.
      expect(target.style.getPropertyValue("--battle-flash-color")).toContain("120, 180, 255");
    });

    it('target="screen" 은 화면 전체를 번쩍인다', () => {
      seedAnimation([flashTiming("screen")]);
      const { scene, target } = sceneWithTarget();

      mountBattleAnimationPlayback(snapshotWith() as never, scene);

      expect(scene.classList.contains("battle-screen-flash")).toBe(true);
      expect(target.classList.contains("battle-animation-target-flash")).toBe(false);
      expect(scene.style.getPropertyValue("--battle-flash-color")).toContain("120, 180, 255");
    });

    it("대상 노드를 못 찾으면 화면 플래시로 떨어져 연출이 사라지지 않는다", () => {
      seedAnimation([flashTiming("target")]);
      const scene = document.createElement("section");
      scene.className = "battle-scene";
      document.body.append(scene); // 대상 노드 없음

      mountBattleAnimationPlayback(snapshotWith() as never, scene);

      expect(scene.classList.contains("battle-screen-flash")).toBe(true);
    });

    it("destroy 하면 대상 플래시 흔적이 남지 않는다", () => {
      seedAnimation([flashTiming("target")]);
      const { scene, target } = sceneWithTarget();

      const playback = mountBattleAnimationPlayback(snapshotWith() as never, scene);
      expect(target.classList.contains("battle-animation-target-flash")).toBe(true);

      playback?.destroy();
      expect(target.classList.contains("battle-animation-target-flash")).toBe(false);
    });
  });
  describe("재생 종료", () => {
    it("생성 이펙트는 75ms마다 다음 프레임으로 넘어간다", () => {
      vi.useFakeTimers();
      seedAnimation([], { resourceId: "generated-battle-anim-slash-steel", frameCount: 8 });
      const { scene } = sceneWithTarget();

      const playback = mountBattleAnimationPlayback(snapshotWith() as never, scene)!;
      expect(playback.element.dataset.currentFrame).toBe("0");
      vi.advanceTimersByTime(75);
      expect(playback.element.dataset.currentFrame).toBe("1");
    });

    it("생성 이펙트의 플래시 지속시간도 75ms 프레임 단위를 쓴다", () => {
      seedAnimation([flashTiming("target")], {
        resourceId: "generated-battle-anim-slash-steel",
        frameCount: 8,
      });
      const { scene, target } = sceneWithTarget();

      mountBattleAnimationPlayback(snapshotWith() as never, scene);

      expect(target.style.getPropertyValue("--battle-flash-duration")).toBe("300ms");
    });

    it("마지막 프레임까지 돌면 그림을 걷는다", () => {
      vi.useFakeTimers();
      seedAnimation([]);
      const { scene } = sceneWithTarget();

      const playback = mountBattleAnimationPlayback(snapshotWith() as never, scene);
      const element = playback!.element;
      expect(element.querySelectorAll(".battle-animation-frame").length).toBe(3);

      // 3프레임 × 120ms 를 넘겨 재생을 끝낸다.
      vi.advanceTimersByTime(BATTLE_ANIMATION_FRAME_MS * 4);

      expect(element.dataset.playbackFinished).toBe("true");
      const visible = [...element.querySelectorAll<HTMLElement>(".battle-animation-frame")].filter((f) => !f.hidden);
      expect(visible, "재생이 끝났는데 마지막 컷이 화면에 남아 있다").toHaveLength(0);
    });

    it("종료 시 화면 효과 클래스도 함께 걷힌다", () => {
      vi.useFakeTimers();
      seedAnimation([flashTiming("screen")]);
      const { scene } = sceneWithTarget();

      mountBattleAnimationPlayback(snapshotWith() as never, scene);
      expect(scene.classList.contains("battle-screen-flash")).toBe(true);

      vi.advanceTimersByTime(BATTLE_ANIMATION_FRAME_MS * 4);
      expect(scene.classList.contains("battle-screen-flash")).toBe(false);
    });
  });
});

/**
 * 시트 해상도 계약 — `BattleAnimationSheet.assetScale`.
 *
 * 왜 필요한가(실측 2026-09-03): 런타임이 모든 시트를 320 시대 자산으로 보고 2배로 그려서,
 * 384px 고해상도 이펙트 시트를 그대로 넣으면 768 논리 px 로 무대를 덮는다. 반대로 지금의
 * 96px 시트는 48 격자를 2배 복제한 것이라 화면에서 한 픽셀이 4 CSS px 굵기다(몬스터 밀도의 1/10).
 * 시트 1px 이 논리 px 몇 개를 차지하는지를 레코드가 들고 있어야 두 종류가 한 렌더러에서 맞게 그려진다.
 */
describe("battleAnimationSheetScale", () => {
  isolateTimers();
  const LEGACY_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };
  const HIRES_SHEET: BattleAnimationSheet = { frameWidth: 384, frameHeight: 384, columns: 10, assetScale: 0.5 };
  describe("normalizeBattleAnimationRecord — assetScale", () => {
    it("필드가 없는 저장 레코드는 320 시대 자산(2)으로 읽힌다", () => {
      const record = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: LEGACY_SHEET });
      expect(record.sheet?.assetScale).toBe(BATTLE_ASSET_PIXEL_SCALE);
    });

    it("고해상도 시트의 0.5 를 보존한다", () => {
      const record = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: HIRES_SHEET });
      expect(record.sheet?.assetScale).toBe(0.5);
    });

    it("비정상 값은 범위(0.125~8) 안으로 접거나 기본값으로 돌린다", () => {
      const tooSmall = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: { ...LEGACY_SHEET, assetScale: 0.001 } });
      const tooBig = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: { ...LEGACY_SHEET, assetScale: 99 } });
      const nan = normalizeBattleAnimationRecord({ id: "a", name: "a", sheet: { ...LEGACY_SHEET, assetScale: Number.NaN } });
      expect(tooSmall.sheet?.assetScale).toBe(0.125);
      expect(tooBig.sheet?.assetScale).toBe(8);
      expect(nan.sheet?.assetScale).toBe(BATTLE_ASSET_PIXEL_SCALE);
    });
  });
  describe("시트 배율 파생값", () => {
    it("논리 px 환산: 레거시 2, 고해상도 0.5, 시트 없음 2", () => {
      expect(battleAnimationSheetAssetScale(LEGACY_SHEET)).toBe(2);
      expect(battleAnimationSheetAssetScale(HIRES_SHEET)).toBe(0.5);
      expect(battleAnimationSheetAssetScale(undefined)).toBe(2);
    });

    it("RM px(320 시대) 환산은 논리 환산의 절반 — 미리보기·맵이 쓴다", () => {
      expect(battleAnimationSheetRmScale(LEGACY_SHEET)).toBe(1);
      expect(battleAnimationSheetRmScale(HIRES_SHEET)).toBe(0.25);
    });

    it("확대되는 시트만 pixelated, 축소되는 시트는 smooth", () => {
      expect(battleAnimationSheetRendering(LEGACY_SHEET)).toBe("pixelated");
      expect(battleAnimationSheetRendering({ ...LEGACY_SHEET, assetScale: 1 })).toBe("pixelated");
      expect(battleAnimationSheetRendering(HIRES_SHEET)).toBe("smooth");
    });
  });
  describe("battleAnimationDom.animationCell — 시트 배율", () => {
    const TARGET_ID = "enemy_1";

    function seed(sheet: BattleAnimationSheet): void {
      const project = createBlankProject();
      project.database.battleAnimations = [
        normalizeBattleAnimationRecord({
          id: "anim_test",
          name: "테스트",
          resourceId: "scarloxy-battle-anim-scratch",
          sheet,
          frames: [{ cells: [{ pattern: 0, x: 4, y: -8, zoom: 100, opacity: 255, visible: true }] }],
        }),
      ];
      store.replace(project);
    }

    function mount(): HTMLElement {
      const scene = document.createElement("section");
      const target = document.createElement("div");
      target.dataset.testid = TARGET_ID;
      scene.append(target);
      document.body.append(scene);
      const playback = mountBattleAnimationPlayback(
        {
          lastAnimation: {
            animationId: "anim_test",
            targetId: TARGET_ID,
            name: "테스트",
            soundResourceIds: [],
            flashTargets: [],
            screenShake: false,
            frameCount: 1,
          },
        } as never,
        scene
      );
      if (!playback) throw new Error("재생 엘리먼트가 없다");
      return playback.element;
    }

    beforeEach(() => {
      document.body.innerHTML = "";
    });
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("레거시 96px 시트는 지금처럼 192 논리 px · pixelated 로 그린다", () => {
      seed(LEGACY_SHEET);
      const cell = mount().querySelector<HTMLCanvasElement>(".battle-animation-cell");
      expect(cell?.width).toBe(96);
      expect(cell?.style.width).toBe("192px");
      expect(cell?.style.height).toBe("192px");
      expect(cell?.dataset.rendering).toBe("pixelated");
    });

    it("384px·0.5 시트도 같은 192 논리 px 를 차지하고 smooth 로 그린다", () => {
      seed(HIRES_SHEET);
      const cell = mount().querySelector<HTMLCanvasElement>(".battle-animation-cell");
      expect(cell?.width).toBe(384);
      expect(cell?.style.width).toBe("192px");
      expect(cell?.style.height).toBe("192px");
      expect(cell?.dataset.rendering).toBe("smooth");
    });

    it("셀 오프셋(x/y)은 시트 해상도와 무관하게 RM px 로 환산된다", () => {
      seed(HIRES_SHEET);
      const cell = mount().querySelector<HTMLCanvasElement>(".battle-animation-cell");
      // x:4 → 8 논리 px, y:-8 → -16 논리 px — 레거시 시트와 같은 값이어야 한다.
      expect(cell?.style.left).toBe(`calc(50% + ${4 * BATTLE_ASSET_PIXEL_SCALE}px)`);
      expect(cell?.style.top).toBe(`calc(50% + ${-8 * BATTLE_ASSET_PIXEL_SCALE}px)`);
    });
  });
});

// 타이밍 효과(플래시·흔들림)는 시작 프레임 한 칸이 아니라 durationFrames 창 동안 산다.
// 예전 판은 시작 프레임과 같은 프레임에만 클래스를 걸어 4~7 프레임짜리 플래시가 한 프레임만 보였다.
describe("battleAnimationTimingEffects", () => {
  isolateTimers();
  const white = { red: 255, green: 255, blue: 255, gray: 0 };
  function flashAt(frameIndex: number, durationFrames: number): BattleAnimationTiming {
    return { frameIndex, flash: { target: "target", color: white, durationFrames } };
  }
  describe("activeTimingEffects — durationFrames 창", () => {
    it("플래시는 시작 프레임부터 durationFrames 만큼 살고 그 뒤 꺼진다", () => {
      const timings = [flashAt(2, 3)];
      expect(activeTimingEffects(timings, 1).flash).toBeUndefined();
      expect(activeTimingEffects(timings, 2).flash).toBeDefined();
      expect(activeTimingEffects(timings, 4).flash).toBeDefined();
      expect(activeTimingEffects(timings, 5).flash).toBeUndefined();
    });

    it("durationFrames 가 0·음수·NaN 이면 시작 프레임 한 칸만 산다", () => {
      for (const bad of [0, -3, Number.NaN]) {
        const timings = [flashAt(1, bad)];
        expect(activeTimingEffects(timings, 1).flash).toBeDefined();
        expect(activeTimingEffects(timings, 2).flash).toBeUndefined();
      }
    });

    it("창이 겹치면 나중에 시작한 플래시가 이긴다", () => {
      const red = { red: 255, green: 0, blue: 0, gray: 0 };
      const timings: BattleAnimationTiming[] = [
        flashAt(0, 6),
        { frameIndex: 3, flash: { target: "screen", color: red, durationFrames: 2 } },
      ];
      expect(activeTimingEffects(timings, 2).flash?.target).toBe("target");
      expect(activeTimingEffects(timings, 3).flash?.target).toBe("screen");
      // 나중 것이 끝나도 먼저 것의 창이 남아 있으면 먼저 것으로 돌아간다.
      expect(activeTimingEffects(timings, 5).flash?.target).toBe("target");
    });

    it("흔들림도 같은 창을 쓰고, 플래시와 독립이다", () => {
      const timings: BattleAnimationTiming[] = [
        { frameIndex: 1, screenShake: { power: 3, speed: 4, durationFrames: 2 } },
        flashAt(4, 1),
      ];
      expect(activeTimingEffects(timings, 2).screenShake).toBeDefined();
      expect(activeTimingEffects(timings, 2).flash).toBeUndefined();
      expect(activeTimingEffects(timings, 3).screenShake).toBeUndefined();
      expect(activeTimingEffects(timings, 4).flash).toBeDefined();
    });

    it("타이밍이 없으면 빈 효과", () => {
      expect(activeTimingEffects(undefined, 0)).toEqual({ flash: undefined, screenShake: undefined });
    });
  });
  describe("대상 플래시 SVG 필터", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
      store.replace(deserialize(JSON.stringify(battleFixture)));
    });

    it("씬 루트에 SourceAlpha 로 오려낸 색을 원본 위에 얹는 필터 정의가 한 번 심긴다", () => {
      const host = document.createElement("div");
      document.body.append(host);
      const runtime = createBattleRuntime({
        project: deserialize(JSON.stringify(battleFixture)),
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        rng: () => 0.5,
      });
      const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
      const filters = controller.root.querySelectorAll(`filter#${BATTLE_FLASH_FILTER_ID}`);
      expect(filters.length).toBe(1);
      const filter = filters[0]!;
      const flood = filter.querySelector("feFlood");
      expect(flood?.getAttribute("style")).toContain("--battle-flash-color");
      const composites = Array.from(filter.querySelectorAll("feComposite")).map((node) => [node.getAttribute("in2"), node.getAttribute("operator")]);
      expect(composites).toEqual([
        ["SourceAlpha", "in"],
        ["SourceGraphic", "over"],
      ]);
      controller.destroy();
    });
  });
});
