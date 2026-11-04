import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { checkSeatedPose } from "@/project/lint/seatedPoseLint";
import { applySeatedPose } from "@/player/seatedPoseRender";
import { characterBaseOrigin } from "@/player/characterOrigin";
import { cellHasChair, normalizeEventPose, SEATED_CLIP_PX, SEATED_LOWER_PX } from "@/project/seatedPose";
import type { EventPage, GameEvent, Project } from "@/project/types";
import type { LintIssue } from "@/project/lint/projectLint";

// 첫사랑 r7 금요일 회의: 의자 세 개가 서 있는 그림에 완전히 가려 세 사람이 줄 서 있는 것처럼 읽혔다. 의자 칸은 타일 태그(「의자」)로 안다.
function page(id: string, graphic: Record<string, unknown>, priority = "same"): EventPage {
  return {
    id, name: id, conditions: [], graphic: { sprite: { type: "bundled", id: "Actor1" }, ...graphic },
    trigger: { kind: "action" }, priority, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
  } as unknown as EventPage;
}
const ev = (id: string, x: number, y: number, pages: EventPage[]): GameEvent => ({ id, name: id, x, y, pages } as unknown as GameEvent);

/** 칸 (3,3) 에 의자(태그 「의자」) 타일을 깐 프로젝트. 의자 아닌 칸은 (4,3). */
function chairProject(events: GameEvent[]): Project {
  const project: Project = createBlankProject();
  const map = Object.values(project.maps)[0]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const meta = (tileset.tileMeta ?? (tileset.tileMeta = [])) as unknown as Record<number, { tags?: string[] }>;
  meta[7] = { tags: ["의자"] };
  const tiles = map.upperTiles as unknown as number[];
  tiles[3 * map.width + 3] = 7;
  map.events = events;
  return project;
}

function codes(project: Project): string[] {
  const issues: LintIssue[] = [];
  checkSeatedPose(project, issues);
  return issues.map((i) => `${i.code}@${i.eventId}`);
}

describe("graphic.pose 정규화", () => {
  it("seated 만 받고 나머지는 생략한다", () => {
    expect(normalizeEventPose("seated")).toBe("seated");
    expect(normalizeEventPose("standing")).toBeUndefined();
    expect(normalizeEventPose(undefined)).toBeUndefined();
  });
});

describe("의자 칸 판정은 타일 태그로 한다", () => {
  it("태그가 있는 칸만 의자다", () => {
    const project = chairProject([]);
    const map = Object.values(project.maps)[0]!;
    expect(cellHasChair(project, map, 3, 3)).toBe(true);
    expect(cellHasChair(project, map, 4, 3)).toBe(false);
  });
});

describe("scene-seated-standing / scene-seated-off-chair", () => {
  it("의자 칸의 선 그림은 경고한다", () => {
    expect(codes(chairProject([ev("a", 3, 3, [page("p", {})])]))).toEqual(["scene-seated-standing@a"]);
  });
  it("의자 칸의 앉은 그림은 조용하다", () => {
    expect(codes(chairProject([ev("a", 3, 3, [page("p", { pose: "seated" })])]))).toEqual([]);
  });
  it("앉았다 일어서는 인물(같은 칸의 선 페이지가 따로 있어도 앉은 페이지가 있으면)은 조용하다", () => {
    expect(codes(chairProject([ev("a", 3, 3, [page("sit", { pose: "seated" }, "above"), page("up", {})])]))).toEqual([]);
  });
  it("의자가 아닌 칸의 앉은 그림은 경고한다", () => {
    expect(codes(chairProject([ev("a", 4, 3, [page("p", { pose: "seated" })])]))).toEqual(["scene-seated-off-chair@a"]);
  });
  it("투명 페이지는 몸이 없어 보지 않는다", () => {
    expect(codes(chairProject([ev("a", 3, 3, [page("p", { transparent: true, sprite: undefined })])]))).toEqual([]);
  });
});

describe("앉은 그림 그리기", () => {
  function stub(frameH: number, scaleY: number) {
    const calls = { origin: [] as number[][], crop: [] as number[][] };
    return {
      calls,
      sprite: {
        scaleY, frame: { realHeight: frameH, realWidth: 24 },
        setOrigin: (x: number, y: number) => { calls.origin.push([x, y]); },
        setCrop: (x: number, y: number, w: number, h: number) => { calls.crop.push([x, y, w, h]); },
      },
    };
  }
  it("16px 타일에서 그림을 5px 내리고 아랫단 8px 을 자른다", () => {
    const { calls, sprite } = stub(32, 1);
    applySeatedPose(sprite, 16);
    expect(SEATED_LOWER_PX).toBe(5);
    expect(SEATED_CLIP_PX).toBe(8);
    expect(calls.origin[0]![0]).toBe(0.5);
    expect(calls.origin[0]![1]).toBeCloseTo(1 - 5 / 32, 6);
    expect(calls.crop[0]).toEqual([0, 0, 24, 24]);
    expect(characterBaseOrigin(sprite).y).toBeCloseTo(1 - 5 / 32, 6);
  });
  it("배율 2·타일 32px 이면 같은 비율로 내리고 자른다(월드 px 는 칸 크기에 비례)", () => {
    const { calls, sprite } = stub(32, 2);
    applySeatedPose(sprite, 32);
    expect(calls.origin[0]![1]).toBeCloseTo(1 - 10 / 64, 6);
    expect(calls.crop[0]).toEqual([0, 0, 24, 24]);
  });
});
