// 명작 공백 G1(2026-09-27) — 액터·파티·시점·회차·요일·문자열 조건의 편집기 쪽 공용 조각.
// 조건 폼(conditionForm)·페이지 고급 조건·요약 문장·미리보기가 같은 목록과 문장을 쓴다.
import { el } from "@/util/dom";
import { store } from "@/project/store";
import type { ActorQueryCondition, Condition, ConditionCompareOp, Dir } from "@/project/types";
import { ACTOR_QUERY_CONDITION_KINDS, WEEKDAY_LABELS } from "@/project/conditionActorQueries";

export const ACTOR_QUERY_CONDITION_MODE_OPTIONS = [
  { value: "actorStat", label: "배우 수치(레벨·HP·MP)" },
  { value: "actorState", label: "배우 상태 보유" },
  { value: "partyLeader", label: "선두 배우" },
  { value: "partyKnowsSkill", label: "파티가 아는 스킬(필드 기술)" },
  { value: "badgeCount", label: "획득한 배지 수" },
  { value: "partySize", label: "파티 인원" },
  { value: "facing", label: "방향" },
  { value: "relativeFacing", label: "마주봄·등 뒤" },
  { value: "hiding", label: "숨어 있음" },
  { value: "pursuitActive", label: "추격 중" },
  { value: "eventSeesPlayer", label: "이벤트가 주인공을 봄" },
  { value: "clearCount", label: "클리어 횟수" },
  { value: "endingSeen", label: "본 엔딩" },
  { value: "newGamePlus", label: "강하게 다시 하기 회차" },
  { value: "weekday", label: "요일" },
  { value: "stringVariable", label: "문자열 변수" },
] as const satisfies readonly { readonly value: ActorQueryCondition["kind"]; readonly label: string }[];

const OPS: readonly { value: ConditionCompareOp; label: string }[] = [
  { value: ">=", label: "이상" },
  { value: "<=", label: "이하" },
  { value: "==", label: "같음" },
  { value: "!=", label: "다름" },
  { value: ">", label: "초과" },
  { value: "<", label: "미만" },
];
const STATS = [
  { value: "level", label: "레벨" },
  { value: "hp", label: "HP" },
  { value: "mp", label: "MP" },
  { value: "hpPercent", label: "HP(%)" },
  { value: "mpPercent", label: "MP(%)" },
] as const;
const DIRS: readonly { value: Dir; label: string }[] = [
  { value: "up", label: "위" },
  { value: "down", label: "아래" },
  { value: "left", label: "왼쪽" },
  { value: "right", label: "오른쪽" },
];
const RELATIONS = [
  { value: "playerFacingEvent", label: "주인공이 이 이벤트를 보고 있다" },
  { value: "playerBehindEvent", label: "주인공이 이 이벤트 등 뒤에 있다" },
  { value: "eventBehindPlayer", label: "이 이벤트가 주인공 등 뒤에 있다" },
] as const;

export function isActorQueryCondition(condition: Condition): condition is ActorQueryCondition {
  return (ACTOR_QUERY_CONDITION_KINDS as readonly string[]).includes(condition.kind);
}

export function defaultActorQueryCondition(kind: ActorQueryCondition["kind"]): ActorQueryCondition {
  switch (kind) {
    case "actorStat":
      return { kind, actorId: "leader", stat: "level", op: ">=", value: 10 };
    case "actorState":
      return { kind, actorId: "anyone", stateId: firstStateId(), present: true };
    case "partyLeader":
      return { kind, actorId: firstActorId() };
    case "partyKnowsSkill":
      return { kind, skillId: firstFieldSkillId(), present: true };
    case "badgeCount":
      return { kind, op: ">=", value: 1 };
    case "partySize":
      return { kind, op: ">=", value: 2 };
    case "facing":
      return { kind, subject: "player", dir: "up" };
    case "relativeFacing":
      return { kind, relation: "playerFacingEvent" };
    case "hiding":
      return { kind, value: true };
    case "pursuitActive":
      return { kind, value: true };
    case "eventSeesPlayer":
      return { kind, eventId: "", range: 5, value: true };
    case "clearCount":
      return { kind, op: ">=", value: 1 };
    case "endingSeen":
      return { kind, endingId: firstEndingId(), value: true };
    case "newGamePlus":
      return { kind, value: true };
    case "weekday":
      return { kind, weekdays: [0, 6] };
    case "stringVariable":
      return { kind, stringVariableId: "text1", op: "==", value: "" };
  }
}

