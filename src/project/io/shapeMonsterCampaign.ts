import { assert, requireArray, requireNumber, requireRecord, requireString } from "./guards";

/** Additive authored campaign metadata. No save-session state or inferred defaults. */
export function validateMonsterCampaign(value: unknown): void {
  const campaign = requireRecord("system.monsterCampaign", value);
  for (const key of ["id", "name"]) requireString(`monsterCampaign.${key}`, campaign[key]);
  if (campaign.plan !== undefined) {
    const plan = requireRecord("monsterCampaign.plan", campaign.plan);
    for (const key of ["gyms", "species", "maps", "links"]) {
      const n = requireNumber(`monsterCampaign.plan.${key}`, plan[key]);
      assert(Number.isInteger(n) && n >= 0 && n <= 4096, `monsterCampaign.plan.${key} 는 0 이상의 정수여야 합니다`);
    }
  }
  if (campaign.dexRegisteredText !== undefined) {
    const text = requireString("monsterCampaign.dexRegisteredText", campaign.dexRegisteredText);
    assert(text.length <= 80, "monsterCampaign.dexRegisteredText 는 80자 이하여야 합니다");
  }
  const species = requireArray("monsterCampaign.speciesIds", campaign.speciesIds);
  species.forEach(id => requireString("monsterCampaign.speciesId", id));
  assert(new Set(species).size === species.length, "Duplicate campaign species id");
  const notes = requireRecord("monsterCampaign.speciesNotes", campaign.speciesNotes);
  Object.values(notes).forEach(note => requireString("monsterCampaign.speciesNote", note));
  const badges = requireArray("monsterCampaign.badges", campaign.badges);
  for (const value of badges) {
    const badge = requireRecord("monsterCampaign.badge", value);
    for (const key of ["id", "name", "switchId", "cityMapId"]) requireString(`monsterCampaign.badge.${key}`, badge[key]);
    if (badge.iconResourceId !== undefined) requireString("monsterCampaign.badge.iconResourceId", badge.iconResourceId);
  }
  if (campaign.obedienceLevelCaps !== undefined) {
    const rule = requireRecord("monsterCampaign.obedienceLevelCaps", campaign.obedienceLevelCaps);
    assert(typeof rule.enabled === "boolean", "monsterCampaign.obedienceLevelCaps.enabled 는 true/false 여야 합니다");
    const caps = requireArray("monsterCampaign.obedienceLevelCaps.caps", rule.caps);
    assert(caps.length <= 64, "monsterCampaign.obedienceLevelCaps.caps 는 64개 이하여야 합니다");
    let previous = -1;
    for (const value of caps) {
      const cap = requireRecord("monsterCampaign.obedienceLevelCaps.cap", value);
      const badges = requireNumber("monsterCampaign.obedienceLevelCaps.cap.badges", cap.badges);
      const maxLevel = requireNumber("monsterCampaign.obedienceLevelCaps.cap.maxLevel", cap.maxLevel);
      assert(Number.isInteger(badges) && badges >= 0 && badges <= 64, "obedienceLevelCaps 의 badges 는 0..64 정수여야 합니다");
      assert(Number.isInteger(maxLevel) && maxLevel >= 1 && maxLevel <= 100, "obedienceLevelCaps 의 maxLevel 은 1..100 정수여야 합니다");
      assert(badges > previous, "obedienceLevelCaps.caps 는 badges 오름차순·중복 없음이어야 합니다");
      previous = badges;
    }
    assert(!rule.enabled || caps.length > 0, "obedienceLevelCaps 를 켜려면 caps 가 하나 이상 필요합니다");
    if (rule.refuseLine !== undefined) assert(requireString("monsterCampaign.obedienceLevelCaps.refuseLine", rule.refuseLine).length <= 200, "refuseLine 은 200자 이하여야 합니다");
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
    if (objective.summary !== undefined) requireString("monsterCampaign.objective.summary", objective.summary);
    if (objective.requiresSwitchId !== undefined) requireString("monsterCampaign.objective.requiresSwitchId", objective.requiresSwitchId);
  }
}
