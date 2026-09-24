// editor/tools/investigationTools.ts
// 이브/마녀의 집식 조사 밀도와 방 단위 퍼즐을 안전하게 대량 저작하는 툴.

import { compileCutscene, CutsceneValidationError, type CutsceneBeat } from "@/editor/cutscene";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, GameEvent, GameMap, Project, Trigger } from "@/project/types";
import { withJosa } from "@/util/josa";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { inMapBounds, requireMap, type Point } from "./mapHelpers";
import { examineMarkGraphic, resolveGraphic, type GraphicSpec } from "./eventCompile";
import { resolveEventPlacement } from "./eventTools";
import { splitSpeakerPrefix } from "./mysteryCaseTool";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { COORD_SCHEMA, CUTSCENE_BEAT_SCHEMA, GRAPHIC_SPEC_SCHEMA } from "./schemaShapes";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const TRANSPARENT: EventPageGraphic = { transparent: true };
/** 그림 없는 조사 지점의 표식. 주민을 세우면 물건이 사람이 된다(2026-09-24 회상 스토리, 메멘토 12개 전부 투명). */
function mementoMark(): EventPageGraphic {
  return examineMarkGraphic();
}
const SELF_ONCE_KEY = "A";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pointFromRecord(value: unknown, label: string): Point {
  if (!isRecord(value)) throw new ToolError(`${label}는 {x,y} 객체여야 합니다.`, { code: "invalid-point" });
  if (typeof value.x !== "number" || typeof value.y !== "number") {
    throw new ToolError(`${label}.x/y 숫자가 필요합니다.`, { code: "invalid-point" });
  }
  return { x: Math.trunc(value.x), y: Math.trunc(value.y) };
}

function cleanName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function safeIdSegment(value: string): string {
  const segment = value.trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  return segment.length > 0 ? segment : "puzzle";
}

