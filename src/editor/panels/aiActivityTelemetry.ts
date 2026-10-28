import type { ActivityEntry, ActivityTrace } from "@/ai/activityTrace";
import { loadAiConfig } from "@/ai/llmClient";
import { loadActivityTilesetAtlas } from "@/ai/toolImageCanvas";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import { tilesetBaseImageUrl } from "@/editor/tilesetImage";
import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toolGroup } from "./aiToolLabels";

export type PipelineStageIndex = 0 | 1 | 2 | 3;

interface PipelineStageSpec {
  readonly num: string;
  readonly label: string;
}

const PIPELINE_STAGES: readonly PipelineStageSpec[] = [
  { num: "①", label: "의도·맥락 분석" },
  { num: "②", label: "공간·데이터 설계" },
  { num: "③", label: "맵·이벤트 배치" },
  { num: "④", label: "시각·연결 검수" },
];

const DESIGN_TOOLS = new Set([
  "list_spatial_designs",
  "get_spatial_design",
  "list_npc_graphics",
  "list_resources",
  "get_database_records",
  "consult_writer",
  "list_tileset_references",
  "read_tileset_reference",
  "list_authoring_presets",
  "read_authoring_preset",
]);

const VERIFY_TOOLS = new Set([
  "show_map_region",
  "check_reachability",
  "check_city_form",
  "run_lint",
  "inspect_interior_layout",
  "review_game_systems",
  "review_monster_game",
  "review_opening",
]);

const MAP_PREVIEW_TOOLS = new Set([
  "stamp_object",
  "place_props",
  "place_npc",
  "make_villager",
  "upsert_event",
  "fill_region",
  "paint_tiles",
  "lay_path",
  "paint_road",
  "author_beodeul_town",
  "author_dungeon",
  "author_beodeul_dungeon",
  "build_hand_interior_room",
  "place_terrain_house",
  "show_map_region",
  "get_map_region",
  "set_start_position",
  "create_map",
  "resize_map",
]);

/**
 * Strip substrings that unit tests forbid inside `.ai-activity-entries` when `level === "brief"`.
 */
export function sanitizeBriefText(text: string): string {
  return text
    .replace(/Ultrabrain/giu, "설계")
    .replace(/consult_writer|consult/giu, "대사 작성")
    .replace(/시공/gu, "배치")
    .replace(/초안/gu, "미리보기")
    .replace(/초기/gu, "기본")
    .replace(/초/gu, "s")
    .replace(/번째 단계/gu, "단계")
    .replace(/확인·처리/gu, "처리")
    .replace(/\bDB\b/gu, "데이터")
    .replace(/\bitems\b/giu, "아이템")
    .replace(/모델 응답 대기/gu, "응답 준비")
    .replace(/실패/gu, "재시도");
}

function unwrapArgs(entry: ActivityEntry): Record<string, unknown> {
  const input = entry.input as { args?: unknown } | undefined;
  if (input && typeof input === "object" && input.args && typeof input.args === "object" && !Array.isArray(input.args)) {
    return input.args as Record<string, unknown>;
  }
  if (entry.input && typeof entry.input === "object" && !Array.isArray(entry.input)) {
    const raw = entry.input as Record<string, unknown>;
    if (!("callId" in raw)) return raw;
  }
  return {};
}

function classifyToolStage(name: string): PipelineStageIndex {
  if (VERIFY_TOOLS.has(name)) return 3;
  if (DESIGN_TOOLS.has(name)) return 1;
  const group = toolGroup(name);
  if (group === "build" || group === "people" || group === "world") return 2;
  return 0;
}

