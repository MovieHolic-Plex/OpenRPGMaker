/** @vitest-environment happy-dom */
/**
 * 연출 합성(followUps) 계약 — 2026-09-03.
 * 레코드가 후속 애니메이션을 선언하면 본체의 startFrame 에서 같은 앵커에 겹쳐 시작하고, 전체 길이는
 * 둘 중 늦은 끝이며, 시퀀서는 그만큼 recover 비트를 늘린다. 본체의 프레임 전환이 후속 프레임을 건드리지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleAnimationSnapshot } from "@/battle/animationSnapshot";
import { battleAnimationChainDurationMs, battleAnimationDurationMs } from "@/battle/animationTiming";
import { GENERATED_EFFECT_SHEETS, generatedEffectFollowUps } from "@/assets/generatedEffectSheets";
import { recoverMsForAnimation } from "@/player/battleActionBeats";
import { mountBattleAnimationPlayback } from "@/player/battleAnimationDom";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { createBlankProject } from "@/project/defaults";
import { defaultBattleAnimationRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { store } from "@/project/store";
import type { BattleAnimationRecord } from "@/project/types";

function record(id: string, frameCount: number, extra: Partial<BattleAnimationRecord> = {}): BattleAnimationRecord {
  return normalizeBattleAnimationRecord({
    id,
    name: id,
    resourceId: "easyrpg-battle-blow",
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

describe("착탄 프레임부터 재생 (battleAnimationStartAtImpact)", () => {
  // 포켓몬 안무는 이펙트를 착탄 순간에 올린다. 프레임 0부터 돌리면 첫 효과음 프레임까지 늦어져
  // 소리가 타격보다 160~420ms 뒤에 났다(2026-10-02 실측). 장면 표식이 있으면 착탄 프레임부터 돈다.
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

  function mount(startAtImpact: boolean): HTMLElement {
    const scene = document.createElement("section");
    if (startAtImpact) scene.dataset.battleAnimationStartAtImpact = "true";
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

  it("표식이 있으면 첫 효과음 프레임에서 시작하고 그 프레임의 소리가 마운트 즉시 걸린다", () => {
    const element = mount(true);
    expect(element.dataset.startFrame).toBe("3");
    expect(visibleMain(element)).toEqual(["3"]);
    expect(element.dataset.activeSoundResourceId).toBe("se-test");
    vi.advanceTimersByTime(120);
    expect(visibleMain(element)).toEqual(["4"]);
  });

  it("후속은 건너뛴 프레임만큼 당겨진다", () => {
    const element = mount(true);
    // 후속 startFrame 4 − 건너뜀 3 = 1프레임(120ms) 뒤.
    vi.advanceTimersByTime(119);
    expect(element.querySelector(".battle-animation-followup")).toBeNull();
    vi.advanceTimersByTime(1);
    expect(element.querySelector<HTMLElement>(".battle-animation-followup")?.dataset.animationId).toBe("tail");
  });

  it("표식이 없으면 기존대로 프레임 0부터 돈다", () => {
    const element = mount(false);
    expect(element.dataset.startFrame).toBe("0");
    expect(visibleMain(element)).toEqual(["0"]);
  });
});
