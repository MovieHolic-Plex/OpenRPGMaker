import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("touch controls over runtime modal surfaces", () => {
  it("hides the touch pad while the player status menu is open", async () => {
    const css = await readFile(resolve("src/styles/runtime/touchpad.css"), "utf8");

    expect(css).toMatch(
      /\.play-stage:has\(\[data-testid=["']main-menu["']\]\)\s*>\s*\.touch-pad\s*\{[^}]*visibility:\s*hidden/s,
    );
  });

  it("keeps status-menu copy legible and all four life-ledger labels visible", async () => {
    const titleCss = await readFile(resolve("src/styles/database/tabs-b-title-screen.css"), "utf8");
    const detailCss = await readFile(resolve("src/styles/database/tabs-b-status-menu-main.css"), "utf8");

    expect(titleCss).toMatch(
      /\.oprn-status-menu\.main-menu\s*\{[^}]*color:\s*var\(--oprn-status-text\)/s,
    );
    // 6px 에서 8px 로 올렸다. 이 테스트가 지키려는 것은 "네 라벨이 모두 보인다"
    // 와 "읽힌다"이지 특정 수치가 아니다. ESC 메뉴는 Galmuri 픽셀 폰트를 쏘다지만
    // Galmuri 의 설계 그리드는 8px 단위라 6px 에선 글자가 그리드를 벗어나 뿉개진다.
    // 사용자가 직접 지봐한 결함도 "메뉴 폰트가 4~7px 로 자잔해 시스템과 동동 뜨있다"여서,
    // 6px 을 고정하는 것은 그 결함을 법으로 박는 짓이 된다. 네 라벨이 4칸에
    // 여전히 들어가는지는 test/e2e/_measure-esc-fit.spec.ts 가 재서 직접 검증한다.
    expect(detailCss).toMatch(/\.life-ledger-tab\s*\{[^}]*font-size:\s*8px/s);
  });
});