function project() {
  return store.getCurrent();
}
function firstActorId(): string {
  return project()?.database.actors[0]?.id ?? "";
}
function firstStateId(): string {
  return project()?.database.states?.[0]?.id ?? "";
}
/** 필드 스킬(fieldCommonEventId 가 있는 스킬)을 먼저, 없으면 첫 스킬. */
function firstFieldSkillId(): string {
  const skills = project()?.database.skills ?? [];
  return (skills.find((skill) => skill.fieldCommonEventId) ?? skills[0])?.id ?? "";
}
function skillName(id: string): string {
  return project()?.database.skills.find((skill) => skill.id === id)?.name || id || "(스킬 없음)";
}
function firstEndingId(): string {
  return project()?.endings?.[0]?.id ?? "";
}
function actorName(id: string): string {
  if (id === "leader") return "선두";
  if (id === "anyone") return "누군가";
  return project()?.database.actors.find((actor) => actor.id === id)?.name || id || "(배우 없음)";
}
function stateName(id: string): string {
  return project()?.database.states?.find((state) => state.id === id)?.name || id || "(상태 없음)";
}
function opLabel(op: ConditionCompareOp): string {
  return OPS.find((entry) => entry.value === op)?.label ?? op;
}

/** 한 줄 요약(조건 문장·명령 요약·미리보기 공용). */
export function actorQueryConditionSummary(condition: ActorQueryCondition): string {
  switch (condition.kind) {
    case "actorStat":
      return `${actorName(condition.actorId)} ${STATS.find((s) => s.value === condition.stat)?.label ?? condition.stat} ${condition.value} ${opLabel(condition.op)}`;
    case "actorState":
      return `${actorName(condition.actorId)}에게 ${stateName(condition.stateId)} ${condition.present ? "있음" : "없음"}`;
    case "partyLeader":
      return `선두가 ${actorName(condition.actorId)}`;
    case "partyKnowsSkill":
      return `파티가 「${skillName(condition.skillId)}」을(를) ${condition.present === false ? "모름" : "앎"}`;
    case "badgeCount":
      return `배지 ${condition.value}개 ${opLabel(condition.op)}`;
    case "partySize":
      return `파티 ${condition.value}명 ${opLabel(condition.op)}`;
    case "facing":
      return `${condition.subject === "player" ? "주인공" : "이 이벤트"}이(가) ${DIRS.find((d) => d.value === condition.dir)?.label ?? condition.dir}을 봄`;
    case "relativeFacing":
      return RELATIONS.find((r) => r.value === condition.relation)?.label ?? condition.relation;
    case "hiding":
      return condition.value ? "주인공이 숨어 있음" : "주인공이 숨지 않음";
    case "eventSeesPlayer":
      return `${condition.eventId || "이벤트"}이(가) 주인공을 ${condition.value === false ? "못 봄" : "봄"} (${condition.range ?? 5}칸)`;
    case "pursuitActive":
      return `${condition.eventId ? condition.eventId : "추격자"} ${condition.value ? "추격 중" : "추격 안 함"}`;
    case "clearCount":
      return `클리어 ${condition.value}회 ${opLabel(condition.op)}`;
    case "endingSeen":
      return `엔딩 ${project()?.endings?.find((e) => e.id === condition.endingId)?.name ?? condition.endingId} ${condition.value ? "봄" : "안 봄"}`;
    case "newGamePlus":
      return condition.value ? "강하게 다시 하기 회차" : "첫 회차";
    case "weekday":
      return `요일 ${condition.weekdays.map((d) => WEEKDAY_LABELS[d] ?? d).join("·") || "(없음)"}`;
    case "stringVariable":
      return condition.op === "empty"
        ? `문자열 ${condition.stringVariableId} 비어 있음`
        : `문자열 ${condition.stringVariableId} ${condition.op === "contains" ? "포함" : condition.op === "==" ? "=" : "≠"} "${condition.value}"`;
  }
}

