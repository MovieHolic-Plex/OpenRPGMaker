// @vitest-environment happy-dom
// 뒷모습(후면) 배틀러의 idle 애니메이션 계약.
//
// 왜 별도 파일인가: 후면 배틀러는 앞서 실은 두 티어와 **표시 상자가 다르다**. 포켓몬 스킨의
// 아군 뒷모습 상자는 `145px × 140px`(`_battlers.css` 의 1:1 대치 크기)로 **가로가 세로보다 크다**.
// 앞선 티어들의 상자(적 56×64, 정면 액터 정사각)는 모두 세로 ≥ 가로였고, 가로를 상자폭에 묶는
// `background-size: calc(100% * N) auto` 산식이 그 전제 위에서 `contain` 과 같은 표시가 됐다.
// 가로 > 세로인 상자에서는 그 산식이 칸을 상자 높이보다 크게 만들어 위아래를 잘라낸다.
// 그래서 이 티어는 **셀 종횡비를 표시 상자에 맞춰 굽는다**. 재생 CSS 에 새 변수를 넣지 않는다 —
// 칸을 상자 비율로 구워두면 기존 `background-size: calc(100% * N) auto` 산식이 그대로 맞는다.
//
// 검사하는 것:
//  1. 카탈로그 항목이 실제 PNG 격자와 맞는가(칸 수 × 칸 크기 = 파일 크기).
//  2. 프레임마다 실루엣이 움직이고 빈 칸이 없는가.
//  3. 피크 실루엣이 정적 원본과 같은 크기인가 — 애니메이션만 커지거나 작아지면 안 된다.
//  4. 후면 구도(`partyFacing="back"`)에서 그 `<img>` 에 애니메이션이 실제로 배선되는가.
//  5. 등록되지 않은 뒷모습은 정적 이미지 그대로인가(폴백).
//  6. `<img>`·`src` 계약이 유지되는가 — 애니메이션이 붙어도 `src` 는 정적 원본이다.
//  7. **감속 모드·사망 포즈에서 멈추는가.** 이 티어는 자기 클래스(`.battle-skin-actor-image`)가
//     아니라 함께 붙는 `.battle-actor-image` 로 기존 접근성 규칙에 얹혀 있다. 기존 계약은 그
//     블록에 `.battle-enemy-image` 만 들어있는지 보고 있어서, `.battle-actor-image` 를 빼도
//     테스트가 초록인 채로 뒷모습만 계속 돌아간다 — 그 빈틈을 여기서 막는다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { BATTLER_IDLE_ANIMATIONS, battlerIdleAnimation } from "@/assets/battlerIdleAnimations";
import { createBattleRuntime } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";

const ROOT = path.resolve(__dirname, "..");

/** 카탈로그의 후면 항목 — 리소스 id 가 `-back` 으로 끝난다. */
const BACK_IDLE = BATTLER_IDLE_ANIMATIONS.filter((entry) => entry.resourceId.endsWith("-back"));


/**
 * 피사체 픽셀을 색 계열별 비율로 요약한다.
 *
 * 조명·압축 변화에는 둔감하고 **재색칠**에는 민감한 지표가 필요하다. 영상 모델은 클립이
 * 진행되며 의상 색을 흘린다 — 실측: hero-01 의 파란 튜닉이 클립 후반에 갈색으로 바뀌었고,
 * 초기 패킹이 그 갈색 프레임을 골라 "다른 옷을 입은 주인공"이 실릴 뻔했다. 색 집합 비교
 * (팔레트 포함 여부)로는 안 잡힌다 — 방패·검에 이미 파란 계열이 있어서 1% 차이로 묻힌다.
 */
function colorShares(png: PNG, cellIndex: number, cellWidth: number, cellHeight: number): number[] {
  let blue = 0;
  let red = 0;
  let green = 0;
  let warm = 0;
  let bright = 0;
  let dark = 0;
  let lumaSum = 0;
  let total = 0;
  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const i = (y * png.width + cellIndex * cellWidth + x) * 4;
      if (png.data[i + 3] <= 8) continue;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      total += 1;
      const isBlue = b - r > 30 && b - g > 30;
      const isRed = r - b > 40 && r - g > 25;
      const isGreen = g - r > 12 && g - b > 12;
      if (isBlue) blue += 1;
      else if (isRed) red += 1;
      else if (isGreen) green += 1;
      else if (r - b > 15) warm += 1;
      const mean = (r + g + b) / 3;
      if (mean > 170 && !isBlue && !isRed && !isGreen) bright += 1;
      if (mean < 60) dark += 1;
      lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  if (total === 0) return [0, 0, 0, 0, 0, 0, 0];
  return [...[blue, red, green, warm, bright, dark].map((count) => count / total), lumaSum / total / 255];
}