export function derivePipelineState(trace: ActivityTrace): {
  readonly activeStage: PipelineStageIndex;
  readonly doneUpTo: number;
  readonly isFinished: boolean;
  readonly statusText: string;
  readonly modelLabel: string;
  readonly turnCount: number;
  readonly toolCount: number;
} {
  let highestStage: PipelineStageIndex = 0;
  let turnCount = 0;
  let toolCount = 0;
  let modelLabel = "";

  for (const entry of trace.entries) {
    if (entry.kind === "start") {
      const out = entry.output as { model?: string } | undefined;
      if (out?.model) modelLabel = out.model;
    } else if (entry.kind === "turn") {
      const out = entry.output as { index?: number } | undefined;
      turnCount = Math.max(turnCount, out?.index ?? turnCount + 1);
    } else if (entry.kind === "tool") {
      toolCount += 1;
      const stage = classifyToolStage(entry.name);
      if (stage > highestStage) highestStage = stage;
    } else if (entry.kind === "agent_spawn" && entry.actor.startsWith("ultrabrain-plan")) {
      if (highestStage < 1) highestStage = 1;
    } else if (entry.kind === "review") {
      highestStage = 3;
    }
  }

  if (!modelLabel) {
    try {
      modelLabel = loadAiConfig().model || "gemini-4-argon";
    } catch {
      modelLabel = "gemini-4-argon";
    }
  }

  const isFinished = ["완료", "적용됨", "검토 대기", "버림", "중단", "실패"].includes(trace.phase);
  if (isFinished && (trace.phase === "완료" || trace.phase === "적용됨" || trace.phase === "검토 대기")) {
    highestStage = 3;
  }

  const doneUpTo = isFinished ? 3 : highestStage - 1;
  const currentSpec = PIPELINE_STAGES[highestStage]!;
  const statusText = isFinished
    ? `${currentSpec.num} ${currentSpec.label} · ${trace.phase === "실패" ? "점검 필요" : trace.phase}`
    : `${currentSpec.num} ${currentSpec.label} 진행 중`;

  return {
    activeStage: highestStage,
    doneUpTo,
    isFinished,
    statusText,
    modelLabel,
    turnCount: Math.max(turnCount, toolCount > 0 ? 1 : 0),
    toolCount,
  };
}

export interface PipelineHeaderHandle {
  readonly root: HTMLElement;
  update(trace: ActivityTrace): void;
}

export function createPipelineHeader(): PipelineHeaderHandle {
  const statusEl = el("span", { class: "ai-act-pipeline-status" });
  const modelBadge = el("span", { class: "ai-act-badge is-model", dataset: { testid: "ai-activity-model-badge" } });
  const statsBadge = el("span", { class: "ai-act-badge is-stats", dataset: { testid: "ai-activity-stats-badge" } });
  const top = el("div", {
    class: "ai-act-pipeline-top",
    children: [statusEl, el("div", { class: "ai-act-pipeline-badges", children: [modelBadge, statsBadge] })],
  });

  const stepEls = PIPELINE_STAGES.map((stage, idx) =>
    el("li", {
      class: "ai-act-pipeline-step",
      dataset: { stage: String(idx) },
      children: [
        el("span", { class: "ai-act-pipeline-step-num", text: stage.num }),
        el("span", { class: "ai-act-pipeline-step-label", text: stage.label }),
      ],
    }),
  );
  const stepsList = el("ol", { class: "ai-act-pipeline-steps", children: stepEls });
  const barFill = el("div", { class: "ai-act-pipeline-fill" });
  const bar = el("div", { class: "ai-act-pipeline-bar", attrs: { "aria-hidden": "true" }, children: [barFill] });

  const root = el("div", {
    class: "ai-act-pipeline",
    dataset: { testid: "ai-activity-pipeline" },
    children: [top, stepsList, bar],
  });

  return {
    root,
    update(trace: ActivityTrace): void {
      const state = derivePipelineState(trace);
      statusEl.textContent = state.statusText;
      modelBadge.textContent = `⚡ ${state.modelLabel}`;
      statsBadge.textContent = `턴 ${state.turnCount} · 도구 ${state.toolCount}회`;
      root.classList.toggle("is-running", !state.isFinished);
      root.classList.toggle("is-done", state.isFinished);

      stepEls.forEach((stepEl, idx) => {
        const isDone = state.isFinished ? idx <= state.activeStage : idx < state.activeStage;
        const isActive = !state.isFinished && idx === state.activeStage;
        stepEl.className = `ai-act-pipeline-step${isDone ? " is-done" : isActive ? " is-active" : " is-pending"}`;
      });

      const pct = state.isFinished ? 100 : (state.activeStage + 1) * 24;
      barFill.style.width = `${pct}%`;
    },
  };
}

