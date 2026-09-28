import { packTownTargetFor } from "./packTownRoute";
import { withVillageMorphologyDefault } from "@/editor/tools/village/defaultMorphology";
import { computeReachableCells } from "@/project/lint/reachability";
import type { Project } from "@/project/types";
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import type { IntentDeclaration, IntentSelectionFact } from "@/ai/intentDeclaration";
import { estimateVillageSize } from "@/ai/constructionDeclaration";
import type { ConstructionApproach } from "@/ai/constructionDeclaration";
import { villageReferenceDefaults } from "@/ai/villageReferenceExamples";
import { runTool } from "@/editor/tools/toolRunner";
import { isLivedMap } from "@/editor/tools/authorVillageScope";
import { resolveVillageDesignInput } from "@/editor/tools/village/designContract";
import type { PiToolCallRecord } from "./toolAdapter";
import type { AuthorVillageFacadeData } from "@/editor/tools/authorVillageSupport";
import type { PiVillageCompletion } from "./villageCompletion";

/** Frozen before execution. Tool discovery, planning and repair cannot relax these values. */
export interface VillageContract {
  readonly args: Readonly<Record<string, unknown>>;
  readonly mapId: string;
  readonly houseCount: number;
  readonly npcCount: number;
  readonly residentDialogue?: boolean;
  /**
   * 「위로 올라가면 마을」— 새 마을 맵을 짓고, 지금 맵의 그쪽 끝과 마을의 반대쪽 끝을 코드가 잇는다
   * (villageConnection.connectContractVillage). 모델에게 맡기지 않는다: 계약 실행은 author_village 외 쓰기를 막는다.
   */
  readonly connection?: { readonly fromMapId: string; readonly side: ConstructionApproach };
  /** 요청 문장으로 고른 완성 마을 사례 — author_village 결과가 이 사례와 비교한다(시공 인자는 아니다). */
  readonly referenceId?: string;
}

export function resolveVillageContract(project: Project, intent: IntentDeclaration, currentMapId: string | null,
  selection: IntentSelectionFact | null, requestText?: string): VillageContract | undefined {
  // 장르 기획 요청은 게임 전체 저작이다. 2026-09-24 몬스터 수집 gen3: 의도 선언이 마을만 골라 계약이 걸렸고,
  // configure_monster_system·set_opening·set_title_screen 이 「마을 계약」으로 거부된 채 73초 만에 마을만 남았다.
  if (isGenrePresetBriefRequest(requestText)) return;
  if (intent.source !== "llm" || intent.mode === "question" || !intent.tools.includes("author_village")) return;
  // 팩 도시 타일셋(Rasak 등) 마을은 build_pack_town 이 짠다 — 계약을 걸면 author_village 만 허용돼 숲마을로 바뀐다(packTownRoute).
  if (packTownTargetFor(project, requestText, intent.targetMapId ?? currentMapId)) return;
  // Multi-goal adventures retain their existing orchestration; this contract owns one village.
  if (intent.adventure || intent.npcRewards || intent.functionalAcceptance?.length || intent.actionCombat) return;
  const declared = intent.construction;
  const origin = intent.targetMapId ?? currentMapId;
  const originMap = origin ? project.maps[origin] : undefined;
  const useSelection = !!selection && intent.useSelection;
  // 2026-09-28 실측(「위로 올라가면 마을」, 숲·NPC가 있는 빈 시작 맵): 계약이 target:{kind:"existing"}·bounds 없음으로
  // 얼어 있었고, author_village 는 내용 있는 맵의 전체 재시공을 village-requires-scope 로 거부한다 — 6번 중 5번 실패.
  // 얼린 인자가 원천적으로 실패할 조합이면 계약이 아니다. 빈 땅 bounds 를 고르는 일은 맵을 읽어야 하므로
  // 일반 경로(마을 노트: 빈 땅 bounds → 없으면 새 맵)에 맡긴다. 방향이 있는 요청은 아래에서 새 맵 + 연결로 간다.
  const livedWholeMap = !useSelection && !declared?.targetName && !declared?.approach && !!originMap && isLivedMap(originMap);
  if (livedWholeMap) return;
  const preset = project.villagePresets?.find(p => p.id === project.defaultVillagePresetId);
  // 설계서가 없으면 요청에 가장 가까운 완성 마을 사례가 사용자가 말하지 않은 집 수·크기·배치의 기본이다(2026-09-28).
  // 예전엔 코드 기본값(12채·강변촌·88×56)이 굳어 「숲마을」「바닷가 어촌」「절벽 위 폭포」가 같은 마을이 됐다.
  const reference: ReturnType<typeof villageReferenceDefaults> = preset ? { layouts: [] } : villageReferenceDefaults(project, requestText ?? intent.summary ?? "");
  const houseCount = declared?.houseCount ?? (declared?.scale ? estimateVillageSize(declared).houseCount
    : preset?.houseCount ?? preset?.design?.houseCount.min ?? reference.houseCount ?? estimateVillageSize().houseCount);
  let mapId = origin;
  let target: Record<string, unknown>;
  if (selection && useSelection) {
    mapId = selection.mapId;
    target = { kind: "existing", mapId, bounds: { x: selection.x, y: selection.y, w: selection.width, h: selection.height } };
  } else if (declared?.targetName || declared?.approach || !mapId) {
    mapId = "map_village";
    for (let n = 2; project.maps[mapId]; n++) mapId = `map_village_${n}`;
    target = { kind: "new", mapId, name: declared?.targetName ?? "새 마을" };
  } else target = { kind: "existing", mapId };
  // The same DB resolver used by the facade detects conflicts before any mutation.
  const base = { target, houseCount, countPolicy: "exact",
    ...(declared?.morphology ? { morphology: declared.morphology } : {}),
    ...(declared?.theme ? { theme: declared.theme } : {}),
    ...(declared?.npcCount !== undefined ? { npcCount: declared.npcCount } : {}) };
  const layout = declared?.morphology || declared?.theme || selection ? undefined
    : pickReferenceLayout(project, target, houseCount, reference.layouts);
  const args = withVillageMorphologyDefault(project, resolveVillageDesignInput(project, layout ? { ...base, ...layout.args, target: layout.target } : base, true));
  args.npcCount ??= preset?.npcCount ?? houseCount + 2;
  const connection = !useSelection && declared?.approach && originMap ? { fromMapId: originMap.id, side: declared.approach } : undefined;
  return { args, mapId, houseCount: args.houseCount as number, npcCount: args.npcCount as number, residentDialogue: declared?.residentDialogue !== false,
    ...(reference.referenceId ? { referenceId: reference.referenceId } : {}),
    ...(connection ? { connection } : {}) };
}

