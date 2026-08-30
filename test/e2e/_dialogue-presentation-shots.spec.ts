/**
 * 대화창 연출 캡처 (진단 전용 — `_` 접두사라 기본 스위트에서 제외된다).
 *
 * 연출은 140~260ms 만 살아 있고 끝나면 `animation` 선언 자체가 사라진다. 그래서 그냥
 * 찍으면 **정착 프레임만 나온다** — "연출을 넣었다"는 증거로는 쓸 수 없다. 여기서는
 * rAF 감시자가 관심 있는 애니메이션이 **시작되는 프레임**에 그것을 `pause()` 하고
 * `currentTime` 을 원하는 비율로 맞춘 뒤 찍는다(`test/runtime/battle-flash-map.spec.ts`
 * 가 스냅샷 전에 `getAnimations().pause()` 를 쓰는 것과 같은 계열).
 *
 * 판정은 이 파일이 하지 않는다 — 계산된 스타일 단정은
 * `test/e2e/dialogue-presentation-motion.spec.ts`, 스크림의 크롭 정합은
 * `npm run qa:runtime -- --scenario dialogue` 가 각각 갖는다. 여기는 보고서용 그림만 만든다.
 * (대화창은 순수 DOM 이라 에디터 테스트플레이와 익스포트 플레이어에서 같은 픽셀이 나온다.
 * 다른 것은 무대 크롭 기하뿐이고 그건 위 런타임 QA 가 실측한다.)
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const DIR = "output/evidence/dialogue-presentation";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block" });

const NEUTRAL_BODY = "마을에 온 걸 환영해. 여기가 우리 광장이야.";
const SAD_BODY = "…그날 이후로, 아무도 종을 울리지 않았어.";
const ANGRY_BODY = "그 이름을 여기서 다시 꺼내지 마!";
const SURPRISED_BODY = "뭐라고?! 종이 다시 울렸다고?!";

declare global {
  interface Window {
    /** 이 이름의 애니메이션이 시작되는 프레임에 멈추고 이 비율로 감는다. */
    __dialogueFreeze?: {
      readonly name: string;
      readonly fraction: number;
      /** 이 phase 로 되돌려 붙인다. 진입 연출을 스크린샷 동안 살려 두는 유일한 방법. */
      readonly pinPhase?: string;
    } | null;
    __dialogueFrozen?: string[];
  }
}

