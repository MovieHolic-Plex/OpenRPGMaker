import { createHash } from 'node:crypto';
import { inspectPiVillageCompletion } from "../../src/ai/piAgent/villageCompletion.ts";
import type { PiProjectCheckpoint } from "../../src/ai/piAgent/protocol.ts";
import { buildPiAgentSystemPrompt } from "../../src/ai/piAgent/systemPrompt.ts";
import { inspectFirstPresentation, FIRST_PRESENTATION_INSTRUCTIONS } from '../../src/ai/piAgent/firstPresentation';
import { presentationArtIds } from '../../src/editor/tools/presentationTools';
import { PiTeamMessaging, teamCommunicationPrompt } from "./piTeamMessaging.ts";
import { describeMapSeams, formatSeamIssues, inspectWorldSeams } from "../../src/ai/piAgent/worldSeams.ts";
// Pi 팀 런타임. 팀장 에이전트(orchestrator)가 커스텀 툴로 시공·검수 에이전트를 띄운다.
// 하위 에이전트는 runPiAgent 를 그대로 재사용하고, 시공 결과는 맵 묶음 단위로 작업 사본(working)에
// 도착 순서대로 병합된다.
//
// 배정 계약은 세 가지다.
//
// 1. **맵 in-flight 락** — 코어는 같은 턴의 툴 호출을 병렬로 돌린다(concurrency 기본 "shared").
//    같은 맵에 두 배정이 겹치면 둘 다 병합 전 사본에서 출발해 나중 결과가 앞 결과를 통째로
//    덮었다. 전에는 팀장 프롬프트의 문장 하나가 유일한 방어였다 — 이제 툴이 거절한다.
// 2. **시작/확인 분리** — assign 은 즉시 돌아오고, 팀장은 check_agents 로 중간을 본다.
//    전에는 assign 이 완료까지 await 해서 팀장이 헤매는 팀원을 끝날 때까지 몰랐다.
// 3. **업무 예산과 수정 예산의 분리** — src/ai/piAgent/teamAssignments.ts 참고.
//
// 팀장이 wait 없이 끝나도(턴 상한 등) 런타임이 남은 배정을 거두어 병합한다.

import { mapBundleIds, mergeMapBundles } from "../../src/ai/piAgent/mapBundle.ts";
import { authorMergedSpatialProposal, exportSpatialToolProof } from "../../src/editor/tools/spatialToolState.ts";
import { addPiAgentUsage, changedProjectKeys, restoreCheckpointProject, slimDoneEvent, slimProjectForWire, type PiAgentDoneEvent, type PiAgentUsage, type PiAgentEvent, type PiAgentRequest, type PiTeamRoleId } from "../../src/ai/piAgent/protocol.ts";
import { createModernTilesetPolicy, modernTilesetViolation, requestsModernMap } from '../../src/ai/modernTilesetPolicy.ts';
import { PI_TEAM_ROLES, teamRoleSummaries } from "../../src/ai/piAgent/team.ts";
import { PRESET_FIRST_BUILD_MEMBER_TURNS } from "../../src/ai/piAgent/team.ts";
import { FIRST_PLAY_TOOLS, firstPlayEvents, firstPlaySignature, inspectFirstPlay, type FirstPlayReceipt } from '../../src/ai/piAgent/firstPlay.ts';
import { FIRST_SCENE_INSTRUCTIONS, firstSceneGraphicEvidence, firstSceneObjectCatalog, firstSceneMapIds, firstSceneSignature, inspectFirstScene, inspectFirstScenePlaces } from '../../src/ai/piAgent/firstScene.ts';
import { hasPlayableSegmentSkeleton } from '../../src/project/playableSegmentContract.ts';
import { isGenrePresetBriefRequest } from "../../src/ai/genrePresetBrief.ts";
import { judgePlayableSegment, playableSegmentGateApplies } from "../../src/project/playableSegment.ts";
import { authoringHarnessFor, inspectAuthoringHarness } from '../../src/harnesses/_core/authoringRegistry.ts';
import { ROMANCE_ART_AXES, romanceArtReviewInstructions, romanceArtReviewFindings, romanceArtRepairFindings, romanceTownLayoutFindings } from '../../src/harnesses/romance-scene/artDirection.ts';
import {
  claimAssignment,
  createTeamAssignmentLedger,
  recordTeamReview,
  runningAssignments,
  settleAssignment,
  teamAssignmentBudget,
  type TeamAssignmentLedger,
} from "../../src/ai/piAgent/teamAssignments.ts";
import { plainLine } from "../../src/ai/piAgent/teamBoardState.ts";
import { defaultTeamSpec, enabledMembers, memberSystemPrompt, normalizeTeamSpec, type PiTeamMember } from "../../src/ai/piAgent/teamSpec.ts";
import type { PiToolShape } from "../../src/ai/piAgent/toolAdapter.ts";
import type { Project } from "../../src/project/types.ts";
import { cloneProjectSharingSharedDictionaries } from '../../src/project/projectClone.ts';
import type { RunPiAgentOptions } from "./piAgentRuntime.ts";

export type RunPiAgentFn = (request: PiAgentRequest, options: RunPiAgentOptions) => Promise<PiAgentDoneEvent>;

export interface RunPiTeamOptions extends RunPiAgentOptions {
  /**
   * 하위 에이전트 실행기. 비우면 Bun 전용 runPiAgent 를 지연 임포트한다 — 정적으로 걸면
   * oh-my-pi 코어가 모듈 그래프에 딸려 들어와 Node/vitest 에서 이 파일을 열 수 없다.
   */
  readonly runAgent?: RunPiAgentFn;
}

type AgentState = "실행 중" | "완료" | "실패";

interface AgentProgress {
  turns: number;
  toolCalls: number;
  toolErrors: number;
  lastLine: string;
}

interface AgentOutcome {
  readonly agentId: string;
  readonly mapId: string | null;
  readonly member: string;
  readonly phase: "work" | "fix";
  readonly ok: boolean;
  readonly summary: string;
  readonly changedKeys: readonly string[];
  readonly spills: readonly string[];
  readonly conflicts: readonly string[];
}

interface Inflight {
  readonly agentId: string;
  readonly promise: Promise<AgentOutcome>;
}

