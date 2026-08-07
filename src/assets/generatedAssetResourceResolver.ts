import { resolveCc0IconAssetUrl } from "./cc0IconAssets";
import { resolveCc0AudioAssetUrl } from "./cc0AudioAssets";
import { resolveFarmingAssetUrl } from "./farmingSprites";
import { resolveScarloxyAssetUrl } from "./scarloxyPack";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import type { GeneratedAssetManifest } from "./generatedAssetManifest";
import type { Project } from "@/project/types";

const BUILTIN_GENERATED_RESOURCE_URLS: Record<string, string> = {
  hero: "/assets/generated/rm2k3/hero-01-battle.png",
  "rpg-zzu-title-bright": "/assets/generated/title/bright-rpg-maker-title-v2.png",
  "rpg-zzu-title-blue": "/assets/generated/title/default-title-blue.png",
  "rpg-zzu-title-field": "/assets/generated/title/rm2k3-title-field.png",
  "rpg-zzu-title-logo-crest": "/assets/generated/title/title-logo-crest.png",
  "generated-actor-hero-01-battle": "/assets/generated/rm2k3/hero-01-battle.png",
  "generated-actor-hero-01-charset": "/assets/generated/rm2k3/hero-01-charset.png",
  "generated-actor-hero-01-face": "/assets/generated/rm2k3/hero-01-face.png",
  "generated-actor-hero-02-battle": "/assets/generated/rm2k3/hero-02-battle.png",
  "generated-actor-hero-02-charset": "/assets/generated/rm2k3/hero-02-charset.png",
  "generated-actor-hero-02-face": "/assets/generated/rm2k3/hero-02-face.png",
  "generated-face-actor1-bust": "/assets/generated/faces/actor1-bust.png",
  "generated-face-actor1-full": "/assets/generated/faces/actor1-bust.png",
  "generated-actor-hero-03-battle": "/assets/generated/rm2k3/hero-03-battle.png",
  // NOTE: hero-03-face.png 파일은 아직 생성되지 않았다(189개 등록 중 유일하게 파일이 없던 항목).
  // 그래도 등록은 유지한다 — 등록을 지우면 builtinGeneratedResourceIds() 에서 이 id 가 빠져,
  // resourceReferenceValidation 의 validateOptionalResource 가 알려진 id 집합에 없다며 assert 로 던진다.
  // 그러면 이 id 를 참조하는 프로젝트는 얼굴만 빠지는 게 아니라 **역직렬화 자체가 실패**한다(실측).
  // 파일이 없어 생기는 404 이미지 로드 실패는 battleFieldDom 의 correctFaceGridOnLoad onerror 가드가
  // 얼굴 노드를 제거하는 쪽으로 처리한다.
  "generated-actor-hero-03-face": "/assets/generated/rm2k3/hero-03-face.png",
  "generated-actor-hero-04-battle": "/assets/generated/rm2k3/hero-04-battle.png",
  "generated-enemy-bat-01": "/assets/generated/rm2k3/monster-bat-01.png",
  "generated-enemy-dragon-01": "/assets/generated/rm2k3/monster-dragon-01.png",
  "generated-enemy-golem-01": "/assets/generated/rm2k3/monster-golem-01.png",
  "generated-enemy-ontology-8da61312": "/assets/generated/rm2k3/monster-ontology-8da61312.png",
  "generated-enemy-slime-01": "/assets/generated/rm2k3/monster-slime-01.png",
  "generated-enemy-sylph-hornet": "/assets/generated/rm2k3/sylph-hornet-transparent.png",
  "generated-enemy-zombie-01": "/assets/generated/rm2k3/monster-zombie-01.png",
  "generated-enemy-skeleton-01": "/assets/generated/rm2k3/monster-skeleton-01.png",
  "generated-enemy-orc-01": "/assets/generated/rm2k3/monster-orc-01.png",
  "generated-enemy-ghost-01": "/assets/generated/rm2k3/monster-ghost-01.png",
  "generated-enemy-crab-01": "/assets/generated/rm2k3/monster-crab-01.png",
  "generated-enemy-spider-01": "/assets/generated/rm2k3/monster-spider-01.png",
  "generated-enemy-snake-01": "/assets/generated/rm2k3/monster-snake-01.png",
  "generated-enemy-scorpion-01": "/assets/generated/rm2k3/monster-scorpion-01.png",
  "generated-enemy-wolf-01": "/assets/generated/rm2k3/monster-wolf-01.png",
  "generated-enemy-harpy-01": "/assets/generated/rm2k3/monster-harpy-01.png",
  "generated-enemy-centipede-01": "/assets/generated/rm2k3/monster-centipede-01.png",
  "generated-enemy-plant-01": "/assets/generated/rm2k3/monster-plant-01.png",
  "generated-enemy-horse-01": "/assets/generated/rm2k3/monster-horse-01.png",
  "generated-enemy-unicorn-01": "/assets/generated/rm2k3/monster-unicorn-01.png",
  "generated-enemy-salamander-01": "/assets/generated/rm2k3/monster-salamander-01.png",
  "generated-enemy-carbuncle-01": "/assets/generated/rm2k3/monster-carbuncle-01.png",
  "generated-enemy-cat-01": "/assets/generated/rm2k3/monster-cat-01.png",
  "generated-enemy-kappa-01": "/assets/generated/rm2k3/monster-kappa-01.png",
  "generated-enemy-cockatrice-01": "/assets/generated/rm2k3/monster-cockatrice-01.png",
  "generated-enemy-parasite-01": "/assets/generated/rm2k3/monster-parasite-01.png",
  "generated-enemy-mantis-01": "/assets/generated/rm2k3/monster-mantis-01.png",
  "generated-enemy-jackolantern-01": "/assets/generated/rm2k3/monster-jackolantern-01.png",
  "generated-enemy-fish-01": "/assets/generated/rm2k3/monster-fish-01.png",
  "generated-enemy-spirit-01": "/assets/generated/rm2k3/monster-spirit-01.png",
  "generated-enemy-ghoul-01": "/assets/generated/rm2k3/monster-ghoul-01.png",
  "generated-enemy-specter-01": "/assets/generated/rm2k3/monster-specter-01.png",
  "generated-enemy-lemora-01": "/assets/generated/rm2k3/monster-lemora-01.png",
  "generated-enemy-sylph-01": "/assets/generated/rm2k3/monster-sylph-01.png",
  "generated-enemy-leafling-01": "/assets/generated/rm2k3/monster-leafling-01.png",
  "generated-enemy-sparkit-01": "/assets/generated/rm2k3/monster-sparkit-01.png",
  "generated-enemy-aqualing-01": "/assets/generated/rm2k3/monster-aqualing-01.png",
  "generated-enemy-king-slime-01": "/assets/generated/rm2k3/monster-king-slime-01.png",
  "generated-enemy-slime-blue": "/assets/generated/rm2k3/monster-slime-blue.png",
  "generated-enemy-slime-red": "/assets/generated/rm2k3/monster-slime-red.png",
  "generated-enemy-slime-green": "/assets/generated/rm2k3/monster-slime-green.png",
  "generated-enemy-slime-metal": "/assets/generated/rm2k3/monster-slime-metal.png",
  "generated-enemy-slime-king": "/assets/generated/rm2k3/monster-slime-king.png",
  "generated-enemy-slime-cube": "/assets/generated/rm2k3/monster-slime-cube.png",
  "generated-enemy-ooze-black": "/assets/generated/rm2k3/monster-ooze-black.png",
  "generated-enemy-ooze-acid": "/assets/generated/rm2k3/monster-ooze-acid.png",
  "generated-enemy-bat-cave": "/assets/generated/rm2k3/monster-bat-cave.png",
  "generated-enemy-bat-vampire": "/assets/generated/rm2k3/monster-bat-vampire.png",
  "generated-enemy-bee-giant": "/assets/generated/rm2k3/monster-bee-giant.png",
  "generated-enemy-spider-cave": "/assets/generated/rm2k3/monster-spider-cave.png",
  "generated-enemy-spider-widow": "/assets/generated/rm2k3/monster-spider-widow.png",
  "generated-enemy-scorpion-sand": "/assets/generated/rm2k3/monster-scorpion-sand.png",
  "generated-enemy-beetle-horn": "/assets/generated/rm2k3/monster-beetle-horn.png",
  "generated-enemy-mantis-blade": "/assets/generated/rm2k3/monster-mantis-blade.png",
  "generated-enemy-centipede-fire": "/assets/generated/rm2k3/monster-centipede-fire.png",
  "generated-enemy-moth-dust": "/assets/generated/rm2k3/monster-moth-dust.png",
  "generated-enemy-worm-sand": "/assets/generated/rm2k3/monster-worm-sand.png",
  "generated-enemy-ant-soldier": "/assets/generated/rm2k3/monster-ant-soldier.png",
  "generated-enemy-wolf-grey": "/assets/generated/rm2k3/monster-wolf-grey.png",
  "generated-enemy-wolf-dire": "/assets/generated/rm2k3/monster-wolf-dire.png",
  "generated-enemy-boar-tusk": "/assets/generated/rm2k3/monster-boar-tusk.png",
  "generated-enemy-bear-brown": "/assets/generated/rm2k3/monster-bear-brown.png",
  "generated-enemy-tiger-saber": "/assets/generated/rm2k3/monster-tiger-saber.png",
  "generated-enemy-rat-giant": "/assets/generated/rm2k3/monster-rat-giant.png",
  "generated-enemy-bird-hawk": "/assets/generated/rm2k3/monster-bird-hawk.png",
  "generated-enemy-snake-viper": "/assets/generated/rm2k3/monster-snake-viper.png",
  "generated-enemy-cat-shadow": "/assets/generated/rm2k3/monster-cat-shadow.png",
  "generated-enemy-goat-mountain": "/assets/generated/rm2k3/monster-goat-mountain.png",
  "generated-enemy-crab-rock": "/assets/generated/rm2k3/monster-crab-rock.png",
  "generated-enemy-hound-hell": "/assets/generated/rm2k3/monster-hound-hell.png",
  "generated-enemy-ape-stone": "/assets/generated/rm2k3/monster-ape-stone.png",
  "generated-enemy-deer-forest": "/assets/generated/rm2k3/monster-deer-forest.png",
  "generated-enemy-skeleton-bone": "/assets/generated/rm2k3/monster-skeleton-bone.png",
  "generated-enemy-skeleton-archer": "/assets/generated/rm2k3/monster-skeleton-archer.png",
  "generated-enemy-skeleton-knight": "/assets/generated/rm2k3/monster-skeleton-knight.png",
  "generated-enemy-zombie-rot": "/assets/generated/rm2k3/monster-zombie-rot.png",
  "generated-enemy-ghoul-grave": "/assets/generated/rm2k3/monster-ghoul-grave.png",
  "generated-enemy-ghost-pale": "/assets/generated/rm2k3/monster-ghost-pale.png",
  "generated-enemy-wraith-dark": "/assets/generated/rm2k3/monster-wraith-dark.png",
  "generated-enemy-lich-frost": "/assets/generated/rm2k3/monster-lich-frost.png",
  "generated-enemy-mummy-bandage": "/assets/generated/rm2k3/monster-mummy-bandage.png",
  "generated-enemy-banshee-wail": "/assets/generated/rm2k3/monster-banshee-wail.png",
  "generated-enemy-revenant-vengeful": "/assets/generated/rm2k3/monster-revenant-vengeful.png",
  "generated-enemy-bonepile-crawler": "/assets/generated/rm2k3/monster-bonepile-crawler.png",
  "generated-enemy-spirit-fire": "/assets/generated/rm2k3/monster-spirit-fire.png",
  "generated-enemy-spirit-water": "/assets/generated/rm2k3/monster-spirit-water.png",
  "generated-enemy-spirit-earth": "/assets/generated/rm2k3/monster-spirit-earth.png",
  "generated-enemy-spirit-wind": "/assets/generated/rm2k3/monster-spirit-wind.png",
  "generated-enemy-spirit-light": "/assets/generated/rm2k3/monster-spirit-light.png",
  "generated-enemy-spirit-dark": "/assets/generated/rm2k3/monster-spirit-dark.png",
  "generated-enemy-wisp-blue": "/assets/generated/rm2k3/monster-wisp-blue.png",
  "generated-enemy-sylph-air": "/assets/generated/rm2k3/monster-sylph-air.png",
  "generated-enemy-undine-sea": "/assets/generated/rm2k3/monster-undine-sea.png",
  "generated-enemy-salamander-flame": "/assets/generated/rm2k3/monster-salamander-flame.png",
  "generated-enemy-golem-stone": "/assets/generated/rm2k3/monster-golem-stone.png",
  "generated-enemy-golem-iron": "/assets/generated/rm2k3/monster-golem-iron.png",
  "generated-enemy-golem-clay": "/assets/generated/rm2k3/monster-golem-clay.png",
  "generated-enemy-golem-crystal": "/assets/generated/rm2k3/monster-golem-crystal.png",
  "generated-enemy-armor-living": "/assets/generated/rm2k3/monster-armor-living.png",
  "generated-enemy-sword-flying": "/assets/generated/rm2k3/monster-sword-flying.png",
  "generated-enemy-mimic-chest": "/assets/generated/rm2k3/monster-mimic-chest.png",
  "generated-enemy-scarecrow-field": "/assets/generated/rm2k3/monster-scarecrow-field.png",
  "generated-enemy-puppet-string": "/assets/generated/rm2k3/monster-puppet-string.png",
  "generated-enemy-totem-cursed": "/assets/generated/rm2k3/monster-totem-cursed.png",
  "generated-enemy-goblin-scout": "/assets/generated/rm2k3/monster-goblin-scout.png",
  "generated-enemy-goblin-brute": "/assets/generated/rm2k3/monster-goblin-brute.png",
  "generated-enemy-orc-warrior": "/assets/generated/rm2k3/monster-orc-warrior.png",
  "generated-enemy-orc-shaman": "/assets/generated/rm2k3/monster-orc-shaman.png",
  "generated-enemy-kobold-digger": "/assets/generated/rm2k3/monster-kobold-digger.png",
  "generated-enemy-bandit-mask": "/assets/generated/rm2k3/monster-bandit-mask.png",
  "generated-enemy-mage-rogue": "/assets/generated/rm2k3/monster-mage-rogue.png",
  "generated-enemy-knight-fallen": "/assets/generated/rm2k3/monster-knight-fallen.png",
  "generated-enemy-lizardman-spear": "/assets/generated/rm2k3/monster-lizardman-spear.png",
  "generated-enemy-harpy-cliff": "/assets/generated/rm2k3/monster-harpy-cliff.png",
  "generated-enemy-minotaur-maze": "/assets/generated/rm2k3/monster-minotaur-maze.png",
  "generated-enemy-centaur-plains": "/assets/generated/rm2k3/monster-centaur-plains.png",
  "generated-enemy-troll-cave": "/assets/generated/rm2k3/monster-troll-cave.png",
  "generated-enemy-ogre-club": "/assets/generated/rm2k3/monster-ogre-club.png",
  "generated-enemy-imp-mischief": "/assets/generated/rm2k3/monster-imp-mischief.png",
  "generated-enemy-fish-piranha": "/assets/generated/rm2k3/monster-fish-piranha.png",
  "generated-enemy-squid-deep": "/assets/generated/rm2k3/monster-squid-deep.png",
  "generated-enemy-shark-land": "/assets/generated/rm2k3/monster-shark-land.png",
  "generated-enemy-eel-electric": "/assets/generated/rm2k3/monster-eel-electric.png",
  "generated-enemy-griffin-sky": "/assets/generated/rm2k3/monster-griffin-sky.png",
  "generated-enemy-wyvern-cliff": "/assets/generated/rm2k3/monster-wyvern-cliff.png",
  "generated-enemy-roc-giant": "/assets/generated/rm2k3/monster-roc-giant.png",
  "generated-enemy-gargoyle-stone": "/assets/generated/rm2k3/monster-gargoyle-stone.png",
  "generated-enemy-phoenix-rebirth": "/assets/generated/rm2k3/monster-phoenix-rebirth.png",
  "generated-enemy-dragon-whelp": "/assets/generated/rm2k3/monster-dragon-whelp.png",
  "generated-enemy-dragon-red": "/assets/generated/rm2k3/monster-dragon-red.png",
  "generated-enemy-dragon-blue": "/assets/generated/rm2k3/monster-dragon-blue.png",
  "generated-enemy-dragon-bone": "/assets/generated/rm2k3/monster-dragon-bone.png",
  "generated-enemy-hydra-three": "/assets/generated/rm2k3/monster-hydra-three.png",
  "generated-enemy-behemoth-horn": "/assets/generated/rm2k3/monster-behemoth-horn.png",
  "generated-enemy-demon-lord": "/assets/generated/rm2k3/monster-demon-lord.png",
  "generated-enemy-angel-fallen": "/assets/generated/rm2k3/monster-angel-fallen.png",
  "generated-enemy-eye-floating": "/assets/generated/rm2k3/monster-eye-floating.png",
  "generated-enemy-plant-carnivore": "/assets/generated/rm2k3/monster-plant-carnivore.png",
  "generated-equipment-bronze-sword-icon": "/assets/generated/rm2k3/bronze-sword-icon.png",
  "generated-equipment-bronze-sword-image": "/assets/generated/rm2k3/bronze-sword-image.png",
  "generated-equipment-oak-shield-icon": "/assets/generated/rm2k3/oak-shield-icon.png",
  "generated-equipment-oak-shield-image": "/assets/generated/rm2k3/oak-shield-image.png",
  "generated-item-ether-blue-icon": "/assets/generated/rm2k3/ether-blue-icon.png",
  "generated-item-ether-blue-image": "/assets/generated/rm2k3/ether-blue-image.png",
  "generated-item-potion-red-icon": "/assets/generated/rm2k3/potion-red-icon.png",
  "generated-item-potion-red-image": "/assets/generated/rm2k3/potion-red-image.png",
  "generated-troop-preview-slime": "/assets/generated/rm2k3/troop-preview-slime.png",
  "battle-skin-pokemon-backdrop": "/assets/generated/battle-skins/pokemon-backdrop.png",
  // vxace 기본 배경 — 참조 스크린샷은 "푸른 하늘 + 먼 산 + 밝은 초원" 이다. 기존 12장 중
  // pokemon-backdrop 이 그 구도에 가장 가까워 별칭으로 등록한다(파일 공유는 기존 관례:
  // generated-face-actor1-full 도 actor1-bust.png 를 가리킨다).
  "battle-skin-mv-backdrop": "/assets/generated/battle-skins/mv-backdrop.png",
  "battle-skin-vxace-backdrop": "/assets/generated/battle-skins/vxace-backdrop.png",
  "battle-skin-rm2003-backdrop": "/assets/generated/battle-skins/rm2003-backdrop.png",
  "battle-skin-rm2000-backdrop": "/assets/generated/battle-skins/rm2000-backdrop.png",
  "battle-skin-octopath-backdrop": "/assets/generated/battle-skins/octopath-backdrop.png",
  "battle-skin-chrono-backdrop": "/assets/generated/battle-skins/chrono-backdrop.png",
  "battle-skin-bravely-backdrop": "/assets/generated/battle-skins/bravely-backdrop.png",
  "battle-skin-dragonquest-backdrop": "/assets/generated/battle-skins/dragonquest-backdrop.png",
  "battle-skin-ff-backdrop": "/assets/generated/battle-skins/ff-backdrop.png",
  "battle-skin-mother-backdrop": "/assets/generated/battle-skins/mother-backdrop.png",
  "battle-skin-goldensun-backdrop": "/assets/generated/battle-skins/goldensun-backdrop.png",
  "battle-skin-demo-battler": "/assets/generated/battle-skins/demo-battler-alpha.png",
  // Per-skin battler sprites (chroma-keyed #00FF00 -> alpha) — themed enemy + party (front/back).
  "bskin-enemy-pokemon": "/assets/generated/battle-skins/sprites/enemy-pokemon.png",
  "bskin-enemy-rm2003": "/assets/generated/battle-skins/sprites/enemy-rm2003.png",
  "bskin-enemy-rm2000": "/assets/generated/battle-skins/sprites/enemy-rm2000.png",
  "bskin-enemy-octopath": "/assets/generated/battle-skins/sprites/enemy-octopath.png",
  "bskin-enemy-chrono": "/assets/generated/battle-skins/sprites/enemy-chrono.png",
  "bskin-enemy-bravely": "/assets/generated/battle-skins/sprites/enemy-bravely.png",
  "bskin-enemy-dragonquest": "/assets/generated/battle-skins/sprites/enemy-dragonquest.png",
  "bskin-enemy-ff": "/assets/generated/battle-skins/sprites/enemy-ff.png",
  "bskin-enemy-mother": "/assets/generated/battle-skins/sprites/enemy-mother.png",
  "bskin-enemy-goldensun": "/assets/generated/battle-skins/sprites/enemy-goldensun.png",
  "bskin-party-warrior-front": "/assets/generated/battle-skins/sprites/party-warrior-front.png",
  "bskin-party-warrior-back": "/assets/generated/battle-skins/sprites/party-warrior-back.png",
  "bskin-party-mage-front": "/assets/generated/battle-skins/sprites/party-mage-front.png",
  "bskin-party-mage-back": "/assets/generated/battle-skins/sprites/party-mage-back.png",
  "bskin-ally-creature-back": "/assets/generated/battle-skins/sprites/ally-creature-back.png",
  // Side-view battle field art (not EasyRPG sky panoramas).
  "generated-battle-reference-forest": "/generated/battle-reference-forest.png",
  // CSS 9-slice windowskin (EasyRPG System/*.png sheets are icon strips, not windowskins).
  "windowskin-rm2003": "/assets/ui/windowskin-rm2003.png",
};

