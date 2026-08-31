// 전투 조준 표시와 스킬 이펙트 좌표 — **출하 경로**(player.html) 실측 가드.
//
// 감독 지적 두 건을 각각 잠근다.
//
//  1. "전투에서 사용되는 애니메이션(스킬 등)이 좌표가 이상함."
//     원인: `battleAnimationDom.positionAnimationOnTarget` 이 대상 노드의
//     `--battle-node-x/y` 문자열을 복사했다. 그 값은 배틀러의 **발**(`.battle-enemy` 는
//     `translate(-50%, -100%)`)을 가리키는 백분율이고, `.battle-animation` 은 240×240 박스에
//     `translate(-50%, -55%)` 를 걸어 시트 중심을 발에서 12px 위에 뒀다. 스프라이트가 144px 급
//     이므로 이펙트는 몸통이 아니라 발목 높이에 찍혔다. 저작 스키마의
//     `BattleAnimationPosition`(head/center/feet/screen)은 배치에 쓰이지도 않았다.
//     지금: 대상 스프라이트를 실측해 저작된 position 이 가리키는 점에 놓는다
//     (`src/player/battleAnimationAnchor.ts`, 산식 단위 테스트는
//     `test/battleAnimationAnchor.test.ts`).
//
//  2. "전투에서 '흰색 박스'로 타겟을 표시하는 게 싫다."
//     원인: `06-damage-flash-targeting.css` 의
//     `.battle-target-selected { outline: 4px solid var(--oprn-battle-window-light) }`.
//     지금: 코너 리티클만. 스프라이트 펄스(`battle-target-pulse`)는 몬스터가
//     반투명으로 깜빡여 삭제했다.
//
// 왜 여기(test/runtime)인가: 편집기 셸을 태우는 `test/e2e/` 전투 스펙은 main 기준선에서도
// `startNewGameFromTitle` 이 런타임 부팅에 실패해 돌지 않는다(실측 2026-08-30:
// `oprn-battle-system-targeting.spec.ts` 도 손대지 않은 상태로 같은 지점에서 실패).
// AGENTS.md 의 편집기/런타임 QA 분리 규칙대로 게임 화면 증거는 이 하네스로 잡는다.
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const PROJECT_FIXTURE = fileURLToPath(new URL("../fixtures/projects/battle-v3.json", import.meta.url));
const SHOT_DIR = fileURLToPath(new URL("../../.omo/evidence/battle-anim-target/", import.meta.url));

/*
 * 임계값은 관측치가 아니라 **계약에서 유도**한다. 스프라이트 높이 h 로 정규화하는 이유는
 * 무대 배율(`--battle-stage-scale`)이 창 크기에 따라 변해 절대 px 임계값이 창 크기에 묶인
 * 숫자가 되기 때문이다.
 *
 *  - `position: "center"` 의 계약은 "이펙트 중심 == 스프라이트 세로 중심" 이므로 이상적인
 *    편차는 0 이다. 남는 잔차는 백분율을 소수 셋째 자리에서 끊는 양자화(레이어 높이의
 *    0.001% = 400px 무대에서 0.004px)와 패딩 박스 환산의 반올림뿐 — 전부 서브픽셀이다.
 *    0.05h(192px 스프라이트에서 9.6px)는 그 잔차보다 두 자리 크게 잡은 여유다.
 *  - 같은 계약에서 세로 중심과 발(bottom)의 거리는 **정의상 정확히 h/2 = 0.5h** 다.
 *    고침 전 앵커가 발이었으므로, 회귀하면 이 값이 0 으로 떨어진다. 하한은 0.5h 에서
 *    위 허용 오차만큼 뺀 값이다.
 */
const ANCHOR_TOLERANCE_RATIO = 0.05;
const CENTER_TO_FEET_RATIO = 0.5;
const MIN_FEET_SEPARATION_RATIO = CENTER_TO_FEET_RATIO - ANCHOR_TOLERANCE_RATIO;

/** 픽스처의 anim_magic — scope: "singleTarget", position: "center" 로 저작돼 있다. */
const ANCHOR_ANIMATION_ID = "anim_magic";

/** 촬영 창 확보용 프레임 수(기본 120ms/프레임 → 약 1.4초). 앵커 계산과는 무관하다. */
const SHOT_FRAME_COUNT = 12;

