/**
 * AI 이벤트 배치 통행성 QA — 실제 툴 레지스트리 실측 하네스.
 *
 *   npx tsx scripts/qa/ai-event-placement-lint.mts
 *
 * 왜 .mts + tsx 인가: 레지스트리(src/editor/tools)와 린트(src/project/lint)가 전부 TS 소스이고
 * "@/..." 별칭으로 서로를 import 한다. 순수 node 로는 로드할 수 없으므로 tsx 로더를 쓴다.
 *
 * 하는 일:
 *  1. createBlankProject() 위에 적대적 지형을 칠한다(가로 강 TILE.WATER + 벽 블록 TILE.WALL + 깊은 호수).
 *  2. 물/벽 좌표를 **일부러 겨냥해서** 실제 툴을 getTool(name)!.run(project, args) 로 구동한다.
 *  3. 툴별로 요청 좌표 / 최종 이벤트 좌표 / 생성 수 / 스킵 수 / 경고를 출력한다.
 *  4. 결과 프로젝트에 projectLint 를 돌려 code 별 건수 표를 출력한다.
 *  5. playerTouch-impassable 또는 event-unreachable 이 하나라도 있으면 exit 1.
 */
import { getTool } from "@/editor/tools";
import { ToolError } from "@/editor/tools/types";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import type { GameMap, Project } from "@/project/types";

const START_MAP_ID = "map_blank_start";
const COPY_TARGET_MAP_ID = "map_qa_copy_target";

type Cell = { readonly x: number; readonly y: number };

type ToolRun = {
  readonly tool: string;
  readonly aim: string;
  readonly requested: readonly Cell[];
  readonly created: readonly { readonly mapId: string; readonly id: string; readonly x: number; readonly y: number; readonly passable: boolean }[];
  readonly createdReported: number | string;
  readonly skippedReported: number | string;
  readonly warnings: readonly string[];
  readonly error?: string;
};

function paint(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function paintRect(map: GameMap, rect: { x: number; y: number; w: number; h: number }, tile: number): void {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      paint(map, x, y, tile);
    }
  }
}

/** 모든 맵의 이벤트 id → 소속 맵 스냅샷. 툴 실행 전후 차분으로 "실제로 만들어진 이벤트"를 뽑는다. */
function eventKeys(project: Project): Set<string> {
  const keys = new Set<string>();
  for (const map of Object.values(project.maps)) for (const event of map.events) keys.add(`${map.id}#${event.id}`);
  return keys;
}

function eventsAfter(project: Project, before: Set<string>): { mapId: string; event: GameEvent }[] {
  const fresh: { mapId: string; event: GameEvent }[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (!before.has(`${map.id}#${event.id}`)) fresh.push({ mapId: map.id, event });
    }
  }
  return fresh;
}

function reported(value: unknown): number | string {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.length;
  return "-";
}

/** 경고 문구에서 스킵 건수를 읽는다(영역 툴은 data 에 숫자를 담지 않고 경고로만 보고한다). */
function skippedFromWarnings(warnings: readonly string[]): number | undefined {
  let total: number | undefined;
  for (const warning of warnings) {
    if (!/건너뛰|skip/u.test(warning)) continue;
    const match = /(\d+)\s*개/u.exec(warning);
    if (!match) continue;
    total = (total ?? 0) + Number(match[1]);
  }
  return total;
}

const runs: ToolRun[] = [];