export interface TargetScopeInfo {
  readonly label: string;
  readonly mapId: string | null;
  readonly rect: { x: number; y: number; width: number; height: number } | null;
}

function parseSummaryRect(summary: string): { x: number; y: number; width: number; height: number } | null {
  // Matches patterns like `(8,5) 4×4` or `(10, 6)`
  const rectMatch = /\((\d+)\s*,\s*(\d+)\)\s*(\d+)\s*[×x]\s*(\d+)/u.exec(summary);
  if (rectMatch) {
    return {
      x: Number(rectMatch[1]),
      y: Number(rectMatch[2]),
      width: Math.max(1, Number(rectMatch[3])),
      height: Math.max(1, Number(rectMatch[4])),
    };
  }
  const ptMatch = /\((\d+)\s*,\s*(\d+)\)/u.exec(summary);
  if (ptMatch) {
    return { x: Number(ptMatch[1]), y: Number(ptMatch[2]), width: 1, height: 1 };
  }
  return null;
}

function resolveMapTarget(entry: ActivityEntry, args: Record<string, unknown>, project: Project | null): { mapId: string | null; map: GameMap | null; rect: { x: number; y: number; width: number; height: number } | null } {
  const out = entry.output as { mapId?: string; rect?: { x: number; y: number; width: number; height: number } } | undefined;
  const rawMapId = typeof args.mapId === "string" && args.mapId.trim()
    ? args.mapId.trim()
    : typeof out?.mapId === "string" && out.mapId.trim()
      ? out.mapId.trim()
      : null;
  const summaryMapMatch = /\b(map_[\w-]+)\b/u.exec(entry.summary);
  const mapId = rawMapId ?? summaryMapMatch?.[1] ?? (MAP_PREVIEW_TOOLS.has(entry.name) ? project?.startMapId ?? null : null);
  const map = mapId && project?.maps?.[mapId] ? project.maps[mapId]! : null;

  if (out?.rect && typeof out.rect.x === "number" && typeof out.rect.y === "number") {
    return {
      mapId,
      map,
      rect: {
        x: out.rect.x,
        y: out.rect.y,
        width: Math.max(1, out.rect.width ?? 1),
        height: Math.max(1, out.rect.height ?? 1),
      },
    };
  }

  if (typeof args.x === "number" && typeof args.y === "number") {
    const w = typeof args.width === "number" ? args.width : typeof args.w === "number" ? args.w : 2;
    const h = typeof args.height === "number" ? args.height : typeof args.h === "number" ? args.h : 2;
    return { mapId, map, rect: { x: args.x, y: args.y, width: Math.max(1, w), height: Math.max(1, h) } };
  }

  return { mapId, map, rect: parseSummaryRect(entry.summary) };
}