/**
 * 사례 배치 후보를 dryRun 으로 실제로 지어 보고 처음 성공하는 것을 고른다. 시공기는 같은 인자라도 시드·크기에 따라
 * 채수가 모자라 실패하므로(2026-09-28 실측: 절벽+theme 은 6시드 모두 실패) 인자만 보고 정하지 않는다.
 * 빈 맵(기존 대상)은 minSize 로 사례 크기까지 넓혀 짓고, 이미 내용이 있는 맵은 후보를 쓰지 않는다. 모두 실패하면 undefined — 옛 기본값.
 * 비용: 후보 하나당 시공 한 번(실측 약 3.5초, 빈 맵·8채). 후보는 최대 다섯이고 보통 첫 후보에서 끝난다.
 * runTool dryRun 은 원본 프로젝트를 바꾸지 않으므로 사본을 만들지 않는다.
 */
function pickReferenceLayout(project: Project, target: Record<string, unknown>, houseCount: number,
  layouts: readonly import("@/ai/villageReferenceExamples").VillageLayoutCandidate[]):
  { readonly args: Record<string, unknown>; readonly target: Record<string, unknown> } | undefined {
  const existing = target.kind === "existing" ? project.maps[String(target.mapId)] : undefined;
  if (target.kind === "existing" && (!existing || isLivedMap(existing))) return undefined;
  for (const candidate of layouts) {
    const { width, height, ...rest } = candidate;
    const sized = target.kind === "new" ? { ...target, width, height } : { ...target, minSize: { width, height } };
    const built = runTool({ project }, "author_village", { target: sized, houseCount, countPolicy: "exact", npcCount: 0, seed: 7, interior: false, ...rest }, { dryRun: true });
    // 시험한 시드를 계약에 묶는다 — 다른 시드는 같은 배치에서도 채수가 모자랄 수 있다(실측 street+hills 시드 5).
    if (built.ok) return { args: { ...rest, seed: 7 }, target: sized };
  }
  return undefined;
}

/** 계약 연결의 실제 결과 — 두 출입구와 마을 쪽 착지. 완료 검사는 이 칸들로 통행을 확인한다. */
export interface VillageConnectionReceipt {
  readonly fromMapId: string;
  readonly originGate: { readonly x: number; readonly y: number };
  readonly villageMapId: string;
  readonly villageGate: { readonly x: number; readonly y: number };
  readonly villageLanding: { readonly x: number; readonly y: number };
}

