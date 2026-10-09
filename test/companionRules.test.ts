import { describe, expect, it } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject, TILE } from "@/project/defaults";
import {
  addFollowerToSession,
  removeFollowerFromSession,
  resolveCompanionRules,
  charsetFollowerGraphic,
  followerPositions,
  MAX_FOLLOWER_TRAIL_POINTS,
  recordFollowerPlayerStep,
  resetFollowerTrailNearPlayer,
} from "@/project/followers";
import { startSession } from "@/project/session";
import type { Command, EventPage, PlaySession, Project } from "@/project/types";

const CAT = () => charsetFollowerGraphic("tex_easyrpg_charset_animal", 0);

function walkEast(session: PlaySession, from: number, steps: number): void {
  for (let i = 0; i < steps; i += 1) {
    recordFollowerPlayerStep(session, { x: from + i, y: 5, direction: "right" });
  }
}

function pageWithCommands(project: Project, mapId: string, eventId: string): EventPage | undefined {
  const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
  return event?.pages?.find((page) => page.commands.length > 0);
}

describe("동료 간격 규칙", () => {
  it("gap 을 지정하지 않으면 궤적을 한 칸씩 승계한다(기존 동작)", () => {
    const project = createBlankProject();
    const session = startSession(project);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

    walkEast(session, 1, 6);

    expect(followerPositions(session).map((entry) => ({ name: entry.follower.name, x: entry.x }))).toEqual([
      { name: "가리", x: 6 },
      { name: "야옹이", x: 5 },
    ]);
  });

  it("gap 이 커지면 같은 궤적에서 더 멀리 떨어져 따라온다", () => {
    const project = createBlankProject();
    project.system.companions = { gap: 3 };
    const session = startSession(project);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

    walkEast(session, 1, 10);
    const trail = session.followerTrail ?? [];

    // 궤적 head 가 방금 떠난 칸이고, gap 3 이면 1번째 동료는 trail[2]·2번째는 trail[5] 를 읽는다.
    expect(followerPositions(session, project.system.companions).map((entry) => entry.x)).toEqual([
      trail[2]?.x,
      trail[5]?.x,
    ]);
    expect(trail[2]?.x).toBe((trail[0]?.x ?? 0) - 2);
    expect(trail[5]?.x).toBe((trail[0]?.x ?? 0) - 5);
  });

  it("맵 진입 궤적 초기화는 gap 만큼 길게 깔아 동료가 플레이어 칸에 겹치지 않게 한다", () => {
    const project = createBlankProject();
    project.system.companions = { gap: 4 };
    const session = startSession(project);
    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId], project.system.companions);

    expect(session.followerTrail).toHaveLength(8);
    for (const position of followerPositions(session, project.system.companions)) {
      expect({ x: position.x, y: position.y }).not.toEqual({ x: session.x, y: session.y });
    }
  });
});

describe("동료 인원 상한", () => {
  it("상한을 넘기면 reject 정책이 새 동료를 붙이지 않는다", () => {
    const project = createBlankProject();
    project.system.companions = { maxCompanions: 1 };
    const session = startSession(project);

    expect(addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" })).not.toBeNull();
    expect(addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" })).toBeNull();
    expect(session.followers.map((entry) => entry.name)).toEqual(["가리"]);
  });

  it("replaceOldest 정책은 가장 먼저 붙은 동료를 밀어낸다", () => {
    const project = createBlankProject();
    project.system.companions = { maxCompanions: 1, overflow: "replaceOldest" };
    const session = startSession(project);

    addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
    addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

    expect(session.followers.map((entry) => entry.name)).toEqual(["야옹이"]);
  });

  it("몬스터 동행은 액터 상한에 포함되지 않는다", () => {
    const project = createBlankProject();
    project.system.companions = { maxCompanions: 1 };
    const session = startSession(project);
    session.followers = [
      {
        id: "monster:m1",
        name: "슬라임",
        kind: "monster",
        monsterInstanceId: "m1",
        graphic: charsetFollowerGraphic("tex_easyrpg_charset_monster1", 0),
      },
    ];

    expect(addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" })).not.toBeNull();
    expect(session.followers.map((entry) => entry.name)).toEqual(["가리", "슬라임"]);
  });
});

describe("동료 그래픽 프레임", () => {
  it("charsetFollowerGraphic 은 캐릭터 칸마다 다른 프레임을 만든다", () => {
    const orange = charsetFollowerGraphic("tex_easyrpg_charset_animal", 0);
    const black = charsetFollowerGraphic("tex_easyrpg_charset_animal", 1);

    expect(orange.pattern).toBe(charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }));
    expect(black.pattern).toBe(charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 }));
    expect(orange.pattern).not.toBe(black.pattern);
  });
});

