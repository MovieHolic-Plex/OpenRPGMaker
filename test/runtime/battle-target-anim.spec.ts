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
//     지금: 코너 리티클 + 스프라이트 펄스 두 겹으로 바꿨다.
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

/** 앵커 허용 오차를 **스프라이트 높이 비율**로 둔다 — 무대 배율이 창 크기에 따라 변하므로
 *  절대 px 임계값은 창 크기에 묶인 숫자가 된다. 0.18 = 스프라이트 높이의 18%.
 *  고침 전 값은 0.5(정확히 절반: 발 앵커 vs 몸통 중심)이므로 확실히 걸린다. */
const MAX_ANCHOR_OFFSET_RATIO = 0.18;

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

test.setTimeout(300_000);

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

    // 3) 대체 연출이 실제로 돌고 있다. 무늬 많은 스프라이트·배경 위에서 리티클만으로는
    //    안 보인다는 지적을 pokemon 스킨이 먼저 받았고, 그 해법을 기본 경로로 올린 것이다.
    expect(state.spriteAnimationName).toContain("battle-target-pulse");
    expect(state.spritePlayState).toBe("running");

    await page.locator(".battle-scene").screenshot({ path: `${SHOT_DIR}/target-select-reticle.png` });
  });
});

test("skill animation lands on the authored anchor of the target sprite", async ({ page }) => {
  await withRealBattle(page, async () => {
    await openSkillCommand(page);
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
    expect(probe.anchorMode, "앵커가 폴백(--battle-node-x/y 복사)으로 떨어졌다").toBe("center");
    expect(probe.spriteHeight).toBeGreaterThan(0);

    // 이펙트 중심이 저작된 앵커(= 스프라이트 세로 중심)에 놓인다.
    expect(Math.abs(probe.offsetRatioX)).toBeLessThan(MAX_ANCHOR_OFFSET_RATIO);
    expect(Math.abs(probe.offsetRatioY)).toBeLessThan(MAX_ANCHOR_OFFSET_RATIO);

    // 그리고 옛 앵커(발)와는 스프라이트 높이의 절반쯤 떨어져 있어야 한다 —
    // 이 값이 0 으로 돌아가면 회귀다.
    expect(Math.abs(probe.feetOffsetRatioY)).toBeGreaterThan(0.3);

    await page.locator(".battle-scene").screenshot({ path: `${SHOT_DIR}/skill-animation-anchor.png` });
  });
});

async function withRealBattle(page: Page, run: () => Promise<void>): Promise<void> {
  const server = await startPlayerQaServer();
  try {
    const projectJson = await readFile(PROJECT_FIXTURE, "utf8");
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

/** 공격 커맨드를 확정해 대상 선택 단계로 넘어간다. */
async function enterTargetSelect(page: Page): Promise<void> {
  await page.locator("[data-testid='actor-command-attack']").click();
  await expect(page.locator("[data-testid='battle-scene']")).toHaveAttribute(
    "data-battle-phase",
    "targetSelect",
    { timeout: 20_000 },
  );
}

/** 스킬 → skill_fire(anim_magic) 를 골라 대상 선택 단계까지 간다. */
async function openSkillCommand(page: Page): Promise<void> {
  await page.locator("[data-testid='actor-command-skill']").click();
  const skill = page.locator("[data-testid='actor-skill-skill_fire']");
  await expect(skill).toBeVisible({ timeout: 20_000 });
  await skill.click();
  await expect(page.locator("[data-testid='battle-scene']")).toHaveAttribute(
    "data-battle-phase",
    "targetSelect",
    { timeout: 20_000 },
  );
}

async function confirmTarget(page: Page): Promise<void> {
  const fieldTarget = page.locator(".battle-enemy[data-battle-targetable='true']").first();
  if (await fieldTarget.count()) {
    await fieldTarget.click();
    return;
  }
  await page.keyboard.press("Enter");
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