/** 관심 있는 애니메이션이 시작되는 프레임에 붙잡는 감시자. 페이지마다 1회 심는다. */
async function installFreezeWatcher(
  page: Page,
  initial: { readonly name: string; readonly fraction: number } | null = null,
): Promise<void> {
  // 첫 얼음은 **init script 안에서** 걸어야 한다. page.evaluate 로 걸면 그 시점에는
  // 아직 about:blank 이고, 뒤따르는 내비게이션이 window 를 새로 만들어 지워 버린다.
  await page.addInitScript((armed) => {
    window.__dialogueFreeze = (armed ?? null) as typeof window.__dialogueFreeze;
    window.__dialogueFrozen = [];
    const tick = (): void => {
      const spec = window.__dialogueFreeze;
      if (spec) {
        // phase 를 고정한다. 얼음은 CSS 애니메이션만 멈추고 dialogue.ts 의 phase 타이머는
        // 그대로 흐르므로, 스크린샷(수백 ms) 도중 enter → shown 이 되어 규칙이 안 맞게 되고
        // 멈춰 둔 애니메이션이 폐기된다 — 사진에는 정착 프레임이 찍힌다. 되돌려 붙이면
        // 새 애니메이션이 생기고 아래 루프가 같은 비율로 다시 멈춰 그대로 머문다.
        const box = document.querySelector<HTMLElement>(".dialogue-box");
        if (spec.pinPhase && box && box.dataset.dialoguePhase !== spec.pinPhase) {
          box.dataset.dialoguePhase = spec.pinPhase;
        }
        for (const animation of document.getAnimations()) {
          const name = (animation as CSSAnimation).animationName;
          if (name !== spec.name || animation.playState === "paused") continue;
          const timing = animation.effect?.getComputedTiming();
          const duration = typeof timing?.duration === "number" ? timing.duration : 0;
          animation.pause();
          animation.currentTime = duration * spec.fraction;
          window.__dialogueFrozen?.push(name);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, initial);
}

async function freeze(page: Page, name: string, fraction: number, pinPhase?: string): Promise<void> {
  await page.evaluate(
    ([animationName, at, pin]) => {
      window.__dialogueFrozen = [];
      window.__dialogueFreeze = {
        name: String(animationName),
        fraction: Number(at),
        pinPhase: pin === undefined ? undefined : String(pin),
      };
    },
    [name, fraction, pinPhase] as const,
  );
}

/** 얼음을 풀고 멈춰 있던 애니메이션을 다시 돌린다. */
async function thaw(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__dialogueFreeze = null;
    // 고정을 풀 때 phase 도 제자리로 돌려놓는다. enter 로 붙잡아 둔 채 놓아 주면
    // 진입 연출이 무한히 재생되어 뒤 프레임이 전부 흔들린다.
    const box = document.querySelector<HTMLElement>(".dialogue-box");
    if (box?.dataset.dialoguePhase === "enter") box.dataset.dialoguePhase = "shown";
    for (const animation of document.getAnimations()) animation.play();
  });
}

async function expectFrozen(page: Page, name: string): Promise<void> {
  await expect
    .poll(() => page.evaluate((n) => (window.__dialogueFrozen ?? []).includes(String(n)), name), {
      timeout: 20_000,
      message: `${name} 이 시작되는 프레임을 못 잡았다`,
    })
    .toBe(true);
}

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

/** 상자만 잘라 찍는다. 글자 한 칸씩 밝아지는 선두는 전체 화면 축소에서 안 보인다. */
async function boxShot(page: Page, name: string): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await page.getByTestId("dialogue-box").screenshot({ path: `${DIR}/${name}.png` });
}

/**
 * 수치 증거. 그림만으로는 "3px 흔들렸다"를 판정할 수 없다 —
 * 무대가 `--play-scale` 로 확대되므로 화면 픽셀은 배율만큼 커진다.
 */
async function readFrame(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const box = document.querySelector<HTMLElement>(".dialogue-box");
    const scrim = document.querySelector<HTMLElement>(".dialogue-scrim");
    const rect = box?.getBoundingClientRect();
    const style = box ? getComputedStyle(box) : undefined;
    return {
      animationName: style?.animationName ?? "",
      animationDuration: style?.animationDuration ?? "",
      transform: style?.transform ?? "",
      left: rect ? Number(rect.left.toFixed(2)) : null,
      top: rect ? Number(rect.top.toFixed(2)) : null,
      height: rect ? Number(rect.height.toFixed(2)) : null,
      emotion: box?.dataset.dialogueEmotion ?? "",
      phase: box?.dataset.dialoguePhase ?? "",
      charCount: box?.querySelectorAll(".body .dialogue-char").length ?? 0,
      scrimDim: scrim ? getComputedStyle(scrim, "::before").opacity : "",
      scrimFlash: scrim ? getComputedStyle(scrim, "::after").opacity : "",
      playScale: getComputedStyle(document.querySelector(".play-stage") ?? document.body)
        .getPropertyValue("--play-scale")
        .trim(),
    };
  });
}

