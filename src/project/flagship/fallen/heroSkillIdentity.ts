// 폴른 스타 · 주인공 기술 개성 1차(fs-skill-build1, 감사 http://mdc-server:18301/fs-skill-identity.html).
//
// 감사 결론: 맞는 순간이 모두 같은 흰 섬광이고, 새라의 창 기술이 카엘의 칼 시트를 빌렸고, 카엘의 탱커 버프 넷이 같은 힘 오라였다.
// 새 그림 0장: 번들 pixelfx 색 바꾸기와 CC0 아이콘 금빛 재채색만.
//
// 1. 착탄 섬광 색(ActorRecord.battleHitFlash): 카엘 강철+주황 불씨 · 엘레나 별빛+밝은 하늘색 · 이리스 보라+시안 · 새라 은색+진홍.
//    (fs-vqa-fix-all: 새라 바깥 #a8442a 는 화면에서 카엘 주황과 구별되지 않았고, 엘레나 남청 #2b3f8f 는 어두운 숲 바닥에 묻혔다.)
// 2. 카엘 「별 새김 검」: 단타 베기(검격·올려베기·회전베기)가 별 표식을 새긴다. 같은 계열(감정 사다리)이라 다시 새기면
//    I → II → III 으로 오르고 하나만 남는다(battleEmotion.ts). 3차례 지나면 풀리고, 새로 새기면 다시 3차례.
//    십자베기는 두 번 치는 기술이라 한 번에 I→II 가 되므로 표식을 주지 않는다(리드 결정 2026-11-10).
//    마무리기(화염검·단죄의 일섬)가 표식을 터뜨린다: I +25% · II +50% · III +75%(exploitStates.bonusByState), 같은 행동에서 지운다.
// 3. 카엘 탱커 버프 넷을 서로 다른 효과로: 도발 방패 막기(청동) · 반격 자세 칼 맞부딪침 · 함성 햇살(주황) · 집중 기 모으기(강철).
// 4. 새라 창 기술 넷: 카엘 칼 시트(hero_pierce·hero_whirl·hero_meteor_*) 대신 창 연출 레코드(chor_fs2_*, 녹슨 붉은 색조).
//    도약·큰 도약·창 휘두르기는 기술 id 가 용기사 계약이라 프로젝트 레코드를 명시해야 이긴다(retroSkillCatalog resolveSkillChoreography).
//
// pixelfx.ts 의 FALLEN_SKILL_FX 다음, 표시 이름 정비 전에 부른다(chronoBell.ts).
import type { ActorRecord, Project, SkillChoreographyRecord, SkillRecord, StateRecord } from "@/project/types";
import { normalizeSkillChoreographyRecord } from "@/project/skillChoreographyRecords";
import { normalizeStateRecord } from "@/project/databaseRecordModel";

export const FS_STAR_MARK_STATES = ["state_fs_star_mark_1", "state_fs_star_mark_2", "state_fs_star_mark_3"] as const;
export const FS_STAR_MARK_ICONS = ["cc0-jetrel-gen2-fs-star-mark-1", "cc0-jetrel-gen2-fs-star-mark-2", "cc0-jetrel-gen2-fs-star-mark-3"] as const;
/** 별 표식을 새기는 단타 베기. */
export const FS_STAR_MARK_SLASHES = ["skill_sword_slash", "skill_hero_rising_blade", "skill_hero_whirlwind"] as const;
/** 표식을 터뜨리는 마무리기. */
export const FS_STAR_MARK_FINISHERS = ["skill_hero_flame_sword", "skill_fs_verdict"] as const;

export const FS_HIT_FLASH: Readonly<Record<string, { core: string; edge: string }>> = {
  actor_hero: { core: "#eef3f8", edge: "#ff8a2a" },
  actor_fs_elena: { core: "#e8f0ff", edge: "#7fb8ff" },
  actor_fs_iris: { core: "#e6fbff", edge: "#8a4fd8" },
  actor_fs2_sarah: { core: "#e6e9ee", edge: "#d0283c" },
};

