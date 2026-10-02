import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";
import { listBattleSkinIds } from "@/battle/skins/registry";

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
  ".status-menu-body",
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
  // 포켓몬 전용 통합 층은 19층과 21층 사이에 둔다.
  "./battle/20-pokemon-skin.css",
  "./battle/21-gen1-hud-type-badge.css",
  "./battle-skins/_pokemon.css",
  "./battle-skins/_rm2000.css",
  "./battle-skins/_rm2003.css",
  // 유리 뼈대의 색·HUD 변형.
  "./battle-skins/_glass-variants.css",
  "./battle-skins/_transitions.css",
  "./battle-skins/_battlers.css",
  "./battle-skins/_windowskin.css",
  // 타격감 층은 스킨 시트보다 뒤에서 덮는다.
  "./battle/22-hit-feel.css",
  "./battle/23-entry-exit.css",
  "./battle/24-input-prompt.css",
  "./battle/24-backdrop-motion.css",
  "./battle/25-rolling-hp.css",
  // 전용 스킨·겹 배경·레트로 모션도 출하 CSS에 실려야 한다.
  "./battle-skins/_retro2003.css",
  // 같은 뼈대를 쓰는 측면 스킨의 창 색.
  "./battle-skins/_retro-themes.css",
  "./battle-skins/_battle-look.css",
  "./battle/26-battle-scenery.css",
  "./battle/27-retro-motion.css",
  "./commerce.css",
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
  "./zoneFeedback.css",
  "./handSlot.css",
  "./minimap.css",
  "./from-database-system-studio.css",
  "./from-database-modern-utility-records.css",
  "./fieldHud.css",
] as const;

describe("exported player runtime CSS", () => {
  let outputDirectory = "";
  let emittedCss = "";

  beforeAll(async () => {
    // Given: the real standalone-player Vite entry and an isolated output directory.
    outputDirectory = await mkdtemp(join(tmpdir(), "rpgzzu-player-runtime-css-"));

    // When: the current player source is built through its production config.
    await build({
      configFile: resolve("vite.player.config.ts"),
      build: { emptyOutDir: true, outDir: outputDirectory },
    });
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
    const editorEntry = await readFile(resolve("src/styles/index.css"), "utf8");
    const exportEntry = await readFile(resolve("src/player/player.css"), "utf8");

    // When: import order is read from source rather than inferred from a repository grep.
    const imports = Array.from(aggregator.matchAll(/@import\s+"([^"]+)"\s+layer\(runtime\);/gu), (match) => match[1]);

    // Then: the closure is explicit, ordered, unique, shared, and never pulls editor core into export.
    expect(imports).toEqual(RUNTIME_IMPORTS);
    expect(new Set(imports).size).toBe(imports.length);
    expect(editorEntry).toContain('@import "./runtime/index.css";');
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
    expect(hasCssSelector(fixtureCss, ".status-menu-primary-dock")).toBe(false);
    expect(hasCssSelector(fixtureCss, ".status-menu-command-rail")).toBe(true);
    expect(hasCssSelector(fixtureCss, ".status-menu-party")).toBe(true);
    expect(hasCssSelector(fixtureCss, ".action-hud")).toBe(true);
  }, PLAYER_BUILD_TIMEOUT_MS);
});

function hasBattleSkinSelector(css: string, skin: string): boolean {
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
