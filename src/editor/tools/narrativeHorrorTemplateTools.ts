// 투더문/마녀의집/이브 원큐 조립용 장르 템플릿 컴파일러.
// Primitive(script_cutscene, place_trap, compile_puzzle 등)를 한 툴로 묶어
// 에이전트 thrash·순서 꼬임을 줄인다.

import { EVENT_TOOLS } from "./eventTools";
import { INVESTIGATION_TOOLS } from "./investigationTools";
import { LIGHTING_TOOLS } from "./lightingTools";
import { ENDING_TOOLS } from "./endingTools";
import { requireMap } from "./mapHelpers";
import { ensureNamedSwitch } from "./flagHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { Project } from "@/project/types";

const INNER_TOOLS = new Map<string, ToolDefinition>(
  [...EVENT_TOOLS, ...INVESTIGATION_TOOLS, ...LIGHTING_TOOLS, ...ENDING_TOOLS].map((tool) => [tool.name, tool]),
);

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runNamedTool(draft: Project, name: string, args: Record<string, unknown>): ToolExecResult {
  const tool = INNER_TOOLS.get(name);
  if (!tool) throw new ToolError(`내부 툴 없음: ${name}`, { code: "missing-inner-tool" });
  return tool.run(draft, args);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** 컷신 호흡 lint: 대사 전후 wait/camera 최소 규칙 */
function lintCutsceneBeats(beats: readonly RecordValue[]): string[] {
  const warnings: string[] = [];
  if (beats.length === 0) warnings.push("beat가 비어 있습니다.");
  let hasSay = false;
  let hasBreath = false;
  for (const beat of beats) {
    const kind = typeof beat.kind === "string" ? beat.kind : "";
    if (kind === "say") hasSay = true;
    if (kind === "wait" || kind === "camera" || kind === "tint" || kind === "flash") hasBreath = true;
    if (kind === "wait") {
      const ms = typeof beat.ms === "number" ? beat.ms : 0;
      if (ms < 100) warnings.push("wait.ms가 100 미만 — 호흡이 너무 짧습니다.");
    }
    if (kind === "camera") {
      const duration = typeof beat.durationMs === "number" ? beat.durationMs : 0;
      if (duration > 0 && duration < 200) warnings.push("camera.durationMs가 200 미만 — 팬이 너무 짧습니다.");
    }
  }
  if (hasSay && !hasBreath) {
    warnings.push("대사(say)만 있고 wait/camera/tint/flash 호흡 비트가 없습니다.");
  }
  // consecutive say without wait between
  for (let i = 1; i < beats.length; i += 1) {
    const prev = beats[i - 1]!;
    const cur = beats[i]!;
    if (prev.kind === "say" && cur.kind === "say") {
      warnings.push(`연속 say 비트 (${i - 1}→${i}) — 사이에 wait/camera를 넣으세요.`);
      break;
    }
  }
  return warnings;
}

function memoryBeats(speaker: string, lines: readonly string[]): RecordValue[] {
  const beats: RecordValue[] = [
    { kind: "camera", mode: "pan", x: 4, y: 3, durationMs: 700, wait: true },
    { kind: "wait", ms: 250 },
  ];
  for (const [index, line] of lines.entries()) {
    beats.push({ kind: "say", speaker, text: line });
    if (index < lines.length - 1) beats.push({ kind: "wait", ms: 350 });
  }
  beats.push({ kind: "camera", mode: "return", durationMs: 400, wait: true });
  return beats;
}

const scriptCutscenePreset: ToolDefinition = {
  name: "script_cutscene_preset",
  description:
    "투더문식 연출 프리셋 컷신을 한 번에 배치한다. preset=memory_opening|bedside_monologue|ending_fade. " +
    "lines/speaker/endingId를 받아 script_cutscene(+define_ending)으로 컴파일하고 호흡 lint warning을 반환한다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      preset: { type: "string", enum: ["memory_opening", "bedside_monologue", "ending_fade"] },
      eventId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      speaker: { type: "string" },
      lines: { type: "array", items: { type: "string" } },
      endingId: { type: "string", description: "ending_fade일 때 엔딩 id" },
      endingName: { type: "string" },
      endingSwitchId: { type: "string", description: "엔딩 조건 스위치 (기본 sw_ending_<id>)" },
      skippable: { type: "boolean" },
    },
    required: ["mapId", "preset"],
  },
  invalidArgsExample: {
    mapId: "map1",
    preset: "memory_opening",
    speaker: "나",
    lines: ["그날을 기억한다.", "창밖의 달빛."],
    skippable: true,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const preset = cleanString(args.preset, "memory_opening");
    const speaker = cleanString(args.speaker, "나");
    const linesRaw = Array.isArray(args.lines) ? args.lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0) : [];
    const lines =
      linesRaw.length > 0
        ? linesRaw
        : preset === "bedside_monologue"
          ? ["병실 시계 소리만 남았다.", "아직 말하지 못한 이야기가 있다."]
          : preset === "ending_fade"
            ? ["끝이다.", "그래도 기억은 남는다."]
            : ["그날을 기억한다.", "창밖의 달빛."];

    let beats: RecordValue[] = memoryBeats(speaker, lines);
    if (preset === "bedside_monologue") {
      beats = [
        { kind: "tint", color: "#1a2030", durationMs: 600, wait: true },
        { kind: "wait", ms: 300 },
        ...memoryBeats(speaker, lines).filter((b) => b.kind !== "camera" || b.mode !== "pan"),
        { kind: "tint", color: "#ffffff", durationMs: 500, wait: true },
      ];
    } else if (preset === "ending_fade") {
      beats = [
        { kind: "wait", ms: 200 },
        ...memoryBeats(speaker, lines),
        { kind: "tint", color: "#000000", durationMs: 900, wait: true },
        { kind: "wait", ms: 400 },
      ];
    }

    const lint = lintCutsceneBeats(beats);
    const cutsceneArgs: Record<string, unknown> = {
      mapId: map.id,
      beats,
      skippable: args.skippable !== false,
      trigger: preset === "ending_fade" ? "auto" : "action",
    };
    if (typeof args.eventId === "string" && args.eventId.trim()) cutsceneArgs.eventId = args.eventId.trim();
    if (typeof args.x === "number") cutsceneArgs.x = Math.trunc(args.x);
    if (typeof args.y === "number") cutsceneArgs.y = Math.trunc(args.y);

    const cut = runNamedTool(draft, "script_cutscene", cutsceneArgs);
    let endingId: string | undefined;
    if (preset === "ending_fade") {
      endingId = cleanString(args.endingId, "ending_memory");
      const endingName = cleanString(args.endingName, "기억의 끝");
      const switchId = cleanString(args.endingSwitchId, `sw_${endingId}`);
      ensureNamedSwitch(draft, switchId, `엔딩: ${endingName}`);
      runNamedTool(draft, "define_ending", {
        id: endingId,
        name: endingName,
        priority: 10,
        conditions: [{ kind: "switch", switchId, value: true }],
        epilogue: [{ kind: "say", speaker, text: lines[lines.length - 1] ?? "끝." }],
      });
    }

    return {
      summary: `${map.name}에 컷신 프리셋 '${preset}' 배치 (beat ${beats.length})${endingId ? ` · 엔딩 ${endingId}` : ""}`,
      data: {
        preset,
        eventId: (cut.data as { eventId?: string } | undefined)?.eventId,
        beatCount: beats.length,
        endingId,
        lint,
      },
      ...(lint.length > 0 ? { warnings: lint } : {}),
    };
  },
};

