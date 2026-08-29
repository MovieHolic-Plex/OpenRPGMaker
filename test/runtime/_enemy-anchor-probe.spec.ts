// 적 스프라이트가 **제자리에 못 박혀 있는지** 지키는 회귀 가드.
//
// 왜 있나: 적 HUD(이름표·상태 아이콘·HP 막대)가 `.battle-enemy` 흐름 안에 있던 시절에는
// HUD 를 펼치고 접을 때마다 노드 높이가 변했고, 그 높이를 실측해 top 을 보정하던
// `alignEnemyFeetToAuthoredY` 때문에 몬스터가 화면에서 눈에 보이게 튀었다.
// 실측(수정 전, evidence/enemy-anchor-probe/samples-before.json):
//   커맨드 y=103 → 대상 선택 y=59 → 타격 y=134. 한 턴에 75px 이 흔들렸다.
// 수정 후에는 25 표본 전부 y=92 로 같다.
//
// 무엇을 검사하나: 출하 경로(player.html)로 실전투에 들어가 120ms 간격으로 표본을 모으고
//  1) 의도된 모션(lunge/knockback) 클래스가 없는 표본끼리 이미지 rect 가 완전히 같은지
//  2) 노드 높이가 이미지 높이를 넘지 않는지(= chrome 이 흐름에 없다)
//  3) HUD 가 실제로 접힘/펼침 양쪽을 거쳤는지(안 거치면 1) 이 공허하게 통과한다)
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

const OUT = fileURLToPath(new URL("../../evidence/enemy-anchor-probe/", import.meta.url));

type ProbeWindow = Window & {
  __feelT0?: number;
  __oprnDebug?: { setSeed(seed: number): void; readState(): { currentMapId: string; x: number; y: number } };
  __oprnInput?: { face(direction: string): void; action(): void };
};