function text(body: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }] };
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 는 비어 있지 않은 문자열이어야 합니다`);
  return value.trim();
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim()) : [];
}

/** 팀장 대기의 안전 상한. 이벤트가 끊겨도 팀장이 영영 잠들지 않게만 한다. */
const TEAM_WAIT_SAFETY_MS = 5 * 60_000;
/** 검수 팀원이 의도 목록과 상관없이 쥐는 확인 도구. */
const REVIEW_READ_TOOLS = ["get_map_region", "run_lint", "get_project_summary", "find_tools"] as const;

export async function runPiTeam(request: PiAgentRequest, options: RunPiTeamOptions = {}): Promise<PiAgentDoneEvent> {
  if (request.modernTilesetOnly || requestsModernMap(request.project, request.task, [...request.mapIds, ...(request.currentMapId ? [request.currentMapId] : [])])) request = { ...request, modernTilesetOnly: true, villageContract: undefined };
  // 마을 계약은 단독 실행 전용이다. 팀 요청에 실려 오면 모든 팀원이 author_village 한 호출로만 묶이므로 벗긴다.
  if (request.villageContract) request = { ...request, villageContract: undefined };
  const modernPolicy = request.modernTilesetOnly ? createModernTilesetPolicy(request.project) : undefined;
  const assertModernProposal = (before: Project, after: Project) => {
    const violation = modernPolicy && modernTilesetViolation(before, after, modernPolicy);
    if (violation) throw new Error(violation);
  };
  const runAgent: RunPiAgentFn = options.runAgent ?? (await import("./piAgentRuntime.ts")).runPiAgent;
  const emit = (event: PiAgentEvent) => options.onEvent?.(event);
  const base = request.project;
  let working: Project = cloneProjectSharingSharedDictionaries(base);
  const started = Date.now();
  const counters: Record<PiTeamRoleId, number> = { orchestrator: 0, builder: 0, reviewer: 0 };
  let toolCalls = 0;
  let toolErrors = 0;
  let subTurns = 0;
  let subUsage: PiAgentUsage | undefined;
  let finished: string | null = null;
  let finishAccepted = false;
  const reviewingMaps = new Set<string>();
  const repairingMaps = new Set<string>();
  /**
   * finish 가 이음새 오류로 한 번 거절한 오류 묶음. 같은 묶음으로 다시 부르면 받아 준다 — 고칠 수 없는
   * 연결 때문에 팀이 영원히 못 끝나면 안 된다. 대신 그 오류는 최종 보고에 그대로 남는다.
   */
  let seamRejection: string | null = null;

  const baseTeam = request.team ? normalizeTeamSpec(request.team) : defaultTeamSpec();
  // 프리셋 첫 생성은 가장 작은 플레이 구간만 만든다 — 팀원 한 배정의 턴을 줄인다(PRESET_FIRST_BUILD_RULES 와 짝).
  // 사용자가 팀원마다 정한 값이 더 작으면 그 값을 쓴다.
  const team = isGenrePresetBriefRequest(request.task)
    ? { ...baseTeam, members: baseTeam.members.map((member) => ({ ...member, maxTurns: Math.min(member.maxTurns, PRESET_FIRST_BUILD_MEMBER_TURNS) })) }
    : baseTeam;
  // enabledMembers applies the shared workBudget, which otherwise overwrites
  // the preset cap above. Bound the actual child requests after normalization.
  const boundMember = (member: PiTeamMember): PiTeamMember => isGenrePresetBriefRequest(request.task)
    ? { ...member, maxTurns: Math.min(member.maxTurns, team.members.find(m => m.id === member.id)!.maxTurns) }
    : member;
  const builders = enabledMembers(team, "builder").map(boundMember);
  const reviewers = enabledMembers(team, "reviewer").map(boundMember);
  // 끝낼 수 있는 첫 구간 판정(src/project/playableSegment.ts). 프리셋 첫 생성이고 시작 프로젝트가 합격한 뼈대일 때만 건다 —
  // 되돌릴 합격본이 없으면 finish 를 막을 근거가 없고, 이후 요청은 사용자가 구간을 넓히거나 바꿀 수 있어야 한다.
  const segmentGate = Boolean(authoringHarnessFor(base)) || isGenrePresetBriefRequest(request.task) && playableSegmentGateApplies(base);
  // Bespoke authoring harnesses keep their own stronger contracts. The three
  // seeded genres first author actual play, before the coordinator can decorate.
  const coreFirst = isGenrePresetBriefRequest(request.task) && hasPlayableSegmentSkeleton(base)
    && !authoringHarnessFor(base) && !request.readOnly && !options.readOnlyTools;
  let firstPlay: FirstPlayReceipt | undefined;
  let reviewedFirstPlay: string | undefined;
  let reviewedFirstScene: string | undefined;
  let firstBuildAssignments = 0;
  let segmentRejections = 0;
  // A review belongs to the inspected snapshot, not merely to a map id.
  let authoringReview: { signature: string; ok: boolean } | undefined;
  const authoringSignature = (project: Project): string => createHash('sha256').update(JSON.stringify(project)).digest('hex');
  // 검수 담당을 끄면 팀 메뉴는 「완료 후 검토: 생략」 이라고 보여 준다. 예전 런타임은 여기서 실행 전체를 400 으로
  // 거절해, 메뉴 말과 달리 팀 요청이 전부 실패했다. 메뉴 말대로 생략하고 최종 보고에 남긴다(조용히 끝내지 않는다).
  const skipFinalReview = team.reviewAfterWork === true && reviewers.length === 0;
  if (builders.length === 0) throw Object.assign(new Error("팀에 켜진 시공 팀원이 없습니다. 팀 패널에서 팀원을 켜 주세요."), { status: 400 });

  let ledger: TeamAssignmentLedger = createTeamAssignmentLedger(teamAssignmentBudget(builders.length));
  const mailbox = new PiTeamMessaging(message => emit({ type: "agent_event", agentId: "orchestrator-1", event: { type: "assistant", text: message } }));
  mailbox.register("orchestrator-1", "팀장", null);
  const progress = new Map<string, AgentProgress>();
  const outcomes = new Map<string, AgentOutcome>();
  const inflight: Inflight[] = [];
  const tasks = new Map<string, { mode: "read" | "project"; memberId: string; task: string }>();
  const runningTasks = () => [...tasks.entries()].filter(([id]) => !outcomes.has(id));
  const projectWriter = () => runningTasks().find(([, task]) => task.mode === "project");

  const pickMember = (id: unknown, pool: PiTeamMember[], what: string): PiTeamMember => {
    if (typeof id !== "string" || !id.trim()) return pool[0]!;
    const found = pool.find((member) => member.id === id.trim());
    if (!found) throw new Error(`${what} 팀원 '${id}' 이 없습니다. 가능: ${pool.map((member) => member.id).join(", ")}`);
    return found;
  };
  const candidateMaps = request.mapIds.length > 0 ? [...request.mapIds] : Object.keys(base.maps);
  const mapName = (id: string | null) => (id ? working.maps[id]?.name ?? null : null);
  const child = (agentId: string, provider = request.provider): RunPiAgentOptions => ({
    apiKey: provider === request.provider ? options.apiKey : undefined,
    providerApiKeys: options.providerApiKeys,
    // 웹 검색은 Codex 백엔드가 하므로 조수 제공자와 별개로 내려보낸다 — 팀원이 검색을 못 하면 팀장만 최신 사실을 보고 팀원은 추정하게 된다.
    codexApiKey: options.codexApiKey,
    renderToolImage: options.renderToolImage,
    signal: options.signal,
    extraTools: mailbox.tools(agentId),
    subscribeTeamMessages: notify => {
      const check = () => { if (mailbox.unread(agentId)) notify(); };
      const unsubscribe = mailbox.subscribe(agentId, check);
      check();
      return unsubscribe;
    },
    // 규약: 팀은 하위 에이전트마다 같은 상한이 걸린다. 빠뜨리면 시공·검수가 런타임 기본값으로 돌아 요청의 상한이 팀장에게만 적용된다.
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    onEvent: (event) => {
      const row = progress.get(agentId);
      if (row) {
        if (event.type === "turn") row.turns = event.index;
        else if (event.type === "tool_start") row.toolCalls += 1;
        else if (event.type === "tool_end") {
          if (!event.ok) row.toolErrors += 1;
          row.lastLine = `${event.ok ? "✓" : "✗"} ${event.name} — ${plainLine(event.summary)}`;
        } else if (event.type === "assistant") row.lastLine = plainLine(event.text, 220);
      }
      emit({ type: "agent_event", agentId, event });
    },
  });

  /**
   * 팀원 첫 노출. 도메인을 안 정한 팀원은 예전엔 전체 카탈로그(248개·≈113k 토큰)를 매 호출 받았다.
   * 요청의 의도 선별 목록에서 시작하고 find_tools·직접 호출 폴백으로 넓힌다. 검수는 확인 도구를 늘 쥔다.
   * 목록이 없는 호출자(CLI)는 예전 그대로 전체를 받는다.
   */
  const exposureFor = (member: { readonly toolDomains: readonly string[] }, reviewing: boolean): Pick<PiAgentRequest, "initialToolNames"> => {
    if (member.toolDomains.length > 0 || !request.initialToolNames) return { initialToolNames: undefined };
    return { initialToolNames: [...new Set([...request.initialToolNames, ...(reviewing ? REVIEW_READ_TOOLS : [])])] };
  };

  /**
   * 팀장 대기. 예전엔 10초마다 돌아와 팀장이 전체 문맥을 다시 읽는 한 턴을 썼다 — 10분 시공이면 대기만으로
   * 60턴이 쌓이고 턴마다 문맥이 커졌다. 이제 배정이 끝나거나 팀장 앞 메시지가 올 때만 돌아온다.
   * 팀원 목록 변화(team_changed)는 깨우지 않는다. 안전 상한만 길게 둔다.
   */
  const waitForTeam = async (pending: readonly Promise<unknown>[], signal: AbortSignal): Promise<string> => {
    if (pending.length === 0) return "completed";
    let settled = 0;
    const tracked = pending.map(promise => promise.then(() => { settled += 1; }, () => { settled += 1; }));
    const messages = (async () => {
      for (;;) {
        const reason = await mailbox.wait("orchestrator-1", 30000, signal);
        if (reason === "messages" || reason === "aborted" || signal.aborted) return signal.aborted ? "aborted" : reason;
      }
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const safety = new Promise<string>(resolve => { timer = setTimeout(() => resolve("timeout"), TEAM_WAIT_SAFETY_MS); });
    try {
      const reason = await Promise.race([Promise.race(tracked).then(() => "agent_finished"), messages, safety]);
      if (reason === "agent_finished" || reason === "timeout") {
        // 같은 틱에 끝난 배정을 한데 모은다 — 동시에 끝난 둘을 두 번의 팀장 턴으로 나누지 않는다.
        await new Promise(resolve => setTimeout(resolve, 0));
        if (settled === pending.length) return "completed";
      }
      return reason;
    } finally { clearTimeout(timer); }
  };

  emit({ type: "team_start", task: request.task, roles: teamRoleSummaries() });

  /** 배정 하나의 결과를 작업 사본에 얹는다. 도착 순서대로 동기 실행되므로 서로 끼어들지 않는다. */
  function mergeOutcome(agentId: string, mapId: string, snapshot: Project, done: PiAgentDoneEvent): { spills: string[]; conflicts: string[] } {
    // 지금 다른 맵에서 도는 배정의 맵을 **실제로 바꿨는지** — 남의 작업 구역에 손을 댄 경우다.
    // 묶음 전체로 세면 안 된다: 시작 맵은 트리 루트라 묶음이 곧 모든 맵이고, 손대지 않은 들판까지 충돌로 보고됐다.
    const busyMaps = new Set(runningAssignments(ledger).filter((assignment) => assignment.agentId !== agentId).map((assignment) => assignment.mapId));
    const bundle = new Set([...mapBundleIds(done.project, mapId), ...mapBundleIds(working, mapId)]);
    const touched = [...bundle].filter((id) => JSON.stringify(done.project.maps[id]) !== JSON.stringify(snapshot.maps[id]));
    // 감사 기준은 병합 시점의 working 이 아니라 이 에이전트가 출발한 사본이다. 그 사이 남이
    // 병합한 맵을 이 에이전트의 범위 밖 변경으로 잘못 잡지 않기 위함.
    const merged = mergeMapBundles(working, [{ mapIds: [mapId], project: done.project, base: snapshot }]);
    if (repairingMaps.has(mapId)) {
      const findings = romanceArtRepairFindings(merged.project, snapshot);
      if (findings.length) throw new Error(findings.join(' / '));
    }
    assertModernProposal(working, merged.project);
    working = merged.project;
    const conflicts = [...new Set([...touched.filter((id) => busyMaps.has(id)), ...merged.conflicts])].sort();
    return { spills: merged.spills.flatMap((spill) => [...spill.keys]), conflicts };
  }

  // Only accepted child writes enter the shared team project. Serialize publication across members.
  const villageMapIds = new Set<string>();
  const interiorReports = new Map<string, { mapId: string; issues: readonly unknown[] }>();
  const trackInterior = (done: PiAgentDoneEvent, snapshot: Project) => {
    if (done.interiorCompletion === undefined) return;
    for (const id of Object.keys(done.project.maps)) if (JSON.stringify(done.project.maps[id]) !== JSON.stringify(snapshot.maps[id])) interiorReports.delete(id);
    for (const report of done.interiorCompletion) interiorReports.set(report.mapId, report);
  };
  let publication: Promise<unknown> = Promise.resolve();
  const checkpointFor = (mapId: string | null, snapshot: Project) => async (checkpoint: PiProjectCheckpoint, signal?: AbortSignal): Promise<Project> => {
    const next = publication.then(async () => {
      // 팀원 체크포인트는 안 바뀐 무거운 키(타일셋·DB)를 비워서 온다. 작업 사본에서 다시 붙인 뒤에만
      // 병합·검사한다 — 빈 채로 두면 이 뒤로 배정되는 팀원이 DB 없는 프로젝트에서 출발한다
      // (2026-09-27 프리셋 팀 첫 생성 실측: 시공 팀원들이 「project.database.actors 가 undefined」로 막혔다).
      const incoming = restoreCheckpointProject(working, checkpoint.project, checkpoint.unchangedKeys, checkpoint.unchangedTilesetIds);
      const proposed = mapId
        ? mergeMapBundles(working, [{ mapIds: [mapId], project: incoming, base: snapshot }]).project
        : incoming;
      if (mapId && repairingMaps.has(mapId)) {
        const findings = romanceArtRepairFindings(proposed, snapshot);
        if (findings.length) throw new Error(findings.join(' / '));
      }
      assertModernProposal(working, proposed);
      authorMergedSpatialProposal(proposed, working);
      // 브라우저로는 다시 비워서 보낸다(수십 MB). ACK 도 같은 키를 비워 돌아오므로 받은 뒤 다시 붙인다.
      // 그대로인 타일셋도 뺀다 — 통째로 실으면 마을 한 번에 이 줄이 100MB 가 넘어 브라우저가 30초 동안 한 줄도 못 받았다.
      const wire = slimProjectForWire(working, proposed);
      const { unchangedTilesetIds: _childIds, ...rest } = checkpoint;
      const accepted = await options.onCheckpoint?.({
        ...rest, project: wire.project, unchangedKeys: wire.unchangedKeys,
        ...(wire.unchangedTilesetIds.length ? { unchangedTilesetIds: wire.unchangedTilesetIds } : {}),
        spatialProof: exportSpatialToolProof(proposed),
      }, signal);
      working = cloneProjectSharingSharedDictionaries(restoreCheckpointProject(proposed, accepted ?? proposed, wire.unchangedKeys, wire.unchangedTilesetIds));
      return working;
    });
    publication = next;
    return await next;
  };

  function startAssign(mapId: string, task: string, member: PiTeamMember, reviewRepair = false): AgentOutcome | Record<string, unknown> {
    if (request.readOnly || options.readOnlyTools) throw new Error('읽기 전용 요청에서 맵을 제작할 수 없습니다.');
    if (reviewingMaps.has(mapId) && !reviewRepair) throw new Error(`맵 '${mapId}'의 검수·자동 수정이 진행 중입니다. 완료 후 배정하세요.`);
    if (coreFirst && firstBuildAssignments >= 3) throw new Error('첫 제작의 후속 배정은 3회까지입니다. 핵심 플레이는 이미 작성했습니다. 남은 장식은 다음 할 일로 보고하고 finish 하세요.');
    if (coreFirst) member = { ...member, maxTurns: Math.min(member.maxTurns, 24) };
    if (request.applyMode === "step" && (runningAssignments(ledger).length || runningTasks().length)) throw new Error("단계별 적용은 앞 작업 승인·완료 후 다음 작업을 배정합니다. wait_agents를 먼저 호출하세요.");
    if (projectWriter()) throw new Error("프로젝트 공통 데이터 제작 중입니다. wait_agents 후 맵 작업을 배정하세요.");
    if (!working.maps[mapId]) throw new Error(`맵 '${mapId}' 이 프로젝트에 없습니다. 후보: ${candidateMaps.join(", ")}`);
    const agentId = `builder-${counters.builder + 1}`;
    const claim = claimAssignment(ledger, { mapId, agentId, memberId: member.id });
    if (!claim.ok) throw new Error(claim.reason);
    if (coreFirst) firstBuildAssignments += 1;
    counters.builder += 1;
    ledger = claim.ledger;
    const { phase, fixOf } = claim.assignment;
    progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" });
    emit({
      type: "agent_spawn", agentId, role: "builder", mapId, mapName: mapName(mapId), task,
      memberId: member.id, label: member.label, ...(fixOf ? { fixOf } : {}),
    });
    mailbox.register(agentId, member.label, mapId);
    const snapshot = cloneProjectSharingSharedDictionaries(working);
    const promise = (async (): Promise<AgentOutcome> => {
      try {
        const done = await runAgent(
          {
            ...request, ...exposureFor(member, false), ...request.roleModels?.deep, mode: "single", mapIds: [mapId], project: snapshot, task,
            systemPrompt: [...memberSystemPrompt(member, snapshot, [mapId]), ...describeMapSeams(snapshot, mapId), teamCommunicationPrompt(agentId)], maxTurns: member.maxTurns,
            ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
            ...(member.toolDomains.length > 0 ? { toolDomains: member.toolDomains } : {}),
          },
          { ...child(agentId, request.roleModels?.deep?.provider ?? request.provider),
            ...(options.onCheckpoint ? { onCheckpoint: checkpointFor(mapId, snapshot) } : {}) },
        );
        const { spills, conflicts } = mergeOutcome(agentId, mapId, snapshot, done);
        for (const id of done.villageCompletion?.mapIds ?? []) villageMapIds.add(id);
        trackInterior(done, snapshot);
        const complete = !done.villageCompletion?.issues.length && !done.interiorCompletion?.length;
        ledger = settleAssignment(ledger, agentId, complete);
        toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
        const summary = complete ? summaryOf(done) : completionFailure(done);
        const outcome: AgentOutcome = { agentId, mapId, member: member.id, phase, ok: complete, summary, changedKeys: done.changedKeys, spills, conflicts };
        outcomes.set(agentId, outcome);
        emit({ type: "agent_done", agentId, ok: complete, summary, stats: done.stats, changedKeys: done.changedKeys, spills, conflicts });
        return outcome;
      } catch (error) {
        ledger = settleAssignment(ledger, agentId, false);
        const message = error instanceof Error ? error.message : String(error);
        const outcome: AgentOutcome = { agentId, mapId, member: member.id, phase, ok: false, summary: message, changedKeys: [], spills: [], conflicts: [] };
        outcomes.set(agentId, outcome);
        emit({ type: "agent_done", agentId, ok: false, summary: message, stats: { ms: 0, turns: 0, toolCalls: 0, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] });
        return outcome;
      } finally {
        mailbox.close(agentId);
      }
    })();
    inflight.push({ agentId, promise });
    return { ok: true, agentId, mapId, member: member.id, phase, state: "실행 중" as AgentState };
  }

  /** Read-only designs can run alongside construction; project writes own the entire working copy. */
  function startTask(task: string, mode: "read" | "project", member: PiTeamMember): Record<string, unknown> {
    if (coreFirst && mode === 'project' && firstBuildAssignments >= 3) throw new Error('첫 제작의 후속 배정은 3회까지입니다. 추가 작업은 다음 할 일로 보고하고 finish 하세요.');
    if (coreFirst) member = { ...member, maxTurns: Math.min(member.maxTurns, 24) };
    if (request.applyMode === "step" && (runningAssignments(ledger).length || runningTasks().length)) throw new Error("단계별 적용은 앞 작업 승인·완료 후 이어집니다. wait_agents를 먼저 호출하세요.");
    if (tasks.size >= 64) throw new Error("팀 작업 배정 상한(64)에 도달했습니다. 남은 작업을 보고하세요.");
    if (mode === "project") {
      if (reviewingMaps.size) throw new Error('맵 검수·자동 수정이 진행 중입니다. 완료 후 프로젝트 공통 작업을 배정하세요.');
      if (request.readOnly || options.readOnlyTools || member.kind === "reviewer") throw new Error("읽기 전용 요청/검수 팀원에게 프로젝트 쓰기를 맡길 수 없습니다.");
      if (request.scopeStrict !== false && request.mapIds.length > 0) throw new Error("명시된 맵 범위를 프로젝트 전체 쓰기로 넓힐 수 없습니다. 맵 배정을 사용하세요.");
      if (projectWriter() || runningAssignments(ledger).length) throw new Error("진행 중인 쓰기 작업이 있습니다. wait_agents 후 프로젝트 작업을 배정하세요.");
    }
    if (coreFirst && mode === 'project') firstBuildAssignments += 1;
    const role = member.kind;
    const agentId = `${role}-${++counters[role]}`;
    tasks.set(agentId, { mode, memberId: member.id, task });
    progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" });
    mailbox.register(agentId, member.label, null);
    emit({ type: "agent_spawn", agentId, role, mapId: null, mapName: null, task, memberId: member.id, label: member.label });
    const snapshot = cloneProjectSharingSharedDictionaries(working);
    let report: string | undefined;
    const reportTool: PiToolShape = {
      name: "report_task", label: "report_task",
      description: "설계·검사·제작 결과를 팀장에게 전달한다. 구체적인 대사안/ID/조건/검사 근거 및 남은 문제를 포함한다. 읽기 작업은 적용 완료라고 쓰지 않는다.",
      parameters: { type: "object", properties: { report: { type: "string", minLength: 1, maxLength: 16000 } }, required: ["report"], additionalProperties: false },
      async execute(_id, params) {
        const value = str((params as Record<string, unknown>)?.report, "report");
        if (value.length > 16000) throw new Error("보고서 상한은 16000자입니다. 작업을 나눠 맡기세요.");
        report = value;
        return text({ ok: true, recorded: true });
      },
    };
    const promise = (async (): Promise<AgentOutcome> => {
      try {
        const done = await runAgent({
          ...request, ...exposureFor(member, mode === "read"), ...request.roleModels?.deep, mode: "single", project: snapshot,
          mapIds: mode === "project" ? [] : request.mapIds, task, readOnly: mode === "read", maxTurns: member.maxTurns,
          ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
          ...(member.toolDomains.length ? { toolDomains: member.toolDomains } : {}),
          systemPrompt: [
            ...buildPiAgentSystemPrompt(snapshot, mode === "project" ? [] : request.mapIds),
            `너는 팀의 ${member.label} 담당이다. 이번 구체적인 역할과 범위는 배정 task를 따른다. ${member.prompt}`,
            mode === "read" ? "읽기 전용 설계·검사 작업이다. 프로젝트를 수정하지 않는다. 시작 시점 사본의 결과이므로 후속 적용 때 최신 상태를 확인하도록 보고한다." : "프로젝트 공통 데이터 제작이다. task의 대상만 수정하고 기존 ID·관련 없는 콘텐츠를 보존한다.",
            "종료 전에 반드시 report_task로 산출물과 남은 문제를 전달한다. 이 작업의 보고 도구는 report_task다.",
            teamCommunicationPrompt(agentId),
          ],
        }, { ...child(agentId, request.roleModels?.deep?.provider ?? request.provider), readOnlyTools: mode === "read", ...(mode === "project" && options.onCheckpoint ? { onCheckpoint: checkpointFor(null, snapshot) } : {}), extraTools: [...mailbox.tools(agentId), reportTool] });
        toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
        if (!report) throw new Error("report_task 결과가 없어 작업을 완료 처리하지 않았습니다.");
        const changes = changedProjectKeys(snapshot, done.project);
        // Enforce read-only at the merge boundary too, even if an injected runner returns mutations.
        if (mode === "read" && changes.length) throw new Error("읽기 작업이 프로젝트 변경을 반환했습니다. 변경을 적용하지 않았습니다.");
        if (mode === "project") { assertModernProposal(working, done.project); working = cloneProjectSharingSharedDictionaries(done.project); }
        for (const id of done.villageCompletion?.mapIds ?? []) villageMapIds.add(id);
        trackInterior(done, snapshot);
        const complete = !done.villageCompletion?.issues.length && !done.interiorCompletion?.length;
        if (!complete) report += "\n" + completionFailure(done);
        const outcome: AgentOutcome = { agentId, mapId: null, member: member.id, phase: "work", ok: complete, summary: report, changedKeys: changes, spills: [], conflicts: [] };
        outcomes.set(agentId, outcome);
        emit({ type: "agent_done", agentId, ok: complete, summary: report, stats: done.stats, changedKeys: changes, spills: [], conflicts: [] });
        return outcome;
      } catch (error) {
        const summary = error instanceof Error ? error.message : String(error);
        const outcome: AgentOutcome = { agentId, mapId: null, member: member.id, phase: "work", ok: false, summary, changedKeys: [], spills: [], conflicts: [] };
        outcomes.set(agentId, outcome);
        emit({ type: "agent_done", agentId, ok: false, summary, stats: { ms: 0, turns: 0, toolCalls: 0, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [] });
        return outcome;
      } finally { mailbox.close(agentId); }
    })();
    inflight.push({ agentId, promise });
    return { ok: true, agentId, mode, state: "실행 중" };
  }

  function reportFor(agentId: string): Record<string, unknown> {
    const assignment = ledger.assignments.find((candidate) => candidate.agentId === agentId);
    const row = progress.get(agentId) ?? { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" };
    const outcome = outcomes.get(agentId);
    const state: AgentState = !outcome ? "실행 중" : outcome.ok ? "완료" : "실패";
    return {
      agentId, mapId: assignment?.mapId ?? null, member: assignment?.memberId ?? tasks.get(agentId)?.memberId ?? null, phase: assignment?.phase ?? "work", mode: tasks.get(agentId)?.mode ?? "map", state,
      turns: row.turns, toolCalls: row.toolCalls, toolErrors: row.toolErrors, lastLine: row.lastLine,
      ...(outcome ? { summary: outcome.summary, changedKeys: outcome.changedKeys, spills: outcome.spills, conflicts: outcome.conflicts } : {}),
    };
  }

  /** 비우면 지금까지 배정한 전부. 방금 끝난 배정도 포함해야 팀장이 결과를 받는다. */
  function selectAgents(raw: unknown): string[] {
    const wanted = idList(raw);
    return wanted.length > 0 ? wanted : [...ledger.assignments.map((assignment) => assignment.agentId), ...tasks.keys()];
  }

  async function reviewOnce(mapId: string, focus: string | undefined, member: PiTeamMember) {
    if (projectWriter()) throw new Error("프로젝트 공통 데이터 제작 중입니다. wait_agents 후 맵 작업을 배정하세요.");
    if (!working.maps[mapId]) throw new Error(`맵 '${mapId}' 이 프로젝트에 없습니다`);
    const busy = runningAssignments(ledger).find((assignment) => assignment.mapId === mapId);
    if (busy) throw new Error(`맵 '${mapId}' 은 아직 ${busy.memberId}(${busy.agentId})가 작업 중입니다. wait_agents 로 끝난 뒤 검수하세요 — 반쯤 지어진 맵을 검수하면 엉뚱한 지적이 나옵니다.`);
    const agentId = `reviewer-${counters.reviewer + 1}`;
    counters.reviewer += 1;
    const romanceArt = authoringHarnessFor(base)?.id === 'romance-scene';
    const task = [focus ? `맵 '${mapId}' 검수. 특히: ${focus}` : `맵 '${mapId}' 의 시공 결과를 검수하라.`,
      ...(romanceArt ? [romanceArtReviewInstructions(working)] : [])].join('\n');
    progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" });
    emit({ type: "agent_spawn", agentId, role: "reviewer", mapId, mapName: mapName(mapId), task, memberId: member.id, label: member.label });
    let verdict: { ok: boolean; findings: string[]; artChecks?: unknown } | null = null;
    let imageDelivered = false;
    const reportTool: PiToolShape = {
      name: "report_review",
      label: "report_review",
      description: "검수 결론을 보고한다. ok 는 문제가 없을 때만 true. findings 는 고쳐야 할 점(좌표 포함) 목록.",
      parameters: { type: "object", properties: { ok: { type: "boolean" }, findings: { type: "array", items: { type: "string" } },
        ...(romanceArt ? { artChecks: { type: 'array', items: { type: 'object', properties: {
          axis: { type: 'string', enum: [...ROMANCE_ART_AXES] }, passed: { type: 'boolean' }, evidence: { type: 'string' },
        }, required: ['axis', 'passed', 'evidence'], additionalProperties: false } } } : {}),
      }, required: ["ok", "findings", ...(romanceArt ? ['artChecks'] : [])], additionalProperties: false },
      async execute(_id, params) {
        const rec = (params ?? {}) as { ok?: unknown; findings?: unknown; artChecks?: unknown };
        verdict = { ok: rec.ok === true, findings: Array.isArray(rec.findings) ? rec.findings.map(String).slice(0, 12) : [],
          ...(romanceArt ? { artChecks: rec.artChecks } : {}) };
        return text({ ok: true, recorded: true });
      },
    };
    const snapshot = cloneProjectSharingSharedDictionaries(working);
    mailbox.register(agentId, member.label, mapId);
    const reviewOptions = child(agentId, request.roleModels?.deep?.provider ?? request.provider);
    const reviewSignature = authoringHarnessFor(base) ? authoringSignature(snapshot) : undefined;
    let done: PiAgentDoneEvent;
    try {
      done = await runAgent(
        {
          ...request, ...exposureFor(member, true), ...request.roleModels?.deep, mode: "single", mapIds: [mapId], project: snapshot, task,
          systemPrompt: [...memberSystemPrompt(member, snapshot, [mapId]), ...describeMapSeams(snapshot, mapId), teamCommunicationPrompt(agentId)], maxTurns: member.maxTurns,
          ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
          ...(member.toolDomains.length > 0 ? { toolDomains: member.toolDomains } : {}),
        },
        { ...reviewOptions, readOnlyTools: true, extraTools: [...mailbox.tools(agentId), reportTool],
          onEvent(event) {
            reviewOptions.onEvent?.(event);
            if (event.type === 'execution_status' && event.name === 'map.image.delivered' && event.ok) imageDelivered = true;
          } },
      );
    } finally { mailbox.close(agentId); }
    toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
    const result: { ok: boolean; findings: string[]; artChecks?: unknown } = verdict ?? { ok: false, findings: ["검수 에이전트가 report_review 를 호출하지 않았습니다: " + summaryOf(done)] };
    if (romanceArt) result.findings.push(...romanceArtReviewFindings(result.artChecks), ...romanceTownLayoutFindings(snapshot));
    if (authoringHarnessFor(base)) {
      result.findings.push(...(inspectAuthoringHarness(snapshot, base)?.blockers ?? []));
      if (!imageDelivered) { result.ok = false; result.findings.push('실제 맵 이미지를 보지 않아 시각 검수를 인정하지 않습니다. show_map_region으로 원본을 확인하세요.'); }
      if (result.findings.length) result.ok = false;
      authoringReview = { signature: reviewSignature!, ok: result.ok };
    }
    ledger = recordTeamReview(ledger, { mapId, agentId, ok: result.ok });
    emit({ type: "review", agentId, mapId, ok: result.ok, findings: result.findings, ...(romanceArt ? { artChecks: result.artChecks } : {}) });
    emit({ type: "agent_done", agentId, ok: true, summary: result.ok ? "검수 통과" : `지적 ${result.findings.length}건`, stats: done.stats, changedKeys: [], spills: [], conflicts: [] });
    return { ok: result.ok, agentId, mapId, findings: result.findings, ...(romanceArt ? { artChecks: result.artChecks } : {}) };
  }

  // New-game authoring owns its repairs. A reviewer only observes; a normal builder
  // repairs through the same checkpoint/save path, then a fresh PNG is reviewed.
  // Existing fix budgets, identity contracts and user cancellation still apply.
  async function review(mapId: string, focus: string | undefined, member: PiTeamMember): Promise<string> {
    if (reviewingMaps.has(mapId)) throw new Error(`맵 '${mapId}'의 검수·자동 수정이 이미 진행 중입니다.`);
    reviewingMaps.add(mapId);
    const repairs: { agentId: string; ok: boolean; findings: string[] }[] = [];
    try {
      let result = await reviewOnce(mapId, focus, member);
      const automatic = isGenrePresetBriefRequest(request.task) && !!authoringHarnessFor(base)
        && !request.readOnly && !options.readOnlyTools;
      while (automatic && !result.ok) {
        options.signal?.throwIfAborted();
        const used = ledger.assignments.filter(a => a.mapId === mapId && a.phase === 'fix').length;
        if (used >= ledger.budget.fix) break;
        const previous = [...ledger.assignments].reverse().find(a => a.mapId === mapId);
        const builder = builders.find(b => b.id === previous?.memberId) ?? builders[0];
        if (!builder) break;
        const findings = result.findings.length ? result.findings : ['검수자가 통과를 승인하지 않았습니다. 실제 이미지를 다시 확인하고 수정하세요.'];
        repairingMaps.add(mapId);
        const assigned = startAssign(mapId, [
          '새 게임 자동 제작의 검수 반려를 수정하라. 예시 게임이나 고정 우체국 배치를 복사하지 않는다.',
          '사용자가 확정한 장소·분위기에 맞게 현재 장면을 구성한다. 인물 이름·외형·선택지·작성된 대화·시작 위치를 보존하고 맵을 추가하지 않는다.',
          '현재 프로젝트의 해당 용도 참고문서 전체와 이미지를 먼저 읽는다. 길·공간 경계·구조·소품의 관계를 수정한다. 빈 공간을 거대한 포장 사각형이나 소품 반복으로 메워 검사를 피하지 않는다.',
          '지적을 도구로 실제 수정하고 해당 실행 하네스로 선택·통행을 검사한다. 검사 조건을 지우거나 완화하지 않는다. 수정 뒤 실행기가 새 이미지로 다시 검수한다.',
          ...findings.map(f => `반려 근거: ${f}`),
        ].join('\n'), builder, true);
        const agentId = String(assigned.agentId);
        const pending = inflight.find(entry => entry.agentId === agentId);
        if (!pending) throw new Error('자동 수정 배정의 실행 결과를 찾지 못했습니다.');
        const outcome = await pending.promise;
        repairingMaps.delete(mapId);
        repairs.push({ agentId, ok: outcome.ok, findings });
        if (!outcome.ok) {
          result = { ...result, ok: false, findings: [...result.findings, `자동 수정 실패: ${outcome.summary}`] };
          break;
        }
        result = await reviewOnce(mapId, focus, member);
      }
      return JSON.stringify({ ...result, automaticRepairs: repairs, ...(automatic && !result.ok ? { incomplete: true } : {}) });
    } finally { repairingMaps.delete(mapId); reviewingMaps.delete(mapId); }
  }

  const orchestratorTools: PiToolShape[] = [
    ...mailbox.tools("orchestrator-1"),
    {
      name: "assign_task_agent", label: "assign_task_agent",
      description: "맵에 속하지 않는 설계·대사안·검사(mode=read) 또는 공유 DB·빈 맵 생성·오프닝·공통 텍스트 제작(mode=project)을 배정하고 즉시 반환한다. read는 병렬 가능하고 보고서만 반환한다. project는 모든 다른 쓰기가 끝난 뒤 한 명만 배정한다. 결과는 check_agents/wait_agents의 summary로 받아 다음 담당자에게 전달한다.",
      parameters: { type: "object", properties: { task: { type: "string" }, mode: { type: "string", enum: ["read", "project"] }, member: { type: "string", enum: [...builders, ...reviewers].map(m => m.id) } }, required: ["task", "mode"], additionalProperties: false },
      async execute(_id, params) {
        const rec = (params ?? {}) as Record<string, unknown>;
        if (rec.mode !== "read" && rec.mode !== "project") throw new Error("mode는 read 또는 project여야 합니다.");
        return text(startTask(str(rec.task, "task"), rec.mode, pickMember(rec.member, rec.mode === "read" ? [...builders, ...reviewers] : builders, "작업")));
      },
    },
    {
      name: "assign_map_agent",
      label: "assign_map_agent",
      description: `맵 하나에 시공 팀원을 붙이고 **곧바로 돌아온다**(끝날 때까지 기다리지 않는다). 한 턴에 여러 맵을 배정하면 함께 돈다. 같은 맵에는 한 번에 한 명만 붙는다 — 시공 뒤 장식처럼 이어 하려면 wait_agents 로 앞 팀원이 끝난 것을 확인한 뒤 배정한다. task 에는 그 맵에서 할 일을 위치·크기·재료까지 구체적으로 적는다. member 는 시공 팀원 id(${builders.map((m) => m.id).join(", ")}); 비우면 ${builders[0]!.id}.`,
      parameters: { type: "object", properties: { mapId: { type: "string" }, task: { type: "string" }, member: { type: "string", enum: builders.map((m) => m.id) } }, required: ["mapId", "task"], additionalProperties: false },
      async execute(_id, params) {
        const rec = (params ?? {}) as Record<string, unknown>;
        return text(startAssign(str(rec.mapId, "mapId"), str(rec.task, "task"), pickMember(rec.member, builders, "시공")));
      },
    },
    {
      name: "check_agents",
      label: "check_agents",
      description: "배정한 팀원들이 지금 무엇을 하고 있는지 본다(기다리지 않는다). 턴·툴콜·마지막 한 줄과 끝난 배정의 결과를 돌려준다. agentIds 를 비우면 전부.",
      parameters: { type: "object", properties: { agentIds: { type: "array", items: { type: "string" } } }, required: [], additionalProperties: false },
      async execute(_id, params) {
        const ids = selectAgents((params as Record<string, unknown>)?.agentIds);
        return text({ agents: ids.map(reportFor) });
      },
    },
    {
      name: "wait_agents",
      label: "wait_agents",
      description: "배정 결과를 기다린다. 고른 배정이 하나라도 끝나거나(reason=agent_finished, 전부 끝나면 completed) 팀장에게 메시지가 오면(reason=messages) 돌아온다 — 그땐 read_team_messages로 답한다. 시간 초과로는 거의 돌아오지 않으니 반복해서 부르지 말고 돌아온 결과로 다음 배정을 한다. agentIds 를 비우면 진행 중인 배정 전부. 검수를 붙이거나 같은 맵에 다음 팀원을 배정하기 전에 부른다.",
      parameters: { type: "object", properties: { agentIds: { type: "array", items: { type: "string" } } }, required: [], additionalProperties: false },
      async execute(_id, params, signal) {
        const ids = selectAgents((params as Record<string, unknown>)?.agentIds);
        const controller = new AbortController();
        const abort = () => controller.abort();
        const parentSignal = signal ?? options.signal;
        parentSignal?.addEventListener("abort", abort, { once: true });
        if (parentSignal?.aborted) controller.abort();
        try {
          const reason = await waitForTeam(inflight.filter(entry => ids.includes(entry.agentId)).map(entry => entry.promise), controller.signal);
          return text({ reason, agents: ids.map(reportFor), unreadMessages: mailbox.unread("orchestrator-1") });
        } finally { controller.abort(); parentSignal?.removeEventListener("abort", abort); }
      },
    },
    {
      name: "review_map",
      label: "review_map",
      description: reviewers.length > 0
        ? `맵 하나를 검수 팀원에게 맡긴다(검수자는 읽기 전용, 끝날 때까지 기다린다). 실행 하네스가 있는 새 게임 제작의 반려는 기존 수정 예산 안에서 시공 → 새 이미지 재검수를 자동으로 반복한다. 읽기 전용 요청·후속 검수는 수정하지 않는다. ok, findings, automaticRepairs 를 돌려준다. 그 맵에 아직 작업 중인 팀원이 있으면 거절한다. member 는 검수 팀원 id(${reviewers.map((m) => m.id).join(", ")}); 비우면 ${reviewers[0]!.id}.`
        : "검수 팀원이 없다. 호출하면 실패한다 — finish 로 바로 보고하라.",
      parameters: { type: "object", properties: { mapId: { type: "string" }, focus: { type: "string" }, ...(reviewers.length > 0 ? { member: { type: "string", enum: reviewers.map((m) => m.id) } } : {}) }, required: ["mapId"], additionalProperties: false },
      async execute(_id, params) {
        if (request.applyMode === "yolo" && !authoringHarnessFor(base)) return text({ skipped: true, reason: "YOLO에서는 검수를 생략합니다." });
        if (reviewers.length === 0) throw new Error("팀에 켜진 검수 팀원이 없습니다. 검수를 건너뛰고 finish 하세요.");
        const rec = (params ?? {}) as Record<string, unknown>;
        return text(await review(str(rec.mapId, "mapId"), typeof rec.focus === "string" ? rec.focus : undefined, pickMember(rec.member, reviewers, "검수")));
      },
    },
    {
      name: "finish",
      label: "finish",
      description: "팀 작업을 끝낸다. report 에 무엇을 어디에 만들었고 검수가 어땠는지 한 문단으로 적는다. 진행 중인 배정이 있으면 거절한다 — wait_agents 를 먼저 부른다.",
      parameters: { type: "object", properties: { report: { type: "string" } }, required: ["report"], additionalProperties: false },
      async execute(_id, params) {
        if (reviewingMaps.size) throw new Error('맵 검수·자동 수정이 진행 중이므로 완료 처리할 수 없습니다.');
        const running = runningAssignments(ledger);
        if (runningTasks().length) throw new Error("설계·프로젝트 작업이 아직 실행 중입니다. wait_agents로 결과를 받으세요.");
        if (running.length > 0) {
          throw new Error(`아직 ${running.map((assignment) => `${assignment.memberId}(${assignment.agentId}, ${assignment.mapId})`).join(", ")} 가 작업 중입니다. wait_agents 로 결과를 받은 뒤 보고하세요.`);
        }
        if (mailbox.unread("orchestrator-1")) throw new Error("팀장에게 미열람 메시지 또는 반영 확인이 있습니다. read_team_messages로 확인하고 질문에 답한 뒤 finish 하세요.");
        if (firstPlay) {
          const issues = inspectFirstPlay(base, working, firstPlay);
          if (issues.length) throw new Error('핵심 플레이 미완료: ' + issues.join(' / '));
          const sceneIssues = [...inspectFirstScene(base, working, firstPlay), ...inspectFirstPresentation(working)];
          if (sceneIssues.length) throw new Error('첫 장면 미완료: ' + sceneIssues.join(' / '));
          if (firstPlaySignature(working, firstPlay) !== reviewedFirstPlay) await reviewFirstPlay();
          if (firstSceneSignature(working, firstPlay) !== reviewedFirstScene) await reviewFirstScene();
        }
        // 맵 사이 연결 계약(worldGraph)을 병합본으로 검사한다. 각 담당은 자기 맵만 보므로 이음새는 여기서만 보인다.
        const seamErrors = inspectWorldSeams(working).issues.filter((issue) => issue.severity === "error");
        const seamSignature = seamErrors.map((issue) => `${issue.code}:${issue.mapId ?? ""}:${issue.x ?? ""},${issue.y ?? ""}`).sort().join("|");
        if (seamErrors.length > 0 && seamSignature !== seamRejection) {
          seamRejection = seamSignature;
          throw new Error(`맵 사이 연결 오류 ${seamErrors.length}건: ${formatSeamIssues(seamErrors)} — 해당 맵 담당에게 assign_map_agent 로 수정을 맡기거나 link_maps 수정 작업을 배정한 뒤 다시 finish 하세요. 고칠 수 없으면 그대로 다시 finish 하면 보고에 남기고 끝냅니다.`);
        }
        // 등록 제작 하네스는 매번 차단한다. 기존 구간 경로만 두 번 이후 브라우저 수용 게이트에 넘긴다.
        if (segmentGate && (authoringHarnessFor(base) || segmentRejections < 2)) {
          const verdict = judgePlayableSegment(working, { expected: base });
          if (!verdict.ok) {
            segmentRejections += 1;
            emit({ type: "agent_event", agentId: "orchestrator-1", event: { type: "assistant", text: `첫 구간 자동 플레이 막힘(${segmentRejections}): ${verdict.blockers.join(" / ")}` } });
            throw new Error(`첫 구간을 끝까지 갈 수 없어 finish 를 받지 않습니다(${segmentRejections}). 자동 플레이가 막힌 곳: ${verdict.blockers.join(" / ")}. 해당 맵에 수정 배정을 하고 wait_agents 뒤 다시 finish 하세요.`);
          }
        }
        if (authoringHarnessFor(base) && (!authoringReview?.ok || authoringReview.signature !== authoringSignature(working))) {
          throw new Error('현재 첫 만남의 시각 검수가 없거나, 검수 후 내용이 바뀌었습니다. 실제 맵 이미지를 보는 review_map 검수를 통과한 뒤 finish 하세요.');
        }
        const outstanding = mailbox.outstanding();
        finished = str((params as Record<string, unknown>)?.report, "report");
        finishAccepted = true;
        if (seamErrors.length > 0) finished += `
