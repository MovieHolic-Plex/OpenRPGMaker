import type { AiConfig } from "./llmClient.ts";
import type { AssistantEngineChoice } from "./localCliEngine.ts";
import { localCliProviderId } from "./localCliEngine.ts";
import type { RoleModel } from "./modelRoles.ts";
import { CODEX_ACCOUNT_PROVIDER_ID } from "./planDefaults.ts";
import type { TeamPlan, TeamRoute, TeamSlot } from "./teamPlan.ts";

export interface TeamApplyDeps {
  readonly adoptKey: (sourceId: string, modelId: string) => Promise<string | undefined>;
  readonly saveEngine: (choice: AssistantEngineChoice | undefined) => void;
  readonly saveLead: (lead: RoleModel | undefined) => void;
  readonly selectProvider: (providerId: string, workerModel: string) => void;
}

export interface TeamApplyResult {
  readonly ok: boolean;
  readonly problem?: string;
}

const LEAD_EFFORT = "medium" as const;

async function providerFor(slot: TeamSlot, deps: TeamApplyDeps): Promise<string | undefined> {
  const route: TeamRoute = slot.route;
  if (route.kind === "cli") return localCliProviderId(route.cli);
  if (route.kind === "account") return route.providerId;
  return deps.adoptKey(route.sourceId, slot.modelId);
}

export async function applyTeamPlan(plan: TeamPlan, deps: TeamApplyDeps): Promise<TeamApplyResult> {
  const workerRoute = plan.worker.route;
  const lead = plan.lead;
  const sameCli = Boolean(lead && lead.route.kind === "cli" && workerRoute.kind === "cli" && lead.route.cli === workerRoute.cli);

  const workerProvider = await providerFor(plan.worker, deps);
  if (!workerProvider) return { ok: false, problem: "연결을 확인하지 못했어요." };
  let leadRole: RoleModel | undefined;
  if (lead && !sameCli) {
    const leadProvider = await providerFor(lead, deps);
    if (leadProvider) leadRole = { provider: leadProvider, model: lead.modelId, thinkingLevel: LEAD_EFFORT };
  }

  if (workerRoute.kind === "cli") {
    deps.saveEngine({
      kind: "local-cli",
      cli: workerRoute.cli,
      routineModel: plan.worker.modelId,
      deepModel: sameCli && lead ? lead.modelId : plan.worker.modelId,
      effort: "medium",
      ...(sameCli ? { teamLead: true } : {}),
    });
  } else {
    deps.saveEngine(undefined);
    deps.selectProvider(workerProvider, plan.worker.modelId);
  }
  deps.saveLead(leadRole);
  return { ok: true };
}

export function isChatGptAccountSlot(slot: TeamSlot): boolean {
  return slot.route.kind === "account" && slot.route.providerId === CODEX_ACCOUNT_PROVIDER_ID;
}

export type AiConfigPatch = Pick<AiConfig, "providerId" | "model">;
