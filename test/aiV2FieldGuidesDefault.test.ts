// 조수 v2 가 지은 게임은 필드 안내(곁 화살표 · 대상 빛무리 · 머리 위 ▼ · 목표 글의 「어디」 꼬리)를 끈 채로 출하한다.
// 2026-11-12 r1w-fun 을 해 본 오너: 「화살표로 방향 다 설명하는 것도 열받고」. 목표 명령의 글·대상은 그대로 남아 자동 플레이가 따라가고,
// 사용자가 켜 달라고 하면(set_project_settings{fieldGuides:"on"}) 다음 끝맺음이 다시 끄지 않는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { runTool } from "@/editor/tools";
import { quietFieldGuides } from "@/ai/v2/story/shipObjectiveDefaults";
import { objectiveCommand, objectiveTargetOf } from "@/ai/v2/judge/objectiveCommand";
import { fieldGuidesOn, objectiveSentence, objectiveShown } from "@/player/objectiveTarget";
import type { Project } from "@/project/types";

const named = (maps: Record<string, string[]>) => ({
  maps: Object.fromEntries(Object.entries(maps).map(([name, events], i) => [`m${i}`, { id: `m${i}`, name, events: events.map((n, k) => ({ id: `e${i}_${k}`, name: n })) }])),
}) as never;

describe("v2 ship default: field guides off unless somebody chose", () => {
  it("turns the guides off once and says so", () => {
    const p = createBlankProject() as Project;
    expect(p.system.fieldGuides).toBeUndefined();
    expect(quietFieldGuides(p)).toHaveLength(1);
    expect(p.system.fieldGuides).toBe("off");
    expect(quietFieldGuides(p)).toEqual([]);
  });

  it("keeps an explicit on (the user asked for a guide arrow) and survives save → load", () => {
    const ctx = { project: createBlankProject() as Project };
    expect(runTool(ctx, "set_project_settings", { fieldGuides: "on" }).ok).toBe(true);
    expect(ctx.project.system.fieldGuides).toBe("on");
    expect(quietFieldGuides(ctx.project)).toEqual([]);
    const loaded = deserialize(serialize(ctx.project));
    expect(loaded.system.fieldGuides).toBe("on");
    expect(fieldGuidesOn(loaded)).toBe(true);
    expect(runTool(ctx, "set_project_settings", { fieldGuides: "off" }).ok).toBe(true);
    expect(deserialize(serialize(ctx.project)).system.fieldGuides).toBe("off");
  });

  it("does not touch the objective data — text tail and target stay for the machine player", () => {
    const p = createBlankProject() as Project;
    const command = objectiveCommand("주술사에게 숫자를 받아 오자 (주술사의 오두막 입구: 서쪽 → 주술사)", { mapId: "m", eventId: "e" });
    const map = p.maps[p.startMapId]!;
    map.events.push({ id: "ev_x", name: "촌장", x: 1, y: 1, pages: [{ id: "p", trigger: { kind: "action" }, priority: "same", graphic: {}, conditions: [], commands: [command] }] } as never);
    const before = JSON.stringify(map.events);
    quietFieldGuides(p);
    expect(JSON.stringify(map.events)).toBe(before);
    expect(objectiveTargetOf(command)).toEqual({ mapId: "m", eventId: "e" });
  });
});

describe("runtime: with the guides off the objective shows its sentence only", () => {
  const game = named({ "부족 마을": ["떠돌이 상인", "촌장"], "주술사의 오두막": ["주술사", "번호 쪽지"], "늪지": ["늪 괴수"] });

  it("reads the switch: omitted and on = on, off and the old arrows = off", () => {
    expect(fieldGuidesOn({ system: {} })).toBe(true);
    expect(fieldGuidesOn({ system: { fieldGuides: "on" } })).toBe(true);
    expect(fieldGuidesOn({ system: { fieldGuides: "off" } })).toBe(false);
    expect(fieldGuidesOn({ system: { fieldGuides: "arrows" } })).toBe(false);
  });

  it("drops every tail shape the builders write", () => {
    expect(objectiveSentence(game, "주술사의 오두막에 가서 조상의 숫자를 받아 오자 (주술사의 오두막 입구: 서쪽 → 주술사)")).toBe("주술사의 오두막에 가서 조상의 숫자를 받아 오자");
    expect(objectiveSentence(game, "주술사의 오두막에 가서 조상의 숫자를 받아 오자 (주술사)")).toBe("주술사의 오두막에 가서 조상의 숫자를 받아 오자");
    expect(objectiveSentence(game, "늪 괴수를 물리친다 (부족 마을 입구: 이 맵 남쪽 끝 가운데 → 부족 마을에서 동쪽 끝 가운데 → 늪지 · 늪 괴수)")).toBe("늪 괴수를 물리친다");
    expect(objectiveSentence(game, "번호 쪽지를 살펴보자 (번호 쪽지: 「떠돌이 상인」 옆)")).toBe("번호 쪽지를 살펴보자");
    expect(objectiveSentence(game, "문을 열자 (북서쪽)")).toBe("문을 열자");
    expect(objectiveSentence(game, "촌장을 찾아가자 (촌장 / 떠돌이 상인: 부족 마을 남쪽)")).toBe("촌장을 찾아가자");
    // 이름 없는 표지(회복의 샘)도 「무엇: 자리」 꼴이면 꼬리다.
    expect(objectiveSentence(game, "「촌장」을 찾아가자 (회복의 샘: 부족 마을 남쪽)")).toBe("「촌장」을 찾아가자");
  });

  it("keeps what the author wrote in parentheses and a text that is only a tail", () => {
    expect(objectiveSentence(game, "약초를 모으자 (0/3)")).toBe("약초를 모으자 (0/3)");
    expect(objectiveSentence(game, "약초를 모으자 (세 개)")).toBe("약초를 모으자 (세 개)");
    expect(objectiveSentence(game, "약초를 모으자 (세 개 / 주술사)")).toBe("약초를 모으자 (세 개 / 주술사)");
    expect(objectiveSentence(game, "단추를 누르자 (오른쪽)")).toBe("단추를 누르자 (오른쪽)");
    expect(objectiveSentence(game, "약초를 모으자 (주의: 독초는 빼고)")).toBe("약초를 모으자 (주의: 독초는 빼고)");
    expect(objectiveSentence(game, "(주술사)")).toBe("(주술사)");
    expect(objectiveSentence(game, "별의 정령에게 소원을 빌자")).toBe("별의 정령에게 소원을 빌자");
  });

  it("shows the tail read from the current map when the guides are on", () => {
    const text = "조상의 숫자를 받아 오자 (주술사의 오두막 입구: 서쪽 → 주술사)";
    const hut = { name: "주술사의 오두막", events: [] } as never;
    expect(objectiveShown({ ...(game as object), system: {} } as never, hut, text)).toBe("조상의 숫자를 받아 오자 (주술사)");
    expect(objectiveShown({ ...(game as object), system: { fieldGuides: "off" } } as never, hut, text)).toBe("조상의 숫자를 받아 오자");
  });
});
