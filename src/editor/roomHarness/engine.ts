/**
 * Room Harness 공유 세션 엔진 — 킷(interior/dungeon/…) 공통 오케스트레이션.
 * 세션 저장/로드, advance 루프, 맵트리 등록, 원샷 파이프라인, 평가를 한 곳에서 담당한다.
 * 툴 파일은 이 함수들을 kitId로 호출하는 얇은 래퍼가 된다(툴 이름은 키트별 유지).
 */
import { getRoomKit } from "./registry";
import type { RoomHarnessBag, RoomSession } from "./types";
import { ToolError, type ToolExecResult } from "@/editor/tools/types";
import type { Project } from "@/project/types";

function bagOf(project: Project): RoomHarnessBag {
  return project as Project & RoomHarnessBag;
}

export function saveRoomSession(project: Project, session: RoomSession): void {
  const bag = bagOf(project);
  bag.roomHarnessSessions = { ...(bag.roomHarnessSessions ?? {}), [session.id]: session };
}
const saveSession = saveRoomSession;

export function loadRoomSession(project: Project, sessionId: string): RoomSession | null {
  return bagOf(project).roomHarnessSessions?.[sessionId] ?? null;
}

// 세션이 만든 맵은 맵 트리에도 올라가야 에디터 맵 목록/전환 UI에 보인다(mapTools create_map 관례).
function registerMapInTree(draft: Project, mapId: string): void {
  if (!draft.maps[draft.mapTree.mapId]) {
    draft.mapTree = { mapId, children: [] };
  } else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some((child) => child.mapId === mapId)) {
    draft.mapTree.children.push({ mapId, children: [] });
  }
}

function requireKit(kitId: string) {
  const kit = getRoomKit(kitId);
  if (!kit) throw new ToolError(`알 수 없는 하네스 킷: ${kitId}`, { code: "invalid-args" });
  return kit;
}

/** 멀티턴 세션 시작 — 빈 맵 + 체크리스트 생성. */
export function startRoomSession(project: Project, kitId: string, args: Record<string, unknown>): ToolExecResult {
  const kit = requireKit(kitId);
  kit.ensureHarness(project);
  const plan = kit.parsePlan(args);
  const mapId = kit.mapIdOf(plan);
  const sessionId = `room_${kit.kitId}_${mapId}_${Date.now().toString(36)}`;
  const checklist: RoomSession["checklist"] = Object.fromEntries(
    kit.buildOrder.map((l) => [l, l === "plan" ? "done" : "open"]),
  );
  const map = kit.createEmptyMap(plan);
  project.maps[mapId] = map;
  registerMapInTree(project, mapId);
  const session: RoomSession = {
    id: sessionId,
    kitId: kit.kitId,
    plan,
    checklist,
    mapId,
    log: [kit.startLog?.(plan) ?? `[plan] ${mapId}`],
  };
  saveSession(project, session);
  return {
    summary: `${kit.kitId} 세션 ${sessionId} 시작 · map=${mapId}`,
    data: { sessionId, kitId: kit.kitId, plan, checklist, buildOrder: kit.buildOrder, nextLayer: kit.buildOrder.find((l) => l !== "plan") ?? null },
  };
}

/** 세션 체크리스트의 다음 open 레이어 하나를 시공/검증. */
export function advanceRoomBuild(project: Project, sessionId: string, forceLayer?: string): ToolExecResult {
  const session = loadRoomSession(project, sessionId);
  if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
  const kit = requireKit(session.kitId);
  kit.ensureHarness(project);
  const layer = forceLayer ?? kit.buildOrder.find((l) => l !== "plan" && session.checklist[l] === "open");
  if (!layer) {
    return { summary: "모든 레이어 완료", data: { sessionId, checklist: session.checklist, done: true } };
  }
  const map = project.maps[session.mapId];
  if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
  const result = kit.applyLayer(map, session.plan, layer);
  project.maps[session.mapId] = result.map;
  session.checklist[layer] = result.ok ? "done" : "failed";
  session.log.push(`[${layer}] ${result.summary}`);
  saveSession(project, session);
  const nextLayer = kit.buildOrder.find((l) => session.checklist[l] === "open") ?? null;
  return {
    summary: result.summary,
    warnings: [...result.warnings],
    data: { sessionId, layer, ok: result.ok, warnings: result.warnings, checklist: session.checklist, nextLayer, done: !nextLayer },
  };
}

/** 원샷 파이프라인 — 모든 레이어 시공. args.demo 지정 시 데모 플랜 사용. */
export function runRoomPipeline(project: Project, kitId: string, args: Record<string, unknown>): ToolExecResult {
  const kit = requireKit(kitId);
  kit.ensureHarness(project);
  const demo = args.demo ? String(args.demo) : "";
  let plan;
  if (demo) {
    const found = kit.demoMatch?.(demo) ?? kit.demoPlans.find((p) => (p as { theme?: string }).theme === demo);
    if (!found) throw new ToolError(`unknown demo ${demo}`, { code: "invalid-args" });
    plan = found;
    if (args.mapId || args.name) {
      plan = { ...(found as Record<string, unknown>), ...(args.mapId ? { mapId: String(args.mapId) } : {}), ...(args.name ? { name: String(args.name) } : {}) } as typeof found;
    }
  } else {
    plan = kit.parsePlan(args);
  }
  const result = kit.runPipeline(plan);
  const mapId = kit.mapIdOf(plan);
  project.maps[mapId] = result.map;
  registerMapInTree(project, mapId);
  return {
    summary: result.ok ? `${kit.kitId} 파이프라인 완료 ${mapId}` : `${kit.kitId} 파이프라인 이슈 ${result.warnings.length}`,
    warnings: [...result.warnings],
    data: { kitId: kit.kitId, mapId, plan, log: result.log, warnings: result.warnings, ok: result.ok },
  };
}

/** 완성 세션 맵 평가. */
export function evaluateRoom(project: Project, sessionId: string, attempt = 1): ToolExecResult {
  const session = loadRoomSession(project, sessionId);
  if (!session) throw new ToolError(`session 없음: ${sessionId}`, { code: "session-not-found" });
  const kit = requireKit(session.kitId);
  if (!kit.evaluate) throw new ToolError(`${kit.kitId}는 평가를 지원하지 않는다`, { code: "invalid-args" });
  const map = project.maps[session.mapId];
  if (!map) throw new ToolError(`map 없음: ${session.mapId}`, { code: "map-not-found" });
  const report = kit.evaluate(map, session.plan, attempt);
  return {
    summary: report.ok ? `${kit.kitId} 평가 합격 (score ${report.score})` : `${kit.kitId} 평가 ${report.issues.length}건 (score ${report.score})`,
    data: { sessionId, mapId: session.mapId, report },
  };
}

/** 킷 데모 플랜 나열. */
export function listRoomDemos(kitId: string): ToolExecResult {
  const kit = requireKit(kitId);
  return { summary: `${kit.kitId} 데모 ${kit.demoPlans.length}종`, data: { kitId: kit.kitId, themes: kit.themes, plans: kit.demoPlans } };
}
