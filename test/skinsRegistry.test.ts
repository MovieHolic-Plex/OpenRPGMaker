import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "vite";
import { listBattleSkinIds, BATTLE_SKINS } from "@/battle/skins/registry";
import { enemyBattlers } from "@/battle/battleBattlers";
import { BATTLER_PLACEMENTS, CANONICAL_SIDEVIEW_ANCHOR_X, MANUAL_FRONTAL_DAMPING, resolveManualFrontalRow, resolveSkinEnemyPosition, resolveSkinEnemyPositions, spreadEnemyFormation } from "@/battle/battlerPlacements";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import type { BattleSkinId } from "@/battle/skins/types";
import { isolateTimers } from "./mergedTeardown";

describe("playerRuntimeCss", () => {
  isolateTimers();
  const EDITOR_ONLY_SELECTOR_SENTINEL = ".editor-layout";
  const PLAYER_BUILD_TIMEOUT_MS = 120_000;
  const REQUIRED_RUNTIME_SELECTORS = [
    ".play-viewport",
    ".play-stage",
    ".rm-title-menu",
    ".play-loading-overlay",
    ".cinematic-sequence",
    ".cinematic-terminal",
    ".dialogue-overlay",
    // 대화창 연출. 에디터 테스트플레이는 에디터 CSS 가 함께 로드돼 정상으로 보이므로
    // 익스포트 플레이어에 규칙이 실렸는지는 이 빌드 검사만 판정할 수 있다.
    "dialogue-box-enter",
    "dialogue-box-exit",
    "dialogue-char-enter",
    ".dialogue-scrim",
    "dialogue-box-shake",
    "dialogue-scrim-flash",
    ".touch-pad",
    ".action-hud",
    ".battle-transition-overlay",
    ".status-menu-command-rail",
    ".status-menu-primary-dock",
    ".status-menu-command",
    // .status-menu-body 는 공개 기준선(0d4f13e7c8)부터 어느 시트·렌더러에도 없다 — 본문은 .status-menu-detail 계열이 맡는다.
    ".status-menu-party",
    ".status-menu-detail",
    ".status-menu-detail-list",
    ".status-menu-detail-action",
    ".status-menu-footer",
    ".picture-layer",
    ".runtime-screen-effect",
    // 누락 리소스 알림. 이 규칙은 editor/core.part-1.css 에만 있어서 출하 플레이어에서는
    // 스타일 없는 static 블록이 되어 무대 아래에 깔렸고 overflow 에 잘렸다.
    ".runtime-missing-resource",
    ".zone-feedback",
  ] as const;
  // 표면 진입 시트 src/styles/runtime/index.css 의 @import 순서(2026-09-11 Task 7 이후). 옛 배럴(battle.css,
  // battle-skins/index.css)은 사라져 슬라이스가 직접 나열된다. playerRuntime.css 는 이 시트로 전달하는 한 줄 허브다.
  // #2782·#2816·#3324·#3370 이 VN·모바일·전투 깊이 시트를 덧붙였다(76개).
  // 그 뒤 주간 일정표(#4008, schedule.css)와 클래식 윈도우 스킨(b4bd8fcab, windowSkinSurfaces.css — 스킨이 다른 시트 위에 칠하므로 맨 끝)이 들어와 78개다.
  const RUNTIME_IMPORTS = [
    "./fonts.css",
    "./system.css",
    "./playSurface.css",
    "./from-editor-core-part-2.css",
    "./from-map-resource-system-part-1.css",
    "./battle/01-scene-base.css",
    "./battle/02-intro-reveal.css",
    "./battle/03-vxace-status-nodes.css",
    "./battle/04-anim-damage-layers.css",
    "./battle/05-poses-motion.css",
    "./battle/06-damage-flash-targeting.css",
    "./battle/07-640-scene-turn-ribbon.css",
    "./battle/08-640-target-panels.css",
    "./battle/09-keyboard-result-panel.css",
    "./battle/10-compact-hud-stage.css",
    "./battle/11-compact-hud-row.css",
    "./battle/12-compact-party-target.css",
    "./battle/13-compact-victory-box.css",
    "./battle/15-juice-capture-fx.css",
    "./battle/17-sprint-a-polish.css",
    "./battle/19-adversarial-review-3.css",
    "./battle/20-pokemon-skin.css",
    "./battle/21-gen1-hud-type-badge.css",
    "./battle-skins/_pokemon.css",
    "./battle-skins/_rm2000.css",
    "./battle-skins/_rm2003.css",
    "./battle-skins/_glass-variants.css",
    "./battle-skins/_transitions.css",
    "./battle-skins/_battlers.css",
    "./battle-skins/_windowskin.css",
    "./battle/22-hit-feel.css",
    "./battle/23-entry-exit.css",
    "./battle/24-input-prompt.css",
    "./battle/30-backdrop-motion.css",
    "./battle/25-rolling-hp.css",
    "./battle-skins/_retro2003.css",
    "./battle-skins/_battle-look.css",
    "./battle/26-battle-scenery.css",
    "./battle/27-retro-motion.css",
    "./battle/28-retro-state-aura.css",
    "./battle/29-impact-contact.css",
    "./battle/31-battle-depth.css",
    "./commerce.css",
    "./schedule.css",
    "./tacticsBattle.css",
    "./shop.css",
    "./title.css",
    "../database/tabs-b-title-screen.css",
    "../database/tabs-b-status-menu-base.css",
    "../database/tabs-b-status-menu-main.css",
    "./statusMenuEdgeDock.css",
    "./galleryMenu.css",
    "./statusMenuSkins.css",
    "./statusMenuLegacySkins.css",
    "./pixelWindows.css",
    "./monsterCampaignMenu.css",
    "./playLoading.css",
    "./actionHud.css",
    "./timer.css",
    "./touchpad.css",
    "./pictures.css",
    "./transitions.css",
    "./nameEntry.css",
    "./keyboardNav.css",
    "./gameOver.css",
    "./juice.css",
    "../dialogue.css",
    "../dialogueStyles.css",
    "../dialogueReading.css",
    "../vnLook.css",
    "./zoneFeedback.css",
    "./handSlot.css",
    "./minimap.css",
    "./from-database-system-studio.css",
    "./from-database-modern-utility-records.css",
    "./fieldHud.css",
    "./mobileUi.css",
    "./windowSkinSurfaces.css",
  ] as const;
  describe("exported player runtime CSS", () => {
    let outputDirectory = "";
    let emittedCss = "";

    beforeAll(async () => {
      // Given: the real standalone-player Vite entry and an isolated output directory.
      outputDirectory = await mkdtemp(join(tmpdir(), "rpgzzu-player-runtime-css-"));

      // When: the current player source is built through its production config.
      // Vite 는 NODE_ENV 로 import.meta.env.DEV 를 정한다. vitest 는 NODE_ENV=test 라 그대로 두면 DEV 가 참인 빌드가 되어,
      // 출하 빌드에서는 통째로 빠지는 dev 전용 가지(exportEntry.ts loadFlagshipDemo 의 편집기 데모 빌더 import)가 그래프에 남고
      // 플레이어 번들 관문(scripts/lib/playerBundleGuard.mjs, #3870)이 «editor-only modules reached the exported player» 로 빌드를 멈춘다.
      // 출하 빌드와 같은 조건으로 짓는다 — dev 서버의 플레이어 빌드도 같은 이유로 NODE_ENV=production 자식 프로세스를 쓴다(scripts/lib/devPlayerBundles.ts).
      // 관문은 그대로 돈다: 출하 조건에서 편집기 전용 모듈이 플레이어에 닿으면 이 빌드가 실패한다.
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        await build({
          configFile: resolve("vite.player.config.ts"),
          build: { emptyOutDir: true, outDir: outputDirectory },
        });
      } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
      }
      emittedCss = await readEmittedCss(outputDirectory);
    }, PLAYER_BUILD_TIMEOUT_MS);

    afterAll(async () => {
      if (outputDirectory) await rm(outputDirectory, { force: true, recursive: true });
    });

    it("keeps the existing shared runtime selector families in emitted bytes", () => {
      // Then: current title, loading, dialogue, touch, scaling, and battle-transition CSS is preserved.
      for (const selector of [
        ".play-viewport",
        ".play-stage",
        ".rm-title-menu",
        ".play-loading-overlay",
        ".dialogue-overlay",
        ".touch-pad",
        ".battle-transition-overlay",
        ".action-hud-bar",
      ]) {
        expect(hasCssSelector(emittedCss, selector), `missing existing selector ${selector}`).toBe(true);
      }
    });

    it("emits the complete player-owned runtime closure without editor CSS", () => {
      // Given: every player surface and declared battle skin is part of the standalone runtime.

      // Then: emitted bytes contain every required family, while editor workbench CSS stays excluded.
      const missingSelectors = REQUIRED_RUNTIME_SELECTORS.filter(
        (selector) => !hasCssSelector(emittedCss, selector),
      );
      const missingBattleSkins = listBattleSkinIds().filter(
        (skin) => !hasBattleSkinSelector(emittedCss, skin),
      );
      expect({ missingBattleSkins, missingSelectors }).toEqual({
        missingBattleSkins: [],
        missingSelectors: [],
      });
      expect(hasCssSelector(emittedCss, EDITOR_ONLY_SELECTOR_SENTINEL)).toBe(false);
    });

    // 선택자 존재만 검사하면 규칙 안에 버그 값이 복원되어도 통과하므로 선언값까지 잠근다.
    it("inverse-scales every missing-resource length in emitted bytes", () => {
      const block = cssDeclarationBlock(emittedCss, ".runtime-missing-resource");
      expect(block, "missing .runtime-missing-resource declaration block").toBeTruthy();

      const lengthDeclarations = block!.split(";")
        .map((declaration) => declaration.trim())
        .filter((declaration) => /(?:\d+(?:\.\d+)?|\.\d+)(?:px\b|%)/u.test(declaration));
      expect(lengthDeclarations.length, "missing-resource rule must contain measured lengths").toBeGreaterThan(0);
      for (const declaration of lengthDeclarations) {
        expect(declaration, `length is not inverse-scaled: ${declaration}`).toMatch(
          /\/\s*var\(--play-scale\)/u,
        );
      }
      expect(block, "bare font-size is multiplied by the transformed stage scale").not.toMatch(
        /font-size:\s*(?:\d+(?:\.\d+)?|\.\d+)px(?:;|$)/u,
      );
    });

    it("uses one ordered runtime module list from both CSS entrypoints", async () => {
      // Given: the player-owned aggregator and both host entrypoints.
      const aggregator = await readFile(resolve("src/styles/runtime/index.css"), "utf8");
      const forwarder = await readFile(resolve("src/styles/runtime/playerRuntime.css"), "utf8");
      // 에디터는 런타임 시트를 지연 로드한다(src/app/runtimeStyles.ts → runtimeStylesheet.ts, 공개 기준선부터).
      const editorEntry = await readFile(resolve("src/app/runtimeStylesheet.ts"), "utf8");
      const exportEntry = await readFile(resolve("src/player/player.css"), "utf8");

      // When: import order is read from source rather than inferred from a repository grep.
      const imports = Array.from(aggregator.matchAll(/@import\s+"([^"]+)"\s+layer\(runtime\);/gu), (match) => match[1]);

      // Then: the closure is explicit, ordered, unique, shared, and never pulls editor core into export.
      expect(imports).toEqual(RUNTIME_IMPORTS);
      expect(new Set(imports).size).toBe(imports.length);
      expect(editorEntry).toContain('import "@/styles/runtime/index.css";');
      expect(forwarder.trim()).toBe('@import "./index.css";');
      expect(exportEntry).toContain('@import "../styles/runtime/playerRuntime.css";');
      expect(exportEntry).not.toContain("../styles/index.css");
      expect(aggregator).not.toContain("../editor/");
    });

    it("keeps every editor-origin runtime leaf in the player aggregator editor-scoped", async () => {
      // Given: the from-*.css leaves that Task 6.5 moved into the runtime layer. They ride the player chain
      // (player.css → playerRuntime.css → runtime/index.css) although their source sheets never did.
      const aggregator = await readFile(resolve("src/styles/runtime/index.css"), "utf8");
      const leaves = Array.from(aggregator.matchAll(/@import\s+"(\.\/from-[^"]+\.css)"\s+layer\(runtime\);/gu), (match) => match[1]);
      expect(leaves.length).toBeGreaterThan(0);

      // When: every selector of every leaf is read (top-level rule preludes and rules inside at-blocks alike).
      const EDITOR_SCOPE = /:where\(body:has\(\.editor-layout\)\)|\.test-play-modal-body|\.db-|\.editor-layout/u;
      const offending: string[] = [];
      for (const leaf of leaves) {
        const css = (await readFile(resolve("src/styles/runtime", leaf), "utf8")).replace(/\/\*[\s\S]*?\*\//gu, "");
        const preludes = Array.from(css.matchAll(/(^|[}{;])\s*([^{}@;]+?)\s*\{/gu), (match) => match[2].trim()).filter((prelude) => prelude.length > 0);
        for (const prelude of preludes) for (const selector of prelude.split(",")) {
          if (!EDITOR_SCOPE.test(selector)) offending.push(`${leaf}: ${selector.trim()}`);
        }
      }

      // Then: no selector can match in the shipped player document, which has no editor ancestor.
      expect(offending, "플레이어 사슬의 편집기 유래 리프는 모든 선택자가 편집기 조상으로 스코프돼야 한다").toEqual([]);
    });

    it("detects an omitted required import in a disposable built entry", async () => {
      // Given/When: a disposable closure is built without only the action-HUD import.
      const fixtureCss = await buildDisposableClosureWithout('@import "./actionHud.css" layer(runtime);\n');

      // Then: the omission is visible in bytes while adjacent transition CSS remains.
      // playSurface still references .action-hud to hide it during cutscenes; that reference
      // does not supply HUD layout. The owning module's standalone rule must disappear.
      expect(cssDeclarationBlock(fixtureCss, ".action-hud")).toBeUndefined();
      expect(hasCssSelector(fixtureCss, ".battle-transition-overlay")).toBe(true);
    }, PLAYER_BUILD_TIMEOUT_MS);

    it("detects an omitted edge-dock status-menu module in a disposable built entry", async () => {
      // Given/When: a disposable closure is built without only the final edge-dock presentation import.
      const fixtureCss = await buildDisposableClosureWithout(
        '@import "./statusMenuEdgeDock.css" layer(runtime);\n',
      );

      // Then: legacy content primitives remain, but the modern dock contract disappears.
      // .status-menu-primary-dock 은 이제 스킨·모바일 시트(statusMenuSkins·mobileUi·pixelWindows)도 꾸미므로
      // 이 모듈에만 있는 선택자(.has-item-facts)로 빠짐을 잰다.
      expect(hasCssSelector(fixtureCss, ".has-item-facts")).toBe(false);
      expect(hasCssSelector(fixtureCss, ".status-menu-command-rail")).toBe(true);
      expect(hasCssSelector(fixtureCss, ".status-menu-party")).toBe(true);
      expect(hasCssSelector(fixtureCss, ".action-hud")).toBe(true);
    }, PLAYER_BUILD_TIMEOUT_MS);
  });
  function hasBattleSkinSelector(css: string, skin: string): boolean {
    // retro2003(도트 측면 기본)은 스킨 id 가 아니라 루트 data-battle-motion="retro" 에 규칙이 걸린다(skins/registry.ts 2026-10-01 주석).
    if (skin === "retro2003" && (css.includes('[data-battle-motion="retro"]') || css.includes("[data-battle-motion=retro]"))) return true;
    return css.includes(`[data-battle-skin="${skin}"]`)
      || css.includes(`[data-battle-skin=${skin}]`);
  }
  function hasCssSelector(css: string, selector: string): boolean {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`${escapedSelector}(?=[\\s,{.:#\\[])`, "u").test(css);
  }
  /** 독립 CSS 규칙의 선언 본문을 중괄호 균형으로 떠낸다. */
  function cssDeclarationBlock(css: string, selector: string): string | undefined {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const header = new RegExp(`(?:^|[}])\\s*${escapedSelector}\\s*\\{`, "gu");
    const match = header.exec(css);
    if (!match) return undefined;

    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      else if (css[index] === "}") depth -= 1;
      index += 1;
    }
    return depth === 0 ? css.slice(start, index - 1) : undefined;
  }
  async function buildDisposableClosureWithout(importStatement: string): Promise<string> {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "rpgzzu-player-css-omission-"));
    try {
      const fixtureStyles = join(fixtureRoot, "styles");
      await cp(resolve("src/styles"), fixtureStyles, { recursive: true });
      // 집합기는 runtime/index.css. 엔트리가 부르는 playerRuntime.css 는 그 시트로 전달한다.
      const fixtureAggregator = join(fixtureStyles, "runtime", "index.css");
      const source = await readFile(fixtureAggregator, "utf8");
      // 집합기 CSS 는 CRLF 다. importStatement 리터럴은 "\n" 로 끝나므로 문자열 replace 는
      // Windows 체크아웃에서 절대 매치되지 않아 이 가드가 통째로 무력화된다(실측). 줄끝 무관 매치.
      const importPattern = new RegExp(
        `${importStatement.trimEnd().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\r?\\n`,
        "u",
      );
      const mutated = source.replace(importPattern, "");
      expect(mutated).not.toBe(source);
      await writeFile(fixtureAggregator, mutated, "utf8");
      await writeFile(
        join(fixtureRoot, "entry.mjs"),
        'import "./styles/runtime/playerRuntime.css";\n',
        "utf8",
      );
      const fixtureOutput = join(fixtureRoot, "output");
      await build({
        configFile: false,
        publicDir: false,
        root: fixtureRoot,
        build: {
          emptyOutDir: true,
          outDir: fixtureOutput,
          rollupOptions: { input: join(fixtureRoot, "entry.mjs") },
        },
      });
      return await readEmittedCss(fixtureOutput);
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  }
  async function readEmittedCss(root: string): Promise<string> {
    const files = await listFiles(root);
    const cssFiles = files.filter((file) => file.endsWith(".css"));
    expect(cssFiles.length, "player build must emit CSS").toBeGreaterThan(0);
    return (await Promise.all(cssFiles.map((file) => readFile(file, "utf8")))).join("\n");
  }
  async function listFiles(root: string): Promise<readonly string[]> {
    const found: string[] = [];

    async function walk(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else found.push(path);
      }
    }

    await walk(root);
    return found;
  }
});

