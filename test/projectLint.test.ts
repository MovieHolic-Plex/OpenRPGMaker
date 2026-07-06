// projectLint 라이브러리 검증: 정상 프로젝트 0 error + 고의 파손 fixture가 error를 낸다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import type { ReachabilitySpec } from "@/project/lint/reachability";
import { createEmberQuestProject, EMBER_MAP } from "@/project/defaults/emberQuestGame";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";

const TILE_FLOOR_IMPASSABLE = 342; // TILE.FLOOR — 통행 불가.

function errorsOf(issues: readonly LintIssue[]): readonly LintIssue[] {
  return issues.filter((issue) => issue.severity === "error");
}

// JSON 왕복으로 안전하게 깊은 복제(mutable 사본).
function cloneProject(project: Project): Project {
  return deserialize(serialize(project));
}

// 커맨드 트리(페이지 포함)를 재귀 순회하며 첫 transfer 커맨드를 찾아 콜백에 넘긴다.
function withFirstTransfer(project: Project, mutate: (command: Extract<Command, { kind: "transfer" }>) => void): boolean {
  const walk = (commands: Command[]): boolean => {
    for (const command of commands) {
      if (command.kind === "transfer") {
        mutate(command);
        return true;
      }
      if (command.kind === "fork") {
        if (walk(command.then)) return true;
        if (command.else && walk(command.else)) return true;
      } else if (command.kind === "choices") {
        for (const option of command.options) if (walk(option.branch)) return true;
        if (command.cancelBranch && walk(command.cancelBranch)) return true;
      } else if (command.kind === "loop") {
        if (walk(command.body)) return true;
      }
    }
    return false;
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (walk(event.commands)) return true;
      for (const page of event.pages ?? []) if (walk(page.commands)) return true;
    }
  }
  return false;
}

describe("projectLint", () => {
  it("(a) 잿불의 유산 프로젝트는 error가 0건이다", () => {
    const issues = projectLint(createEmberQuestProject());
    expect(errorsOf(issues), JSON.stringify(errorsOf(issues), null, 2)).toHaveLength(0);
  });

  it("(b) 기본 어드벤처 프로젝트도 error가 0건이다", () => {
    // createBlankProject = 기본 어드벤처 맵 + configureAdventureProject.
    const issues = projectLint(createBlankProject());
    expect(errorsOf(issues), JSON.stringify(errorsOf(issues), null, 2)).toHaveLength(0);
  });

  it("(c) 마을 광장을 통행 불가 타일(342)로 되돌리면 startPos error가 발생한다", () => {
    const project = cloneProject(createEmberQuestProject());
    const village = project.maps[EMBER_MAP.village];
    expect(village).toBeTruthy();
    if (!village) return;
    // 중앙 광장(rect x12..19, y10..15)을 FLOOR(342)로 덮어 통행 불가로 만든다. startPos=(16,14).
    for (let y = 10; y <= 15; y += 1) {
      for (let x = 12; x <= 19; x += 1) {
        village.lowerTiles[y * village.width + x] = TILE_FLOOR_IMPASSABLE;
        village.upperTiles[y * village.width + x] = -1;
      }
    }
    const issues = projectLint(project);
    const errors = errorsOf(issues);
    expect(errors.some((issue) => issue.code === "start-position"), JSON.stringify(errors)).toBe(true);
  });

  it("(c') 광장 파손 시 도달성 spec을 주면 reachability error가 발생한다", () => {
    const project = cloneProject(createEmberQuestProject());
    const village = project.maps[EMBER_MAP.village];
    if (!village) throw new Error("village map missing");
    for (let y = 10; y <= 15; y += 1) {
      for (let x = 12; x <= 19; x += 1) {
        village.lowerTiles[y * village.width + x] = TILE_FLOOR_IMPASSABLE;
        village.upperTiles[y * village.width + x] = -1;
      }
    }
    const spec: ReachabilitySpec = {
      mapId: EMBER_MAP.village,
      from: { x: 16, y: 14 },
      targets: [{ x: 6, y: 3 }], // 여관(잠긴 광장 밖) — 도달 불가여야 한다.
    };
    const errors = errorsOf(projectLint(project, { reachability: [spec] }));
    expect(errors.some((issue) => issue.code === "reachability")).toBe(true);
  });

  it("(d) transfer 목적지를 경계 밖으로 조작하면 transfer-bounds error가 발생한다", () => {
    const project = cloneProject(createEmberQuestProject());
    const mutated = withFirstTransfer(project, (command) => {
      command.x = 9999;
      command.y = 9999;
    });
    expect(mutated, "transfer 커맨드를 찾지 못함").toBe(true);
    const errors = errorsOf(projectLint(project));
    expect(errors.some((issue) => issue.code === "transfer-bounds"), JSON.stringify(errors)).toBe(true);
  });

  it("editor-only 명령을 맵/커먼/트룹 이벤트 warning으로 보고한다", () => {
    const project = cloneProject(createBlankProject());
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    const comment: Command = { kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "런타임 무효과" } };
    map.events.push({
      id: "ev_editor_only",
      x: 3,
      y: 4,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "본문",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [comment],
        },
      ],
    });
    project.commonEvents.push({ id: "ce_editor_only", name: "주석", trigger: "none", commands: [comment] });
    project.database.troops[0]?.battleEventPages.push({
      id: "bp_editor_only",
      name: "주석",
      conditions: [],
      span: "battle",
      commands: [comment],
    });

    const issues = projectLint(project).filter((issue) => issue.code === "command-editor-only");

    expect(issues).toHaveLength(3);
    expect(issues[0]).toMatchObject({ severity: "warning", mapId: map.id, x: 3, y: 4 });
    expect(issues.map((issue) => issue.message).join("\n")).toContain("커먼 이벤트 ce_editor_only");
    expect(issues.map((issue) => issue.message).join("\n")).toContain("트룹");
  });

  it("256x256 초과 맵을 warning으로 보고한다", () => {
    const project = cloneProject(createBlankProject());
    const huge = createBlankMap("임포트 초대형", 257, 12);
    project.maps[huge.id] = huge;
    project.mapTree.children.push({ mapId: huge.id, children: [] });

    const issues = projectLint(project);
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "map-size",
        mapId: huge.id,
      })
    );
    expect(errorsOf(issues).some((issue) => issue.code === "map-size")).toBe(false);
  });
});
