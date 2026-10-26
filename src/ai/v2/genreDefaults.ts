// 조수 v2 — 채팅 한 줄로 시작한 현대·연애 게임에도 장르 기본값을 깐다.
//
// 왜 (2026-10-25 조수 단독 게임 G17/G18): 「현대 한국 배경의 연애 게임」을 빈 프로젝트에서 시작하면 주인공이 판타지 기본 칩(주황 머리 갑옷 영웅)이고,
// 전투가 없는데 체력 하트 HUD 「514/514」가 떴다. 연애 기본값(applyRomanceDefaults: 하루 루프·호감 하트 HUD·장르 잠금으로 주인공 현대 칩·대화창·타이틀)은
// 새 게임 인터뷰에서 연애를 고른 프로젝트에만 깔렸다. 조수가 첫 현대 장소를 지은 뒤 여기서 한 번 깐다.
// 이미 저작자가 정한 값은 덮지 않는다(각 기본값이 ??= 로 동작). 주인공 칩은 손대지 않은 기본(판타지 Actor1 0번)일 때만 바꾼다.
import { applyRomanceDefaults } from "@/project/romancePreset";
import { GENRE_LOCK_PRESETS } from "@/project/genreLock";
import { fieldMenu, storyFieldMenu } from "@/project/fieldMenu";
import { gameHasCombat } from "@/project/combatPresence";
import { resolveNpcGraphic } from "@/assets/charsetQuery";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { charsetBattlerForCharacter } from "@/assets/charsetBattlers";
import { sharedFaceIdForCharset } from "@/project/sharedCharacterFaceResolver";
import type { Project } from "@/project/types";

export const ROMANCE_SETUP_WORDS = /연애|데이트|썸|고백|공략|호감도|러브|미연시|romance|dating/iu;
/** 게임 하나를 시작하는 요청(장소 하나만 짓는 요청이면 HUD·연애 루프는 건드리지 않는다). */
const GAME_SETUP_WORDS = /게임|game/iu;
/** 전투를 말하는 낱말(전투가 있으면 체력 HUD 를 둔다). */
const BATTLE_WORDS = /전투|싸우|싸움|싸워|보스|적\b|적이|적을|적의|적과|적들|몬스터|마물|좀비|스킬|기술|마법|레벨|능력치|공격|체력|\bHP\b|마나|약점|인카운터|조우|무기|칼|검을|검이|갑옷|방패|장비|battle|enemy|skill|boss|monster|weapon|zombie/iu;
const PRISTINE_HERO = new Set([undefined, "easyrpg-charset-actor1"]);

/** 첫 현대 장소를 지은 뒤 한 번. 깐 것 이름 목록(보고용). */
export function applyModernSetupDefaults(project: Project, task: string, freshStart = false): string[] {
  const applied: string[] = [];
  const setup = freshStart || GAME_SETUP_WORDS.test(task);
  if (setup && ROMANCE_SETUP_WORDS.test(task) && !project.system.genreLock) {
    applied.push(...applyRomanceDefaults(project, { force: true }).map((name) => `연애 기본값 ${name}`));
  }
  const hero = project.database.actors.find((actor) => actor.id === "actor_hero") ?? project.database.actors[0];
  if (hero && PRISTINE_HERO.has(hero.characterResourceId) && (hero.characterIndex ?? 0) === 0) {
    const look = GENRE_LOCK_PRESETS.romance.charsets!.playerDefault;
    hero.characterResourceId = look.resourceId;
    hero.characterIndex = look.characterIndex;
    if (hero.faceResourceId === "easyrpg-faceset-actor1-00") delete hero.faceResourceId;
    applied.push("주인공 현대 칩");
  }
  applied.push(...applyStorySetupDefaults(project, task, freshStart));
  return applied;
}

/**
 * 전투를 말하지 않은 게임(현대든 판타지든): 체력 HUD 를 끈다(연애 기본값이 이미 호감 HUD 를 깔았으면 그대로).
 * 처음엔 현대 장소에만 깔아서 판타지 풍 이야기 게임(장난감 가게 회상)에 하트 다섯 개와 「514/514」가 남았다(2026-10-25 G51).
 * freshStart: 빈 프로젝트에서 처음 장소를 짓는 요청 — 「게임」이라는 낱말이 없어도 게임을 시작하는 것이다(「폐업 직전 장난감 가게 (회상 스토리)」).
 */
