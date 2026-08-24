/**
 * Generated card art used by the optional farm-life journal.
 *
 * Keep these as public-root URLs: the editor, hosted player, and exported player
 * all resolve `/assets/...` through the same asset collection path.
 */
export const FARMING_LIFE_UI_ASSETS = Object.freeze({
  animals: "/assets/farming/life-ui/animals-card.png",
  buildings: "/assets/farming/life-ui/buildings-card.png",
  bundles: "/assets/farming/life-ui/community-bundles-card.png",
  fishing: "/assets/farming/life-ui/fishing-card.png",
  makers: "/assets/farming/life-ui/makers-card.png",
  museum: "/assets/farming/life-ui/museum-card.png",
});

export type FarmingLifeUiAssetId = keyof typeof FARMING_LIFE_UI_ASSETS;
