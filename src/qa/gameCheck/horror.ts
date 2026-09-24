// 추격 호러 장르 검사 — 「끝까지 가나」 다음 질문, 「쫓기는 게 무섭고 공정한가」 를 데이터로 짚는다.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고/참고다.
// 2026-09-24 도그푸딩 「잿빛 저택의 술래」 에서 찾은 것:
//   - 추격자가 speed 3 (한 칸 960ms, 주인공 걷기의 1/6)로 걸어와 걸어서도 따돌렸다.
//   - 옷장 은신이 선택지+「추격 스위치 끄기」 대사였다(진짜 은신처 interaction 아님) — 아무 때나 숨으면 괴물이 사라진다.
//   - 시야(lastSeen) 추격자는 벽 너머의 주인공을 영영 쫓지 않았다 — 「금고를 열자 달려온다」 가 조용히 무위.
//   - 금고 암호 선택지에 「(서재 쪽지의 암호)」 라고 정답이 적혀 있었다.
//   - 「어둡고 긴장감 있게」 인데 조명이 기본(밝음)이었다.

import { canMove, isPassable } from "@/project/collision";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import type { Finding } from "./types";
import { allPages, visitAllCommands, type RawCommand } from "./walk";

const CHASE_BRIEF = /추격|쫓아|쫓기|술래|chase|pursu/iu;
const HIDE_BRIEF = /숨(?:기|어|는|을|을 곳)|옷장|은신|hide|hiding|closet/iu;
const DARK_BRIEF = /어둡|어두운|암흑|dark/iu;
const CODE_BRIEF = /암호|비밀번호|자물쇠 번호|다이얼|code|password/iu;
const ANSWER_LEAK = /[(（][^)）]*(정답|암호|쪽지|힌트|진범|올바른|맞는)[^)）]*[)）]/u;
/** 주인공 걷기 한 칸(PlayScene.moveDurationMs). */
const PLAYER_STEP_MS = 160;

function rank(value: number | undefined): number {
  return Number.isFinite(value) ? Math.min(8, Math.max(1, Math.trunc(value!))) : 3;
}

/** 런타임 추격 한 칸 = npcMoveDurationMs(speed) + 이동 간격(moveIntervalMs 또는 frequency). */
export function chaserStepMs(movement: EventPage["movement"]): number {
  const tween = Math.max(80, 640 - rank(movement.speed) * 80);
  const interval = movement.moveIntervalMs !== undefined
    ? Math.max(80, Math.min(10000, Math.round(movement.moveIntervalMs)))
    : Math.max(80, 1040 - rank(movement.frequency) * 160);
  return tween + interval;
}

interface ChaserRef { readonly map: GameMap; readonly event: GameEvent; readonly page: EventPage; readonly pageIndex: number }

function chasers(project: Project): ChaserRef[] {
  const out: ChaserRef[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      (event.pages ?? []).forEach((page, pageIndex) => {
        if (page.movement?.type === "chase") out.push({ map, event, page, pageIndex });
      });
    }
  }
  return out;
}

function where(ref: ChaserRef) {
  return { mapId: ref.map.id, mapName: ref.map.name, eventId: ref.event.id, pageIndex: ref.pageIndex, x: ref.event.x, y: ref.event.y };
}

function catches(commands: readonly RawCommand[]): boolean {
  let found = false;
  const walk = (list: readonly RawCommand[]) => {
    for (const command of list) {
      if (command.kind === "killPlayer" || command.kind === "gameOver" || command.kind === "battleProcessing") found = true;
      for (const key of ["then", "else", "body"]) if (Array.isArray(command[key])) walk(command[key] as RawCommand[]);
      if (Array.isArray(command.options)) for (const option of command.options as { branch?: RawCommand[] }[]) if (Array.isArray(option?.branch)) walk(option.branch);
    }
  };
  walk(commands as RawCommand[]);
  return found;
}

/** 칸 사이 걸음으로 닿는 칸들(4방향, canMove). */
function reachable(project: Project, map: GameMap, from: { x: number; y: number }, limit = 4000): Map<string, number> {
  const seen = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const queue = [{ ...from, d: 0 }];
  while (queue.length && seen.size < limit) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cur.x + dx, ny = cur.y + dy, key = `${nx},${ny}`;
      if (seen.has(key) || !canMove(project, map, cur.x, cur.y, nx, ny)) continue;
      seen.set(key, cur.d + 1);
      queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return seen;
}

