import { assert, requireArray, requireNumber, requireRecord, requireString } from "./guards";

/** Additive authored campaign metadata. No save-session state or inferred defaults. */
export function validateMonsterCampaign(value: unknown): void {
  const campaign = requireRecord("system.monsterCampaign", value);
  for (const key of ["id", "name"]) requireString(`monsterCampaign.${key}`, campaign[key]);
  const species = requireArray("monsterCampaign.speciesIds", campaign.speciesIds);
  species.forEach(id => requireString("monsterCampaign.speciesId", id));
  assert(new Set(species).size === species.length, "Duplicate campaign species id");
  const notes = requireRecord("monsterCampaign.speciesNotes", campaign.speciesNotes);
  Object.values(notes).forEach(note => requireString("monsterCampaign.speciesNote", note));
  const badges = requireArray("monsterCampaign.badges", campaign.badges);
  for (const value of badges) {
    const badge = requireRecord("monsterCampaign.badge", value);
    for (const key of ["id", "name", "switchId", "cityMapId"]) requireString(`monsterCampaign.badge.${key}`, badge[key]);
  }
  const locations = requireArray("monsterCampaign.locations", campaign.locations);
  for (const value of locations) {
    const location = requireRecord("monsterCampaign.location", value);
    for (const key of ["mapId", "name", "kind"]) requireString(`monsterCampaign.location.${key}`, location[key]);
    assert(["town", "route", "dungeon", "league"].includes(location.kind as string), "Invalid campaign location kind");
    requireNumber("monsterCampaign.location.x", location.x);
    requireNumber("monsterCampaign.location.y", location.y);
  }
  const objectives = requireArray("monsterCampaign.objectives", campaign.objectives);
  for (const value of objectives) {
    const objective = requireRecord("monsterCampaign.objective", value);
    for (const key of ["id", "title", "switchId"]) requireString(`monsterCampaign.objective.${key}`, objective[key]);
    if (objective.requiresSwitchId !== undefined) requireString("monsterCampaign.objective.requiresSwitchId", objective.requiresSwitchId);
  }
}
