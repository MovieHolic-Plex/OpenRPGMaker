// 도트 측면 전투(retro2003) 전용 적 도트 시트 카탈로그.
//
// 시트 계약(그림 원본: scripts/asset-gen/pixel-enemy/redraw/, 설명: tiledata/monster-redraw-all/README.md):
//   셀 `cell` px 정사각 3열×3행(현재 공용 적은 native64·96, 이전 48px 읽기 호환 유지), 화면에는 2배로 그린다.
//   1:1 도트, 알파 0/255. 오른쪽(아군 쪽)을 본다. 가로 중심 x=cell/2, 바닥 기준선 y=cell−4.
//   (0,0)(1,0)(2,0) 대기 a·b·c — a→b→c→b 로 돈다
//   (0,1) windup · (1,1) move · (2,1) attack
//   (0,2) recover · (1,2) hit · (2,2) dead
//
// 같은 리소스 id 의 일반 이미지/다른 스킨은 pixelEnemyPortraits.ts 의 idle_a 한 칸을 그린다.
// 옛 통짜 그림은 폐기했다. retro2003 에서만 이 3×3 포즈 시트를 직접 읽는다.
import { withInlineAsset } from "@/assets/inlineAssetStore";

export const PIXEL_ENEMY_CELL = 48;

export type PixelEnemyCell = "idle_a" | "idle_b" | "idle_c" | "windup" | "move" | "attack" | "recover" | "hit" | "dead";
/** 파티원 15칸 시트(3×5)가 더 갖는 칸. 적 시트(3×3)에는 없다 — partyPixelSheets.partyPixelFrame 이 없으면 9칸으로 물린다. */
export type PartyPixelExtraCell = "cast_charge" | "cast_raise" | "cast_release" | "leap" | "buff" | "finisher";
export type PartyPixelCell = PixelEnemyCell | PartyPixelExtraCell;

/**
 * 공격할 때 대상에게 가는 방식.
 *   hop   통통 두 번 뛰어 박치기(슬라임)       swoop 날개를 치켜들었다 급강하해 물기(박쥐·새)
 *   stomp 무겁게 두어 걸음 다가가 내려찍기(골렘·트롤)  dash  낮게 달려들어 물어뜯기(늑대·짐승)
 *   float 스르르 떠서 다가가 할퀴기(유령·정령)   shoot 제자리에서 쏘기 — 다가가지 않는다(궁수·마법형)
 *   breath 크게 젖혔다 앞으로 숨을 뿜기, 제자리(드래곤)
 */
export type PixelEnemyMotion = "hop" | "swoop" | "stomp" | "dash" | "float" | "shoot" | "breath";

export interface PixelEnemySheet {
  /** 적 레코드의 monsterResourceId. */
  readonly resourceId: string;
  /** public 기준 경로(선행 슬래시 없음). */
  readonly path: string;
  readonly motion: PixelEnemyMotion;
  /** 대기 루프 한 칸 길이(ms). a→b→c→b 네 칸. */
  readonly idleFrameMs: number;
  /** 셀 한 변(px). 생략 = 48. 시트는 cell×3 정사각. */
  readonly cell?: number;
}