describe("troopSkinPlacement", () => {
  isolateTimers();
  const SKIN_IDS = Object.keys(BATTLER_PLACEMENTS) as BattleSkinId[];
  const sideview = SKIN_IDS.filter((id) => {
    const layout = BATTLE_SKINS[id]?.layout;
    return layout === "sideview" || layout === "active";
  });
  const frontal = SKIN_IDS.filter((id) => {
    const layout = BATTLE_SKINS[id]?.layout;
    return layout === "frontview" || layout === "firstperson";
  });
  describe("resolveSkinEnemyPosition", () => {
    it("auto matches the placement table", () => {
      for (const skin of SKIN_IDS) {
        for (const n of [1, 2, 3, 4]) {
          for (let i = 0; i < n; i += 1) {
            expect(resolveSkinEnemyPosition(skin, { x: 200, y: 200 }, i, n, true)).toEqual(
              BATTLER_PLACEMENTS[skin].enemy(i, n),
            );
          }
        }
      }
    });

    it("auto works without canonical coords", () => {
      for (const skin of SKIN_IDS) {
        expect(resolveSkinEnemyPosition(skin, undefined, 0, 3, true)).toEqual(
          BATTLER_PLACEMENTS[skin].enemy(0, 3),
        );
      }
    });

    // 2026-10-01: 측면 스킨은 모두 도트 측면 뼈대라 저작 좌표를 적 구역(RETRO_ZONE x 34~150 · y 92~142)에 가둔다.
    it("manual sideview clamps authored x into the dot-sideview enemy zone", () => {
      expect(resolveSkinEnemyPosition("retro2003", { x: 200, y: 180 }, 0, 3, false)).toEqual({
        x: 150,
        y: 120,
      });
    });

    it("manual sideview keeps in-range coords and clamps display range", () => {
      expect(resolveSkinEnemyPosition("retro2003", { x: 100, y: 180 }, 0, 3, false)).toEqual({
        x: 100,
        y: 120,
      });
      expect(resolveSkinEnemyPosition("retro2003", { x: 400, y: 300 }, 0, 1, false)).toEqual({
        x: 150,
        y: 142,
      });
      expect(resolveSkinEnemyPosition("retro2003", { x: -10, y: -5 }, 0, 1, false).x).toBe(34);
    });

    it("manual frontal keeps y and shifts x by the damped offset", () => {
      for (const skin of frontal) {
        const fallback = BATTLER_PLACEMENTS[skin].enemy(1, 3);
        expect(
          resolveSkinEnemyPosition(skin, { x: CANONICAL_SIDEVIEW_ANCHOR_X, y: 0 }, 1, 3, false),
        ).toEqual(fallback);
        const moved = resolveSkinEnemyPosition(
          skin,
          { x: CANONICAL_SIDEVIEW_ANCHOR_X + 40, y: 0 },
          1,
          3,
          false,
        );
        expect(moved.y).toBe(fallback.y);
        expect(moved.x).toBe(
          Math.max(0, Math.min(320, Math.round(fallback.x + 40 * MANUAL_FRONTAL_DAMPING))),
        );
      }
    });

    it("manual frontal keeps raw authored x beyond the old recenter line", () => {
      const fallback = BATTLER_PLACEMENTS.pokemon.enemy(0, 1);
      const moved = resolveSkinEnemyPosition("pokemon", { x: 200, y: 80 }, 0, 1, false);
      expect(moved.y).toBe(fallback.y);
      expect(moved.x).toBe(
        Math.max(0, Math.min(320, Math.round(fallback.x + (200 - CANONICAL_SIDEVIEW_ANCHOR_X) * MANUAL_FRONTAL_DAMPING))),
      );
    });

    it("manual without coords falls back to auto seats", () => {
      for (const skin of SKIN_IDS) {
        expect(resolveSkinEnemyPosition(skin, undefined, 2, 4, false)).toEqual(
          BATTLER_PLACEMENTS[skin].enemy(2, 4),
        );
        expect(resolveSkinEnemyPosition(skin, { x: Number.NaN, y: 50 }, 2, 4, false)).toEqual(
          BATTLER_PLACEMENTS[skin].enemy(2, 4),
        );
      }
    });
  });
  // 정면 구도는 2026-10-02 부터 포켓몬 스킨 하나뿐이다(정면 유리 스킨 rm2000·dragonquest·mother·mv·vxace 삭제).
  describe("resolveSkinEnemyPositions", () => {
    it("manual frontal shifts the whole row uniformly from the troop mean", () => {
      const xs = [84, 128, 84, 128];
      const row = resolveSkinEnemyPositions(
        "pokemon",
        xs.map((x) => ({ x, y: 80 })),
        false,
      );
      const fallback = xs.map((_, i) => BATTLER_PLACEMENTS.pokemon.enemy(i, 4));
      const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
      const shift = Math.round((mean - CANONICAL_SIDEVIEW_ANCHOR_X) * MANUAL_FRONTAL_DAMPING);
      expect(row.map((p) => p.x)).toEqual(fallback.map((seat) => seat.x + shift));
      expect(row.map((p) => p.y)).toEqual(fallback.map((seat) => seat.y));
      const sorted = row.map((p) => p.x).sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]! - sorted[i - 1]!).toBe(58);
      }
    });

    it("member x=200 keeps raw authored coords while battleX stays SC12-recentered", () => {
      const project = createScarloxyPokemonDemoProject();
      const troop = project.database.troops.find((t) => t.id === "troop_pkmn_grass_a");
      if (!troop) throw new Error("missing troop");
      const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0]!;
      const battlers = enemyBattlers(project, {
        ...troop,
        members: [{ enemyId, x: 200, y: 80 }],
      });
      expect(battlers[0]!.authoredX).toBe(200);
      expect(battlers[0]!.battleX).toBeLessThanOrEqual(150);
      const fromAuthored = resolveSkinEnemyPositions("pokemon", [{ x: battlers[0]!.authoredX, y: battlers[0]!.authoredY }], false);
      const fromBattle = resolveSkinEnemyPositions("pokemon", [{ x: battlers[0]!.battleX, y: battlers[0]!.battleY }], false);
      expect(fromAuthored).not.toEqual(fromBattle);
      const preview = resolveSkinEnemyPositions("pokemon", [{ x: 200, y: 80 }], false);
      expect(fromAuthored).toEqual(preview);
      expect(preview[0]!.x).toBeGreaterThan(BATTLER_PLACEMENTS.pokemon.enemy(0, 1).x);
    });

    it("row helper falls back to auto seats without authored coords", () => {
      const row = resolveManualFrontalRow("pokemon", [Number.NaN, Number.NaN]);
      expect(row).toEqual([
        BATTLER_PLACEMENTS.pokemon.enemy(0, 2).x,
        BATTLER_PLACEMENTS.pokemon.enemy(1, 2).x,
      ]);
    });

    it("auto rows match the placement table", () => {
      for (const skin of SKIN_IDS) {
        const row = resolveSkinEnemyPositions(
          skin,
          [{ x: 200, y: 200 }, { x: 100, y: 90 }],
          true,
        );
        expect(row).toEqual([
          BATTLER_PLACEMENTS[skin].enemy(0, 2),
          BATTLER_PLACEMENTS[skin].enemy(1, 2),
        ]);
      }
    });

    it("sideview rows only", () => {
      expect(sideview.length).toBeGreaterThan(0);
      expect(frontal.length).toBeGreaterThan(0);
      expect(new Set([...sideview, ...frontal]).size).toBe(SKIN_IDS.length);
    });
  });
  describe("spreadEnemyFormation screen edge", () => {
    // QA-FS137-001: four wisps' boxes (sprite + name plate) together are wider than the [minX, maxX] corridor, so the old
    // nudge was 0 and the left-most plate stayed left of the screen (x < 0).
    const wide = { left: -40, right: 40, top: -60, bottom: 14 };

    it("keeps the left-most box on screen when the group is wider than the allowed corridor", () => {
      // Given four enemies on one row whose boxes (80 units wide each) need more than the 8..206 corridor
      const seats = [20, 70, 120, 170].map((x) => ({ x, y: 96 }));

      // When the formation is spread
      const spread = spreadEnemyFormation(seats, seats.map(() => wide));

      // Then no box leaves the left edge of the 320-unit stage (the right side may use the party corridor)
      expect(Math.min(...spread.map((p) => p.x + wide.left))).toBeGreaterThanOrEqual(0);
    });

    it("leaves a group that already fits untouched by the edge rule", () => {
      // Given two well-separated enemies inside the corridor
      const seats = [{ x: 100, y: 96 }, { x: 180, y: 96 }];

      // When spread
      const spread = spreadEnemyFormation(seats, seats.map(() => ({ left: -20, right: 20, top: -30, bottom: 10 })));

      // Then the seats do not move
      expect(spread).toEqual(seats);
    });
  });
});