type TargetIndicator = {
  readonly id: string | null;
  readonly skin: string | null;
  readonly outlineWidth: string;
  readonly outlineStyle: string;
  readonly bracketsWidth: number;
  readonly bracketsHeight: number;
  readonly spriteAnimationName: string;
  readonly spritePlayState: string;
};

type AnchorProbe = {
  readonly animationId: string;
  readonly authoredPosition: string;
  readonly authoredScope: string;
  readonly anchorMode: string;
  /** 폴백이면 왜 못 쟀는지(noTarget / spriteRect WxH / layerRect WxH). */
  readonly anchorWhy: string;
  /** 백분율이 풀린 컨테이닝 블록 — 레이어가 접히면 조상으로 올라간다. */
  readonly anchorCb: string;
  /** 애니메이션 박스 중심 − 저작된 position 이 가리키는 점 (스프라이트 높이 대비 비율). */
  readonly offsetRatioX: number;
  readonly offsetRatioY: number;
  /** 진단: 옛 앵커(스프라이트 발)와의 세로 편차 비율. 고침 전에는 0 이었다. */
  readonly feetOffsetRatioY: number;
  readonly spriteHeight: number;
};

type ProbeWindow = Window & {
  __anchorProbe?: AnchorProbe;
  __anchorProbeFrames?: number;
  __oprnDebug?: {
    setSeed(seed: number): void;
    readState(): { currentMapId: string; x: number; y: number };
  };
  __oprnInput?: { face(direction: string): void; action(): void };
};

// 실패는 빨리 실패해야 한다 — 300초를 끌면 retain-on-failure 트레이스가 300MB 로 불어난다(실측).
test.setTimeout(150_000);

test("selected battler is marked by a reticle and a sprite pulse, never by a white box", async ({ page }) => {
  await withRealBattle(page, async () => {
    await enterTargetSelect(page);
    const selected = page.locator(".battle-enemy.battle-target-selected");
    await expect(selected).toBeVisible();
    await expect(page.locator("[data-testid='battle-target-brackets']")).toBeVisible();

    const state = await page.evaluate((): TargetIndicator => {
      const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
      const node = document.querySelector<HTMLElement>(".battle-enemy.battle-target-selected");
      if (!node) throw new Error("선택된 적 노드가 없다 — 대상 선택 단계에 도달하지 못했다");
      const sprite = node.querySelector<HTMLElement>(".battle-enemy-image");
      if (!sprite) throw new Error(".battle-enemy-image 가 없다 — 스프라이트 없이 조준을 잴 수 없다");
      const brackets = node.querySelector<HTMLElement>("[data-testid='battle-target-brackets']");
      const bracketRect = brackets?.getBoundingClientRect();
      const nodeStyle = getComputedStyle(node);
      const spriteStyle = getComputedStyle(sprite);
      return {
        id: node.dataset.testid ?? null,
        skin: scene?.dataset.battleSkin ?? null,
        outlineWidth: nodeStyle.outlineWidth,
        outlineStyle: nodeStyle.outlineStyle,
        bracketsWidth: Math.round(bracketRect?.width ?? 0),
        bracketsHeight: Math.round(bracketRect?.height ?? 0),
        spriteAnimationName: spriteStyle.animationName,
        spritePlayState: spriteStyle.animationPlayState,
      };
    });
    console.log(`target indicator: ${JSON.stringify(state)}`);

    // 1) 흰 사각형이 없다. `outline-style: none` 이면 브라우저가 width 를 0px 로 계산한다.
    expect(
      `${state.outlineWidth} ${state.outlineStyle}`,
      "대상 표시가 다시 노드 전체를 감싸는 사각형(outline)으로 돌아갔다",
    ).toBe("0px none");

    // 2) 조준 표시를 잃지 않았다 — 코너 리티클이 실제 상자를 갖는다.
    expect(state.bracketsWidth, "코너 리티클 상자가 0 이다 — 조준 표시를 통째로 잃었다").toBeGreaterThan(0);
    expect(state.bracketsHeight).toBeGreaterThan(0);

    // 3) 조준 펄스는 쓰지 않는다. filter/밝기 토글이 몬스터를 반투명으로 깜빡였다.
    expect(state.spriteAnimationName).not.toContain("battle-target-pulse");

    await page.locator(".battle-scene").screenshot({ path: `${SHOT_DIR}/target-select-reticle.png` });
  });
});

