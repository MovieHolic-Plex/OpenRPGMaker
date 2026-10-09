import { describe, expect, it } from "vitest";
import { cssMixBlendMode, normalizeBlendMode, phaserBlendMode } from "@/project/blendMode";
import { PICTURE_BLEND_OPTIONS } from "@/project/eventCommands/easingOptions";
import { compileCutscene } from "@/editor/cutscene";

describe("겹치기 이름", () => {
  it("보통·모르는 값은 저장하지 않는다(옛 JSON 바이트 유지)", () => {
    expect(normalizeBlendMode("normal")).toBeUndefined();
    expect(normalizeBlendMode("overlay")).toBeUndefined();
    expect(normalizeBlendMode(undefined)).toBeUndefined();
    expect(normalizeBlendMode("add")).toBe("add");
  });

  it("Phaser·CSS 값으로 옮긴다", () => {
    expect([undefined, "normal", "add", "multiply", "screen"].map((name) => phaserBlendMode(name as never))).toEqual([0, 0, 1, 2, 3]);
    expect(cssMixBlendMode("add")).toBe("plus-lighter");
    expect(cssMixBlendMode("multiply")).toBe("multiply");
    expect(cssMixBlendMode(undefined)).toBe("normal");
  });

  it("그림 이동의 기본 선택지는 「그대로」 — 이동이 빛기둥을 보통으로 되돌리지 않는다", () => {
    expect(PICTURE_BLEND_OPTIONS[0]?.value).toBe("keep");
  });
});

describe("컷신 picture 비트의 겹치기", () => {
  it("show 는 showPicture.blendMode 로, 정리 단계는 마지막 겹치기를 다시 건다", () => {
    const commands = compileCutscene([
      { kind: "picture", action: "show", pictureId: "beam", resourceId: "img", blendMode: "add" },
      { kind: "picture", action: "move", pictureId: "beam", x: 40, durationMs: 300 },
      { kind: "say", speaker: "A", text: "빛이다" },
    ]);
    const shows = commands.filter((command) => command.kind === "showPicture");
    expect(shows[0]).toMatchObject({ pictureId: "beam", blendMode: "add" });
    // 이동은 겹치기를 생략했으므로 정리 단계의 재표시도 add 를 잇는다.
    expect(shows[shows.length - 1]).toMatchObject({ pictureId: "beam", blendMode: "add", durationMs: 0 });
  });

  it("normal 은 명령에 싣지 않는다", () => {
    const commands = compileCutscene([{ kind: "picture", action: "show", pictureId: "p", resourceId: "img", blendMode: "normal" }]);
    const show = commands.find((command) => command.kind === "showPicture");
    expect(show && "blendMode" in show).toBe(false);
  });
});
