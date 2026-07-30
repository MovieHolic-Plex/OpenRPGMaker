// 재생 불가 오디오 참조를 린트가 드러내는지 지키는 가드.
//
// 실측 배경(2026-07-26): 번들 EasyRPG RTP 음악 30곡이 전부 .mid 이고 브라우저는 MIDI 를 재생하지
// 못한다. 기본 전투 BGM 이 그중 하나였고, 전투에 들어가면 필드 음악이 멈춘 뒤 **아무 소리도 나지
// 않았다**(브라우저 실측: `Battle 1.mid` 재생 시도 후 무음). 실패는 콘솔 경고 한 줄뿐이라
// 저작자는 "음악을 넣었는데 안 들린다" 로만 겪는다.
import { describe, expect, it } from "vitest";
import { projectLint } from "@/project/lint/projectLint";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";

const AUDIO_CODE = "audio-unplayable";

function audioIssues(project: Parameters<typeof projectLint>[0]): string[] {
  return projectLint(project).filter((issue) => issue.code === AUDIO_CODE).map((issue) => issue.message);
}

describe("재생 불가 오디오 린트", () => {
  it("MIDI 를 전투 BGM 으로 가리키면 경고한다", () => {
    const project = createEmberQuestProject();
    project.system = { ...project.system, battleBgmResourceId: "easyrpg-music-battle-1" };
    const messages = audioIssues(project);
    expect(messages.join(" ")).toContain("battleBgmResourceId");
    expect(messages.join(" ")).toContain(".mid");
  });

  it("맵 전용 BGM 도 검사한다", () => {
    const project = createEmberQuestProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.bgm = { mode: "custom", resourceId: "easyrpg-music-field-1" };
    expect(audioIssues(project).join(" ")).toContain(`maps.${mapId}.bgm`);
  });

  it("error 가 아니라 warning 이다 — 게임은 돌아가고 판단은 저작자 몫이다", () => {
    const project = createEmberQuestProject();
    project.system = { ...project.system, battleBgmResourceId: "easyrpg-music-battle-1" };
    const issues = projectLint(project).filter((issue) => issue.code === AUDIO_CODE);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) expect(issue.severity).toBe("warning");
  });

  it("번들에 없는 리소스 id 는 지적하지 않는다 — 모르는 것을 단정하지 않는다", () => {
    const project = createEmberQuestProject();
    project.system = { ...project.system, battleBgmResourceId: "user-uploaded-song-123" };
    expect(audioIssues(project)).toEqual([]);
  });

  it("빈 값은 지적하지 않는다", () => {
    const project = createEmberQuestProject();
    project.system = { ...project.system, battleBgmResourceId: "   " };
    expect(audioIssues(project)).toEqual([]);
  });

  it("출하되는 두 프로젝트는 재생 가능한 오디오만 가리킨다", () => {
    for (const make of [createEmberQuestProject, createSampleAdventureProject]) {
      const project = make();
      expect(audioIssues(project), `${project.meta.title}`).toEqual([]);
    }
  });
});