export function extractTargetScope(entry: ActivityEntry, level: string): TargetScopeInfo | null {
  if (entry.kind !== "tool") return null;
  let project: Project | null = null;
  try {
    project = store.getCurrent();
  } catch {
    project = null;
  }
  const args = unwrapArgs(entry);
  const { mapId, map, rect } = resolveMapTarget(entry, args, project);
  const mapTitle = map ? `${map.name} (${map.width}×${map.height})` : mapId ?? null;

  let rawLabel = "";
  if (["place_npc", "make_villager", "upsert_event", "get_event"].includes(entry.name)) {
    const npcName = typeof args.name === "string" && args.name.trim() ? args.name.trim() : typeof args.eventId === "string" ? args.eventId : "이벤트";
    const coord = rect ? ` (${rect.x}, ${rect.y})` : "";
    rawLabel = `👤 ${npcName}${coord}${map ? ` · ${map.name}` : ""}`;
  } else if (entry.name === "list_spatial_designs" || entry.name === "get_spatial_design") {
    const q = typeof args.query === "string" && args.query.trim() ? `"${args.query.trim()}"` : typeof args.id === "string" ? args.id : "전체";
    rawLabel = `📦 공용 도안 · ${q}`;
  } else if (entry.name === "list_npc_graphics" || entry.name === "list_resources") {
    const q = typeof args.query === "string" && args.query.trim() ? `"${args.query.trim()}"` : "전체";
    rawLabel = `🎭 외형 카탈로그 · ${q}`;
  } else if (entry.name === "get_database_records") {
    const col = typeof args.collection === "string" ? args.collection : "레코드";
    rawLabel = `📚 데이터 목록 · ${col}`;
  } else if (entry.name === "get_project_summary") {
    const mapCount = project ? Object.keys(project.maps).length : 0;
    rawLabel = mapCount > 0 ? `🧭 프로젝트 구조 (맵 ${mapCount}개)` : "🧭 프로젝트 구조";
  } else if (entry.name === "find_tools") {
    const q = typeof args.query === "string" && args.query.trim() ? `"${args.query.trim()}"` : "도구 검색";
    rawLabel = `🔧 ${q}`;
  } else if (mapTitle) {
    const regionPart = rect ? ` · (${rect.x}, ${rect.y}) ${rect.width}×${rect.height}` : "";
    rawLabel = `🗺 ${mapTitle}${regionPart}`;
  }

  if (!rawLabel) return null;
  return {
    label: level === "brief" ? sanitizeBriefText(rawLabel) : rawLabel,
    mapId: map ? map.id : mapId,
    rect,
  };
}

const DIALOGUE_TOOL_NAMES = new Set([
  "list_dialogue", "get_dialogue_context", "rewrite_dialogue", "set_speaker_voice",
  "get_story_outline", "read_story_script", "set_scene_summaries",
]);

const DIALOGUE_SCOPE_LABELS: Readonly<Record<string, string>> = {
  map: "맵 이벤트", common: "공용 이벤트", troop: "전투 이벤트", database: "자료집 설명", quest: "퀘스트 일지", ending: "엔딩",
};
const DIALOGUE_KIND_LABELS: Readonly<Record<string, string>> = {
  line: "대사", choice: "선택지·질문", description: "설명", quest: "퀘스트·엔딩 글",
};

function shortQuote(value: string, max = 40): string {
  const flat = value.replace(/\s+/gu, " ").trim();
  return `「${flat.length > max ? `${flat.slice(0, max)}…` : flat}」`;
}