export function actorQueryConditionHint(kind: ActorQueryCondition["kind"]): string {
  switch (kind) {
    case "actorStat":
      return "배우의 레벨·HP·MP 를 비교합니다. '선두' 는 지금 파티 맨 앞 배우입니다. 파티에 없는 배우는 거짓입니다.";
    case "actorState":
      return "배우가 상태(독·저주·감정 등)를 가졌는지 봅니다. '누군가' 는 파티 전원 중 한 명이라도.";
    case "partyLeader":
      return "파티 선두가 이 배우일 때 참. 리더에 따라 대사를 바꿀 때 씁니다.";
    case "partyKnowsSkill":
      return "파티의 배우(배운·직업·장비 스킬)나 몬스터 파티 누군가가 이 스킬을 알 때 참. 바위깨기·나무베기·서핑·플래시처럼 길을 막은 장애물을 여는 필드 기술 게이트에 씁니다. 판정을 '모름' 으로 하면 '아직 못 여는' 안내 페이지를 만들 수 있습니다.";
    case "badgeCount":
      return "몬스터 캠페인에서 지금까지 받은 배지 수를 비교합니다(캠페인 정의 badges[].switchId 가 켜진 개수 — 기본 규약은 mx_badge_N). 「배지 3개 이상이어야 열리는 문」 같은 게이트에 씁니다.";
    case "partySize":
      return "현재 파티 인원을 비교합니다.";
    case "facing":
      return "주인공 또는 이 이벤트가 보는 방향을 검사합니다.";
    case "relativeFacing":
      return "주인공과 이 이벤트의 자세를 봅니다. '안 볼 때만 움직이는 조각상' 은 '보고 있다' 를 '아닐 때' 로 감싸세요.";
    case "hiding":
      return "주인공이 숨는 장소에 들어가 있는지 검사합니다.";
    case "eventSeesPlayer":
      return "이벤트(집주인·경비)가 지금 주인공을 볼 수 있는지 봅니다. 같은 방(맵 장소 사각형) 안에서, 바라보는 쪽 앞 시야 범위 이내일 때 참. 방 밖이면 거짓. 훔쳐보기·들키기 판정에 씁니다.";
    case "pursuitActive":
      return "추격자가 지금 쫓는 중인지 봅니다. 이벤트 id 를 비우면 누구든.";
    case "clearCount":
      return "이 기기에서 엔딩을 본 누적 횟수입니다. 세이브가 아니라 기기에 남습니다.";
    case "endingSeen":
      return "이 기기에서 그 엔딩을 본 적이 있는지 검사합니다.";
    case "newGamePlus":
      return "'강하게 다시 하기' 로 시작한 회차인지 검사합니다.";
    case "weekday":
      return "게임 달력의 요일입니다. 시계가 꺼져 있으면 항상 거짓. 1년 1일의 요일은 시스템 시간 설정에서 정합니다.";
    case "stringVariable":
      return "문자 입력으로 받은 글자를 비교합니다(암호·기도문·이름 맞히기).";
  }
}

function sel<T extends string>(options: readonly { value: T; label: string }[], current: T, testid: string, on: (value: T) => void): HTMLSelectElement {
  const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
  for (const option of options) select.append(el("option", { attrs: { value: option.value }, text: option.label }));
  select.value = current;
  select.addEventListener("change", () => on(select.value as T));
  return select;
}
function num(value: number, testid: string, on: (value: number) => void): HTMLInputElement {
  const input = el("input", { attrs: { type: "number" }, value: String(value), dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("change", () => on(Number.parseInt(input.value, 10) || 0));
  return input;
}
function text(value: string, testid: string, on: (value: string) => void, placeholder = ""): HTMLInputElement {
  const input = el("input", { attrs: { type: "text", placeholder }, value, dataset: { testid } }) as HTMLInputElement;
  input.addEventListener("change", () => on(input.value.trim()));
  return input;
}
function bool(value: boolean, yes: string, no: string, testid: string, on: (value: boolean) => void): HTMLSelectElement {
  return sel([{ value: "true", label: yes }, { value: "false", label: no }] as const, value ? "true" : "false", testid, (v) => on(v === "true"));
}
function row(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "inline-field event-condition-field", children: [el("span", { class: "event-condition-field-label", text: label }), control] });
}
function actorOptions(extra: readonly { value: string; label: string }[]): { value: string; label: string }[] {
  return [...extra, ...(project()?.database.actors ?? []).map((actor) => ({ value: actor.id, label: actor.name || actor.id }))];
}