function drive(project: Project, tool: string, aim: string, requested: readonly Cell[], args: Record<string, unknown>): ToolRun {
  const definition = getTool(tool);
  if (!definition) throw new Error(`레지스트리에 툴이 없습니다: ${tool}`);
  const before = eventKeys(project);
  let run: ToolRun;
  try {
    const result = definition.run(project, args);
    const data = (result.data ?? {}) as Record<string, unknown>;
    const warnings = result.warnings ?? [];
    const created = eventsAfter(project, before).map(({ mapId, event }) => ({
      mapId,
      id: event.id,
      x: event.x,
      y: event.y,
      passable: isPassable(project, project.maps[mapId], event.x, event.y),
    }));
    const createdReported = typeof data.created === "number"
      ? data.created
      : (Array.isArray(data.eventIds) ? data.eventIds.length : (Array.isArray(data.events) ? data.events.length : created.length));
    const skippedReported = typeof data.skipped === "number" ? data.skipped : (skippedFromWarnings(warnings) ?? 0);
    run = { tool, aim, requested, created, createdReported, skippedReported, warnings };
  } catch (cause) {
    const code = cause instanceof ToolError && typeof cause.code === "string" ? `${cause.code}: ` : "";
    run = {
      tool,
      aim,
      requested,
      created: [],
      createdReported: 0,
      skippedReported: "-",
      warnings: [],
      error: `${code}${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }
  runs.push(run);
  return run;
}

function fmtCells(cells: readonly Cell[]): string {
  return cells.map(({ x, y }) => `(${x},${y})`).join(" ");
}

// ── 1. 적대적 지형 ──────────────────────────────────────────────────────────
const project = createBlankProject();
const map = project.maps[START_MAP_ID];
// 벽 블록 x0..5,y0..5 — 내부 (2,2)는 반경 3이 전부 벽인 "완전 봉쇄" 좌표다.
paintRect(map, { x: 0, y: 0, w: 6, h: 6 }, TILE.WALL);
// 맵을 가로지르는 강 y=6,7 (시작 위치 (10,8)은 건드리지 않는다).
paintRect(map, { x: 0, y: 6, w: map.width, h: 2 }, TILE.WATER);
// 깊은 호수 x1..4,y10..12 — 중심 (2,11)은 4방향 이웃까지 전부 물이다.
paintRect(map, { x: 1, y: 10, w: 4, h: 3 }, TILE.WATER);
// 우하단 작은 호수 x14..15,y10..11 — 영역 툴 스킵 관측용.
paintRect(map, { x: 14, y: 10, w: 2, h: 2 }, TILE.WATER);
// 바닥 벽 호수 x14..16,y13..14 — (15,14)는 맵 밖 + 물로 둘러싸여 상호작용도 이동해야 한다.
paintRect(map, { x: 14, y: 13, w: 3, h: 2 }, TILE.WATER);

const HOSTILE_PROBES: readonly Cell[] = [
  { x: 2, y: 2 }, { x: 7, y: 7 }, { x: 9, y: 7 }, { x: 12, y: 7 }, { x: 14, y: 7 },
  { x: 8, y: 6 }, { x: 2, y: 11 }, { x: 15, y: 14 }, { x: 14, y: 10 },
];

console.log("=== 적대적 지형 확인 (isPassable === false 여야 한다) ===");
console.log(`맵 ${map.id} ${map.width}x${map.height}, 시작 위치 (${project.startPos.x}, ${project.startPos.y})`);
let fixtureOk = true;
for (const probe of HOSTILE_PROBES) {
  const passable = isPassable(project, map, probe.x, probe.y);
  if (passable) fixtureOk = false;
  console.log(`  (${probe.x},${probe.y}) isPassable=${passable}${passable ? "  ← 픽스처 오류" : ""}`);
}
console.log(`시작 위치 isPassable=${isPassable(project, map, project.startPos.x, project.startPos.y)}`);
console.log(`픽스처 적대성: ${fixtureOk ? "OK" : "FAIL"}`);
console.log("");

// ── 2. 실제 레지스트리 구동 ────────────────────────────────────────────────
const troopId = project.database.troops[0]!.id;
const itemId = project.database.items[0]!.id;
const speciesIds = project.database.monsterSpecies.slice(0, 3).map((species) => species.id);

drive(project, "place_npc", "강 위 NPC", [{ x: 7, y: 7 }], {
  mapId: START_MAP_ID,
  x: 7,
  y: 7,
  name: "강가 어부",
  pages: [{ lines: ["오늘은 잘 잡히는군."] }],
});

drive(project, "place_battle_blocker", "강 위 몬스터", [{ x: 12, y: 7 }], {
  mapId: START_MAP_ID,
  x: 12,
  y: 7,
  troopId,
});

drive(project, "place_chest", "강 위 보물상자(action)", [{ x: 14, y: 7 }], {
  mapId: START_MAP_ID,
  x: 14,
  y: 7,
  contents: { itemId, gold: 30 },
});

drive(project, "place_trap", "강 위 즉사 트랩 2칸(touch)", [{ x: 16, y: 7 }, { x: 17, y: 7 }], {
  mapId: START_MAP_ID,
  cells: [{ x: 16, y: 7 }, { x: 17, y: 7 }],
  trigger: "touch",
  message: "바닥이 꺼졌다.",
  respawnCheckpoint: true,
});

drive(project, "place_savepoint", "강 위 세이브 포인트(action)", [{ x: 19, y: 7 }], {
  mapId: START_MAP_ID,
  x: 19,
  y: 7,
});

drive(project, "upsert_event", "강 위 playerTouch 이벤트", [{ x: 9, y: 7 }], {
  mapId: START_MAP_ID,
  event: {
    id: "ev_qa_touch",
    x: 9,
    y: 7,
    trigger: { kind: "playerTouch" },
    commands: [{ kind: "text", body: "발밑이 젖었다." }],
  },
});

// move_event 는 기존 이벤트가 필요하다 — 마른 땅에 밟기형 이벤트를 만들고 강으로 옮긴다.
drive(project, "upsert_event", "육지 밟기형 이벤트 준비", [{ x: 13, y: 4 }], {
  mapId: START_MAP_ID,
  event: {
    id: "ev_qa_mover",
    x: 13,
    y: 4,
    trigger: { kind: "playerTouch" },
    commands: [{ kind: "text", body: "이동 대상." }],
  },
});
drive(project, "move_event", "밟기형 이벤트를 강으로 이동", [{ x: 13, y: 7 }], {
  mapId: START_MAP_ID,
  eventId: "ev_qa_mover",
  x: 13,
  y: 7,
});

drive(project, "set_lighting_volume", "강을 포함한 영역 조명(applyMode event)", [{ x: 0, y: 6 }], {
  mapId: START_MAP_ID,
  ambient: 0.8,
  applyMode: "event",
  area: { x: 0, y: 6, w: 4, h: 3 },
});

drive(project, "set_scene_mood", "호수를 포함한 영역 분위기(applyMode event)", [{ x: 14, y: 10 }], {
  mapId: START_MAP_ID,
  applyMode: "event",
  weather: { kind: "fog", intensity: 0.4 },
  lighting: { ambient: 0.7, area: { x: 14, y: 10, w: 4, h: 2 } },
});

drive(project, "author_story_arc", "깊은 호수 중심 스토리 비트", [{ x: 2, y: 11 }], {
  id: "qa-lost-crown",
  title: "잃어버린 왕관",
  mapId: START_MAP_ID,
  eventId: "ev_qa_story_beat",
  at: { x: 2, y: 11 },
  opening: ["왕관의 흔적을 찾았다."],
  tutorialObjectives: [{ id: "find-clue", text: "단서를 조사한다." }],
  branchChoices: [
    { id: "return", label: "돌려준다", lines: ["왕관을 돌려준다."] },
    { id: "keep", label: "간직한다", lines: ["왕관을 숨긴다."] },
  ],
  twist: { enabled: false, flagId: "qa-crown-twist", description: "", discoverInBranchId: "", reveal: [] },
});

drive(project, "give_starter_monsters", "바닥 호수 위 스타팅 몬스터 이벤트", [{ x: 15, y: 14 }], {
  speciesIds,
  actorEvent: { mapId: START_MAP_ID, eventId: "ev_qa_starter", x: 15, y: 14 },
});

drive(project, "script_cutscene", "강 위 playerTouch 컷신", [{ x: 8, y: 6 }], {
  mapId: START_MAP_ID,
  eventId: "ev_qa_cutscene",
  x: 8,
  y: 6,
  trigger: "playerTouch",
  beats: [{ kind: "say", speaker: "나", text: "물소리가 들린다." }],
});

drive(project, "compile_puzzle", "물 발판 + 완전 봉쇄 발판 push-switches", [{ x: 4, y: 7 }, { x: 2, y: 2 }, { x: 6, y: 3 }], {
  mapId: START_MAP_ID,
  puzzleId: "qa_water_plates",
  kind: "push-switches",
  plates: [{ at: { x: 4, y: 7 } }, { at: { x: 2, y: 2 } }, { at: { x: 6, y: 3 } }],
  all: true,
  onSolve: { setSwitch: "sw_qa_plates_solved" },
});

// copy_map_region: 원본은 **마른 땅**에 두고 목적지만 물로 만든다. 검증 대상은 «목적지가 물일 때
// 복제 이벤트가 어디에 앉는가» 이므로, 원본까지 벽 안에 심으면 픽스처가 스스로 도달 불가
// 이벤트를 만들어 제품 결함으로 오인된다(실측: ev_qa_copy_source 가 event-unreachable 로 잡혔다).
// 원본 이벤트도 직접 push 하지 않고 실제 툴로 만든다 — 하네스가 계약을 우회하면 안 된다.
getTool("create_map")!.run(project, { id: COPY_TARGET_MAP_ID, name: "복사 대상", width: 20, height: 15 });
const copyTarget = project.maps[COPY_TARGET_MAP_ID];
paintRect(copyTarget, { x: 8, y: 8, w: 3, h: 3 }, TILE.WATER);
drive(project, "upsert_event", "복사 원본 밟기형 이벤트(마른 땅)", [{ x: 17, y: 3 }], {
  mapId: START_MAP_ID,
  event: {
    id: "ev_qa_copy_source",
    x: 17,
    y: 3,
    trigger: { kind: "playerTouch" },
    commands: [{ kind: "text", body: "복사 원본." }],
  },
});
drive(project, "copy_map_region", "이벤트 포함 복사 → 목적지 물 위", [{ x: 9, y: 9 }], {
  from: { mapId: START_MAP_ID, x: 16, y: 2, w: 3, h: 3 },
  to: { mapId: COPY_TARGET_MAP_ID, x: 8, y: 8 },
  layers: "upper",
  withEvents: true,
});

// ── 3. 툴별 실측 표 ────────────────────────────────────────────────────────
console.log("=== 툴별 실측: 요청 좌표 → 최종 이벤트 좌표 ===");
for (const run of runs) {
  console.log(`- ${run.tool} — ${run.aim}`);
  console.log(`    요청: ${fmtCells(run.requested)}`);
  if (run.error) {
    console.log(`    ToolError: ${run.error}`);
  } else {
    const landed = run.created.length > 0
      ? run.created.map((entry) => `${entry.id}@(${entry.x},${entry.y}) passable=${entry.passable}${entry.mapId !== START_MAP_ID ? ` [${entry.mapId}]` : ""}`).join("\n              ")
      : "(새 이벤트 없음 — 기존 이벤트 수정)";
    console.log(`    최종: ${landed}`);
    console.log(`    생성 ${run.createdReported}개 / 스킵 ${run.skippedReported}개`);
  }
  for (const warning of run.warnings) console.log(`    warning: ${warning}`);
}
console.log("");

// move_event 는 기존 이벤트를 옮기므로 차분에 안 잡힌다 — 직접 확인한다.
const mover = map.events.find((event) => event.id === "ev_qa_mover");
if (mover) {
  console.log(`move_event 후 ev_qa_mover: (${mover.x},${mover.y}) passable=${isPassable(project, map, mover.x, mover.y)}`);
}
const totalEvents = Object.values(project.maps).reduce((sum, entry) => sum + entry.events.length, 0);
const impassableEvents = Object.values(project.maps).flatMap((entry) =>
  entry.events
    .filter((event) => !isPassable(project, entry, event.x, event.y))
    .map((event) => `${entry.id} ${event.id} (${event.x},${event.y}) trigger=${event.trigger?.kind ?? "-"}`),
);
console.log(`총 이벤트 ${totalEvents}개, 통행 불가 칸 위 이벤트 ${impassableEvents.length}개`);
for (const line of impassableEvents) console.log(`  통행 불가 위: ${line}  ← action 상호작용이면 계약상 허용`);
console.log("");

// ── 4. projectLint code 별 건수 ────────────────────────────────────────────
const issues: LintIssue[] = projectLint(project);
const counts = new Map<string, { error: number; warning: number; info: number }>();
for (const issue of issues) {
  const bucket = counts.get(issue.code) ?? { error: 0, warning: 0, info: 0 };
  if (issue.severity === "error") bucket.error += 1;
  else if (issue.severity === "warning") bucket.warning += 1;
  else bucket.info += 1;
  counts.set(issue.code, bucket);
}
console.log("=== projectLint code 별 건수 ===");
if (counts.size === 0) {
  console.log("  (이슈 없음)");
} else {
  const width = Math.max(...[...counts.keys()].map((code) => code.length));
  for (const [code, bucket] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${code.padEnd(width)}  error=${bucket.error} warning=${bucket.warning} info=${bucket.info}`);
  }
}
console.log(`  총 ${issues.length}건`);
console.log("");

const BLOCKING_CODES = ["playerTouch-impassable", "event-unreachable"];
const blocking = issues.filter((issue) => BLOCKING_CODES.includes(issue.code));
console.log("=== 차단 코드 (playerTouch-impassable / event-unreachable) ===");
if (blocking.length === 0) {
  console.log("  없음 — 모든 밟기형 이벤트가 통행 가능 칸 위에 있고 모든 이벤트에 접근할 수 있다.");
} else {
  for (const issue of blocking) console.log(`  ${issue.code} ${issue.mapId} (${issue.x}, ${issue.y}) — ${issue.message}`);
}

const exitCode = blocking.length > 0 || !fixtureOk ? 1 : 0;
console.log("");
console.log(`RESULT: ${exitCode === 0 ? "PASS" : "FAIL"} — 차단 이슈 ${blocking.length}건, 픽스처 ${fixtureOk ? "OK" : "FAIL"}`);
process.exit(exitCode);
