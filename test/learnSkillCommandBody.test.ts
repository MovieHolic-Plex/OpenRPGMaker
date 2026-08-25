import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { runCommandContract } from "./commandContracts/harness";

describe("learnSkill modern form + forget/party", () => {
  let restoreDom: (() => void) | undefined;
  let staged: Command;

  const actions: CommandListActions = {
    addCommand: () => undefined,
    insertCommand: () => undefined,
    deleteCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
    replaceCommand: (_path, command) => {
      staged = command;
    },
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    if (project.database.skills[0]) project.database.skills[0].name = "파이어";
    store.replace(project);
    staged = { kind: "learnSkill", actorId: "", skillId: project.database.skills[0]?.id ?? "", action: "learn" };
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("폼에 액션/대상/특수기 픽커를 노출한다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    expect(findByTestId(body, "event-command-learn-skill-form")).toBeTruthy();
    expect(findByTestId(body, "learn-skill-action-select")).toBeTruthy();
    expect(findByTestId(body, "learn-skill-target-mode")).toBeTruthy();
    expect(findByTestId(body, "learn-skill-skill-select")).toBeTruthy();
    expect(findByTestId(body, "learn-skill-preview")).toBeTruthy();
  });

  it("망각 액션을 저장한다", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const action = findByTestId(body, "learn-skill-action-select") as unknown as HTMLSelectElement;
    action.value = "forget";
    action.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("learnSkill");
    if (staged.kind !== "learnSkill") return;
    expect(staged.action).toBe("forget");
  });

  it("주인공 대상 모드에서 actorId 를 저장한다", () => {
    const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, staged)
    );
    const target = findByTestId(body, "learn-skill-target-mode") as unknown as HTMLSelectElement;
    target.value = "actor";
    target.dispatchEvent(new Event("change"));
    const actorSelect = findByTestId(body, "learn-skill-actor-select") as unknown as HTMLSelectElement;
    actorSelect.value = actorId;
    actorSelect.dispatchEvent(new Event("change"));
    expect(staged.kind).toBe("learnSkill");
    if (staged.kind !== "learnSkill") return;
    expect(staged.actorId).toBe(actorId);
  });

  it("요약에 파티/망각을 표시한다", () => {
    const skillId = store.getCurrent().database.skills[0]?.id ?? "skill_1";
    expect(commandSummary({
      kind: "learnSkill",
      actorId: "",
      skillId,
      action: "forget",
    })).toContain("파티 전체");
    expect(commandSummary({
      kind: "learnSkill",
      actorId: "",
      skillId,
      action: "forget",
    })).toContain("잊기");
    expect(commandSummary({
      kind: "learnSkill",
      actorId: "",
      skillId,
      action: "forget",
    })).toContain("파이어");
  });

  it("런타임: 파티 전체에 스킬을 습득시킨다", () => {
    const skillId = "skill_fire";
    const result = runCommandContract([
      { kind: "learnSkill", actorId: "", skillId, action: "learn" },
    ], {
      mutateSession: (session) => {
        session.partyActorIds = ["actor_a", "actor_b"];
        session.actorSkillIds = { actor_a: [], actor_b: ["skill_old"] };
      },
    });
    expect(result.session.actorSkillIds?.actor_a).toEqual([skillId]);
    expect(result.session.actorSkillIds?.actor_b).toEqual(["skill_old", skillId]);
  });

  it("런타임: 망각은 목록에서 제거한다", () => {
    const result = runCommandContract([
      { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire", action: "forget" },
    ], {
      mutateSession: (session) => {
        session.actorSkillIds = { actor_hero: ["skill_fire", "skill_ice"] };
      },
    });
    expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_ice"]);
  });

  it("런타임: 레거시 action 없는 형태는 습득으로 유지한다", () => {
    const result = runCommandContract([
      { kind: "learnSkill", actorId: "actor_hero", skillId: "skill_fire" },
    ], {
      mutateSession: (session) => {
        session.actorSkillIds = { actor_hero: [] };
      },
    });
    expect(result.session.actorSkillIds?.actor_hero).toEqual(["skill_fire"]);
  });
});
