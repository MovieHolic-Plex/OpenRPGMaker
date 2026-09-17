// 설산 60×60 을 실제 프로젝트로 깔았을 때 편집기가 열 수 있는 상태인지 검사한다.
// 지형 자체는 `snowMountain60.test.ts` 가 본다 — 여기는 **배선**만 본다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { canMove } from "@/project/collision";
import { createSnowMountain60Project } from "@/project/defaults/defaultProject";
import { createDevShowcaseProjectForLocation } from "@/editor/devShowcaseProjects";
import { SNOW_MOUNTAIN_HEIGHT, SNOW_MOUNTAIN_START, SNOW_MOUNTAIN_WIDTH } from "@/project/defaults/snowMountain60";
import { projectLint } from "@/project/lint/projectLint";

describe("설산 60×60 프로젝트 배선", () => {
  it("시작 맵이 설산이고 크기가 60×60 이다", () => {
    const project = createSnowMountain60Project();
    const map = project.maps[project.startMapId];
    expect(map, "시작 맵이 없다").toBeDefined();
    expect(map!.width).toBe(SNOW_MOUNTAIN_WIDTH);
    expect(map!.height).toBe(SNOW_MOUNTAIN_HEIGHT);
    expect(map!.tilesetId).toBe("easyrpg_chipset_dungeon");
    expect(project.tilesets[map!.tilesetId], "칩셋이 프로젝트에 없다").toBeDefined();
  });

  it("시작 위치가 산 발치이고 실제로 움직일 수 있다", () => {
    // `createProjectWithMaps` 의 기본 시작 위치는 맵 중앙 (30,31)인데
    // 이 맵의 (30,31)은 가운데 절벽 몸통이다 — 덮어쓰지 않으면 주인공이 박힌다.
    const project = createSnowMountain60Project();
    expect(project.startPos).toEqual({ x: SNOW_MOUNTAIN_START.x, y: SNOW_MOUNTAIN_START.y });
    const map = project.maps[project.startMapId]!;
    const { x, y } = project.startPos;
    const moves = ([[0, 1], [0, -1], [1, 0], [-1, 0]] as const)
      .filter(([dx, dy]) => canMove(project, map, x, y, x + dx, y + dy));
    expect(moves.length, "시작 위치에서 한 칸도 못 움직인다").toBeGreaterThan(0);
  });

  it("맵 중앙은 실제로 절벽이다 — 기본 시작 위치를 덮어쓴 이유", () => {
    const project = createSnowMountain60Project();
    const map = project.maps[project.startMapId]!;
    const centre = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) + 1 };
    const moves = ([[0, 1], [0, -1], [1, 0], [-1, 0]] as const)
      .filter(([dx, dy]) => canMove(project, map, centre.x, centre.y, centre.x + dx, centre.y + dy));
    expect(moves.length, `(${centre.x},${centre.y}) 가 걸을 수 있게 바뀌었다면 이 주석과 덮어쓰기를 다시 판단해야 한다`).toBe(0);
  });

  it("맵 트리에 등록되어 편집기 목록에 나온다", () => {
    const project = createSnowMountain60Project();
    expect(project.mapTree.mapId).toBe(project.startMapId);
  });

  it("프로젝트 린트에 오류가 없다", () => {
    const project = createSnowMountain60Project();
    const issues = projectLint(project).filter((issue) => issue.severity === "error");
    expect(issues, issues.slice(0, 6).map((i) => `${i.code}:${i.message}`).join(" · ")).toEqual([]);
  });

  it("선반 위가 비어 있다 — 감독이 직접 칠할 캔버스다", () => {
    const project = createSnowMountain60Project();
    const map = project.maps[project.startMapId]!;
    expect(map.upperTiles.every((tile) => tile === -1), "상위 레이어에 뭔가 얹혔다").toBe(true);
    expect(map.events, "이벤트가 얹혔다").toEqual([]);
  });
});

describe("설산 60×60 직접 URL", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("?devProject=1&snowMountain60=1 이 설산을 바로 띄운다", () => {
    vi.stubGlobal("window", {
      location: { hostname: "localhost", search: "?devProject=1&snowMountain60=1" },
    });
    const project = createDevShowcaseProjectForLocation();
    expect(project?.startMapId, "URL 로 설산이 열리지 않는다").toBe("map_snow_mountain_60");
  });

  it("devProject 없이 snowMountain60 만 주면 열리지 않는다 — 레지스트리 계약", () => {
    // 이 파일의 계약: 생성형 쇼케이스 URL 은 `devProject` 와 **함께** 와야 한다.
    // 단독으로 열리면 Supabase 기본 프로젝트를 조용히 덮어쓴다.
    vi.stubGlobal("window", {
      location: { hostname: "localhost", search: "?snowMountain60=1" },
    });
    expect(createDevShowcaseProjectForLocation()).toBeNull();
  });

  it("로컬이 아닌 호스트에서는 열리지 않는다", () => {
    vi.stubGlobal("window", {
      location: { hostname: "oprn:example.com", search: "?devProject=1&snowMountain60=1" },
    });
    expect(createDevShowcaseProjectForLocation()).toBeNull();
  });
});
