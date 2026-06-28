import planInput from "./rm2k3GeneratedAssetPlan.json" with { type: "json" };
import { validateGeneratedAssetManifest, type GeneratedAssetManifest } from "./generatedAssetManifest";

class GeneratedAssetPlanError extends Error {
  readonly name = "GeneratedAssetPlanError";
}

export const RM2K3_GENERATED_ASSET_PLAN = parsePlan();

function parsePlan(): GeneratedAssetManifest {
  const result = validateGeneratedAssetManifest(planInput);
  if (result.ok) return result.manifest;
  throw new GeneratedAssetPlanError(result.issues.map((issue) => `${issue.entryId ?? "manifest"}:${issue.field}:${issue.message}`).join("\n"));
}
