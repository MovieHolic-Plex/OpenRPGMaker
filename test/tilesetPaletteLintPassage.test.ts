import { describe, expect, it } from "vitest";
import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";

function passageIssues(project: ReturnType<typeof createBlankProject>) {
  return lintTilesetPalettes(project).filter((issue) => issue.code === "tileset-palette-passage");
}

/**
 * 빈 프로젝트는 통행 위반을 0건 만든다(실측). 그래서 아래 두 특성화 테스트는 빈 배열을
 * 돌며 무조건 통과한다 — 이관 회귀를 잡지 못한다. 실제 방어는 위반을 직접 만드는
 * 아래 "구성된 위반" 블록이 한다.
 */
function projectWithRoleTile(role: string, blocked: boolean) {
  const project = createBlankProject();
  const map = Object.values(project.maps)[0]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const tile = map.lowerTiles[0]!;

  // 낱개 타일 메타의 role 이 primaryTileRole 의 1순위다 (tilesetPalette.ts:149).
  tileset.tileMeta ??= [];
  tileset.tileMeta[tile] = { label: "시험용 타일", description: "", role, origin: "user" };
  // isBlockedPassage: 4방향 전부 false 면 차단 (tilesetPassage.ts:39).
  tileset.passability[tile] = blocked ? blockedFlag() : passableFlag();

  return { project, map, tile };
}

describe("tilesetPaletteLint — 통행 일관성 (특성화)", () => {
  it("통행 경고는 path·wall 역할만 언급한다", () => {
    for (const issue of passageIssues(createBlankProject())) {
      expect(issue.message).toMatch(/(path|wall) 역할/);
    }
  });

  it("통행 경고는 severity warning 이다", () => {
    for (const issue of passageIssues(createBlankProject())) {
      expect(issue.severity).toBe("warning");
    }
  });
});

describe("tilesetPaletteLint — 통행 일관성 (구성된 위반)", () => {
  it("path 역할 타일이 통행 불가면 글자 단위로 같은 문장으로 경고한다", () => {
    const { project, map, tile } = projectWithRoleTile("path", true);

    const issues = passageIssues(project);

    expect(issues.some((i) => i.message.includes("path 역할"))).toBe(true);
    expect(issues[0]).toEqual({
      severity: "warning",
      code: "tileset-palette-passage",
      mapId: map.id,
      x: 0,
      y: 0,
      message: `통행 일관성: path 역할 타일 ${tile}이 통행 불가입니다 (${map.name} 0,0)`,
    });
  });

  it("wall 역할 타일이 통행 가능이면 글자 단위로 같은 문장으로 경고한다", () => {
    const { project, map, tile } = projectWithRoleTile("wall", false);

    const issues = passageIssues(project);

    expect(issues.some((i) => i.message.includes("wall 역할"))).toBe(true);
    expect(issues[0]).toEqual({
      severity: "warning",
      code: "tileset-palette-passage",
      mapId: map.id,
      x: 0,
      y: 0,
      message: `통행 일관성: wall 역할 타일 ${tile}이 통행 가능입니다 (${map.name} 0,0)`,
    });
  });

  it("path 역할 타일이 통행 가능이면 경고하지 않는다", () => {
    expect(passageIssues(projectWithRoleTile("path", false).project)).toHaveLength(0);
  });

  it("wall 역할 타일이 통행 불가면 경고하지 않는다", () => {
    expect(passageIssues(projectWithRoleTile("wall", true).project)).toHaveLength(0);
  });

  it("expectedPassage 가 없는 역할(ground·decor)은 통행을 검사하지 않는다", () => {
    for (const role of ["ground", "decor", "boundary", "furniture", "water", "roof"]) {
      expect(passageIssues(projectWithRoleTile(role, true).project), `${role} blocked`).toHaveLength(0);
      expect(passageIssues(projectWithRoleTile(role, false).project), `${role} passable`).toHaveLength(0);
    }
  });
});
