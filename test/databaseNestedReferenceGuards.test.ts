import { describe, expect, it, vi } from "vitest";
import { commandsResourceReference, switchVariableReferencedInProject } from "@/editor/databaseCommandReferences";
import { commonEventReferenceMessage } from "@/editor/databaseReferences";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";

const state = vi.hoisted(() => ({ project: undefined as Project | undefined }));
vi.mock("@/project/store", () => ({ store: { getCurrent: () => state.project } }));

const wrappers: [string, (child: Command) => Command][] = [
  ["shop failure", child => ({ kind: "shop", itemIds: [], failedTransactionBranch: [child] })],
  ...(["victoryBranch", "defeatBranch", "escapeBranch"] as const).map((key): [string, (child: Command) => Command] => [
    key, child => ({ kind: "battleProcessing", troopId: "troop", canEscape: true, canLose: true, [key]: [child] }),
  ]),
  ...(["successBranch", "failureBranch"] as const).flatMap((key): [string, (child: Command) => Command][] => [
    [`promotion ${key}`, child => ({ kind: "promoteActor", actorId: "actor", [key]: [child] })],
    [`evolution ${key}`, child => ({ kind: "evolveMonster", instanceId: "monster", [key]: [child] })],
  ]),
];

function projectWithCommand(command: Command): Project {
  const project = createBlankProject();
  project.commonEvents = [
    { id: "target", name: "호출 대상", trigger: "none", commands: [] },
    { id: "caller", name: "호출자", trigger: "none", commands: [{ kind: "loop", body: [command] }] },
  ];
  state.project = project;
  return project;
}

describe("nested database reference deletion guards", () => {
  it.each(wrappers)("protects common events in %s", (_name, wrap) => {
    projectWithCommand(wrap({ kind: "callCommonEvent", commonEventId: "target" }));
    expect(commonEventReferenceMessage("target")).toContain("호출 중");
    expect(commonEventReferenceMessage("unrelated")).toBeNull();
  });

  it.each(wrappers)("protects resources in %s", (_name, wrap) => {
    const project = projectWithCommand(wrap({ kind: "playAudio", resourceId: "sound", loop: false }));
    expect(commandsResourceReference(project, "sound")).toBe(true);
    expect(commandsResourceReference(project, "unrelated")).toBe(false);
  });

  it("protects the variable used to choose a troop", () => {
    const project = projectWithCommand({ kind: "battleProcessing", troopId: "", canEscape: false, canLose: false,
      troopSource: "variable", troopVariableId: "troop-selector" });
    expect(switchVariableReferencedInProject(project, "variable", "troop-selector")).toBe(true);
    expect(switchVariableReferencedInProject(project, "switch", "troop-selector")).toBe(false);
    expect(switchVariableReferencedInProject(project, "variable", "unrelated")).toBe(false);
  });
});