test("대화창 연출 프레임을 캡처한다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  // (A) 창 등장 — 오버슈트 정점 부근. 트리거가 `auto` 라 맵이 뜨는 순간 대사가 시작되므로
  //     얼음은 **부팅 전에** 걸어 둔다. 부팅 후에 걸면 이미 끝나 있다.
  await installFreezeWatcher(page, { name: "dialogue-box-enter", fraction: 0.58, pinPhase: "enter" });
  await seedProjectFromSupabaseCanonical(page, presentationProject());

  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 60_000 });
  await startNewGameFromTitle(page, { timeoutMs: 90_000 });

  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 30_000 });
  await expectFrozen(page, "dialogue-box-enter");
  // 수치를 **먼저** 읽는다. 스크린샷 한 장이 수백 ms 를 먹는 동안 phase 타이머가
  // enter → shown 으로 넘어가고(얼음은 CSS 만 멈춘다) 규칙이 안 맞게 되어
  // animationName 이 none 으로 읽힌다 — 그림은 멀쩡한데 표만 거짓말을 한다.
  const frames: Record<string, unknown> = { enterFrozen: await readFrame(page) };
  await shot(page, "01-enter-overshoot-neutral");

  // 같은 대사의 정착 프레임 + 스크림. 얼음을 풀고 충분히 기다린다.
  await thaw(page);
  await page.waitForTimeout(900);
  await shot(page, "02-settled-scrim-neutral");
  frames.settled = await readFrame(page);

  // (B) 슬픔 — 타이핑이 1.35배 느리다. 선두 글자들이 밝아지는 중간 프레임.
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue-box")).toContainText("그날 이후로", { timeout: 30_000 });
  await page.waitForTimeout(260);
  await shot(page, "03-typing-sad");
  await boxShot(page, "03b-typing-sad-crop");
  frames.typingSad = await readFrame(page);

  // (C) 분노 — 흔들림. 진입이 끝나고 phase="shown" 이 되는 순간 시작하므로
  //     감시자를 미리 걸어 두고 대사를 넘긴다. 0.22 는 좌측 최대 변위 프레임이다
  //     (keyframes: 22% 에서 -3px, 48% 에서 +3px — 중간을 잡으면 제자리로 보인다).
  await freeze(page, "dialogue-box-shake", 0.22);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue-box")).toContainText("다시 꺼내지 마", { timeout: 30_000 });
  await expectFrozen(page, "dialogue-box-shake");
  frames.shakeFrozen = await readFrame(page);
  await shot(page, "04-shake-angry");

  // (D) 놀람 — 스크림 플래시. ::after 에 걸려 있어 요소 자신에는 안 잡히지만
  //     getAnimations() 는 의사요소 애니메이션도 돌려준다.
  await freeze(page, "dialogue-scrim-flash", 0.18);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue-box")).toContainText("종이 다시 울렸다고", { timeout: 30_000 });
  await expectFrozen(page, "dialogue-scrim-flash");
  frames.flashFrozen = await readFrame(page);
  await shot(page, "05-flash-surprised");

  // 창이 없는 같은 화면. 스크림이 맵을 얼마나 가라앉히는지는 이 그림과 02 를 나란히
  // 놓고서야 보인다 — 디밍만 단독으로 보면 원래 그런 밝기인지 알 수 없다.
  await thaw(page);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("dialogue-box")).toBeHidden({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await shot(page, "06-no-dialogue");

  await writeFile(`${DIR}/frames.json`, `${JSON.stringify(frames, null, 2)}\n`, "utf8");
});

function presentationProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project start map is missing");
  // 대사 사이에 wait 를 끼운다. cleanup() 이 예약한 퇴장이 만료되어 창이 닫히고,
  // 다음 대사는 빈 오버레이를 만나 **새 세션으로** 진입 연출을 다시 재생한다.
  // 그래서 감정마다 진입 프레임을 따로 잡을 수 있다.
  map.events.push(
    autoEvent("ev_shots", 2, 2, [
      { kind: "text", speaker: "마을 사람", body: NEUTRAL_BODY },
      { kind: "wait", ms: 400 },
      { kind: "text", speaker: "마을 사람", body: SAD_BODY, emotion: "sad" },
      { kind: "wait", ms: 400 },
      { kind: "text", speaker: "마을 사람", body: ANGRY_BODY, emotion: "angry" },
      { kind: "wait", ms: 400 },
      { kind: "text", speaker: "마을 사람", body: SURPRISED_BODY, emotion: "surprised" },
      { kind: "wait", ms: 120_000 },
    ]),
  );
  return project;
}

function autoEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "auto" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "auto" }, commands: [], pages: [page] };
}
