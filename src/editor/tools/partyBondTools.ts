// editor/tools/partyBondTools.ts
// 파티원 유대 한 벌을 한 번에 만든다 — configure_party_bonds.
//
// 동료마다 유대 점수(0~max) 변수 + 「누구와 이야기할까」 모닥불·여관 밤 장면(공용 이벤트: 고른 사람 +1 과 짧은 대화)
// + 점수 문턱 해금(공용 이벤트: 연계기 requires 기술을 배우게 하거나 대사 분기 스위치를 켠다) + 상태 메뉴 「관계」 표시
// (system.partyBonds, project/partyBonds.ts). 모닥불 칸을 주면 칸마다 한 번 쓰는 조사 이벤트도 놓는다.
//
// 왜: 호감(friendship)은 NPC 키라 파티원 유대를 담지 못하고, 연계기 해금은 기술 조건뿐이라 「세 번 고른 동료와 듀얼 연계기」를
// 조수가 변수·선택지·fork·learnSkill 을 손으로 흩뿌려야 했다(폴른 스타 2막 4-4 「일지 한 줄」 규칙).

import type { Command, Condition, EventPage, GameEvent, Project, Trigger } from "@/project/types";
import { DEFAULT_PARTY_BOND_MAX, PARTY_BOND_MAX_LIMIT, normalizePartyBonds } from "@/project/partyBonds";
import { withJosa } from "@/util/josa";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { requireMap, inMapBounds } from "./mapHelpers";
import { placementAdjustedWarning, resolveEventPlacement, upsertEventIntoMap } from "./eventTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const TALK_EVENT_ID = "ce_party_bond_talk";
const CHECK_EVENT_ID = "ce_party_bond_check";
const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

type MemberArgs = { actorId: string; variableId: string; name: string; choiceText: string; talk: string[] };
type UnlockArgs = { actorId: string; atLeast: number; switchId: string; learn: { actorId: string; skillId: string }[]; message: string; comboTechId?: string };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function lines(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim()) : [];
}

function slug(id: string): string {
  return id.replace(/^actor_/, "").replace(/[^A-Za-z0-9_]/g, "_").toLowerCase() || "member";
}

function upsertCommonEvent(project: Project, id: string, name: string, commands: Command[]): "added" | "updated" {
  project.commonEvents ??= [];
  const index = project.commonEvents.findIndex((entry) => entry.id === id);
  const record = { id, name, trigger: "none" as const, commands };
  if (index >= 0) { project.commonEvents[index] = record; return "updated"; }
  project.commonEvents.push(record);
  return "added";
}

const text = (body: string, speaker?: string): Command => ({ kind: "text", body, ...(speaker ? { speaker } : {}) }) as Command;

function parseMembers(draft: Project, raw: unknown): MemberArgs[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ToolError("members 에 동료를 1명 이상 주세요 — [{actorId, talk:[대사…]}].", { code: "invalid-args" });
  }
  const seen = new Set<string>();
  return raw.map((row, index): MemberArgs => {
    const record = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const actorId = str(record.actorId);
    const actor = draft.database.actors.find((entry) => entry.id === actorId);
    if (!actor) {
      const known = draft.database.actors.map((entry) => `${entry.id}(${entry.name})`).slice(0, 12).join(", ");
      throw new ToolError(`members[${index}].actorId '${actorId}' 배우가 없습니다. 있는 배우: ${known}`, { code: "actor-not-found" });
    }
    if (seen.has(actorId)) throw new ToolError(`members 에 ${actorId} 가 두 번 있습니다.`, { code: "invalid-args" });
    seen.add(actorId);
    const talk = lines(record.talk);
    return {
      actorId,
      variableId: str(record.variableId) || `var_bond_${slug(actorId)}`,
      name: actor.name,
      choiceText: str(record.choiceText) || actor.name,
      talk: talk.length > 0 ? talk : [`……${withJosa(actor.name, "와/과")} 불가에 앉아 한참 이야기를 나눴다.`],
    };
  });
}

