// project/quest/questCompiler.ts
// QuestDef → 스위치/변수 + 기버 다중 페이지 + 수집물/블로커/게이트/도달 이벤트로 결정적 컴파일.
// emberQuestGame.ts의 chief/herbalist 페이지 구조(제안→진행→턴인→완료)를 템플릿화한다.
// 산출물은 draft(Project)에 직접 적용되며, def는 project.quests에 메타로 보존된다.
// 모든 스위치/변수는 사용 전에 등록되어 projectLint 참조 검증을 통과한다.

import { resolveEventPlacement, upsertEventIntoMap } from "@/editor/tools/eventTools";
import { ensureNamedSwitch, ensureNamedVariable } from "@/editor/tools/flagHelpers";
import { resolveGraphic, type GraphicSpec } from "@/editor/tools/eventCompile";
import { isPassable } from "@/project/collision";
import { questPresetIssue } from './questPresets';
import { validateQuestReferences } from './questValidation';
import { resolveAnchorPoint } from "@/project/locationAnchors";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, GameEvent, GameMap, Project, SimpleTriggerKind } from "@/project/types";
import {
  isValidQuestKey,
  questFlagIds,
  type CollectSource,
  type QuestDef,
  type QuestFlagIds,
  type QuestGate,
  type QuestNpcSpec,
  type QuestStep,
  type QuestCost,
  type QuestEffects,
  questDefId,
} from "./questDef";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

export interface QuestCompileResult {
  readonly flags: QuestFlagIds;
  readonly eventsCreated: number;
  readonly switchesRegistered: number;
  readonly variablesRegistered: number;
  /** 통행 가능 착지로 좌표가 바뀐 이벤트 등, 저작자가 알아야 할 비차단 경고. */
  readonly warnings: readonly string[];
}

// 컴파일 도중 누적되는 카운터 + 경고 채널.
interface CompileSink {
  events: number;
  variables: number;
  warnings: string[];
}

/**
 * 저작 좌표를 통행 가능 계약에 맞춰 착지시킨다(AI 배치 툴과 동일한 판정 재사용).
 *
 * 왜: 컴파일러는 좌표를 그대로 믹어 써서 강 위 퀘스트를 만들면 물 속에 선 NPC와
 * 절대 밟히지 않는 playerTouch 도달 마커가 나왔다.
 * - 캐릭터형(기버·대화 NPC·몬스터): kind "character" — 반드시 통행 가능 칸.
 * - playerTouch/touch 마커(priority !== "same"): steppable — 반드시 통행 가능 칸.
 * - action 트리거 마커/차단 이벤트: kind "interaction" — 벽 위 허용, 단 도달 가능해야 한다.
 */
function placeQuestEvent(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  options: {
    kind: "character" | "interaction";
    steppable?: boolean;
    label: string;
    code: string;
    eventId: string;
    /** 구역 앵커. 있으면 그 중심 칸을 쓴다 — 좌표는 폴백이다(2026-09-12). */
    locationId?: string;
  },
  sink: CompileSink
): { x: number; y: number } {
  // 구역을 가리키면 중심 칸이 목적지다. 구역이 지워졌거나 옛 정의면 좌표 그대로 돈다 —
  // 조용히 목적지를 잃지 않게 하는 폴백이고, 끊긴 참조는 lint 가 따로 올린다.
  const anchored = resolveAnchorPoint(project, map.id, { locationId: options.locationId }, { x, y });
  const targetX = anchored.x;
  const targetY = anchored.y;
  const placement = resolveEventPlacement(project, map, targetX, targetY, {
    kind: options.kind,
    steppable: options.steppable,
    ignoreEventId: options.eventId,
    label: options.label,
    code: options.code,
  });
  if (placement.adjusted) {
    sink.warnings.push(`${options.label} 위치 자동 조정: (${targetX}, ${targetY}) → (${placement.x}, ${placement.y})`);
  }
  return { x: placement.x, y: placement.y };
}

export class QuestCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestCompileError";
  }
}

function requireMap(project: Project, mapId: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new QuestCompileError(`퀘스트가 참조하는 맵이 없습니다: ${mapId}`);
  return map;
}

function text(body: string, speaker?: string): Command {
  return speaker ? { kind: "text", speaker, body } : { kind: "text", body };
}

function switchCond(switchId: string, value = true): EventPageCondition {
  return { kind: "switch", switchId, value };
}

