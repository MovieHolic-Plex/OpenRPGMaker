import { describe, expect, it } from "vitest";
import {
  RECOLLECTION_BGM_ID,
  RECOLLECTION_PICTURE_ID,
  recollectionBeats,
} from "@/editor/recollectionBeats";

describe("recollectionBeats", () => {
  it("페이드·틴트·회상 BGM·그림·대사·복원을 한 호흡으로 쌓는다", () => {
    const beats = recollectionBeats({
      speaker: "나",
      lines: ["그날을 기억한다.", "창밖의 달빛."],
      pictureResourceId: "pic_moon",
    });
    const kinds = beats.map((beat) => beat.kind);
    expect(kinds).toContain("fade");
    expect(kinds).toContain("tint");
    expect(kinds).toContain("music");
    expect(kinds).toContain("picture");
    expect(kinds).toContain("say");

    expect(beats.some((beat) => beat.kind === "fade" && beat.direction === "out")).toBe(true);
    expect(beats.some((beat) => beat.kind === "fade" && beat.direction === "in")).toBe(true);
    expect(beats.some((beat) => beat.kind === "music" && beat.action === "bgm" && beat.resourceId === RECOLLECTION_BGM_ID)).toBe(true);
    expect(beats.some((beat) => beat.kind === "music" && (beat.action === "stop" || beat.action === "fade"))).toBe(true);
    expect(
      beats.some(
        (beat) =>
          beat.kind === "picture" &&
          beat.action === "show" &&
          beat.resourceId === "pic_moon" &&
          beat.pictureId === RECOLLECTION_PICTURE_ID,
      ),
    ).toBe(true);
    expect(beats.some((beat) => beat.kind === "picture" && beat.action === "erase")).toBe(true);
    const lastTint = [...beats].reverse().find((beat) => beat.kind === "tint");
    expect(lastTint?.kind === "tint" ? lastTint.color === "neutral" || lastTint.color === "#ffffff" : false).toBe(true);
  });
});
