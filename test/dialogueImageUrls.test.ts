// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";
import { createDialogueUI } from "@/player/dialogue";

const resourceId = "easyrpg-faceset-people1-06";
const assetPath = "/assets/easyrpg/faceset/People1/06.png";
const inlinePng = `data:image/png;base64,${readFileSync(`public${assetPath}`).toString("base64")}`;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.replaceChildren();
});

afterEach(() => {
  registerExportAssetBase(null);
  registerInlineAssets(null);
  vi.useRealTimers();
  document.body.replaceChildren();
});

async function renderPortrait() {
  const host = document.createElement("div");
  document.body.append(host);
  const dialogue = createDialogueUI(host);
  const shown = dialogue.showText({
    face: { resourceId }, body: "A", playerTileY: 0, mapHeight: 20,
    reducedMotion: true,
  });
  // Real input skips typing synchronously; no clock-dependent readiness wait.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  const face = host.querySelector<HTMLElement>('[data-testid="dialogue-face"]');
  const ready = host.querySelector(".dialogue-box")?.classList.contains("page-ready");
  // Always remove the document key listener, including on assertion failure.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  await shown;
  dialogue.hide();
  return { face, ready };
}

describe("dialogue portrait resource resolution", () => {
  it.each([
    { name: "editor root", base: null, inline: false, expected: assetPath },
    { name: "HTTP root export", base: "http://127.0.0.1:42873/", inline: false,
      expected: `http://127.0.0.1:42873${assetPath}` },
    { name: "HTTPS nested export", base: "https://games.example.test/games/demo/", inline: false,
      expected: `https://games.example.test/games/demo${assetPath}` },
    { name: "encoded deployment subpath", base: "https://games.example.test/my game/마을/", inline: false,
      expected: `https://games.example.test/my%20game/%EB%A7%88%EC%9D%84${assetPath}` },
    { name: "inline export", base: "file:///games/demo/", inline: true, expected: inlinePng },
  ])("renders the compiled chief portrait through $name", async ({ base, inline, expected }) => {
    // Given: the real resource resolver and export registration, not mocked URLs.
    registerExportAssetBase(base === null ? null : new URL(base));
    if (inline) registerInlineAssets({ [assetPath.slice(1)]: inlinePng });

    // When
    const { face, ready } = await renderPortrait();

    // Then
    expect(ready).toBe(true);
    expect(face?.classList.contains("dialogue-face-image")).toBe(true);
    expect(face?.classList.contains("missing")).toBe(false);
    expect(face?.style.getPropertyValue("--face-url")).toBe(`url("${expected}")`);
    expect(face?.style.getPropertyValue("--face-width")).toBe("48px");
    expect(face?.style.getPropertyValue("--face-height")).toBe("48px");
  });

  it.each([
    "javascript:alert(1)", "vbscript:msgbox(1)", "file:///assets/face.png",
    "ftp://example.test/face.png", "blob:https://example.test/face.png",
    "data:image/svg+xml;base64,PHN2Zy8+", "data:audio/ogg;base64,AQ==",
    "https://example.test/face.svg", "https://example.test/face.ogg",
    'https://example.test/face.png");color:red;--x:url("face.png',
    "https://example.test/face\\.png", "https://example.test/face\n.png",
    "https://[invalid/face.png",
  ])("keeps invalid image URLs rejected: %s", async (url) => {
    // Given: exercise the resolver's inline boundary, including non-image resources.
    registerInlineAssets({ [assetPath.slice(1)]: url });

    // When
    const { face, ready } = await renderPortrait();

    // Then
    expect(ready).toBe(true);
    expect(face?.classList.contains("missing")).toBe(true);
    expect(face?.style.getPropertyValue("--face-url")).toBe("");
  });
});