function stepConditions(def: QuestDef, flags: QuestFlagIds, index: number): EventPageCondition[] {
  return [switchCond(flags.started), switchCond(flags.done, false), switchCond(flags.stepSwitches[index], false),
    ...(def.order === 'sequence' ? flags.stepSwitches.slice(0, index).map(id => switchCond(id)) : []),
    ...(def.steps[index].timePhase ? [{ kind: 'timePhase' as const, phase: def.steps[index].timePhase! }] : [])];
}

function finish(flags: QuestFlagIds, index: number): Command[] {
  return [{ kind: 'setSwitch', switchId: flags.stepSwitches[index], value: true }, { kind: 'setVariable', variableId: flags.progress, op: '+=', value: 1 }];
}

function effects(project: Project, value: QuestEffects | undefined): Command[] {
  return [
    ...(value?.switches ?? []).map(flag => { ensureNamedSwitch(project, flag.id, flag.id); return { kind: 'setSwitch' as const, switchId: flag.id, value: flag.value }; }),
    ...(value?.variables ?? []).map(flag => { ensureNamedVariable(project, flag.id, flag.id); return { kind: 'setVariable' as const, variableId: flag.id, op: '=' as const, value: flag.value }; }),
    ...(value?.actors ?? []).map(actorId => ({ kind: 'changeParty' as const, actorId, action: 'add' as const })),
  ];
}

/** Check every cost before changing inventory. The shipped data query returns actual quantities. */
function paid(project: Project, key: string, cost: QuestCost | undefined, success: Command[], sink: CompileSink): Command[] {
  const deduct: Command[] = [
    ...(cost?.gold ? [{ kind: 'changeGold' as const, op: '-=' as const, amount: cost.gold }] : []),
    ...(cost?.items ?? []).map(item => ({ kind: 'changeItem' as const, itemId: item.itemId, op: '-=' as const, amount: item.count })),
  ];
  let result: Command[] = [...deduct, ...success];
  const missing = [text('필요한 물건이나 비용이 부족합니다.')];
  if (cost?.gold) result = [{ kind: 'fork', condition: { kind: 'gold', op: '>=', amount: cost.gold }, then: result, else: missing }];
  for (const [i, item] of (cost?.items ?? []).entries()) {
    const variableId = `var_${key}_quantity${i}`;
    ensureNamedVariable(project, variableId, '납품 수량 확인'); sink.variables += 1;
    result = [{ kind: 'm2Command', commandId: 'm2-217-data-query', fields: { query: 'itemCount', target: item.itemId, variableId } },
      { kind: 'fork', condition: { kind: 'variable', variableId, op: '>=', value: item.count }, then: result, else: missing }];
  }
  return result;
}

function preservePages(target: GameEvent): EventPage[] {
  if (!target.pages?.length) target.pages = [page(`${target.id}_base`, '기존 이벤트', [], [...target.commands], { transparent: true }, { trigger: target.trigger.kind as SimpleTriggerKind })];
  return target.pages;
}

function npcTarget(project: Project, def: QuestDef, target: QuestDef['giver'], index: number, sink: CompileSink): { event: GameEvent; graphic: EventPageGraphic; name: string } {
  if ('create' in target) {
    const spec = target.create, map = requireMap(project, spec.mapId), id = `ev_${def.key}_${def.steps[index].kind}${index}`;
    const graphic = npcGraphic(spec);
    const at = placeQuestEvent(project, map, spec.x, spec.y, { kind: 'character', eventId: id, label: spec.name, code: 'quest-npc-impassable' }, sink);
    const created = event(id, at.x, at.y, 'action', [page(`${id}_idle`, spec.name, [], [text('...', spec.name)], graphic)]);
    upsertEventIntoMap(map, created); sink.events += 1;
    return { event: created, graphic, name: spec.name };
  }
  const existing = requireMap(project, target.mapId).events.find(entry => entry.id === target.eventId)!;
  preservePages(existing);
  return { event: existing, graphic: existing.pages![0].graphic ?? { transparent: true }, name: existing.pages![0].name ?? '인물' };
}

function page(
  id: string,
  name: string,
  conditions: EventPageCondition[],
  commands: Command[],
  graphic: EventPageGraphic,
  options: { trigger?: SimpleTriggerKind; priority?: EventPage["priority"] } = {}
): EventPage {
  const trigger = options.trigger ?? "action";
  const priority = options.priority ?? "same";
  return {
    id,
    name,
    conditions,
    graphic,
    trigger: { kind: trigger },
    priority,
    overlapForbidden: priority === "same",
    movement: PASSIVE,
    commands,
  };
}

function event(id: string, x: number, y: number, trigger: SimpleTriggerKind, pages: EventPage[]): GameEvent {
  return { id, x, y, trigger: { kind: trigger }, commands: [], pages };
}