/** 녹슨 붉은 창끝 — 새라 색조(연출 레코드 tint). */
const RUST = "#b0482a";

/** 새라 창 기술 → 카엘 칼 시트가 없는 연출 레코드. 시트는 번들 창 시트(발키리 찌르기·용기사 낙하·대지 진동). */
export const FS2_LANCE_CHOREOGRAPHIES: readonly SkillChoreographyRecord[] = [
  { id: "chor_fs2_lance_thrust", name: "새라 · 꿰뚫는 창", motion: "dash-strike", weight: "normal", tint: RUST,
    layers: [{ sheet: "valkyrie_thrust", anchor: "target" }], tags: { family: "fallen-star" } },
  { id: "chor_fs2_lance_dive", name: "새라 · 도약", motion: "leap-strike", weight: "normal", tint: RUST,
    layers: [{ sheet: "dragoon_dive", anchor: "target" }], tags: { family: "fallen-star" } },
  { id: "chor_fs2_lance_high_dive", name: "새라 · 큰 도약", motion: "leap-strike", weight: "heavy", tint: RUST,
    layers: [{ sheet: "dragoon_dive", anchor: "target", scale: 1.5 }, { sheet: "guard_quake", anchor: "target" }],
    screen: { shake: 6 }, tags: { family: "fallen-star" } },
  { id: "chor_fs2_lance_sweep", name: "새라 · 창 휘두르기", motion: "spin", weight: "normal", tint: RUST,
    layers: [{ sheet: "mon_spear_pierce", anchor: "allTargets" }], tags: { family: "fallen-star" } },
];

/** 별 표식을 터뜨리는 마무리기의 박자: 무거운 히트스톱(heavy 209ms)과 큰 흔들림. 베기는 보통(110ms) 그대로. */
export const FS_STAR_FINISHER_CHOREOGRAPHIES: readonly SkillChoreographyRecord[] = [
  { id: "chor_fs_star_burst_flame", name: "카엘 · 화염검(별 터뜨리기)", motion: "dash-strike", weight: "heavy", sourceId: "skill_hero_flame_sword",
    layers: [{ sheet: "hero_flame_aura", anchor: "user" }, { sheet: "hero_flame_slash", anchor: "target" }], screen: { shake: 8 }, tags: { family: "fallen-star" } },
  { id: "chor_fs_star_burst_verdict", name: "카엘 · 단죄의 일섬(별 터뜨리기)", motion: "dash-strike", weight: "heavy", sourceId: "skill_hero_cross_slash",
    layers: [{ sheet: "hero_cross", anchor: "target", tint: "#f2d266" }], screen: { shake: 8 }, tags: { family: "fallen-star" } },
];

export const FS_STAR_FINISHER_SKILLS: Readonly<Record<string, string>> = {
  skill_hero_flame_sword: "chor_fs_star_burst_flame",
  skill_fs_verdict: "chor_fs_star_burst_verdict",
};

export const FS2_LANCE_SKILLS: Readonly<Record<string, string>> = {
  skill_fs2_pierce_lance: "chor_fs2_lance_thrust",
  skill_dragoon_jump: "chor_fs2_lance_dive",
  skill_dragoon_high_jump: "chor_fs2_lance_high_dive",
  skill_dragoon_sweeping_lance: "chor_fs2_lance_sweep",
};

export interface HeroSkillIdentityReport {
  readonly applied: string[];
  readonly skipped: string[];
}

function findSkill(project: Project, id: string): SkillRecord | undefined {
  return project.database.skills.find((skill) => skill.id === id);
}

function applyHitFlash(project: Project, report: HeroSkillIdentityReport): void {
  for (const [actorId, flash] of Object.entries(FS_HIT_FLASH)) {
    const actor = project.database.actors.find((row) => row.id === actorId) as ActorRecord | undefined;
    if (!actor) { report.skipped.push(`섬광 색 ${actorId} — 배우 없음`); continue; }
    actor.battleHitFlash = { ...flash };
    report.applied.push(`섬광 색 ${actor.name} ${flash.core}/${flash.edge}`);
  }
}

