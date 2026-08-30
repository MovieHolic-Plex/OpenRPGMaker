/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BATTLER_IDLE_ANIMATIONS,
  battlerIdleAnimation,
  battlerIdleAnimationUrl,
} from "@/assets/battlerIdleAnimations";
import { POSE_FRAME } from "@/battle/battlePose";
import { createBattleRuntime } from "@/battle/runtime";
import { applyBattlerPoseForTest, battleField } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

// 이 테스트가 지키는 것 — 배틀러 idle 애니메이션 계약 4가지.
//
//  1. **카탈로그가 정본이다.** 등록된 항목의 PNG 는 실제로 있고 프레임 수 × 셀 = 실측 폭이어야 한다.
//     그림과 선언이 어긋나면 런타임이 존재하지 않는 칸을 샘플링하는 조용한 회귀가 된다
//     (`generatedEffectSheets` 가 같은 이유로 카탈로그 단일 정본을 못 박아 뒀다).
//  2. **`<img>` 배틀러는 여전히 `<img>` 다.** 애니메이션은 배경으로 얹고 내용 이미지만 상자 밖으로
//     밀어낸다. 엘리먼트 종류를 바꾸면 12종 스킨의 width/height 규칙·rect 프로브·`naturalWidth`
//     대기(scripts/capture-*.mts)·`src` 계약(test/battleEnemyGraphicFidelity.test.ts)이 전부
//     동시에 깨진다. 그래서 `src` 는 **정적 원본 그대로**여야 한다 — 애니메이션 CSS 가 없는
//     환경에서 그 정적 그림이 그대로 폴백이다.
//  3. **POSE_FRAME 이 이긴다.** idle 이 아닌 포즈에서는 애니메이션을 끄고 정적 시트의 포즈 칸으로
//     즉시 돌아가야 한다. 포즈 산식(`test/battlerPoseFrame.test.ts`)은 한 글자도 바뀌지 않는다.
//  4. **감속 모드에서 멈춘다.** CSS 에 `prefers-reduced-motion: reduce` 분기가 있어야 한다.
const ROOT = path.resolve(__dirname, "..");
const BATTLERS_CSS = path.join(ROOT, "src/styles/runtime/battle-skins/_battlers.css");