type Sample = {
  t: number;
  label: string;
  step: string;
  phase: string;
  hpRevealed: string | null;
  targetSelected: boolean;
  targetable: string | null;
  classList: string[];
  imageRect: { x: number; y: number; width: number; height: number } | null;
  enemyRect: { x: number; y: number; width: number; height: number } | null;
  computed: {
    hudDisplay: string | null;
    hudPosition: string | null;
    nameDisplay: string | null;
    namePosition: string | null;
    statusIconsDisplay: string | null;
    statusIconsPosition: string | null;
    bracketsDisplay: string | null;
    bracketsPosition: string | null;
    enemyDisplay: string | null;
    enemyFlexDirection: string | null;
    enemyAlignItems: string | null;
  };
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

async function readSample(page: Page, label: string): Promise<Sample> {
  return page.evaluate((label) => {
    const w = window as unknown as ProbeWindow;
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const enemy = document.querySelector<HTMLElement>(".battle-enemy");
    const image = enemy?.querySelector<HTMLElement>(".battle-enemy-image") ?? null;
    const hud = enemy?.querySelector<HTMLElement>(".battle-enemy-hud") ?? null;
    const name = enemy?.querySelector<HTMLElement>(".battle-enemy-name") ?? null;
    const statusIcons = enemy?.querySelector<HTMLElement>(".battle-status-icons") ?? null;
    const brackets = enemy?.querySelector<HTMLElement>(".battle-target-brackets") ?? null;
    const rectOf = (el: HTMLElement | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const cs = (el: HTMLElement | null, prop: string): string | null =>
      el ? getComputedStyle(el).getPropertyValue(prop) : null;
    return {
      t: Math.round(performance.now() - (w.__feelT0 ?? 0)),
      label,
      step: scene?.dataset.battleDirectorStep ?? "",
      phase: scene?.dataset.battlePhase ?? "",
      hpRevealed: enemy?.dataset.battleHpRevealed ?? null,
      targetSelected: enemy?.classList.contains("battle-target-selected") ?? false,
      targetable: enemy?.dataset.battleTargetable ?? null,
      classList: enemy ? [...enemy.classList] : [],
      imageRect: rectOf(image),
      enemyRect: rectOf(enemy),
      computed: {
        hudDisplay: cs(hud, "display"),
        hudPosition: cs(hud, "position"),
        nameDisplay: cs(name, "display"),
        namePosition: cs(name, "position"),
        statusIconsDisplay: cs(statusIcons, "display"),
        statusIconsPosition: cs(statusIcons, "position"),
        bracketsDisplay: cs(brackets, "display"),
        bracketsPosition: cs(brackets, "position"),
        enemyDisplay: cs(enemy, "display"),
        enemyFlexDirection: cs(enemy, "flex-direction"),
        enemyAlignItems: cs(enemy, "align-items"),
      },
    };
  }, label);
}

test.setTimeout(300_000);

test("적 스프라이트 앵커 실측 — HUD/브래킷 등장·소멸 전후 rect", async ({ page }) => {
  const server = await startPlayerQaServer();
  const samples: Sample[] = [];
  try {
    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => {
      localStorage.clear();
      (window as Window & { __OPENRPG_BOOT__?: object }).__OPENRPG_BOOT__ = {
        projectUrl: "/__runtime-qa/project.json",
        saveNamespace: "runtime-qa:enemy-anchor-probe",
        qaInstrumentation: true,
      };
      const w = window as ProbeWindow;
      w.__feelT0 = performance.now();
    });
    const projectJson = JSON.stringify({
      meta: { name: "enemy-anchor-probe", terms: {} },
      system: { battleUiStyle: "classic" },
      database: {
        actors: [{ id: "hero", name: "용사", classId: "warrior", level: 5, hp: 100, maxHp: 100, mp: 20, maxMp: 20 }],
        classes: [{ id: "warrior", name: "전사" }],
        enemies: [{ id: "slime", name: "슬라임", hp: 80, maxHp: 80, mp: 0, maxMp: 0, atk: 4, def: 2 }],
        troops: [{ id: "troop1", name: "슬라임 무리", members: [{ enemyId: "slime", x: 68, y: 96 }] }],
        states: [],
        monsterSpecies: [],
      },
      maps: [{
        id: "map_battle",
        name: "battle-test",
        width: 5,
        height: 5,
        tilesets: [],
        layers: [{ name: "ground", data: new Array(25).fill(1) }],
        events: [{
          id: "ev1", x: 1, y: 0, pages: [{
            trigger: "action",
            commands: [{ code: "battle", troopId: "troop1" }],
          }],
        }],
      }],
    });
    // 위 임시 fixture 는 프로젝트 스키마와 안 맞을 수 있어 실패하면 fallback 으로
    // 기존 battle-v3 fixture 를 쓴다(아래 route 핸들러가 그 파일을 직접 읽는다).
    await page.route("**/__runtime-qa/project.json", async (route) => {
      const { readFile } = await import("node:fs/promises");
      const fixturePath = fileURLToPath(new URL("../fixtures/projects/battle-v3.json", import.meta.url));
      const body = await readFile(fixturePath, "utf8");
      await route.fulfill({ status: 200, contentType: "application/json", body });
    });
    void projectJson; // 실제로는 fixture 파일을 쓴다(위 route). 변수는 진단 기록용으로 남긴다.

    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 120_000 });
    await page.waitForFunction(
      () => typeof (window as ProbeWindow).__oprnDebug === "object" && (window as ProbeWindow).__oprnDebug !== null,
      undefined,
      { timeout: 120_000 },
    );
    await page.waitForFunction(() => {
      const state = (window as ProbeWindow).__oprnDebug?.readState();
      return state?.currentMapId === "map_battle" && state.x === 0 && state.y === 0;
    }, undefined, { polling: "raf", timeout: 30_000 });
    await page.evaluate(() => (window as ProbeWindow).__oprnDebug?.setSeed(7));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.evaluate(() => {
        const w = window as ProbeWindow;
        w.__oprnInput?.face("right");
        w.__oprnInput?.action();
      });
      try {
        await page.waitForSelector("[data-testid='battle-scene']", { state: "visible", timeout: 1_500 });
        break;
      } catch { /* 액션 엣지 재시도 */ }
    }
    await page.waitForSelector("[data-testid='actor-command-attack']", { state: "visible", timeout: 120_000 });

    // ── 표본 1: 커맨드 메뉴 (전투 진입 직후, HUD/브래킷 없음) ────────────────
    samples.push(await readSample(page, "commandMenu"));

    // ── 표본 2: 대상 선택 진입 (브래킷 등장 예상) ───────────────────────────
    await page.keyboard.press("z");
    for (let i = 0; i < 6; i += 1) {
      samples.push(await readSample(page, "targetSelect"));
      await page.waitForTimeout(120);
    }

    // ── 공격 확정 + 전체 시퀀스를 120ms 간격으로 계속 채집 ──────────────────
    await page.keyboard.press("z");
    let busy = true;
    let guard = 0;
    while (busy && guard < 200) {
      samples.push(await readSample(page, "attackSequence"));
      await page.waitForTimeout(120);
      busy = await page.evaluate(() =>
        document.querySelector("[data-testid='battle-scene']")?.getAttribute("data-battle-sequence-busy") === "true"
      );
      guard += 1;
    }
    // 시퀀스 종료 후 안정 상태(HP 게이지 펼쳐진 상태) 몇 프레임 더
    for (let i = 0; i < 6; i += 1) {
      samples.push(await readSample(page, "postSequenceSettled"));
      await page.waitForTimeout(120);
    }

    // ── 2턴째: 다시 대상 선택 진입/이탈을 왕복해 브래킷 등장·소멸을 다시 잡는다 ─
    if (await page.locator("[data-testid='actor-command-attack']").isVisible().catch(() => false)) {
      await page.keyboard.press("z"); // 대상 선택 진입
      for (let i = 0; i < 6; i += 1) {
        samples.push(await readSample(page, "targetSelect2"));
        await page.waitForTimeout(120);
      }
      await page.keyboard.press("Escape").catch(() => {});
      for (let i = 0; i < 4; i += 1) {
        samples.push(await readSample(page, "targetSelectCancelled"));
        await page.waitForTimeout(120);
      }
    }

    await writeFile(`${OUT}samples.json`, JSON.stringify(samples, null, 2), "utf8");

    // ── 콘솔에 압축 테이블 출력 ──────────────────────────────────────────
    console.log("\n=== enemy-anchor-probe samples ===");
    console.log(
      "t".padEnd(6) + "label".padEnd(22) + "step".padEnd(10) + "hpRev".padEnd(7)
      + "tgtSel".padEnd(7) + "img.x,y".padEnd(16) + "img.w,h".padEnd(12) + "enemy.x,y".padEnd(16),
    );
    for (const s of samples) {
      const img = s.imageRect ? `${s.imageRect.x},${s.imageRect.y}` : "-";
      const imgWH = s.imageRect ? `${s.imageRect.width}x${s.imageRect.height}` : "-";
      const enemy = s.enemyRect ? `${s.enemyRect.x},${s.enemyRect.y}` : "-";
      console.log(
        String(s.t).padEnd(6) + s.label.padEnd(22) + s.step.padEnd(10) + String(s.hpRevealed).padEnd(7)
        + String(s.targetSelected).padEnd(7) + img.padEnd(16) + imgWH.padEnd(12) + enemy.padEnd(16),
      );
    }

    // 인접 표본 사이의 이미지 rect 변화(px)와, 그 시점에 바뀐 상태 속성을 표로 뽑는다.
    console.log("\n=== deltas (where imageRect x/y changed) ===");
    for (let i = 1; i < samples.length; i += 1) {
      const prev = samples[i - 1];
      const cur = samples[i];
      if (!prev.imageRect || !cur.imageRect) continue;
      const dx = cur.imageRect.x - prev.imageRect.x;
      const dy = cur.imageRect.y - prev.imageRect.y;
      if (dx !== 0 || dy !== 0) {
        const changedAttrs: string[] = [];
        if (prev.hpRevealed !== cur.hpRevealed) changedAttrs.push(`hpRevealed ${prev.hpRevealed}->${cur.hpRevealed}`);
        if (prev.targetSelected !== cur.targetSelected) changedAttrs.push(`targetSelected ${prev.targetSelected}->${cur.targetSelected}`);
        if (prev.step !== cur.step) changedAttrs.push(`step ${prev.step}->${cur.step}`);
        if (prev.label !== cur.label) changedAttrs.push(`label ${prev.label}->${cur.label}`);
        console.log(
          `t=${cur.t} dx=${round(dx)} dy=${round(dy)} :: ${changedAttrs.join(", ") || "(no tracked attr changed)"}`,
        );
      }
    }

    // ── 회귀 가드 ────────────────────────────────────────────────────────
    // 의도된 모션(lunge/knockback/pose 전환)은 transform 으로 스프라이트를 일부러 움직인다.
    // 그 표본은 제외하고, **정지 상태끼리** rect 가 완전히 같은지 본다.
    const still = samples.filter(
      (s) => s.imageRect && !s.classList.some((c) => c.startsWith("battle-motion-")),
    );
    expect(still.length, "정지 표본이 없다 — 전투 진입 자체가 실패한 것이다").toBeGreaterThan(6);

    const anchors = [...new Set(still.map((s) => `${s.imageRect!.x},${s.imageRect!.y}`))];
    const witness = still.map((s) => `${s.label}/${s.step} hud=${s.computed.hudDisplay} → ${s.imageRect!.x},${s.imageRect!.y}`);
    expect(
      anchors,
      `적 스프라이트가 상태에 따라 움직였다(HUD 등장·소멸이 레이아웃을 밀고 있다):\n${witness.join("\n")}`,
    ).toEqual([anchors[0]]);

    // chrome(이름표·HUD)이 흐름에 없어야 노드 높이 = 스프라이트 높이다.
    // 흐름으로 되돌아가면 노드가 자라고, 아래쪽 앵커가 밀려 위 검사가 깨진다 —
    // 그 전에 원인 쪽에서 잡는다.
    for (const s of still) {
      expect(
        s.enemyRect!.height,
        `노드가 스프라이트보다 크다 — chrome 이 흐름에 들어왔다 (${s.label}/${s.step}, hud=${s.computed.hudDisplay})`,
      ).toBeLessThanOrEqual(s.imageRect!.height + 2);
    }

    // HUD 가 접힘/펼침을 실제로 왕복했는지 — 안 그러면 위 검사가 공허하게 통과한다.
    const hudStates = new Set(samples.map((s) => s.computed.hudDisplay));
    expect(
      [...hudStates].sort(),
      "HUD 가 접힘/펼침 양쪽을 거치지 않았다 — 이 가드는 그 전환에서만 의미가 있다",
    ).toContain("none");
    expect([...hudStates].some((d) => d && d !== "none" && d !== "null"), "HUD 가 펼쳐진 표본이 없다").toBe(true);
  } finally {
    await server.close();
  }
});
