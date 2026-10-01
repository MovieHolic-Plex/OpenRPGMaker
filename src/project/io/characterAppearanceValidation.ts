import { findSharedPortrait } from "@/assets/sharedPortraitAssets";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import type { Project } from "../types";
import { assert, requireArray, requireNumber, requireRecord, requireString } from "./guards";

export function validateCharacterAppearances(value: unknown): void {
  const ids = new Set<string>();
  for (const [index, raw] of requireArray("database.characterAppearances", value).entries()) {
    const label = `database.characterAppearances[${index}]`;
    const record = requireRecord(label, raw);
    const id = requireString(`${label}.id`, record.id);
    assert(id.trim().length > 0 && !ids.has(id), `${label}.id is blank or duplicated: ${id}`);
    ids.add(id);
    requireString(`${label}.name`, record.name);
    requireString(`${label}.description`, record.description);
    for (const key of ["charset", "face", "bust"] as const) {
      if (record[key] === undefined) continue;
      const slot = requireRecord(`${label}.${key}`, record[key]);
      assert(requireString(`${label}.${key}.resourceId`, slot.resourceId).trim().length > 0, `${label}.${key}.resourceId is blank`);
      if (key === "charset") {
        const cell = requireNumber(`${label}.charset.characterIndex`, slot.characterIndex);
        assert(Number.isInteger(cell) && cell >= 0 && cell <= 7, `${label}.charset.characterIndex must be an integer from 0 to 7`);
      }
    }
  }
}

export function characterAppearanceReferenceIssues(project: Project): string[] {
  const issues: string[] = [];
  for (const appearance of project.database.characterAppearances ?? []) {
    for (const [slot, expectedKind] of [["charset", "charset"], ["face", "faceset"], ["bust", "picture"]] as const) {
      const id = appearance[slot]?.resourceId;
      if (id === undefined) continue;
      const uploaded = project.assets.uploaded[id];
      if (slot === "charset" && uploaded && (
        (uploaded.meta.width !== undefined && uploaded.meta.width !== RESOURCE_SLICING.charset.sheetWidth)
        || (uploaded.meta.height !== undefined && uploaded.meta.height !== RESOURCE_SLICING.charset.sheetHeight)
        || (uploaded.meta.frameWidth !== undefined && uploaded.meta.frameWidth !== RESOURCE_SLICING.charset.cellWidth)
        || (uploaded.meta.frameHeight !== undefined && uploaded.meta.frameHeight !== RESOURCE_SLICING.charset.cellHeight)
      )) issues.push(`characterAppearance ${appearance.id}: charset upload requires the 288x256, 24x32 layout: ${id}`);
      const kind = uploaded?.kind
        ?? (CHARSET_ASSETS.some((asset) => asset.id === id || asset.textureKey === id) ? "charset" : undefined)
        ?? (FACESET_FACE_ASSETS.some((asset) => asset.id === id) ? "faceset" : undefined)
        ?? EASYRPG_RTP_ASSETS.find((asset) => asset.id === id)?.category
        ?? (id === "generated-face-actor1-bust" || id === "generated-face-actor1-full" || findSharedPortrait(id) ? "picture" : undefined)
        ?? GENERATED_ASSET_PLAN.assets.find((asset) => asset.resourceId === id && asset.status === "promoted" && (asset.resourceKind === "faceset" || asset.resourceKind === "picture"))?.resourceKind
        ?? project.resourceProfiles.find((profile) => profile.assetId === id)?.kind;
      if (kind !== expectedKind) issues.push(`characterAppearance ${appearance.id}: ${slot} requires an existing ${expectedKind} resource: ${id}`);
    }
  }
  return issues;
}