/**
 * 원본에서 **존재감 있는**(≥2%) 성분의 **상대** 변화 최대값.
 *
 * 절대 편차로 재면 원본에서 지분이 작은 성분이 사라지는 걸 놓친다. 실측: hero-04 의 클립은
 * 갈색 두건 망토가 자라 녹색 튜닉을 덮었는데, 녹색이 피사체의 8% 라 절반이 덮여도 절대 편차는
 * 0.035 였다 — 상한 0.08 을 여유롭게 통과한다. 상대로 보면 0.42 로 드러난다.
 * 실측 분리도: 충실한 칸 0.03~0.10 / 망토가 덮인 칸 0.42 / 갈색 튜닉으로 바뀐 칸 0.999.
 */
function relativeDeviation(frame: number[], reference: number[]): number {
  let worst = 0;
  for (let k = 0; k < reference.length; k += 1) {
    if (reference[k] < 0.02) continue;
    worst = Math.max(worst, Math.abs(frame[k] - reference[k]) / reference[k]);
  }
  return worst;
}

/** 알파가 있는 픽셀의 경계 상자 — 머리 영역을 피사체 기준으로 잡기 위해 필요하다. */
function subjectBox(png: PNG, cellIndex: number, cellWidth: number, cellHeight: number) {
  let top = cellHeight;
  let bottom = -1;
  let left = cellWidth;
  let right = -1;
  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      if (png.data[(y * png.width + cellIndex * cellWidth + x) * 4 + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { top, bottom, left, right };
}

/**
 * **머리 영역만** 같은 7버킷으로 잰다(피사체 상단 30%).
 *
 * 왜 전신 지표로 부족한가 — 실측: hero-04 의 3차 클립은 의상은 지켰지만 **고개를 돌려 얼굴을
 * 보였다**. 뒷모습 배틀러에서는 색 드리프트보다 나쁜 결함인데, 머리는 피사체의 일부라
 * 전신 상대편차가 0.125 로 통과했다. 같은 지표를 머리 영역에 걸면 1.941 로 드러난다.
 *
 * 실측 분리도: 실린 칸 0.167 / 0.337 / 0.526 / 0.665 대 고개 돌린 칸 1.941.
 */
function headShares(png: PNG, cellIndex: number, cellWidth: number, cellHeight: number): number[] {
  const { top, bottom, left, right } = subjectBox(png, cellIndex, cellWidth, cellHeight);
  if (bottom < 0) return [0, 0, 0, 0, 0, 0, 0];
  const headEnd = top + Math.round((bottom - top) * 0.3);
  let blue = 0;
  let red = 0;
  let green = 0;
  let warm = 0;
  let bright = 0;
  let dark = 0;
  let lumaSum = 0;
  let total = 0;
  for (let y = top; y <= headEnd; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const i = (y * png.width + cellIndex * cellWidth + x) * 4;
      if (png.data[i + 3] <= 8) continue;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      total += 1;
      const isBlue = b - r > 30 && b - g > 30;
      const isRed = r - b > 40 && r - g > 25;
      const isGreen = g - r > 12 && g - b > 12;
      if (isBlue) blue += 1;
      else if (isRed) red += 1;
      else if (isGreen) green += 1;
      else if (r - b > 15) warm += 1;
      const mean = (r + g + b) / 3;
      if (mean > 170 && !isBlue && !isRed && !isGreen) bright += 1;
      if (mean < 60) dark += 1;
      lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  if (total === 0) return [0, 0, 0, 0, 0, 0, 0];
  return [...[blue, red, green, warm, bright, dark].map((count) => count / total), lumaSum / total / 255];
}

/** 두 칸의 픽셀 변화 비율 — 색 채널 합 차가 24를 넘는 픽셀. */
function cellChange(png: PNG, a: number, b: number, cellWidth: number, cellHeight: number): number {
  let changed = 0;
  let total = 0;
  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const ia = (y * png.width + a * cellWidth + x) * 4;
      const ib = (y * png.width + b * cellWidth + x) * 4;
      total += 1;
      const diff =
        Math.abs(png.data[ia] - png.data[ib]) +
        Math.abs(png.data[ia + 1] - png.data[ib + 1]) +
        Math.abs(png.data[ia + 2] - png.data[ib + 2]) +
        Math.abs(png.data[ia + 3] - png.data[ib + 3]);
      if (diff > 24) changed += 1;
    }
  }
  return total === 0 ? 0 : changed / total;
}

function renderBackField(battleCharacterResourceId: string): HTMLElement {
  const project = deserialize(JSON.stringify(battleFixture));
  // 포켓몬 스킨이 아군을 후면 구도로 세운다.
  (project.system as { battleUiStyle?: string }).battleUiStyle = "pokemon";
  store.replace(project);
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    rng: () => 0.5,
  });
  const snapshot = runtime.snapshot();
  (snapshot.actors[0] as { battleCharacterResourceId?: string }).battleCharacterResourceId =
    battleCharacterResourceId;
  return battleField(snapshot);
}

