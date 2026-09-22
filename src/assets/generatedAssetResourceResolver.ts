import { withInlineAsset } from "./inlineAssetStore";
import { resolveCc0IconAssetUrl } from "./cc0IconAssets";
import { resolveCc0AudioAssetUrl } from "./cc0AudioAssets";
import { resolveBgmCatalogAssetUrl } from "./bgmCatalogResolver";
import { openingStillPackUrl } from "./openingStillPackCdn";
import { findOpeningStillPackEntry } from "./openingStillPackRuntime";
import { resolveSeCatalogAssetUrl } from "./seCatalogResolver";
import { resolveFarmingAssetUrl } from "./farmingSprites";
import { resolveGeneratedEffectAssetUrl } from "./generatedEffectSheets";
import { resolveScarloxyAssetUrl } from "./scarloxyPack";
import { resolveOgaBackdropAssetUrl } from "./ogaBackdropAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import type { GeneratedAssetManifest } from "./generatedAssetManifest";
import type { Project } from "@/project/types";

// 타이틀 리소스 id 개명(2026-08-21) — 새 id 를 정본으로 쓰고, 구 id 는 **별칭으로
// 남긴다**. 이 값은 프로젝트 파일의 titleResourceId/backgroundResourceId 에 저장되므로
// 구 id 를 지우면 사용자가 만든 기존 프로젝트의 타이틀 화면이 빈 화면이 된다.
// 파일 경로(*.png) 자체는 안 옮겼다 — 에셋 파일 개명은 별도 라운드(Phase 5).
const BUILTIN_GENERATED_RESOURCE_URLS: Record<string, string> = {
  hero: "/assets/generated/starter/hero-01-battle.png",
  "oprn-title-bright": "/assets/generated/title/oprn-title-bright-v2.png",
  "oprn-title-blue": "/assets/generated/title/default-title-blue.png",
  "oprn-title-field": "/assets/generated/title/oprn-title-field.png",
  "horror-mystery-blue-gallery": "/assets/generated/title/horror-mystery-blue-gallery.png",
  // ── 구 id 별칭 (읽기 호환. 새로 쓸 때는 위 id 를 쓴다) ──────────────
  "rpg-zzu-title-bright": "/assets/generated/title/oprn-title-bright-v2.png",
  "rpg-zzu-title-blue": "/assets/generated/title/default-title-blue.png",
  "rpg-zzu-title-field": "/assets/generated/title/oprn-title-field.png",
  "modern-nocturne-title": "/assets/modern-exteriors/modern-nocturne-title.png",
  "modern-nocturne-logo": "/assets/modern-exteriors/modern-nocturne-logo.png",
  "modern-nocturne-battle-city": "/assets/modern-exteriors/modern-nocturne-battle-city.png",
  "modern-nocturne-battle-rooftop": "/assets/modern-exteriors/modern-nocturne-battle-rooftop.png",
  "oprn-title-logo-crest": "/assets/generated/title/title-logo-crest.png",
  "rpg-zzu-title-logo-crest": "/assets/generated/title/title-logo-crest.png",
  // ── 오프닝 무드 슬라이드 (2026-09-22) ─────────────────────────────────
  // 에디터 첫 화면(웰컴 브리핑)의 장르 포스터 그림을 시네마틱 스틸로도 쓴다.
  // 1408×768 · 16:9 라 전체화면 오프닝 무드컷에 맞고, 웰컴 표면과 같은 파일을
  // 가리키므로 레포 용량 증가가 없다. "오프닝 무드 슬라이드"는 still 피커와
  // list_opening_media 의 배경화 그룹에 잡히고, 검색어는 openingStillMoods.ts 가 담는다.
  "oprn-still-hero-dawn": "/assets/generated/welcome/slide-00-hero.png",
  "oprn-still-rally": "/assets/generated/welcome/slide-01.png",
  "oprn-still-corridor": "/assets/generated/welcome/slide-02.png",
  "oprn-still-harbor": "/assets/generated/welcome/slide-03.png",
  "oprn-still-forest-path": "/assets/generated/welcome/slide-04.png",
  "oprn-still-festival": "/assets/generated/welcome/slide-05.png",
  "oprn-still-ride": "/assets/generated/welcome/slide-06.png",
  "oprn-still-moon-meadow": "/assets/generated/welcome/mini-03-moon.png",
  "oprn-still-manor-night": "/assets/generated/welcome/mini-04-mansion.png",
  "oprn-still-dream": "/assets/generated/welcome/mini-02-yume.png",
  "oprn-still-metropolis": "/assets/generated/welcome/mini-05-meta.png",
  "oprn-still-lullaby": "/assets/generated/welcome/mini-06-mother.png",
  "oprn-still-quiet-room": "/assets/generated/welcome/mini-01-omori.png",
  // tibo(gemini-3.1-flash-image) 로 새로 만든 무드 슬라이드 — 웰컴 팩에 없던 축을 채운다.
  "oprn-still-farm-golden": "/assets/generated/opening/farm-golden.png",
  "oprn-still-snow-village": "/assets/generated/opening/snow-village.png",
  "oprn-still-desert-ruin": "/assets/generated/opening/desert-ruin.png",
  "oprn-still-kingdom-day": "/assets/generated/opening/kingdom-day.png",
  "oprn-still-dark-citadel": "/assets/generated/opening/dark-citadel.png",
  "generated-actor-hero-01-battle": "/assets/generated/starter/hero-01-battle.png",
  "generated-actor-hero-01-charset": "/assets/generated/starter/hero-01-charset.png",
  "generated-actor-hero-01-face": "/assets/generated/starter/hero-01-face.png",
  "generated-actor-hero-02-battle": "/assets/generated/starter/hero-02-battle.png",
  "generated-actor-hero-02-charset": "/assets/generated/starter/hero-02-charset.png",
  "generated-actor-hero-02-face": "/assets/generated/starter/hero-02-face.png",
  "generated-face-actor1-bust": "/assets/generated/faces/actor1-bust.png",
  "generated-face-actor1-full": "/assets/generated/faces/actor1-bust.png",
  "generated-actor-hero-03-battle": "/assets/generated/starter/hero-03-battle.png",
  // NOTE: hero-03-face.png 파일은 아직 생성되지 않았다(189개 등록 중 유일하게 파일이 없던 항목).
  // 그래도 등록은 유지한다 — 등록을 지우면 builtinGeneratedResourceIds() 에서 이 id 가 빠져,
  // resourceReferenceValidation 의 validateOptionalResource 가 알려진 id 집합에 없다며 assert 로 던진다.
  // 그러면 이 id 를 참조하는 프로젝트는 얼굴만 빠지는 게 아니라 **역직렬화 자체가 실패**한다(실측).
  // 파일이 없어 생기는 404 이미지 로드 실패는 battleFieldDom 의 removeFaceNodeOnLoadError onerror
  // 가드가 얼굴 노드를 제거하는 쪽으로 처리한다.
  "generated-actor-hero-03-face": "/assets/generated/starter/hero-03-face.png",
  "generated-actor-hero-04-battle": "/assets/generated/starter/hero-04-battle.png",
  // 성직자·궁수 배틀러(2026-08-29). DB 액터 actor_cleric / actor_ranger 가 여태 hero-02 /
  // hero-01 시트를 돌려 썼다 — 시작 파티는 아니지만 작성자가 파티에 넣으면 전투 화면에
  // 같은 그림이 두 번 선다.
  // charset/face 는 아직 없다 — hero-03 처럼 없는 파일을 등록하면 404 가드에 의존해야 하므로
  // 만들 때 같이 등록한다.
  "generated-actor-hero-05-battle": "/assets/generated/starter/hero-05-battle.png",
  "generated-actor-hero-06-battle": "/assets/generated/starter/hero-06-battle.png",
  "generated-enemy-bat-01": "/assets/generated/starter/monster-bat-01.png",
  "generated-enemy-dragon-01": "/assets/generated/starter/monster-dragon-01.png",
  "generated-enemy-golem-01": "/assets/generated/starter/monster-golem-01.png",
  "generated-enemy-ontology-8da61312": "/assets/generated/starter/monster-ontology-8da61312.png",
  "generated-enemy-slime-01": "/assets/generated/starter/monster-slime-01.png",
  "generated-enemy-sylph-hornet": "/assets/generated/starter/sylph-hornet-transparent.png",
  "generated-enemy-zombie-01": "/assets/generated/starter/monster-zombie-01.png",
  "generated-enemy-skeleton-01": "/assets/generated/starter/monster-skeleton-01.png",
  "generated-enemy-orc-01": "/assets/generated/starter/monster-orc-01.png",
  "generated-enemy-ghost-01": "/assets/generated/starter/monster-ghost-01.png",
  "generated-enemy-crab-01": "/assets/generated/starter/monster-crab-01.png",
  "generated-enemy-spider-01": "/assets/generated/starter/monster-spider-01.png",
  "generated-enemy-snake-01": "/assets/generated/starter/monster-snake-01.png",
  "generated-enemy-scorpion-01": "/assets/generated/starter/monster-scorpion-01.png",
  "generated-enemy-wolf-01": "/assets/generated/starter/monster-wolf-01.png",
  "generated-enemy-harpy-01": "/assets/generated/starter/monster-harpy-01.png",
  "generated-enemy-centipede-01": "/assets/generated/starter/monster-centipede-01.png",
  "generated-enemy-plant-01": "/assets/generated/starter/monster-plant-01.png",
  "generated-enemy-horse-01": "/assets/generated/starter/monster-horse-01.png",
  "generated-enemy-unicorn-01": "/assets/generated/starter/monster-unicorn-01.png",
  "generated-enemy-salamander-01": "/assets/generated/starter/monster-salamander-01.png",
  "generated-enemy-carbuncle-01": "/assets/generated/starter/monster-carbuncle-01.png",
  "generated-enemy-cat-01": "/assets/generated/starter/monster-cat-01.png",
  "generated-enemy-kappa-01": "/assets/generated/starter/monster-kappa-01.png",
  "generated-enemy-cockatrice-01": "/assets/generated/starter/monster-cockatrice-01.png",
  "generated-enemy-parasite-01": "/assets/generated/starter/monster-parasite-01.png",
  "generated-enemy-mantis-01": "/assets/generated/starter/monster-mantis-01.png",
  "generated-enemy-jackolantern-01": "/assets/generated/starter/monster-jackolantern-01.png",
  "generated-enemy-fish-01": "/assets/generated/starter/monster-fish-01.png",
  "generated-enemy-spirit-01": "/assets/generated/starter/monster-spirit-01.png",
  "generated-enemy-ghoul-01": "/assets/generated/starter/monster-ghoul-01.png",
  "generated-enemy-specter-01": "/assets/generated/starter/monster-specter-01.png",
  "generated-enemy-lemora-01": "/assets/generated/starter/monster-lemora-01.png",
  "generated-enemy-sylph-01": "/assets/generated/starter/monster-sylph-01.png",
  "generated-enemy-leaf-fox": "/assets/generated/monsters/corrected/leaf-fox.png",
  "generated-enemy-fire-pup": "/assets/generated/monsters/corrected/fire-pup.png",
  "generated-enemy-sparkit-fire": "/assets/generated/monsters/corrected/sparkit-fire.png",
  "generated-enemy-leafling-01": "/assets/generated/starter/monster-leafling-01.png",
  "generated-enemy-sparkit-01": "/assets/generated/starter/monster-sparkit-01.png",
  "generated-enemy-aqualing-01": "/assets/generated/starter/monster-aqualing-01.png",
  "generated-enemy-king-slime-01": "/assets/generated/starter/monster-king-slime-01.png",
  "generated-enemy-slime-blue": "/assets/generated/starter/monster-slime-blue.png",
  "generated-enemy-slime-red": "/assets/generated/starter/monster-slime-red.png",
  "generated-enemy-slime-green": "/assets/generated/starter/monster-slime-green.png",
  "generated-enemy-slime-metal": "/assets/generated/starter/monster-slime-metal.png",
  "generated-enemy-slime-king": "/assets/generated/starter/monster-slime-king.png",
  "generated-enemy-slime-cube": "/assets/generated/starter/monster-slime-cube.png",
  "generated-enemy-ooze-black": "/assets/generated/starter/monster-ooze-black.png",
  "generated-enemy-ooze-acid": "/assets/generated/starter/monster-ooze-acid.png",
  "generated-enemy-bat-cave": "/assets/generated/starter/monster-bat-cave.png",
  "generated-enemy-bat-vampire": "/assets/generated/starter/monster-bat-vampire.png",
  "generated-enemy-bee-giant": "/assets/generated/starter/monster-bee-giant.png",
  "generated-enemy-spider-cave": "/assets/generated/starter/monster-spider-cave.png",
  "generated-enemy-spider-widow": "/assets/generated/starter/monster-spider-widow.png",
  "generated-enemy-scorpion-sand": "/assets/generated/starter/monster-scorpion-sand.png",
  "generated-enemy-beetle-horn": "/assets/generated/starter/monster-beetle-horn.png",
  "generated-enemy-mantis-blade": "/assets/generated/starter/monster-mantis-blade.png",
  "generated-enemy-centipede-fire": "/assets/generated/starter/monster-centipede-fire.png",
  "generated-enemy-moth-dust": "/assets/generated/starter/monster-moth-dust.png",
  "generated-enemy-worm-sand": "/assets/generated/starter/monster-worm-sand.png",
  "generated-enemy-ant-soldier": "/assets/generated/starter/monster-ant-soldier.png",
  "generated-enemy-wolf-grey": "/assets/generated/starter/monster-wolf-grey.png",
  "generated-enemy-wolf-dire": "/assets/generated/starter/monster-wolf-dire.png",
  "generated-enemy-boar-tusk": "/assets/generated/starter/monster-boar-tusk.png",
  "generated-enemy-bear-brown": "/assets/generated/starter/monster-bear-brown.png",
  "generated-enemy-tiger-saber": "/assets/generated/starter/monster-tiger-saber.png",
  "generated-enemy-rat-giant": "/assets/generated/starter/monster-rat-giant.png",
  "generated-enemy-bird-hawk": "/assets/generated/starter/monster-bird-hawk.png",
  "generated-enemy-snake-viper": "/assets/generated/starter/monster-snake-viper.png",
  "generated-enemy-cat-shadow": "/assets/generated/starter/monster-cat-shadow.png",
  "generated-enemy-goat-mountain": "/assets/generated/starter/monster-goat-mountain.png",
  "generated-enemy-crab-rock": "/assets/generated/starter/monster-crab-rock.png",
  "generated-enemy-hound-hell": "/assets/generated/starter/monster-hound-hell.png",
  "generated-enemy-ape-stone": "/assets/generated/starter/monster-ape-stone.png",
  "generated-enemy-deer-forest": "/assets/generated/starter/monster-deer-forest.png",
  "generated-enemy-skeleton-bone": "/assets/generated/starter/monster-skeleton-bone.png",
  "generated-enemy-skeleton-archer": "/assets/generated/monsters/corrected/skeleton-archer.png",
  "generated-enemy-skeleton-knight": "/assets/generated/starter/monster-skeleton-knight.png",
  "generated-enemy-zombie-rot": "/assets/generated/starter/monster-zombie-rot.png",
  "generated-enemy-ghoul-grave": "/assets/generated/starter/monster-ghoul-grave.png",
  "generated-enemy-ghost-pale": "/assets/generated/starter/monster-ghost-pale.png",
  "generated-enemy-wraith-dark": "/assets/generated/starter/monster-wraith-dark.png",
  "generated-enemy-lich-frost": "/assets/generated/starter/monster-lich-frost.png",
  "generated-enemy-mummy-bandage": "/assets/generated/starter/monster-mummy-bandage.png",
  "generated-enemy-banshee-wail": "/assets/generated/starter/monster-banshee-wail.png",
  "generated-enemy-revenant-vengeful": "/assets/generated/starter/monster-revenant-vengeful.png",
  "generated-enemy-bonepile-crawler": "/assets/generated/starter/monster-bonepile-crawler.png",
  "generated-enemy-spirit-fire": "/assets/generated/monsters/corrected/spirit-fire.png",
  "generated-enemy-spirit-water": "/assets/generated/monsters/corrected/spirit-water.png",
  "generated-enemy-spirit-earth": "/assets/generated/monsters/corrected/spirit-earth.png",
  "generated-enemy-spirit-wind": "/assets/generated/starter/monster-spirit-wind.png",
  "generated-enemy-spirit-light": "/assets/generated/starter/monster-spirit-light.png",
  "generated-enemy-spirit-dark": "/assets/generated/starter/monster-spirit-dark.png",
  "generated-enemy-wisp-blue": "/assets/generated/monsters/corrected/wisp-blue.png",
  "generated-enemy-sylph-air": "/assets/generated/starter/monster-sylph-air.png",
  "generated-enemy-undine-sea": "/assets/generated/starter/monster-undine-sea.png",
  "generated-enemy-salamander-flame": "/assets/generated/starter/monster-salamander-flame.png",
  "generated-enemy-golem-stone": "/assets/generated/starter/monster-golem-stone.png",
  "generated-enemy-golem-iron": "/assets/generated/starter/monster-golem-iron.png",
  "generated-enemy-golem-clay": "/assets/generated/starter/monster-golem-clay.png",
  "generated-enemy-golem-crystal": "/assets/generated/starter/monster-golem-crystal.png",
  "generated-enemy-armor-living": "/assets/generated/starter/monster-armor-living.png",
  "generated-enemy-sword-flying": "/assets/generated/starter/monster-sword-flying.png",
  "generated-enemy-mimic-chest": "/assets/generated/starter/monster-mimic-chest.png",
  "generated-enemy-scarecrow-field": "/assets/generated/starter/monster-scarecrow-field.png",
  "generated-enemy-puppet-string": "/assets/generated/starter/monster-puppet-string.png",
  "generated-enemy-totem-cursed": "/assets/generated/starter/monster-totem-cursed.png",
  "generated-enemy-goblin-scout": "/assets/generated/starter/monster-goblin-scout.png",
  "generated-enemy-goblin-brute": "/assets/generated/starter/monster-goblin-brute.png",
  "generated-enemy-orc-warrior": "/assets/generated/starter/monster-orc-warrior.png",
  "generated-enemy-orc-shaman": "/assets/generated/monsters/corrected/orc-shaman.png",
  "generated-enemy-kobold-digger": "/assets/generated/starter/monster-kobold-digger.png",
  "generated-enemy-bandit-mask": "/assets/generated/starter/monster-bandit-mask.png",
  "generated-enemy-mage-rogue": "/assets/generated/starter/monster-mage-rogue.png",
  "generated-enemy-knight-fallen": "/assets/generated/starter/monster-knight-fallen.png",
  "generated-enemy-lizardman-spear": "/assets/generated/starter/monster-lizardman-spear.png",
  "generated-enemy-harpy-cliff": "/assets/generated/starter/monster-harpy-cliff.png",
  "generated-enemy-minotaur-maze": "/assets/generated/starter/monster-minotaur-maze.png",
  "generated-enemy-centaur-plains": "/assets/generated/starter/monster-centaur-plains.png",
  "generated-enemy-troll-cave": "/assets/generated/starter/monster-troll-cave.png",
  "generated-enemy-ogre-club": "/assets/generated/starter/monster-ogre-club.png",
  "generated-enemy-imp-mischief": "/assets/generated/starter/monster-imp-mischief.png",
  "generated-enemy-fish-piranha": "/assets/generated/starter/monster-fish-piranha.png",
  "generated-enemy-squid-deep": "/assets/generated/starter/monster-squid-deep.png",
  "generated-enemy-shark-land": "/assets/generated/starter/monster-shark-land.png",
  "generated-enemy-eel-electric": "/assets/generated/starter/monster-eel-electric.png",
  "generated-enemy-griffin-sky": "/assets/generated/starter/monster-griffin-sky.png",
  "generated-enemy-wyvern-cliff": "/assets/generated/starter/monster-wyvern-cliff.png",
  "generated-enemy-roc-giant": "/assets/generated/starter/monster-roc-giant.png",
  "generated-enemy-gargoyle-stone": "/assets/generated/starter/monster-gargoyle-stone.png",
  "generated-enemy-phoenix-rebirth": "/assets/generated/starter/monster-phoenix-rebirth.png",
  "generated-enemy-dragon-whelp": "/assets/generated/starter/monster-dragon-whelp.png",
  "generated-enemy-dragon-red": "/assets/generated/starter/monster-dragon-red.png",
  "generated-enemy-dragon-blue": "/assets/generated/starter/monster-dragon-blue.png",
  "generated-enemy-dragon-bone": "/assets/generated/starter/monster-dragon-bone.png",
  "generated-enemy-hydra-three": "/assets/generated/starter/monster-hydra-three.png",
  "generated-enemy-behemoth-horn": "/assets/generated/starter/monster-behemoth-horn.png",
  "generated-enemy-demon-lord": "/assets/generated/starter/monster-demon-lord.png",
  "generated-enemy-angel-fallen": "/assets/generated/starter/monster-angel-fallen.png",
  "generated-enemy-eye-floating": "/assets/generated/starter/monster-eye-floating.png",
  "generated-enemy-plant-carnivore": "/assets/generated/starter/monster-plant-carnivore.png",
  "generated-equipment-bronze-sword-icon": "/assets/generated/starter/bronze-sword-icon.png",
  "generated-equipment-bronze-sword-image": "/assets/generated/starter/bronze-sword-image.png",
  "generated-equipment-oak-shield-icon": "/assets/generated/starter/oak-shield-icon.png",
  "generated-equipment-oak-shield-image": "/assets/generated/starter/oak-shield-image.png",
  "generated-item-ether-blue-icon": "/assets/generated/starter/ether-blue-icon.png",
  "generated-item-ether-blue-image": "/assets/generated/starter/ether-blue-image.png",
  "generated-item-potion-red-icon": "/assets/generated/starter/potion-red-icon.png",
  "generated-item-potion-red-image": "/assets/generated/starter/potion-red-image.png",
  "generated-troop-preview-slime": "/assets/generated/starter/troop-preview-slime.png",
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
  "bskin-enemy-pokemon": "/assets/scarloxy/scarloxy-monster-larvea.png",
  "generated-enemy-reference-cocoon": "/assets/generated/battle-skins/sprites/reference-cocoon-front.png",
  "generated-enemy-reference-seed-back": "/assets/generated/battle-skins/sprites/reference-seed-back.png",
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
  "bskin-ally-creature-back": "/assets/scarloxy/scarloxy-monster-mossling.png",
  // 액터별 뒷모습 배틀러(2026-08-29). 위의 `bskin-ally-creature-back` 은 **파티 전원이 돌려 쓰는
  // 한 장**이라 어느 액터를 넣어도 같은 보라색 생물이 뒤통수를 보였다. 액터마다 하나씩 나눈다.
  //
  // 규격은 `bskin-ally-creature-back` 과 같은 712×712 통짜 이미지다 — 144×384 전투 캐릭터셋이
  // 아니므로 oprnGeneratedAssetPlan.json 에는 넣지 않는다(기존 `bskin-*` 스프라이트도 전부
  // 리졸버 전용이다). 만든 방법은 scripts/asset-gen/gen-hero-back-grok.mjs 에 있다.
  "generated-actor-hero-01-back": "/assets/generated/battle-skins/sprites/hero-01-back.png",
  "generated-actor-hero-02-back": "/assets/generated/battle-skins/sprites/hero-02-back.png",
  "generated-actor-hero-03-back": "/assets/generated/battle-skins/sprites/hero-03-back.png",
  "generated-actor-hero-04-back": "/assets/generated/battle-skins/sprites/hero-04-back.png",
  "generated-actor-hero-05-back": "/assets/generated/battle-skins/sprites/hero-05-back.png",
  "generated-actor-hero-06-back": "/assets/generated/battle-skins/sprites/hero-06-back.png",
  // Side-view battle field art (not EasyRPG sky panoramas).
  "generated-battle-reference-forest": "/generated/battle-reference-forest.png",
  // CSS 9-slice windowskin (EasyRPG System/*.png sheets are icon strips, not windowskins).
  // 창 스킨 리소스 id 개명(2026-08-21). 새 id 가 정본이고 구 id 는 **읽기 별칭**이다 —
  // project.system.systemResourceId 에 저장되므로 지우면 기존 프로젝트의 대사창이 깨진다.
  // 그림 자체는 우리가 생성한 9-slice 다(public/assets/ATTRIBUTION.md).
  "windowskin-default": "/assets/ui/windowskin-default.png",
  "windowskin-warm": "/assets/ui/windowskin-warm.png",
  "windowskin-rm2003": "/assets/ui/windowskin-default.png",
  // 생성 얼굴 낱장 32장(hero-01-face / hero-02-face × 16). 분할 산출물 목록에서 펼쳐 넣는다 —
  // 그래야 builtinGeneratedResourceIds() 에도 실려 collectResourceIds 가 알아본다.
  ...generatedFacesetFaceUrls(),
};

function generatedFacesetFaceUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const face of FACESET_FACE_ASSETS) {
    if (!face.sheetResourceId.startsWith("easyrpg-")) urls[face.id] = `/${face.path}`;
  }
  return urls;
}

// 얼굴 낱장 112장 전부. EasyRPG 낱장은 EASYRPG_RTP_ASSETS 표에 넣지 않았다(생성기가
// 다시 돌면 지워진다) — 그래서 경로 해석은 이 표가 맡는다.
const FACESET_FACE_RESOURCE_URLS: Record<string, string> = Object.fromEntries(
  FACESET_FACE_ASSETS.map((face) => [face.id, `/${face.path}`])
);

export function resolveFacesetFaceAssetUrl(resourceId: string): string | null {
  return FACESET_FACE_RESOURCE_URLS[resourceId] ?? null;
}

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
    resolveFacesetFaceAssetUrl(resourceId) ??
    resolveScarloxyAssetUrl(resourceId) ??
    resolveGeneratedEffectAssetUrl(resourceId) ??
    resolveFarmingAssetUrl(resourceId) ??
    resolveCc0IconAssetUrl(resourceId) ??
    resolveOgaBackdropAssetUrl(resourceId) ??
    resolveCc0AudioAssetUrl(resourceId) ??
    // 281곡 CC0 BGM 카탈로그. 파일이 레포에 없고 CDN 에서 오므로 절대 URL 이 나올 수 있다.
    resolveBgmCatalogAssetUrl(resourceId) ??
    // 오프닝 스틸 릴리스 팩. 파일이 레포에 없고 CDN/설치 경로에서 온다.
    resolveOpeningStillPackUrl(resourceId) ??
    // 456개 CC0 효과음 카탈로그. 파일이 레포에 있어(public/assets/se/) 항상 동일 출처 경로다.
    resolveSeCatalogAssetUrl(resourceId);
  if (packagedUrl !== null) return withInlineAsset(packagedUrl);
  const uploadedUrl = options.project?.assets.uploaded[resourceId]?.dataUrl;
  if (uploadedUrl !== undefined) return safeUploadedResourceUrl(uploadedUrl);
  const generated = options.manifest !== undefined
    ? resolveGeneratedAssetResourceUrl(resourceId, options.manifest)
    : resolveGeneratedAssetResourceUrl(resourceId);
  return generated === null ? null : withInlineAsset(generated);
}