describe("동료 대형", () => {
  it("beside 대형은 앞 4명을 플레이어 인접 칸에 세우고 나머지는 일렬로 떨어뜨린다", () => {
    const project = createBlankProject();
    project.system.companions = { formation: "beside" };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("map fixture missing");
    map.lowerTiles.fill(TILE.GRASS);
    const session = startSession(project);
    session.x = 6;
    session.y = 6;
    for (const name of ["가리", "야옹이", "까망이", "삐약이", "다섯"]) {
      addFollowerToSession(project, session, { graphic: CAT(), name });
    }
    walkEast(session, 1, 6);

    const positions = followerPositions(session, project.system.companions, { project, map });
    const beside = positions.slice(0, 4).map((entry) => `${entry.x},${entry.y}`);

    expect(new Set(beside).size).toBe(4);
    for (const entry of positions.slice(0, 4)) {
      expect(Math.abs(entry.x - session.x) + Math.abs(entry.y - session.y)).toBe(1);
    }
    // 5번째는 옆자리가 없으니 궤적으로 떨어진다.
    expect(positions[4]).toMatchObject({ x: session.followerTrail?.[0]?.x, y: session.followerTrail?.[0]?.y });
  });

  it("통행 불가 인접 칸은 옆자리로 쓰지 않는다", () => {
    const project = createBlankProject();
    project.system.companions = { formation: "beside" };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("map fixture missing");
    map.lowerTiles.fill(TILE.GRASS);
    map.lowerTiles[6 * map.width + 5] = TILE.WATER;
    const session = startSession(project);
    session.x = 6;
    session.y = 6;
    addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

    const [first] = followerPositions(session, project.system.companions, { project, map });

    expect(first).toBeDefined();
    expect({ x: first?.x, y: first?.y }).not.toEqual({ x: 5, y: 6 });
  });
});

describe("맵 이동 시 동료 해제", () => {
  it("clearOnTransfer 가 켜져 있으면 전송 후 액터 동료가 사라진다", () => {
    const project = createBlankProject();
    project.system.companions = { clearOnTransfer: true };
    const session = startSession(project);
    addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });
    expect(session.followers).toHaveLength(1);

    if (resolveCompanionRules(project.system.companions).clearOnTransfer) {
      removeFollowerFromSession(session, { all: true });
    }

    expect(session.followers).toHaveLength(0);
  });

  it("기본값은 맵 이동 후에도 동료를 유지한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    addFollowerToSession(project, session, { graphic: CAT(), name: "야옹이" });

    expect(resolveCompanionRules(project.system.companions).clearOnTransfer).toBe(false);
    expect(session.followers).toHaveLength(1);
  });
});