/** 주인공이 이 맵에서 서 있게 되는 칸: 시작 위치와 이 맵으로 오는 문의 착지점. */
function playerEntries(project: Project, map: GameMap): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (project.startMapId === map.id && project.startPos) out.push({ x: project.startPos.x, y: project.startPos.y });
  visitAllCommands(project, ({ command }) => {
    if (command.kind === "transfer" && command.mapId === map.id && typeof command.x === "number" && typeof command.y === "number") out.push({ x: command.x, y: command.y });
  });
  return out;
}

function simulateCapture(project: Project, ref: ChaserRef, stand: { x: number; y: number }): { caught: boolean; retried?: boolean; reason?: string } {
  const switches: Record<string, boolean> = {};
  for (const condition of ref.page.conditions ?? []) if (condition.kind === "switch") switches[condition.switchId] = condition.value !== false;
  const steps: SceneStep[] = [
    { kind: "set", x: stand.x, y: stand.y, switches },
    { kind: "wait", ticks: Math.round(30000 / 16) },
    { kind: "expect", gameOver: true },
  ];
  const result = runSceneTest(project, { mapId: ref.map.id, start: stand, steps });
  return result.ok ? { caught: true } : { caught: false, ...(result.failureReason ? { reason: result.failureReason } : {}) };
}