function npcGraphic(spec: QuestNpcSpec): EventPageGraphic {
  const graphicSpec: GraphicSpec | undefined =
    spec.textureKey !== undefined && spec.characterIndex !== undefined
      ? { textureKey: spec.textureKey, characterIndex: spec.characterIndex }
      : spec.graphicQuery
        ? { query: spec.graphicQuery }
        : undefined;
  return resolveGraphic(graphicSpec);
}

function graphicFromQuery(query: string | undefined): EventPageGraphic {
  return resolveGraphic(query ? { query } : undefined);
}

// 각 단계의 "완료 조건"과 그 완료를 유발하는 이벤트를 draft에 생성한다.
function materializeStep(
  project: Project,
  def: QuestDef,
  flags: QuestFlagIds,
  step: QuestStep,
  index: number,
  counters: CompileSink
): void {
  const stepSwitch = flags.stepSwitches[index];
  switch (step.kind) {
    case "talk": {
      const targetMap = "create" in step.target ? requireMap(project, step.target.create.mapId) : requireMap(project, step.target.mapId);
      if ("create" in step.target) {
        // 대화 대상 NPC 신규 생성.
        const spec = step.target.create;
        const graphic = npcGraphic(spec);
        const id = `ev_${def.key}_talk${index}`;
        const lines = (step.lines ?? [`${spec.name}와 대화했다.`]).map((line) => text(line, spec.name));
        const talkNow = page(`${id}_talk`, spec.name, stepConditions(def, flags, index), [
          ...lines,
          { kind: "setSwitch", switchId: stepSwitch, value: true },
          { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
        ], graphic);
        const already = page(`${id}_done`, spec.name, [switchCond(stepSwitch)], [text("고맙네, 잘 부탁하지.", spec.name)], graphic);
        const idle = page(`${id}_idle`, spec.name, [], [text("...", spec.name)], graphic);
        // 그래픽을 가진 캐릭터형 NPC — 물·벽 위에 세우면 지형에 박힌다.
        const at = placeQuestEvent(project, targetMap, spec.x, spec.y, {
          kind: "character",
          label: `NPC '${spec.name}'`,
          code: "quest-talk-npc-impassable",
          eventId: id,
        }, counters);
        upsertEventIntoMap(targetMap, event(id, at.x, at.y, "action", [idle, talkNow, already]));
        counters.events += 1;
      } else {
        // 기존 이벤트에 퀘스트 대화 페이지를 덧붙인다(높은 인덱스가 우선 해석됨).
        const target = targetMap.events.find((entry) => entry.id === (step.target as { eventId: string }).eventId);
        if (!target) throw new QuestCompileError(`talk 대상 이벤트가 없습니다: ${(step.target as { eventId: string }).eventId}`);
        const graphic = target.pages?.[0]?.graphic ?? { transparent: true };
        const lines = (step.lines ?? ["부탁한 일을 확인했다."]).map((line) => text(line));
        const pages = preservePages(target);
        pages.push(
          page(`${target.id}_${def.key}_talk${index}`, pages[0]?.name ?? "대화", stepConditions(def, flags, index), [
            ...lines,
            { kind: "setSwitch", switchId: stepSwitch, value: true },
            { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
          ], graphic),
          page(`${target.id}_${def.key}_talkdone${index}`, pages[0]?.name ?? "대화", [switchCond(stepSwitch)], [text("고맙네.")], graphic)
        );
      }
      break;
    }
    case "collect": {
      // 단계 전용 카운트 변수: count에 도달하면 stepSwitch 세팅.
      const countVar = `var_${def.key}_c${index}`;
      ensureNamedVariable(project, countVar, `${def.title} 수집 진행 ${index}`);
      counters.variables += 1;
      step.sources.forEach((source, sourceIndex) => {
        materializeCollectSource(project, def, flags, step.itemId, step.count, countVar, stepSwitch, source, index, sourceIndex, counters);
      });
      break;
    }
    case "kill": {
      // 전투 블로커: 클리어 스위치를 stepSwitch로 직접 사용.
      const map = requireMap(project, step.at.mapId);
      const id = `ev_${def.key}_kill${index}`;
      const graphic = graphicFromQuery(step.at.graphicQuery ?? "몬스터");
      const intro = (step.at.intro ?? ["적이 앞을 가로막았다!"]).map((line) => text(line));
      const victory = (step.at.victory ?? ["길이 열렸다."]).map((line) => text(line));
      const fight = page(`${id}_fight`, "전투", stepConditions(def, flags, index), [
        ...intro,
        { kind: "battleProcessing", troopId: step.troopId, canEscape: true, canLose: false },
        { kind: 'fork', condition: { kind: 'battleResult', result: 'victory' }, then: [
          { kind: "setSwitch", switchId: stepSwitch, value: true },
          { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
          ...victory,
        ] },
      ], graphic);
      const cleared = page(`${id}_cleared`, "정리된 자리", [switchCond(stepSwitch)], [], { transparent: true }, { priority: "below" });
      const idle = page(`${id}_idle`, "휴식", [], [text("아직은 조용하다.")], graphic);
      // 몬스터 스프라이트로 길을 막는 캐릭터형 이벤트 — place_battle_blocker와 같은 판정.
      const at = placeQuestEvent(project, map, step.at.x, step.at.y, {
        kind: "character",
        label: "전투 블로커",
        code: "quest-kill-impassable",
        eventId: id,
        ...(step.at.locationId === undefined ? {} : { locationId: step.at.locationId }),
      }, counters);
      upsertEventIntoMap(map, event(id, at.x, at.y, "action", [idle, fight, cleared]));
      counters.events += 1;
      break;
    }
    case "reach": {
      const map = requireMap(project, step.mapId);
      const id = `ev_${def.key}_reach${index}`;
      const arrive = page(`${id}_arrive`, "도착", stepConditions(def, flags, index), [
        { kind: "setSwitch", switchId: stepSwitch, value: true },
        { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
      ], { transparent: true }, { trigger: "playerTouch", priority: "below" });
      // playerTouch + priority "below" = 플레이어가 그 칸을 밟아야 발동한다 → 반드시 통행 가능 칸.
      const at = placeQuestEvent(project, map, step.x, step.y, {
        kind: "interaction",
        steppable: true,
        label: "도달 지점",
        code: "quest-reach-impassable",
        eventId: id,
        ...(step.locationId === undefined ? {} : { locationId: step.locationId }),
      }, counters);
      upsertEventIntoMap(map, event(id, at.x, at.y, "playerTouch", [arrive]));
      counters.events += 1;
      break;
    }
    case 'inspect':
    case 'craft': {
      const map = requireMap(project, step.at.mapId), id = `ev_${def.key}_${step.kind}${index}`;
      let commands: Command[] = [...(step.lines ?? ['작업을 마쳤다.']).map(line => text(line)), ...finish(flags, index)];
      if (step.kind === 'craft') {
        const variableId = `var_${def.key}_craft${index}`;
        ensureNamedVariable(project, variableId, '제작 결과'); counters.variables += 1;
        commands = [{ kind: 'craftRecipe', recipeId: step.recipeId, resultVariableId: variableId },
          { kind: 'fork', condition: { kind: 'variable', variableId, op: '==', value: 1 }, then: commands, else: [text('제작에 필요한 재료나 비용을 확인해 주세요.')] }];
      }
      const at = placeQuestEvent(project, map, step.at.x, step.at.y, { kind: 'interaction', eventId: id, label: step.label ?? '조사 지점', code: 'quest-inspect-impassable', locationId: step.at.locationId }, counters);
      upsertEventIntoMap(map, event(id, at.x, at.y, 'action', [
        page(`${id}_active`, step.label ?? '조사', stepConditions(def, flags, index), commands, { transparent: true }, { priority: 'below' }),
        page(`${id}_done`, '완료', [switchCond(stepSwitch)], [text('확인을 마쳤다.')], { transparent: true }, { priority: 'below' }),
      ])); counters.events += 1; break;
    }
    case 'deliver':
    case 'choice':
    case 'escort': {
      const target = npcTarget(project, def, step.target, index, counters), id = `${target.event.id}_${def.key}_${index}`;
      let commands: Command[];
      if (step.kind === 'deliver') {
        commands = paid(project, `${def.key}_deliver${index}`, { items: [{ itemId: step.itemId, count: step.count }] }, [
          ...(step.gives ?? []).map(item => ({ kind: 'changeItem' as const, itemId: item.itemId, op: '+=' as const, amount: item.count })),
          ...(step.lines ?? ['물건을 잘 받았습니다.']).map(line => text(line, target.name)), ...finish(flags, index),
        ], counters);
      } else if (step.kind === 'choice') {
        const variableId = `var_${def.key}_choice${index}`;
        ensureNamedVariable(project, variableId, '선택 결과'); counters.variables += 1;
        commands = [{ kind: 'choices', prompt: step.prompt, cancelBehavior: 'disallow', options: step.options.map((option, choiceIndex) => {
          const lines = (option.lines ?? []).map(line => text(line, target.name));
          if (option.completes === false) return { text: option.text, branch: lines.length ? lines : [text('다시 생각해 보세요.')] };
          let branch = paid(project, `${def.key}_choice${index}_${choiceIndex}`, option.cost, [
            ...lines, ...effects(project, option.effects), { kind: 'setVariable', variableId, op: '=', value: choiceIndex + 1 }, ...finish(flags, index),
          ], counters);
          if (option.troopId) branch = [
            { kind: 'battleProcessing', troopId: option.troopId, canEscape: true, canLose: true },
            { kind: 'fork', condition: { kind: 'battleResult', result: 'victory' }, then: branch, else: [text('이번에는 해결하지 못했다. 다시 도전할 수 있다.')] },
          ];
          return { text: option.text, branch };
        }) }];
      } else {
        const joined = `sw_${def.key}_escort${index}`, followerName = `quest:${def.key}:${index}`;
        ensureNamedSwitch(project, joined, '퀘스트 동행 시작');
        const variableId = `var_${def.key}_follower${index}`;
        ensureNamedVariable(project, variableId, '퀘스트 동행자 확인'); counters.variables += 1;
        const query: Command = { kind: 'm2Command', commandId: 'm2-217-data-query', fields: { query: 'followerPresent', target: followerName, variableId } };
        const present: EventPageCondition = { kind: 'variable', variableId, op: '==', value: 1 };
        commands = [...(step.lines ?? ['목적지까지 함께 가 주세요.']).map(line => text(line, target.name)),
          { kind: 'addFollower', graphic: target.graphic, name: followerName }, query,
          { kind: 'fork', condition: present, then: [{ kind: 'setSwitch', switchId: joined, value: true }], else: [text('동행할 자리가 부족합니다. 동행자를 정리하고 다시 말을 걸어 주세요.')] }];
        const map = requireMap(project, step.destination.mapId), destinationId = `ev_${def.key}_destination${index}`;
        const at = placeQuestEvent(project, map, step.destination.x, step.destination.y, { kind: 'interaction', steppable: true, eventId: destinationId, label: '동행 목적지', code: 'quest-escort-impassable', locationId: step.destination.locationId }, counters);
        upsertEventIntoMap(map, event(destinationId, at.x, at.y, 'playerTouch', [
          page(`${destinationId}_arrive`, '도착', [...stepConditions(def, flags, index), switchCond(joined)], [
            query, { kind: 'fork', condition: present, then: [
              { kind: 'removeFollower', name: followerName }, ...finish(flags, index), text('덕분에 무사히 도착했어요.', target.name),
            ], else: [{ kind: 'setSwitch', switchId: joined, value: false }, text('동행자가 없습니다. 출발 지점에서 다시 합류해 주세요.')] },
          ], { transparent: true }, { trigger: 'playerTouch', priority: 'below' }),
          page(`${destinationId}_done`, target.name, [switchCond(stepSwitch)], [text('함께 와 주셔서 고마워요.', target.name)], target.graphic),
        ])); counters.events += 1;
        preservePages(target.event).push(page(`${id}_join`, target.name, [...stepConditions(def, flags, index), switchCond(joined, false)], commands, target.graphic),
          page(`${id}_following`, '동행 중', [switchCond(joined)], [], { transparent: true }, { priority: 'below' }));
        break;
      }
      preservePages(target.event).push(page(`${id}_active`, target.name, stepConditions(def, flags, index), commands, target.graphic),
        page(`${id}_done`, target.name, [switchCond(stepSwitch)], [text('고맙습니다.', target.name)], target.graphic));
      break;
    }
  }
}

function materializeCollectSource(
  project: Project,
  def: QuestDef,
  flags: QuestFlagIds,
  itemId: string,
  count: number,
  countVar: string,
  stepSwitch: string,
  source: CollectSource,
  stepIndex: number,
  sourceIndex: number,
  counters: CompileSink
): void {
  const map = requireMap(project, source.mapId);
  const clearSwitch = `sw_${def.key}_source${stepIndex}_${sourceIndex}`;
  ensureNamedSwitch(project, clearSwitch, `${def.title} 수집원 ${stepIndex}-${sourceIndex}`);
  // count 도달 시 stepSwitch를 세우는 공통 커맨드.
  const grantAndCheck: Command[] = [
    { kind: "changeItem", itemId, op: "+=", amount: 1 },
    { kind: "setVariable", variableId: countVar, op: "+=", value: 1 },
    {
      kind: "fork",
      condition: { kind: "variable", variableId: countVar, op: ">=", value: count },
      then: [
        { kind: "setSwitch", switchId: stepSwitch, value: true },
        { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
      ],
    },
  ];
  if (source.kind === "pickup") {
    const id = `ev_${def.key}_pick${stepIndex}_${sourceIndex}`;
    const look = page(`${id}_look`, "빛나는 것", [], [text(source.lookText ?? "무언가 반짝인다.")], { transparent: true }, {
      trigger: "action",
      priority: "below",
    });
    const pick = page(`${id}_pick`, "습득", stepConditions(def, flags, stepIndex), [
      text("조심스럽게 손에 넣었다."),
      ...grantAndCheck,
      { kind: "setSwitch", switchId: clearSwitch, value: true },
    ], { transparent: true }, { priority: "below" });
    const empty = page(`${id}_empty`, "빈 자리", [switchCond(clearSwitch)], [], { transparent: true }, { priority: "below" });
    // 투명 action 트리거 습득물 — 벽 위(선반·틈) 허용, 대신 인접 칸에서 조사할 수 있어야 한다.
    const at = placeQuestEvent(project, map, source.x, source.y, {
      kind: "interaction",
      label: "수집물",
      code: "quest-pickup-impassable",
      eventId: id,
      ...(source.locationId === undefined ? {} : { locationId: source.locationId }),
    }, counters);
    upsertEventIntoMap(map, event(id, at.x, at.y, "action", [look, pick, empty]));
    counters.events += 1;
  } else {
    // drop: 전투 블로커가 승리 시 아이템 지급 + 카운트.
    const id = `ev_${def.key}_drop${stepIndex}_${sourceIndex}`;
    const graphic = graphicFromQuery(source.graphicQuery ?? "몬스터");
    const fight = page(`${id}_fight`, "전투", stepConditions(def, flags, stepIndex), [
      text("적이 나타났다!"),
      { kind: "battleProcessing", troopId: source.troopId, canEscape: true, canLose: false },
      {
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
        then: [
          { kind: "setSwitch", switchId: clearSwitch, value: true },
          ...grantAndCheck,
        ],
      },
    ], graphic);
    const cleared = page(`${id}_cleared`, "정리됨", [switchCond(clearSwitch)], [], { transparent: true }, { priority: "below" });
    const idle = page(`${id}_idle`, "휴식", [], [text("조용하다.")], graphic);
    // drop 소스도 몬스터 스프라이트가 서 있는 캐릭터형 이벤트다.
    const at = placeQuestEvent(project, map, source.x, source.y, {
      kind: "character",
      label: "드롭 전투",
      code: "quest-drop-impassable",
      eventId: id,
      ...(source.locationId === undefined ? {} : { locationId: source.locationId }),
    }, counters);
    upsertEventIntoMap(map, event(id, at.x, at.y, "action", [idle, fight, cleared]));
    counters.events += 1;
  }
}

// 기버 NPC의 제안/진행/턴인/완료 페이지를 조립한다.
function buildGiverEvent(project: Project, def: QuestDef, flags: QuestFlagIds, sink: CompileSink): GameEvent {
  const isCreate = "create" in def.giver;
  const spec = isCreate ? (def.giver as { create: QuestNpcSpec }).create : null;
  const map = requireMap(project, isCreate ? spec!.mapId : (def.giver as { mapId: string }).mapId);
  const graphic: EventPageGraphic = isCreate ? npcGraphic(spec!) : (findGiverGraphic(map, (def.giver as { eventId: string }).eventId) ?? { transparent: true });
  const giverName = isCreate ? spec!.name : "의뢰인";
  const id = isCreate ? `ev_${def.key}_giver` : (def.giver as { eventId: string }).eventId;

  // 턴인 조건: 모든 stepSwitch가 true → 보상 지급 + done.
  const rewardCommands: Command[] = [];
  const returned = ['lost_item','gather','repeatable_contract'].includes(def.presetId ?? '') && def.steps[0]?.kind === 'collect'
    ? { itemId: def.steps[0].itemId, count: def.steps[0].count } : undefined;
  if (def.rewards?.gold) rewardCommands.push({ kind: "changeGold", op: "+=", amount: def.rewards.gold });
  for (const reward of def.rewards?.items ?? []) rewardCommands.push({ kind: "changeItem", itemId: reward.itemId, op: "+=", amount: reward.count });
  rewardCommands.push({ kind: "setSwitch", switchId: flags.done, value: true });
  rewardCommands.push(...effects(project, def.effects));
  rewardCommands.push(text(def.dialogue?.completed ?? `의뢰 '${def.title}'을 완수했다!`, giverName));

  // 모든 단계 완료 여부를 중첩 fork로 검사.
  const allDone: Command = flags.stepSwitches.reduceRight<Command>(
    (inner, switchId) => ({
      kind: "fork",
      condition: { kind: "switch", switchId, value: true },
      then: [inner],
      else: [text(def.dialogue?.reminder ?? "아직 할 일이 남은 것 같군.", giverName)],
    }),
    { kind: "fork", condition: { kind: "switch", switchId: flags.done, value: false }, then: returned
      ? paid(project, `${def.key}_report`, { items: [returned] }, rewardCommands, sink) : rewardCommands } as Command
  );

  const accept: Command[] = [{ kind: 'setSwitch', switchId: flags.started, value: true },
    ...(def.onAcceptItems ?? []).map(item => ({ kind: 'changeItem' as const, itemId: item.itemId, op: '+=' as const, amount: item.count })),
    text(def.dialogue?.accepted ?? '고맙네! 잘 부탁하지.', giverName)];
  const prerequisites = (def.requiresQuestKeys ?? []).map(key => switchCond(questFlagIds(key, 0).done));
  const proposal = page(`${id}_offer`, giverName, prerequisites, [
    text(def.summary, giverName),
    {
      kind: "choices",
      prompt: `의뢰 '${def.title}'을 수락할까요?`,
      options: [
        { text: "수락한다", branch: accept },
        { text: "다음에", branch: [text(def.dialogue?.declined ?? "마음이 바뀌면 다시 오게.", giverName)] },
      ],
      cancelBehavior: "choice2",
    },
  ], graphic);
  const active = page(`${id}_active`, giverName, [switchCond(flags.started)], [allDone], graphic);
  const doneCommands: Command[] = [text(def.dialogue?.afterComplete ?? '자네 덕분에 살았어. 정말 고맙네.', giverName)];
  if (def.repeatable) {
    const reset: Command[] = [{ kind: 'setSwitch', switchId: flags.done, value: false },
      ...flags.stepSwitches.map(switchId => ({ kind: 'setSwitch' as const, switchId, value: false })),
      { kind: 'setVariable', variableId: flags.progress, op: '=', value: 0 }];
    def.steps.forEach((step, i) => {
      if (step.kind === 'collect') { reset.push({ kind: 'setVariable', variableId: `var_${def.key}_c${i}`, op: '=', value: 0 });
        step.sources.forEach((_, j) => reset.push({ kind: 'setSwitch', switchId: `sw_${def.key}_source${i}_${j}`, value: false })); }
      if (step.kind === 'escort') reset.push({ kind: 'setSwitch', switchId: `sw_${def.key}_escort${i}`, value: false });
      if (step.kind === 'choice') reset.push({ kind: 'setVariable', variableId: `var_${def.key}_choice${i}`, op: '=', value: 0 });
    });
    doneCommands.push({ kind: 'choices', prompt: '이 의뢰를 다시 수행할까요?', cancelBehavior: 'choice2', options: [
      { text: '다시 수락한다', branch: [...reset, ...accept] }, { text: '다음에', branch: [] },
    ] });
  }
  const done = page(`${id}_done`, giverName, [switchCond(flags.done)], doneCommands, graphic);
  const unavailable = page(`${id}_unavailable`, giverName, [], [text('먼저 앞선 의뢰를 마쳐 주세요.', giverName)], graphic);

  if (isCreate) {
    // 기버는 말을 걸어야 하는 캐릭터형 NPC — 통행 가능 칸에 서야 한다.
    const at = placeQuestEvent(project, map, spec!.x, spec!.y, {
      kind: "character",
      label: `퀘스트 기버 '${giverName}'`,
      code: "quest-giver-impassable",
      eventId: id,
    }, sink);
    const giverEvent = event(id, at.x, at.y, "action", [...(prerequisites.length ? [unavailable] : []), proposal, active, done]);
    upsertEventIntoMap(map, giverEvent);
    return giverEvent;
  }
  // 기존 이벤트에 페이지 병합.
  const existing = map.events.find((entry) => entry.id === id);
  if (!existing) throw new QuestCompileError(`기버 이벤트가 없습니다: ${id}`);
  existing.pages = [...preservePages(existing), ...(prerequisites.length ? [unavailable] : []), proposal, active, done];
  return existing;
}

function findGiverGraphic(map: GameMap, eventId: string): EventPageGraphic | null {
  const target = map.events.find((entry) => entry.id === eventId);
  return target?.pages?.[0]?.graphic ?? null;
}

// 게이트: 특정 단계 완료 전까지 lockedText로 막고, 완료 후 통과 가능(투명·하단).
function buildGate(project: Project, def: QuestDef, flags: QuestFlagIds, gate: QuestGate, gateIndex: number, sink: CompileSink): void {
  const map = requireMap(project, gate.mapId);
  const stepSwitch = flags.stepSwitches[gate.requiresStep];
  if (!stepSwitch) throw new QuestCompileError(`gate.requiresStep 범위 오류: ${gate.requiresStep}`);
  const id = `ev_${def.key}_gate${gateIndex}`;
  const locked = page(`${id}_locked`, "잠긴 길", [], [text(gate.lockedText)], { transparent: true }, { trigger: "playerTouch", priority: "same" });
  const open = page(`${id}_open`, "열린 길", [switchCond(stepSwitch)], [], { transparent: true }, { trigger: "playerTouch", priority: "below" });
  // 잠긴 페이지는 priority "same"(차단 이벤트)이다. 플레이어는 이 칸을 밟지 못하고 옆 칸에서
  // 부딪혀 발동시키므로 계약상 steppable이 아니다 → kind "interaction"(벽 위 허용, 도달 가능만 요구).
  const at = placeQuestEvent(project, map, gate.x, gate.y, {
    ...(gate.locationId === undefined ? {} : { locationId: gate.locationId }),
    kind: "interaction",
    label: "퀘스트 게이트",
    code: "quest-gate-impassable",
    eventId: id,
  }, sink);
  // 다만 해금 후의 open 페이지는 통과를 전제한다. 최종 칸이 통행 불가면 열려도 지나갈 수 없으니
  // 좌표는 저작 의도대로 두고 경고로만 알린다.
  if (!isPassable(project, map, at.x, at.y)) {
    sink.warnings.push(`퀘스트 게이트가 통행 불가 칸에 있습니다: (${at.x}, ${at.y}) — 해금 후에도 지나갈 수 없습니다.`);
  }
  upsertEventIntoMap(map, event(id, at.x, at.y, "playerTouch", [locked, open]));
}

// QuestDef를 draft에 컴파일한다.
export function compileQuest(project: Project, def: QuestDef): QuestCompileResult {
  try { validateQuestReferences(project, def); } catch (cause) { throw new QuestCompileError(cause instanceof Error ? cause.message : String(cause)); }
  const presetIssue = questPresetIssue(project, def);
  if (presetIssue) throw new QuestCompileError(presetIssue);
  if (!isValidQuestKey(def.key)) throw new QuestCompileError(`questKey는 영문/숫자/밑줄만 허용합니다: ${def.key}`);
  if (def.steps.length === 0) throw new QuestCompileError("퀘스트에는 최소 1개의 단계가 필요합니다.");
  const flags = questFlagIds(def.key, def.steps.length);

  // 1) 플래그 등록.
  ensureNamedSwitch(project, flags.started, `${def.title} 시작`);
  ensureNamedSwitch(project, flags.done, `${def.title} 완료`);
  ensureNamedVariable(project, flags.progress, `${def.title} 진행도`);
  for (let i = 0; i < flags.stepSwitches.length; i += 1) {
    ensureNamedSwitch(project, flags.stepSwitches[i], `${def.title} 단계 ${i}`);
  }
  let switchesRegistered = 2 + flags.stepSwitches.length;

  const counters: CompileSink = { events: 0, variables: 1, warnings: [] };

  // 2) 단계별 이벤트/조건 생성.
  def.steps.forEach((step, index) => materializeStep(project, def, flags, step, index, counters));

  // 3) 기버 페이지.
  buildGiverEvent(project, def, flags, counters);
  counters.events += 1;

  // 4) 게이트.
  (def.gates ?? []).forEach((gate, index) => {
    buildGate(project, def, flags, gate, index, counters);
    counters.events += 1;
  });

  for (const [i, change] of (def.worldChanges ?? []).entries()) {
    const target = requireMap(project, change.target.mapId).events.find(event => event.id === change.target.eventId)!;
    const base = preservePages(target)[0];
    const changed = page(`${target.id}_${def.key}_world${i}`, base.name ?? '변화', [switchCond(flags.done)], change.lines.map(line => text(line)), base.graphic ?? { transparent: true }, { priority: change.passable ? 'below' : base.priority });
    target.pages!.push(changed);
  }

  // 5) 메타 보존.
  project.quests = [...(project.quests ?? []).filter((quest) => questDefId(quest) !== def.key), def];

  // drop 소스가 만든 클리어 스위치까지 대략 반영(정확 카운트는 중요치 않음).
  switchesRegistered += def.steps.filter((step) => step.kind === "collect").reduce((sum, step) => sum + (step.kind === "collect" ? step.sources.filter((s) => s.kind === "drop").length : 0), 0);

  return {
    flags,
    eventsCreated: counters.events,
    switchesRegistered,
    variablesRegistered: counters.variables,
    warnings: counters.warnings,
  };
}