export interface VillageDraftReceipt {
  readonly data: AuthorVillageFacadeData;
  readonly built: Project;
  readonly connection?: VillageConnectionReceipt;
}

export function villageDraftReceipt(record: PiToolCallRecord, project: Project): VillageDraftReceipt | undefined {
  if (record.name !== "author_village" || !record.result.ok) return;
  const data = record.result.data as AuthorVillageFacadeData | undefined;
  return data?.village ? { data, built: structuredClone(project) } : undefined;
}

export function assertVillageContractArgs(contract: VillageContract, params: unknown): void {
  const args = params as Record<string, unknown>;
  for (const [key, value] of Object.entries(contract.args)) {
    if (stable(args?.[key]) !== stable(value)) throw new Error(`마을 계약의 ${key}를 유지하세요: ${JSON.stringify(value)}`);
  }
}

/**
 * 얼린 인자 그대로는 절대 통과할 수 없는 거부인가. 이 코드들은 도구가 대상·범위·칩셋·설계서를 보고 내는 판정이라
 * 같은 계약 인자로 몇 번을 다시 불러도 같은 결과다(2026-09-28: village-requires-scope 로 5번 헛돌았다).
 * 집·주민 수 부족이나 문·길 검사처럼 seed 가 바뀌면 통과할 수 있는 실패는 여기 넣지 않는다.
 */
const CONTRACT_BLOCKING_CODES: ReadonlySet<string> = new Set([
  "village-requires-scope", "village-scope-conflict", "village-tileset-mismatch", "tileset-not-found",
  "bounds-too-small", "bounds-out-of-map", "map-not-found", "map-exists",
  "village-design-conflict", "village-design-invalid", "village-design-missing", "village-design-templates", "village-design-use-author",
]);

/** 계약을 풀어야 하는 거부면 그 코드와 문장, 아니면 undefined. 계약 인자를 그대로 쓴 호출만 본다. */
export function villageContractBlocker(contract: VillageContract, record: PiToolCallRecord): { readonly code: string; readonly message: string } | undefined {
  if (record.name !== "author_village" || record.result.ok) return;
  // 모델이 계약 인자를 바꿔 부른 호출은 wrapTool 이 실행 전에 막는다. 여기 오는 실패는 계약 인자 그대로다.
  try { assertVillageContractArgs(contract, record.args); } catch { return; }
  // 파서 거부(invalid-args)는 계약이 얼린 target 을 가리킬 때만 막다른 길이다 — 선택 영역이 16×16 보다 작으면
  // bounds 가 파서 하한에 걸리는데, 계약이 bounds 를 얼려서 모델이 넓힐 수 없다. residents 같은 모델 몫 인자 오류는 모델이 고친다.
  const issue = (record.result.issues ?? []).find(entry => CONTRACT_BLOCKING_CODES.has(entry.code)
    || (entry.code === "invalid-args" && /authorVillage\.target\b/u.test(entry.message)));
  return issue ? { code: issue.code, message: issue.message } : undefined;
}

/** 계약을 푼 뒤 모델이 읽는 안내 — 계약 지시 줄을 이것으로 바꾸고, 계약을 푼 도구 실패 결과에도 붙인다. */
export function villageContractReleaseNotice(contract: VillageContract, blocker: { readonly code: string; readonly message: string }): string {
  const target = JSON.stringify(contract.args.target);
  const next = blocker.code === "village-requires-scope"
    ? `맵 ${contract.mapId}에는 이미 내용이 있다. get_map_region 으로 비어 있는 16×16 이상 땅을 찾아 target.bounds 로 짓고, 그런 땅이 없으면 target:{kind:"new"} 새 맵에 지은 뒤 무엇을 했는지 보고한다. 사용자가 전부 다시 지으라고 하지 않았으면 fullMap:true 를 쓰지 않는다.`
    : blocker.code === "village-tileset-mismatch" || blocker.code === "tileset-not-found"
      ? "이 맵의 칩셋에는 author_village 를 쓸 수 없다. 새 맵(target:{kind:\"new\"})에 짓거나 이 칩셋의 다른 시공 도구를 find_tools 로 찾는다."
      : blocker.code.startsWith("village-design-")
        ? "DB 마을 설계서와 요청이 충돌한다. 설계서를 몰래 바꾸거나 우회하지 말고 차이를 사용자에게 보고한다."
        : "오류 문장을 읽고 대상 맵·범위를 실제로 존재하는 값으로 고쳐 다시 부른다.";
  return `[마을 계약 해제] 실행 전에 고정한 인자(target ${target})가 도구 규칙에 막혔다(${blocker.code}). 같은 인자로 다시 부르지 않는다. `
    + `이제 일반 실행이다 — author_village 인자를 직접 정할 수 있고, create_map·link_maps 같은 다른 쓰기 도구도 쓸 수 있다. ${next} `
    + `사용자 요청의 집·주민 수(${contract.houseCount}채·${contract.npcCount}명)는 그대로 지킨다.`;
}

