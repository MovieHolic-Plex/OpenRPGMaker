export type Cc0IconAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly license: "CC0-1.0";
};

const JETREL_SOURCE_URL = "https://opengameart.org/content/16x16-rpg-items";
const JETREL_SOURCE_NAME = "Jetrel 16x16 RPG items";

function jetrelIcon(id: string, fileName: string, name: string): Cc0IconAsset {
  return {
    id,
    name,
    path: `assets/cc0/jetrel/icons/${fileName}`,
    sourceName: JETREL_SOURCE_NAME,
    sourceUrl: JETREL_SOURCE_URL,
    license: "CC0-1.0",
  };
}

export const CC0_ICON_ASSETS = [
  jetrelIcon("cc0-jetrel-potion-red", "potion-red.png", "CC0 red potion icon"),
  jetrelIcon("cc0-jetrel-ether-blue", "ether-blue.png", "CC0 blue ether icon"),
  jetrelIcon("cc0-jetrel-antidote-green", "antidote-green.png", "CC0 green antidote icon"),
  jetrelIcon("cc0-jetrel-wake-herb", "wake-herb.png", "CC0 wake herb icon"),
  jetrelIcon("cc0-jetrel-poison-dart", "poison-dart.png", "CC0 poison dart icon"),
  jetrelIcon("cc0-jetrel-old-key-scroll", "old-key-scroll.png", "CC0 old key placeholder scroll icon"),
  jetrelIcon("cc0-jetrel-bronze-sword", "bronze-sword.png", "CC0 bronze sword icon"),
  jetrelIcon("cc0-jetrel-mage-staff", "mage-staff.png", "CC0 mage staff icon"),
  jetrelIcon("cc0-jetrel-scout-dagger", "scout-dagger.png", "CC0 scout dagger icon"),
  jetrelIcon("cc0-jetrel-oak-shield", "oak-shield.png", "CC0 oak shield icon"),
  jetrelIcon("cc0-jetrel-leather-armor", "leather-armor.png", "CC0 leather armor icon"),
  jetrelIcon("cc0-jetrel-mystic-robe", "mystic-robe.png", "CC0 mystic robe icon"),
  jetrelIcon("cc0-jetrel-traveler-hat", "traveler-hat.png", "CC0 traveler hat icon"),
  jetrelIcon("cc0-jetrel-focus-charm", "focus-charm.png", "CC0 focus charm icon"),
] as const satisfies readonly Cc0IconAsset[];

export function resolveCc0IconAssetUrl(resourceId: string): string | null {
  const asset = CC0_ICON_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? `/${asset.path}` : null;
}
