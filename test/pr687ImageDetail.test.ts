import { describe, expect, it } from "vitest";
import { convertUserContent } from "../scripts/lib/ohMyPiUserContent";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
describe("PR687 provider image contract composition", () => {
  it.each(["auto", "low", "high"])("preserves %s detail and exact validated bytes", detail => {
    expect(convertUserContent([{ type: "image_url", image_url: { url: `data:image/png;base64,${png}`, detail } }], true))
      .toEqual([{ type: "image", data: png, mimeType: "image/png", detail }]);
  });
  it("rejects invalid detail before provider transport while retaining MIME validation", () => {
    expect(() => convertUserContent([{ type: "image_url", image_url: { url: `data:image/png;base64,${png}`, detail: "invalid" } }], true)).toThrow();
    expect(() => convertUserContent([{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${png}`, detail: "high" } }], true)).toThrow();
  });
});
