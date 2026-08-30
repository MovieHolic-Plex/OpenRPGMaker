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
import {
  CONTRACT,
  cellChange,
  colorShares,
  headShares,
  relativeDeviation,
} from "../scripts/asset-gen/battlerIdleMetrics.mjs";
import { BATTLER_IDLE_ANIMATIONS, battlerIdleAnimation } from "@/assets/battlerIdleAnimations";
import { createBattleRuntime } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";

const ROOT = path.resolve(__dirname, "..");

/** 음성 픽스처의 실측값. 픽스처가 다른 그림으로 바뀌면 여기서 드러난다. */
const HEAD_TURNED_FIXTURE_HEAD = 1.941;
const HEAD_TURNED_FIXTURE_BODY = 0.125;

/** 카탈로그의 후면 항목 — 리소스 id 가 `-back` 으로 끝난다. */
const BACK_IDLE = BATTLER_IDLE_ANIMATIONS.filter((entry) => entry.resourceId.endsWith("-back"));


/**
 * 지표는 `scripts/asset-gen/battlerIdleMetrics.mjs` 의 **단일 정본**을 쓴다.
 *
 * 왜 테스트 안에 다시 쓰지 않는가 — 프레임 창을 고르는 CLI 도구가 계약과 다른 코드로 점수를
 * 내면 숫자가 어긋난다. 실측으로 그 대가를 치렀다: 파이썬 근사로 고른 창이 실제 패커 출력과
 * 달라(hero-04 0.087 대 0.125) 리뷰가 두 번 "집계가 다른 숫자"를 잡아냈다. 도구와 이 테스트가
 * 같은 파일을 import 하면 그 어긋남이 구조적으로 불가능해진다.
 */

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
        ).toBeLessThan(CONTRACT.colorRelativeCap);
      }
    }
  });

  /**
   * 이 계약이 재는 것은 **머리 영역의 색 구성**이고, 그것이 원본 뒷머리와 다르면 실패한다.
   * "얼굴 검출기"가 아니다 — 고개를 돌리면 잡히는 이유는 머리카락 지분이 무너지기
   * 때문이고(실측: 얼굴 구간 60~76 을 패킹하면 2.452, 주도 버킷은 `green` = 머리카락),
   * 머리색과 살색 대비가 약한 배틀러에서는 같은 포즈가 덜 두드러질 수 있다. 실제로 이
   * 계약이 실린 자산에서 잡아낸 결함은 머리띠에 생긴 **밝은 녹색 이물**이었다.
   *
   * 상한 1.0 의 두 방향 여유(같은 집계, 상단 30% 창):
   *   - 알려진 불량 1.941 → 상한의 **1.94배 위**(`1.941 / 1.0`)
   *   - 실린 칸 최악 0.665 → 상한의 **1.50배 아래**(`1.0 / 0.665`)
   * 즉 상한은 불량과 실린 값 사이에 있고, 어느 쪽에도 붙어 있지 않다. 머리 버킷 지분이
   * 작아(hero-04 머리의 녹색 2.9%) 상대편차가 본래 출렁이므로 전신 상한(0.15)보다
   * 느슨할 수밖에 없다.
   *
   * 상한이 나중에 슬그머니 올라가는 것은 **아래 음성 픽스처 테스트**가 막는다.
   */
  it("모든 칸의 머리 영역 구성이 원본 뒷머리와 같다", () => {
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
        ).toBeLessThanOrEqual(CONTRACT.headRelativeCap);
      }
    }
  });

  /**
   * **음성 픽스처.** 실린 칸만 검사하면 상한을 2.0 으로 올려도 테스트가 통과한다 — 계약이
   * 무엇을 떨어뜨리는지 CI 가 증명하지 못한다. 그래서 실제로 한 번 실렸던 결함 스트립
   * (고개가 돌아 귀·볼이 보이고 머리띠에 녹색 이물이 있던 hero-04)을 픽스처로 고정한다.
   *
   * 상한은 `CONTRACT.headRelativeCap` 하나를 양성·음성이 공유한다. 그 값을 픽스처 실측(1.941)
   * 이상으로 올리면 아래 `toBeGreaterThan` 이 깨진다 — 양성 쪽만 고쳐 빠져나갈 수 없다.
   * 동시에 **전신 색 계약은 이 픽스처를 통과한다**(0.125 < 0.15)는 것도 함께 못 박는다 —
   * 그게 머리 계약을 따로 세운 이유다.
   */
  it("고개가 돌아간 옛 스트립을 머리 계약이 떨어뜨린다 — 전신 색 계약은 통과시킨다", () => {
    const entry = BACK_IDLE.find((item) => item.resourceId === "generated-actor-hero-04-back");
    if (!entry) throw new Error("hero-04 후면 항목이 없다 — 이 픽스처가 의미를 잃었다");
    const source = PNG.sync.read(readFileSync(path.join(ROOT, "public", entry.path.replace("/idle/", "/"))));
    const defect = PNG.sync.read(
      readFileSync(path.join(ROOT, "test", "fixtures", "battler-idle", "hero-04-back-head-turned.png"))
    );
    const referenceHead = headShares(source, 0, source.width, source.height);
    const referenceBody = colorShares(source, 0, source.width, source.height);
    let worstHead = 0;
    let worstBody = 0;
    for (let index = 0; index < entry.frameCount; index += 1) {
      worstHead = Math.max(worstHead, relativeDeviation(headShares(defect, index, entry.cellWidth, entry.cellHeight), referenceHead));
      worstBody = Math.max(worstBody, relativeDeviation(colorShares(defect, index, entry.cellWidth, entry.cellHeight), referenceBody));
    }
    // 실측값을 못 박는다. 범위(`> CAP`)만 보면 픽스처를 1.05 짜리로 바꿔치기해도 초록이고,
    // 그다음 상한을 1.5 로 올리면 둘 다 살아남는다.
    expect(worstHead, "픽스처의 머리 편차 실측").toBeCloseTo(HEAD_TURNED_FIXTURE_HEAD, 2);
    expect(worstBody, "픽스처의 전신 색 편차 실측").toBeCloseTo(HEAD_TURNED_FIXTURE_BODY, 2);
    // 래칫: 상한을 픽스처 실측 이상으로 올리면 여기서 깨진다. 양성 테스트와 **같은 상수**를 본다.
    expect(
      worstHead,
      `머리 편차 ${worstHead.toFixed(3)} 가 상한 ${CONTRACT.headRelativeCap} 을 넘어야 한다 — 넘지 않으면 이 계약은 아무것도 막지 못한다`
    ).toBeGreaterThan(CONTRACT.headRelativeCap);
    // 전신 색 계약만으로는 못 잡는다 — 이 비대칭이 머리 계약의 존재 이유다.
    expect(
      worstBody,
      `전신 색 편차 ${worstBody.toFixed(3)} 는 상한 ${CONTRACT.colorRelativeCap} 을 넘지 않는다`
    ).toBeLessThan(CONTRACT.colorRelativeCap);
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
        ).toBeGreaterThanOrEqual(CONTRACT.minAdjacentChange);
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
        `${entry.resourceId}: 루프 이음매 ${(seam * 100).toFixed(1)}% 가 평소 최대 걸음 ${(widest * 100).toFixed(1)}% 의 ${CONTRACT.seamRatioCap}배를 넘는다 = 감길 때 튄다`
      ).toBeLessThanOrEqual(widest * CONTRACT.seamRatioCap);
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
