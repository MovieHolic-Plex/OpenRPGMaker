// 저작 시점 검사와 테스트 하네스가 앵커 한 칸을 넘어 **사각**까지 보는지 검증한다.
// 2차 스펙 docs/superpowers/specs/2026-08-30-character-body-vs-passage-rect-design.md §10.
//
// 판별력 규칙(1차·2차 내내 같다): 프로브는 **앵커 칸을 겨냥하지 않는다.** 앵커를 찌르는 검사는
// 1x1 이어도 같은 결과가 나오므로 아무것도 증명하지 않는다. 그리고 모든 describe 는 같은
// 상황을 1x1 로도 돌려 **경고가 새로 생기지 않는다**(항등)는 것을 같이 굳힌다.

import { describe, expect, it } from "vitest";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import { canTravelBetweenMaps } from "@/testing/mapTravelReachability";
import type { CharacterFootprint, EventPage, GameEvent, GameMap, Project } from "@/project/types";

const TILE_FLOOR_IMPASSABLE = 342; // TILE.FLOOR — 통행 불가.

function cloneProject(project: Project): Project {
  return deserialize(serialize(project));
}

function startMap(project: Project): GameMap {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  return map;
}

function wall(map: GameMap, x: number, y: number): void {
  map.lowerTiles[y * map.width + x] = TILE_FLOOR_IMPASSABLE;
  map.upperTiles[y * map.width + x] = -1;
}

/** 발자국을 실은 action 이벤트. footprint 를 생략하면 페이지가 아예 없어 1x1 이 된다. */
function pushEvent(
  map: GameMap,
  id: string,
  x: number,
  y: number,
  page?: { footprint?: CharacterFootprint; passRows?: number; trigger?: EventPage["trigger"]; priority?: EventPage["priority"] }
): GameEvent {
  const event: GameEvent = {
    id,
    x,
    y,
    trigger: page?.trigger ?? { kind: "action" },
    commands: [],
    ...(page
      ? {
          pages: [
            {
              id: `${id}_p0`,
              name: "기본",
              conditions: [],
              graphic: { transparent: true },
              trigger: page.trigger ?? { kind: "action" },
              priority: page.priority ?? "below",
              overlapForbidden: page.priority === "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [{ kind: "text", body: "hi" }],
              ...(page.footprint ? { footprint: page.footprint } : {}),
              ...(page.passRows === undefined ? {} : { passRows: page.passRows }),
            } satisfies EventPage,
          ],
        }
      : {}),
  };
  map.events.push(event);
  return event;
}

function issuesWithCode(project: Project, code: string): readonly LintIssue[] {
  return projectLint(project).filter((issue) => issue.code === code);
}

describe("event-footprint-impassable — 다중 타일 이벤트가 벽을 걸친다", () => {
  // 앵커는 풀밭이고 **비앵커 칸**만 벽이다. 이 자리는 canMoveFootprint 가 절대 허용하지 않는
  // 좌표라, 저작으로만 놓일 수 있고 거기 놓인 이동형 NPC 는 나올 수 없다.
  it("2x2 이벤트의 비앵커 칸이 벽이면 warning 을 낸다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    // 짝수 폭은 앵커가 **왼쪽** 열이다: 2x2 앵커 (10,7) 의 몸은 x 10..11, y 6..7.
    wall(map, 11, 6); // 오른쪽 위 칸 — 앵커가 아니다.
    pushEvent(map, "ev_big", 10, 7, { footprint: { width: 2, height: 2 } });

    const issues = issuesWithCode(project, "event-footprint-impassable");
    expect(issues, JSON.stringify(issues)).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", x: 10, y: 7 });
    expect(issues[0]?.message).toContain("(11, 6)");
    expect(issues[0]?.message).toContain("ev_big");
  });

  it("같은 자리의 1x1 이벤트는 경고가 없다 — 항등", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    wall(map, 11, 6);
    pushEvent(map, "ev_small", 10, 7);

    expect(issuesWithCode(project, "event-footprint-impassable")).toHaveLength(0);
  });

  // 통행 사각으로 보는 것의 요점: passRows 로 열어 둔 상체가 벽과 겹치는 것은 **정상**이다.
  // 벽을 스치고 지나가는 것이 사각을 둘로 쪼갠 목적이므로 여기에 경고를 내면 안 된다.
  it("passRows 로 열어 둔 상체가 벽을 덮어도 경고가 없다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    wall(map, 9, 5); // 3x3 몸(x 9..11, y 5..7)의 상단 행 — 통행 사각(y 7)에는 없다.
    pushEvent(map, "ev_golem", 10, 7, { footprint: { width: 3, height: 3 }, passRows: 1 });

    expect(issuesWithCode(project, "event-footprint-impassable")).toHaveLength(0);
  });

  it("통행 사각(발밑 행)이 벽을 덮으면 경고한다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    wall(map, 9, 7); // 발밑 행의 **비앵커** 칸.
    pushEvent(map, "ev_golem", 10, 7, { footprint: { width: 3, height: 3 }, passRows: 1 });

    const issues = issuesWithCode(project, "event-footprint-impassable");
    expect(issues, JSON.stringify(issues)).toHaveLength(1);
    expect(issues[0]?.message).toContain("(9, 7)");
  });
});

