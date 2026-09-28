import { packTownTargetFor } from "./packTownRoute";
import { withVillageMorphologyDefault } from "@/editor/tools/village/defaultMorphology";
import { computeReachableCells } from "@/project/lint/reachability";
import type { Project } from "@/project/types";
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import type { IntentDeclaration, IntentSelectionFact } from "@/ai/intentDeclaration";
import { estimateVillageSize } from "@/ai/constructionDeclaration";
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
  const preset = project.villagePresets?.find(p => p.id === project.defaultVillagePresetId);
  // 설계서가 없으면 요청에 가장 가까운 완성 마을 사례가 사용자가 말하지 않은 집 수·크기·배치의 기본이다(2026-09-28).
  // 예전엔 코드 기본값(12채·강변촌·88×56)이 굳어 「숲마을」「바닷가 어촌」「절벽 위 폭포」가 같은 마을이 됐다.
  const reference: ReturnType<typeof villageReferenceDefaults> = preset ? { layouts: [] } : villageReferenceDefaults(project, requestText ?? intent.summary ?? "");
  const houseCount = declared?.houseCount ?? (declared?.scale ? estimateVillageSize(declared).houseCount
    : preset?.houseCount ?? preset?.design?.houseCount.min ?? reference.houseCount ?? estimateVillageSize().houseCount);
  let mapId = intent.targetMapId ?? currentMapId;
  let target: Record<string, unknown>;
  if (selection && intent.useSelection) {
    mapId = selection.mapId;
    target = { kind: "existing", mapId, bounds: { x: selection.x, y: selection.y, w: selection.width, h: selection.height } };
  } else if (declared?.targetName || !mapId) {
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
  return { args, mapId, houseCount: args.houseCount as number, npcCount: args.npcCount as number, residentDialogue: declared?.residentDialogue !== false,
    ...(reference.referenceId ? { referenceId: reference.referenceId } : {}) };
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

export interface VillageDraftReceipt {
  readonly data: AuthorVillageFacadeData;
  readonly built: Project;
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

/** Geometry passed structural QA at build time; only resident dialogue may change afterwards. */
export function validateVillageContract(project: Project, _baseline: Project, contract: VillageContract,
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
  const entry = startInScope ? start : fronts[0];
  if (!current || !entry || fronts.length !== contract.houseCount) issues.push("마을 입구·집 문앞 증거가 없습니다.");
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

function stable(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])));
  return JSON.stringify(value);
}