/** Geometry passed structural QA at build time; only resident dialogue may change afterwards. */
export function validateVillageContract(project: Project, baseline: Project, contract: VillageContract,
  receipt?: VillageDraftReceipt): PiVillageCompletion {
  const issues: string[] = [];
  const mapIds = [contract.mapId];
  if (!receipt) return { mapIds, issues: ["요청한 마을이 시공되지 않았습니다."] };
  const village = receipt.data.village;
  const residents = new Set(village.residentEventIds ?? []);
  if (village.exteriorMapId !== contract.mapId) issues.push("시공 대상이 요청과 다릅니다.");
  if (village.actualHouseCount !== contract.houseCount) issues.push(`집 ${village.actualHouseCount}/${contract.houseCount}채`);
  if (!village.structuralQa.ok) issues.push("문·길 연결 검사 미통과");
  const current = project.maps[contract.mapId];
  const actualResidents = current?.events.filter(event => residents.has(event.id)) ?? [];
  if (actualResidents.length !== contract.npcCount) issues.push(`주민 ${actualResidents.length}/${contract.npcCount}명`);
  const fronts = village.doorFronts ?? [];
  const target = contract.args.target as { bounds?: { x: number; y: number; w: number; h: number } };
  const bounds = target.bounds;
  const start = project.startPos;
  const startInScope = project.startMapId === contract.mapId && (!bounds || (start.x >= bounds.x && start.y >= bounds.y
    && start.x < bounds.x + bounds.w && start.y < bounds.y + bounds.h));
  const link = receipt.connection;
  if (contract.connection) {
    const from = contract.connection.fromMapId;
    if (!link) issues.push(`${from}에서 ${APPROACH_LABEL[contract.connection.side]}쪽으로 마을에 가는 출입구가 없습니다.`);
    else if (baseline.startMapId === from && project.startMapId !== from) issues.push(`게임 시작 위치가 출발 맵 ${from}에서 옮겨졌습니다.`);
    else if (project.startMapId === from) {
      const originMap = project.maps[from];
      const reach = originMap ? computeReachableCells(project, originMap, start.x, start.y) : new Set<string>();
      if (!reach.has(`${link.originGate.x},${link.originGate.y}`)) issues.push(`시작 위치에서 마을 출입구(${link.originGate.x},${link.originGate.y})까지 걸어갈 수 없습니다.`);
    }
  }
  const entry = contract.connection ? link?.villageLanding : startInScope ? start : fronts[0];
  // 연결 요청에서 출입구가 없으면 위에서 이미 보고했다 — 같은 원인을 두 줄로 세지 않는다.
  if (contract.connection && !link) { /* reported above */ } else if (!current || !entry || fronts.length !== contract.houseCount) issues.push("마을 입구·집 문앞 증거가 없습니다.");
  else {
    const reachable = computeReachableCells(project, current, entry.x, entry.y);
    const missing = fronts.filter(front => !reachable.has(`${front.x},${front.y}`));
    if (missing.length) issues.push(`마을 입구에서 집 문앞 도달 실패 ${missing.length}/${fronts.length}`);
  }
  const geometry = (p: Project) => JSON.stringify(Object.fromEntries(Object.entries(p.maps).map(([id, map]) => [id,
    { ...map, events: map.events.map(event => id === contract.mapId && residents.has(event.id)
      ? { id: event.id, x: event.x, y: event.y } : event) }])));
  if (geometry(project) !== geometry(receipt.built)) issues.push("구조 검사 이후 지형·건물·기존 이벤트가 변경되었습니다.");
  if (contract.residentDialogue !== false) for (const npc of actualResidents) {
    const pages = npc.pages ?? [];
    const missing = pages.filter(page => !page.commands.some(command => command.kind === "text" && command.body.trim()));
    if (!pages.length || missing.length) issues.push(`${contract.mapId}/${npc.id}: 대사 없는 페이지 ${missing.map(page => page.id).join(", ") || "(페이지 없음)"}`);
  }
  return { mapIds, issues };
}

const APPROACH_LABEL: Record<ConstructionApproach, string> = { north: "북", south: "남", east: "동", west: "서" };

function stable(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])));
  return JSON.stringify(value);
}
