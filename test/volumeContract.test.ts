import { describe, expect, it } from "vitest";
import {
  MAX_VOLUME_CONTINUES_PER_TURN,
  formatVolumeContinueMessage,
  measureVolume,
  placedNpcIdFrom,
  verifyPlacedNpcsHaveStatePages,
  volumeGaps,
  volumeUnmet,
} from "@/ai/volumeContract";
import { parsePlannerVolume } from "@/ai/workPlan";
import { createBlankProject } from "@/project/defaults";
import type { Command, Condition, GameEvent, Project } from "@/project/types";

function withEvents(events: GameEvent[]): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = events;
  return project;
}

function npc(id: string, pages: Array<{ conditions: Condition[]; commands?: Command[] }>): GameEvent {
  return {
    id,
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: pages.map((page, index) => ({
      id: `p${index}`,
      name: `p${index}`,
      conditions: page.conditions,
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 4, frequency: 3 },
      commands: page.commands ?? [],
    })),
  };
}

describe("volume contract — 막대는 플래너가 선언한다", () => {
  // 2026-09-03 실측: 「마을|RPG」 정규식 막대가 「이 마을에 상인 하나 추가해줘」를 맵 3장·NPC 6명으로 키우고,
  // 「마을은 만들지 말고 여관만」의 부정을 읽지 못했다. 문장에서 막대를 만드는 함수는 이제 없다.
  it("플래너 volume 은 0 이상 정수만 받고 전부 0 이면 없는 것이다", () => {
    expect(parsePlannerVolume({ authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0 })).toEqual({
      authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0,
    });
    expect(parsePlannerVolume({ authoredMaps: -2, multiPageNpcs: 2.9, shops: "1", quests: 999 })).toEqual({
      authoredMaps: 0, multiPageNpcs: 2, shops: 0, quests: 999,
    });
    expect(parsePlannerVolume({ authoredMaps: 0, multiPageNpcs: 0, shops: 0, quests: 0 })).toBeNull();
    expect(parsePlannerVolume(undefined)).toBeNull();
    expect(parsePlannerVolume("many")).toBeNull();
  });
});

describe("volume contract — 델타 측정", () => {
  it("빈 프로젝트는 저작 맵 0, 한 줄 NPC는 다중 페이지로 세지 않는다", () => {
    const before = measureVolume(createBlankProject());
    expect(before.authoredMaps).toBe(0);
    expect(before.multiPageNpcs).toBe(0);
    const after = measureVolume(
      withEvents([
        npc("ev_thin", [{ conditions: [] }, { conditions: [] }]),
        npc("ev_state", [
          { conditions: [] },
          { conditions: [{ kind: "selfSwitch", key: "A", value: true }] },
        ]),
      ]),
    );
    expect(after.multiPageNpcs).toBe(1);
  });

  it("상점은 shop 커맨드가 있는 이벤트로 센다", () => {
    const project = withEvents([
      npc("ev_shop", [{ conditions: [], commands: [{ kind: "shop", itemIds: [] }] }]),
    ]);
    expect(measureVolume(project).shops).toBe(1);
  });

  it("막대 미달은 gaps + unmet 으로만 판정한다", () => {
    const before = measureVolume(createBlankProject());
    const after = measureVolume(createBlankProject());
    const bar = { authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0 };
    const gaps = volumeGaps(before, after, bar);
    expect(gaps.some((gap) => gap.includes("맵"))).toBe(true);
    expect(gaps.some((gap) => gap.includes("NPC"))).toBe(true);
    expect(volumeUnmet(before, after, bar)).toBe(true);
    expect(formatVolumeContinueMessage(gaps)).toContain("HARNESS CONTINUE");
    expect(formatVolumeContinueMessage(gaps)).toContain("Do not ask the user to continue");
  });

  it("재주입 상한은 사용자 상한이 아니라 안전핀이다", () => {
    expect(MAX_VOLUME_CONTINUES_PER_TURN).toBe(3);
  });
});

describe("volume contract — 상태별 NPC 게이트", () => {
  it("place_npc 결과 eventId 를 뽑는다", () => {
    expect(placedNpcIdFrom("place_npc", { eventId: "ev_chief" })).toBe("ev_chief");
    expect(placedNpcIdFrom("make_villager", undefined, { eventId: "ev_from_args" })).toBe("ev_from_args");
    expect(placedNpcIdFrom("fill_region", { eventId: "nope" })).toBeNull();
  });

  it("한 줄 인사 NPC 는 완료를 막고, 조건이 다른 페이지면 통과한다", () => {
    const project = withEvents([
      npc("ev_thin", [{ conditions: [] }]),
      npc("ev_ok", [
        { conditions: [] },
        { conditions: [{ kind: "switch", switchId: "story_met", value: true }] },
      ]),
    ]);
    const blocked = verifyPlacedNpcsHaveStatePages(project, ["ev_thin"]);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toContain("ev_thin");
    expect(verifyPlacedNpcsHaveStatePages(project, ["ev_ok"]).ok).toBe(true);
    expect(verifyPlacedNpcsHaveStatePages(project, []).ok).toBe(true);
  });
});