test("skill animation lands on the authored anchor of the target sprite", async ({ page }) => {
  await withRealBattle(page, async () => {
    // 평타로 띄운다. 액터에 무기가 없고 `unarmedAnimationId` 가 있으면
    // `runtime.normalAttackAnimationId` 가 그것을 **최우선**으로 고르므로(runtime.ts:897)
    // 어떤 애니메이션이 뜰지 결정적이다. 스킬 서브메뉴를 거치는 경로는 커서 이동 단계가
    // 늘고 ATB(gauge) 흐름에서 커맨드 창이 다시 그려지면 흔들린다 — 같은 앵커 코드를
    // 검증하는데 실패 지점만 늘릴 이유가 없다.
    await enterTargetSelect(page);
    // 대상 확정 **전에** rAF 계측기를 심는다 — 이펙트는 두 프레임이라 확정 후 폴링으로는 놓친다.
    await installAnchorProbe(page);
    await confirmTarget(page);

    const probe = await page.evaluate(async (): Promise<AnchorProbe> => {
      const scope = window as ProbeWindow;
      // rAF 루프가 첫 이펙트 프레임을 잡을 때까지 프레임 단위로 기다린다(고정 대기 없음).
      for (let frame = 0; frame < 900 && !scope.__anchorProbe; frame += 1) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
      if (!scope.__anchorProbe) {
        const animation = document.querySelector<HTMLElement>("[data-testid='battle-animation']");
        throw new Error(
          "battle-animation 계측을 못 했다 — 앵커 가드를 검증할 수 없다. 진단: "
            + JSON.stringify({
                frames: scope.__anchorProbeFrames ?? 0,
                mounted: Boolean(animation),
                renderedFrameCount: animation?.dataset.renderedFrameCount ?? null,
                cells: document.querySelectorAll("[data-testid='battle-animation-cell']").length,
              }),
        );
      }
      return scope.__anchorProbe;
    });
    console.log(`anchor probe: ${JSON.stringify(probe)}`);

    // 픽스처의 anim_magic 은 scope=singleTarget, position=center 로 저작돼 있다.
    expect(probe.authoredPosition).toBe("center");
    // 실측 경로가 살아 있어야 한다. "fallback" 이면 좌표가 예전 발 앵커로 돌아간 것이고,
    // 그러면 아래 오차 단정이 조용히 뒤집힌다.
    // 백분율이 풀리는 컨테이닝 블록이 접히지 않았는가. 이 축을 따로 두는 이유: rm2003 이
    // `--battle-field-border-width: 0`(단위 없음)을 선언해 `.battle-animation-layer` 의
    // `calc()` inset 이 invalid 로 버려지고 레이어가 0×0 으로 수축한 적이 있다. 그러면
    // 백분율 앵커가 전부 0 이 되어 이펙트가 무대 좌상단에 쌓인다 — 실패 메시지가 그 원인을
    // 곧바로 가리켜야 다음 사람이 다시 추적하지 않는다.
    expect(
      probe.anchorWhy,
      "앵커 컨테이닝 블록이 접혔다 — 레이어 inset 의 calc 가 invalid 인지 확인하라",
    ).toBe("(measured)");
    expect(probe.anchorMode, "앵커가 폴백(--battle-node-x/y 복사)으로 떨어졌다").toBe("center");
    expect(probe.spriteHeight).toBeGreaterThan(0);

    // 이펙트 중심이 저작된 앵커(= 스프라이트 세로 중심)에 놓인다.
    expect(Math.abs(probe.offsetRatioX)).toBeLessThan(ANCHOR_TOLERANCE_RATIO);
    expect(Math.abs(probe.offsetRatioY)).toBeLessThan(ANCHOR_TOLERANCE_RATIO);

    // 그리고 옛 앵커(발)와는 스프라이트 높이의 절반쯤 떨어져 있어야 한다 —
    // 이 값이 0 으로 돌아가면 회귀다.
    expect(Math.abs(probe.feetOffsetRatioY)).toBeGreaterThan(MIN_FEET_SEPARATION_RATIO);

    // 이펙트가 **아직 화면에 있는 동안** 찍는다 — 없어진 뒤 찍은 그림은 앵커 증거가 아니다.
    // 셀 캔버스 확인이 촬영보다 먼저 와야 한다: 촬영이 재생 시간을 잡아먹어서 찍은 뒤에 세면
    // 이미 정리된 레이어를 세게 된다(실측: 촬영 후 count 가 0 이었다).
    await expect(page.locator("[data-testid='battle-animation']")).toBeVisible();
    expect(await page.locator("[data-testid='battle-animation-cell']").count()).toBeGreaterThan(0);
    const shot = await page.evaluate(() => {
      const animation = document.querySelector<HTMLElement>("[data-testid='battle-animation']");
      const frames = [...(animation?.querySelectorAll<HTMLElement>(".battle-animation-frame") ?? [])];
      const visible = frames.filter((frame) => !frame.hidden);
      const cells = [...(visible[0]?.querySelectorAll<HTMLCanvasElement>("canvas") ?? [])];
      return {
        playbackFinished: animation?.dataset.playbackFinished ?? "(none)",
        currentFrame: animation?.dataset.currentFrame ?? "(none)",
        frames: frames.length,
        visibleFrames: visible.length,
        visibleCells: cells.length,
        renderedCells: cells.filter((cell) => cell.dataset.rendered === "true").length,
        firstCell: cells[0]
          ? {
              opacity: getComputedStyle(cells[0]).opacity,
              width: Math.round(cells[0].getBoundingClientRect().width),
              height: Math.round(cells[0].getBoundingClientRect().height),
            }
          : null,
      };
    });
    console.log(`shot probe: ${JSON.stringify(shot)}`);
    // 엘리먼트가 붙어 있다는 것만으로는 그림이 남지 않는다 — `finishPlayback` 은 프레임을
    // `hidden` 으로 걷고 셀 캔버스는 DOM 에 그대로 둔다. 그래서 "cells > 0" 은 재생이 끝난
    // 뒤에도 통과했고, 증거 PNG 에 이펙트가 없는 채로 스펙이 초록이었다(실측). 촬영 순간에
    // **보이는 프레임과 실제로 그려진 캔버스**가 있는지까지 봐야 그림이 증거가 된다.
    expect(shot.playbackFinished, "재생이 끝난 뒤 찍었다 — PNG 에 이펙트가 남지 않는다").not.toBe("true");
    expect(shot.visibleFrames, "보이는 애니메이션 프레임이 없다").toBe(1);
    expect(shot.renderedCells, "셀 캔버스가 아직 그려지지 않았다 — 빈 사각만 찍힌다").toBeGreaterThan(0);
    await page.locator(".battle-scene").screenshot({ path: `${SHOT_DIR}/skill-animation-anchor.png` });
  });
});

