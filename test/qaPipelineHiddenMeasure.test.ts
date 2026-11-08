import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hiddenReason } from "../scripts/qa/pipeline/lib/hidden.mjs";
import { detectRun } from "../scripts/qa/pipeline/lib/detect.mjs";

// 왜: 폴른 스타 광범위 QA(큐 B3)가 픽셀 상점의 키 안내 「X/Esc 뒤로」를 「화면 밖」 결함으로 냈다. 그 줄은 픽셀 프리셋이
// 일부러 시각 숨김한 프롬프트 패널(1px·overflow hidden·clip-path inset(50%)) 안에 있다 — 엔진 결함이 아니라 하네스가
// 숨긴 요소를 잰 것이다(ultrabrain 판정). 숨긴 것은 재지 않고, 보이는 상자의 진짜 잘림은 계속 잡아야 한다.

type Node = { cls?: string; display?: string; visibility?: string; opacity?: string; clip?: string; clipPath?: string; overflow?: string; w?: number; h?: number };
const shown = (extra: Node = {}): Node => ({ cls: "", display: "block", visibility: "visible", opacity: "1", clip: "auto", clipPath: "none", overflow: "visible visible visible", w: 300, h: 40, ...extra });

describe("qa pipeline: 숨긴 요소는 재지 않는다", () => {
  it("픽셀 상점 프롬프트 패널 안의 키 안내(실측 rect 48,876)는 숨김이다", () => {
    const kbd = shown({ cls: "runtime-shop-key", display: "inline-block", w: 135, h: 56 });
    const hints = shown({ cls: "runtime-shop-keyhints", display: "flex", w: 600, h: 60 });
    const promptPanel = shown({ cls: "runtime-shop-window runtime-shop-prompt-panel", display: "grid", overflow: "hidden hidden hidden", clipPath: "inset(50%)", w: 1, h: 1 });
    const shell = shown({ cls: "runtime-shop-shell", w: 1440, h: 900 });
    expect(hiddenReason([kbd, hints, promptPanel, shell])).toBe("ancestor-clipped");
    expect(hiddenReason([kbd, hints, { ...promptPanel, clipPath: "none" }, shell])).toBe("ancestor-visually-hidden");
  });

  it("display:none·visibility·opacity·sr-only 는 자기든 조상이든 숨김이다", () => {
    expect(hiddenReason([shown(), shown({ display: "none" })])).toBe("display-none");
    expect(hiddenReason([shown({ visibility: "hidden" })])).toBe("visibility-hidden");
    expect(hiddenReason([shown(), shown({ opacity: "0" })])).toBe("opacity-0");
    expect(hiddenReason([shown(), shown({ cls: "label sr-only" })])).toBe("sr-only");
    expect(hiddenReason([shown({ clip: "rect(0px, 0px, 0px, 0px)" })])).toBe("self-clipped");
  });

  it("보이는 상자의 잘림·장식 clip-path 조상·스크롤 목록 조상은 숨김이 아니다", () => {
    const clippedName = shown({ overflow: "hidden hidden hidden", w: 120, h: 20 });
    expect(hiddenReason([clippedName, shown(), shown()])).toBeNull();
    expect(hiddenReason([clippedName, shown({ clipPath: "polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" })])).toBeNull();
    expect(hiddenReason([clippedName, shown({ clipPath: "inset(0px 4px)" })])).toBeNull();
    expect(hiddenReason([clippedName, shown({ overflow: "auto auto auto", w: 320, h: 200 })])).toBeNull();
    expect(hiddenReason([clippedName, shown({ overflow: "hidden hidden hidden", w: 1, h: 40 })])).toBeNull();
  });

  it("보이는 요소의 잘림은 감지기가 여전히 결함으로 낸다", () => {
    const job = { id: "j", slug: "g", version: "1", kind: "shop", input: "keyboard", viewportName: "desktop" };
    const overflow = [{ el: "span.runtime-shop-item-name", text: "아주 긴 장비 이름", clipsX: true, clipsY: false, ellipsis: false, offscreen: false, rect: [10, 20, 120, 20] }];
    const row = { seq: 1, file: "1.jpg", label: "shop", state: { screen: "shop" }, dom: { text: "", overflow }, errors: [], net: [] };
    expect(detectRun([{ job, summary: {}, rows: [row] }]).findings.map((f: { check: string }) => f.check)).toEqual(["text-clipped"]);
  });

  it("플레이어 측정은 이 규칙을 페이지에 그대로 주입해 쓴다", () => {
    const source = readFileSync(new URL("../scripts/qa/pipeline/vm/player.mjs", import.meta.url), "utf8");
    expect(source).toMatch(/import \{ hiddenReason \} from "\.\.\/lib\/hidden\.mjs"/);
    expect(source).toMatch(/__qaHiddenReason = \$\{hiddenReason\.toString\(\)\}/);
    expect(source).toMatch(/if \(window\.__qaHiddenReason\(chain\)\) continue;/);
  });
});
