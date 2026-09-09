import { createBlankProject } from "@/project/defaults";
import { parseAcceptanceCriteriaResult } from "@/ai/assistantAcceptance";
import { verificationEvent } from "./verificationOwnership";
import recordedCriteria from "./p7ApproachCriteria.json";

/** Disclosed P7 entry-223 recipe; synthetic local content, NOT historical floor or physical-game proof. */
export function p7Approach() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.events = [];
  map.encounterRate = 0;
  project.maps.map_basement = { ...structuredClone(map), id: "map_basement", name: "Regression cellar" };
  const keyId = "item_brass_key";
  project.database.items.push({ ...project.database.items[0]!, id: keyId });
  const door = verificationEvent("ev_door", 10, 0, [{ kind: "text", body: "잠겨 있습니다." }]);
  const base = door.pages![0]!;
  door.pages = [base, { ...base, id: "key", conditions: [{ kind: "item", itemId: keyId, present: true }], commands: [
    { kind: "changeItem", itemId: keyId, op: "-=", amount: 1 },
    { kind: "setFlag", flag: "ending:ending_escape", value: true },
    { kind: "setSelfSwitch", key: "A", value: true },
  ] }, { ...base, id: "open", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [] }];
  map.events.push(door);
  const criteria = [...parseAcceptanceCriteriaResult(recordedCriteria).criteria!];
  const criterion = criteria[13]!;
  if (criterion.kind !== "toolVerdict") throw new Error("Recorded canonical scene missing");
  const args = structuredClone(criterion.args);
  return { project, map, door, criteria, args, corrected: { ...args, steps: [
    ...(args.steps as unknown[]).slice(0, 1), { kind: "walk", to: { x: 10, y: 0 }, adjacent: true },
    ...(args.steps as unknown[]).slice(1),
  ] } };
}
