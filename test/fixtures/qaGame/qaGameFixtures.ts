// 게임 검사기(src/qa/gameCheck) 픽스처 — 작은 모험 게임 하나와, 도그푸딩에서 나온 네 가지 막힘을 하나씩 심은 변형.
//
//   clean              시작 마을 → 문 → 동굴(보스전 → 스위치) → 할아버지(스위치 페이지 → 엔딩). 동료 합류 포함.
//   emptyChoices       합류 선택지의 분기가 전부 빈 배열(옛 eventCompile 이 branch 를 버리던 결함)
//   speciesIdParty     changeParty 에 actorId 대신 speciesId(파티에 null → 보스전 Missing actor)
//   endingSwitchUnset  엔딩 페이지를 여는 스위치를 켜는 곳이 없음(보스전 승리 분기에 setSwitch 없음)
//   orphanMaps         기획의 던전·등대가 연결도 이벤트도 없는 빈 껍데기 / 들어가는 문이 없는 맵

import { createBlankProject } from "@/project/defaults/defaultProject";
import { runTool } from "@/editor/tools";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

function page(id: string, commands: Command[], options: Partial<EventPage> = {}): EventPage {
  return {
    id, name: id, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...options,
  };
}

function event(id: string, name: string, x: number, y: number, pages: EventPage[]): GameEvent {
  return { id, name, x, y, trigger: pages[0]!.trigger, commands: [], pages };
}

export const SW_BOSS = "sw_0001";
export const SW_KAI = "sw_0002";

export type QaFixtureName = "clean" | "emptyChoices" | "speciesIdParty" | "endingSwitchUnset" | "orphanMaps";

export function buildQaFixture(name: QaFixtureName): Project {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "map_cave", name: "얼음 동굴", width: 20, height: 15 });
  if (!created.ok) throw new Error(created.summary);
  const project = ctx.project;
  project.meta.title = `QA 픽스처 ${name}`;
  project.switches.find((s) => s.id === SW_BOSS)!.name = "보스 격파";
  project.switches.find((s) => s.id === SW_KAI)!.name = "카이 합류";
  project.endings = [{ id: "ending_light", name: "등대의 불", conditions: [], priority: 1 }];
  const start = project.maps[project.startMapId]!;
  const cave = project.maps.map_cave!;

  const joinBranch: Command[] = name === "emptyChoices" ? [] : [
    { kind: "text", speaker: "카이", body: "같이 가자!" },
    name === "speciesIdParty"
      ? ({ kind: "changeParty", speciesId: "actor_scout", level: 1, action: "add" } as unknown as Command)
      : { kind: "changeParty", actorId: "actor_scout", action: "add" },
    { kind: "setSwitch", switchId: SW_KAI, value: true },
  ];
  start.events.push(
    event("ev_kai", "카이", 12, 8, [
      page("kai_p1", [
        { kind: "text", speaker: "카이", body: "동굴에 가는 거야?" },
        { kind: "choices", options: [{ text: "같이 가자", branch: joinBranch }, { text: "혼자 갈게", branch: name === "emptyChoices" ? [] : [{ kind: "text", body: "조심해." }] }] },
      ]),
      page("kai_p2", [{ kind: "text", speaker: "카이", body: "가자!" }], { conditions: [{ kind: "switch", switchId: SW_KAI, value: true }] }),
    ]),
    event("ev_cave_door", "동굴 입구", 16, 8, [
      page("door", [{ kind: "transfer", mapId: "map_cave", x: 3, y: 7 }], { trigger: { kind: "playerTouch" }, priority: "below" }),
    ]),
  );
  const bossVictory: Command[] = name === "endingSwitchUnset"
    ? [{ kind: "text", body: "정령이 사라졌다." }]
    : [{ kind: "text", body: "정령이 사라졌다." }, { kind: "setSwitch", switchId: SW_BOSS, value: true }];
  cave.events.push(
    event("ev_cave_exit", "출구", 1, 7, [
      page("exit", [{ kind: "transfer", mapId: start.id, x: 15, y: 8 }], { trigger: { kind: "playerTouch" }, priority: "below" }),
    ]),
    event("ev_boss", "눈보라 정령", 10, 7, [
      page("boss", [
        { kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: true, branchOnResult: true, victoryBranch: bossVictory, defeatBranch: [{ kind: "text", body: "다시 도전하자." }] },
      ]),
      page("boss_gone", [], { conditions: [{ kind: "switch", switchId: SW_BOSS, value: true }], trigger: { kind: "action" } }),
    ]),
    event("ev_grandpa", "할아버지", 14, 7, [
      page("grandpa_p1", [{ kind: "text", speaker: "할아버지", body: "정령을 물리쳐 다오." }]),
      page("grandpa_p2", [
        { kind: "text", speaker: "할아버지", body: "고맙다. 등대에 불을 켜자." },
        { kind: "triggerEnding", endingId: "ending_light" },
      ], { conditions: [{ kind: "switch", switchId: SW_BOSS, value: true }] }),
    ]),
  );
  if (name === "orphanMaps") {
    const dungeon = runTool(ctx, "create_map", { id: "map_frozen_cave", name: "얼어붙은 해안 동굴", width: 30, height: 20 });
    const tower = runTool(ctx, "create_map", { id: "map_lighthouse", name: "등대 꼭대기", width: 20, height: 16 });
    if (!dungeon.ok || !tower.ok) throw new Error("fixture map");
    ctx.project.maps.map_lighthouse!.events.push(event("ev_tower_npc", "등대지기", 5, 5, [page("t", [{ kind: "text", body: "…" }])]));
    return ctx.project;
  }
  return project;
}