/** 조건 세부 입력. onChange 는 새 조건 전체를 받는다. */
export function renderActorQueryCondition(condition: ActorQueryCondition, onChange: (next: Condition) => void): HTMLElement {
  const box = el("div", { class: "event-condition-detail", dataset: { testid: `event-condition-${condition.kind}` } });
  const set = (patch: Partial<ActorQueryCondition>): void => onChange({ ...condition, ...patch } as ActorQueryCondition);
  switch (condition.kind) {
    case "actorStat":
      box.append(
        row("누구", sel(actorOptions([{ value: "leader", label: "선두" }]), condition.actorId, "event-condition-actor-stat-actor", (actorId) => set({ actorId }))),
        row("수치", sel(STATS, condition.stat, "event-condition-actor-stat-stat", (stat) => set({ stat }))),
        row("비교", sel(OPS, condition.op, "event-condition-actor-stat-op", (op) => set({ op }))),
        row("값", num(condition.value, "event-condition-actor-stat-value", (value) => set({ value }))),
      );
      break;
    case "actorState":
      box.append(
        row("누구", sel(actorOptions([{ value: "anyone", label: "누군가(파티 전원)" }, { value: "leader", label: "선두" }]), condition.actorId, "event-condition-actor-state-actor", (actorId) => set({ actorId }))),
        row("상태", sel((project()?.database.states ?? []).map((s) => ({ value: s.id, label: s.name || s.id })), condition.stateId, "event-condition-actor-state-state", (stateId) => set({ stateId }))),
        row("판정", bool(condition.present, "있음", "없음", "event-condition-actor-state-present", (present) => set({ present }))),
      );
      break;
    case "partyLeader":
      box.append(row("선두", sel(actorOptions([]), condition.actorId, "event-condition-party-leader", (actorId) => set({ actorId }))));
      break;
    case "partyKnowsSkill":
      box.append(
        row("스킬", sel((project()?.database.skills ?? []).map((s) => ({ value: s.id, label: s.name || s.id })), condition.skillId, "event-condition-party-knows-skill", (skillId) => set({ skillId }))),
        row("판정", bool(condition.present !== false, "앎", "모름", "event-condition-party-knows-skill-present", (present) => set({ present }))),
      );
      break;
    case "badgeCount":
    case "partySize":
    case "clearCount":
      box.append(
        row("비교", sel(OPS, condition.op, `event-condition-${condition.kind}-op`, (op) => set({ op }))),
        row(condition.kind === "partySize" ? "인원" : condition.kind === "badgeCount" ? "배지 수" : "횟수", num(condition.value, `event-condition-${condition.kind}-value`, (value) => set({ value }))),
      );
      break;
    case "facing":
      box.append(
        row("누가", sel([{ value: "player", label: "주인공" }, { value: "event", label: "이 이벤트" }] as const, condition.subject, "event-condition-facing-subject", (subject) => set({ subject }))),
        row("방향", sel(DIRS, condition.dir, "event-condition-facing-dir", (dir) => set({ dir }))),
      );
      break;
    case "relativeFacing":
      box.append(row("자세", sel(RELATIONS, condition.relation, "event-condition-relative-facing", (relation) => set({ relation }))));
      break;
    case "hiding":
    case "newGamePlus":
      box.append(row("판정", bool(condition.value, "예", "아니오", `event-condition-${condition.kind}-value`, (value) => set({ value }))));
      break;
    case "pursuitActive":
      box.append(
        row("추격자 이벤트 id", text(condition.eventId ?? "", "event-condition-pursuit-event", (eventId) => onChange(eventId ? { ...condition, eventId } : { kind: "pursuitActive", value: condition.value }), "비우면 누구든")),
        row("판정", bool(condition.value, "추격 중", "추격 안 함", "event-condition-pursuit-value", (value) => set({ value }))),
      );
      break;
    case "eventSeesPlayer":
      box.append(
        row("보는 이벤트 id", text(condition.eventId, "event-condition-sees-event", (eventId) => set({ eventId }), "예: ev_owner")),
        row("거리(칸)", num(condition.range ?? 5, "event-condition-sees-range", (range) => set({ range }))),
        row("판정", bool(condition.value !== false, "보임", "안 보임", "event-condition-sees-value", (value) => set({ value }))),
      );
      break;
    case "endingSeen":
      box.append(
        row("엔딩", sel((project()?.endings ?? []).map((e) => ({ value: e.id, label: e.name || e.id })), condition.endingId, "event-condition-ending-seen", (endingId) => set({ endingId }))),
        row("판정", bool(condition.value, "봤음", "안 봤음", "event-condition-ending-seen-value", (value) => set({ value }))),
      );
      break;
    case "weekday": {
      // 조건 분기 창은 요일만 바뀌면 폼을 다시 그리지 않는다. 핸들러가 처음 그린
      // weekdays 를 닫아 두면, 일요일을 끈 뒤 월요일을 켜도 저장본이 일요일을 되살린다.
      let weekdays = [...condition.weekdays].sort((a, b) => a - b);
      const days = el("div", { class: "event-condition-weekdays", dataset: { testid: "event-condition-weekdays" } });
      WEEKDAY_LABELS.forEach((label, index) => {
        const box2 = el("input", { attrs: { type: "checkbox", "aria-label": `${label}요일` } }) as HTMLInputElement;
        box2.checked = weekdays.includes(index);
        box2.addEventListener("change", () => {
          const next = new Set(weekdays);
          if (box2.checked) next.add(index);
          else next.delete(index);
          weekdays = [...next].sort((a, b) => a - b);
          onChange({ kind: "weekday", weekdays });
        });
        days.append(el("label", { class: "event-condition-weekday", children: [box2, el("span", { text: label })] }));
      });
      box.append(row("요일", days));
      break;
    }
    case "stringVariable":
      box.append(
        row("문자열 변수 id", text(condition.stringVariableId, "event-condition-string-id", (stringVariableId) => set({ stringVariableId }))),
        row("비교", sel([{ value: "==", label: "같음" }, { value: "!=", label: "다름" }, { value: "contains", label: "포함" }, { value: "empty", label: "비어 있음" }] as const, condition.op, "event-condition-string-op", (op) => set({ op }))),
        row("글자", text(condition.value, "event-condition-string-value", (value) => set({ value }))),
      );
      break;
  }
  return box;
}

