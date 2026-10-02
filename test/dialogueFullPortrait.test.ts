import { describe, expect, it } from "vitest";
import {
  DIALOGUE_FULL_PORTRAIT_DEFAULTS,
  normalizeDialogueFullPortraitSettings,
  normalizeDialogueFullScale,
  resolveDialogueFullPortraitLayout,
} from "@/project/dialogueStyles";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

describe("전신 초상 크기 설정", () => {
  it("기본값은 화면 높이 125%·내림 20%, 장면 배율은 곱해진다", () => {
    expect(resolveDialogueFullPortraitLayout(undefined)).toEqual({ heightRatio: 1.25, dropRatio: 0.2 });
    expect(resolveDialogueFullPortraitLayout({ height: 100, drop: 10 }, 150)).toEqual({ heightRatio: 1.5, dropRatio: 0.1 });
  });

  it("범위를 벗어나면 잘라 내고, 기본값과 같은 칸은 저장하지 않는다", () => {
    expect(normalizeDialogueFullPortraitSettings({ height: 999, drop: -5 })).toEqual({ height: 200, drop: 0 });
    expect(normalizeDialogueFullPortraitSettings({ ...DIALOGUE_FULL_PORTRAIT_DEFAULTS })).toBeUndefined();
    expect(normalizeDialogueFullPortraitSettings("big")).toBeUndefined();
    expect(normalizeDialogueFullScale(100)).toBeUndefined();
    expect(normalizeDialogueFullScale(10)).toBe(40);
    expect(normalizeDialogueFullScale(Number.NaN)).toBeUndefined();
  });

  it("프로젝트 기본과 장면 배율이 저장·불러오기를 지난다", () => {
    const project = createBlankProject();
    project.system.dialogueFullPortrait = { height: 90, drop: 35 };
    project.commonEvents.push({ id: "full-scale", name: "전신", trigger: "none", commands: [
      { kind: "changeFace", resourceId: "shared-people1-girl-expressions-full-base", fullScale: 130, position: "left", flipHorizontally: false },
    ] });
    const loaded = deserialize(serialize(project));
    expect(loaded.system.dialogueFullPortrait).toEqual({ height: 90, drop: 35 });
    expect(loaded.commonEvents.find((event) => event.id === "full-scale")?.commands[0]).toMatchObject({ fullScale: 130 });
  });

  it("장면 배율이 숫자가 아니면 불러오기가 거부한다", () => {
    const project = createBlankProject();
    project.commonEvents.push({ id: "bad", name: "전신", trigger: "none", commands: [
      { kind: "changeFace", resourceId: "", fullScale: "big" as unknown as number, position: "left", flipHorizontally: false },
    ] });
    expect(() => deserialize(serialize(project))).toThrow(/fullScale/);
  });
});
