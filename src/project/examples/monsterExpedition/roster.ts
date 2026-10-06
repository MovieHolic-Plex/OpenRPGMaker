import type { EnemyStats, MonsterSpeciesRecord, Project, SkillRecord, UploadedAsset } from "@/project/types";
import { normalizeEnemyRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import uploadedArt from "../../../../public/assets/monster-expedition/creatures/uploaded-art.json";
import { expeditionEnemyActions } from "./enemyActions";

export type ExpeditionHabitat = "grass" | "forest" | "coast" | "mountain" | "desert" | "snow" | "cave" | "ruins" | "swamp" | "volcano";
export interface ExpeditionSpeciesInfo {
  id: string;
  name: string;
  types: string[];
  /** 0 denotes a rare species without an evolution line. */
  stage: 0 | 1 | 2 | 3;
  family: string;
  habitat: ExpeditionHabitat;
  description: string;
}

type Family = {
  family: string;
  slugs: [string, string, string];
  names: [string, string, string];
  types: [string, string?];
  /** Some families acquire their second type only when evolving. */
  secondaryFrom?: 1 | 2 | 3;
  primary?: string;
  habitat: ExpeditionHabitat;
  notes: [string, string, string];
  /** Final HP / attack / defense / special / speed bases, before IV and level. */
  stats: [number, number, number, number, number];
  evolution: [number, number];
};

const FAMILIES: readonly Family[] = [
  { family: "hare", slugs: ["spriglet", "frondhare", "grovewarden"], names: ["새싹토", "잎귀토", "숲지기토"], types: ["grass", "psychic"], secondaryFrom: 3, habitat: "grass", stats: [88, 78, 86, 108, 92], evolution: [16, 34], notes: ["귀 끝의 새싹으로 바람을 읽는다. 씨앗을 묻은 장소를 잊지 않는다.", "목의 잎깃으로 햇빛을 모은다. 새싹이 자라는 길만 골라 뛴다.", "나뭇가지 귀로 숲의 기억을 듣는다. 어린 몬스터에게 그늘을 내준다."] },
  { family: "pangolin", slugs: ["coalbit", "kilnclaw", "furnscale"], names: ["숯비늘", "가마발", "용광비늘"], types: ["fire", "fighting"], secondaryFrom: 2, habitat: "volcano", stats: [90, 112, 100, 78, 70], evolution: [16, 34], notes: ["바위 틈의 잔열을 먹는다. 졸릴 때 비늘에서 작은 불꽃이 샌다.", "앞발로 뜨거운 돌을 쪼갠다. 스스로 만든 가마 안에서 잠든다.", "겹비늘 속에 열을 오래 저장한다. 용암 길을 막는 바위를 부순다."] },
  { family: "otter", slugs: ["rivulet", "brookraft", "tidekeeper"], names: ["여울랑", "뗏목랑", "조수지기"], types: ["water", "ice"], secondaryFrom: 3, habitat: "coast", stats: [94, 86, 88, 105, 90], evolution: [16, 34], notes: ["조약돌을 배 위에 올리고 물에 뜬다. 맑은 물소리를 좋아한다.", "나무껍질 뗏목으로 동료를 실어 나른다. 급류 속에서도 방향을 잃지 않는다.", "왕관 같은 조개로 조수의 때를 읽는다. 찬 해류를 돌려 항구를 지킨다."] },
  { family: "beetle", slugs: ["pipbug", "podback", "orchardant"], names: ["씨앗충", "콩등충", "과수장수"], types: ["bug", "grass"], secondaryFrom: 2, habitat: "forest", stats: [78, 102, 106, 70, 72], evolution: [10, 23], notes: ["등에 작은 씨앗을 싣고 낙엽 사이를 걷는다. 얇은 더듬이로 비를 감지한다.", "등껍질 틈에서 잎이 돋는다. 먹다 남은 열매를 땅에 묻는다.", "과수원에 사는 큰 장수벌레다. 뿔로 흙을 갈고 씨앗을 깊이 심는다."] },
  { family: "bird", slugs: ["gustchick", "ribbonwing", "galecrest"], names: ["바람삐", "리본날개", "돌풍깃"], types: ["normal", "flying"], secondaryFrom: 1, habitat: "grass", stats: [80, 96, 70, 75, 119], evolution: [14, 30], notes: ["작은 볏을 세워 바람을 찾는다. 아직 멀리 날지 못해 짧게 뛰어다닌다.", "길어진 꼬리깃으로 공중에서 균형을 잡는다. 여행자의 길을 따라 날아간다.", "가파른 상승기류를 타고 산을 넘는다. 돌풍을 일으켜 길 잃은 새를 구한다."] },
  { family: "gecko", slugs: ["zaptoe", "coilcrest", "stormskink"], names: ["톡발도마", "코일볏", "폭풍도마"], types: ["electric", "dragon"], secondaryFrom: 3, habitat: "mountain", stats: [78, 93, 76, 105, 110], evolution: [18, 36], notes: ["발바닥이 마른 돌에 닿으면 톡 소리가 난다. 정전기로 작은 벌레를 잡는다.", "볏에 전기를 감아 저장한다. 비가 오기 전에 바위벽 위로 모여든다.", "등의 번개판으로 구름과 전류를 나눈다. 천둥이 치는 날에도 평온하게 잔다."] },
  { family: "ram", slugs: ["pebblekid", "craghoof", "ridgehorn"], names: ["조약양", "절벽굽", "능선뿔"], types: ["rock", "fighting"], secondaryFrom: 2, habitat: "mountain", stats: [102, 112, 115, 55, 60], evolution: [19, 37], notes: ["돌처럼 단단한 발굽을 가진 어린 산양이다. 자갈을 차며 놀다가 길을 만든다.", "낮은 바위틈을 뿔로 넓힌다. 절벽에서도 발굽이 미끄러지지 않는다.", "능선의 오래된 암석이 등에 붙어 갑옷이 됐다. 떨어지는 바위를 몸으로 받는다."] },
  { family: "scorpion", slugs: ["sandnip", "dunestalk", "miragespike"], names: ["모래집게", "사구꼬리", "신기루침"], types: ["poison", "ground"], secondaryFrom: 1, habitat: "desert", stats: [82, 107, 93, 60, 98], evolution: [17, 35], notes: ["집게로 얇은 모래막을 친다. 꼬리침은 자기보다 큰 그림자에만 쓴다.", "사구 아래의 진동을 읽는다. 발자국을 남기지 않고 먹잇감 곁으로 다가간다.", "꼬리의 결정이 열기를 굴절시킨다. 여러 그림자를 만들어 오아시스를 지킨다."] },
  { family: "lynx", slugs: ["flurrykit", "rimepelt", "glaciermane"], names: ["눈송냥", "서리털", "빙하갈기"], types: ["ice", "normal"], secondaryFrom: 2, habitat: "snow", stats: [86, 104, 80, 85, 112], evolution: [18, 36], notes: ["눈 위에 둥근 발자국을 남긴다. 귀 끝의 털이 흩날리는 눈을 붙잡는다.", "두꺼운 목털에 서리가 달라붙는다. 눈보라 속에서도 작은 소리를 듣는다.", "수정 갈기는 오래된 빙하의 물로 자랐다. 달빛 아래서 조용히 눈밭을 달린다."] },
  { family: "moth", slugs: ["wickworm", "lanternwing", "beaconmoth"], names: ["심지충", "등불나방", "봉화나방"], types: ["bug", "fire"], secondaryFrom: 2, habitat: "forest", stats: [76, 62, 72, 112, 106], evolution: [11, 25], notes: ["머리의 심지에서 따뜻한 빛이 난다. 마른 나뭇잎 사이에 몸을 숨긴다.", "날개의 무늬가 등불처럼 켜진다. 숲을 걷는 밤손님의 길을 비춘다.", "커다란 날개의 네 빛점으로 동료에게 신호한다. 빛을 한곳에 모으면 강한 열이 난다."] },
  { family: "newt", slugs: ["miretail", "venomfrill", "marshcrown"], names: ["늪꼬리", "독주름", "습지왕관"], types: ["poison", "water"], secondaryFrom: 2, habitat: "swamp", stats: [100, 73, 85, 106, 68], evolution: [17, 33], notes: ["진흙과 같은 빛깔로 몸을 숨긴다. 꼬리의 점은 경계할 때 밝아진다.", "독성 물질을 목주름에 모아 저장한다. 물을 마시기 전에 주름으로 거른다.", "왕관 모양의 주름으로 습지의 물길을 찾는다. 깊은 늪에서도 아가미로 숨을 쉰다."] },
  { family: "boar", slugs: ["rootpig", "brambleboar", "briartusk"], names: ["뿌리꿀", "덤불멧", "가시엄니"], types: ["ground", "grass"], secondaryFrom: 2, habitat: "forest", stats: [112, 112, 93, 62, 66], evolution: [18, 35], notes: ["흙냄새로 먹을 뿌리를 찾는다. 등에 자라는 잎은 배가 부르면 곧게 선다.", "몸에 붙은 덤불이 비바람을 막는다. 땅을 파헤친 자리에 어린 나무가 자란다.", "단단한 가시갑옷과 큰 엄니를 갖췄다. 메마른 숲의 흙을 뒤집어 새싹을 돕는다."] },
  { family: "mantis", slugs: ["dozemite", "trancescythe", "oraclemantis"], names: ["졸음사마", "몽환낫", "예지사마"], types: ["psychic", "bug"], secondaryFrom: 2, habitat: "ruins", stats: [74, 101, 68, 112, 99], evolution: [20, 38], notes: ["반쯤 감은 듯한 눈으로 오래 가만히 앉는다. 잠든 몬스터의 움직임을 따라 한다.", "팔의 얇은 막이 꿈결 같은 빛을 낸다. 상대가 움직이기 전에 낫을 뻗는다.", "이마의 결정으로 먼 진동을 읽는다. 오래된 유적에서 길을 묻는 이에게 팔을 펼친다."] },
  { family: "mole", slugs: ["gritnose", "tunnelpaw", "faultdigger"], names: ["자갈코", "굴손", "단층발"], types: ["ground", "rock"], secondaryFrom: 3, habitat: "cave", stats: [91, 108, 104, 60, 80], evolution: [16, 32], notes: ["넓은 코로 돌가루의 냄새를 맡는다. 작은 발톱으로 무른 벽만 골라 판다.", "광석을 머리에 얹어 굴의 높이를 잰다. 넓어진 앞발로 떨어진 흙을 밀어낸다.", "광맥을 따라 땅속을 깊이 누빈다. 단층이 흔들리면 동료를 안전한 굴로 이끈다."] },
  { family: "puppet", slugs: ["threadimp", "hushdoll", "veilmaster"], names: ["실꼬마", "고요인형", "장막인형"], types: ["ghost", "psychic"], secondaryFrom: 3, habitat: "ruins", stats: [80, 65, 86, 115, 96], evolution: [21, 39], notes: ["끊어진 실을 끌고 빈 무대에 나타난다. 누가 보아도 웃는 듯한 표정을 짓는다.", "낡은 천으로 몸을 감쌌다. 조용한 객석에서는 무대의 오래된 박수를 들을 수 있다.", "머리의 가면과 긴 장막으로 작은 공연을 연다. 사람들의 잊힌 꿈을 인형극으로 보여준다."] },
  { family: "heron", slugs: ["reedpeep", "fenstrider", "mistralheron"], names: ["갈대삐", "습지걸음", "안개왜가리"], types: ["flying", "water"], secondaryFrom: 2, habitat: "swamp", stats: [82, 82, 78, 104, 108], evolution: [15, 31], notes: ["갈대 사이에서 짧게 운다. 가는 발가락으로 수면의 작은 잎을 밟고 걷는다.", "길어진 목으로 얕은 물속을 살핀다. 다리의 문양이 물에 비치면 물고기가 모인다.", "긴 꼬리깃으로 안개를 가른다. 강을 따라 날면서 물길이 막힌 곳을 찾아낸다."] },
  { family: "crab", slugs: ["coralpin", "reefguard", "atollclamp"], names: ["산호집", "암초방패", "환초집게"], types: ["water", "rock"], secondaryFrom: 2, habitat: "coast", stats: [86, 110, 120, 62, 57], evolution: [19, 36], notes: ["껍질의 작은 산호는 서로 다른 빛깔로 자란다. 빈 조개를 집게에 끼워 논다.", "등의 산호숲에 작은 생물이 모여든다. 넓은 집게로 거센 파도를 흩는다.", "크고 튼튼한 등껍질이 살아 있는 환초처럼 보인다. 동료를 숨길 틈을 늘 비워 둔다."] },
  { family: "seahorse", slugs: ["curlfin", "brinewyrm", "abyssail"], names: ["돌돌해마", "소금비룡", "심해돛룡"], types: ["dragon", "water"], secondaryFrom: 1, habitat: "coast", stats: [88, 87, 85, 115, 88], evolution: [24, 43], notes: ["꼬리를 돌돌 말아 해초를 붙잡는다. 작은 볏 아래에 파도의 힘을 모은다.", "두 개의 지느러미로 깊은 해류를 탄다. 비늘에 붙은 소금결정이 물속에서 빛난다.", "돛 같은 큰 지느러미를 펼쳐 심해를 가른다. 해저의 느린 흐름을 바꾸는 힘이 있다."] },
];

const RARES = [
  { slug: "thundercairn", family: "ibex", name: "천뢰산양", types: ["electric", "rock"], habitat: "mountain", stats: [100, 115, 110, 100, 90], description: "산봉우리의 벼락을 긴 뿔로 받아 땅에 흘린다. 폭풍 뒤 남은 돌무더기 위에서 쉬는 모습을 볼 수 있다." },
  { slug: "winterquill", family: "crane", name: "설월학", types: ["ice", "flying"], habitat: "snow", stats: [95, 85, 90, 120, 120], description: "첫눈이 내리는 밤에 빙하 위를 선회한다. 넓은 날개가 지나간 자리에 얇은 서리꽃이 피어난다." },
  { slug: "solmane", family: "lion", name: "해갈기사자", types: ["fire", "normal"], habitat: "volcano", stats: [110, 120, 95, 115, 95], description: "햇빛을 저장한 갈기로 밤에도 몸을 덥힌다. 오래된 화산의 열기가 가라앉을 때 모습을 드러낸다." },
  { slug: "lunavane", family: "ray", name: "달빛가오리", types: ["psychic", "water"], habitat: "coast", stats: [105, 70, 105, 125, 110], description: "만월에 고요해진 바다 위를 미끄러지듯 난다. 날개의 빛점은 바다가 기억하는 별의 자리를 닮았다." },
  { slug: "relicarab", family: "scarab", name: "유적장수", types: ["bug", "rock"], habitat: "desert", stats: [95, 115, 125, 95, 75], description: "묻힌 유적을 지키는 큰 갑충이다. 뿔의 문양이 일몰에 빛나면 사막의 숨은 문이 열렸다고 한다." },
  { slug: "astralhart", family: "stag", name: "별가지사슴", types: ["grass", "ghost"], habitat: "ruins", stats: [100, 90, 100, 125, 110], description: "별처럼 갈라진 뿔에 잊힌 숲의 빛을 모은다. 섬의 마지막 봉인이 풀린 뒤에야 빈 신전에 발자국을 남긴다." },
] as const;

const sid = (slug: string): string => `mx_species_${slug}`;
const moveId = (type: string, tier: number): string => `mx_skill_${type}_${tier}`;
const typesFor = (family: Family, stage: number): string[] => family.types.filter((type, i): type is string => !!type && (i === 0 || stage >= (family.secondaryFrom ?? 1)));

export const EXPEDITION_SPECIES: readonly ExpeditionSpeciesInfo[] = [
  ...FAMILIES.flatMap(family => family.slugs.map((slug, index) => ({
    id: sid(slug), name: family.names[index]!, types: typesFor(family, index + 1),
    stage: (index + 1) as 1 | 2 | 3, family: family.family, habitat: family.habitat, description: family.notes[index]!,
  }))),
  ...RARES.map(rare => ({ id: sid(rare.slug), name: rare.name, types: [...rare.types], stage: 0 as const, family: rare.family, habitat: rare.habitat, description: rare.description })),
];
export const EXPEDITION_STARTERS = [sid("spriglet"), sid("coalbit"), sid("rivulet")] as const;
export const EXPEDITION_LEGENDARIES = RARES.map(rare => sid(rare.slug));

/** Native cumulative curve: L16=1,871, L34=8,127, L56=21,524 EXP.
 * All stages in one family use the same curve, so evolution preserves progress.
 */
export const EXPEDITION_EXP_CURVE = { base: 18, extra: 8, acceleration: 8 };

const MOVE_NAMES: Readonly<Record<string, readonly [string, string, string, string, string, string]>> = {
  normal: ["어깨툭", "꼬리채찍", "돌진발", "공명울음", "개척강타", "숨고르기"],
  fighting: ["앞발치기", "쌍굽차기", "바위쪼개기", "천근권", "능선격파", "결의의발"],
  flying: ["깃바람", "회전깃", "상승기류", "폭풍날개", "하늘가르기", "순풍깃"],
  poison: ["점액침", "독주름", "독니찍기", "산성파도", "맹독비늘", "경계분비"],
  ground: ["흙먼지", "뿌리밀기", "사구무너뜨리기", "단층파동", "대지뒤집기", "모래장막"],
  rock: ["자갈쏘기", "석편날리기", "능선충돌", "광맥분쇄", "산울림", "암석갑옷"],
  bug: ["더듬이쏘기", "씨앗집게", "절단날개", "군집돌파", "과수포위", "껍질여미기"],
  ghost: ["실그림자", "빈무대", "장막베기", "밤의박수", "잊힌공연", "고요의시선"],
  fire: ["숯불톡", "가마숨", "열비늘", "봉화불길", "해갈기폭염", "열기춤"],
  water: ["여울방울", "물살밀기", "조수파도", "암초소용돌이", "심해해일", "맑은물씻기"],
  grass: ["새싹치기", "잎귀베기", "덩굴물기", "숲의맥동", "뿌리왕관", "햇살쉼"],
  electric: ["톡번개", "코일전류", "번개발", "폭풍방전", "천뢰낙하", "전류실"],
  psychic: ["꿈방울", "기억파동", "예지낫", "달빛공명", "별의추론", "꿈의자장가"],
  ice: ["서리발", "눈바늘", "빙하발톱", "설월바람", "영구동결", "서리숨"],
  dragon: ["비늘울림", "소금숨결", "돛룡파동", "심해포효", "섬의메아리", "용의호흡"],
};
const PHYSICAL_TYPES = new Set(["normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost"]);
const ANIMATIONS: Readonly<Record<string, string>> = {
  normal: "anim_attack", fighting: "anim_attack", flying: "anim_attack", poison: "anim_poison", ground: "anim_attack", rock: "anim_attack", bug: "anim_attack", ghost: "anim_magic", fire: "anim_fire", water: "anim_heal", grass: "anim_heal", electric: "anim_magic", psychic: "anim_magic", ice: "anim_magic", dragon: "anim_magic",
};
const DEBUFF: Readonly<Record<string, string>> = {
  fire: "state_burn", water: "state_agility_down", grass: "state_sleep", electric: "state_paralysis", psychic: "state_sleep", ice: "state_freeze", poison: "state_poison", ghost: "state_attack_down", ground: "state_agility_down", rock: "state_defense_down", bug: "state_defense_down", normal: "state_attack_down", flying: "state_agility_down", fighting: "state_defense_down", dragon: "state_attack_down",
};

function buildMoves(project: Project): SkillRecord[] {
  const availableStates = new Set(project.database.states.map(state => state.id));
  const availableAnimations = new Set(project.database.battleAnimations.map(animation => animation.id));
  const stateEffect = (stateId: string, chance: number, operation: "add" | "remove" = "add") => availableStates.has(stateId) ? [{ stateId, chance, operation }] : [];
  return Object.entries(MOVE_NAMES).flatMap(([type, names]) => names.map((name, index) => {
    const tier = index + 1;
    const move: Partial<SkillRecord> & Pick<SkillRecord, "id" | "name"> = {
      id: moveId(type, tier), name, elementId: type,
      scope: "enemy", power: [35, 55, 75, 90, 105, 0][index]!, maxPp: [30, 25, 15, 10, 5, 15][index]!,
      mpCost: { flat: 0, percentMax: 0 }, successRate: 100, hitRate: tier >= 4 ? 90 : 100, variance: 0,
      effect: { kind: "damage", statistic: PHYSICAL_TYPES.has(type) ? "attack" : "mind", affects: "hp" },
      description: `${name}: ${type} 타입의 기술. 위력 ${[35, 55, 75, 90, 105, 0][index]}, 최대 횟수 ${[30, 25, 15, 10, 5, 15][index]}.`,
      ...(availableAnimations.has(ANIMATIONS[type]!) ? { animationId: ANIMATIONS[type] } : {}),
    };
    if (tier === 2 && ["poison", "electric", "fire", "ice"].includes(type)) {
      move.stateEffects = stateEffect(DEBUFF[type]!, type === "poison" ? 25 : 10);
      move.description += ` ${type === "poison" ? 25 : 10}% 확률로 상태이상을 준다.`;
    }
    if (tier === 3 && ["grass", "ghost", "bug"].includes(type)) {
      move.drainPercent = 50;
      move.description += " 준 피해의 절반을 체력으로 흡수한다.";
    }
    if (tier === 3 && ["fighting", "rock", "ice", "psychic"].includes(type)) {
      move.gen1CriticalRate = "high";
      move.description += " 급소에 맞을 확률이 높다.";
    }
    if (tier === 1 && ["normal", "flying", "electric"].includes(type)) {
      move.power = 30; move.movePriority = 1;
      move.description = `${name}: 위력 30. 같은 차례의 보통 공격보다 먼저 움직인다.`;
    }
    if (tier === 4 && ["ground", "water", "flying", "normal"].includes(type)) {
      move.stateEffects = stateEffect(DEBUFF[type]!, 20);
      move.description += " 20% 확률로 상대의 전투 능력을 낮춘다.";
    }
    if (tier === 5 && ["fire", "electric", "ice", "poison"].includes(type)) {
      move.hitRate = 85; move.stateEffects = stateEffect(DEBUFF[type]!, 20);
      move.description += " 명중률 85%. 20% 확률로 상태이상을 준다.";
    }
    if (tier === 6) {
      move.power = 0; move.hitRate = 100; move.effect = { kind: "support" };
      if (["normal", "grass", "dragon"].includes(type)) {
        move.scope = "self"; move.power = type === "grass" ? 60 : 45; move.maxPp = 10;
        move.effect = { kind: "healing", statistic: "mind", affects: "hp" };
        move.description = "자신의 체력을 회복한다. 회복량은 특수 능력에 따라 달라진다.";
      } else if (type === "water") {
        move.scope = "self"; move.maxPp = 10;
        move.stateEffects = ["state_poison", "state_burn", "state_paralysis", "state_sleep", "state_freeze"].flatMap(id => stateEffect(id, 100, "remove"));
        move.description = "맑은 물로 자신에게 걸린 독·화상·마비·수면·빙결을 씻어낸다.";
      } else if (["fighting", "flying", "rock", "bug"].includes(type)) {
        move.scope = "self";
        const buff = type === "fighting" ? "state_attack_up" : type === "flying" ? "state_agility_up" : "state_defense_up";
        move.stateEffects = stateEffect(buff, 100);
        move.description = type === "fighting" ? "결의를 다져 자신의 공격을 높인다." : type === "flying" ? "순풍을 타 자신의 속도를 높인다." : "몸을 굳혀 자신의 방어를 높인다.";
      } else {
        move.stateEffects = stateEffect(DEBUFF[type]!, 100);
        move.hitRate = type === "psychic" ? 75 : type === "ice" ? 55 : 90;
        move.maxPp = type === "ice" ? 5 : 15;
        move.description = type === "psychic" ? "자장가로 상대를 잠재운다. 명중률 75%." : type === "ice" ? "찬 숨결로 상대를 얼린다. 명중률 55%." : type === "electric" ? "전류의 실로 상대를 마비시킨다. 명중률 90%." : type === "poison" ? "경계하는 독성 분비물로 상대를 중독시킨다. 명중률 90%." : type === "fire" ? "춤추는 열기로 상대에게 화상을 준다. 명중률 90%." : type === "ghost" ? "고요한 시선으로 상대의 공격을 낮춘다. 명중률 90%." : "모래장막으로 상대의 속도를 낮춘다. 명중률 90%.";
      }
    }
    return normalizeSkillRecord(move);
  }));
}

function bases(values: readonly number[], stage: number): EnemyStats {
  const factor = stage === 1 ? 0.54 : stage === 2 ? 0.77 : 1;
  const [maxHp, attack, defense, mind, agility] = values.map(value => Math.round(value * factor));
  return { maxHp: maxHp!, maxMp: 12, attack: attack!, defense: defense!, mind: mind!, agility: agility! };
}

function learnset(primary: string, secondary: string) {
  const schedule: [number, string, number][] = [
    [1, "normal", 1], [3, primary, 1], [7, primary, 6], [11, primary, 2],
    [16, secondary, 1], [20, primary, 3], [23, secondary, 6], [27, secondary, 2],
    [32, primary, 4], [37, secondary, 3], [43, secondary, 4], [48, primary, 5], [54, secondary, 5],
  ];
  const seen = new Set<string>();
  return schedule.flatMap(([level, type, tier]) => {
    const skillId = moveId(type, tier);
    if (seen.has(skillId)) return [];
    seen.add(skillId);
    // Native Lv5 starters must face the first Lv9 gym without an automatic
    // full recovery loop. Recovery follows the second attack, at level 13.
    const learnLevel = tier === 6 && ["normal", "grass", "dragon"].includes(type) && level === 7 ? 13 : level;
    return [{ level: learnLevel, skillId }];
  }).sort((a, b) => a.level - b.level);
}

/** Configures only this content layer. Call after the native Gen1 preset provides
 * its 15 elements, type chart, and semantic status records. Never reads files or
 * mutates a remote/canonical store. All uploaded PNGs remain portable on export.
 */
export function configureExpeditionRoster(project: Project): void {
  const incomingArt: Record<string, UploadedAsset> = uploadedArt as Record<string, UploadedAsset>;
  // Clone so a project's SQLite externalization cannot mutate another seed.
  for (const [id, asset] of Object.entries(incomingArt)) project.assets.uploaded[id] = { ...asset, meta: { ...asset.meta } };
  const moves = buildMoves(project);
  const moveIds = new Set(moves.map(move => move.id));
  project.database.skills = [...project.database.skills.filter(move => !moveIds.has(move.id)), ...moves];
  const records: MonsterSpeciesRecord[] = FAMILIES.flatMap(family => family.slugs.map((slug, index) => {
    const stage = index + 1;
    const primary = family.primary ?? family.types[0];
    const secondary = family.types[1] ?? "normal";
    return normalizeMonsterSpeciesRecord({
      id: sid(slug), name: family.names[index]!, types: typesFor(family, stage),
      graphic: { monsterResourceId: `mx_art_${slug}_front`, backResourceId: `mx_art_${slug}_back`, graphicHue: 0, transparent: false, flying: ["bird", "moth", "heron"].includes(family.family) },
      baseStats: bases(family.stats, stage), expCurve: { ...EXPEDITION_EXP_CURVE },
      captureRate: [0.72, 0.42, 0.2][index], skillsByLevel: learnset(primary, secondary),
      evolutions: index < 2 ? [{ toSpeciesId: sid(family.slugs[index + 1]!), requires: { level: family.evolution[index]! } }] : [],
    });
  }));
  for (const rare of RARES) records.push(normalizeMonsterSpeciesRecord({
    id: sid(rare.slug), name: rare.name, types: [...rare.types],
    graphic: { monsterResourceId: `mx_art_${rare.slug}_front`, backResourceId: `mx_art_${rare.slug}_back`, graphicHue: 0, transparent: false, flying: ["crane", "ray"].includes(rare.family) },
    baseStats: bases(rare.stats, 3), expCurve: { ...EXPEDITION_EXP_CURVE }, captureRate: 0.065,
    skillsByLevel: learnset(rare.types[0], rare.types[1]), evolutions: [],
  }));
  const speciesIds = new Set(records.map(species => species.id));
  project.database.monsterSpecies = [...(project.database.monsterSpecies ?? []).filter(species => !speciesIds.has(species.id)), ...records];
  // One portable default enemy per species. The campaign generator creates
  // encounter-level variants with this same native stat/learnset derivation.
  const enemies = records.map(species => {
    const info = EXPEDITION_SPECIES.find(record => record.id === species.id)!;
    const level = info.stage === 0 ? 50 : info.stage === 1 ? 5 : info.stage === 2 ? 22 : 40;
    const skills = monsterSkillIdsAtLevel(species, level);
    return normalizeEnemyRecord({
      id: species.id.replace("mx_species_", "mx_enemy_"), name: species.name, speciesId: species.id,
      monsterResourceId: species.graphic.monsterResourceId, level,
      stats: monsterBattleStatsForSpecies(species, level, { hp: 7, atk: 7, def: 7, spd: 7 }),
      rewards: { exp: Math.round(level * (info.stage === 0 ? 7 : 2 + info.stage)), gold: level * 3, dropRatePercent: 0 },
      actions: expeditionEnemyActions(skills, moves),
      skillIds: skills, graphicHue: 0, transparent: false, flying: species.graphic.flying,
    });
  });
  const enemyIds = new Set(enemies.map(enemy => enemy.id));
  project.database.enemies = [...project.database.enemies.filter(enemy => !enemyIds.has(enemy.id)), ...enemies];
}
