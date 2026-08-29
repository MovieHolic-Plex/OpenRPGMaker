import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pictureZIndex } from "@/player/pictures/pictureTween";

// 픽처 슬롯의 z-index 는 CSS 가 아니라 JS 가 `20 + pictureZIndex(pictureId)` 로 인라인
// 지정한다(runtimeDom.syncPictureSlot). `.picture-layer` 에 스태킹 컨텍스트가 없으면 그 값이
// .play-stage 컨텍스트로 새어나가 pic20 이상이 대사창·HUD 를 덮는다. 컨텍스트는 position 이
// static 이 아니고 z-index 가 auto 가 아닐 때만 생기므로 둘을 함께 검사한다.

const ROOT = resolve(__dirname, "..");

function readCss(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!match) throw new Error(`규칙을 찾지 못했다: ${selector}`);
  return match[1]!;
}

function declaration(body: string, property: string): string | null {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(body);
  return match ? match[1]!.trim() : null;
}

function zIndexOf(css: string, selector: string): number {
  const raw = declaration(ruleBody(css, selector), "z-index");
  expect(raw, `${selector} 에 z-index 선언이 없다`).not.toBeNull();
  const parsed = Number(raw);
  expect(Number.isFinite(parsed), `${selector} 의 z-index 가 숫자가 아니다: ${raw}`).toBe(true);
  return parsed;
}

const picturesCss = readCss("src/styles/runtime/pictures.css");
const dialogueCss = readCss("src/styles/dialogue.css");
const actionHudCss = readCss("src/styles/runtime/actionHud.css");

describe("런타임 z-index 밴드 — 픽처 < 대사창 < HUD", () => {
  it(".picture-layer 는 스태킹 컨텍스트를 만든다(position + z-index)", () => {
    const body = ruleBody(picturesCss, ".picture-layer");
    const position = declaration(body, "position");
    expect(position).not.toBeNull();
    expect(position).not.toBe("static");
    expect(Number.isFinite(zIndexOf(picturesCss, ".picture-layer"))).toBe(true);
  });

  it("대사창은 픽처 레이어보다 위, action-hud 보다 아래다", () => {
    const picture = zIndexOf(picturesCss, ".picture-layer");
    const dialogue = zIndexOf(dialogueCss, ".dialogue-overlay");
    const hud = zIndexOf(actionHudCss, ".action-hud");

    expect(picture).toBeLessThan(dialogue);
    expect(dialogue).toBeLessThan(hud);
  });

  it("픽처 번호가 커도 밴드를 넘지 못한다", () => {
    const layer = zIndexOf(picturesCss, ".picture-layer");
    const dialogue = zIndexOf(dialogueCss, ".dialogue-overlay");
    const highestSlotZIndexWithoutContext = 20 + pictureZIndex("pic50");

    expect(highestSlotZIndexWithoutContext).toBeGreaterThan(dialogue);
    expect(layer).toBeLessThan(dialogue);
  });
});
