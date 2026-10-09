import type { OpenAiToolSchema } from "./llmClient";
import type { Dir, Project } from "@/project/types";
import type { NpcRewardRequirement } from "@/ai/intentDeclaration";
import { isSceneTestInput } from "@/testing/sceneTestRunner";

/** Event-state comparison only: never derives reward expectations from event commands. */
export function npcRewardTargetSnapshot(project: Project, requirement: NpcRewardRequirement): string {
  const { target } = requirement;
  return JSON.stringify(Object.values(project.maps)
    .filter((map) => target.mapId === undefined || target.mapId === map.id)
    .flatMap((map) => map.events
      .filter((event) => target.eventId !== undefined ? event.id === target.eventId : (event.name ?? event.pages?.[0]?.name) === target.eventName)
      .map((event) => [map.id, event])));
}

export type NpcRewardPreludeStep = { readonly mapId: string } & (
  | { readonly kind: "walk"; readonly to: { readonly x: number; readonly y: number }; readonly adjacent?: boolean }
  | { readonly kind: "move" | "face"; readonly dir: Dir }
  | { readonly kind: "interact"; readonly eventId: string }
  | { readonly kind: "choose"; readonly index: number }
);
export interface NpcRewardWitness {
  readonly target: { readonly mapId: string; readonly eventId: string };
  readonly prelude: readonly NpcRewardPreludeStep[];
}
export interface VerifyNpcRewardInput {
  readonly requirementIndex: number;
  readonly prelude: readonly NpcRewardPreludeStep[];
}

/** Full admission before target lookup or any runtime execution. Never strip unknown fields. */
export function isVerifyNpcRewardInput(input: unknown): input is VerifyNpcRewardInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const record = input as Record<string, unknown>;
  return Object.keys(record).length === 2 && Object.hasOwn(record, "requirementIndex") && Object.hasOwn(record, "prelude")
    && Number.isSafeInteger(record.requirementIndex) && (record.requirementIndex as number) >= 0
    && Array.isArray(record.prelude) && record.prelude.length <= 256 && record.prelude.every(value => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
      const { mapId, ...action } = value as Record<string, unknown>;
      if (typeof mapId !== "string" || !mapId.trim()) return false;
      if (!["walk", "move", "face", "interact", "choose"].includes(String(action.kind))) return false;
      if (action.kind === "interact" && typeof action.eventId !== "string") return false;
      if (action.kind === "move" && (Object.hasOwn(action, "to") || !Object.hasOwn(action, "dir"))) return false;
      return isSceneTestInput({ mapId, start: { x: 0, y: 0 }, steps: [action] });
    });
}

export const VERIFY_NPC_REWARD_TOOL: OpenAiToolSchema = {
  type: "function",
  function: {
    name: "verify_npc_reward",
    description: "Replay a legitimate prerequisite route from authored game start, then host-owned NPC claim/repeat against the captured requirementIndex. Arguments are exactly requirementIndex and prelude; omit reason (exception to the usual tool reason rule). mapId asserts the current map; walk executes intermediate touch transfers. Only actions, never state or expectations. Author prerequisite maps/chests first, separate transfer links next, reward NPC and verification last using set_work_plan. A failed replay remains pending; do not move reward timing or skip gates.",
    parameters: {
      type: "object", additionalProperties: false, required: ["requirementIndex", "prelude"],
      properties: {
        requirementIndex: { type: "integer", minimum: 0 },
        prelude: {
          type: "array", maxItems: 256,
          items: {
            type: "object", additionalProperties: false, required: ["kind", "mapId"],
            properties: {
              kind: { type: "string", enum: ["walk", "move", "face", "interact", "choose"] },
              mapId: { type: "string" },
              to: { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } } },
              adjacent: { type: "boolean" }, dir: { type: "string", enum: ["up", "down", "left", "right"] },
              eventId: { type: "string" }, index: { type: "integer", minimum: -1 },
            },
          },
        },
      },
    },
  },
};