async function withRealBattle(page: Page, run: () => Promise<void>): Promise<void> {
  const server = await startPlayerQaServer();
  try {
    const projectJson = await withUnarmedAttackAnimation(await readFile(PROJECT_FIXTURE, "utf8"));
    await mkdir(SHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => {
      localStorage.clear();
      (window as Window & { __OPENRPG_BOOT__?: object }).__OPENRPG_BOOT__ = {
        projectUrl: "/__runtime-qa/project.json",
        saveNamespace: "runtime-qa:battle-target-anim",
        qaInstrumentation: true,
      };
    });
    await page.route("**/__runtime-qa/project.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
    );

    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 120_000 });
    await page.waitForFunction(() => Boolean((window as ProbeWindow).__oprnDebug), undefined, {
      timeout: 120_000,
    });
    await page.waitForFunction(
      () => {
        const state = (window as ProbeWindow).__oprnDebug?.readState();
        return state?.currentMapId === "map_battle" && state.x === 0 && state.y === 0;
      },
      undefined,
      { polling: "raf", timeout: 30_000 },
    );
    await page.evaluate(() => (window as ProbeWindow).__oprnDebug?.setSeed(1));
    await enterImmediateBattle(page);
    await page.waitForSelector("[data-testid='actor-command-attack']", {
      state: "visible",
      timeout: 120_000,
    });
    await run();
  } finally {
    await server.close();
  }
}

/**
 * 액터의 **맨손 평타 애니메이션**을 `anim_magic` 으로 못 박는다.
 *
 * 픽스처의 `anim_magic` 은 `scope: "singleTarget"`, `position: "center"` 로 저작돼 있어
 * 앵커 계약을 그대로 태울 수 있다. 무기를 안 낀 액터에 `unarmedAnimationId` 가 있으면
 * `runtime.normalAttackAnimationId`(runtime.ts:897) 가 그것을 최우선으로 고르므로, 어떤
 * 애니메이션이 뜨는지가 폴백 사슬(`fallbackHitAnimationId`)에 좌우되지 않는다.
 *
 * 픽스처 파일을 고치지 않고 **이 하네스가 서빙하는 본문에서만** 심는다 — 다른 시나리오가
 * 같은 픽스처를 공유하므로 파일을 건드리면 그쪽 기대치가 함께 움직인다.
 */
