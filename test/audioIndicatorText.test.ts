// 「지금 흐르는 곡」 배너가 공용 음원 id(cc0-bgm-rtp-emo-002)를 플레이어에게 그대로 보이던 결함(폴른 스타 QA V049·D024, 2026-11-08).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { audioIndicatorText, showAudioIndicator } from "@/player/resourceDisplay";

function withProfiles(profiles: readonly { assetId: string; name: string }[]) {
  const project = createBlankProject();
  project.resourceProfiles = [
    ...project.resourceProfiles.filter((profile) => !profiles.some((entry) => entry.assetId === profile.assetId)),
    ...profiles.map((profile) => ({ kind: "music" as const, assetId: profile.assetId, name: profile.name })),
  ];
  store.replace(project);
}

describe("audio indicator text", () => {
  it("hides a bundled catalog id that has no display name", () => {
    withProfiles([]);
    expect(audioIndicatorText("cc0-bgm-rtp-emo-002")).toBeUndefined();
    expect(audioIndicatorText("easyrpg-music-town1")).toBeUndefined();
  });

  it("uses the authored display name when there is one", () => {
    withProfiles([{ assetId: "cc0-bgm-rtp-emo-002", name: "돌아오는 방" }]);
    expect(audioIndicatorText("cc0-bgm-rtp-emo-002")).toBe("돌아오는 방");
  });

  it("keeps an author-uploaded id visible, and shows nothing for an empty id", () => {
    withProfiles([]);
    expect(audioIndicatorText("bgm_1")).toBe("bgm_1");
    expect(audioIndicatorText("  ")).toBeUndefined();
  });

  it("clears a stale banner instead of leaving the previous track's name", () => {
    withProfiles([]);
    const calls: string[] = [];
    const scene = {
      showRuntimeOverlay: (id: string, text: string) => calls.push(`show ${id} ${text}`),
      clearRuntimeOverlay: (id: string) => calls.push(`clear ${id}`),
    };
    showAudioIndicator(scene, "bgm_1");
    showAudioIndicator(scene, "cc0-bgm-rtp-emo-002");
    expect(calls).toEqual(["show audio-indicator bgm_1", "clear audio-indicator"]);
  });
});
