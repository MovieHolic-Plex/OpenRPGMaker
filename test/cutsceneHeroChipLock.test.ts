// 잠금 누수 감사(2026-10-16) #7 — 컷신 도구가 주인공 칩을 Actor1~4 로만 받아 잠금 아래에서 모델을 RTP 칩으로 몰던 문제.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { cutsceneHeroChipError, defaultCutsceneCharset, heroCharacterResourceId } from "@/editor/tools/cutsceneCharacterLock";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { enableGenreLock } from "@/project/genreLock";
import type { Project } from "@/project/types";

beforeEach(() => resetMapEditHistory());

const lockedProject = (): Project => {
  const project = createBlankProject();
  enableGenreLock(project, "monster-collect");
  return project;
};

describe("컷신 주인공 칩 규칙", () => {
  it("잠금이 없으면 옛 규칙: Actor1~4 만, 기본값은 Actor1", () => {
    const project = createBlankProject();
    expect(defaultCutsceneCharset(project)).toBe("tex_easyrpg_charset_actor1");
    expect(cutsceneHeroChipError(project, "tex_easyrpg_charset_actor2", "주인공")).toBeUndefined();
    expect(cutsceneHeroChipError(project, "tex_scarloxy_charset_people1", "주인공")).toMatch(/Actor1~4/u);
  });

  it("몬스터 수집 잠금이면 허용 칩(Scarloxy 사람)을 받고 RTP Actor 는 허용 칩 예시와 함께 거부한다", () => {
    const project = lockedProject();
    expect(defaultCutsceneCharset(project)).toBe("scarloxy-charset-people1");
    expect(cutsceneHeroChipError(project, "tex_scarloxy_charset_people1", "주인공")).toBeUndefined();
    const rejected = cutsceneHeroChipError(project, "tex_easyrpg_charset_actor1", "주인공");
    expect(rejected).toMatch(/장르 잠금/u);
    expect(rejected).toMatch(/scarloxy-charset-people1/u);
  });

  it("텍스처 키를 배우 리소스 id 로 바꾼다(easyrpg·scarloxy 공통)", () => {
    expect(heroCharacterResourceId("tex_easyrpg_charset_actor1")).toBe("easyrpg-charset-actor1");
    expect(heroCharacterResourceId("tex_scarloxy_charset_people2")).toBe("scarloxy-charset-people2");
    expect(heroCharacterResourceId("scarloxy-charset-people1")).toBe("scarloxy-charset-people1");
  });
});

describe("script_cutscene_staged 주인공 칩", () => {
  const stageArgs = (project: Project, resourceId: string) => ({
    mapId: project.startMapId,
    actors: [{ name: "주인공", hero: true, character: { resourceId, characterIndex: 0 }, at: { fx: 0.5, fy: 0.6 } }],
    steps: [{ do: "flash" }],
  });
  const ctxOf = (project: Project): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun: true });

  it("잠금 아래에서 RTP Actor 주인공은 invalid-args 로 거부되고 메시지에 허용 칩이 있다", () => {
    const project = lockedProject();
    const result = runTool(ctxOf(project), "script_cutscene_staged", stageArgs(project, "tex_easyrpg_charset_actor1"), { dryRun: true });
    expect(result.ok).toBe(false);
    // 한 줄 요약(summary)은 길이 제한으로 「예: character:{resourceId…」 에서 잘린다 — 허용 칩 예시는 invalid-args 이슈 본문에 있다.
    const issue = result.issues?.find((entry) => entry.code === "invalid-args");
    expect(issue?.message).toMatch(/scarloxy-charset-people1/u);
  });

  it("잠금이 없으면 Actor 주인공은 이 검사를 통과한다(프레임 준비 단계에서야 실패할 수 있음)", () => {
    const project = createBlankProject();
    const result = runTool(ctxOf(project), "script_cutscene_staged", stageArgs(project, "tex_easyrpg_charset_actor1"), { dryRun: true });
    expect(result.summary ?? "").not.toMatch(/Actor1~4 에서 고릅니다/u);
  });
});
