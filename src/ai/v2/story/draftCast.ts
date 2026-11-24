// 첫 판 초안 데이터 — 맵과 함께 세계관·주인공·동료·직업·대표 기술·이 게임 물건·적을 자료집에 채운다(끝맺음 단계 draft-cast · 팀 실행 finish).
//
// 왜(2026-11-24 ideal-flow-draft, 오너 이상 흐름 1·2): 「이세계에 떨어진 마왕 살아남기」 첫 판이 맵 3장은 지었지만 세계관·동료·직업은 비어 있었다.
// 세계·인물 도구는 실려도 모델이 부르지 않았다(첫 판 도구 39번 중 자료집 쓰기는 보스 1번, 보상 레인 43판 upsert_enemy·upsert_skill 0번).
// 그래서 모델은 청사진의 cast·world·items 칸에 이름과 한 줄만 적고, 레코드는 이 함수가 짓는다(v2 원칙: 모델은 명세, 빌더가 짓는다).
// 칸이 비면 파티·청사진에서 채운다(이름 없는 기본값을 남기지 않는 쪽이 낫다 — 다음 요청이 고친다).
//
// 같은 프로젝트에 두 번 돌아도 같은 결과다: id 가 고정이고 이미 있는 레코드는 건드리지 않는다. 작가가 고친 것(프리셋이 아닌 직업·이미 쓴 세계 허리)도 덮지 않는다.
import type { Project } from "@/project/types";
import type { ActorRecord, ClassRecord, EnemyRecord, ItemRecord, SkillRecord } from "@/project/types/database";
import type { GameBlueprint, GameBlueprintPerson } from "@/project/gameBlueprint";
import { isPresetDatabaseRecord, countGameDatabaseRecords } from "@/project/databasePresetRecords";
import { createBlankProject } from "@/project/defaults";
import { charsetBattlerForCharacter } from "@/assets/charsetBattlers";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { pickChip } from "./shipLookDefaults";
import { splitIntentNote } from "@/ai/piAgent/monsterGameRequest";

/** 초안이 만드는 레코드 id 의 머리 — 다시 돌 때 같은 레코드를 찾는다. */
export const DRAFT_ID = "cast";
/** 보스 인물 소개가 걸리는 characters 열쇠(배우가 아니라 적이라 배우 id 가 없다). */
export const BOSS_PROFILE_KEY = "boss";

export interface DraftCastCounts {
  readonly world: boolean;
  readonly people: number;
  readonly party: number;
  readonly classes: number;
  readonly skills: number;
  readonly items: number;
  readonly enemies: number;
}

let factoryCache: Project | undefined;
const factory = (): Project => (factoryCache ??= createBlankProject() as Project);
const clone = <T>(value: T): T => structuredClone(value);

/** 이 게임이 싸움을 하는가 — 청사진이 싸움 없음을 적었거나 몬스터 파티 전투면 동료를 파티에 세우지 않는다. */
function partyFights(project: Project, blueprint: GameBlueprint | undefined): boolean {
  const monsters = project.system.battleParty === "monsters" || project.system.monsterBattleParty === true || project.system.battleUiStyle === "pokemon" || project.system.monsterCollection === true;
  return !monsters && blueprint?.battles !== false;
}

const FALLBACK_COMPANIONS: readonly GameBlueprintPerson[] = [
  { name: "리안", role: "검사", looks: "young man" },
  { name: "세라", role: "치유사", looks: "young woman" },
  { name: "카이", role: "궁수", looks: "young man" },
  { name: "유나", role: "길잡이", looks: "young woman" },
];

/**
 * 청사진 cast 칸, 모자라면 이 게임의 이야기 사람(청사진 대화·고르기 단계의 who, 없으면 인물 소개가 있는 사람)에서, 그래도 모자라면 대체 이름에서 채운다.
 * party = cast 가 적은 동료만 시작 파티에 선다 — 2026-11-24 실측(Sonnet 호러): cast 없는 호러에 대체 검사·치유사가 파티로 들어갔다.
 */
