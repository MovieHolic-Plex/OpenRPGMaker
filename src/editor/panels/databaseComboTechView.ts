// 자료집 「스킬 → 연계기」 하위 보기 — 크로노 트리거식 듀얼·트리플 테크를 한 화면에서 만든다(2026-10-24).
//
// 연계기는 SkillRecord 의 comboActorIds·comboRequires·comboMpCosts·comboCombinedStats 다(전투 「연계」 명령이 연다).
// 스킬 편집 탭에서도 고칠 수 있지만 칸이 흩어져 있어 「누가 누구와, 무엇을 배우면, 몇 MP 씩」을 한 카드로 모았다.
// 조수 도구 upsert_combo_tech / list_combo_techs 와 같은 필드를 쓴다. 미리보기 줄은 전투 도움말 창과 같은 문장(skillHelp).
import { skillHelp, skillHelpTagLine } from "@/battle/skillHelp";
import { addDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { numberField, selectField, textField, toggleSwitch } from "@/editor/panels/databaseControls";
import { retroChoreographyPicker } from "@/editor/panels/databaseSkillRetroPicker";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { store } from "@/project/store";
import type { Project, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

const NONE = "";

const SCOPES: readonly { readonly id: SkillRecord["scope"]; readonly name: string }[] = [
  { id: "enemy", name: "적 1명" },
  { id: "allEnemies", name: "적 전체" },
  { id: "ally", name: "아군 1명" },
  { id: "allAllies", name: "아군 전체" },
  { id: "self", name: "자신" },
];

function isComboTech(skill: SkillRecord): boolean {
  return (skill.comboActorIds?.length ?? 0) >= 2;
}

/** 이 배우가 배울 수 있는 기술(배우·직업 습득표) — 해금 조건 고르기 후보. 연계기 자신은 뺀다. */
function learnableSkills(project: Project, actorId: string): { id: string; name: string }[] {
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) return [];
  const classRecord = project.database.classes.find((record) => record.id === actor.classId);
  const rows = [...(actor.learnedSkills ?? []), ...(classRecord?.learnedSkills ?? [])];
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const row of rows.sort((a, b) => a.level - b.level)) {
    if (seen.has(row.skillId)) continue;
    seen.add(row.skillId);
    const skill = project.database.skills.find((record) => record.id === row.skillId);
    if (!skill || isComboTech(skill)) continue;
    out.push({ id: skill.id, name: `Lv${row.level} ${skill.name}` });
  }
  return out;
}

function memberEditor(project: Project, skill: SkillRecord, slot: number, rerender: () => void): HTMLElement {
  const members = [...(skill.comboActorIds ?? [])];
  const actorId = members[slot] ?? NONE;
  const actorOptions = [
    ...(slot >= 2 ? [{ id: NONE, name: "(없음 — 듀얼)" }] : []),
    ...project.database.actors.map((actor) => ({ id: actor.id, name: actor.name })),
  ];
  const actorSelect = selectField(slot === 0 ? "시전자" : `동료 ${slot}`, `db-combo-member-${skill.id}-${slot}`, actorId, actorOptions, (value) => {
    const next = [...members];
    if (value === NONE) next.splice(slot, 1);
    else next[slot] = value;
    const unique = next.filter((id, index) => id && next.indexOf(id) === index);
    if (unique.length < 2) return rerender();
    // 빠진 배우의 조건·몫은 함께 지운다.
    updateDatabaseRecord("skills", skill.id, {
      comboActorIds: unique,
      comboRequires: (skill.comboRequires ?? []).filter((row) => unique.includes(row.actorId)),
      comboMpCosts: (skill.comboMpCosts ?? []).filter((row) => unique.includes(row.actorId)),
    });
    rerender();
  });
  if (!actorId) return el("div", { class: "db-combo-member", children: [actorSelect] });
  const share = skill.comboMpCosts?.find((row) => row.actorId === actorId)?.mp ?? skill.mpCost.flat;
  const mp = numberField("MP 몫", `db-combo-mp-${skill.id}-${slot}`, share, (value) => {
    const rest = (skill.comboMpCosts ?? []).filter((row) => row.actorId !== actorId);
    updateDatabaseRecord("skills", skill.id, { comboMpCosts: [...rest, { actorId, mp: Math.max(0, Math.trunc(value)) }] });
  }, { min: 0, max: 999 });
  const required = skill.comboRequires?.find((row) => row.actorId === actorId)?.skillId ?? NONE;
  const requires = selectField("배워야 하는 기술", `db-combo-requires-${skill.id}-${slot}`, required, [
    { id: NONE, name: "(조건 없음)" },
    ...learnableSkills(project, actorId),
  ], (value) => {
    const rest = (skill.comboRequires ?? []).filter((row) => row.actorId !== actorId);
    updateDatabaseRecord("skills", skill.id, { comboRequires: value ? [...rest, { actorId, skillId: value }] : rest });
    rerender();
  });
  return el("div", { class: "db-combo-member", dataset: { testid: `db-combo-member-row-${skill.id}-${slot}` }, children: [actorSelect, mp, requires] });
}