describe("configure_companion_rules 툴", () => {
  it("간격/상한/초과정책을 system.companions 에 기록한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "configure_companion_rules", { gap: 3, maxCompanions: 2, overflow: "replaceOldest" });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.system.companions).toEqual({ gap: 3, maxCompanions: 2, overflow: "replaceOldest" });
  });

  it("궤적 버퍼를 넘는 간격×인원 조합을 거부한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "configure_companion_rules", { gap: 16, maxCompanions: 8 });

    expect(16 * 8).toBeGreaterThan(MAX_FOLLOWER_TRAIL_POINTS);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("companion-trail-overflow");
    expect(context.project.system.companions).toBeUndefined();
  });

  it("대형과 맵 이동 해제 옵션을 기록하고, beside 는 궤적 상한 검사를 건너뛴다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "configure_companion_rules", { formation: "beside", clearOnTransfer: true, gap: 16, maxCompanions: 8 });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.system.companions).toMatchObject({ formation: "beside", clearOnTransfer: true });
    expect((result.data as { formation: string }).formation).toBe("beside");
  });

  it("reset 은 규칙을 지운다", () => {
    const context: ToolContext = { project: createBlankProject() };
    context.project.system.companions = { gap: 4 };

    expect(runTool(context, "configure_companion_rules", { reset: true }).ok).toBe(true);
    expect(context.project.system.companions).toBeUndefined();
  });
});

describe("add_companion 툴", () => {
  it("말 걸어 합류하는 동료 이벤트를 만들고 합류 후 사라지게 한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const result = runTool(context, "add_companion", {
      who: { query: "고양이" },
      target: { mapId, x: 4, y: 4 },
      trigger: "talk",
      name: "야옹이",
    });

    expect(result.ok, result.summary).toBe(true);
    const eventId = (result.data as { eventId: string }).eventId;
    const event = context.project.maps[mapId]?.events.find((entry) => entry.id === eventId);
    expect(event?.pages).toHaveLength(2);
    const page = pageWithCommands(context.project, mapId, eventId);
    expect(page?.commands[0]).toMatchObject({ kind: "addFollower", name: "야옹이" });
    expect(page?.commands.at(-1)).toMatchObject({ kind: "setSelfSwitch", key: "A", value: true });
    expect(event?.pages?.some((entry) => entry.commands.length === 0)).toBe(true);
  });

  it("자동 합류 이벤트는 스위치 가드로 1회만 실행된다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const result = runTool(context, "add_companion", {
      who: { actorId: "actor_hero" },
      target: { mapId, x: 4, y: 4 },
      trigger: "autorun",
    });

    expect(result.ok, result.summary).toBe(true);
    const eventId = (result.data as { eventId: string }).eventId;
    const page = context.project.maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
    expect(page?.trigger).toEqual({ kind: "auto" });
    const guard = page?.conditions?.[0];
    expect(guard).toMatchObject({ kind: "switch", value: false });
    const switchId = (guard as { switchId: string }).switchId;
    expect(page?.commands.at(-1)).toMatchObject({ kind: "setSwitch", switchId, value: true });
    expect(context.project.switches.some((entry) => entry.id === switchId)).toBe(true);
  });

  it("기존 이벤트에 붙일 수 있고 그래픽은 프레임 계산을 거친다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const created = runTool(context, "add_companion", { who: { query: "고양이" }, target: { mapId, x: 4, y: 4 } });
    const eventId = (created.data as { eventId: string }).eventId;

    const appended = runTool(context, "add_companion", {
      who: { textureKey: "tex_easyrpg_charset_animal", characterIndex: 1 },
      target: { eventId, mapId },
      name: "까망이",
    });

    expect(appended.ok, appended.summary).toBe(true);
    const commands: readonly Command[] = pageWithCommands(context.project, mapId, eventId)?.commands ?? [];
    const added = commands.filter((command) => command.kind === "addFollower");
    expect(added).toHaveLength(2);
    expect((added[1] as { graphic?: { pattern?: number } }).graphic?.pattern).toBe(
      charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 })
    );
  });

  it("없는 액터와 해석 불가 검색어를 거부한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;

    const badActor = runTool(context, "add_companion", { who: { actorId: "actor_nope" }, target: { mapId, x: 4, y: 4 } });
    expect(badActor.ok).toBe(false);
    expect(badActor.issues?.[0]?.code).toBe("companion-actor-missing");

    const badQuery = runTool(context, "add_companion", {
      who: { query: "존재하지않는우주선123" },
      target: { mapId, x: 4, y: 4 },
    });
    expect(badQuery.ok).toBe(false);
    expect(badQuery.issues?.[0]?.code).toBe("graphic-not-found");
  });
});