describe("duplicate-event — 앵커 문자열 키가 아니라 몸 사각 겹침", () => {
  // 예전 키는 `${x},${y}` 였다. 앵커가 한 칸이라도 다르면 다른 좌표로 세어, 완전히 포개진
  // 2x2 두 개가 무경고 통과했다.
  it("앵커가 한 칸 다른 2x2 두 개의 겹침을 잡는다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    pushEvent(map, "ev_a", 10, 8, { footprint: { width: 2, height: 2 } });
    pushEvent(map, "ev_b", 11, 8, { footprint: { width: 2, height: 2 } });

    const issues = issuesWithCode(project, "duplicate-event");
    expect(issues, JSON.stringify(issues)).toHaveLength(1);
    expect(issues[0]?.message).toContain("ev_a & ev_b");
  });

  it("몸 사각이 안 닿는 2x2 두 개는 잡지 않는다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    pushEvent(map, "ev_a", 10, 8, { footprint: { width: 2, height: 2 } });
    pushEvent(map, "ev_b", 13, 8, { footprint: { width: 2, height: 2 } });

    expect(issuesWithCode(project, "duplicate-event")).toHaveLength(0);
  });

  // 1x1 두 개가 같은 칸일 때의 좌표·메시지는 예전 구현과 같아야 한다 — 뒤쪽 이벤트의 앵커.
  it("같은 칸의 1x1 두 개는 예전과 같은 좌표·메시지로 보고한다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    pushEvent(map, "ev_a", 7, 7);
    pushEvent(map, "ev_b", 7, 7);

    const issues = issuesWithCode(project, "duplicate-event");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", x: 7, y: 7 });
    expect(issues[0]?.message).toBe(`이벤트 좌표가 겹칩니다: ${map.id} (7, 7) — ev_a & ev_b`);
  });

  it("이웃한 1x1 두 개는 겹치지 않는다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    pushEvent(map, "ev_a", 7, 7);
    pushEvent(map, "ev_b", 8, 7);

    expect(issuesWithCode(project, "duplicate-event")).toHaveLength(0);
  });
});

describe("event-unreachable / playerTouch-impassable — 몸 칸 하나라도 열려 있으면 산다", () => {
  // 앵커만 보던 검사는 2x2 의 앵커가 벽이면 "영구 미발동" 이라고 울렸다. 발동 판정은 몸 사각
  // 겹침이므로, 다른 몸 칸을 밟을 수 있으면 발동한다 — 오탐이었다.
  it("2x2 밟기형 이벤트의 앵커가 벽이어도 다른 몸 칸이 열려 있으면 경고하지 않는다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    wall(map, 10, 8); // 앵커만 벽. 나머지 세 칸 (11,8) (10,7) (11,7) 은 풀밭.
    pushEvent(map, "ev_touch", 10, 8, {
      footprint: { width: 2, height: 2 },
      trigger: { kind: "playerTouch" },
      priority: "below",
    });

    expect(issuesWithCode(project, "playerTouch-impassable")).toHaveLength(0);
    expect(issuesWithCode(project, "event-unreachable")).toHaveLength(0);
  });

  it("몸 사각 전 칸이 벽이면 여전히 경고한다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    for (const [x, y] of [[10, 7], [11, 7], [10, 8], [11, 8]] as const) wall(map, x, y);
    pushEvent(map, "ev_touch", 10, 8, {
      footprint: { width: 2, height: 2 },
      trigger: { kind: "playerTouch" },
      priority: "below",
    });

    expect(issuesWithCode(project, "playerTouch-impassable")).toHaveLength(1);
  });

  // event-unreachable 의 이웃 판정도 몸 칸 기준이다: 몸이 전부 벽이어도 **몸의** 이웃 하나가
  // 열려 있으면 부딪힘으로 닿는다. 앵커의 4방 이웃만 보면 2x2 의 반대편 이웃을 놓친다.
  it("몸이 전부 벽이어도 비앵커 칸의 이웃이 열려 있으면 도달 가능으로 본다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    // 몸(x 10..11, y 7..8) 전부 벽 + 앵커(10,8)의 4방 이웃 (9,8)·(10,9) 도 벽.
    // 남는 열린 이웃은 (12,7) 뿐이다 — **비앵커 칸** (11,7) 의 오른쪽이라 앵커만 보는 검사는 못 본다.
    for (const [x, y] of [[10, 7], [11, 7], [10, 8], [11, 8], [9, 8], [10, 9], [11, 9], [10, 6], [11, 6], [9, 7], [12, 8]] as const) {
      wall(map, x, y);
    }
    pushEvent(map, "ev_walled", 10, 8, { footprint: { width: 2, height: 2 } });

    expect(issuesWithCode(project, "event-unreachable")).toHaveLength(0);
  });
});

