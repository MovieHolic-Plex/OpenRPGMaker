import { describe, expect, it } from "vitest";
import { buildTurnGuide } from "@/ai/turnGuide";
import {
  MAX_VOLUME_CONTINUES_PER_TURN,
  buildVolumeWorkPlan,
  formatVolumeContinueMessage,
  measureVolume,
  placedNpcIdFrom,
  requestNeedsVolumePlan,
  verifyPlacedNpcsHaveStatePages,
  volumeBarForRequest,
  volumeGaps,
  volumeUnmet,
} from "@/ai/volumeContract";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";

function withEvents(events: GameEvent[]): Project {
  const project = createBlankProject();
  const map = Object.values(project.maps)[0] as GameMap;
  map.events = events;
  return project;
}

function npc(id: string, pages: Array<{ conditions: unknown[]; commands?: Command[] }>): GameEvent {
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
      commands: page.commands ?? [],
    })),
  } as GameEvent;
}

describe("volume contract — 어떤 요청이 막을 세우나", () => {
  it("마을/RPG 신규 요청은 계획을 강제하고 그린필드 막대를 쓴다", () => {
    expect(requestNeedsVolumePlan("빈 프로젝트에 강이 있는 마을을 하나 만들어줘")).toBe(true);
    expect(volumeBarForRequest("빈 프로젝트에 강이 있는 마을을 하나 만들어줘")).toEqual({
      authoredMaps: 1,
      multiPageNpcs: 3,
      shops: 1,
      quests: 0,
    });
    expect(requestNeedsVolumePlan("중형 RPG를 만들어줘")).toBe(true);
    expect(volumeBarForRequest("중형 알피지 캠페인을 만들어줘")).toEqual({
      authoredMaps: 3,
      multiPageNpcs: 6,
      shops: 1,
      quests: 1,
    });
  });

  it("기존 마을 수정은 그린필드 막대를 씌우지 않는다", () => {
    expect(requestNeedsVolumePlan("이 마을 담장 좀 고쳐줘")).toBe(false);
    expect(volumeBarForRequest("이 마을 담장 좀 고쳐줘")).toBeNull();
  });

  it("기존 NPC 수정은 얇은 막대만 쓰고 그린필드 계획은 강제하지 않는다", () => {
    expect(requestNeedsVolumePlan("이 촌장 대사를 고쳐줘")).toBe(false);
    expect(volumeBarForRequest("이 촌장 대사를 고쳐줘")).toEqual({
      authoredMaps: 0,
      multiPageNpcs: 1,
      shops: 0,
      quests: 0,
    });
  });

  it("NPC만 만드는 요청은 계획 강제 없이 다중 페이지 1명만 요구한다", () => {
    expect(requestNeedsVolumePlan("촌장 NPC 만들어줘")).toBe(false);
    expect(volumeBarForRequest("촌장 NPC 만들어줘")).toEqual({
      authoredMaps: 0,
      multiPageNpcs: 1,
      shops: 0,
      quests: 0,
    });
  });
});

describe("volume contract — 패널 가이드 문구는 막대를 세우지 않는다", () => {
  // 2026-09-03 실측(「여관 지어줘」 감사 로그): 패널이 붙인 「도구 규칙」 가이드의 마을·상점·NPC 낱말이
  // 의도 스캔에 섞여 volume-contract:forced-plan 이 찍히고, 여관 완성 뒤 「상점 +0」 재주입으로
  // 시작 맵에 마을·NPC 3명·상점을 덤으로 지었다.
  it("「여관 지어줘」 + 도구 규칙 가이드 + footer 는 계획 강제도 막대도 없다", () => {
    const guide = buildTurnGuide({ instruction: "여관 지어줘" });
    expect(guide).toMatch(/마을|상점/u);
    const payload = ["여관 지어줘", guide, "[컨텍스트] 현재 맵: 빈 맵 (map_blank_start)"].join("\n\n");
    expect(requestNeedsVolumePlan(payload)).toBe(false);
    expect(volumeBarForRequest(payload)).toBeNull();
  });

  it("마을 요청은 가이드가 붙어도 종전 막대 그대로다", () => {
    const guide = buildTurnGuide({ instruction: "강이 있는 마을을 만들어줘" });
    const payload = ["강이 있는 마을을 만들어줘", guide].join("\n\n");
    expect(requestNeedsVolumePlan(payload)).toBe(true);
    expect(volumeBarForRequest(payload)).toEqual({ authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0 });
  });

  it("강제 계획의 항목은 막대가 요구하는 축만 — 상점만 부족한 막대에 허브 맵·NPC 항목이 붙지 않는다", () => {
    const shopOnly = buildVolumeWorkPlan("상점 하나 만들어줘");
    const titles = shopOnly.layers.flatMap((layer) => layer.items.map((item) => item.title));
    expect(titles).toEqual(["상점"]);
    const village = buildVolumeWorkPlan("마을을 만들어줘");
    expect(village.layers.flatMap((layer) => layer.items.map((item) => item.title))).toEqual(["허브 맵", "상태별 NPC", "상점"]);
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
      npc("ev_shop", [{ conditions: [], commands: [{ kind: "shop", stock: [] } as Command] }]),
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

  it("볼륨 계획은 place_npc / set_shop_stock 항목을 강제한다", () => {
    const plan = buildVolumeWorkPlan("마을을 만들어줘", new Date("2026-09-01T00:00:00.000Z"));
    const titles = plan.layers.flatMap((layer) => layer.items.map((item) => item.title));
    expect(titles).toContain("허브 맵");
    expect(titles).toContain("상태별 NPC");
    expect(titles).toContain("상점");
    expect(plan.plannerNote).toContain("volume-contract");
  });

  it("재주입 상한은 사용자 상한이 아니라 안전핀이다", () => {
    expect(MAX_VOLUME_CONTINUES_PER_TURN).toBe(8);
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