const makeHorrorLoop: ToolDefinition = {
  name: "make_horror_loop",
  description:
    "마녀의집식 트랩·체크포인트·(선택)추격 루프를 한 번에 배치한다. " +
    "trapCells 또는 trapCount+origin으로 트랩을 깔고 respawnCheckpoint를 강제하며, includeChase면 make_chase_scene을 붙인다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { type: "object", description: "{x,y} 트랩 그리드 시작 (trapCells 없을 때)" },
      trapCount: { type: "integer", description: "자동 트랩 개수 1–8, 기본 3" },
      trapCells: { type: "array", items: { type: "object" }, description: "{x,y}[] 명시 트랩 좌표" },
      message: { type: "string" },
      includeChase: { type: "boolean" },
      chaserAt: { type: "object", description: "{x,y}" },
      safeZone: { type: "object", description: "{x,y,w,h}" },
      mood: { type: "boolean", description: "true면 어두운 set_scene_mood 적용" },
      activateSwitch: { type: "string" },
    },
    required: ["mapId"],
  },
  invalidArgsExample: {
    mapId: "map1",
    origin: { x: 4, y: 4 },
    trapCount: 3,
    includeChase: true,
    chaserAt: { x: 8, y: 4 },
    safeZone: { x: 1, y: 1, w: 2, h: 2 },
    mood: true,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const warnings: string[] = [];
    let cells: Array<{ x: number; y: number }> = [];
    if (Array.isArray(args.trapCells) && args.trapCells.length > 0) {
      for (const raw of args.trapCells) {
        if (!isRecord(raw) || typeof raw.x !== "number" || typeof raw.y !== "number") {
          warnings.push("trapCells 항목 무시: {x,y} 필요");
          continue;
        }
        cells.push({ x: Math.trunc(raw.x), y: Math.trunc(raw.y) });
      }
    } else {
      const ox = isRecord(args.origin) && typeof args.origin.x === "number" ? Math.trunc(args.origin.x) : 3;
      const oy = isRecord(args.origin) && typeof args.origin.y === "number" ? Math.trunc(args.origin.y) : 3;
      const count = clampInt(args.trapCount, 3, 1, 8);
      for (let i = 0; i < count; i += 1) {
        cells.push({ x: ox + i, y: oy });
      }
    }
    if (cells.length === 0) throw new ToolError("트랩 좌표가 비어 있습니다.", { code: "empty-traps", mapId: map.id });

    // 체크포인트 없는 트랩 방지: 항상 respawnCheckpoint
    const trap = runNamedTool(draft, "place_trap", {
      mapId: map.id,
      cells,
      trigger: "touch",
      message: cleanString(args.message, "바닥이 꺼졌다."),
      respawnCheckpoint: true,
      idPrefix: "ev_horror_trap",
    });

    let chaseEventId: string | undefined;
    if (args.includeChase === true) {
      const cx = isRecord(args.chaserAt) && typeof args.chaserAt.x === "number" ? Math.trunc(args.chaserAt.x) : cells[cells.length - 1]!.x + 2;
      const cy = isRecord(args.chaserAt) && typeof args.chaserAt.y === "number" ? Math.trunc(args.chaserAt.y) : cells[0]!.y;
      const chase = runNamedTool(draft, "make_chase_scene", {
        mapId: map.id,
        chaser: {
          at: { x: cx, y: cy },
          graphic: { query: "monster" },
          speed: 5,
          sightRange: 7,
        },
        killOnTouch: true,
        ...(isRecord(args.safeZone) ? { safeZone: args.safeZone } : {}),
        ...(typeof args.activateSwitch === "string" && args.activateSwitch.trim()
          ? { activateSwitch: args.activateSwitch.trim() }
          : {}),
        checkpointOnEntry: true,
      });
      chaseEventId = (chase.data as { eventId?: string } | undefined)?.eventId;
    }

    if (args.mood !== false) {
      runNamedTool(draft, "set_scene_mood", {
        mapId: map.id,
        applyMode: "map",
        lighting: { ambient: 0.28, color: "#1a1020" },
        weather: { kind: "none" },
      });
    }

    // 호러 lint: 트랩은 있는데 체크포인트 이벤트 유무
    const hasCheckpoint = map.events.some((ev) =>
      (ev.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "checkpointSave")),
    );
    if (!hasCheckpoint) warnings.push("체크포인트 커맨드가 맵에 보이지 않습니다 — place_trap.respawnCheckpoint 확인.");

    return {
      summary: `${map.name}에 호러 루프 배치 — 트랩 ${cells.length}개${chaseEventId ? ` · 추격 ${chaseEventId}` : ""}`,
      data: {
        trapEventIds: (trap.data as { eventIds?: string[] } | undefined)?.eventIds ?? [],
        checkpointEventId: (trap.data as { checkpointEventId?: string } | undefined)?.checkpointEventId,
        chaseEventId,
        trapCells: cells,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const makeGalleryRoom: ToolDefinition = {
  name: "make_gallery_room",
  description:
    "이브식 갤러리/조사 방을 한 번에 조립한다. 조사 핫스팟 N개 + (기본) item-gate 또는 switch-sequence 퍼즐 + 선택 엔딩 스위치. " +
    "원큐 오케스트레이션용 — place_examine_hotspots/compile_puzzle을 내부 호출한다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { type: "object", description: "{x,y} 핫스팟 배치 시작" },
      hotspotCount: { type: "integer", description: "3–16, 기본 6" },
      hotspotNames: { type: "array", items: { type: "string" } },
      puzzleKind: { type: "string", enum: ["item-gate", "switch-sequence", "password", "none"] },
      puzzleAt: { type: "object", description: "{x,y} 퍼즐/게이트 위치" },
      requiredItemId: { type: "string", description: "item-gate용 아이템 (기본 프로젝트 첫 아이템)" },
      solveSwitchId: { type: "string" },
      password: { type: "string" },
      includeMood: { type: "boolean" },
    },
    required: ["mapId"],
  },
  invalidArgsExample: {
    mapId: "map1",
    origin: { x: 2, y: 2 },
    hotspotCount: 6,
    puzzleKind: "item-gate",
    puzzleAt: { x: 8, y: 4 },
    solveSwitchId: "sw_gallery_open",
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const ox = isRecord(args.origin) && typeof args.origin.x === "number" ? Math.trunc(args.origin.x) : 2;
    const oy = isRecord(args.origin) && typeof args.origin.y === "number" ? Math.trunc(args.origin.y) : 2;
    const count = clampInt(args.hotspotCount, 6, 3, 16);
    const names = Array.isArray(args.hotspotNames)
      ? args.hotspotNames.filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      : [];
    const defaultNames = ["낡은 액자", "조각상", "붉은 카펫", "금색 촛대", "먼지 쌓인 책", "깨진 거울", "유리 진열장", "초상화"];

    const hotspots: RecordValue[] = [];
    for (let i = 0; i < count; i += 1) {
      const name = names[i] ?? defaultNames[i % defaultNames.length] ?? `조사 ${i + 1}`;
      // 2열 그리드 배치
      const col = i % 3;
      const row = Math.floor(i / 3);
      hotspots.push({
        at: { x: ox + col * 2, y: oy + row * 2 },
        name,
        lines: [`${name}을(를) 살펴본다.`, "무언가 단서가 될 것 같다."],
        once: true,
      });
    }

    const hotspotResult = runNamedTool(draft, "place_examine_hotspots", {
      mapId: map.id,
      hotspots,
    });

    const puzzleKind = cleanString(args.puzzleKind, "item-gate");
    const solveSwitchId = cleanString(args.solveSwitchId, "sw_gallery_open");
    ensureNamedSwitch(draft, solveSwitchId, "갤러리 해결");
    let puzzleId: string | undefined;
    const px = isRecord(args.puzzleAt) && typeof args.puzzleAt.x === "number" ? Math.trunc(args.puzzleAt.x) : ox + 6;
    const py = isRecord(args.puzzleAt) && typeof args.puzzleAt.y === "number" ? Math.trunc(args.puzzleAt.y) : oy + 1;

    if (puzzleKind !== "none") {
      puzzleId = "gallery_gate";
      if (puzzleKind === "item-gate") {
        const itemId =
          cleanString(args.requiredItemId, "") ||
          draft.database.items[0]?.id ||
          "";
        if (!itemId) throw new ToolError("item-gate에 사용할 아이템이 없습니다. requiredItemId를 지정하세요.", { code: "missing-item" });
        runNamedTool(draft, "compile_puzzle", {
          mapId: map.id,
          puzzleId,
          kind: "item-gate",
          at: { x: px, y: py },
          name: "잠긴 문",
          requiredItemId: itemId,
          consumeItem: false,
          lockedMessage: "열쇠가 필요하다.",
          unlockedMessage: "문이 열렸다.",
          onSolve: { setSwitch: solveSwitchId, message: "갤러리 너머로 길이 열린다." },
        });
      } else if (puzzleKind === "switch-sequence") {
        const nodes = hotspots.slice(0, Math.min(3, hotspots.length)).map((h, index) => ({
          at: h.at,
          name: typeof h.name === "string" ? h.name : `노드 ${index + 1}`,
        }));
        // sequence uses separate plates near puzzle
        runNamedTool(draft, "compile_puzzle", {
          mapId: map.id,
          puzzleId,
          kind: "switch-sequence",
          nodes: [
            { at: { x: px, y: py }, name: "왼쪽 종" },
            { at: { x: px + 1, y: py }, name: "가운데 종" },
            { at: { x: px + 2, y: py }, name: "오른쪽 종" },
          ],
          order: [0, 1, 2],
          onSolve: { setSwitch: solveSwitchId, message: "종소리가 겹치며 문이 열린다." },
        });
        void nodes;
      } else if (puzzleKind === "password") {
        runNamedTool(draft, "compile_puzzle", {
          mapId: map.id,
          puzzleId,
          kind: "password",
          at: { x: px, y: py },
          name: "암호 장치",
          answer: cleanString(args.password, "IB"),
          prompt: "암호를 입력한다.",
          onSolve: { setSwitch: solveSwitchId, message: "장치가 풀렸다." },
        });
      }
    }

    if (args.includeMood !== false) {
      runNamedTool(draft, "set_scene_mood", {
        mapId: map.id,
        applyMode: "map",
        lighting: { ambient: 0.42, color: "#2a2438" },
      });
    }

    const created = (hotspotResult.data as { created?: number } | undefined)?.created ?? 0;
    const warnings = [...(hotspotResult.warnings ?? [])];
    if (created < 3) warnings.push(`핫스팟이 ${created}개뿐 — 조사 밀도가 낮습니다.`);

    return {
      summary: `${map.name}에 갤러리 방 조립 — 핫스팟 ${created}개${puzzleId ? ` · 퍼즐 ${puzzleKind}` : ""}`,
      data: {
        hotspotEventIds: (hotspotResult.data as { eventIds?: string[] } | undefined)?.eventIds ?? [],
        created,
        skipped: (hotspotResult.data as { skipped?: number } | undefined)?.skipped ?? 0,
        puzzleId,
        puzzleKind,
        solveSwitchId,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

export const NARRATIVE_HORROR_TEMPLATE_TOOLS: readonly ToolDefinition[] = [
  scriptCutscenePreset,
  makeHorrorLoop,
  makeGalleryRoom,
];

export { lintCutsceneBeats };
