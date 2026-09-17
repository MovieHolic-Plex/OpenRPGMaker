import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 편집기 z 층 순서 계약.
 *
 * 왜 필요한가 (실측): PR #308 이 `--z-toast` 를 2700 으로 올려 앱 모달(2600)과 AI 넓은 비교
 * 오버레이(2620) 위에 놓았다. 그런데 이 순서를 지키는 테스트가 하나도 없었다 —
 * `test/runtimePictureStacking.test.ts` 는 `.play-stage` 안의 런타임 밴드만 재고 편집기 토큰은
 * 보지 않는다. 즉 다음 편집이 2500/2600/2620/2700 을 조용히 뒤집어도 게이트가 전부 초록이다.
 *
 * 토스트가 앱 모달 아래로 내려가면 «시작 전 자동 복구» 같은 알림이 다시 보이지 않게 되는데,
 * 그게 정확히 #308 이 고친 결함이다. 눈에 안 보이는 알림은 없는 알림이다.
 */

const ROOT = resolve(__dirname, "..");

function tokenValue(css: string, name: string): number {
  const match = new RegExp(`--${name}:\\s*(\\d+)`).exec(css);
  if (!match) throw new Error(`토큰 --${name} 을 tokens.css 에서 찾지 못했다`);
  return Number(match[1]);
}

describe("편집기 z 층 순서", () => {
  const tokens = readFileSync(resolve(ROOT, "src/styles/tokens.css"), "utf8");

  it("토스트가 앱 모달보다 위다 — 모달 위에서도 알림이 보여야 한다", () => {
    expect(tokenValue(tokens, "z-toast")).toBeGreaterThan(tokenValue(tokens, "z-app-modal"));
  });

  it("앱 모달이 제안 패널보다 위다", () => {
    expect(tokenValue(tokens, "z-app-modal")).toBeGreaterThan(tokenValue(tokens, "z-proposal"));
  });

  it("토스트가 AI 넓은 비교 오버레이(app-modal + 20)보다 위다", () => {
    // 19-assistant-cards.css(넓은 비교 뷰어)가 calc(var(--z-app-modal) + 20) 을 쓴다.
    const wideOverlay = tokenValue(tokens, "z-app-modal") + 20;
    expect(tokenValue(tokens, "z-toast")).toBeGreaterThan(wideOverlay);
  });

  it("그 계산식이 여전히 app-modal 기준이다 — 하드코딩으로 바뀌면 위 단정이 거짓이 된다", () => {
    const wide = readFileSync(
      resolve(ROOT, "src/styles/database/tabs-b-assistant-panel/19-assistant-cards.css"),
      "utf8",
    );
    expect(wide).toContain("calc(var(--z-app-modal) + 20)");
  });

  /* 브라우저 실측(2026-09-10, verify-shots/oprn-024/09-tileset-editor-*.png): 지연 툴팁이
     z-index 400 이라 데이터베이스 모달(2600) 안 타일셋 편집기 컨트롤의 툴팁이 모달 뒤에
     그려져 화면에 보이지 않았다. 롤아웃 14개 중 5개가 그 모달 안에 있다. */
  it("지연 툴팁이 앱 모달과 넓은 비교 오버레이보다 위다 — 모달 안 컨트롤도 툴팁이 보여야 한다", () => {
    expect(tokenValue(tokens, "z-tooltip")).toBeGreaterThan(tokenValue(tokens, "z-app-modal") + 20);
  });

  it("지연 툴팁은 토스트보다 아래다 — 알림이 툴팁에 가리지 않는다", () => {
    expect(tokenValue(tokens, "z-tooltip")).toBeLessThan(tokenValue(tokens, "z-toast"));
  });

  it("툴팁 CSS 가 하드코딩 대신 그 토큰을 쓴다", () => {
    const tooltipCss = readFileSync(resolve(ROOT, "src/styles/map/delayed-tooltip.css"), "utf8");
    expect(tooltipCss).toContain("z-index: var(--z-tooltip)");
  });

  it("런타임 밴드는 편집기 토큰과 다른 자리다 — 세 자리 아래를 유지한다", () => {
    // .play-stage 안쪽 밴드(26~45)와 편집기 토큰(2100~2700)이 섞이면 서로를 가린다.
    expect(tokenValue(tokens, "z-proposal")).toBeGreaterThan(100);
  });
});
