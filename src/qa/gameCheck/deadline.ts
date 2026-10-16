// 기한 엔딩 자동 플레이 — onDayEnd 공통 이벤트가 부르는 엔딩(연애 `set_deadline_ending`)을 실제로 걸어 본다.
//
// `runAutoPlay` 의 목표는 「맵 이벤트 페이지 안의 triggerEnding」 뿐이다. 하루가 끝날 때 공통 이벤트가 엔딩을 고르는
// 구조에서는 목표가 하나도 없거나(건너뜀), 뼈대가 남긴 옛 엔딩 하나만 걸어 「막힘 0」 으로 끝났다(2026-10-16 연애 시험:
// 호감 문턱이 막혀 있어도, 엔딩 정의가 통째로 없어도 같은 결과). 여기서는 인물 하나에 집중하는 판들과 아무도 안 만나는 판을
// 헤드리스 러너로 끝까지 돌려, 공통 이벤트가 부르는 엔딩이 하나라도 닿는지·어떤 엔딩이 어떤 판으로 닿는지 센다.
//
// 한계: 인물에게 말 걸기(talkFriendship)만 쓴다(선택지로 시작하는 대화는 첫 선택지를 고른다) — 선택지로 호감을 올리는 엔딩은 맵 이벤트 목표 쪽(runAutoPlay)이 본다.
import { ANY_FRIENDSHIP_KEY, type PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import { canMove, isPassable } from "@/project/collision";
import { isTalkFriendshipEnabled } from "@/project/friendship";
import { resolveSocialLoop } from "@/project/socialLoop";
import { resolveTimeSystem } from "@/project/gameTime";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { allPages, commandList, conditionLeaves, visitPageCommands } from "./walk";
import type { AutoPlayRun, AutoPlayStepTrace, Finding } from "./types";

export interface DeadlineAutoPlay {
  readonly runs: readonly AutoPlayRun[];
  readonly findings: readonly Finding[];
}

const MAX_DAYS = 40;

/** onDayEnd 공통 이벤트가 부르는 엔딩 id(이름 없는 triggerEnding 은 빈 문자열). 없으면 null. */
export function deadlineEndingIds(project: Project): string[] | null {
  const hook = resolveTimeSystem(project)?.onDayEnd;
  if (!hook) return null;
  const common = (project.commonEvents ?? []).find((entry) => entry.id === hook);
  if (!common) return null;
  const ids = new Set<string>();
  for (const page of allPages(project)) {
    if (page.commonEventId !== common.id) continue;
    visitPageCommands({ ...page, commands: commandList(common.commands) }, (visit) => {
      if (visit.command.kind === "triggerEnding") ids.add(typeof visit.command.endingId === "string" ? visit.command.endingId : "");
    });
  }
  return ids.size ? [...ids] : null;
}

type Npc = { readonly mapId: string; readonly eventId: string; readonly name: string; readonly characterId: string; readonly x: number; readonly y: number };

function talkers(project: Project): Npc[] {
  const out: Npc[] = [];
  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const event of map.events ?? []) {
      if (isTalkFriendshipEnabled(event) && event.characterId) out.push({ mapId, eventId: event.id, name: event.name ?? event.id, characterId: event.characterId, x: event.x, y: event.y });
    }
  }
  return out;
}

function standBeside(project: Project, mapId: string, x: number, y: number): { x: number; y: number; facing: "up" | "down" | "left" | "right" } | undefined {
  const map = project.maps[mapId];
  if (!map) return undefined;
  for (const [dx, dy, facing] of [[0, 1, "up"], [0, -1, "down"], [-1, 0, "right"], [1, 0, "left"]] as const) {
    const sx = x + dx, sy = y + dy;
    if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) continue;
    if (isPassable(project, map, sx, sy) && canMove(project, map, sx, sy, x, y)) return { x: sx, y: sy, facing };
  }
  return undefined;
}

function hasChoices(project: Project, npc: Npc): boolean {
  const event = project.maps[npc.mapId]?.events.find((entry) => entry.id === npc.eventId);
  return !!event && JSON.stringify(event.pages ?? []).includes('"kind":"choices"');
}