export function draftPeople(project: Project, blueprint: GameBlueprint | undefined): { hero: GameBlueprintPerson; companions: (GameBlueprintPerson & { party?: boolean })[]; boss?: GameBlueprintPerson } {
  const heroActor = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0]);
  const cast = blueprint?.cast;
  const hero: GameBlueprintPerson = { name: cast?.hero?.name ?? heroActor?.name ?? "주인공", ...(cast?.hero ?? {}) };
  if (!cast?.hero?.name && heroActor) hero.name = heroActor.name;
  const taken = new Set<string>([hero.name, ...project.database.actors.map((a) => a.name),
    ...(blueprint?.steps ?? []).map((s) => s.who ?? "").filter(Boolean)]);
  const battleWho = (blueprint?.steps ?? []).filter((s) => s.kind === "battle" && s.who?.trim()).map((s) => s.who!.trim()).pop();
  const boss = cast?.boss ?? (battleWho ? { name: battleWho } : undefined);
  let companions: (GameBlueprintPerson & { party?: boolean })[] = (cast?.companions ?? []).slice(0, 3).map((p) => ({ ...p, party: true }));
  const have = (name: string) => name === hero.name || name === boss?.name || companions.some((c) => c.name === name);
  const bioOf = (name: string) => Object.values(project.characters ?? {}).find((p) => p.displayName?.trim() === name)?.note;
  if (companions.length < 2) {
    const story = (blueprint?.steps ?? []).filter((s) => (s.kind === "talk" || s.kind === "choice") && s.who?.trim())
      .map((s) => ({ name: s.who!.trim().replace(/\s*\(.*\)$/u, "").slice(0, 24), ...(s.looks ? { looks: s.looks } : {}) }));
    const profiled = Object.values(project.characters ?? {}).filter((p) => p.displayName?.trim() && p.note).map((p) => ({ name: p.displayName!.trim().slice(0, 24) }));
    for (const person of [...story, ...profiled]) {
      if (companions.length >= 2) break;
      if (!person.name || have(person.name)) continue;
      const bio = bioOf(person.name);
      companions.push({ ...person, ...(bio ? { bio } : {}) });
    }
  }
  if (companions.length < 2) {
    const extra = FALLBACK_COMPANIONS.filter((p) => !taken.has(p.name) && !have(p.name));
    companions = [...companions, ...extra].slice(0, 2);
  }
  return { hero, companions, ...(boss ? { boss } : {}) };
}

function templateSkill(project: Project): SkillRecord | undefined {
  const ok = (s: SkillRecord) => s.type === "normal" && s.scope === "enemy" && s.power > 0 && !s.comboActorIds?.length && !s.limitSkill && !s.actionSkill;
  return project.database.skills.find(ok) ?? factory().database.skills.find(ok);
}

function templateItem(project: Project): ItemRecord | undefined {
  const ok = (i: ItemRecord) => i.type === "medicine" && i.consumable && (i.hpRecovery.flat > 0 || i.hpRecovery.percentMax > 0);
  return project.database.items.find(ok) ?? factory().database.items.find(ok);
}

function templateEnemy(project: Project): EnemyRecord | undefined {
  return project.database.enemies.find((e) => !e.speciesId) ?? factory().database.enemies.find((e) => !e.speciesId);
}

/** 쓰이지 않은 칩·얼굴의 기본 배우 — 칩 고르기가 못 고를 때도 동료가 주인공과 같은 얼굴로 서지 않는다. */
function templateActor(project: Project, chips: ReadonlySet<string>): ActorRecord | undefined {
  const free = (a: ActorRecord) => !!a.faceResourceId && !!a.characterResourceId && !chips.has(`${a.characterResourceId}#${a.characterIndex ?? 0}`)
    && !project.database.actors.some((b) => b.faceResourceId === a.faceResourceId && (project.system.startActorIds ?? []).includes(b.id));
  return factory().database.actors.find(free) ?? project.database.actors[0];
}

/** 쓰인 칩(파티·맵 위 사람) — 동료가 같은 얼굴로 서지 않게. */
function usedChips(project: Project): Set<string> {
  const used = new Set<string>(project.database.actors.map((a) => `${a.characterResourceId}#${a.characterIndex ?? 0}`));
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    const g = page.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    const asset = g?.sprite?.id ? findCharsetAsset(g.sprite.id) : undefined;
    if (asset && typeof g?.pattern === "number") used.add(`${asset.id}#${decodeCharsetFrameIndex(g.pattern).characterIndex}`);
  }
  return used;
}

/** 직업 하나를 고정 id 로 — 없을 때만 template 를 본떠 짓는다. 지은 것(또는 이미 있던 것)의 id. */
function ensureClass(project: Project, id: string, name: string, template: ClassRecord, skillId: string | undefined, out: string[]): string {
  const existing = project.database.classes.find((c) => c.id === id);
  if (existing) return existing.id;
  const cls = clone(template);
  cls.id = id;
  cls.name = name;
  if (skillId) {
    cls.learnedSkills = [{ level: 1, skillId }, ...cls.learnedSkills.filter((l) => l.skillId !== skillId)];
    cls.skillIds = [...new Set([skillId, ...cls.skillIds])];
  }
  delete cls.promotions;
  project.database.classes.push(cls);
  out.push(`직업 ${name}`);
  return cls.id;
}

function ensureSkill(project: Project, id: string, name: string, owner: string, template: SkillRecord, out: string[]): string {
  if (project.database.skills.some((s) => s.id === id)) return id;
  const skill = clone(template);
  skill.id = id;
  skill.name = name;
  skill.description = `${owner}의 대표 기술.`;
  project.database.skills.push(skill);
  out.push(`기술 ${name}`);
  return id;
}

