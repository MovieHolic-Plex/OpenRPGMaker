// Stable IDs are shared by the tool schema, persistence validator and catalog.
export const QUEST_PRESET_IDS = [
  'errand', 'lost_item', 'hunt', 'delivery', 'gather', 'trade_chain', 'crafting',
  'investigate', 'witness_chain', 'treasure_hunt', 'exploration', 'patrol',
  'escort', 'rescue', 'boss_hunt', 'gauntlet', 'duel', 'puzzle_choice',
  'mechanism', 'alternate_solution', 'moral_choice', 'recruitment',
  'world_repair', 'time_echo', 'appointment', 'repeatable_contract', 'story_chain', 'custom',
] as const;
export type QuestPresetId = typeof QUEST_PRESET_IDS[number];