/** 한 판: 인물(characterId)에 집중하거나(null = 아무도 안 만남) 하루 칸을 다 쓰며 기한 엔딩이 올 때까지. */
function playStrategy(project: Project, focus: Npc | null, slots: number): AutoPlayRun {
  const started = Date.now();
  const label = focus ? `기한 엔딩 — ${focus.name}에게 집중` : "기한 엔딩 — 아무도 안 만남";
  const steps: AutoPlayStepTrace[] = [];
  let session: PlaySession | undefined;
  let scenes = 0;
  const run = (list: SceneStep[]) => {
    scenes += 1;
    const result = runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps: list }, undefined, session ? { initialSession: session } : {});
    session = result.session;
    return result;
  };
  const fail = (detail: string): AutoPlayRun => ({
    label, ok: false, steps, sceneSteps: scenes, runs: scenes, ms: Date.now() - started,
    failure: steps.at(-1) ?? { goal: label, ok: false, detail },
  });
  const day = () => session?.gameTime?.day ?? 0;
  let result = run([]);
  for (let n = 1; n <= MAX_DAYS; n += 1) {
    const dayStart = day();
    for (let slot = 0; focus && slot < slots; slot += 1) {
      const at = session?.eventLocations?.[focus.eventId] ?? { mapId: focus.mapId, x: focus.x, y: focus.y };
      const stand = standBeside(project, at.mapId, at.x, at.y);
      if (!stand) {
        steps.push({ goal: `${n}일째 ${focus.name} 만나기`, ok: false, detail: `${focus.name}이 선 자리(${at.mapId} ${at.x},${at.y}) 옆에 설 통행 칸이 없습니다.`, mapId: at.mapId, x: at.x, y: at.y });
        return fail("옆에 설 칸 없음");
      }
      const approach: SceneStep[] = [{ kind: "set", mapId: at.mapId, x: stand.x, y: stand.y, facing: stand.facing }, { kind: "interact", eventId: focus.eventId }];
      // 선택지로 시작하는 대화는 첫 선택지를 골라야 끝난다(끝나야 호감이 오른다). 선택지가 없으면 choose 가 거절되니 그대로 다시 한다.
      result = hasChoices(project, focus) ? run([...approach, { kind: "choose", index: 0 }]) : run(approach);
      if (!result.ok && /대기 중 선택지가 없습니다/.test(result.failureReason ?? "")) result = run(approach);
      if (result.finalState.endingsReached.length) break;
      if (!result.ok) {
        steps.push({ goal: `${n}일째 ${focus.name}와 대화`, ok: false, detail: result.failureReason ?? "대화 실패", mapId: at.mapId, x: at.x, y: at.y });
        return fail(result.failureReason ?? "대화 실패");
      }
      if (day() > dayStart) break; // 칸을 다 써 forceSleep 으로 하루가 넘어갔다.
    }
    if (!result.finalState.endingsReached.length && day() === dayStart) result = run([{ kind: "advanceDays", days: 1 }]);
    if (!result.ok && !result.finalState.endingsReached.length) {
      steps.push({ goal: `${n}일째 하루 넘기기`, ok: false, detail: result.failureReason ?? "하루 넘기기 실패" });
      return fail(result.failureReason ?? "하루 넘기기 실패");
    }
    if (result.finalState.endingsReached.length) {
      const ending = result.finalState.endingsReached[0]!;
      const friendship = Object.entries(result.finalState.friendship).map(([key, value]) => `${key} ${value}`).join(", ") || "호감 없음";
      steps.push({ goal: `${n}일째 기한 엔딩`, ok: true, detail: `엔딩 ${ending} (${friendship})` });
      return { label, ok: true, endingReached: ending, steps, sceneSteps: scenes, runs: scenes, ms: Date.now() - started };
    }
  }
  steps.push({ goal: `${MAX_DAYS}일 안에 엔딩`, ok: false, detail: `${MAX_DAYS}일을 보내도 기한 엔딩이 오지 않았습니다 (경과일 ${result.finalState.variables.var_days_elapsed ?? "?"})` });
  return fail("기한 안에 엔딩 없음");
}

/** 기한 판정 공통 이벤트의 호감 문턱 잎(npcKey 없으면 「*」). 문턱 상태 모의의 재료다. */
function deadlineFriendshipLeaves(project: Project): { readonly npcKey: string; readonly value: number }[] {
  const hook = resolveTimeSystem(project)?.onDayEnd;
  const common = (project.commonEvents ?? []).find((entry) => entry.id === hook);
  if (!common) return [];
  const out: { npcKey: string; value: number }[] = [];
  for (const page of allPages(project)) {
    if (page.commonEventId !== common.id) continue;
    visitPageCommands({ ...page, commands: commandList(common.commands) }, (visit) => {
      if (visit.command.kind !== "fork") return;
      for (const leaf of conditionLeaves(visit.command.condition)) {
        if (leaf.kind === "friendshipAtLeast" && typeof leaf.value === "number") {
          out.push({ npcKey: typeof leaf.npcKey === "string" && leaf.npcKey.trim() ? leaf.npcKey.trim() : ANY_FRIENDSHIP_KEY, value: leaf.value });
        }
      }
    });
  }
  return out;
}