function parseUnlocks(draft: Project, raw: unknown, members: readonly MemberArgs[], max: number, warnings: string[]): UnlockArgs[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new ToolError("unlocks 는 배열이어야 합니다 — [{actorId, atLeast, comboTechId | learn | switchId}].", { code: "invalid-args" });
  return raw.map((row, index): UnlockArgs => {
    const record = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const actorId = str(record.actorId);
    const member = members.find((entry) => entry.actorId === actorId);
    if (!member) throw new ToolError(`unlocks[${index}].actorId '${actorId}' 는 members 에 없는 동료입니다.`, { code: "invalid-args" });
    const atLeast = typeof record.atLeast === "number" && Number.isFinite(record.atLeast) ? Math.trunc(record.atLeast) : 3;
    if (atLeast < 1 || atLeast > max) throw new ToolError(`unlocks[${index}].atLeast 는 1~${max} 여야 합니다(받은 값 ${atLeast}).`, { code: "invalid-args" });
    const learn: { actorId: string; skillId: string }[] = [];
    const comboTechId = str(record.comboTechId);
    if (comboTechId) {
      const combo = draft.database.skills.find((skill) => skill.id === comboTechId);
      if (!combo || (combo.comboActorIds?.length ?? 0) < 2) {
        throw new ToolError(`unlocks[${index}].comboTechId '${comboTechId}' 연계기가 없습니다. upsert_combo_tech 로 먼저 만드세요(list_combo_techs 로 확인).`, { code: "combo-not-found" });
      }
      if (!combo.comboActorIds!.includes(actorId)) warnings.push(`연계기 ${comboTechId} 참가자에 ${actorId} 가 없습니다 — 유대 해금과 연계기가 다른 사람입니다.`);
      const rows = (combo.comboRequires ?? []).filter((entry) => entry.actorId === actorId);
      if (rows.length === 0) {
        throw new ToolError(
          `연계기 ${comboTechId} 의 requires 에 ${actorId} 줄이 없어 유대로 열 수 없습니다. upsert_combo_tech 로 requires:[{actorId:'${actorId}', skillId:'<유대로 배울 기술>'}] 를 넣고(그 기술은 시작할 때 배우지 않은 것) 다시 부르세요.`,
          { code: "combo-no-requires" },
        );
      }
      for (const entry of rows) learn.push({ actorId: entry.actorId, skillId: entry.skillId });
    }
    if (Array.isArray(record.learn)) {
      for (const [learnIndex, entry] of record.learn.entries()) {
        const learnActorId = str((entry as Record<string, unknown> | null)?.actorId) || actorId;
        const skillId = str((entry as Record<string, unknown> | null)?.skillId);
        if (!draft.database.skills.some((skill) => skill.id === skillId)) throw new ToolError(`unlocks[${index}].learn[${learnIndex}].skillId '${skillId}' 기술이 없습니다.`, { code: "skill-not-found" });
        if (!draft.database.actors.some((actor) => actor.id === learnActorId)) throw new ToolError(`unlocks[${index}].learn[${learnIndex}].actorId '${learnActorId}' 배우가 없습니다.`, { code: "actor-not-found" });
        learn.push({ actorId: learnActorId, skillId });
      }
    }
    for (const entry of learn) {
      const actor = draft.database.actors.find((record) => record.id === entry.actorId);
      const classRecord = actor ? draft.database.classes.find((record) => record.id === actor.classId) : undefined;
      const level = actor?.initialLevel ?? 1;
      const atStart = [...(actor?.learnedSkills ?? []), ...(classRecord?.learnedSkills ?? [])].some((row) => row.skillId === entry.skillId && row.level <= level);
      if (atStart) warnings.push(`${entry.actorId} 는 ${entry.skillId} 를 처음부터 배운 상태라 유대 해금이 아무것도 막지 않습니다 — 시작 기술에서 빼거나 다른 기술을 requires 로 쓰세요.`);
    }
    const switchId = str(record.switchId) || `sw_bond_${slug(actorId)}_${atLeast}`;
    const skillNames = learn.map((entry) => draft.database.skills.find((skill) => skill.id === entry.skillId)?.name ?? entry.skillId);
    const comboName = comboTechId ? draft.database.skills.find((skill) => skill.id === comboTechId)?.name : undefined;
    const message = str(record.message)
      || (comboName ? `${withJosa(member.name, "와/과")}의 연계기 『${comboName}』 해금!`
        : skillNames.length > 0 ? `${withJosa(member.name, "와/과")}의 유대로 ${withJosa(skillNames.join(", "), "을/를")} 익혔다!` : "");
    if (learn.length === 0 && !str(record.switchId)) {
      warnings.push(`unlocks[${index}] 에 comboTechId·learn·switchId 가 없어 스위치 ${switchId} 만 켭니다 — 대사 분기는 이 스위치나 변수 ${member.variableId} >= ${atLeast} 조건으로 거세요.`);
    }
    return { actorId, atLeast, switchId, learn, message, ...(comboTechId ? { comboTechId } : {}) };
  });
}