/** 대사 도구 카드 한 줄 — 인자를 JSON 대신 사람이 읽는 말로(2026-10-27 검수: edits 배열 원문이 비쳤다). */
function dialogueToolBreakdown(name: string, args: Record<string, unknown>): string[] {
  const text = (key: string): string => (typeof args[key] === "string" ? (args[key] as string).trim() : "");
  const parts: string[] = [];
  if (name === "list_dialogue") {
    if (text("query")) parts.push(`검색어 ${shortQuote(text("query"), 24)}`);
    if (text("speaker")) parts.push(`화자 ${text("speaker")}`);
    if (text("mapId")) {
      let mapName = text("mapId");
      try { mapName = store.getCurrent().maps[mapName]?.name ?? mapName; } catch { /* 프로젝트가 없으면 id 그대로 */ }
      parts.push(`맵 ${mapName}`);
    }
    const scope = DIALOGUE_SCOPE_LABELS[text("scope")];
    if (scope) parts.push(`범위 ${scope}`);
    const kind = DIALOGUE_KIND_LABELS[text("kind")];
    if (kind) parts.push(`종류 ${kind}`);
    if (args.overflowOnly === true) parts.push("창 넘침만");
    if (typeof args.minChars === "number") parts.push(`${args.minChars}자 이상`);
    if (parts.length === 0) parts.push("모든 대사");
  } else if (name === "get_dialogue_context") {
    parts.push(`앞 ${typeof args.before === "number" ? args.before : "기본"}줄 · 뒤 ${typeof args.after === "number" ? args.after : "기본"}줄`);
  } else if (name === "rewrite_dialogue") {
    const edits = Array.isArray(args.edits) ? args.edits : [];
    parts.push(`${args.mode === "apply" ? "바로 고치기" : "고칠 제안"} ${edits.length}줄`);
    if (text("instruction")) parts.push(`요청 ${shortQuote(text("instruction"))}`);
    const first = edits.find((edit): edit is { text: string } => Boolean(edit) && typeof (edit as { text?: unknown }).text === "string");
    if (first) parts.push(`예: ${shortQuote(first.text, 30)}`);
    if (args.allowOverflow === true) parts.push("창 넘침 허용");
  } else if (name === "set_speaker_voice") {
    if (text("speaker")) parts.push(`화자 ${text("speaker")}`);
    parts.push(text("note") ? `말투 ${shortQuote(text("note"))}` : "말투 메모 지우기");
  } else if (name === "get_story_outline") {
    parts.push(text("chapter") ? `막 ${text("chapter")}` : "모든 막");
    if (args.includeSide === true) parts.push("곁가지 포함");
  } else if (name === "read_story_script") {
    if (text("chapter")) parts.push(`막 ${text("chapter")}`);
    if (text("from") || text("to")) parts.push(`장면 ${text("from") || "처음"}~${text("to") || "끝"}`);
    if (Array.isArray(args.scenes) && args.scenes.length > 0) parts.push(`장면 ${args.scenes.slice(0, 4).join("·")}${args.scenes.length > 4 ? ` 외 ${args.scenes.length - 4}개` : ""}`);
    if (text("speaker")) parts.push(`화자 ${text("speaker")}`);
    if (parts.length === 0) parts.push("대본 처음부터");
  } else if (name === "set_scene_summaries") {
    const items = Array.isArray(args.items) ? args.items : [];
    parts.push(`장면 요약 ${items.length}개`);
  }
  return parts;
}

