// 끝낼 수 있는 첫 구간 — 뼈대가 실제 편집 도구로 깔리고, 헤드리스 자동 플레이가 구간 끝에 닿아야 합격이다.
// 저장→다시 읽기 뒤에도 합격이어야 하고, 구간을 끊은 결과는 불합격이어야 한다. 첫 화면 세 장르 모두.
import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import {
  buildPlayableSegmentSkeleton,
  judgePlayableSegment,
  playableSegmentGateApplies,
  SEGMENT_END_EVENT_ID,
  SEGMENT_ROUTE_MAP_ID,
  SEGMENT_STARTER_EVENT_ID,
  withVerifiedPlayableSegment,
} from "@/project/playableSegment";

const GENRES = ["monster-collect", "adventure-jrpg", "story-cutscene"] as const;

describe.each(GENRES)("끝낼 수 있는 첫 구간 — %s", (pack) => {
  const seed = () => createNewProjectSeed(pack, "첫 구간 테스트");

  it("빈 씨앗은 불합격이고 판정 대상도 아니다", () => {
    expect(judgePlayableSegment(seed()).ok).toBe(false);
    expect(playableSegmentGateApplies(seed())).toBe(false);
  });

  it("뼈대는 저장·다시 읽기 뒤에도 자동 플레이로 구간 끝에 닿는다", () => {
    const skeleton = withVerifiedPlayableSegment(seed());
    expect(skeleton).not.toBeNull();
    const reloaded = deserialize(serialize(skeleton!));
    expect(judgePlayableSegment(reloaded)).toMatchObject({ ok: true });
    expect(playableSegmentGateApplies(reloaded)).toBe(true);
  }, 60_000);

  it("구간 끝·문·핵심 행동 중 하나라도 끊기면 불합격이다", () => {
    const skeleton = buildPlayableSegmentSkeleton(seed());
    const cut = (mutate: (project: Project) => void) => {
      const project = structuredClone(skeleton);
      mutate(project);
      return judgePlayableSegment(project).ok;
    };
    expect(cut((p) => { p.maps[SEGMENT_ROUTE_MAP_ID]!.events = p.maps[SEGMENT_ROUTE_MAP_ID]!.events.filter((e) => e.id !== SEGMENT_END_EVENT_ID); })).toBe(false);
    expect(cut((p) => { const start = p.maps[p.startMapId]!; start.events = start.events.filter((e) => !e.id.startsWith("ev_gate")); })).toBe(false);
    expect(cut((p) => { const start = p.maps[p.startMapId]!; start.events = start.events.filter((e) => e.id !== SEGMENT_STARTER_EVENT_ID); })).toBe(false);
  }, 60_000);
});

describe("첫 구간 판정의 경계", () => {
  it("몬스터 수집은 포획 도구를 들고 시작한다", () => {
    const skeleton = withVerifiedPlayableSegment(createNewProjectSeed("monster-collect", "t"))!;
    expect(skeleton.session.inventory.item_capture_orb).toBeGreaterThanOrEqual(5);
  }, 60_000);

  // 깨질 것: 러너가 패배 불허 전투 뒤 명령을 계속 돌리면, 못 이기는 문지기 뒤의 엔딩도 도달로 센다.
  it("JRPG 문지기를 못 이기면 구간 끝에 닿지 못한다", () => {
    const skeleton = buildPlayableSegmentSkeleton(createNewProjectSeed("adventure-jrpg", "t"));
    const gate = skeleton.maps[SEGMENT_ROUTE_MAP_ID]!.events.find((e) => e.id === SEGMENT_END_EVENT_ID)!;
    for (const page of gate.pages ?? []) for (const command of page.commands) if (command.kind === "battleProcessing") command.troopId = "troop_dragon";
    expect(judgePlayableSegment(skeleton).ok).toBe(false);
  }, 60_000);

  it("뼈대가 없는 장르는 건드리지 않는다", () => {
    const farm = createNewProjectSeed("farm-life", "f");
    expect(withVerifiedPlayableSegment(farm)).toBeNull();
    expect(playableSegmentGateApplies(farm)).toBe(false);
  });
});