const LEGACY_PACKAGED_RESOURCE_URLS: Record<string, string> = {
  sample_title: "/assets/easyrpg/title/Title1.png",
};

export type AssetResourceResolutionOptions = {
  readonly project?: Pick<Project, "assets">;
  readonly manifest?: GeneratedAssetManifest;
};

export function resolveAssetResourceUrl(resourceId: string | undefined, options: AssetResourceResolutionOptions = {}): string | null {
  if (!hasResourceId(resourceId)) return null;
  const packagedUrl =
    LEGACY_PACKAGED_RESOURCE_URLS[resourceId] ??
    resolveEasyRpgRuntimeAssetUrl(resourceId) ??
    resolveScarloxyAssetUrl(resourceId) ??
    resolveFarmingAssetUrl(resourceId) ??
    resolveCc0IconAssetUrl(resourceId) ??
    resolveCc0AudioAssetUrl(resourceId);
  if (packagedUrl !== null) return packagedUrl;
  const uploadedUrl = options.project?.assets.uploaded[resourceId]?.dataUrl;
  if (uploadedUrl !== undefined) return safeUploadedResourceUrl(uploadedUrl);
  if (options.manifest !== undefined) return resolveGeneratedAssetResourceUrl(resourceId, options.manifest);
  return resolveGeneratedAssetResourceUrl(resourceId);
}