function techCard(project: Project, skill: SkillRecord, rerender: () => void): HTMLElement {
  const help = skillHelp(project, skill);
  const preview = el("div", {
    class: "db-combo-preview",
    dataset: { testid: `db-combo-preview-${skill.id}` },
    children: [
      el("strong", { text: (help.comboNames ?? []).join(" × ") }),
      el("span", { text: help.cost }),
      el("span", { text: skillHelpTagLine(help) }),
    ],
  });
  const members = el("div", {
    class: "db-combo-members",
    children: [0, 1, 2].map((slot) => memberEditor(project, skill, slot, rerender)),
  });
  const elements = [{ id: NONE, name: "(없음)" }, ...(project.database.elements ?? []).map((element) => ({ id: element.id, name: element.name }))];
  const hits = skill.hitSequence?.length ?? 1;
  const body = el("div", {
    class: "db-combo-fields",
    children: [
      textField("이름", `db-combo-name-${skill.id}`, skill.name, (value) => updateDatabaseRecord("skills", skill.id, { name: value })),
      textField("설명(전투 도움말 창)", `db-combo-description-${skill.id}`, skill.description, (value) => updateDatabaseRecord("skills", skill.id, { description: value })),
      selectField("대상", `db-combo-scope-${skill.id}`, skill.scope, SCOPES, (value) => { updateDatabaseRecord("skills", skill.id, { scope: value as SkillRecord["scope"] }); rerender(); }),
      selectField("속성", `db-combo-element-${skill.id}`, skill.elementId ?? NONE, elements, (value) => { updateDatabaseRecord("skills", skill.id, { elementId: value || undefined }); rerender(); }),
      numberField("위력", `db-combo-power-${skill.id}`, skill.power, (value) => updateDatabaseRecord("skills", skill.id, { power: Math.trunc(value) }), { min: 0, max: 999 }),
      numberField("타수", `db-combo-hits-${skill.id}`, hits, (value) => {
        const count = Math.max(1, Math.min(8, Math.trunc(value)));
        updateDatabaseRecord("skills", skill.id, { hitSequence: count > 1 ? Array.from({ length: count }, () => 1) : undefined });
      }, { min: 1, max: 8 }),
      toggleSwitch("합체 능력치(참가자 공격력·마력 합)", `db-combo-combined-${skill.id}`, skill.comboCombinedStats === true, (checked) => {
        updateDatabaseRecord("skills", skill.id, { comboCombinedStats: checked || undefined });
        rerender();
      }),
    ],
  });
  const choreography = sectionCard({
    title: "도트 연출",
    hint: "연계기답게 큰 연출을 고른다",
    collapsible: true,
    collapsed: true,
    children: [retroChoreographyPicker(skill, rerender)],
  });
  return sectionCard({
    title: skill.name,
    hint: skill.id,
    testid: `db-combo-tech-${skill.id}`,
    children: [preview, members, body, choreography],
  });
}

export function renderComboTechTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const techs = project.database.skills.filter(isComboTech);
  const add = el("button", { class: "db-combo-add", text: "새 연계기", attrs: { type: "button" }, dataset: { testid: "db-combo-add" } });
  add.disabled = project.database.actors.length < 2;
  add.addEventListener("click", () => {
    const [first, second] = project.system.startActorIds?.length && project.system.startActorIds.length >= 2
      ? project.system.startActorIds
      : project.database.actors.map((actor) => actor.id);
    const id = addDatabaseRecord("skills");
    updateDatabaseRecord("skills", id, {
      name: "새 연계기",
      description: "두 사람이 힘을 합친다.",
      comboActorIds: [first!, second!],
      power: 60,
      hitSequence: [1, 1],
    });
    rerender();
  });
  const intro = el("p", {
    class: "db-combo-intro",
    text: "연계기는 참가자 전원이 준비되고 각자 MP 몫이 있을 때 전투 명령 「연계」에 뜹니다. 쓰면 참가자 모두의 차례를 쓰고 「연계!」 띠와 도트 연출이 나옵니다. "
      + "「배워야 하는 기술」을 정하면 그 기술을 배우는 순간 결과 화면에 「새 연계기!」 카드가 뜹니다.",
  });
  host.append(el("div", {
    class: "db-combo-tech-view",
    dataset: { testid: "db-combo-tech-view", count: String(techs.length) },
    children: [
      el("div", { class: "db-combo-head", children: [intro, add] }),
      ...(techs.length
        ? techs.map((skill) => techCard(project, skill, rerender))
        : [el("p", { class: "db-ws-empty", text: "아직 연계기가 없습니다. 「새 연계기」로 동료 둘의 합체기를 만드세요.", dataset: { testid: "db-combo-empty" } })]),
    ],
  }));
}

export function comboTechCount(project: Project): number {
  return project.database.skills.filter(isComboTech).length;
}