async function withUnarmedAttackAnimation(json: string): Promise<string> {
  const project = JSON.parse(json) as {
    database: {
      actors: { id: string; unarmedAnimationId?: string }[];
      battleAnimations: { id: string; frames?: unknown[] }[];
    };
  };
  const hero = project.database.actors.find((actor) => actor.id === "actor_hero");
  if (!hero) throw new Error("픽스처에 actor_hero 가 없다 — 평타 애니메이션을 심을 수 없다");
  hero.unarmedAnimationId = ANCHOR_ANIMATION_ID;

  // 스크린샷 증거용으로 **재생 길이만** 늘린다. 원본 anim_magic 은 2프레임(약 240ms)이라
  // 스냅샷이 도착하기 전에 이펙트가 사라져 "이펙트가 대상 위에 있다" 를 눈으로 확인할 수
  // 없었다(실측: 첫 증거 PNG 에 이펙트가 없었다). 프레임을 반복해 늘리는 것은 앵커 계산과
  // 무관하다 — 앵커는 엘리먼트 하나당 한 번 정해지고 셀은 그 안에서 상대 배치된다.
  const animation = project.database.battleAnimations.find((record) => record.id === ANCHOR_ANIMATION_ID);
  if (!animation?.frames?.length) throw new Error(`픽스처에 ${ANCHOR_ANIMATION_ID} 프레임이 없다`);
  const source = animation.frames;
  animation.frames = Array.from({ length: SHOT_FRAME_COUNT }, (_, index) => source[index % source.length]);
  return JSON.stringify(project);
}

async function enterImmediateBattle(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.evaluate(() => {
      const runtimeWindow = window as ProbeWindow;
      runtimeWindow.__oprnInput?.face("right");
      runtimeWindow.__oprnInput?.action();
    });
    try {
      await page.waitForSelector("[data-testid='battle-scene'], .battle-scene", {
        state: "visible",
        timeout: 1_500,
      });
      return;
    } catch {
      // 주입한 액션 엣지가 이벤트에 먹힐 때까지 재시도한다(관측 상태 기준, 고정 대기 없음).
    }
  }
  throw new Error("authored battle did not start within 10 action attempts");
}

/**
 * 전투는 **키보드 전용** 이다(openwiki/runtime-battle.md: director decision).
 * `.battle-command-menu` 가 포인터 이벤트를 가로채므로 버튼 `click()` 은 구조적으로 못 닿는다
 * (실측 2026-08-30: `actor-command-attack` 클릭이 490회 재시도 끝에 타임아웃).
 * 커서는 keydown 핸들러가 **동기로** `data-battle-command-cursor` 를 옮기므로
 * `press` 직후 읽으면 값이 이미 갱신돼 있다 — 고정 대기가 필요 없다.
 */
async function cursorTestid(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      document.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid ?? null,
  );
}

/** 커서를 목표 커맨드로 옮긴다. 매 입력 후 조건을 확인하므로 초과 입력이 구조적으로 불가능하다. */
async function moveCursorTo(page: Page, testid: string, maxPresses = 12): Promise<void> {
  const seen: string[] = [];
  for (let press = 0; press <= maxPresses; press += 1) {
    const at = await cursorTestid(page);
    if (at === testid) return;
    seen.push(at ?? "(none)");
    await page.keyboard.press("ArrowDown");
  }
  throw new Error(`커맨드 커서가 ${testid} 에 도달하지 못했다 — 지나온 커서: ${seen.join(" → ")}`);
}

/**
 * 전투 안 확정키는 **z** 다.
 *
 * `Enter` 는 `battleDom.isNativeButtonEnter` 가 "포커스된 네이티브 버튼이 스스로 활성화한다" 고
 * 보고 루트 핸들러가 비켜서는 경로다. 그런데 포커스는 `tabindex="0"` 인 `.battle-scene` 이
 * 들고 있어 활성화할 버튼이 없다 — 그래서 Enter 는 아무 일도 하지 않는다(실측 2026-08-30:
 * 공격 확정 후 30초 동안 `data-battle-phase` 가 `actorCommand` 에 머물렀다).
 * `z` 는 네이티브 활성화가 없으므로 공용 커서 모델을 그대로 탄다. 다른 런타임 스펙
 * (`_enemy-anchor-probe`, `_battle-feel-*`)도 모두 `z` 를 쓴다.
 */