export function builtinGeneratedResourceIds(): string[] {
  return Object.keys(BUILTIN_GENERATED_RESOURCE_URLS);
}

export function resolveGeneratedAssetResourceUrl(resourceId: string, manifest?: GeneratedAssetManifest): string | null {
  if (manifest === undefined) {
    const direct = BUILTIN_GENERATED_RESOURCE_URLS[resourceId];
    if (direct) return direct;
    if (resourceId.includes("meadow")) return "/assets/generated/monsters/meadow_green_slime.jpg";
    if (resourceId.includes("slime")) return "/assets/generated/monsters/classic_blue_slime.jpg";
    if (resourceId.includes("minotaur")) return "/assets/generated/monsters/monster_minotaur.jpg";
    if (resourceId.includes("medusa")) return "/assets/generated/monsters/monster_medusa.jpg";
    if (resourceId.startsWith("generated-enemy-")) {
      const match = resourceId.match(/enemy_extra_(\d+)/);
      if (match) {
        return `/assets/generated/monsters/enemy-art-${match[1]}.png`;
      }
      for (const [key, url] of Object.entries(BUILTIN_GENERATED_RESOURCE_URLS)) {
        if (key.startsWith("generated-enemy-")) {
          const stem = key.replace("generated-enemy-", "").replace("-01", "");
          if (resourceId.includes(stem)) return url;
        }
      }
      return "/assets/generated/rm2k3/monster-slime-01.png";
    }
    return null;
  }
  const entry = manifest.assets.find((asset) => asset.resourceId === resourceId);
  if (entry === undefined) return null;
  if (entry.status !== "promoted") return null;
  return generatedAssetPromotedPathToUrl(entry.promotedPath);
}