describe("start-position — 주인공 몸이 시작 칸에 들어가는가", () => {
  it("3x3 주인공의 통행 사각이 벽을 걸치면 error 를 낸다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    project.system.playerFootprint = { width: 3, height: 3 };
    // 발밑 행의 비앵커 칸을 막는다 — 앵커 자체는 통행 가능해서 예전 검사는 통과했다.
    wall(map, project.startPos.x - 1, project.startPos.y);

    const issues = issuesWithCode(project, "start-position");
    expect(issues, JSON.stringify(issues)).toHaveLength(1);
    expect(issues[0]?.severity).toBe("error");
    expect(issues[0]?.message).toContain("3x3");
  });

  it("passRows 로 상체를 열어 두면 상체 쪽 벽은 error 가 아니다", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    project.system.playerFootprint = { width: 3, height: 3 };
    project.system.playerPassRows = 1;
    wall(map, project.startPos.x - 1, project.startPos.y - 2); // 상체 행.

    expect(issuesWithCode(project, "start-position")).toHaveLength(0);
  });

  it("발자국 저작이 없으면 같은 벽에도 error 가 없다 — 항등", () => {
    const project = cloneProject(createBlankProject());
    const map = startMap(project);
    wall(map, project.startPos.x - 1, project.startPos.y);

    expect(issuesWithCode(project, "start-position")).toHaveLength(0);
  });
});

describe("mapTravelReachability — 관문을 몸 사각으로 색인한다", () => {
  /**
   * 두 맵과 문 이벤트를 만든다. 앵커 칸은 벽이므로 1x1 문은 영원히 못 밟고, 2x2 문은
   * 비앵커 칸으로 밟을 수 있다. 두 경우 모두 **페이지가 있어야** 한다 — `activeTransfers` 는
   * 페이지 없는 이벤트의 legacy commands 를 보지 않으므로, 페이지를 빼면 발자국과 무관하게
   * 관문이 죽어 실험이 무의미해진다.
   */
  function twoMapProject(footprint?: CharacterFootprint): Project {
    const project = cloneProject(createBlankProject());
    const from = startMap(project);
    const to = createBlankMap("도착", 20, 20);
    project.maps[to.id] = to;
    project.mapTree.children.push({ mapId: to.id, children: [] });
    // 관문은 시작 좌표에서 **떨어져** 있어야 한다. startPos 위에 놓으면 BFS 의 출발 노드가 곧
    // 관문 칸이라 통행성과 무관하게 워프가 걸리고, 대조군이 헛통과한다(실측).
    const gate = pushEvent(from, "ev_gate", 13, 10, footprint ? { footprint } : {});
    const page = gate.pages?.[0];
    if (!page) throw new Error("gate page missing");
    (page.commands as unknown[]).length = 0;
    (page.commands as unknown[]).push({ kind: "transfer", mapId: to.id, x: 5, y: 5, direction: "retain" });
    // 앵커 칸을 벽으로 막는다 — 2x2 라면 비앵커 칸으로 밟을 수 있어야 한다.
    wall(from, 13, 10);
    return project;
  }

  /** 도착 맵 id 는 createBlankMap 이 만들어 주는 값이다 — 하드코딩하면 실험이 무의미해진다. */
  function destinationId(project: Project): string {
    const id = Object.keys(project.maps).find((mapId) => mapId !== project.startMapId);
    if (!id) throw new Error("destination map missing");
    return id;
  }

  it("2x2 관문은 비앵커 칸을 밟아도 이어진다", () => {
    const project = twoMapProject({ width: 2, height: 2 });
    const result = canTravelBetweenMaps(project, { ...project.startPos, mapId: project.startMapId }, destinationId(project));

    expect(result.reachable, JSON.stringify(result.unreachableGates)).toBe(true);
  });

  it("1x1 관문의 앵커가 벽이면 여전히 닿지 않는다 — 항등", () => {
    const project = twoMapProject();
    const result = canTravelBetweenMaps(project, { ...project.startPos, mapId: project.startMapId }, destinationId(project));

    expect(result.reachable).toBe(false);
    expect(result.unreachableGates.map((gate) => gate.eventId)).toContain("ev_gate");
  });
});