function backImage(field: HTMLElement): HTMLImageElement | null {
  return field.querySelector<HTMLImageElement>(".battle-actor-group .battle-actor-image");
}

describe("후면 배틀러 idle — 카탈로그와 그림", () => {
  it("후면 항목이 등록되어 있다", () => {
    expect(BACK_IDLE.length).toBeGreaterThan(0);
    for (const entry of BACK_IDLE) {
      expect(entry.resourceId).toMatch(/^generated-actor-hero-0\d-back$/);
      expect(entry.tier).toBe("image-strip");
      expect(entry.frameCount).toBeGreaterThan(1);
    }
  });

  // 격자 정합·빈 칸 없음·프레임 간 픽셀 변화·피크 실루엣은 `battlerIdleAnimation.test.ts` 의
  // 카탈로그 절이 **전 항목을 돌면서** 본다(후면 항목도 그 루프에 들어간다). 여기서는 후면
  // 티어 고유 계약만 본다.

  it("모든 칸이 정적 원본과 같은 옷을 입고 있다", () => {
    // 이 계약이 없으면 색이 흐른 프레임을 골라도 조용히 통과한다(실측: 갈색으로 바뀐 튜닉,
    // 녹색 튜닉을 덮은 갈색 망토).
    for (const entry of BACK_IDLE) {
      const source = PNG.sync.read(readFileSync(path.join(ROOT, "public", entry.path.replace("/idle/", "/"))));
      const reference = colorShares(source, 0, source.width, source.height);
      const strip = PNG.sync.read(readFileSync(path.join(ROOT, "public", entry.path)));
      for (let index = 0; index < entry.frameCount; index += 1) {
        const frame = colorShares(strip, index, entry.cellWidth, entry.cellHeight);
        const deviation = relativeDeviation(frame, reference);
        // 0.15 는 불량 쪽에서 정했다. 실린 칸 전 칸 worst 0.071/0.075/0.080/0.092,
    // 망토가 덮인 칸 0.42, 갈색 튜닉으로 바뀐 칸 0.999 — 가장 가까운 불량과 2.8배 떨어진다.
        expect(
          deviation,
          `${entry.resourceId}: 칸 ${index} 의 색 분포가 원본에서 상대 ${(deviation * 100).toFixed(0)}% 벗어났다 = 다른 옷이다`
        ).toBeLessThan(0.15);
      }
    }
  });

  /**
   * 상한 1.0 은 **불량 쪽에서** 정했다. 실린 칸의 최악이 0.665, 고개를 돌린 칸이 1.941 이라
   * 1.0 은 알려진 불량보다 1.94배 아래에 있다. 머리 버킷 지분이 작아(hero-04 는 머리의
   * 녹색이 2.9%) 상대편차가 본래 출렁이므로 전신 상한(0.15)보다 느슨할 수밖에 없다.
   */
  it("모든 칸이 뒷모습을 유지한다 — 고개를 돌려 얼굴을 보이면 실패한다", () => {
    for (const entry of BACK_IDLE) {
      const source = PNG.sync.read(readFileSync(path.join(ROOT, "public", entry.path.replace("/idle/", "/"))));
      const referenceHead = headShares(source, 0, source.width, source.height);
      const strip = PNG.sync.read(readFileSync(path.join(ROOT, "public", entry.path)));
      for (let index = 0; index < entry.frameCount; index += 1) {
        const frame = headShares(strip, index, entry.cellWidth, entry.cellHeight);
        const deviation = relativeDeviation(frame, referenceHead);
        expect(
          deviation,
          `${entry.resourceId}: 칸 ${index} 의 머리가 원본과 다르다 (상대 ${deviation.toFixed(3)}) = 고개를 돌렸거나 머리 장식이 바뀌었다`
        ).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it("인접한 모든 칸이 실제로 움직인다 — 한 쌍만 움직이는 정지화면을 막는다", () => {
    // **최소값**으로 재야 한다. 최대값으로 재면 8칸 중 한 쌍만 움직여도 통과한다 —
    // 실측: 초기 hero-01 패킹은 최대 1.9% 였지만 최소 0.01% 로 사실상 정지화면이었고,
    // CSS `steps()` 는 같은 그림 위에서도 배경 위치를 옮기므로 런타임 검사로도 안 잡힌다.
    for (const entry of BACK_IDLE) {
      const strip = PNG.sync.read(readFileSync(path.join(ROOT, "public", entry.path)));
      for (let index = 1; index < entry.frameCount; index += 1) {
        const change = cellChange(strip, index - 1, index, entry.cellWidth, entry.cellHeight);
        expect(
          change,
          `${entry.resourceId}: 칸 ${index - 1}→${index} 가 ${(change * 100).toFixed(2)}% 만 달라졌다 = 멈춘 프레임 쌍이다`
        ).toBeGreaterThanOrEqual(0.02);
      }
    }
  });

  it("루프 이음매가 평소 한 걸음보다 크게 튀지 않는다", () => {
    // 마지막 칸 → 첫 칸 변화를 **절대값**으로 재면 진폭이 큰 모션을 부당하게 떨어뜨린다
    // (실측: hero-03 은 이음매 9.6% 지만 평소 걸음이 14.8% 라 눈에 안 띈다). 걸음 대비로 본다.
    for (const entry of BACK_IDLE) {
      const strip = PNG.sync.read(readFileSync(path.join(ROOT, "public", entry.path)));
      const steps: number[] = [];
      for (let index = 1; index < entry.frameCount; index += 1) {
        steps.push(cellChange(strip, index - 1, index, entry.cellWidth, entry.cellHeight));
      }
      const seam = cellChange(strip, entry.frameCount - 1, 0, entry.cellWidth, entry.cellHeight);
      const widest = Math.max(...steps);
      expect(
        seam,
        `${entry.resourceId}: 루프 이음매 ${(seam * 100).toFixed(1)}% 가 평소 최대 걸음 ${(widest * 100).toFixed(1)}% 의 1.5배를 넘는다 = 감길 때 튄다`
      ).toBeLessThanOrEqual(widest * 1.5);
    }
  });

  it("칸의 종횡비가 표시 상자와 같다 — 가로가 더 넓은 상자에서 잘리지 않게", () => {
    // 포켓몬 아군 뒷모습 상자는 145×140 이라 가로가 더 넓다. 칸을 정사각으로 두면
    // 가로를 상자폭에 묶는 산식이 칸 높이를 상자보다 크게 만들어 머리·발을 잘라낸다.
    const css = readFileSync(path.join(ROOT, "src/styles/runtime/battle-skins/_battlers.css"), "utf8");
    const box = /\.battle-scene\[data-battle-skin="pokemon"\][^{]*\.battle-skin-actor-image\s*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/;
    const match = css.match(new RegExp(box.source, "g"))?.map((rule) => rule.match(box)).at(-1);
    expect(match, "포켓몬 아군 상자 크기 규칙을 못 찾았다").toBeTruthy();
    const boxAspect = Number(match?.[1]) / Number(match?.[2]);
    for (const entry of BACK_IDLE) {
      expect(
        entry.cellWidth / entry.cellHeight,
        `${entry.resourceId}: 칸 종횡비가 표시 상자(${match?.[1]}×${match?.[2]})와 다르다`
      ).toBeCloseTo(boxAspect, 2);
    }
  });
});

describe("후면 배틀러 idle — 접근성", () => {
  const css = readFileSync(path.join(ROOT, "src/styles/runtime/battle-skins/_battlers.css"), "utf8");

  /** 헤더로 시작하는 `@media` 블록 본문을 중괄호 균형으로 뜬다. */
  function mediaBlock(header: string): string {
    const at = css.indexOf(header);
    expect(at, `${header} 블록을 못 찾았다`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = css.indexOf("{", at); i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(at, i + 1);
      }
    }
    throw new Error(`${header} 블록의 중괄호가 안 닫힌다`);
  }

  it("감속·고대비·인쇄에서 뒷모습 배틀러도 정적 src 로 되돌아간다", () => {
    const block = mediaBlock("@media (prefers-reduced-motion: reduce), (forced-colors: active), print");
    // 뒷모습 `<img>` 는 `battle-actor-image battle-skin-actor-image` 두 클래스를 함께 단다
    // (`battleFieldDom.ts`). 이 선택자가 빠지면 감속 모드에서 뒷모습만 계속 돈다.
    expect(block, "감속 모드 블록이 .battle-actor-image 를 덮지 않는다 = 뒷모습이 계속 돈다").toContain(
      ".battle-actor-image[data-battler-anim]"
    );
    expect(block).toMatch(/animation:\s*none/);
    expect(block).toMatch(/background-image:\s*none/);
  });

  it("사망 포즈에서 뒷모습 배틀러의 애니메이션이 멈춘다", () => {
    // 죽은 배틀러가 숨을 쉬면 안 된다. 이 규칙도 `.battle-actor-image` 로 얹혀 있다.
    const at = css.indexOf(".battle-pose-dead .battle-enemy-image[data-battler-anim]");
    expect(at, "사망 포즈 정지 규칙을 못 찾았다").toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at) + 1);
    expect(rule, "사망 포즈 정지 규칙이 .battle-actor-image 를 덮지 않는다").toContain(
      ".battle-actor-image[data-battler-anim]"
    );
    expect(rule).toMatch(/animation:\s*none/);
  });
});

describe("후면 배틀러 idle — DOM 배선", () => {
  it("후면 구도의 뒷모습 <img> 에 애니메이션이 붙는다", () => {
    for (const entry of BACK_IDLE) {
      const slug = entry.resourceId.replace("generated-actor-", "").replace("-back", "");
      const field = renderBackField(`generated-actor-${slug}-battle`);
      const image = backImage(field);
      // 접근성 규칙(감속·사망)이 `.battle-actor-image` 로 걸려 있으므로 두 클래스가 함께 붙어야
      // 한다. 한쪽만 남으면 규칙이 빗나가고 뒷모습만 계속 돈다.
      expect(image?.classList.contains("battle-actor-image"), "감속 규칙이 빗나간다").toBe(true);
      expect(image?.classList.contains("battle-skin-actor-image")).toBe(true);
      expect(image, `${slug}: 뒷모습 이미지가 없다`).not.toBeNull();
      expect(image?.dataset.battlerAnim, `${slug}: 애니메이션이 배선되지 않았다`).toBe(entry.resourceId);
      expect(image?.style.getPropertyValue("--battler-anim-frames")).toBe(String(entry.frameCount));
      expect(image?.style.getPropertyValue("--battler-anim-url")).toContain(entry.path);
      // `src` 는 정적 원본 그대로 — 애니메이션 CSS 가 없는 환경의 폴백이다.
      expect(image?.getAttribute("src")).toBe(`/assets/generated/battle-skins/sprites/${slug}-back.png`);
      expect(image?.tagName).toBe("IMG");
    }
  });

  it("등록되지 않은 뒷모습은 정적 이미지 그대로다", () => {
    // hero-05/06 은 카탈로그에 없다면 애니메이션이 붙지 않아야 한다(옵트인).
    const unregistered = ["hero-05", "hero-06"].filter(
      (slug) => !battlerIdleAnimation(`generated-actor-${slug}-back`)
    );
    expect(unregistered.length, "이 테스트는 미등록 뒷모습이 하나라도 있을 때 의미가 있다").toBeGreaterThan(0);
    for (const slug of unregistered) {
      const image = backImage(renderBackField(`generated-actor-${slug}-battle`));
      expect(image?.dataset.battlerAnim, `${slug}: 등록도 안 했는데 애니메이션이 붙었다`).toBeUndefined();
      expect(image?.getAttribute("src")).toBe(`/assets/generated/battle-skins/sprites/${slug}-back.png`);
    }
  });
});