export function checkHorror(project: Project, briefText: string): Finding[] {
  const isHorror = project.system?.genre === "horror-chase"
    || project.gameDesignBrief?.presetId === "school-horror" || project.gameDesignBrief?.presetId === "horror-gallery";
  if (!isHorror && !CHASE_BRIEF.test(briefText)) return [];
  const findings: Finding[] = [];
  const list = chasers(project);
  const hidingPages = allPages(project).filter((page) => page.page?.interaction?.kind === "hiding");

  if (CHASE_BRIEF.test(briefText) && list.length === 0) {
    findings.push({ severity: "warning", code: "horror-no-chaser", message: "기획은 쫓아오는 존재가 있는데 추격(movement chase) 이벤트가 하나도 없습니다." });
  }
  let checkpointSaves = 0;
  let inputNumbers = 0;
  const fakeHides: RawCommand[] = [];
  visitAllCommands(project, ({ command, where: at }) => {
    if (command.kind === "checkpointSave") checkpointSaves += 1;
    if (command.kind === "inputNumber") inputNumbers += 1;
    if (command.kind === "choices" && Array.isArray(command.options)) {
      for (const option of command.options as { text?: unknown }[]) {
        const text = typeof option?.text === "string" ? option.text : "";
        if (ANSWER_LEAK.test(text)) findings.push({ severity: "warning", code: "choice-answer-leak", message: `선택지 「${text}」 가 정답을 괄호로 알려 줍니다 — 퍼즐이 풀 것 없이 끝납니다.`, where: at });
        if (/숨는다|숨기|숨어|들어간다/u.test(text)) {
          fakeHides.push(command);
          if (hidingPages.length > 0) findings.push({ severity: "warning", code: "fake-hiding-choice", where: at,
            message: `「${text}」 선택지는 진짜 은신처가 아니라 대사로 숨는 흉내입니다 — 추격 중이 아니어도 숨고 추격자는 보지 않습니다. 이 칸도 make_chase_scene hidingSpots(다른 방이면 mapId)로.` });
        }
      }
    }
  });

  for (const ref of list.slice(0, 6)) {
    const step = chaserStepMs(ref.page.movement);
    const ratio = PLAYER_STEP_MS / step;
    if (ratio < 0.5) {
      findings.push({ severity: "warning", code: "chaser-too-slow", where: where(ref),
        message: `추격자 한 칸 ${step}ms — 주인공 걷기(${PLAYER_STEP_MS}ms)의 ${Math.round(ratio * 100)}% 라 걸어서도 쉽게 따돌립니다(speed ${ref.page.movement.speed}, frequency ${ref.page.movement.frequency}).` });
    }
    if (!catches(ref.page.commands as unknown as RawCommand[]) || !["eventTouch", "playerTouch"].includes(ref.page.trigger?.kind ?? "")) {
      findings.push({ severity: "warning", code: "chaser-harmless", where: where(ref), message: "추격자가 닿아도 아무 일이 없습니다(eventTouch/playerTouch 에 killPlayer·gameOver·전투가 없음)." });
    }
    const pursuit = ref.page.movement.pursuit;
    const sight = ref.page.movement.sight?.range ?? ref.page.movement.sightRange;
    if (pursuit && pursuit.tracking !== "persistent") {
      findings.push({ severity: "info", code: "chaser-sight-only", where: where(ref),
        message: `추격자는 주인공을 직접 봐야 쫓습니다(tracking ${pursuit.tracking ?? "lastSeen"}, 시야 ${sight ?? 8}칸, 벽이 가림). 벽 너머에서 스위치로 깨운 추격이면 persistent 가 아니면 가만히 서 있습니다.` });
    }
    // 닿을 수 있나: 추격자 칸에서 걸어 주인공이 서는 칸에 닿는가.
    const from = { x: ref.event.x, y: ref.event.y };
    const chaserCells = reachable(project, ref.map, from);
    const entries = playerEntries(project, ref.map);
    const entryReach = entries.map((entry) => chaserCells.get(`${entry.x},${entry.y}`)).filter((d): d is number => d !== undefined);
    if (entries.length > 0 && entryReach.length === 0) {
      findings.push({ severity: "warning", code: "chaser-cannot-reach", where: where(ref), message: "추격자 자리에서 걸어서는 주인공이 이 맵에 들어오는 칸에 닿지 못합니다(벽·가구에 갇힘)." });
    }
    // 실제로 붙잡는가: 헤드리스 런타임에서 가까운 칸에 세워 두고 30초.
    const stand = [...chaserCells.entries()].filter(([, d]) => d >= 4 && d <= 8).map(([key]) => key.split(",").map(Number) as [number, number])
      .find(([x, y]) => isPassable(project, ref.map, x, y));
    if (stand) {
      const outcome = simulateCapture(project, ref, { x: stand[0], y: stand[1] });
      if (!outcome.caught) {
        findings.push({ severity: "warning", code: "chaser-never-catches", where: where(ref),
          message: `추격을 켜고 ${stand[0]},${stand[1]} 에 30초 서 있어도 붙잡히지 않았습니다${outcome.reason ? ` — ${outcome.reason}` : ""}.` });
      }
    }
  }
  if (list.some((ref) => catches(ref.page.commands as unknown as RawCommand[]))) {
    const outcome = project.system?.gameOver?.outcome;
    if (checkpointSaves === 0 && outcome !== "recover") {
      findings.push({ severity: "warning", code: "capture-no-retry", message: "붙잡히면 게임 오버인데 체크포인트 저장(checkpointSave)이 하나도 없습니다 — 매번 타이틀부터 다시 합니다." });
    }
  }
  if (HIDE_BRIEF.test(briefText) && hidingPages.length === 0) {
    findings.push({ severity: "warning", code: "horror-no-hiding",
      message: `기획은 숨어서 피하는데 진짜 은신처(interaction hiding)가 없습니다${fakeHides.length ? ` — 「숨는다」 선택지 ${fakeHides.length}곳이 대사로 흉내만 냅니다(추격 중이 아니어도 숨고, 추격자는 숨은 걸 보지 않습니다)` : ""}. make_chase_scene hidingSpots 로 만든다.` });
  }
  const chaserMaps = new Set(list.map((ref) => ref.map.id));
  for (const page of hidingPages) {
    const connected = list.some((ref) => ref.page.movement.pursuit?.scope === "connected");
    if (page.map && !chaserMaps.has(page.map.id) && !connected) {
      findings.push({ severity: "info", code: "hiding-without-chaser", message: "추격자가 없는 맵의 은신처입니다.", where: { mapId: page.map.id, eventId: page.event?.id, x: page.event?.x, y: page.event?.y } });
    }
  }
  if (DARK_BRIEF.test(briefText)) {
    const lit = (map: GameMap) => { const ambient = (map as { defaultLighting?: { ambient?: number } }).defaultLighting?.ambient; return typeof ambient === "number" && ambient < 0.75; };
    let lightingCommands = 0;
    visitAllCommands(project, ({ command }) => { if (command.kind === "setLighting" || command.kind === "tintScreen") lightingCommands += 1; });
    const dark = [...chaserMaps].some((id) => project.maps[id] && lit(project.maps[id]!)) || Object.values(project.maps).some(lit);
    if (!dark && lightingCommands === 0) findings.push({ severity: "warning", code: "horror-not-dark", message: "기획은 어두운 분위기인데 어느 맵에도 어두운 조명(defaultLighting ambient<0.75)·조명 명령이 없습니다." });
  }
  if (CODE_BRIEF.test(briefText) && inputNumbers === 0) {
    findings.push({ severity: "info", code: "code-as-choices", message: "기획에 암호·비밀번호 퍼즐이 있는데 숫자 입력(inputNumber) 명령이 없습니다 — 선택지로 고르게 했다면 보기에서 정답을 맞힐 수 있습니다." });
  }
  return findings;
}