async function confirmCommand(page: Page, testid: string): Promise<void> {
  await expect(page.locator(`[data-testid='${testid}']`)).toBeVisible({ timeout: 30_000 });
  await waitForIdleSequence(page);
  await moveCursorTo(page, testid);
  await page.keyboard.press("z");
}

/** 연출 중(`sequenceBusy`)의 확정키는 "빨리감기" 로 먹힌다 — 확정 전에 재생이 끝나길 기다린다. */
async function waitForIdleSequence(page: Page): Promise<void> {
  await expect(page.locator("[data-testid='battle-scene']")).toHaveAttribute(
    "data-battle-sequence-busy",
    "false",
    { timeout: 30_000 },
  );
}

async function waitForTargetSelect(page: Page): Promise<void> {
  await expect(page.locator("[data-testid='battle-scene']")).toHaveAttribute(
    "data-battle-phase",
    "targetSelect",
    { timeout: 30_000 },
  );
}

/** 공격 커맨드를 확정해 대상 선택 단계로 넘어간다. */
async function enterTargetSelect(page: Page): Promise<void> {
  await confirmCommand(page, "actor-command-attack");
  await waitForTargetSelect(page);
}

/** 대상 확정도 같은 확정키다. */
async function confirmTarget(page: Page): Promise<void> {
  await expect(page.locator(".battle-enemy.battle-target-selected")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("z");
}

/**
 * 첫 이펙트 프레임에서 앵커를 잰다.
 *
 * 재는 값은 전부 **비율** 이다 — `.battle-scene` 에 `transform: scale()` 이 걸려 있어 px 은
 * 창 크기에 따라 변하지만, 스프라이트 높이로 나눈 비율은 변하지 않는다.
 */
async function installAnchorProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scope = window as ProbeWindow;
    delete scope.__anchorProbe;
    scope.__anchorProbeFrames = 0;
    const tick = (): void => {
      scope.__anchorProbeFrames = (scope.__anchorProbeFrames ?? 0) + 1;
      if (!scope.__anchorProbe) {
        const animation = document.querySelector<HTMLElement>("[data-testid='battle-animation']");
        const targetId = animation?.dataset.animationTargetId;
        const target = targetId
          ? document.querySelector<HTMLElement>(`[data-testid='${targetId}']`)
            ?? document.querySelector<HTMLElement>(`[data-testid='battle-actor-${targetId}']`)
          : null;
        const sprite = target?.querySelector<HTMLElement>(
          ".battle-enemy-image, .battle-actor-image, .battle-actor-sprite",
        ) ?? target;
        if (animation && sprite) {
          const animationRect = animation.getBoundingClientRect();
          const spriteRect = sprite.getBoundingClientRect();
          if (animationRect.height > 0 && spriteRect.height > 0) {
            const animationCenterX = animationRect.left + animationRect.width / 2;
            const animationCenterY = animationRect.top + animationRect.height / 2;
            const spriteCenterX = spriteRect.left + spriteRect.width / 2;
            const spriteCenterY = spriteRect.top + spriteRect.height / 2;
            const round = (value: number): number => Math.round(value * 1000) / 1000;
            scope.__anchorProbe = {
              animationId: animation.dataset.animationId ?? "(none)",
              authoredPosition: animation.dataset.animationPosition ?? "(none)",
              authoredScope: animation.dataset.animationScope ?? "(none)",
                      anchorMode: animation.dataset.animationAnchor ?? "(none)",
              anchorWhy: animation.dataset.animationAnchorWhy ?? "(measured)",
              anchorCb: animation.dataset.animationAnchorCb ?? "(none)",
              offsetRatioX: round((animationCenterX - spriteCenterX) / spriteRect.height),
              offsetRatioY: round((animationCenterY - spriteCenterY) / spriteRect.height),
              feetOffsetRatioY: round((animationCenterY - spriteRect.bottom) / spriteRect.height),
              spriteHeight: Math.round(spriteRect.height),
            };
          }
        }
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}
