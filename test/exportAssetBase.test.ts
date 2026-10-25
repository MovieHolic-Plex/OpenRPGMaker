import { describe, expect, it } from "vitest";
import { exportAssetBaseFor } from "@/player/exportAssetBase";

describe("exportAssetBaseFor", () => {
  it("reads public assets from the host root when the player lives in the hosted /export-player/ bundle", () => {
    expect(exportAssetBaseFor("http://mdc-server:9888/export-player/player.html?demo=fallen-star").href).toBe("http://mdc-server:9888/");
    expect(exportAssetBaseFor("http://h/sub/export-player/player.html").href).toBe("http://h/sub/");
  });

  it("keeps an exported game's assets next to its player.html", () => {
    expect(exportAssetBaseFor("http://127.0.0.1:4000/player.html").href).toBe("http://127.0.0.1:4000/");
    expect(exportAssetBaseFor("https://site/games/demo/player.html").href).toBe("https://site/games/demo/");
    expect(exportAssetBaseFor("file:///home/u/my-game/player.html").href).toBe("file:///home/u/my-game/");
    expect(exportAssetBaseFor("https://site/my-export-player/player.html").href).toBe("https://site/my-export-player/");
  });

  it("lets the editor combat probe climb out of the bundle folder", () => {
    expect(exportAssetBaseFor("http://h/bundle/player.html", { editorProbe: true }).href).toBe("http://h/");
  });
});
