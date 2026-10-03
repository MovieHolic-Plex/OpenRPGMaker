import { RETRO_ROSTER } from "@/assets/retroRoster";
import {
  characterMotionProfile,
  type CharacterMotionStyle,
} from "@/battle/characterMotion";
import type { ActorRecord, EquipmentRecord } from "@/project/types";

/** Every bundled class is assigned explicitly. No actor-name regex or ID hash. */
const GROUPS: Record<CharacterMotionStyle, string> = {
  balanced:
    "hero red_mage pirate prince squire swordsman king mercenary villager tribal sailor ronin desert_warrior old_warrior skeleton_pal dragonewt oni_warrior scarecrow",
  heavy:
    "guardian paladin dark_knight general berserker miner farmer heavy_knight ogre_kid zombie_pal minotaur_pal demon_knight golem_pal demon_general treant golem_moss living_armor yeti cyclops",
  agile:
    "scout samurai ninja thief dancer butler sword_dancer gambler jester maid vampire tanuki doll",
  lancer: "valkyrie dragoon merfolk",
  martial: "monk brawler martial_artist priest_monk monk_elder kappa",
  ranged:
    "ranger beast_tamer elf_archer hunter gunner gunslinger nomad clockwork",
  caster:
    "mage cleric bard druid witch chronomancer sorceress alchemist summoner flower_girl scholar elder grandma gypsy merchant noble princess archmage fortune_teller noblewoman nun girl_alchemist shrine_maiden hermit demon dark_lord siren kitsune mandrake basilisk",
  beast: "dog cat rooster sheep cow horse tiger lion red_dragon_pal chimera",
  floating:
    "seraph fairy ghost_pal reaper harpy_pal gargoyle_pal wraith_mage succubus flame_spirit sprite_ice lantern_ghost book_demon mothman djinn dark_angel balloon airship ufo",
  vehicle: "skiff galleon gunboat drill tank",
  soft: "slime_pal lamia mound mushroom mimic_pal candle_imp",
};
export const CHARACTER_CLASS_MOTIONS: Readonly<
  Record<string, CharacterMotionStyle>
> = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([style, ids]) =>
    ids.split(" ").map((id) => ["class_" + id, style as CharacterMotionStyle]),
  ),
);
const roster = new Map(RETRO_ROSTER.map((row) => [row.classId, row]));
export function resolveCharacterMotion(
  actor: Pick<ActorRecord, "id" | "classId" | "battleMotion">,
  weapon?: Pick<EquipmentRecord, "twoHanded" | "battleMotionStyle"> & {
    id?: string;
  },
  classId = actor.classId,
) {
  const row =
    roster.get(actor.id.replace(/^actor_/, "class_")) ??
    roster.get(actor.classId);
  const bodyStyle =
    row && row.body !== "humanoid"
      ? CHARACTER_CLASS_MOTIONS[row.classId]
      : undefined;
  const style =
    bodyStyle ??
    CHARACTER_CLASS_MOTIONS[classId] ??
    (row?.body === "beast"
      ? "beast"
      : row?.body === "vehicle"
        ? "vehicle"
        : "balanced");
  // Equipment has an explicit authored family. Unknown/custom equipment doesn't guess from its name.
  const equipmentStyle = bodyStyle ? undefined : weapon?.battleMotionStyle;
  const profile = characterMotionProfile(
    equipmentStyle ?? style,
    CHARACTER_CLASS_MOTIONS[classId] ? classId : "custom",
    actor.battleMotion,
  );
  if (
    weapon?.twoHanded &&
    !equipmentStyle &&
    !actor.battleMotion?.style &&
    row?.body !== "beast" &&
    row?.body !== "vehicle" &&
    row?.body !== "monster"
  ) {
    if (actor.battleMotion?.anticipation === undefined) profile.anticipation *= 1.12;
    if (actor.battleMotion?.recovery === undefined) profile.recovery *= 1.1;
  }
  // Authored bundled equipment inertia. Keep body and class identity when a roster's
  // starter stats use a generic sword/staff/dagger under its painted weapon.
  const weight: Record<string, readonly [number, number]> = {
    equip_sword: [1, 1],
    equip_iron_sword: [1.08, 1.08],
    equip_steel_sword: [1.18, 1.16],
    equip_mage_staff: [1.1, 1.05],
    equip_scout_dagger: [0.9, 0.9],
    equip_short_sword: [0.94, 0.94],
  };
  const factors = weapon?.id ? weight[weapon.id] : undefined;
  if (factors && !bodyStyle) {
    if (actor.battleMotion?.anticipation === undefined)
      profile.anticipation *= factors[0];
    if (actor.battleMotion?.recovery === undefined)
      profile.recovery *= factors[1];
  }
  profile.contactOffset = actor.battleMotion?.reach ?? 0;
  return profile;
}