export function generatedAssetPromotedPathToUrl(promotedPath: string | null): string | null {
  if (promotedPath === null) return null;
  const normalizedPath = promotedPath.trim().replaceAll("\\", "/");
  const runtimePath = stripPublicPrefix(stripLeadingSlash(normalizedPath));
  if (!isAllowedGeneratedRuntimePath(runtimePath)) return null;
  return `/${runtimePath}`;
}

export function resolveEasyRpgRuntimeAssetUrl(resourceId: string): string | null {
  const entry = EASYRPG_RTP_ASSETS.find(
    (asset) => asset.id === resourceId || ("textureKey" in asset && asset.textureKey === resourceId)
  );
  if (entry === undefined) return null;
  return `/${entry.path}`;
}

function hasResourceId(resourceId: string | undefined): resourceId is string {
  return resourceId !== undefined && resourceId.trim().length > 0;
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

function stripPublicPrefix(path: string): string {
  const publicPrefix = "public/";
  return path.startsWith(publicPrefix) ? path.slice(publicPrefix.length) : path;
}

function isAllowedGeneratedRuntimePath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return (
    normalizedPath.startsWith("assets/generated/") &&
    normalizedPath.endsWith(".png") &&
    !normalizedPath.includes("assets/easyrpg/") &&
    !hasUnsafePathSegment(normalizedPath)
  );
}

function safeUploadedResourceUrl(dataUrl: string): string | null {
  const normalizedUrl = dataUrl.trim().toLowerCase();
  if (normalizedUrl.startsWith("data:image/png;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/jpeg;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/webp;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/gif;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/mpeg;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/wav;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/ogg;")) return dataUrl;
  return null;
}

function hasUnsafePathSegment(path: string): boolean {
  if (path.includes("%2e") || path.includes("%2f") || path.includes("%5c")) return true;
  return path.split("/").some((segment) => segment === "." || segment === "..");
}