남은 맵 연결 오류 ${seamErrors.length}건: ${formatSeamIssues(seamErrors)}`;
        const failedTasks = [...tasks.keys()].map(id => outcomes.get(id)).filter(outcome => outcome && !outcome.ok);
        if (failedTasks.length) finished += `\n실패한 작업 ${failedTasks.length}건: ${failedTasks.map(outcome => `${outcome!.agentId}: ${outcome!.summary}`).join("; ")}`;
        if (outstanding.length) finished += `\n미확인 협의 ${outstanding.length}건: ${outstanding.map(m => `${m.id} ${m.from}→${m.to}: ${m.body}`).join("; ")}`;
        emit({ type: "team_report", text: finished });
        return text({ ok: true });
      },
    },
  ];

  async function reviewFirstPlay(): Promise<void> {
    const receipt = firstPlay!;
    const snapshot = cloneProjectSharingSharedDictionaries(working);
    const agentId = `reviewer-${++counters.reviewer}`;
    const member = reviewers[0] ?? builders[0]!;
    let verdict: { ok: boolean; blockers: string[] } | undefined;
    const task = `확정 기획의 핵심 행동·요청한 모든 선택과 각 결과·진행·마무리가 실제 이벤트에 구현되었는지 확인한다. 기본 샘플의 엔딩 도달만으로 통과시키지 않는다. 누락된 요구는 실패로 보고한다. 지도 장식과 미지정 외형은 이 검사 대상이 아니다.\n사용자 원문과 확정 기획:\n${request.task}\n제작 근거:\n${JSON.stringify({ receipt, events: firstPlayEvents(snapshot, receipt) })}`;
    const reportTool: PiToolShape = {
      name: 'report_first_play_review', label: 'report_first_play_review',
      description: '원문 요구와 실제 이벤트의 핵심 플레이 일치 여부를 보고한다. blockers는 누락/실패만, evidence는 확인한 근거다. 통과 시 ok=true, blockers=[].',
      parameters: { type: 'object', properties: { ok: { type: 'boolean' }, blockers: { type: 'array', items: { type: 'string' } }, evidence: { type: 'array', minItems: 1, items: { type: 'string' } } }, required: ['ok', 'blockers', 'evidence'], additionalProperties: false },
      async execute(_id, params) {
        const rec = params as { ok?: unknown; blockers?: unknown; evidence?: unknown };
        if (!Array.isArray(rec.blockers) || !Array.isArray(rec.evidence) || !rec.evidence.length) throw new Error('blockers(누락/실패)와 evidence(확인 근거)를 따로 보고하세요. 통과 시 blockers는 빈 배열입니다.');
        verdict = { ok: rec.ok === true, blockers: rec.blockers.map(String).slice(0, 12) };
        return text({ recorded: true });
      },
    };
    progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: '' });
    mailbox.register(agentId, member.label, null);
    emit({ type: 'agent_spawn', agentId, role: 'reviewer', mapId: null, mapName: null, task, memberId: member.id, label: '핵심 플레이 확인' });
    try {
      const done = await runAgent({ ...request, ...request.roleModels?.deep, mode: 'single', project: snapshot, mapIds: [],
        initialToolNames: undefined, toolDomains: undefined, readOnly: true, task, maxTurns: Math.min(member.maxTurns, 12),
        ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
        systemPrompt: ['읽기 전용 핵심 플레이 검사다. 원문과 실제 실행 명령을 비교하고 반드시 report_first_play_review를 호출한다. 전체 제작 완료·실제 브라우저 통과라고 주장하지 않는다.'] },
      { ...child(agentId, request.roleModels?.deep?.provider ?? request.provider), readOnlyTools: true,
        toolNames: ['get_event', 'get_map_region', 'get_database_records', 'check_reachability', 'run_lint'], extraTools: [reportTool] });
      toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
      if (changedProjectKeys(snapshot, done.project).length) throw new Error('읽기 전용 핵심 검사가 변경을 반환했습니다.');
      // The report arrives through an asynchronous tool callback.
      const reportedVerdict = verdict as { ok: boolean; blockers: string[] } | undefined;
      if (!reportedVerdict?.ok || reportedVerdict.blockers.length) throw new Error('핵심 플레이 요구 누락: ' + (reportedVerdict?.blockers.join(' / ') || '검사 보고가 없습니다.'));
      reviewedFirstPlay = firstPlaySignature(working, receipt);
      emit({ type: 'execution_status', at: Date.now(), name: 'first_play.review_passed', ok: true, summary: '확정 기획과 실제 핵심 이벤트를 대조했습니다. 장면 마무리 작업을 이어갑니다.' });
      emit({ type: 'agent_done', agentId, ok: true, summary: '핵심 플레이 요구 확인', stats: done.stats, changedKeys: [], spills: [], conflicts: [] });
    } finally { mailbox.close(agentId); }
  }

  if (coreFirst) {
    let repair = '';
    // A missed requirement gets one bounded automatic repair, still within the
    // restricted phase. Never hand an incomplete core to a decorating agent.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      firstPlay = undefined;
      const member = builders[0]!;
      const agentId = `builder-${++counters.builder}`;
      const snapshot = cloneProjectSharingSharedDictionaries(working);
      const task = `첫 제작 1단계: 확정 기획의 핵심 플레이를 기존 두 맵의 뼈대 위에 지금 작성한다. 첫 조사/대화/전투/수집 행동 → 기획에 요청된 선택과 서로 다른 결과 → 진행 스위치와 기존 문 → 기획에 맞는 구간 마무리를 실제 이벤트로 연결한다. 선택이 요청됐다면 선택 문구와 각 branch의 결과를 모두 작성한다. 대사의 body에는 실제 표시할 자연스러운 문장을 넣고 따옴표를 수동으로 이스케이프하지 않는다. 기본 샘플의 대사·이름만 남긴 채 완료하지 않는다. 뼈대 ID·좌표·통행·기존 전투/포획/엔딩 연결을 보존한다. 주인공 이름은 기획대로 DB에 반영한다. 지도 장식·새 맵·타이틀/이미지/음악은 다음 단계다. upsert_event로 기존 이벤트의 pages를 바꿀 때 필요한 페이지를 모두 포함한다. 끝나면 report_first_play로 변경한 interaction·resolution 이벤트의 mapId/eventId와 플레이 순서를 보고한다.\n${repair}\n전체 사용자 지시:\n${request.task}`;
      const reportTool: PiToolShape = {
        name: 'report_first_play', label: 'report_first_play',
        description: '실제로 변경한 핵심 행동과 구간 마무리 이벤트를 보고한다. 기본 샘플 그대로거나 빈 선택 결과면 거절된다.',
        parameters: { type: 'object', properties: { events: { type: 'array', minItems: 2, maxItems: 12, items: { type: 'object', properties: { mapId: { type: 'string' }, eventId: { type: 'string' }, role: { type: 'string', enum: ['interaction', 'progression', 'resolution'] } }, required: ['mapId', 'eventId', 'role'], additionalProperties: false } }, report: { type: 'string', minLength: 1, maxLength: 4000 } }, required: ['events', 'report'], additionalProperties: false },
        async execute(_id, params) {
          const rec = params as FirstPlayReceipt;
          if (!Array.isArray(rec.events) || rec.events.length < 2 || rec.events.length > 12
            || rec.events.some(ref => !ref || typeof ref.mapId !== 'string' || typeof ref.eventId !== 'string' || !['interaction', 'progression', 'resolution'].includes(ref.role))) throw new Error('실제 핵심 이벤트 근거가 필요합니다.');
          const receipt = { events: rec.events.map(ref => ({ ...ref })), report: str(rec.report, 'report') };
          const issues = inspectFirstPlay(base, working, receipt);
          if (issues.length) throw new Error(issues.join(' / '));
          firstPlay = receipt;
          return text({ ok: true, events: receipt.events, next: '원문 요구 대조 후 장면 마무리' });
        },
      };
      progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: '' });
      mailbox.register(agentId, member.label, null);
      emit({ type: 'agent_spawn', agentId, role: 'builder', mapId: null, mapName: null, task, memberId: member.id, label: '핵심 플레이 제작' });
      try {
        const done = await runAgent({ ...request, ...request.roleModels?.deep, mode: 'single', project: snapshot, mapIds: [], task,
          initialToolNames: undefined, toolDomains: undefined, maxTurns: Math.min(member.maxTurns, attempt ? 16 : 32),
          ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
          systemPrompt: [...buildPiAgentSystemPrompt(snapshot, []), '이번 단계에서는 기존 뼈대의 핵심 플레이만 작성한다. 제공된 도구 범위는 고정이다. 장식 도구를 검색하거나 다른 쓰기를 우회하지 않는다. 종료 전에 report_first_play를 호출한다.'] },
        { ...child(agentId, request.roleModels?.deep?.provider ?? request.provider), toolNames: FIRST_PLAY_TOOLS,
          onCheckpoint: checkpointFor(null, snapshot), extraTools: [reportTool] });
        toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
        const reportedPlay = firstPlay as FirstPlayReceipt | undefined;
        if (!reportedPlay) throw new Error('핵심 플레이 제작 보고가 없어 장식 단계로 넘어가지 않습니다.');
        assertModernProposal(working, done.project);
        const issues = inspectFirstPlay(base, done.project, reportedPlay);
        const play = judgePlayableSegment(done.project);
        if (issues.length || !play.ok) throw new Error('핵심 플레이 미완료: ' + [...issues, ...play.blockers].join(' / '));
        working = cloneProjectSharingSharedDictionaries(done.project);
        emit({ type: 'execution_status', at: Date.now(), name: 'first_play.core_ready', ok: true, summary: reportedPlay.report, data: { events: reportedPlay.events } });
        emit({ type: 'agent_done', agentId, ok: true, summary: reportedPlay.report, stats: done.stats, changedKeys: done.changedKeys, spills: [], conflicts: [] });
      } finally { mailbox.close(agentId); }
      try { await reviewFirstPlay(); break; }
      catch (error) {
        if (attempt || options.signal?.aborted) throw error;
        repair = `앞 핵심 플레이 검사에서 남은 문제만 수정한다. 이미 구현된 부분은 보존한다. 검사 결과: ${error instanceof Error ? error.message : String(error)}`;
        emit({ type: 'execution_status', at: Date.now(), name: 'first_play.repair', ok: false, summary: repair });
      }
    }
  }

  async function reviewFirstScene(): Promise<void> {
    const receipt = firstPlay!;
    const snapshot = cloneProjectSharingSharedDictionaries(working);
    const mapIds = firstSceneMapIds(snapshot, receipt);
    const delivered = new Set<string>();
    const requiredArt = presentationArtIds(snapshot);
    const deliveredArt = new Set<string>();
    let verdict: { ok: boolean; blockers: string[] } | undefined;
    const member = reviewers[0] ?? builders[0]!;
    const agentId = `reviewer-${++counters.reviewer}`;
    const task = [
      '첫 사용자 경험을 냉정하게 검수한다. 필수: 각 맵을 show_map_region(x:0,y:0,w:맵너비,h:맵높이)으로 실제 그림까지 본다.',
      '확인 축: ① 원문 기획과 실제 장소(방/길)의 일치 ② 핵심 조사물/인물과 마무리 대상이 눈에 보이고 식별됨 ③ 시작 위치에서 첫 행동 대상/출구까지 정상 동선 ④ 오프닝의 설명/안내와 실제 그림·위치의 일치 ⑤ 작품 전용 타이틀의 분위기/로고/등장 순서와 실제 장면 오프닝의 연결. show_title_opening으로 실제 타이틀/오프닝 그림도 반드시 본다. 빈 풀밭, 안 보이는 시계, 이름만 방인 맵, 기본 마을 타이틀, 기획과 다른 오프닝 그림은 반드시 실패다.',
      '현재 타이틀:\n' + JSON.stringify(snapshot.system.titleScreen),
      '전체 원문:\n' + request.task,
      '핵심 근거:\n' + JSON.stringify(receipt),
      '현재 오프닝:\n' + JSON.stringify(snapshot.system.opening),
      '핵심 대상의 실제 자산 이름/태그:\n' + JSON.stringify(firstSceneGraphicEvidence(snapshot, receipt)),
      '보석 그림을 시계로 부르는 대체와, 대사에 남은 좌표/ID/JSON 역슬래시를 합격시키지 않는다.',
      '전체 그림 요청:\n' + JSON.stringify(mapIds.map(id => ({ mapId: id, x: 0, y: 0, w: snapshot.maps[id]!.width, h: snapshot.maps[id]!.height }))),
      '이미지와 이벤트를 대조한 뒤 report_first_scene_review를 호출한다. 실제 브라우저 플레이를 했다고 주장하지 않는다.',
    ].join('\n');
    const reportTool: PiToolShape = {
      name: 'report_first_scene_review', label: 'report_first_scene_review',
      description: '각 장소와 타이틀/오프닝의 실제 이미지를 확인한 첫 사용자 경험 검수. blockers는 실패, evidence는 5축의 구체적 그림/좌표/설정 근거다.',
      parameters: { type: 'object', properties: { ok: { type: 'boolean' }, blockers: { type: 'array', items: { type: 'string' } }, evidence: { type: 'array', minItems: 5, items: { type: 'string' } } }, required: ['ok', 'blockers', 'evidence'], additionalProperties: false },
      async execute(_id, params) {
        const rec = params as { ok?: unknown; blockers?: unknown; evidence?: unknown };
        const missing = mapIds.filter(id => !delivered.has(id));
        if (missing.length) throw new Error('실제 전체 맵 이미지를 아직 보지 않았습니다: ' + missing.join(', '));
        const missingArt = requiredArt.filter(id => !deliveredArt.has(id));
        if (missingArt.length) throw new Error('연결된 실제 타이틀/오프닝 그림을 아직 보지 않았습니다: ' + missingArt.join(', '));
        if (!Array.isArray(rec.blockers) || !Array.isArray(rec.evidence) || rec.evidence.length < 5) throw new Error('5축의 구체적 그림 근거와 blockers를 따로 보고하세요.');
        verdict = { ok: rec.ok === true, blockers: rec.blockers.map(String).slice(0, 12) };
        return text({ recorded: true });
      },
    };
    progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: '' });
    mailbox.register(agentId, member.label, null);
    emit({ type: 'agent_spawn', agentId, role: 'reviewer', mapId: null, mapName: null, task, memberId: member.id, label: '첫 장면 이미지 확인' });
    const reviewOptions = child(agentId, request.roleModels?.deep?.provider ?? request.provider);
    try {
      const done = await runAgent({ ...request, ...request.roleModels?.deep, mode: 'single', project: snapshot, mapIds,
        initialToolNames: undefined, toolDomains: undefined, readOnly: true, task, maxTurns: Math.min(member.maxTurns, 16),
        ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
        systemPrompt: ['읽기 전용 첫 장면 검수다. 실제 맵 이미지를 보고 원문/오프닝/이벤트와 대조한다. ' + FIRST_SCENE_INSTRUCTIONS.join('\n')] },
      { ...reviewOptions, readOnlyTools: true, toolNames: ['show_map_region', 'get_map_region', 'get_event', 'get_opening', 'get_title_screen', 'show_title_opening', 'get_database_records', 'run_lint', 'check_reachability'], extraTools: [reportTool],
        onEvent(event) {
          reviewOptions.onEvent?.(event);
          if (event.type === 'execution_status' && event.name === 'presentation.image.delivered' && event.ok) {
            const ids = (event.data as { resourceIds?: unknown } | undefined)?.resourceIds;
            if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string' && requiredArt.includes(id)) deliveredArt.add(id);
          }
          if (event.type !== 'execution_status' || event.name !== 'map.image.delivered' || !event.ok || !event.data || typeof event.data !== 'object') return;
          const data = event.data as { mapId?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown };
          if (typeof data.mapId !== 'string' || !mapIds.includes(data.mapId)) return;
          const map = snapshot.maps[data.mapId]!;
          if (data.x === 0 && data.y === 0 && data.w === map.width && data.h === map.height) delivered.add(data.mapId);
        },
      });
      toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
      if (changedProjectKeys(snapshot, done.project).length) throw new Error('읽기 전용 첫 장면 검수가 변경을 반환했습니다.');
      const report = verdict as { ok: boolean; blockers: string[] } | undefined;
      if (!report?.ok || report.blockers.length || mapIds.some(id => !delivered.has(id)) || requiredArt.some(id => !deliveredArt.has(id))) throw new Error('첫 장면 검수 실패: ' + (report?.blockers.join(' / ') || '실제 이미지 확인/검수 보고가 없습니다.'));
      reviewedFirstScene = firstSceneSignature(working, receipt);
      emit({ type: 'execution_status', name: 'first_scene.review_passed', ok: true, summary: '실제 장소·대상·동선과 작품 타이틀/오프닝 원화 일치를 확인했습니다.' });
      emit({ type: 'agent_done', agentId, ok: true, summary: '첫 장면 이미지 확인', stats: done.stats, changedKeys: [], spills: [], conflicts: [] });
    } finally { mailbox.close(agentId); }
  }

  if (firstPlay) {
    // Scene geometry and first interaction/intro have separate serial owners.
    // The observed combined 48+24 turn run exhausted its budget on room/assets
    // and never wrote the intro. Each stage gets only its relevant tools.
    const placeTools = ['get_map_region', 'get_event', 'show_map_region', 'check_reachability', 'run_lint',
      'find_tools', 'list_tileset_references', 'read_tileset_reference', 'list_hand_interior_parts',
      'build_hand_interior_room', 'set_map_properties', 'set_start_position', 'author_wild_route',
      'move_event', 'upsert_event'];
    for (const stage of ['places', 'entry'] as const) {
      const places = stage === 'places';
      const inspect = places ? inspectFirstScenePlaces
        : (before: Project, project: Project, receipt: FirstPlayReceipt) => inspectFirstScene(before, project, receipt, true);
      let repair = '';
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const member = builders[0]!;
        const agentId = `builder-${++counters.builder}`;
        const snapshot = cloneProjectSharingSharedDictionaries(working);
        let reported = false;
        const task = [places
          ? '첫 장소 구조 담당: 기존 두 장소의 방/길 구조와 가구·출입 동선만 완성한다. 배우/DB/오프닝/첫 대상의 이벤트 내용은 다음 담당의 작업이다. 주인공 그림이나 얼굴을 검색하지 않는다.'
          : '첫 입력 담당: 두 장소의 구조는 이미 작성했다. 아래 실제 자산 목록에서 골라 첫 행동 대상과 마무리 대상을 지금 upsert_event로 배치하고, 짧은 일회성 맵 도입/조작 안내를 작성한다. 방을 처음부터 다시 짓거나 인물 DB/외형을 바꾸지 않는다. 자산 검색은 완료되어 목록을 제공했다. 검색을 반복하지 않는다. 첫 읽기에서 현재 이벤트/맵을 확인한 뒤 쓰기를 시작한다.',
          ...(places ? [FIRST_SCENE_INSTRUCTIONS[1], FIRST_SCENE_INSTRUCTIONS[2],
            '각 타일셋의 용도 MD 전 페이지와 가까운 예제의 실제 이미지를 먼저 읽는다. 바닥만 있는 길도 구조/소품을 구성한다. 시작 위치/양방향 transfer 목적지는 통행 가능하게 맞춘다.'] : [...FIRST_SCENE_INSTRUCTIONS]),
          '핵심 이벤트 근거: ' + JSON.stringify(firstPlay),
          ...(places ? [] : ['핵심 대상의 실제 자산 이름/태그: ' + JSON.stringify(firstSceneGraphicEvidence(snapshot, firstPlay)),
            '실제로 사용 가능한 사물 목록(이 밖의 id를 만들지 않는다): ' + JSON.stringify(firstSceneObjectCatalog())]), repair,
          `완료 전에 두 맵 전체를 show_map_region으로 보고 report_first_scene${places ? '_places' : ''}를 반드시 호출한다.`,
          '전체 사용자 지시:\n' + request.task].join('\n');
        const reportTool: PiToolShape = {
          name: places ? 'report_first_scene_places' : 'report_first_scene', label: places ? 'report_first_scene_places' : 'report_first_scene', description: places ? '두 장소의 실제 구조와 정상 동선을 작성한 뒤 보고한다. 기본 빈 맵은 거부한다.' : '보이는 핵심 대상과 짧은 도입을 작성한 뒤 보고한다. 안 보이는 대상/글만 있는 오프닝은 거부한다.',
          parameters: { type: 'object', properties: { report: { type: 'string', minLength: 1, maxLength: 4000 } }, required: ['report'], additionalProperties: false },
          async execute(_id, params) {
            const issues = [...inspectFirstPlay(base, working, firstPlay!), ...inspect(base, working, firstPlay!)];
            if (issues.length) throw new Error(issues.join(' / '));
            reported = true;
            return text({ ok: true, report: str((params as { report?: unknown }).report, 'report') });
          },
        };
        progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: '' });
        mailbox.register(agentId, member.label, null);
        emit({ type: 'agent_spawn', agentId, role: 'builder', mapId: null, mapName: null, task, memberId: member.id, label: places ? '첫 장소 구조 제작' : '첫 대상과 도입 제작' });
        try {
          const done = await runAgent({ ...request, ...request.roleModels?.deep, mode: 'single', project: snapshot, mapIds: [], task,
            initialToolNames: undefined, toolDomains: undefined, maxTurns: Math.min(member.maxTurns, places ? (attempt ? 24 : 48) : (attempt ? 16 : 24)),
            ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
            systemPrompt: [...buildPiAgentSystemPrompt(snapshot, []), ...(places ? FIRST_SCENE_INSTRUCTIONS.slice(1, 3) : FIRST_SCENE_INSTRUCTIONS),
              places ? '이번 단계는 두 장소의 구조/가구/통행만 작성하고 report_first_scene_places로 끝낸다. 오프닝과 대상 이벤트는 다음 단계에서 작성한다.' : '이번 단계는 보이는 첫 대상/마무리 대상과 짧은 맵 도입을 작성하고 report_first_scene로 끝낸다.'] },
          { ...child(agentId, request.roleModels?.deep?.provider ?? request.provider), toolNames: places ? placeTools
            : ['get_event','get_map_region','get_database_records','upsert_event','move_event','get_opening','show_map_region','check_reachability','run_lint'],
            onCheckpoint: checkpointFor(null, snapshot), extraTools: [reportTool] });
          toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
          if (!reported) throw new Error('첫 장소의 제작 보고가 없습니다.');
          const issues = [...inspectFirstPlay(base, done.project, firstPlay), ...inspect(base, done.project, firstPlay)];
          const play = judgePlayableSegment(done.project);
          if (issues.length || !play.ok) throw new Error([...issues, ...play.blockers].join(' / '));
          assertModernProposal(working, done.project);
          working = cloneProjectSharingSharedDictionaries(done.project);
          emit({ type: 'agent_done', agentId, ok: true, summary: places ? '첫 장소 구조 제작' : '첫 대상과 도입 제작', stats: done.stats, changedKeys: done.changedKeys, spills: [], conflicts: [] });
          break;
        } catch (error) {
          if (attempt || options.signal?.aborted) throw error;
          repair = '첫 장소의 검사에서 남은 문제만 수정한다. 핵심 플레이를 보존한다. 오류: ' + (error instanceof Error ? error.message : String(error));
          emit({ type: 'execution_status', name: 'first_scene.repair', ok: false, summary: repair });
        } finally { mailbox.close(agentId); }
      }
    }
    // Presentation gets its own budget and real image tools. Room/event construction
    // cannot consume this budget or silently finish with the default snowy village.
    let presentationRepair = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const member = builders[0]!;
      const agentId = `builder-${++counters.builder}`;
      const snapshot = cloneProjectSharingSharedDictionaries(working);
      let reported = false;
      const task = ['작품 타이틀·오프닝 담당이다. 핵심 플레이와 장소 및 첫 조작 안내는 이미 작성했다. 지금 작품 전용 타이틀과 실제 장면 오프닝을 끝까지 제작한다.',
        ...FIRST_PRESENTATION_INSTRUCTIONS,
        '핵심 플레이 근거: ' + JSON.stringify(firstPlay),
        '시작 맵: ' + JSON.stringify({ mapId: snapshot.startMapId, name: snapshot.maps[snapshot.startMapId]?.name, startPos: snapshot.startPos }),
        '핵심 대상의 실제 자산 이름/태그: ' + JSON.stringify(firstSceneGraphicEvidence(snapshot, firstPlay)),
        presentationRepair, '실제 연결 그림을 show_title_opening으로 확인한 뒤 report_first_presentation을 반드시 호출한다.',
        '전체 사용자 지시:\n' + request.task].join('\n');
      const reportTool: PiToolShape = {
        name: 'report_first_presentation', label: 'report_first_presentation',
        description: '작품 전용 타이틀·등장 순서·전환과 활성화된 실제 장면 오프닝의 제작을 보고한다. 기본 타이틀과 꺼진 오프닝은 거부한다.',
        parameters: { type: 'object', properties: { report: { type: 'string', minLength: 1, maxLength: 4000 } }, required: ['report'], additionalProperties: false },
        async execute(_id, params) {
          const issues = [...inspectFirstPlay(base, working, firstPlay!), ...inspectFirstScene(base, working, firstPlay!), ...inspectFirstPresentation(working)];
          if (issues.length) throw new Error(issues.join(' / '));
          reported = true;
          return text({ ok: true, report: str((params as { report?: unknown }).report, 'report') });
        },
      };
      progress.set(agentId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: '' });
      mailbox.register(agentId, member.label, null);
      emit({ type: 'agent_spawn', agentId, role: 'builder', mapId: null, mapName: null, task, memberId: member.id, label: '작품 타이틀과 오프닝 제작' });
      try {
        const done = await runAgent({ ...request, ...request.roleModels?.deep, mode: 'single', project: snapshot, mapIds: [], task,
          initialToolNames: undefined, toolDomains: undefined, maxTurns: Math.min(member.maxTurns, attempt ? 12 : 24),
          ...(!request.roleModels?.deep && member.model ? { model: member.model } : {}),
          systemPrompt: [...buildPiAgentSystemPrompt(snapshot, []), ...FIRST_PRESENTATION_INSTRUCTIONS] },
        { ...child(agentId, request.roleModels?.deep?.provider ?? request.provider),
          toolNames: ['get_title_screen', 'get_opening', 'get_map_region', 'get_event', 'show_map_region',
            'generate_title_art', 'generate_opening_image', 'set_title_screen', 'set_opening', 'show_title_opening', 'list_opening_media'],
          onCheckpoint: checkpointFor(null, snapshot), extraTools: [reportTool] });
        toolCalls += done.stats.toolCalls; toolErrors += done.stats.toolErrors; subTurns += done.stats.turns; subUsage = addPiAgentUsage(subUsage, done.stats.usage);
        if (!reported) throw new Error('작품 타이틀/오프닝 제작 보고가 없습니다.');
        const issues = [...inspectFirstPlay(base, done.project, firstPlay), ...inspectFirstScene(base, done.project, firstPlay), ...inspectFirstPresentation(done.project)];
        if (issues.length) throw new Error(issues.join(' / '));
        working = cloneProjectSharingSharedDictionaries(done.project);
        emit({ type: 'agent_done', agentId, ok: true, summary: '작품 타이틀과 오프닝 제작', stats: done.stats, changedKeys: done.changedKeys, spills: [], conflicts: [] });
        await reviewFirstScene();
        break;
      } catch (error) {
        if (attempt || options.signal?.aborted) throw error;
        presentationRepair = '타이틀/오프닝에 남은 문제만 수정한다. 장소와 핵심 플레이를 보존한다. 오류: ' + (error instanceof Error ? error.message : String(error));
        emit({ type: 'execution_status', name: 'first_presentation.repair', ok: false, summary: presentationRepair });
      } finally { mailbox.close(agentId); }
    }
  }

  const orchestratorId = `orchestrator-${++counters.orchestrator}`;
  progress.set(orchestratorId, { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" });
  emit({ type: "agent_spawn", agentId: orchestratorId, role: "orchestrator", mapId: null, mapName: null, task: request.task });
  const orch = PI_TEAM_ROLES.orchestrator;
  let orchDone: PiAgentDoneEvent;
  try {
    orchDone = await runAgent(
      { ...request, initialToolNames: undefined, mode: "single", mapIds: candidateMaps, project: working, systemPrompt: [...orch.systemPrompt(working, request.mapIds, request.task, team, request.currentMapId), ...(firstPlay ? [`핵심 플레이 제작과 원문 요구 검사, 실제 장소 구성과 이미지 검수를 이미 마쳤다: ${JSON.stringify(firstPlay)}. 불필요한 재시공 없이 finish 한다. 꼭 필요한 남은 작업만 최대 3회 배정한다. 기존 두 맵과 도입/첫 행동 안내를 보존한다. 빈 바닥/안 보이는 대상은 장식으로 미루지 않는다. 기획의 플레이를 다시 처음부터 만들지 않는다.`] : []), teamCommunicationPrompt(orchestratorId)], maxTurns: coreFirst ? Math.min(team.workBudget ?? orch.maxTurns, 32) : team.workBudget ?? orch.maxTurns },
      { ...child(orchestratorId), toolNames: orch.toolNames, extraTools: orchestratorTools },
    );
  } finally { mailbox.close(orchestratorId); }
  // 팀장이 wait 없이 끝났을 수 있다(턴 상한·조기 finish 실패). 남은 배정을 거두어 병합한다 —
  // 여기서 놓치면 이미 끝난 시공 결과가 조용히 사라진다.
  await Promise.all(inflight.map((entry) => entry.promise));
  if (coreFirst && !finishAccepted) throw new Error('첫 제작이 검증된 finish까지 끝나지 않았습니다. 저장된 핵심 플레이는 보존했습니다.');
  const authoringCompletion = inspectAuthoringHarness(working, base);
  if (authoringCompletion && (!finishAccepted || !authoringCompletion.ok || !authoringReview?.ok || authoringReview.signature !== authoringSignature(working))) {
    throw new Error('첫 만남 미완료: ' + (authoringCompletion.blockers.length ? authoringCompletion.blockers.join(' / ') : !finishAccepted ? '검증된 finish 호출이 없습니다.' : '현재 결과의 시각 검수 증거가 없습니다.'));
  }
  // The mandatory current-image review + executable contract already cover this
  // bounded first build. A second narrative audit delayed the terminal done even
  // after finish, and could time out a fully published, verified scene.
  const verifiedFirstBuild = isGenrePresetBriefRequest(request.task) && !!authoringCompletion;
  if (skipFinalReview && request.applyMode !== "yolo") {
    finished = `${finished ?? summaryOf(orchDone)}\n완료 후 검토: 켜진 검수 담당이 없어 생략했습니다.`;
    emit({ type: "team_report", text: finished });
  } else if (team.reviewAfterWork && request.applyMode !== "yolo" && !verifiedFirstBuild) {
    const finalReview = startTask(
      `제작이 끝난 최종 결과를 읽기 전용으로 검토하라. 사용자 요청: ${request.task}\n요청 충족 여부, 남은 문제와 확인 근거를 report_task로 보고한다. 직접 수정하지 않는다.`,
      "read", reviewers[0]!,
    );
    const outcome = await inflight.find(entry => entry.agentId === finalReview.agentId)!.promise;
    if (!outcome.ok) throw new Error(`완료 후 검토를 끝내지 못했습니다: ${outcome.summary}`);
    finished = `${finished ?? summaryOf(orchDone)}\n완료 후 검토: ${outcome.summary}`;
    emit({ type: "team_report", text: finished });
  }
  for (const id of orchDone.villageCompletion?.mapIds ?? []) villageMapIds.add(id);
  // The coordinator's snapshot is not a new per-map repair receipt. Preserve child failures.
  for (const report of orchDone.interiorCompletion ?? []) interiorReports.set(report.mapId, report);
  const interiorCompletion = [...interiorReports.values()];
  const villageCompletion = villageMapIds.size ? inspectPiVillageCompletion(working, base, villageMapIds) : undefined;
  emit({ type: "agent_done", agentId: orchestratorId, ok: !villageCompletion?.issues.length && !interiorCompletion.length && authoringCompletion?.ok !== false,
    summary: interiorCompletion.length ? "실내 미완료: " + JSON.stringify(interiorCompletion) : villageCompletion?.issues.length ? `마을 미완료: ${villageCompletion.issues.join("; ")}` : finished ?? summaryOf(orchDone), stats: orchDone.stats, changedKeys: [], spills: [], conflicts: [] });
  if (!finished) emit({ type: "team_report", text: `${summaryOf(orchDone)} · 팀장이 finish를 호출하지 않았습니다. 미확인 협의 ${mailbox.outstanding().length}건.` });

  // 병합본은 살아있는 프로젝트 위에 묶음만 얹은 결과다. 시공 팀원의 프루프는 이 프로세스에만
  // 살아 있으므로, 브라우저의 수용 게이트가 확인할 수 있게 병합 시점에 증거를 다시 찍는다.
  authorMergedSpatialProposal(working, base);
  const done: PiAgentDoneEvent = {
    interiorCompletion,
    ...(villageCompletion ? { villageCompletion } : {}),
    type: "done",
    project: working,
    stats: { ms: Date.now() - started, turns: orchDone.stats.turns + subTurns, toolCalls: toolCalls + orchDone.stats.toolCalls, toolErrors: toolErrors + orchDone.stats.toolErrors, usage: addPiAgentUsage(subUsage, orchDone.stats.usage) },
    changedKeys: changedProjectKeys(base, working),
    spatialProof: exportSpatialToolProof(working),
  };
  emit(slimDoneEvent(done, base));
  return done;
}

function summaryOf(done: PiAgentDoneEvent): string {
  return `${done.changedKeys.length}개 키 변경 · ${done.stats.toolCalls}툴콜 · ${Math.round(done.stats.ms / 1000)}초`;
}

function completionFailure(done: PiAgentDoneEvent): string {
  return [done.villageCompletion?.issues.length ? '마을 미완료: ' + done.villageCompletion.issues.join('; ') : '', done.interiorCompletion?.length ? '실내 미완료: ' + JSON.stringify(done.interiorCompletion) : ''].filter(Boolean).join('\n');
}