/** 검증: 참조가 비었거나 사라진 조건. 빈 배열 = 정상. */
export function actorQueryConditionProblems(
  condition: ActorQueryCondition,
  refs: { actors: ReadonlySet<string>; states: ReadonlySet<string>; endings: ReadonlySet<string> }
): string[] {
  const problems: string[] = [];
  const actorOk = (id: string, allow: readonly string[]) => allow.includes(id) || refs.actors.has(id);
  switch (condition.kind) {
    case "actorStat":
      if (!actorOk(condition.actorId, ["leader"])) problems.push(`없는 배우 ${condition.actorId}`);
      break;
    case "actorState":
      if (!actorOk(condition.actorId, ["leader", "anyone"])) problems.push(`없는 배우 ${condition.actorId}`);
      if (!refs.states.has(condition.stateId)) problems.push(`없는 상태 ${condition.stateId || "(비어 있음)"}`);
      break;
    case "partyLeader":
      if (!refs.actors.has(condition.actorId)) problems.push(`없는 배우 ${condition.actorId || "(비어 있음)"}`);
      break;
    case "partyKnowsSkill":
      if (!(project()?.database.skills ?? []).some((skill) => skill.id === condition.skillId)) problems.push(`없는 스킬 ${condition.skillId || "(비어 있음)"}`);
      break;
    case "endingSeen":
      if (!refs.endings.has(condition.endingId)) problems.push(`없는 엔딩 ${condition.endingId || "(비어 있음)"}`);
      break;
    case "stringVariable":
      if (!condition.stringVariableId) problems.push("문자열 변수 id 가 비어 있음");
      break;
    case "eventSeesPlayer":
      if (!condition.eventId) problems.push("보는 이벤트 id 가 비어 있음");
      break;
    case "weekday":
      if (condition.weekdays.length === 0) problems.push("요일을 하나 이상 고르세요");
      break;
    default:
      break;
  }
  return problems;
}