function applyStarMarks(project: Project, report: HeroSkillIdentityReport): void {
  const db = project.database;
  FS_STAR_MARK_STATES.forEach((id, index) => {
    const tier = index + 1;
    const record = normalizeStateRecord({
      id, name: `별 표식 ${"Ⅰ Ⅱ Ⅲ".split(" ")[index]}`,
      iconResourceId: FS_STAR_MARK_ICONS[index],
      emotion: { family: "fs_star_mark", tier },
      removalCondition: "전투 종료",
      recoverNaturallyChance: 0,
      recoverWhenHitChance: 0,
      battleAura: "none",
      runtimeEffects: { maxTurns: 3, removeOnBattleEnd: true },
      clearOnBattleEnd: true,
    } as Partial<StateRecord> & Pick<StateRecord, "id" | "name">);
    db.states = [...db.states.filter((state) => state.id !== id), record];
  });
  for (const id of FS_STAR_MARK_SLASHES) {
    const skill = findSkill(project, id);
    if (!skill) { report.skipped.push(`표식 새기기 ${id} — 기술 없음`); continue; }
    skill.stateEffects = [...(skill.stateEffects ?? []).filter((row) => !(FS_STAR_MARK_STATES as readonly string[]).includes(row.stateId)),
      { stateId: FS_STAR_MARK_STATES[0], chance: 100, operation: "add" }];
    skill.description = `${skill.description.replace(/\n별 표식을 새긴다.*$/s, "")}\n별 표식을 새긴다(최대 3).`;
    report.applied.push(`표식 새기기 ${skill.name}`);
  }
  for (const id of FS_STAR_MARK_FINISHERS) {
    const skill = findSkill(project, id);
    if (!skill) { report.skipped.push(`표식 터뜨리기 ${id} — 기술 없음`); continue; }
    skill.exploitStates = {
      stateIds: [...FS_STAR_MARK_STATES], bonusPercent: 25, consume: true,
      bonusByState: { [FS_STAR_MARK_STATES[1]]: 50, [FS_STAR_MARK_STATES[2]]: 75 },
    };
    skill.description = `${skill.description.replace(/\n별 표식을 터뜨린다.*$/s, "")}\n별 표식을 터뜨린다(표식당 +25%).`;
    report.applied.push(`표식 터뜨리기 ${skill.name} +25/50/75%`);
  }
}

function applyChoreographies(project: Project, report: HeroSkillIdentityReport): void {
  const db = project.database;
  const all = [...FS2_LANCE_CHOREOGRAPHIES, ...FS_STAR_FINISHER_CHOREOGRAPHIES];
  const records = all.map((row) => normalizeSkillChoreographyRecord(row)).filter((row): row is SkillChoreographyRecord => Boolean(row));
  if (records.length !== all.length) throw new Error("[fallen-star] 기술 연출 레코드 정규화 실패(시트 키 확인)");
  const ids = new Set(records.map((row) => row.id));
  db.skillChoreographies = [...(db.skillChoreographies ?? []).filter((row) => !ids.has(row.id)), ...records];
  for (const [skillId, chorId] of Object.entries({ ...FS2_LANCE_SKILLS, ...FS_STAR_FINISHER_SKILLS })) {
    const skill = findSkill(project, skillId);
    if (!skill) { report.skipped.push(`연출 ${skillId} — 기술 없음`); continue; }
    skill.retroChoreographyId = chorId;
    report.applied.push(`연출 ${skill.name} → ${chorId}`);
  }
}

/** pixelfx 층 다음에 부른다. */
export function applyFallenHeroSkillIdentity(project: Project): HeroSkillIdentityReport {
  const report = { applied: [] as string[], skipped: [] as string[] };
  applyHitFlash(project, report);
  applyStarMarks(project, report);
  applyChoreographies(project, report);
  return report;
}