export function applyStorySetupDefaults(project: Project, task: string, freshStart = false): string[] {
  const setup = freshStart || GAME_SETUP_WORDS.test(task);
  if (!setup || BATTLE_WORDS.test(task)) return [];
  const applied: string[] = [];
  if (project.system.fieldHud === undefined) {
    project.system.fieldHud = { theme: "minimal", vitals: false, clock: true, tools: false, objective: true, hideEmpty: true };
    applied.push("체력 HUD 끔");
  }
  const hero = redressStoryHero(project, task);
  if (hero) applied.push(hero);
  // 주인공 차림을 바꾸지 않았어도(이미 다른 칩) 공장 기본 무기·방어구는 뺀다 — 전투 없는 게임에 검·방패·갑옷이 남았다(J88).
  if (!gameHasCombat(project) && stripFactoryHeroGear(project)) applied.push("주인공 기본 무기·방어구 뺌");
  // ESC 메뉴도 전투 없는 기본으로 — 스킬·장비·파티가 아무 일도 안 하는 JRPG 틀로 읽혔다(2026-10-25 판정 J39). 저작한 메뉴·연애 메뉴는 그대로.
  if (!fieldMenu(project)) {
    project.meta.oprnFieldMenu = storyFieldMenu();
    applied.push("ESC 메뉴 이야기용");
  }
  return applied;
}

/** 공장 기본 주인공 장비(검·떡갈나무 방패·가죽 갑옷·여행자 모자·집중 부적) — 전투 없는 이야기에서 들고 다닐 까닭이 없다(J43·J88). */
export const FACTORY_HERO_ARMS: Readonly<Record<string, string>> = { weapon: "equip_sword", shield: "equip_oak_shield", armor: "equip_leather_armor", helmet: "equip_traveler_hat", accessory: "equip_focus_charm" };

/** 전투 없는 게임: 주인공 시작 장비 중 공장 기본값만 뺀다(저작자가 고른 장비는 그대로). 뺀 칸 수. */
export function stripFactoryHeroGear(project: Project): number {
  const hero = project.database.actors.find((actor) => actor.id === "actor_hero") ?? project.database.actors[0];
  const equipment = hero?.initialEquipment;
  if (!equipment) return 0;
  let n = 0;
  for (const [slot, id] of Object.entries(FACTORY_HERO_ARMS)) if (equipment[slot] === id) { delete equipment[slot]; n++; }
  return n;
}

/**
 * 전투 없는 이야기 게임의 손대지 않은 기본 주인공(판타지 칩 Actor1 0번, 검과 방패를 든 두건 검사)을 평범한 사람 차림으로 갈아입힌다(J43).
 * 그림은 이름표가 아니라 그림 설명으로 찾는다(list_npc_graphics 와 같은 검색 — 성별·나이 낱말) — 요청이 소녀·여자 주인공을 말하면 젊은 여성,
 * 아니면 청년 남성 주민. 얼굴은 그 칩의 검토된 짝 얼굴, 없으면 비운다(다른 인물의 얼굴을 빌리지 않는다). 저작자가 이미 바꾼 주인공은 그대로.
 */
function redressStoryHero(project: Project, task: string): string | undefined {
  const hero = project.database.actors.find((actor) => actor.id === "actor_hero") ?? project.database.actors[0];
  if (!hero || !PRISTINE_HERO.has(hero.characterResourceId) || (hero.characterIndex ?? 0) !== 0) return undefined;
  // 모험가·용사가 주인공인 판타지 이야기(전투 낱말이 없어도)는 검사 차림이 맞다.
  if (/용사|모험|검사|기사|전사|영웅|퀘스트|rpg|hero|adventure|quest|knight|warrior/iu.test(task)) return undefined;
  const query = /소녀|여자|여성|아가씨|그녀|girl|woman|heroine/iu.test(task) ? "젊은 여성" : "청년 남성";
  const pick = resolveNpcGraphic(query);
  const asset = pick ? findCharsetAsset(pick.textureKey) : undefined;
  if (!pick || !asset) return undefined;
  const pristineFace = hero.faceResourceId === undefined || hero.faceResourceId === "easyrpg-faceset-actor1-00";
  hero.characterResourceId = asset.id;
  hero.characterIndex = pick.characterIndex;
  const battler = charsetBattlerForCharacter(asset.id, pick.characterIndex);
  if (battler) hero.battleCharacterResourceId = battler; else delete hero.battleCharacterResourceId;
  if (pristineFace) {
    const face = sharedFaceIdForCharset(pick.textureKey, pick.characterIndex);
    if (face) hero.faceResourceId = face; else delete hero.faceResourceId;
  }
  return `주인공 차림 「${pick.label}」(${pick.appearance ?? query}) — 판타지 검사 기본 칩을 뺐다`;
}

/** 빈 프로젝트(이벤트·엔딩 없음)인가 — 첫 장소를 짓는 요청을 게임 시작으로 본다. */
export function isFreshProject(project: Project): boolean {
  return (project.endings ?? []).length === 0 && Object.values(project.maps).every((map) => (map.events ?? []).length === 0);
}
