/** ac500 families that a game needs and that are not drawing/tile/interior painting — reused by ds500 under their original ids. */
export const DS_REUSED_FAMILIES: readonly string[] = [
  // transfer (9)
  'door-se', 'door-to-plaza', 'align-portals', 'worldmap-north', 'transfer-two-way', 'transfer-landing-offset', 'transfer-conditional', 'transfer-fade-choice', 'chain-create-then-link',
  // battle (6)
  'battle-troop-create', 'battle-event-start', 'battle-escape-allowed', 'battle-defeat-branch', 'battle-encounter-rate', 'event-playtest',
  // media (5)
  'media-bgm-map', 'media-weather-rain', 'media-screen-tint', 'media-battle-bgm', 'media-se-volume',
  // database (11)
  'potion-price', 'sword-attack', 'item-description', 'create-key-item', 'db-skill-create', 'db-enemy-stat', 'db-class-skill-list', 'db-item-price-batch', 'db-troop-member-count', 'db-state-duration', 'chain-db-item-then-shop',
  // npc (5)
  'rename-npc', 'npc-shop', 'remove-shop-herb', 'chain-npc-then-line', 'ambiguous-this-npc',
  // maps (1)
  'move-start',
  // events (14)
  'change-first-line', 'add-switch-condition', 'touch-trigger', 'add-npc-line', 'npc-schedule', 'branch-two-choices', 'branch-nested-condition', 'variable-create-and-set', 'autorun-page', 'common-event-call', 'chain-switch-then-gate', 'place-chest', 'screen-shake', 'dialogue-position',
  // read (4)
  'read-switch-usage', 'read-event-pages', 'read-db-items', 'unreachable-links',
];
