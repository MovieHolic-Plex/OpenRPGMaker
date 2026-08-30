/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
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

/** 셀 하나의 알파 잉크 박스. 빈 칸(전부 투명)이면 null. */
function cellInkBox(
  png: PNG,
  cellIndex: number,
  cellWidth: number
): { x: number; y: number; w: number; h: number } | null {
  let minX = cellWidth;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const alpha = png.data[(y * png.width + cellIndex * cellWidth + x) * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function readPng(relativePath: string): PNG {
  return PNG.sync.read(readFileSync(path.join(ROOT, "public", relativePath)));
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

  it("모든 칸에 그림이 있고, 칸마다 실루엣이 실제로 움직인다", () => {
    for (const entry of BATTLER_IDLE_ANIMATIONS) {
      const png = readPng(entry.path);
      const boxes = Array.from({ length: entry.frameCount }, (_, index) =>
        cellInkBox(png, index, entry.cellWidth)
      );
      boxes.forEach((box, index) => {
        // 빈 칸은 재생 중 배틀러가 한 프레임 사라지는 것으로 보인다 — 폭 단언만으로는 안 잡힌다.
        expect(box, `${entry.resourceId}: 칸 ${index} 가 비어 있다`).not.toBeNull();
      });
      // 모든 칸이 픽셀 단위로 같으면 애니메이션이 아니라 같은 그림 N장이다.
      const signatures = new Set(boxes.map((box) => JSON.stringify(box)));
      expect(signatures.size, `${entry.resourceId}: 칸들이 전부 동일하다`).toBeGreaterThan(1);
    }
  });

  it("액터 스트립의 프레임 0 은 원본 시트의 idle 칸과 픽셀 단위로 같다", () => {
    // 감속 모드와 애니메이션 미지원 환경이 프레임 0 을 정지 화면으로 쓴다. 생성기가 프레임 0 을
    // 손보는 순간 그 환경의 그림이 조용히 바뀌므로 여기서 못 박는다.
    const sheetCell = BATTLER_IDLE_ANIMATIONS.filter((entry) => entry.tier === "sheet-cell");
    expect(sheetCell.length).toBeGreaterThan(0);
    for (const entry of sheetCell) {
      const strip = readPng(entry.path);
      const sourceName = entry.resourceId === "hero" ? "hero-01-battle" : entry.resourceId.replace("generated-actor-", "");
      const sheet = readPng(`assets/generated/starter/${sourceName}.png`);
      for (let y = 0; y < entry.cellHeight; y += 1) {
        for (let x = 0; x < entry.cellWidth; x += 1) {
          const fromStrip = (y * strip.width + x) * 4;
          const fromSheet = (y * sheet.width + x) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            expect(
              strip.data[fromStrip + channel],
              `${entry.resourceId}: 프레임 0 이 원본 idle 칸과 다르다 (${x},${y})`
            ).toBe(sheet.data[fromSheet + channel]);
          }
        }
      }
    }
  });

  it("영상 티어의 피크 실루엣이 정적 원본과 같은 크기다", () => {
    // 이 배율이 어긋나면 애니메이션이 켜진 몬스터만 화면에서 작아 보인다(실측으로 잡은 결함:
    // 프레임 전집합 대신 한 프레임에 맞추면 박쥐가 원본의 절반이 된다).
    // 개별 프레임은 모션이므로 좁을 수 있고, **피크**가 원본과 맞아야 한다.
    for (const entry of BATTLER_IDLE_ANIMATIONS.filter((item) => item.tier === "image-strip")) {
      const strip = readPng(entry.path);
      const source = readPng(entry.path.replace("/idle/", "/"));
      const sourceBox = cellInkBox(source, 0, source.width);
      const peakWidth = Math.max(
        ...Array.from({ length: entry.frameCount }, (_, index) => cellInkBox(strip, index, entry.cellWidth)?.w ?? 0)
      );
      expect(sourceBox).not.toBeNull();
      expect(
        peakWidth / entry.cellWidth,
        `${entry.resourceId}: 피크 실루엣 폭이 원본과 다르다`
      ).toBeCloseTo((sourceBox?.w ?? 0) / source.width, 1);
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

  it("idle→attack→idle 왕복과 dead(행 1) 에서 배경 좌표가 오염되지 않는다", () => {
    const node = actorSprite();
    const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite");
    applyBattlerPoseForTest(node, "idle");
    applyBattlerPoseForTest(node, "attack");
    applyBattlerPoseForTest(node, "idle");
    expect(sprite?.dataset.battlerAnim).toBe("generated-actor-hero-01-battle");
    expect(sprite?.style.backgroundImage).toContain("idle/hero-01-battle.png");
    expect(sprite?.style.backgroundSize).toBe("384px 96px");
    // dead 는 행 1 을 쓴다 — 애니메이션이 남기고 간 세로 오프셋이 살아 있으면 칸이 어긋난다.
    applyBattlerPoseForTest(node, "dead");
    expect(sprite?.dataset.battlerAnim).toBeUndefined();
    expect(sprite?.style.backgroundSize).toBe("288px 768px");
    expect(sprite?.style.backgroundPosition).toBe(
      `-${POSE_FRAME.dead.col * 96}px -${POSE_FRAME.dead.row * 96}px`
    );
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
    // 선언만 본다 — 주석에 `object-fit: contain` 이 설명으로 나온다.
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = declarations.slice(declarations.indexOf(".battle-enemy-image[data-battler-anim]"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("object-position: -99999px -99999px");
    // `object-fit` 을 여기서 바꾸려 들면 안 된다 — 스킨의 `contain` 규칙이 특정도로 이긴다.
    // 숨김은 `object-position` 하나에만 의존한다는 것이 계약이다.
    expect(body).not.toContain("object-fit");
  });

  it("칸의 종횡비를 지킨다 (상자 종횡비로 늘리지 않는다)", () => {
    // 세로를 `100%` 로 묶으면 정사각 칸이 상자(적 56×64)에 맞춰 늘어나, 정적 경로의
    // `object-fit: contain` 레터박스와 다른 그림이 된다.
    expect(css).toContain("background-size: calc(100% * var(--battler-anim-frames)) auto");
    expect(css).not.toContain("background-size: calc(100% * var(--battler-anim-frames)) 100%");
  });

  it("죽은 배틀러는 숨을 쉬지 않는다", () => {
    const dead = css.slice(css.indexOf(".battle-pose-dead .battle-enemy-image[data-battler-anim]"));
    expect(dead.slice(0, dead.indexOf("}"))).toMatch(/animation:\s*none/);
  });

  it("감속·고대비·인쇄에서 <img> 배틀러는 정적 src 로 되돌아간다", () => {
    // 영상 티어의 프레임 0 은 원본과 다른 순간이라, 멈추는 것만으로는 이전 화면이 되지 않는다.
    const query = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce), (forced-colors: active), print"));
    const block = query.slice(0, query.indexOf("\n}"));
    expect(block).toContain(".battle-enemy-image[data-battler-anim]");
    expect(block).toContain("object-position: 50% 50%");
    expect(block).toMatch(/background-image:\s*none/);
    expect(block).toMatch(/animation:\s*none/);
  });

  it("48px 시트 액터는 감속 모드에서 첫 칸에 멈춘다", () => {
    // 이 티어의 프레임 0 은 원본 idle 칸과 픽셀 단위로 같다(위 계약).
    const query = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {"));
    expect(query).toContain(".battle-actor-sprite[data-battler-anim]");
    expect(query).toContain("background-position-x: 0px");
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