export const PIXEL_ENEMY_SHEETS: readonly PixelEnemySheet[] = [
  { resourceId: "generated-enemy-slime-01", path: "assets/generated/pixel-enemies/slime.png", cell: 64, motion: "hop", idleFrameMs: 220 },
  { resourceId: "generated-enemy-bat-01", path: "assets/generated/pixel-enemies/bat.png", cell: 64, motion: "swoop", idleFrameMs: 110 },
  { resourceId: "generated-enemy-golem-01", path: "assets/generated/pixel-enemies/golem.png", cell: 64, motion: "stomp", idleFrameMs: 300 },
  { resourceId: "generated-enemy-dragon-01", path: "assets/generated/pixel-enemies/dragon.png", cell: 96, motion: "breath", idleFrameMs: 260 },
  { resourceId: "generated-enemy-skeleton-archer", path: "assets/generated/pixel-enemies/skeleton-archer.png", cell: 64, motion: "shoot", idleFrameMs: 240 },
  { resourceId: "generated-enemy-wolf-grey", path: "assets/generated/pixel-enemies/wolf-grey.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spider-cave", path: "assets/generated/pixel-enemies/spider-cave.png", cell: 64, motion: "dash", idleFrameMs: 160 },
  { resourceId: "generated-enemy-wisp-blue", path: "assets/generated/pixel-enemies/wisp-blue.png", cell: 64, motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-slime-red", path: "assets/generated/pixel-enemies/slime-red.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-zombie-rot", path: "assets/generated/pixel-enemies/zombie-rot.png", cell: 64, motion: "stomp", idleFrameMs: 340 },
  // 2026-09-28 확장 30종(계약 retroMonsterPlan.ts 순서). 대기 한 칸 길이는 tiledata/pixel-enemies/<slug>/README.md 권장값,
  // 권장값이 없는 짐승 10종은 이동 방식 기본값(swoop 120 · dash 170 · stomp 320). 식충 식물은 stomp 슬롯이지만 제자리 덩굴 채찍이다.
  { resourceId: "generated-enemy-bat-vampire", path: "assets/generated/pixel-enemies/bat-vampire.png", cell: 64, motion: "swoop", idleFrameMs: 120 },
  { resourceId: "generated-enemy-bee-giant", path: "assets/generated/pixel-enemies/bee-giant.png", cell: 64, motion: "swoop", idleFrameMs: 120 },
  { resourceId: "generated-enemy-scorpion-sand", path: "assets/generated/pixel-enemies/scorpion-sand.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-mantis-blade", path: "assets/generated/pixel-enemies/mantis-blade.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-boar-tusk", path: "assets/generated/pixel-enemies/boar-tusk.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-bear-brown", path: "assets/generated/pixel-enemies/bear-brown.png", cell: 64, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-snake-viper", path: "assets/generated/pixel-enemies/snake-viper.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-crab-rock", path: "assets/generated/pixel-enemies/crab-rock.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-hound-hell", path: "assets/generated/pixel-enemies/hound-hell.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-plant-carnivore", path: "assets/generated/pixel-enemies/plant-carnivore.png", cell: 64, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-skeleton-knight", path: "assets/generated/pixel-enemies/skeleton-knight.png", cell: 64, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-ghost-pale", path: "assets/generated/pixel-enemies/ghost-pale.png", cell: 64, motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-lich-frost", path: "assets/generated/pixel-enemies/lich-frost.png", cell: 64, motion: "shoot", idleFrameMs: 280 },
  { resourceId: "generated-enemy-mummy-bandage", path: "assets/generated/pixel-enemies/mummy-bandage.png", cell: 64, motion: "stomp", idleFrameMs: 340 },
  { resourceId: "generated-enemy-spirit-fire", path: "assets/generated/pixel-enemies/spirit-fire.png", cell: 64, motion: "float", idleFrameMs: 160 },
  { resourceId: "generated-enemy-spirit-water", path: "assets/generated/pixel-enemies/spirit-water.png", cell: 64, motion: "float", idleFrameMs: 220 },
  { resourceId: "generated-enemy-golem-iron", path: "assets/generated/pixel-enemies/golem-iron.png", cell: 64, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-armor-living", path: "assets/generated/pixel-enemies/armor-living.png", cell: 64, motion: "stomp", idleFrameMs: 300 },
  { resourceId: "generated-enemy-mimic-chest", path: "assets/generated/pixel-enemies/mimic-chest.png", cell: 64, motion: "hop", idleFrameMs: 200 },
  { resourceId: "generated-enemy-eye-floating", path: "assets/generated/pixel-enemies/eye-floating.png", cell: 64, motion: "shoot", idleFrameMs: 200 },
  { resourceId: "generated-enemy-goblin-scout", path: "assets/generated/pixel-enemies/goblin-scout.png", cell: 64, motion: "dash", idleFrameMs: 160 },
  { resourceId: "generated-enemy-orc-warrior", path: "assets/generated/pixel-enemies/orc-warrior.png", cell: 64, motion: "stomp", idleFrameMs: 300 },
  { resourceId: "generated-enemy-orc-shaman", path: "assets/generated/pixel-enemies/orc-shaman.png", cell: 64, motion: "shoot", idleFrameMs: 240 },
  { resourceId: "generated-enemy-bandit-mask", path: "assets/generated/pixel-enemies/bandit-mask.png", cell: 64, motion: "dash", idleFrameMs: 170 },
  { resourceId: "generated-enemy-lizardman-spear", path: "assets/generated/pixel-enemies/lizardman-spear.png", cell: 64, motion: "dash", idleFrameMs: 190 },
  { resourceId: "generated-enemy-harpy-cliff", path: "assets/generated/pixel-enemies/harpy-cliff.png", cell: 64, motion: "swoop", idleFrameMs: 120 },
  { resourceId: "generated-enemy-minotaur-maze", path: "assets/generated/pixel-enemies/minotaur-maze.png", cell: 96, motion: "stomp", idleFrameMs: 320 },
  { resourceId: "generated-enemy-troll-cave", path: "assets/generated/pixel-enemies/troll-cave.png", cell: 96, motion: "stomp", idleFrameMs: 340 },
  { resourceId: "generated-enemy-gargoyle-stone", path: "assets/generated/pixel-enemies/gargoyle-stone.png", cell: 64, motion: "swoop", idleFrameMs: 260 },
  { resourceId: "generated-enemy-demon-lord", path: "assets/generated/pixel-enemies/demon-lord.png", cell: 96, motion: "breath", idleFrameMs: 280 },
  // 2026-10-02 폐기 그림의 원본 도트 대체: 요청한 97종 + 추가 감사의 일반 적 3종.
  // organic: 34종 — 저작 원본과 검토 해시는 retirement/organic, verify-shots/legacy-monsters/organic.
  { resourceId: "generated-enemy-crab-01", path: "assets/generated/pixel-enemies/crab-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spider-01", path: "assets/generated/pixel-enemies/spider-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-snake-01", path: "assets/generated/pixel-enemies/snake-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-scorpion-01", path: "assets/generated/pixel-enemies/scorpion-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-wolf-01", path: "assets/generated/pixel-enemies/wolf-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-centipede-01", path: "assets/generated/pixel-enemies/centipede-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-horse-01", path: "assets/generated/pixel-enemies/horse-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-unicorn-01", path: "assets/generated/pixel-enemies/unicorn-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-cat-01", path: "assets/generated/pixel-enemies/cat-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-cockatrice-01", path: "assets/generated/pixel-enemies/cockatrice-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-parasite-01", path: "assets/generated/pixel-enemies/parasite-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-mantis-01", path: "assets/generated/pixel-enemies/mantis-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-fish-01", path: "assets/generated/pixel-enemies/fish-01.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-bat-cave", path: "assets/generated/pixel-enemies/bat-cave.png", cell: 64, motion: "swoop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spider-widow", path: "assets/generated/pixel-enemies/spider-widow.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-beetle-horn", path: "assets/generated/pixel-enemies/beetle-horn.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-centipede-fire", path: "assets/generated/pixel-enemies/centipede-fire.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-moth-dust", path: "assets/generated/pixel-enemies/moth-dust.png", cell: 64, motion: "swoop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-worm-sand", path: "assets/generated/pixel-enemies/worm-sand.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-ant-soldier", path: "assets/generated/pixel-enemies/ant-soldier.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-wolf-dire", path: "assets/generated/pixel-enemies/wolf-dire.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-tiger-saber", path: "assets/generated/pixel-enemies/tiger-saber.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-rat-giant", path: "assets/generated/pixel-enemies/rat-giant.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-bird-hawk", path: "assets/generated/pixel-enemies/bird-hawk.png", cell: 64, motion: "swoop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-cat-shadow", path: "assets/generated/pixel-enemies/cat-shadow.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-goat-mountain", path: "assets/generated/pixel-enemies/goat-mountain.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-ape-stone", path: "assets/generated/pixel-enemies/ape-stone.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-deer-forest", path: "assets/generated/pixel-enemies/deer-forest.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-fish-piranha", path: "assets/generated/pixel-enemies/fish-piranha.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-squid-deep", path: "assets/generated/pixel-enemies/squid-deep.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-shark-land", path: "assets/generated/pixel-enemies/shark-land.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-eel-electric", path: "assets/generated/pixel-enemies/eel-electric.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-leaf-fox", path: "assets/generated/pixel-enemies/leaf-fox.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-fire-pup", path: "assets/generated/pixel-enemies/fire-pup.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  // arcane: 39종 — 저작 원본과 검토 해시는 retirement/arcane, verify-shots/legacy-monsters/arcane.
  { resourceId: "generated-enemy-ontology-8da61312", path: "assets/generated/pixel-enemies/ontology-8da61312.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-sylph-hornet", path: "assets/generated/pixel-enemies/sylph-hornet-transparent.png", cell: 64, motion: "swoop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-skeleton-01", path: "assets/generated/pixel-enemies/skeleton-01.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-ghost-01", path: "assets/generated/pixel-enemies/ghost-01.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-plant-01", path: "assets/generated/pixel-enemies/plant-01.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-carbuncle-01", path: "assets/generated/pixel-enemies/carbuncle-01.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-jackolantern-01", path: "assets/generated/pixel-enemies/jackolantern-01.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spirit-01", path: "assets/generated/pixel-enemies/spirit-01.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-ghoul-01", path: "assets/generated/pixel-enemies/ghoul-01.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-specter-01", path: "assets/generated/pixel-enemies/specter-01.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-lemora-01", path: "assets/generated/pixel-enemies/lemora-01.png", cell: 64, motion: "breath", idleFrameMs: 180 },
  { resourceId: "generated-enemy-sylph-01", path: "assets/generated/pixel-enemies/sylph-01.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-king-slime-01", path: "assets/generated/pixel-enemies/king-slime-01.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-slime-blue", path: "assets/generated/pixel-enemies/slime-blue.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-slime-green", path: "assets/generated/pixel-enemies/slime-green.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-slime-metal", path: "assets/generated/pixel-enemies/slime-metal.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-slime-king", path: "assets/generated/pixel-enemies/slime-king.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-slime-cube", path: "assets/generated/pixel-enemies/slime-cube.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-ooze-black", path: "assets/generated/pixel-enemies/ooze-black.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-ooze-acid", path: "assets/generated/pixel-enemies/ooze-acid.png", cell: 64, motion: "hop", idleFrameMs: 180 },
  { resourceId: "generated-enemy-skeleton-bone", path: "assets/generated/pixel-enemies/skeleton-bone.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-ghoul-grave", path: "assets/generated/pixel-enemies/ghoul-grave.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-wraith-dark", path: "assets/generated/pixel-enemies/wraith-dark.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-banshee-wail", path: "assets/generated/pixel-enemies/banshee-wail.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-revenant-vengeful", path: "assets/generated/pixel-enemies/revenant-vengeful.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-bonepile-crawler", path: "assets/generated/pixel-enemies/bonepile-crawler.png", cell: 64, motion: "dash", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spirit-wind", path: "assets/generated/pixel-enemies/spirit-wind.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spirit-light", path: "assets/generated/pixel-enemies/spirit-light.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spirit-dark", path: "assets/generated/pixel-enemies/spirit-dark.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-sylph-air", path: "assets/generated/pixel-enemies/sylph-air.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-undine-sea", path: "assets/generated/pixel-enemies/undine-sea.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-golem-stone", path: "assets/generated/pixel-enemies/golem-stone.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-golem-clay", path: "assets/generated/pixel-enemies/golem-clay.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-golem-crystal", path: "assets/generated/pixel-enemies/golem-crystal.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-sword-flying", path: "assets/generated/pixel-enemies/sword-flying.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-scarecrow-field", path: "assets/generated/pixel-enemies/scarecrow-field.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-puppet-string", path: "assets/generated/pixel-enemies/puppet-string.png", cell: 64, motion: "float", idleFrameMs: 180 },
  { resourceId: "generated-enemy-totem-cursed", path: "assets/generated/pixel-enemies/totem-cursed.png", cell: 64, motion: "stomp", idleFrameMs: 180 },
  { resourceId: "generated-enemy-spirit-earth", path: "assets/generated/pixel-enemies/spirit-earth.png", cell: 64, motion: "float", idleFrameMs: 180 },
  // humanoid: 27종 — 저작 원본과 검토 해시는 retirement/humanoid, verify-shots/legacy-monsters/humanoid.
  { resourceId: "generated-enemy-zombie-01", path: "assets/generated/pixel-enemies/zombie-01.png", cell: 64, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-orc-01", path: "assets/generated/pixel-enemies/orc-01.png", cell: 64, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-harpy-01", path: "assets/generated/pixel-enemies/harpy-01.png", cell: 64, motion: "swoop", idleFrameMs: 200 },
  { resourceId: "generated-enemy-salamander-01", path: "assets/generated/pixel-enemies/salamander-01.png", cell: 64, motion: "dash", idleFrameMs: 200 },
  { resourceId: "generated-enemy-kappa-01", path: "assets/generated/pixel-enemies/kappa-01.png", cell: 64, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-leafling-01", path: "assets/generated/pixel-enemies/leafling-01.png", cell: 64, motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-sparkit-01", path: "assets/generated/pixel-enemies/sparkit-01.png", cell: 64, motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-aqualing-01", path: "assets/generated/pixel-enemies/aqualing-01.png", cell: 64, motion: "float", idleFrameMs: 200 },
  { resourceId: "generated-enemy-salamander-flame", path: "assets/generated/pixel-enemies/salamander-flame.png", cell: 64, motion: "dash", idleFrameMs: 200 },
  { resourceId: "generated-enemy-goblin-brute", path: "assets/generated/pixel-enemies/goblin-brute.png", cell: 64, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-kobold-digger", path: "assets/generated/pixel-enemies/kobold-digger.png", cell: 64, motion: "dash", idleFrameMs: 200 },
  { resourceId: "generated-enemy-mage-rogue", path: "assets/generated/pixel-enemies/mage-rogue.png", cell: 64, motion: "shoot", idleFrameMs: 200 },
  { resourceId: "generated-enemy-knight-fallen", path: "assets/generated/pixel-enemies/knight-fallen.png", cell: 64, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-centaur-plains", path: "assets/generated/pixel-enemies/centaur-plains.png", cell: 96, motion: "dash", idleFrameMs: 200 },
  { resourceId: "generated-enemy-ogre-club", path: "assets/generated/pixel-enemies/ogre-club.png", cell: 96, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-imp-mischief", path: "assets/generated/pixel-enemies/imp-mischief.png", cell: 64, motion: "swoop", idleFrameMs: 200 },
  { resourceId: "generated-enemy-griffin-sky", path: "assets/generated/pixel-enemies/griffin-sky.png", cell: 96, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-wyvern-cliff", path: "assets/generated/pixel-enemies/wyvern-cliff.png", cell: 96, motion: "swoop", idleFrameMs: 200 },
  { resourceId: "generated-enemy-roc-giant", path: "assets/generated/pixel-enemies/roc-giant.png", cell: 64, motion: "swoop", idleFrameMs: 200 },
  { resourceId: "generated-enemy-phoenix-rebirth", path: "assets/generated/pixel-enemies/phoenix-rebirth.png", cell: 96, motion: "swoop", idleFrameMs: 200 },
  { resourceId: "generated-enemy-dragon-whelp", path: "assets/generated/pixel-enemies/dragon-whelp.png", cell: 64, motion: "breath", idleFrameMs: 200 },
  { resourceId: "generated-enemy-dragon-red", path: "assets/generated/pixel-enemies/dragon-red.png", cell: 96, motion: "breath", idleFrameMs: 200 },
  { resourceId: "generated-enemy-dragon-blue", path: "assets/generated/pixel-enemies/dragon-blue.png", cell: 96, motion: "breath", idleFrameMs: 200 },
  { resourceId: "generated-enemy-dragon-bone", path: "assets/generated/pixel-enemies/dragon-bone.png", cell: 96, motion: "breath", idleFrameMs: 200 },
  { resourceId: "generated-enemy-hydra-three", path: "assets/generated/pixel-enemies/hydra-three.png", cell: 96, motion: "breath", idleFrameMs: 200 },
  { resourceId: "generated-enemy-behemoth-horn", path: "assets/generated/pixel-enemies/behemoth-horn.png", cell: 96, motion: "stomp", idleFrameMs: 200 },
  { resourceId: "generated-enemy-angel-fallen", path: "assets/generated/pixel-enemies/angel-fallen.png", cell: 64, motion: "swoop", idleFrameMs: 200 },

];

export const PIXEL_ENEMY_FRAME: Readonly<Record<PixelEnemyCell, { readonly col: number; readonly row: number }>> = {
  idle_a: { col: 0, row: 0 },
  idle_b: { col: 1, row: 0 },
  idle_c: { col: 2, row: 0 },
  windup: { col: 0, row: 1 },
  move: { col: 1, row: 1 },
  attack: { col: 2, row: 1 },
  recover: { col: 0, row: 2 },
  hit: { col: 1, row: 2 },
  dead: { col: 2, row: 2 },
};

const byId = new Map(PIXEL_ENEMY_SHEETS.map((entry) => [entry.resourceId, entry]));
const legacyAliases: Readonly<Record<string, string>> = {
  slime: "generated-enemy-slime-01",
  classic_blue_slime: "generated-enemy-slime-blue",
  meadow_green_slime: "generated-enemy-slime-green",
  minotaur: "generated-enemy-minotaur-maze",
  monster_minotaur: "generated-enemy-minotaur-maze",
};

export function pixelEnemySheet(resourceId: string | undefined): PixelEnemySheet | undefined {
  if (!resourceId) return undefined;
  const namedId = resourceId.replace(/-enemy_extra_\d+$/, "");
  return byId.get(namedId) ?? (Object.hasOwn(legacyAliases, namedId) ? byId.get(legacyAliases[namedId]) : undefined);
}

export function pixelEnemyCell(entry: PixelEnemySheet): number {
  return entry.cell ?? PIXEL_ENEMY_CELL;
}

export function pixelEnemySheetUrl(entry: PixelEnemySheet): string {
  return withInlineAsset(`/${entry.path}`);
}