export function builtinGeneratedResourceIds(): string[] {
  return Object.keys(BUILTIN_GENERATED_RESOURCE_URLS);
}

/** 릴리스 팩 스틸 — 설치되지 않은 환경에서도 경로는 결정론적이다(그림이 404 나면 onerror 처리). */
export function resolveOpeningStillPackUrl(resourceId: string): string | null {
  const entry = findOpeningStillPackEntry(resourceId);
  return entry ? openingStillPackUrl(entry.fileName) : null;
}

export function resolveGeneratedAssetResourceUrl(resourceId: string, manifest?: GeneratedAssetManifest): string | null {
  if (manifest === undefined) {
    const direct = BUILTIN_GENERATED_RESOURCE_URLS[resourceId];
    if (direct) return direct;
    const numberedDefaultEnemy = resourceId.match(/(?:^|-)enemy_extra_(\d+)$/);
    if (numberedDefaultEnemy) {
      // 디스크 파일은 enemy-art-001 … 120(세 자리)다. 예전 프로젝트의 enemy_extra_06 같은 두 자리 id 를
      // 그대로 붙이면 없는 경로가 되어 전투 몬스터 그림이 404 였다(실행형 HTML 빌드가 24개를 못 읽었다).
      return `/assets/generated/monsters/enemy-art-${numberedDefaultEnemy[1].padStart(3, "0")}.png`;
    }
    if (resourceId.includes("meadow")) return "/assets/generated/monsters/meadow_green_slime.jpg";
    if (resourceId.includes("slime")) return "/assets/generated/monsters/classic_blue_slime.jpg";
    if (resourceId.includes("minotaur")) return "/assets/generated/monsters/monster_minotaur.jpg";
    if (resourceId.includes("medusa")) return "/assets/generated/monsters/monster_medusa.jpg";
    if (resourceId.startsWith("generated-enemy-")) {
      for (const [key, url] of Object.entries(BUILTIN_GENERATED_RESOURCE_URLS)) {
        if (key.startsWith("generated-enemy-")) {
          const stem = key.replace("generated-enemy-", "").replace("-01", "");
          if (resourceId.includes(stem)) return url;
        }
      }
      return "/assets/generated/starter/monster-slime-01.png";
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
  if (entry !== undefined) return `/${entry.path}`;
  if (resourceId.startsWith("tex_easyrpg_chipset_")) {
    const suffix = resourceId.replace("tex_easyrpg_chipset_", "");
    return `/assets/easyrpg-chipset-${suffix.replace(/_/g, "-")}-transparent.png`;
  }
  if (resourceId === "tex_tiles_default") {
    return "/assets/easyrpg-chipset-exterior.png";
  }
  return null;
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
  if (/^data:audio\/(?:x-wav|wave|vnd\.wave);/i.test(normalizedUrl)) {
    return dataUrl.trim().replace(/^data:audio\/[^;]+/i, "data:audio/wav");
  }
  if (/^data:audio\/mp3;/i.test(normalizedUrl)) {
    return dataUrl.trim().replace(/^data:audio\/mp3/i, "data:audio/mpeg");
  }
  if (normalizedUrl.startsWith("data:audio/mpeg;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/wav;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/ogg;")) return dataUrl;
  if (/^data:video\/(mp4|webm|ogg);/.test(normalizedUrl)) return dataUrl;
  return null;
}

function hasUnsafePathSegment(path: string): boolean {
  if (path.includes("%2e") || path.includes("%2f") || path.includes("%5c")) return true;
  return path.split("/").some((segment) => segment === "." || segment === "..");
}