function uniqueEventId(used: Set<string>, base: string): string {
  const clean = safeIdSegment(base);
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${clean}_${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  throw new ToolError(`이벤트 id를 만들 수 없습니다: ${base}`, { code: "event-id-exhausted" });
}

function cellKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function existingEventCells(map: GameMap): Set<string> {
  return new Set(map.events.map((event) => `${event.x},${event.y}`));
}

function assertEventShape(event: GameEvent): void {
  try {
    validateCommandArray(`${event.id}.commands`, event.commands);
    for (const page of event.pages ?? []) validateCommandArray(`${event.id}.${page.id}.commands`, page.commands);
  } catch (cause) {
    throw new ToolError(`이벤트 형식이 올바르지 않습니다: ${cause instanceof Error ? cause.message : String(cause)}`, {
      code: "event-shape",
    });
  }
}

function page(input: {
  readonly id: string;
  readonly name: string;
  readonly conditions?: readonly EventPageCondition[];
  readonly graphic?: EventPageGraphic;
  readonly trigger?: Trigger;
  readonly priority?: EventPage["priority"];
  readonly commands?: readonly Command[];
}): EventPage {
  const priority = input.priority ?? "below";
  return {
    id: input.id,
    name: input.name,
    conditions: [...(input.conditions ?? [])],
    graphic: input.graphic ?? TRANSPARENT,
    trigger: input.trigger ?? { kind: "action" },
    priority,
    overlapForbidden: priority === "same",
    animationType: "fixedGraphic",
    movement: PASSIVE,
    commands: [...(input.commands ?? [])],
  };
}

function textCommands(lines: unknown, speaker?: string): Command[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((line): line is string => typeof line === "string" && line.length > 0)
    .map((body) => {
      const split = splitSpeakerPrefix(body);
      const who = split.speaker ?? speaker;
      return who ? { kind: "text", speaker: who, body: split.body } : { kind: "text", body: split.body };
    });
}

function graphicFromUnknown(value: unknown): EventPageGraphic {
  // null 은 투명 명시. 생략은 빈 바닥이라 보석 표식을 붙인다.
  if (value === undefined) return mementoMark();
  if (value === null) return TRANSPARENT;
  if (!isRecord(value)) throw new ToolError("graphic은 {query} 또는 {textureKey,characterIndex} 객체/null이어야 합니다.", { code: "graphic-shape" });
  return resolveGraphic(value as GraphicSpec);
}

function compileBeats(
  project: Project,
  map: GameMap,
  eventIds: ReadonlySet<string>,
  beats: unknown,
  label: string
): Command[] {
  if (beats === undefined) return [];
  if (!Array.isArray(beats)) throw new ToolError(`${label}는 CutsceneBeat 배열이어야 합니다.`, { code: "cutscene-beats" });
  try {
    return compileCutscene(beats as CutsceneBeat[], {
      context: { eventIds, resourceIds: collectResourceIds(project) },
    });
  } catch (cause) {
    if (cause instanceof CutsceneValidationError) {
      throw new ToolError(`${label} 검증 실패: ${cause.reasons.join(" / ")}`, { code: "cutscene-validation", mapId: map.id });
    }
    throw cause;
  }
}

function mapEventIds(map: GameMap, extra: readonly string[] = []): Set<string> {
  return new Set([...map.events.map((event) => event.id), ...extra]);
}

function databaseItemName(project: Project, itemId: string): string | null {
  return project.database.items.find((item) => item.id === itemId)?.name ?? null;
}

function requireExistingItem(project: Project, itemId: string, label: string): void {
  if (project.database.items.some((item) => item.id === itemId)) return;
  throw new ToolError(`${label}가 DB에 존재하지 않습니다: ${itemId}`, { code: "item-not-found" });
}

function commandsForHotspot(project: Project, map: GameMap, hotspot: RecordValue, eventId: string): Command[] {
  const name = cleanName(hotspot.name, "조사");
  const commands: Command[] = [...textCommands(hotspot.lines, name)];
  commands.push(...compileBeats(project, map, mapEventIds(map, [eventId]), hotspot.beats, `${name}.beats`));
  if (typeof hotspot.itemId === "string" && hotspot.itemId.trim().length > 0) {
    const itemId = hotspot.itemId.trim();
    requireExistingItem(project, itemId, `${name}.itemId`);
    const itemName = databaseItemName(project, itemId) ?? itemId;
    commands.push({ kind: "changeItem", itemId, op: "+=", amount: 1 });
    commands.push({ kind: "text", body: `${withJosa(itemName, "을/를")} 얻었다.` });
  }
  if (typeof hotspot.setSwitch === "string" && hotspot.setSwitch.trim().length > 0) {
    const switchId = hotspot.setSwitch.trim();
    ensureNamedSwitch(project, switchId, `조사: ${name}`);
    commands.push({ kind: "setSwitch", switchId, value: true });
  }
  if (hotspot.once === true) commands.push({ kind: "setSelfSwitch", key: SELF_ONCE_KEY, value: true });
  return commands;
}

const placeExamineHotspots: ToolDefinition = {
  name: "place_examine_hotspots",
  description:
    "조사 핫스팟을 한 번에 여러 개 배치한다. 각 항목은 {at:{x,y},name,lines?,beats?,once?,itemId?,setSwitch?,graphic?}.  「조사」「살펴보기」 지점 요청의 정본. 이브식 갤러리 방 전체는 make_gallery_room." +
    " graphic 을 생략하면 빈 바닥 위에 보석 표식(object2)을 붙인다. 투명이 의도라면 graphic:{transparent:true}. 좌표 중복/기존 이벤트 겹침/맵 밖/개별 참조 오류는 해당 항목만 skip하고 warning으로 반환한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      hotspots: {
        type: "array",
        description: "{at:{x,y},name,lines?,beats?,once?,itemId?,setSwitch?,graphic?}[]",
        items: {
          type: "object",
          properties: {
            at: COORD_SCHEMA,
            name: { type: "string" },
            lines: { type: "array", items: { type: "string" } },
            beats: { type: "array", items: CUTSCENE_BEAT_SCHEMA },
            once: { type: "boolean" },
            itemId: { type: "string" },
            setSwitch: { type: "string" },
            graphic: GRAPHIC_SPEC_SCHEMA,
          },
          required: ["at"],
        },
      },
    },
    required: ["mapId", "hotspots"],
  },
  invalidArgsExample: {
    mapId: "map1",
    hotspots: [{ at: { x: 4, y: 5 }, name: "낡은 액자", lines: ["먼지가 쌓여 있다."], once: true }],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const hotspots = Array.isArray(args.hotspots) ? args.hotspots : [];
    const occupied = existingEventCells(map);
    const usedIds = new Set(map.events.map((event) => event.id));
    const warnings: string[] = [];
    const eventIds: string[] = [];
    let skipped = 0;
    const invisible: string[] = [];
    const marked: string[] = [];

    hotspots.forEach((raw, index) => {
      try {
        if (!isRecord(raw)) throw new ToolError(`hotspots[${index}]는 객체여야 합니다.`, { code: "hotspot-shape" });
        const at = pointFromRecord(raw.at, `hotspots[${index}].at`);
        const name = cleanName(raw.name, `조사 ${index + 1}`);
        if (!inMapBounds(map, at.x, at.y)) {
          skipped += 1;
          warnings.push(`hotspots[${index}] '${name}' skip: 맵 밖 좌표 (${at.x}, ${at.y})`);
          return;
        }
        const key = cellKey(at);
        if (occupied.has(key)) {
          skipped += 1;
          warnings.push(`hotspots[${index}] '${name}' skip: 좌표 중복/기존 이벤트 겹침 (${at.x}, ${at.y})`);
          return;
        }
        // 벽 위 조사(문·액자)는 RM2K3 의미대로 허용하되, 사방이 막혀 접근 자체가 불가능한 칸은
        // 근처 통행 가능 칸으로 착지시킨다. 반경 3까지 전부 막히면 ToolError → 아래 catch 가 skip 처리.
        const landing = resolveEventPlacement(draft, map, at.x, at.y, {
          kind: "interaction",
          label: `조사 핫스팟 '${name}'`,
          code: "hotspot-impassable",
        });
        if (landing.adjusted) {
          warnings.push(`hotspots[${index}] '${name}' 위치 자동 조정: (${at.x}, ${at.y}) → (${landing.x}, ${landing.y})`);
        }
        const placementKey = cellKey(landing);
        const eventId = uniqueEventId(usedIds, `ev_examine_${index + 1}`);
        const graphic = graphicFromUnknown(raw.graphic);
        if (raw.graphic === undefined) marked.push(name);
        const commands = commandsForHotspot(draft, map, raw, eventId);
        const pages = raw.once === true
          ? [
              page({
                id: `${eventId}_once`,
                name,
                conditions: [{ kind: "selfSwitch", key: SELF_ONCE_KEY, value: false }],
                graphic,
                commands,
              }),
              page({
                id: `${eventId}_done`,
                name: `${name} 재조사`,
                conditions: [{ kind: "selfSwitch", key: SELF_ONCE_KEY, value: true }],
                graphic: TRANSPARENT,
                commands: [],
              }),
            ]
          : [page({ id: `${eventId}_page`, name, graphic, commands })];
        const event: GameEvent = {
          id: eventId,
          x: landing.x,
          y: landing.y,
          trigger: { kind: "action" },
          commands: [],
          pages,
        };
        assertEventShape(event);
        map.events.push(event);
        occupied.add(placementKey);
        eventIds.push(eventId);
        // 그림도 없고 그 칸 윗층에 물건 타일도 없으면 플레이어 눈에는 빈 바닥이다 — 회상 스토리 도그푸딩에서
        // 메멘토 9개가 전부 이랬다(무엇을 조사할지 보이지 않아 모든 칸에서 버튼을 눌러야 한다).
        const visibleGraphic = graphic.transparent !== true && (graphic.sprite !== undefined || graphic.appearanceId !== undefined);
        const propUnder = (map.upperTiles[landing.y * map.width + landing.x] ?? -1) > 0;
        if (!visibleGraphic && !propUnder) invisible.push(name);
      } catch (cause) {
        skipped += 1;
        const message = cause instanceof Error ? cause.message : String(cause);
        warnings.push(`hotspots[${index}] skip: ${message}`);
      }
    });

    if (marked.length > 0) {
      warnings.push(
        `그림 없는 조사 지점 ${marked.length}개(${marked.join(", ")})에 보석 표식을 붙였습니다 — 물건에 맞는 그림은 hotspots[].graphic({query:\"…\"}) 또는 그 칸의 소품 타일로 바꾸세요.`,
      );
    }
    if (invisible.length > 0) {
      warnings.push(
        `보이지 않는 조사 지점 ${invisible.length}개(${invisible.join(", ")}): 그림이 없고 그 칸에 물건 타일도 없어 플레이어에게는 빈 바닥이다 — `
          + "place_props·paint_tiles 로 그 칸에 물건을 놓거나 hotspots[].graphic({query:\"…\"} 또는 charset)을 주세요.",
      );
    }
    return {
      summary: `${map.name}에 조사 핫스팟 ${eventIds.length}개 생성, ${skipped}개 스킵${invisible.length ? ` — 그중 ${invisible.length}개는 빈 바닥 위 투명(보이지 않음)` : ""}`,
      data: { created: eventIds.length, skipped, eventIds },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

type OnSolveCompile = {
  readonly solveSwitchId: string;
  readonly commands: readonly Command[];
};

function onSolveCommands(
  project: Project,
  map: GameMap,
  puzzleId: string,
  value: unknown,
  eventIds: ReadonlySet<string>
): OnSolveCompile {
  const record = isRecord(value) ? value : {};
  const segment = safeIdSegment(puzzleId);
  const solveSwitchId = typeof record.setSwitch === "string" && record.setSwitch.trim().length > 0
    ? record.setSwitch.trim()
    : `sw_${segment}_solved`;
  ensureNamedSwitch(project, solveSwitchId, `퍼즐 해결: ${puzzleId}`);
  const commands: Command[] = [];
  if (typeof record.message === "string" && record.message.length > 0) commands.push({ kind: "text", body: record.message });
  commands.push(...compileBeats(project, map, eventIds, record.beats, `${puzzleId}.onSolve.beats`));
  commands.push({ kind: "setSwitch", switchId: solveSwitchId, value: true });
  return { solveSwitchId, commands };
}

function rejectIfEventOverlap(map: GameMap, points: readonly Point[], label: string): void {
  const occupied = existingEventCells(map);
  const seen = new Set<string>();
  for (const point of points) {
    if (!inMapBounds(map, point.x, point.y)) {
      throw new ToolError(`${label}: 맵 밖 좌표입니다 (${point.x}, ${point.y})`, { code: "puzzle-out-of-bounds", mapId: map.id, x: point.x, y: point.y });
    }
    const key = cellKey(point);
    if (seen.has(key)) {
      throw new ToolError(`${label}: 퍼즐 내부 좌표가 중복됩니다 (${point.x}, ${point.y})`, { code: "puzzle-duplicate-cell", mapId: map.id, x: point.x, y: point.y });
    }
    if (occupied.has(key)) {
      throw new ToolError(`${label}: 기존 이벤트와 좌표가 겹칩니다 (${point.x}, ${point.y})`, { code: "puzzle-event-overlap", mapId: map.id, x: point.x, y: point.y });
    }
    seen.add(key);
  }
}

function wrongSequenceCommands(variableId: string, reset: boolean): Command[] {
  return [
    { kind: "text", body: "순서가 틀렸다. 처음부터 다시 해야 한다." },
    ...(reset ? [{ kind: "setVariable", variableId, op: "=", value: 0 } as Command] : []),
  ];
}

function sequenceBranchCommands(input: {
  readonly steps: readonly number[];
  readonly orderLength: number;
  readonly variableId: string;
  readonly solveCommands: readonly Command[];
  readonly reset: boolean;
}): Command[] {
  const build = (offset: number): Command[] => {
    const step = input.steps[offset];
    if (step === undefined) return wrongSequenceCommands(input.variableId, input.reset);
    const success: Command[] = step === input.orderLength - 1
      ? [
          { kind: "setVariable", variableId: input.variableId, op: "=", value: input.orderLength },
          ...input.solveCommands,
        ]
      : [
          { kind: "setVariable", variableId: input.variableId, op: "=", value: step + 1 },
          { kind: "text", body: "어딘가에서 작은 소리가 났다." },
        ];
    return [
      {
        kind: "fork",
        condition: { kind: "variable", variableId: input.variableId, op: "==", value: step },
        then: success,
        else: build(offset + 1),
      },
    ];
  };
  return build(0);
}

function compileSwitchSequence(draft: Project, map: GameMap, args: RecordValue): ToolExecResult {
  const puzzleId = cleanName(args.puzzleId, "switch_sequence");
  const segment = safeIdSegment(puzzleId);
  const nodes = Array.isArray(args.nodes) ? args.nodes : [];
  const order = Array.isArray(args.order) ? args.order : [];
  if (nodes.length === 0) throw new ToolError("switch-sequence nodes가 비어 있습니다.", { code: "puzzle-nodes-empty" });
  if (order.length === 0) throw new ToolError("switch-sequence order가 비어 있습니다.", { code: "puzzle-order-empty" });
  const parsedNodes = nodes.map((raw, index) => {
    if (!isRecord(raw)) throw new ToolError(`nodes[${index}]는 객체여야 합니다.`, { code: "puzzle-node-shape" });
    return {
      at: pointFromRecord(raw.at, `nodes[${index}].at`),
      name: cleanName(raw.name, `순서 장치 ${index + 1}`),
    };
  });
  const parsedOrder = order.map((value, index) => {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new ToolError(`order[${index}]는 정수 인덱스여야 합니다.`, { code: "puzzle-order-index" });
    }
    if (value < 0 || value >= parsedNodes.length) {
      throw new ToolError(`order[${index}] 인덱스가 nodes 범위를 벗어납니다: ${value}`, { code: "puzzle-order-range" });
    }
    return value;
  });
  rejectIfEventOverlap(map, parsedNodes.map((node) => node.at), "switch-sequence");

  const warnings: string[] = [];
  const reserved = new Set<string>();
  const placedNodes: Array<(typeof parsedNodes)[number] & { readonly originalIndex: number; readonly x: number; readonly y: number }> = [];
  let skipped = 0;
  let reportedSkipped = 0;
  parsedNodes.forEach((node, index) => {
    try {
      const landing = resolveEventPlacement(draft, map, node.at.x, node.at.y, {
        kind: "interaction",
        reserved,
        label: `switch-sequence 노드 '${node.name}'`,
        code: "puzzle-node-impassable",
      });
      if (landing.adjusted) {
        warnings.push(`nodes[${index}] '${node.name}' 위치 자동 조정: (${node.at.x}, ${node.at.y}) → (${landing.x}, ${landing.y})`);
      }
      placedNodes.push({ ...node, originalIndex: index, x: landing.x, y: landing.y });
      reserved.add(`${landing.x},${landing.y}`);
    } catch (cause) {
      if (!(cause instanceof ToolError)) throw cause;
      skipped += 1;
      if (reportedSkipped < 5) {
        warnings.push(`nodes[${index}] '${node.name}' skip: ${cause.message}`);
        reportedSkipped += 1;
      }
    }
  });
  if (skipped > 0) warnings.push(`switch-sequence 노드 총 ${skipped}개 skip`);

  const placedIndexes = new Set(placedNodes.map((node) => node.originalIndex));
  const placedOrder = parsedOrder.filter((nodeIndex) => placedIndexes.has(nodeIndex));
  const usedIds = new Set(map.events.map((event) => event.id));
  const eventIds = placedNodes.map((node) => uniqueEventId(usedIds, `ev_${segment}_seq_${node.originalIndex + 1}`));
  const solve = onSolveCommands(draft, map, puzzleId, args.onSolve, mapEventIds(map, eventIds));
  const variableId = `var_${segment}_step`;
  ensureNamedVariable(draft, variableId, `퍼즐 진행도: ${puzzleId}`);
  const reset = args.reset !== false;
  const events: GameEvent[] = placedNodes.map((node, nodeIndex) => {
    const eventId = eventIds[nodeIndex] as string;
    const steps = placedOrder.flatMap((entry, step) => entry === node.originalIndex ? [step] : []);
    const commands = sequenceBranchCommands({
      steps,
      orderLength: placedOrder.length,
      variableId,
      solveCommands: solve.commands,
      reset,
    });
    return {
      id: eventId,
      x: node.x,
      y: node.y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        page({
          id: `${eventId}_active`,
          name: node.name,
          conditions: [{ kind: "switch", switchId: solve.solveSwitchId, value: false }],
          commands,
        }),
        page({
          id: `${eventId}_solved`,
          name: `${node.name} 해결 후`,
          conditions: [{ kind: "switch", switchId: solve.solveSwitchId, value: true }],
          commands: [],
        }),
      ],
    };
  });
  for (const event of events) {
    assertEventShape(event);
    map.events.push(event);
  }
  return {
    summary: `${map.name}에 switch-sequence 퍼즐 '${puzzleId}' 컴파일 — 노드 ${events.length}개, 순서 ${placedOrder.length}단계, ${skipped}개 스킵`,
    data: { created: events.length, skipped, puzzleId, kind: "switch-sequence", eventIds, variableId, solveSwitchId: solve.solveSwitchId },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function passwordWrongCommands(variableId: string | undefined, reset: boolean): Command[] {
  return [
    { kind: "text", body: "암호가 틀렸다." },
    ...(variableId && reset ? [{ kind: "setVariable", variableId, op: "=", value: 0 } as Command] : []),
  ];
}

function canUseInputNumber(answer: string): boolean {
  return /^(0|[1-9]\d*)$/.test(answer) && answer.length >= 1 && answer.length <= 6;
}

function passwordChoiceOptions(answer: string, position: number): string[] {
  const correct = answer[position] as string;
  const pool = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ가나다라마바사아자차카타파하";
  const options = [correct];
  for (const char of pool) {
    if (options.length >= 5) break;
    if (!options.includes(char)) options.push(char);
  }
  return options;
}

function passwordChoiceCommands(answer: string, prompt: string, position: number, solveCommands: readonly Command[], reset: boolean): Command[] {
  if (position >= answer.length) return [...solveCommands];
  const correct = answer[position] as string;
  return [
    {
      kind: "choices",
      prompt: `${prompt} ${position + 1}/${answer.length}`,
      cancelBehavior: "disallow",
      options: passwordChoiceOptions(answer, position).map((char) => ({
        text: char,
        branch: char === correct
          ? passwordChoiceCommands(answer, prompt, position + 1, solveCommands, reset)
          : passwordWrongCommands(undefined, reset),
      })),
    },
  ];
}

function compilePassword(draft: Project, map: GameMap, args: RecordValue): ToolExecResult {
  const puzzleId = cleanName(args.puzzleId, "password");
  const segment = safeIdSegment(puzzleId);
  const at = pointFromRecord(args.at, "password.at");
  rejectIfEventOverlap(map, [at], "password");
  if (typeof args.answer !== "string" || args.answer.length === 0) {
    throw new ToolError("password answer는 비어 있을 수 없습니다.", { code: "puzzle-answer-empty" });
  }
  const answer = args.answer;
  const name = cleanName(args.name, "암호 장치");
  const placement = resolveEventPlacement(draft, map, at.x, at.y, {
    kind: "interaction",
    label: `password '${name}'`,
    code: "puzzle-password-impassable",
  });
  const warnings = placement.adjusted
    ? [`password '${name}' 위치 자동 조정: (${at.x}, ${at.y}) → (${placement.x}, ${placement.y})`]
    : [];
  const prompt = typeof args.prompt === "string" && args.prompt.length > 0 ? args.prompt : "암호를 입력한다.";
  const usedIds = new Set(map.events.map((event) => event.id));
  const eventId = uniqueEventId(usedIds, `ev_${segment}_password`);
  const solve = onSolveCommands(draft, map, puzzleId, args.onSolve, mapEventIds(map, [eventId]));
  const reset = args.reset !== false;
  let commands: Command[];
  let variableId: string | undefined;
  if (canUseInputNumber(answer)) {
    variableId = `var_${segment}_password`;
    ensureNamedVariable(draft, variableId, `암호 입력: ${puzzleId}`);
    commands = [
      { kind: "text", body: prompt },
      { kind: "inputNumber", variableId, digits: answer.length },
      {
        kind: "fork",
        condition: { kind: "variable", variableId, op: "==", value: Number(answer) },
        then: [...solve.commands],
        else: passwordWrongCommands(variableId, reset),
      },
    ];
  } else {
    commands = passwordChoiceCommands(answer, prompt, 0, solve.commands, reset);
  }
  const event: GameEvent = {
    id: eventId,
    x: placement.x,
    y: placement.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      page({
        id: `${eventId}_active`,
        name,
        conditions: [{ kind: "switch", switchId: solve.solveSwitchId, value: false }],
        commands,
      }),
      page({
        id: `${eventId}_solved`,
        name: `${name} 해결 후`,
        conditions: [{ kind: "switch", switchId: solve.solveSwitchId, value: true }],
        commands: [],
      }),
    ],
  };
  assertEventShape(event);
  map.events.push(event);
  return {
    summary: `${map.name}에 password 퍼즐 '${puzzleId}' 컴파일 — ${canUseInputNumber(answer) ? "숫자 입력" : "선택지 입력"}`,
    data: { created: 1, skipped: 0, puzzleId, kind: "password", eventIds: [eventId], variableId, solveSwitchId: solve.solveSwitchId },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function compileItemGate(draft: Project, map: GameMap, args: RecordValue): ToolExecResult {
  const puzzleId = cleanName(args.puzzleId, "item_gate");
  const segment = safeIdSegment(puzzleId);
  const at = pointFromRecord(args.at, "item-gate.at");
  rejectIfEventOverlap(map, [at], "item-gate");
  if (typeof args.requiredItemId !== "string" || args.requiredItemId.trim().length === 0) {
    throw new ToolError("item-gate requiredItemId가 필요합니다.", { code: "puzzle-required-item" });
  }
  const requiredItemId = args.requiredItemId.trim();
  requireExistingItem(draft, requiredItemId, "item-gate requiredItemId");
  const name = cleanName(args.name, "잠긴 길");
  const placement = resolveEventPlacement(draft, map, at.x, at.y, {
    kind: "interaction",
    label: `item-gate '${name}'`,
    code: "puzzle-item-gate-impassable",
  });
  const warnings = placement.adjusted
    ? [`item-gate '${name}' 위치 자동 조정: (${at.x}, ${at.y}) → (${placement.x}, ${placement.y})`]
    : [];
  const usedIds = new Set(map.events.map((event) => event.id));
  const eventId = uniqueEventId(usedIds, `ev_${segment}_gate`);
  const solve = onSolveCommands(draft, map, puzzleId, args.onSolve, mapEventIds(map, [eventId]));
  const thenCommands: Command[] = [];
  if (typeof args.unlockedMessage === "string" && args.unlockedMessage.length > 0) thenCommands.push({ kind: "text", body: args.unlockedMessage });
  if (args.consumeItem === true) thenCommands.push({ kind: "changeItem", itemId: requiredItemId, op: "-=", amount: 1 });
  thenCommands.push(...solve.commands);
  const elseCommands: Command[] = [{ kind: "text", body: typeof args.lockedMessage === "string" && args.lockedMessage.length > 0 ? args.lockedMessage : "잠겨 있다." }];
  const event: GameEvent = {
    id: eventId,
    x: placement.x,
    y: placement.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      page({
        id: `${eventId}_active`,
        name,
        conditions: [{ kind: "switch", switchId: solve.solveSwitchId, value: false }],
        commands: [
          {
            kind: "fork",
            condition: { kind: "item", itemId: requiredItemId, present: true },
            then: thenCommands,
            else: elseCommands,
          },
        ],
      }),
      page({
        id: `${eventId}_solved`,
        name: `${name} 해결 후`,
        conditions: [{ kind: "switch", switchId: solve.solveSwitchId, value: true }],
        commands: [],
      }),
    ],
  };
  assertEventShape(event);
  map.events.push(event);
  return {
    summary: `${map.name}에 item-gate 퍼즐 '${puzzleId}' 컴파일 — 필요 아이템 ${requiredItemId}`,
    data: { created: 1, skipped: 0, puzzleId, kind: "item-gate", eventIds: [eventId], requiredItemId, solveSwitchId: solve.solveSwitchId },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

function allSwitchesFork(switchIds: readonly string[], onTrue: readonly Command[]): Command[] {
  const build = (index: number): Command[] => {
    const switchId = switchIds[index];
    if (!switchId) return [...onTrue];
    return [
      {
        kind: "fork",
        condition: { kind: "switch", switchId, value: true },
        then: build(index + 1),
        else: [],
      },
    ];
  };
  return build(0);
}

function compilePushSwitches(draft: Project, map: GameMap, args: RecordValue): ToolExecResult {
  const puzzleId = cleanName(args.puzzleId, "push_switches");
  const segment = safeIdSegment(puzzleId);
  if (args.all !== true) throw new ToolError("push-switches는 all:true만 지원합니다.", { code: "puzzle-push-all" });
  const plates = Array.isArray(args.plates) ? args.plates : [];
  if (plates.length === 0) throw new ToolError("push-switches plates가 비어 있습니다.", { code: "puzzle-plates-empty" });
  const parsedPlates = plates.map((raw, index) => {
    if (!isRecord(raw)) throw new ToolError(`plates[${index}]는 객체여야 합니다.`, { code: "puzzle-plate-shape" });
    return pointFromRecord(raw.at, `plates[${index}].at`);
  });
  rejectIfEventOverlap(map, parsedPlates, "push-switches");

  const warnings: string[] = [];
  const reserved = new Set<string>();
  const placedPlates: Array<Point & { readonly originalIndex: number }> = [];
  let skipped = 0;
  let reportedSkipped = 0;
  parsedPlates.forEach((point, index) => {
    try {
      const landing = resolveEventPlacement(draft, map, point.x, point.y, {
        kind: "interaction",
        steppable: true,
        reserved,
        label: `push-switches 발판 ${index + 1}`,
        code: "puzzle-plate-impassable",
      });
      if (landing.adjusted) {
        warnings.push(`plates[${index}] 위치 자동 조정: (${point.x}, ${point.y}) → (${landing.x}, ${landing.y})`);
      }
      placedPlates.push({ x: landing.x, y: landing.y, originalIndex: index });
      reserved.add(`${landing.x},${landing.y}`);
    } catch (cause) {
      if (!(cause instanceof ToolError)) throw cause;
      skipped += 1;
      if (reportedSkipped < 5) {
        warnings.push(`plates[${index}] skip: ${cause.message}`);
        reportedSkipped += 1;
      }
    }
  });
  if (skipped > 0) warnings.push(`push-switches 발판 총 ${skipped}개 skip`);

  const usedIds = new Set(map.events.map((event) => event.id));
  const eventIds = placedPlates.map((plate) => uniqueEventId(usedIds, `ev_${segment}_plate_${plate.originalIndex + 1}`));
  const plateSwitchIds = placedPlates.map((plate) => `sw_${segment}_plate_${plate.originalIndex + 1}`);
  for (const [index, switchId] of plateSwitchIds.entries()) {
    const plateNumber = (placedPlates[index]?.originalIndex ?? index) + 1;
    ensureNamedSwitch(draft, switchId, `발판 ${plateNumber}: ${puzzleId}`);
  }
  const solve = onSolveCommands(draft, map, puzzleId, args.onSolve, mapEventIds(map, eventIds));
  const events = placedPlates.map((point, index): GameEvent => {
    const eventId = eventIds[index] as string;
    const plateSwitchId = plateSwitchIds[index] as string;
    const plateNumber = point.originalIndex + 1;
    return {
      id: eventId,
      x: point.x,
      y: point.y,
      trigger: { kind: "playerTouch" },
      commands: [],
      pages: [
        page({
          id: `${eventId}_fresh`,
          name: `발판 ${plateNumber}`,
          conditions: [
            { kind: "switch", switchId: solve.solveSwitchId, value: false },
            { kind: "selfSwitch", key: SELF_ONCE_KEY, value: false },
          ],
          trigger: { kind: "playerTouch" },
          commands: [
            { kind: "setSelfSwitch", key: SELF_ONCE_KEY, value: true },
            { kind: "setSwitch", switchId: plateSwitchId, value: true },
            ...allSwitchesFork(plateSwitchIds, solve.commands),
          ],
        }),
        page({
          id: `${eventId}_pressed`,
          name: `발판 ${plateNumber} 눌림`,
          conditions: [
            { kind: "switch", switchId: solve.solveSwitchId, value: false },
            { kind: "selfSwitch", key: SELF_ONCE_KEY, value: true },
          ],
          trigger: { kind: "playerTouch" },
          commands: [],
        }),
        page({
          id: `${eventId}_solved`,
          name: `발판 ${plateNumber} 해결 후`,
          conditions: [{ kind: "switch", switchId: solve.solveSwitchId, value: true }],
          trigger: { kind: "playerTouch" },
          commands: [],
        }),
      ],
    };
  });
  for (const event of events) {
    assertEventShape(event);
    map.events.push(event);
  }
  return {
    summary: `${map.name}에 push-switches 퍼즐 '${puzzleId}' 컴파일 — 발판 ${events.length}개, ${skipped}개 스킵`,
    data: { created: events.length, skipped, puzzleId, kind: "push-switches", eventIds, plateSwitchIds, solveSwitchId: solve.solveSwitchId },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

const compilePuzzle: ToolDefinition = {
  name: "compile_puzzle",
  description:
    "선언형 퍼즐을 이벤트로 컴파일한다. 공통 {mapId,puzzleId,kind,onSolve:{setSwitch?,beats?,message?},reset?}. " +
    "kind는 switch-sequence/password/item-gate/push-switches. 컴파일 전 결정적 solvability 검증을 수행하고 위반 시 한국어 사유로 거부한다. " +
    "password 의 answer 가 1~6자리 숫자면 inputNumber 로 받는다. 선택지 보기에 정답 숫자를 적지 말 것.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      puzzleId: { type: "string" },
      kind: { type: "string", enum: ["switch-sequence", "password", "item-gate", "push-switches"] },
      onSolve: {
        type: "object",
        description: "{setSwitch?,beats?,message?}",
        properties: {
          setSwitch: { type: "string" },
          beats: { type: "array", items: CUTSCENE_BEAT_SCHEMA },
          message: { type: "string" },
        },
      },
      reset: { type: "boolean" },
      nodes: {
        type: "array",
        description: "{at:{x,y},name?}[] — switch-sequence 노드",
        items: {
          type: "object",
          properties: { at: COORD_SCHEMA, name: { type: "string" } },
          required: ["at"],
        },
      },
      order: { type: "array", items: { type: "integer" } },
      at: COORD_SCHEMA,
      name: { type: "string" },
      answer: { type: "string" },
      prompt: { type: "string" },
      requiredItemId: { type: "string" },
      consumeItem: { type: "boolean" },
      lockedMessage: { type: "string" },
      unlockedMessage: { type: "string" },
      plates: {
        type: "array",
        description: "{at:{x,y},name?}[] — push-switches 발판",
        items: {
          type: "object",
          properties: { at: COORD_SCHEMA, name: { type: "string" } },
          required: ["at"],
        },
      },
      all: { type: "boolean" },
    },
    required: ["mapId", "puzzleId", "kind", "onSolve"],
  },
  invalidArgsExample: {
    mapId: "map1",
    puzzleId: "gallery_order",
    kind: "switch-sequence",
    nodes: [{ at: { x: 2, y: 2 }, name: "붉은 액자" }],
    order: [0],
    onSolve: { setSwitch: "sw_gallery_open", message: "문 어딘가가 열렸다." },
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const record = args as RecordValue;
    switch (args.kind) {
      case "switch-sequence":
        return compileSwitchSequence(draft, map, record);
      case "password":
        return compilePassword(draft, map, record);
      case "item-gate":
        return compileItemGate(draft, map, record);
      case "push-switches":
        return compilePushSwitches(draft, map, record);
      default:
        throw new ToolError(`지원하지 않는 퍼즐 kind입니다: ${String(args.kind)}`, { code: "puzzle-kind" });
    }
  },
};

export const INVESTIGATION_TOOLS: readonly ToolDefinition[] = [placeExamineHotspots, compilePuzzle];