/** 한 판: 호감을 처음부터 정해 둔 채(만나지 않고) 기한 엔딩이 올 때까지 하루를 넘긴다 — 문턱 분기를 하나씩 직접 연다. */
function playPreset(project: Project, friendship: Record<string, number>, label: string): AutoPlayRun {
  const started = Date.now();
  const steps: AutoPlayStepTrace[] = [];
  let scenes = 0;
  let session: PlaySession | undefined;
  const run = (list: SceneStep[]) => {
    scenes += 1;
    const result = runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps: list }, undefined, session ? { initialSession: session } : {});
    session = result.session;
    return result;
  };
  let result = run([]);
  session = { ...session!, friendship: { ...friendship } } as PlaySession;
  for (let n = 1; n <= MAX_DAYS; n += 1) {
    result = run([{ kind: "advanceDays", days: 1 }]);
    if (result.finalState.endingsReached.length) {
      const ending = result.finalState.endingsReached[0]!;
      steps.push({ goal: `${n}일째 기한 엔딩`, ok: true, detail: `엔딩 ${ending} (호감 ${Object.entries(friendship).map(([key, value]) => `${key} ${value}`).join(", ") || "없음"})` });
      return { label, ok: true, endingReached: ending, steps, sceneSteps: scenes, runs: scenes, ms: Date.now() - started };
    }
    if (!result.ok) {
      steps.push({ goal: `${n}일째 하루 넘기기`, ok: false, detail: result.failureReason ?? "하루 넘기기 실패" });
      break;
    }
  }
  steps.push({ goal: `${MAX_DAYS}일 안에 엔딩`, ok: false, detail: `${label}: ${MAX_DAYS}일을 보내도 기한 엔딩이 오지 않았습니다` });
  return { label, ok: false, steps, sceneSteps: scenes, runs: scenes, ms: Date.now() - started, failure: steps.at(-1)! };
}

export function runDeadlineAutoPlay(project: Project): DeadlineAutoPlay | null {
  const defined = deadlineEndingIds(project);
  if (!defined) return null;
  const slots = resolveSocialLoop(project)?.slotsPerDay ?? 3;
  const npcs = talkers(project);
  // 문턱 상태 모의: 호감 문턱마다 「딱 그만큼」·「한 칸 모자람」 으로 시작해 하루를 넘긴다 — 인물 한 명에 집중한 판만으로는 평범처럼 중간 문턱 엔딩에 못 닿는다.
  const leaves = deadlineFriendshipLeaves(project);
  const anyPerson = npcs[0]?.characterId ?? "__someone";
  const presetStates = new Map<string, Record<string, number>>();
  for (const leaf of leaves) {
    const key = leaf.npcKey === ANY_FRIENDSHIP_KEY ? anyPerson : leaf.npcKey;
    for (const value of [leaf.value, leaf.value - 1]) {
      if (value >= 0) presetStates.set(`${key}=${value}`, { [key]: value });
    }
  }
  const presets = [...presetStates.entries()].slice(0, 8).map(([label, friendship]) => playPreset(project, friendship, `기한 엔딩 — 호감 ${label}에서 시작`));
  const runs = [...npcs.map((npc) => playStrategy(project, npc, slots)), playStrategy(project, null, slots), ...presets];
  const reached = new Set(runs.filter((run) => run.ok && run.endingReached).map((run) => run.endingReached!));
  const findings: Finding[] = [];
  if (reached.size === 0) {
    const why = runs.map((run) => `${run.label}: ${run.failure?.detail ?? "엔딩 없음"}`).join(" / ");
    findings.push({ severity: "blocker", code: "deadline-ending-unreachable", message: `onDayEnd 공통 이벤트가 엔딩을 고르지만 어떤 판으로도 끝까지 가지 못합니다 — ${why}`.slice(0, 600) });
  } else {
    const named = defined.filter((id) => id);
    const missing = named.filter((id) => !reached.has(id));
    if (missing.length) {
      findings.push({ severity: "warning", code: "deadline-ending-unplayed", message: `기한 엔딩 ${missing.join(", ")} 은(는) 인물 집중·아무도 안 만남·호감 문턱 상태 어느 판으로도 닿지 않았습니다(닿은 엔딩: ${[...reached].join(", ")}). 문턱이 너무 높거나 그 인물을 만날 수 없는지 확인하세요.` });
    }
  }
  return { runs, findings };
}
