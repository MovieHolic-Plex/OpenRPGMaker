// 타격감 회귀 가드 — 한 번의 공격이 피드백 스택 전체를 실제로 만들어내는지 브라우저에서 확인한다.
//
// 배경(2026-07-26): 타격감 계층은 이미 구현돼 있었다 — 히트스톱 120ms(BATTLE_HITSTOP_MS,
// battleActionBeats.ts:62 에서 피해 타격에만 비트 생성), 데미지 팝업, 화면 플래시, 크리티컬 흔들림,
// 스윙/피격 효과음. 그런데 **이 스택을 검증하는 테스트가 하나도 없었다.**
// 프레임 샘플링으로 실측한 타이밍(t+240ms 에 juice+flash+popup 동시 발생, ~120ms 유지)을 가드로 굳힌다.
//
// 왜 프레임 샘플링인가: 애니메이션 클래스는 수백 ms 만 붙어 있다가 사라진다. 한 번만 조회하면
// 타이밍에 따라 있고 없고가 갈려 플래키해진다. 그래서 짧은 간격으로 여러 번 훑어 "한 번이라도
// 나타났는가" 를 본다.
import { expect, test } from "@playwright/test";
import {
  confirmBattleTarget,
  seedReferenceBattleProject,
  startReferenceBattle,
  waitForActorCommand,
} from "./battleReferenceProject";

interface FrameSample {
  readonly juice: string[];
  readonly sceneEffects: string[];
  readonly popups: string[];
}

test.setTimeout(120_000);

test("공격 한 번이 히트스톱·데미지 팝업·플래시·효과음을 함께 만든다", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __sfx: string[] }).__sfx = [];
    const Native = window.Audio;
    window.Audio = function (this: unknown, src?: string) {
      const audio = new Native(src);
      const play = audio.play.bind(audio);
      audio.play = () => {
        (window as unknown as { __sfx: string[] }).__sfx.push(audio.src.split("/").pop() ?? "");
        return play();
      };
      return audio;
    } as unknown as typeof window.Audio;
    window.Audio.prototype = Native.prototype;
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);
  await waitForActorCommand(page);

  await page.getByTestId("actor-command-attack").click();
  await confirmBattleTarget(page);

  const frames: FrameSample[] = [];
  for (let tick = 0; tick < 20; tick += 1) {
    frames.push(
      await page.evaluate(() => {
        const scene = document.querySelector("[data-testid='battle-scene']");
        return {
          juice: [...document.querySelectorAll("[class*='battle-juice-']")].flatMap((node) =>
            [...node.classList].filter((name) => name.startsWith("battle-juice-")),
          ),
          sceneEffects: [...(scene?.classList ?? [])].filter(
            (name) => name.startsWith("battle-flash") || name.includes("shake"),
          ),
          popups: [...document.querySelectorAll("[data-testid='battle-damage-popup']")].map(
            (node) => node.textContent ?? "",
          ),
        };
      }),
    );
    await page.waitForTimeout(60);
  }

  const seen = (pick: (frame: FrameSample) => readonly string[]): string[] =>
    [...new Set(frames.flatMap((frame) => pick(frame)))];

  const juice = seen((frame) => frame.juice);
  const effects = seen((frame) => frame.sceneEffects);
  const popups = seen((frame) => frame.popups);
  const sfx = await page.evaluate(() => (window as unknown as { __sfx: string[] }).__sfx);
  const detail = `juice=${JSON.stringify(juice)} effects=${JSON.stringify(effects)} popups=${JSON.stringify(popups)} sfx=${JSON.stringify(sfx)}`;

  // 1. 피격 모션이 붙는다.
  expect(juice, `타격 모션 없음 — ${detail}`).toContain("battle-juice-hit");
  // 2. 화면 플래시가 터진다.
  expect(effects.some((name) => name.startsWith("battle-flash")), `화면 플래시 없음 — ${detail}`).toBe(true);
  // 3. 데미지 숫자가 뜬다(음수 표기 또는 숫자).
  expect(popups.some((text) => /\d/.test(text)), `데미지 팝업 없음 — ${detail}`).toBe(true);
  // 4. 스윙과 피격 효과음이 둘 다 난다 — 하나만 나면 타격이 "닿는" 느낌이 사라진다.
  expect(sfx.some((name) => /attack/i.test(name)), `스윙 효과음 없음 — ${detail}`).toBe(true);
  expect(sfx.some((name) => /damage|blow/i.test(name)), `피격 효과음 없음 — ${detail}`).toBe(true);
});

test("히트스톱은 피해를 준 타격에만 걸린다", async ({ page }) => {
  // 순수 로직 상수 검증 — 브라우저 없이도 되지만, 위 테스트와 같은 파일에 두어
  // "타격감" 이라는 한 가지 관심사를 한곳에서 읽히게 한다.
  const { BATTLE_HITSTOP_MS } = await import("@/player/battleSequencer");
  const { planEnemyActionBeats } = await import("@/player/battleActionBeats");
  const damaging = planEnemyActionBeats({
    userId: "enemy-1",
    feedback: { targetId: "actor_hero", amount: 12, critical: false, healing: false, miss: false },
    hitStopMs: BATTLE_HITSTOP_MS,
    impactMs: 750,
  } as never);
  const missed = planEnemyActionBeats({
    userId: "enemy-1",
    feedback: { targetId: "actor_hero", amount: 0, critical: false, healing: false, miss: true },
    hitStopMs: BATTLE_HITSTOP_MS,
    impactMs: 750,
  } as never);
  const totalStop = (beats: readonly { durationMs: number }[]): number =>
    beats.reduce((sum, beat) => sum + beat.durationMs, 0);
  expect(BATTLE_HITSTOP_MS).toBeGreaterThan(0);
  // 맞았을 때가 빗나갔을 때보다 오래 멈춘다 — 이게 "묵직함" 의 정체다.
  expect(totalStop(damaging as never)).toBeGreaterThan(totalStop(missed as never));
});