const roleOf = (person: GameBlueprintPerson, fallback: string): string => person.role?.trim() || fallback;

/**
 * 초안 데이터를 채운다 — 한 일 목록(사람이 읽는 한국어 한 줄씩). 프로젝트를 제자리에서 바꾼다.
 * 세계 허리가 이미 있으면(작가·조수가 썼다) 두고, 파티 동료·직업·기술·물건·적은 고정 id 로 없을 때만 짓는다.
 */
export function applyDraftCast(project: Project, request = ""): string[] {
  const blueprint = project.gameBlueprint;
  const out: string[] = [];
  const { hero, companions, boss } = draftPeople(project, blueprint);
  const title = blueprint?.title ?? project.meta?.title ?? "";
  const fights = partyFights(project, blueprint);

  if (!project.worldCanon?.premise?.trim()) {
    const world = blueprint?.world;
    const premise = (world?.premise ?? blueprint?.opening?.join(" ") ?? blueprint?.playerGoal ?? splitIntentNote(request).own).trim().slice(0, 280);
    if (premise) {
      const rules = world?.rules ?? [];
      const body = [...(rules.length ? ["## 이 세계의 규칙", ...rules.map((r) => `- ${r}`)] : []), ...(world?.premise && blueprint?.opening?.length ? ["## 이야기의 시작", ...blueprint.opening] : [])].join("\n");
      project.worldCanon = {
        ...(project.worldCanon ?? {}),
        name: (world?.name ?? title).slice(0, 120),
        premise,
        ...(world?.tones?.length ? { tones: world.tones as NonNullable<Project["worldCanon"]>["tones"] } : {}),
        ...(body ? { body } : {}),
        status: "draft",
      };
      out.push(`세계관 «${project.worldCanon.name}»`);
    }
  }

  // 주인공 이름(아직 편집기 기본 이름일 때만).
  const heroActor = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0]);
  if (heroActor && blueprint?.cast?.hero?.name && heroActor.name !== blueprint.cast.hero.name && isPresetDatabaseRecord("actors", heroActor)) {
    heroActor.name = blueprint.cast.hero.name;
    out.push(`주인공 이름 → ${heroActor.name}`);
  }

  // 직업·기술 — 주인공의 직업이 기본 프리셋이면 이 게임의 직업을 지어 입힌다.
  const skillTemplate = templateSkill(project);
  const heroClass = heroActor ? project.database.classes.find((c) => c.id === heroActor.classId) : undefined;
  const classTemplate = heroClass ?? project.database.classes[0] ?? factory().database.classes[0];
  const people = [hero, ...companions];
  const skillIds = people.map((person, i) => skillTemplate ? ensureSkill(project, `skill_${DRAFT_ID}_${i}`, person.skill?.trim() || `${person.name}의 일격`, person.name, skillTemplate, out) : undefined);
  if (heroActor && classTemplate && (!heroClass || isPresetDatabaseRecord("classes", heroClass))) {
    heroActor.classId = ensureClass(project, `class_${DRAFT_ID}_0`, roleOf(hero, blueprint?.genre ? `${blueprint.genre} 주인공` : "주인공"), classTemplate, skillIds[0], out);
  }
  if (heroActor && skillIds[0] && !heroActor.learnedSkills.some((l) => l.skillId === skillIds[0])) heroActor.learnedSkills = [{ level: 1, skillId: skillIds[0] }, ...heroActor.learnedSkills];

  // 동료 — 배우·직업·기술, 싸우는 게임이면 시작 파티에 세운다.
  const chips = usedChips(project);
  companions.forEach((person, n) => {
    const i = n + 1;
    const id = `actor_${DRAFT_ID}_${i}`;
    let actor = project.database.actors.find((a) => a.id === id);
    if (!actor) {
      const template = templateActor(project, chips);
      if (!template) return;
      actor = clone(template);
      chips.add(`${actor.characterResourceId}#${actor.characterIndex ?? 0}`);
      actor.id = id;
      actor.name = person.name;
      actor.nickname = person.party ? roleOf(person, "동료") : "";
      actor.initialLevel = heroActor?.initialLevel ?? actor.initialLevel;
      const pick = pickChip(`${person.name} ${person.looks ?? ""} ${person.role ?? ""}`, chips, project.charsetLabels);
      if (pick) {
        actor.characterResourceId = pick.resourceId;
        actor.characterIndex = pick.index;
        chips.add(`${pick.resourceId}#${pick.index}`);
        if (pick.face) actor.faceResourceId = pick.face; else delete actor.faceResourceId;
        const battler = charsetBattlerForCharacter(pick.resourceId, pick.index);
        if (battler) actor.battleCharacterResourceId = battler; else delete actor.battleCharacterResourceId;
      }
      if (classTemplate) actor.classId = ensureClass(project, `class_${DRAFT_ID}_${i}`, roleOf(person, person.party ? "동료" : "조력자"), classTemplate, skillIds[i], out);
      actor.learnedSkills = skillIds[i] ? [{ level: 1, skillId: skillIds[i]! }] : [];
      project.database.actors.push(actor);
      out.push(`동료 ${person.name}(${roleOf(person, person.party ? "동료" : "조력자")})`);
    }
    if (fights && person.party && !(project.system.startActorIds ?? []).includes(id) && (project.system.startActorIds?.length ?? 0) < 4) {
      project.system.startActorIds = [...(project.system.startActorIds ?? []), id];
      out.push(`${person.name} 시작 파티 합류`);
    }
  });

  // 인물 소개(관계 메뉴·초안 카드가 읽는다) — 이미 쓴 소개는 두고 빈 것만.
  const characters = { ...(project.characters ?? {}) };
  const profile = (key: string, person: GameBlueprintPerson, fallback: string) => {
    if (characters[key]?.note) return;
    characters[key] = { ...(characters[key] ?? {}), displayName: person.name, note: (person.bio?.trim() || fallback).slice(0, 120) };
    out.push(`인물 소개 ${person.name}`);
  };
  if (heroActor) profile(heroActor.id, { ...hero, name: heroActor.name }, `${title ? `«${title}»의 ` : ""}주인공. ${roleOf(hero, "")}`.trim());
  companions.forEach((person, n) => { const id = `actor_${DRAFT_ID}_${n + 1}`; if (project.database.actors.some((a) => a.id === id)) profile(id, person, person.party ? `${hero.name}와 함께 다니는 ${roleOf(person, "동료")}.` : `${hero.name}의 이야기에 얽힌 사람.`); });
  if (boss) profile(BOSS_PROFILE_KEY, boss, `${hero.name} 앞을 막아서는 자.`);
  project.characters = characters;

  // 이 게임 물건 — 프리셋이 아닌 아이템이 셋이 될 때까지 청사진 물건(없으면 세계 이름을 붙인 약초·부적·지도)을 더한다.
  const itemTemplate = templateItem(project);
  if (itemTemplate) {
    const short = (blueprint?.world?.name ?? title).split(/\s+/u)[0]?.slice(0, 8) || "여행";
    const names = [...(blueprint?.items ?? []), ...(blueprint?.steps ?? []).map((s) => s.text?.item ?? "").filter(Boolean), `${short} 약초`, `${short} 부적`, `${short} 지도 조각`];
    const have = new Set(project.database.items.map((it) => it.name));
    let game = countGameDatabaseRecords("items", project.database.items);
    let k = 0;
    for (const name of names) {
      if (game >= 3 && !blueprint?.items?.includes(name)) break;
      if (have.has(name)) continue;
      const id = `item_${DRAFT_ID}_${k++}`;
      if (project.database.items.some((it) => it.id === id)) continue;
      const item = clone(itemTemplate);
      item.id = id;
      item.name = name;
      item.description = `${blueprint?.world?.name ?? title}의 물건.`;
      project.database.items.push(item);
      have.add(name);
      game += 1;
      out.push(`아이템 ${name}`);
    }
  }

  // 적 — 싸우는 게임에 이 게임의 적이 하나도 없으면 보스를 적으로 짓는다(맵에 세우는 일은 경로·다음 요청이 한다).
  if (fights && boss && countGameDatabaseRecords("enemies", project.database.enemies) === 0 && !project.database.enemies.some((e) => e.id === `enemy_${DRAFT_ID}_boss`)) {
    const template = templateEnemy(project);
    if (template) {
      const enemy = clone(template);
      enemy.id = `enemy_${DRAFT_ID}_boss`;
      enemy.name = boss.name;
      project.database.enemies.push(enemy);
      out.push(`적 ${boss.name}`);
    }
  }
  return out;
}

/** 초안 데이터 수 — 결정적 검증 스크립트와 초안 보기가 같은 셈을 쓴다. */
export function draftCastCounts(project: Project): DraftCastCounts {
  const db = project.database;
  const partyIds = project.system.startActorIds ?? [];
  const profiled = Object.keys(project.characters ?? {}).filter((k) => project.characters?.[k]?.note || project.characters?.[k]?.displayName);
  return {
    world: !!project.worldCanon?.premise?.trim(),
    people: new Set([...profiled, ...partyIds]).size,
    party: partyIds.length,
    classes: countGameDatabaseRecords("classes", db.classes),
    skills: countGameDatabaseRecords("skills", db.skills),
    items: countGameDatabaseRecords("items", db.items),
    enemies: countGameDatabaseRecords("enemies", db.enemies),
  };
}