/** PNG IHDR 에서 크기를 읽는다 — 테스트에 이미지 라이브러리를 끌어오지 않기 위해서다. */
function pngSize(relativePath: string): { width: number; height: number } {
  const bytes = readFileSync(path.join(ROOT, "public", relativePath));
  if (bytes.readUInt32BE(12) !== 0x49484452) throw new Error(`IHDR 가 없다: ${relativePath}`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function fieldFor(troopId: string): HTMLElement {
  const project = createBlankProject();
  store.replace(project);
  const runtime = createBattleRuntime({ project, troopId, canEscape: true, canLose: false, rng: () => 0 });
  return battleField(runtime.snapshot());
}

describe("배틀러 idle 애니메이션 — 카탈로그", () => {
  it("등록된 모든 스트립이 존재하고 선언한 프레임 수와 실측 폭이 일치한다", () => {
    expect(BATTLER_IDLE_ANIMATIONS.length).toBeGreaterThan(0);
    for (const entry of BATTLER_IDLE_ANIMATIONS) {
      const size = pngSize(entry.path);
      expect(entry.frameCount, `${entry.resourceId}: 프레임이 2장 미만이면 애니메이션이 아니다`).toBeGreaterThan(1);
      expect(size.width, `${entry.resourceId}: 폭 = 프레임 수 × 셀`).toBe(entry.frameCount * entry.cellWidth);
      expect(size.height, `${entry.resourceId}: 높이 = 셀 높이`).toBe(entry.cellHeight);
      expect(entry.frameDurationMs).toBeGreaterThan(0);
    }
  });

  it("등록되지 않은 리소스 id 는 undefined 를 돌려준다 (정적 폴백)", () => {
    expect(battlerIdleAnimation("generated-enemy-dragon-01")).toBeUndefined();
    expect(battlerIdleAnimation(undefined)).toBeUndefined();
    expect(battlerIdleAnimation("generated-enemy-slime-01")).toBeDefined();
  });

  it("URL 은 public 기준 절대 경로다", () => {
    const entry = battlerIdleAnimation("generated-enemy-slime-01");
    if (!entry) throw new Error("슬라임 항목이 등록돼 있어야 한다");
    expect(battlerIdleAnimationUrl(entry)).toBe(`/${entry.path}`);
  });
});

describe("배틀러 idle 애니메이션 — 적 배틀러(<img> 유지)", () => {
  it("등록된 적은 <img> 그대로이고 src 는 정적 원본, 애니메이션은 배경으로 붙는다", () => {
    const field = fieldFor("troop_golem_guard");
    const golem = field.querySelector<HTMLElement>('[data-record-id="enemy_stone_golem"] .battle-enemy-image');
    expect(golem).toBeTruthy();
    // (2) 엘리먼트 종류 계약 — 여기서 span 으로 바뀌면 스킨 크기 규칙과 rect 프로브가 깨진다.
    expect(golem?.tagName).toBe("IMG");
    expect((golem as HTMLImageElement).getAttribute("src")).toContain("monster-golem-01.png");
    expect(golem?.dataset.battlerAnim).toBe("generated-enemy-golem-01");
    expect(golem?.style.getPropertyValue("--battler-anim-frames")).toBe("8");
    expect(golem?.style.getPropertyValue("--battler-anim-url")).toContain("idle/monster-golem-01.png");
    expect(golem?.style.getPropertyValue("--battler-anim-duration")).toMatch(/^\d+ms$/);
  });

  it("등록되지 않은 적은 애니메이션 속성이 붙지 않는다", () => {
    const field = fieldFor("troop_dragon");
    const dragon = field.querySelector<HTMLElement>('[data-record-id="enemy_dragon"] .battle-enemy-image');
    expect(dragon).toBeTruthy();
    expect(dragon?.tagName).toBe("IMG");
    expect(dragon?.dataset.battlerAnim).toBeUndefined();
    expect(dragon?.style.getPropertyValue("--battler-anim-frames")).toBe("");
  });
});

describe("배틀러 idle 애니메이션 — 액터 전투 시트(48px 셀)", () => {
  function actorSprite(resourceId = "generated-actor-hero-01-battle"): HTMLElement {
    const sprite = document.createElement("span");
    sprite.className = "battle-actor-sprite";
    sprite.dataset.testid = `battle-actor-sprite-${resourceId}`;
    // 런타임의 actorBattleImage 가 심는 것과 같은 집합을 심는다.
    sprite.dataset.battlerResourceId = resourceId;
    sprite.dataset.battlerSheetUrl = "/assets/generated/starter/hero-01-battle.png";
    sprite.dataset.battlerSheetSize = "288px 768px";
    sprite.style.setProperty("--battle-sprite-frame-width", "96px");
    sprite.style.setProperty("--battle-sprite-frame-height", "96px");
    sprite.style.backgroundImage = 'url("/assets/generated/starter/hero-01-battle.png")';
    sprite.style.backgroundSize = "288px 768px";
    sprite.style.backgroundPosition = "0 0";
    const node = document.createElement("div");
    node.append(sprite);
    return node;
  }

  it("idle 이면 idle 스트립으로 바꾸고 세로 오프셋을 0 으로 둔다", () => {
    const node = actorSprite();
    applyBattlerPoseForTest(node, "idle");
    const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite");
    expect(sprite?.dataset.battlerAnim).toBe("generated-actor-hero-01-battle");
    expect(sprite?.style.backgroundImage).toContain("idle/hero-01-battle.png");
    // 스트립은 1행이므로 세로는 0 이어야 한다. 가로는 CSS 애니메이션이 굴린다.
    expect(sprite?.style.backgroundPositionY).toBe("0px");
    expect(sprite?.style.getPropertyValue("--battler-anim-frames")).toBe("4");
    // 4프레임 × 96px = 384px 폭, 높이는 셀 하나.
    expect(sprite?.style.backgroundSize).toBe("384px 96px");
  });

  it("idle 이 아닌 포즈는 애니메이션을 끄고 정적 시트의 POSE_FRAME 칸으로 돌아간다", () => {
    const node = actorSprite();
    applyBattlerPoseForTest(node, "idle");
    applyBattlerPoseForTest(node, "attack");
    const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite");
    expect(sprite?.dataset.battlerAnim).toBeUndefined();
    expect(sprite?.style.backgroundImage).toContain("hero-01-battle.png");
    expect(sprite?.style.backgroundImage).not.toContain("/idle/");
    expect(sprite?.style.backgroundSize).toBe("288px 768px");
    // (3) 포즈 산식은 그대로다 — attack = 열 1, 행 0.
    expect(sprite?.style.backgroundPosition).toBe(`-${POSE_FRAME.attack.col * 96}px 0px`);
  });

  it("애니메이션이 등록되지 않은 시트는 idle 에서도 정적 칸을 쓴다", () => {
    const node = actorSprite("generated-actor-hero-99-battle");
    const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite");
    applyBattlerPoseForTest(node, "idle");
    expect(sprite?.dataset.battlerAnim).toBeUndefined();
    expect(sprite?.style.backgroundImage).toContain("hero-01-battle.png");
    expect(sprite?.style.backgroundPosition).toBe("0px 0px");
  });
});

describe("배틀러 idle 애니메이션 — CSS 계약", () => {
  const css = readFileSync(BATTLERS_CSS, "utf8");

  it("프레임 경계에 정확히 멈추는 스텝 함수를 쓴다", () => {
    // jump-none 이어야 첫·끝 프레임을 모두 포함해 N 프레임에 N 번 멈춘다.
    // 기본 steps(N) 은 첫 프레임을 건너뛴다.
    expect(css).toContain("steps(var(--battler-anim-frames), jump-none)");
    // 백분율은 (엘리먼트 폭 − 배경 폭)에 대해 계산되므로 0%→100% 가 첫→끝 프레임이다.
    // `-100% × N` 으로 밀면 배틀러가 상자 밖으로 나간다(실측).
    expect(css).toMatch(/background-position-x:\s*0%/);
    expect(css).toMatch(/background-position-x:\s*100%/);
  });

  it("내용 이미지를 상자 밖으로 밀어 배경만 보이게 한다", () => {
    expect(css).toMatch(/\.battle-enemy-image\[data-battler-anim\]|\[data-battler-anim\]/);
    expect(css).toContain("object-position");
  });

  it("감속 모드에서 애니메이션을 멈춘다", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain("data-battler-anim");
    expect(reduced).toMatch(/animation:\s*none/);
  });

  it("!important 를 새로 늘리지 않는다 (CSS 예산 래칫)", () => {
    // 주석 산문에도 `!important` 라는 단어가 나온다(기존 스킨 규칙을 설명하는 대목).
    // 선언만 보려면 주석을 지우고 재야 한다.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const section = withoutComments.slice(withoutComments.indexOf("data-battler-anim"));
    expect(section).not.toContain("!important");
  });
});