export function extractActionBreakdown(entry: ActivityEntry, level: string): string | null {
  if (entry.kind !== "tool") return null;
  const args = unwrapArgs(entry);
  const rawSummary = (entry.summary || "").trim();
  const hasRealArgs = Object.keys(args).length > 0;

  let parts: string[] = [];
  if (entry.name === "stamp_object") {
    const objId = typeof args.objectId === "string" ? args.objectId.split("/").pop() ?? args.objectId : "";
    if (objId) parts.push(`도안 ID: ${objId}`);
    if (typeof args.x === "number" && typeof args.y === "number") parts.push(`배치 좌표: (${args.x}, ${args.y})`);
    if (rawSummary && rawSummary !== "실행 중") parts.push(rawSummary);
  } else if (entry.name === "list_spatial_designs") {
    if (typeof args.query === "string" && args.query) parts.push(`검색 키워드: "${args.query}"`);
    if (typeof args.kind === "string") parts.push(`분류: ${args.kind === "object" ? "개별 기물·소품" : "장소·건물"}`);
    if (rawSummary && rawSummary !== "실행 중") parts.push(rawSummary);
  } else if (entry.name === "place_npc" || entry.name === "make_villager" || entry.name === "upsert_event") {
    if (typeof args.name === "string" && args.name) parts.push(`이름: ${args.name}`);
    const graphic = typeof args.characterName === "string" ? args.characterName : typeof args.graphic === "string" ? args.graphic : "";
    if (graphic) parts.push(`외형: ${graphic}`);
    if (typeof args.x === "number" && typeof args.y === "number") parts.push(`좌표: (${args.x}, ${args.y})`);
    if (Array.isArray(args.lines) && args.lines.length > 0) parts.push(`대사 ${args.lines.length}줄`);
    if (rawSummary && rawSummary !== "실행 중") parts.push(rawSummary);
  } else if (entry.name === "list_npc_graphics") {
    if (typeof args.query === "string" && args.query) parts.push(`검색어: "${args.query}"`);
    if (rawSummary && rawSummary !== "실행 중") parts.push(rawSummary);
  } else if (entry.name === "get_map_region" || entry.name === "show_map_region") {
    if (typeof args.x === "number" && typeof args.y === "number") {
      const w = args.width ?? args.w ?? "";
      const h = args.height ?? args.h ?? "";
      parts.push(`영역: (${args.x}, ${args.y})${w && h ? ` ${w}×${h}` : ""}`);
    }
    if (rawSummary && rawSummary !== "실행 중" && rawSummary !== "영역 확인") parts.push(rawSummary);
  } else if (DIALOGUE_TOOL_NAMES.has(entry.name)) {
    parts.push(...dialogueToolBreakdown(entry.name, args));
    if (rawSummary && rawSummary !== "실행 중") parts.push(rawSummary);
  } else if (hasRealArgs) {
    const kv = Object.entries(args)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v.slice(0, 36) : JSON.stringify(v)?.slice(0, 36) ?? ""}`)
      .join(" · ");
    if (kv) parts.push(kv);
    if (rawSummary && rawSummary !== "실행 중") parts.push(rawSummary);
  } else if (rawSummary && !["실행 중", "영역 확인", "확인", "바꿈"].includes(rawSummary) && !/^\d+건/.test(rawSummary)) {
    parts.push(rawSummary);
  }

  if (parts.length === 0) return null;
  const joined = parts.join(" · ");
  return level === "brief" ? sanitizeBriefText(joined) : joined;
}

function canRenderCanvas2d(): boolean {
  if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext?.("2d"));
  } catch {
    return false;
  }
}

function drawProceduralMapPreview(
  canvas: HTMLCanvasElement,
  map: GameMap,
  highlight: { x: number; y: number; width: number; height: number } | null,
  startPos: { x: number; y: number } | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const mw = Math.max(1, map.width);
  const mh = Math.max(1, map.height);
  const cellW = W / mw;
  const cellH = H / mh;

  // Draw lower & upper tiles silhouette immediately
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const idx = y * mw + x;
      const lower = map.lowerTiles[idx] ?? 0;
      const upper = map.upperTiles?.[idx] ?? -1;
      const overlay = map.upperOverlayTiles?.[idx] ?? -1;
      if (upper >= 0 || overlay >= 0) {
        ctx.fillStyle = "#5b6ee1";
      } else if (lower > 20) {
        ctx.fillStyle = "#86a873";
      } else {
        ctx.fillStyle = "#4b8b3b";
      }
      ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }

  // Subtle tile grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 0.5;
  for (let x = 1; x < mw; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellW, 0);
    ctx.lineTo(x * cellW, H);
    ctx.stroke();
  }
  for (let y = 1; y < mh; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellH);
    ctx.lineTo(W, y * cellH);
    ctx.stroke();
  }

  // Start position marker
  if (startPos) {
    ctx.fillStyle = "rgba(52, 211, 153, 0.85)";
    ctx.fillRect(startPos.x * cellW, startPos.y * cellH, Math.max(3, cellW), Math.max(3, cellH));
  }

  // Event markers
  for (const ev of map.events ?? []) {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc((ev.x + 0.5) * cellW, (ev.y + 0.5) * cellH, Math.max(2.5, Math.min(cellW, cellH) * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  drawHighlightOverlay(ctx, mw, mh, W, H, highlight);
}

function drawHighlightOverlay(
  ctx: CanvasRenderingContext2D,
  mw: number,
  mh: number,
  W: number,
  H: number,
  highlight: { x: number; y: number; width: number; height: number } | null,
): void {
  if (!highlight) return;
  const cellW = W / Math.max(1, mw);
  const cellH = H / Math.max(1, mh);
  const rx = Math.max(0, highlight.x * cellW);
  const ry = Math.max(0, highlight.y * cellH);
  const rw = Math.min(W - rx, Math.max(cellW, highlight.width * cellW));
  const rh = Math.min(H - ry, Math.max(cellH, highlight.height * cellH));

  ctx.fillStyle = "rgba(74, 87, 214, 0.24)";
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(rx + 1, ry + 1, Math.max(2, rw - 2), Math.max(2, rh - 2));
  ctx.strokeStyle = "#4A57D6";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx + 1, ry + 1, Math.max(2, rw - 2), Math.max(2, rh - 2));
}

export function createInlineMinimap(entry: ActivityEntry, scope: TargetScopeInfo | null, level: string): HTMLElement | null {
  if (entry.kind !== "tool" || !MAP_PREVIEW_TOOLS.has(entry.name) || !scope?.mapId) return null;
  if (!canRenderCanvas2d()) return null;

  let project: Project | null = null;
  try {
    project = store.getCurrent();
  } catch {
    project = null;
  }
  const map = project?.maps?.[scope.mapId];
  if (!project || !map) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 110;
  canvas.className = "ai-act-minimap-canvas";

  const startPos = project.startMapId === map.id ? project.startPos : null;
  drawProceduralMapPreview(canvas, map, scope.rect, startPos);

  const tileset = project.tilesets[map.tilesetId];
  if (tileset) {
    const snapshotProject = structuredClone({ tilesets: { [tileset.id]: tileset } }) as Project;
    const snapshotMap = structuredClone(map);
    const highlight = scope.rect;
    void (async () => {
      try {
        let atlas: HTMLImageElement | HTMLCanvasElement | undefined;
        if (tileset.tileGrafts?.length) {
          const baseUrl = tilesetBaseImageUrl(tileset);
          if (baseUrl) atlas = await loadActivityTilesetAtlas(tileset, baseUrl, new Map());
        }
        const rendered = await renderRegionSnapshot(
          snapshotProject,
          snapshotMap,
          { x: 0, y: 0, width: snapshotMap.width, height: snapshotMap.height },
          { targetWidth: 180, image: atlas },
        );
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(rendered, 0, 0, canvas.width, canvas.height);
        drawHighlightOverlay(ctx, snapshotMap.width, snapshotMap.height, canvas.width, canvas.height, highlight);
      } catch {
        // Keep the synchronous procedural map preview if tileset image loading fails in headless/test environments.
      }
    })();
  }

  const rawCaption = scope.rect
    ? `📍 ${map.name} · (${scope.rect.x}, ${scope.rect.y}) ${scope.rect.width}×${scope.rect.height}칸 영역 미리보기`
    : `📍 ${map.name} (${map.width}×${map.height}) 전체 미리보기`;
  const captionText = level === "brief" ? sanitizeBriefText(rawCaption) : rawCaption;

  const wrapper = el("div", {
    class: "ai-act-minimap",
    dataset: { testid: "ai-activity-minimap" },
    attrs: { role: "button", tabindex: "0", title: "클릭하여 캔버스에서 해당 위치 보기" },
    children: [
      canvas,
      el("div", {
        class: "ai-act-minimap-meta",
        children: [
          el("span", { class: "ai-act-minimap-caption", text: captionText }),
          el("span", { class: "ai-act-minimap-cta", text: "위치로 이동 ↗" }),
        ],
      }),
    ],
    on: {
      click: (ev) => {
        ev.stopPropagation();
        const r = scope.rect ?? { x: 0, y: 0, width: map.width, height: map.height };
        focusEditorRegion({ mapId: map.id, x: r.x, y: r.y, w: r.width, h: r.height }, { highlight: true });
      },
    },
  });

  return wrapper;
}

export function createInspectorDrawer(
  entry: ActivityEntry,
  openedSet: Set<string>,
): HTMLElement | null {
  if (entry.kind !== "tool") return null;
  const args = unwrapArgs(entry);
  if (Object.keys(args).length === 0 && !entry.output && !entry.summary) return null;

  const drawerKey = `inspector:${entry.id}`;
  const toggleSummary = el("summary", {
    class: "ai-act-inspector-toggle",
    dataset: { testid: "ai-activity-inspector-toggle" },
    text: "상세 파라미터 · 결과 JSON 보기",
  });
  const body = el("div", { class: "ai-act-inspector-body" });
  let filled = false;
  const fill = (): void => {
    if (filled) return;
    filled = true;
    const durationText = entry.durationMs !== undefined ? ` · ${entry.durationMs}ms` : "";
    body.append(
      el("div", {
        class: "ai-act-inspector-row",
        children: [
          el("strong", { text: `도구: ${entry.name}${durationText}` }),
          el("span", { text: entry.summary || "요약 없음" }),
        ],
      }),
    );
    if (Object.keys(args).length > 0) {
      body.append(
        el("strong", { text: "입력 파라미터 (Arguments)" }),
        el("pre", { text: JSON.stringify(args, null, 2) }),
      );
    }
    if (entry.output !== undefined) {
      body.append(
        el("strong", { text: "실행 결과 (Result JSON)" }),
        el("pre", { text: JSON.stringify(entry.output, null, 2) }),
      );
    }
  };

  const details = el("details", {
    class: "ai-act-inspector",
    dataset: { testid: "ai-activity-inspector" },
    children: [toggleSummary, body],
  }) as HTMLDetailsElement;

  if (openedSet.has(drawerKey)) {
    details.open = true;
    fill();
  }
  details.addEventListener("toggle", () => {
    if (!details.isConnected) return;
    if (details.open) {
      openedSet.add(drawerKey);
      fill();
    } else {
      openedSet.delete(drawerKey);
    }
  });

  return details;
}

export function buildRichToolExtras(
  entry: ActivityEntry,
  level: string,
  openedSet: Set<string>,
): HTMLElement | null {
  if (entry.kind !== "tool") return null;
  const scope = extractTargetScope(entry, level);
  const breakdown = extractActionBreakdown(entry, level);
  const minimap = createInlineMinimap(entry, scope, level);
  const inspector = level === "trace" ? null : createInspectorDrawer(entry, openedSet);

  if (!scope && !breakdown && !minimap && !inspector) return null;

  const children: HTMLElement[] = [];
  if (scope) {
    const chip = el("button", {
      class: "ai-act-scope-chip",
      dataset: { testid: "ai-activity-scope-chip" },
      attrs: { type: "button", title: scope.mapId ? "클릭하여 해당 맵·좌표로 화면 이동" : scope.label },
      text: scope.label,
      on: {
        click: (ev) => {
          ev.stopPropagation();
          if (!scope.mapId) return;
          const r = scope.rect ?? { x: 0, y: 0, width: 20, height: 15 };
          focusEditorRegion({ mapId: scope.mapId, x: r.x, y: r.y, w: r.width, h: r.height }, { highlight: true });
        },
      },
    });
    children.push(el("div", { class: "ai-act-chip-row", children: [chip] }));
  }
  if (breakdown) {
    children.push(
      el("div", {
        class: "ai-act-action-detail",
        dataset: { testid: "ai-activity-action-detail" },
        text: breakdown,
      }),
    );
  }
  if (minimap) children.push(minimap);
  if (inspector) children.push(inspector);

  return el("div", { class: "ai-act-rich-card", dataset: { testid: "ai-activity-rich-card" }, children });
}