const configurePartyBonds: ToolDefinition = {
  name: "configure_party_bonds",
  description: [
    "파티원 유대를 한 번에 만든다 — 동료마다 유대 점수 변수(0~max, 기본 5), 「누구와 이야기할까」 장면 공용 이벤트",
    `(${TALK_EVENT_ID}: 동료 선택지 → 고른 사람 +1·그 사람과의 짧은 대화 → 문턱 검사), 문턱 해금 공용 이벤트(${CHECK_EVENT_ID}: 유대 N 이상이면`,
    "연계기 requires 기술을 그 동료가 배워 연계기가 열리거나(comboTechId) 기술을 배우거나(learn) 대사 분기 스위치를 켠다), 상태 메뉴 「관계」에 유대 ♥ 표시.",
    "campfires 로 모닥불·여관 침대 칸을 주면 칸마다 한 번 쓰는 조사 이벤트를 놓는다(두 번째부터는 불씨 대사). 모닥불 그림은 따로 stamp 한다.",
    "다른 장면에서 유대를 올릴 때는 {kind:'setVariable',variableId:<유대 변수>,op:'+=',value:1} 뒤 {kind:'callCommonEvent',commonEventId:'ce_party_bond_check'}.",
    "대사 분기는 fork {kind:'variable',variableId,op:'>=',value:N} 또는 해금 스위치로. 연계기는 먼저 upsert_combo_tech 로 만들고 requires 에 그 동료의 「유대로 배울 기술」을 넣는다.",
    "같은 도구를 다시 부르면 전체를 덮어쓴다(멤버 추가도 전체 목록으로). 유대·모닥불 대화를 setVariable·choices 로 손으로 흩뿌리지 말 것.",
  ].join(" "),
  mode: "write",
  domains: ["event", "system", "battle"],
  parameters: {
    type: "object",
    properties: {
      members: {
        type: "array",
        description: "유대를 둘 동료(주인공 제외). talk = 그 동료를 골랐을 때 나오는 짧은 대화 줄(말하는 사람은 그 동료)",
        items: {
          type: "object",
          properties: {
            actorId: { type: "string" },
            talk: { type: "array", items: { type: "string" }, description: "고르면 나오는 대사 1~4줄" },
            choiceText: { type: "string", description: "선택지 글(기본 = 배우 이름)" },
            variableId: { type: "string", description: "유대 변수 id(기본 var_bond_<배우>)" },
          },
          required: ["actorId"],
          additionalProperties: false,
        },
      },
      max: { type: "integer", minimum: 1, maximum: PARTY_BOND_MAX_LIMIT, description: `유대 상한(기본 ${DEFAULT_PARTY_BOND_MAX})` },
      prompt: { type: "string", description: "선택지 질문(기본 「누구와 이야기할까?」)" },
      intro: { type: "array", items: { type: "string" }, description: "선택지 앞 서술(예: 「불이 탁탁 튄다.」)" },
      unlocks: {
        type: "array",
        description: "유대 문턱 해금 — 그 동료의 유대가 atLeast 이상이 되면 한 번 실행",
        items: {
          type: "object",
          properties: {
            actorId: { type: "string", description: "어느 동료의 유대인가(members 중 하나)" },
            atLeast: { type: "integer", minimum: 1, description: "문턱(기본 3)" },
            comboTechId: { type: "string", description: "열 연계기 id — 연계기 requires 중 이 동료 줄의 기술을 이 동료가 배운다" },
            learn: {
              type: "array",
              description: "추가로 배우게 할 기술 [{actorId?, skillId}] (actorId 생략 = 그 동료)",
              items: { type: "object", properties: { actorId: { type: "string" }, skillId: { type: "string" } }, required: ["skillId"], additionalProperties: false },
            },
            switchId: { type: "string", description: "해금 때 켤 스위치(대사 분기용). 생략 = sw_bond_<배우>_<문턱> 자동" },
            message: { type: "string", description: "해금 알림 한 줄(생략 = 자동)" },
          },
          required: ["actorId"],
          additionalProperties: false,
        },
      },
      campfires: {
        type: "array",
        description: "이 장면을 여는 조사 지점(모닥불·여관 침대). 칸마다 한 번",
        items: {
          type: "object",
          properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, id: { type: "string" }, name: { type: "string" } },
          required: ["mapId", "x", "y"],
          additionalProperties: false,
        },
      },
    },
    required: ["members"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    members: [
      { actorId: "actor_elena", talk: ["카엘, 불 옆이니까 하는 말인데……", "고마워. 같이 와 줘서."] },
      { actorId: "actor_sera", talk: ["창은 손에 익었다. 너희도 그렇고."] },
    ],
    unlocks: [{ actorId: "actor_elena", atLeast: 3, comboTechId: "skill_combo_flame_cross_plus" }],
    campfires: [{ mapId: "map_snow_pass", x: 12, y: 8 }],
  },
  run(draft, args): ToolExecResult {
    const warnings: string[] = [];
    const max = typeof args.max === "number" && Number.isFinite(args.max) ? Math.max(1, Math.min(PARTY_BOND_MAX_LIMIT, Math.trunc(args.max))) : DEFAULT_PARTY_BOND_MAX;
    const members = parseMembers(draft, args.members);
    const unlocks = parseUnlocks(draft, args.unlocks, members, max, warnings);
    const prompt = str(args.prompt) || "누구와 이야기할까?";
    const intro = lines(args.intro);

    for (const member of members) {
      ensureNamedVariable(draft, member.variableId, `${member.name} 유대`);
      draft.session.variables[member.variableId] = Math.max(0, Math.min(max, Math.trunc(draft.session.variables[member.variableId] ?? 0)));
    }
    for (const unlock of unlocks) {
      const member = members.find((entry) => entry.actorId === unlock.actorId)!;
      ensureNamedSwitch(draft, unlock.switchId, `${member.name} 유대 ${unlock.atLeast}`);
    }
    const hero = (draft.system.startActorIds ?? [])[0];
    if (hero && members.some((member) => member.actorId === hero)) warnings.push(`${hero} 는 시작 파티의 첫 배우(주인공)입니다 — 유대는 보통 동료에게만 둡니다.`);

    // 문턱 검사: 해금마다 「유대 >= N 이고 아직 안 켜짐」이면 기술을 배우고 스위치를 켜고 한 줄 알린다(한 번만).
    const check: Command[] = unlocks.map((unlock) => {
      const member = members.find((entry) => entry.actorId === unlock.actorId)!;
      const condition: Condition = { kind: "all", conditions: [
        { kind: "variable", variableId: member.variableId, op: ">=", value: unlock.atLeast },
        { kind: "switch", switchId: unlock.switchId, value: false },
      ] };
      return { kind: "fork", condition, then: [
        ...unlock.learn.map((entry) => ({ kind: "learnSkill", actorId: entry.actorId, skillId: entry.skillId, action: "learn" }) as Command),
        { kind: "setSwitch", switchId: unlock.switchId, value: true } as Command,
        ...(unlock.message ? [text(unlock.message)] : []),
      ] } as Command;
    });

    const options = members.map((member) => ({
      text: member.choiceText,
      branch: [{
        kind: "fork",
        condition: { kind: "actor", actorId: member.actorId, present: true },
        then: [
          ...member.talk.map((body) => text(body, member.name)),
          { kind: "fork", condition: { kind: "variable", variableId: member.variableId, op: "<", value: max }, then: [
            { kind: "setVariable", variableId: member.variableId, op: "+=", value: 1 } as Command,
            text(`♥ ${withJosa(member.name, "와/과")}의 유대가 깊어졌다.`),
          ] } as Command,
          ...(unlocks.length > 0 ? [{ kind: "callCommonEvent", commonEventId: CHECK_EVENT_ID } as Command] : []),
        ],
        else: [text(`${withJosa(member.name, "은/는")} 지금 곁에 없다.`)],
      } as Command],
    }));
    const talk: Command[] = [
      ...intro.map((body) => text(body)),
      { kind: "choices", prompt, options, cancelBehavior: "branch", cancelBranch: [] } as unknown as Command,
    ];
    const talkOutcome = upsertCommonEvent(draft, TALK_EVENT_ID, "동료와 이야기(유대)", talk);
    if (unlocks.length > 0) upsertCommonEvent(draft, CHECK_EVENT_ID, "유대 문턱 해금", check);
    else draft.commonEvents = (draft.commonEvents ?? []).filter((entry) => entry.id !== CHECK_EVENT_ID);

    draft.system.partyBonds = normalizePartyBonds({ max, members: members.map((member) => ({ actorId: member.actorId, variableId: member.variableId })) });

    // 모닥불: 칸마다 한 번 장면을 열고(셀프 스위치 A), 두 번째부터는 불씨 대사.
    const placed: { mapId: string; eventId: string; x: number; y: number }[] = [];
    const campfires = Array.isArray(args.campfires) ? args.campfires : [];
    for (const [index, raw] of campfires.entries()) {
      const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const map = requireMap(draft, str(row.mapId));
      const rx = Number(row.x), ry = Number(row.y);
      if (!Number.isInteger(rx) || !Number.isInteger(ry) || !inMapBounds(map, rx, ry)) {
        throw new ToolError(`campfires[${index}] 위치가 맵 밖입니다: (${row.x}, ${row.y})`, { code: "invalid-args", mapId: map.id });
      }
      const id = str(row.id) || `ev_bond_campfire_${map.id}_${rx}_${ry}`;
      const name = str(row.name) || "모닥불";
      const placement = resolveEventPlacement(draft, map, rx, ry, { kind: "interaction", label: name, code: "bond-campfire-impassable", ignoreEventId: id });
      if (placement.adjusted) warnings.push(placementAdjustedWarning(name, { x: rx, y: ry }, placement));
      const trigger: Trigger = { kind: "action" };
      const base = { graphic: { transparent: true }, trigger, priority: "below" as const, overlapForbidden: false, animationType: "fixedGraphic" as const, movement: PASSIVE };
      const event: GameEvent = {
        id, x: placement.x, y: placement.y, trigger, commands: [],
        pages: [
          { id: `${id}_page`, name, conditions: [{ kind: "selfSwitch", key: "A", value: false }], ...base,
            commands: [{ kind: "callCommonEvent", commonEventId: TALK_EVENT_ID } as Command, { kind: "setSelfSwitch", key: "A", value: true } as Command] },
          { id: `${id}_page_done`, name: `${name} (이야기 뒤)`, conditions: [{ kind: "selfSwitch", key: "A", value: true }], ...base,
            commands: [text("불씨가 조용히 타고 있다.")] },
        ],
      };
      upsertEventIntoMap(map, event);
      placed.push({ mapId: map.id, eventId: id, x: placement.x, y: placement.y });
    }

    return {
      summary: `파티원 유대 ${members.map((member) => member.name).join("·")} (상한 ${max}) — 이야기 장면 ${TALK_EVENT_ID} ${talkOutcome === "added" ? "추가" : "갱신"}`
        + (unlocks.length ? ` · 해금 ${unlocks.length}개(${CHECK_EVENT_ID})` : "")
        + (placed.length ? ` · 모닥불 ${placed.length}곳` : "")
        + " · 상태 메뉴 「관계」에 유대 표시",
      data: {
        max,
        members: members.map((member) => ({ actorId: member.actorId, variableId: member.variableId })),
        unlocks: unlocks.map((unlock) => ({ actorId: unlock.actorId, atLeast: unlock.atLeast, switchId: unlock.switchId, learn: unlock.learn, ...(unlock.comboTechId ? { comboTechId: unlock.comboTechId } : {}) })),
        talkCommonEventId: TALK_EVENT_ID,
        ...(unlocks.length ? { checkCommonEventId: CHECK_EVENT_ID } : {}),
        campfires: placed,
        usage: {
          openScene: { kind: "callCommonEvent", commonEventId: TALK_EVENT_ID },
          raiseBond: members[0] ? [{ kind: "setVariable", variableId: members[0].variableId, op: "+=", value: 1 }, ...(unlocks.length ? [{ kind: "callCommonEvent", commonEventId: CHECK_EVENT_ID }] : [])] : [],
          branchOnBond: members[0] ? { kind: "fork", condition: { kind: "variable", variableId: members[0].variableId, op: ">=", value: 3 } } : undefined,
        },
      },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const PARTY_BOND_TOOLS: readonly ToolDefinition[] = [configurePartyBonds];
