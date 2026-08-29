// editor/agentBlueprint.ts
// 확정된 밑그림(BuildSpec)을 "맵에 그릴 수 있는 청사진"으로 바꿔 들고 있는 순수 상태 저장소.
//
// 왜 필요한가: 코드베이스의 진짜 밑그림인 `BuildSpec` 은 에셋별 사각형과 명시적 `buildOrder`
// 를 이미 갖고 있는데, 지금은 채팅에 접힌 `<details>` 텍스트로만 나가고 맵에는 한 번도
// 그려지지 않는다(aiChatPanel 의 set_build_spec 분기). 그래서 사용자는 "무엇을 어디에 몇 번째로
// 세울 계획인지"를 시공이 끝난 뒤 diff 로만 알게 된다. 이 모듈은 그 계획을 착공 전에 꺼내
// 놓고, 툴콜이 들어올 때마다 어느 칸이 진행 중이고 어디까지 끝났는지를 갱신한다.
//
// 브라우저·Phaser 비의존이다(렌더러는 `agentBlueprintRenderer.ts`). 고스트 프리뷰와 같은
// 모듈 싱글턴 규약을 따른다 — 마지막 기록자가 이긴다.
//
// 수명은 **세션의 활성 BuildSpec** 이다(고스트는 한 턴짜리라 수명이 다르다). 턴 시작마다
// `syncAgentBlueprintWithSpec(session.getActiveSpec())` 로 맞추고, 새 대화·패널 폐기에서
// `clearAgentBlueprint()` 로 지운다. 자세한 사고 기록은 syncAgentBlueprintWithSpec 주석에 있다.

import { orderedAssets, type AffectedRegion, type BuildSpec, type SpecAsset } from "@/ai/buildSpec";
import { blueprintRegionsForToolCall } from "@/editor/agentBlueprintRegions";
import type { MapId } from "@/project/types";

export type BlueprintEntryStatus = "planned" | "building" | "done";

export interface BlueprintEntry {
  /** BuildSpec 에셋 id — 진행 판정과 테스트 식별에만 쓰고 캔버스 라벨에는 넣지 않는다. */
  readonly id: string;
  readonly kind: string;
  /** 캔버스에 그릴 사람 말 라벨(도구명·내부 id 노출 금지 정책을 지킨다). */
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** buildOrder 기준 1-based 순번. */
  readonly order: number;
  readonly status: BlueprintEntryStatus;
}

export interface AgentBlueprintState {
  readonly mapId: MapId | null;
  readonly entries: readonly BlueprintEntry[];
  readonly revision: number;
}

/** 툴콜의 쓰기 여부 — 레지스트리의 `mode === "write"` 를 호출자가 넘긴다(아래 markAgentBlueprintProgress). */
export interface BlueprintToolCallMode {
  readonly write: boolean;
}

type Listener = (state: AgentBlueprintState) => void;

const listeners = new Set<Listener>();
let mapId: MapId | null = null;
let entries: BlueprintEntry[] = [];
let revision = 0;

// kind → 사람 말. BuildSpec.kind 는 모델이 자유롭게 쓰지만 villagePlan/village builder 가 내는
// 어휘는 좁다(road·house·prop·terrain·clear·event 계열). 모르는 kind 는 그대로 보여준다 —
// 억지 번역보다 원문이 덜 틀린다.
const KIND_LABELS: Readonly<Record<string, string>> = {
  clear: "정리",
  road: "길",
  path: "길",
  house: "집",
  building: "건물",
  // 스펙 자동 확장(assistantSession.autoExpandedAssetKind)의 기본값 — 코드가 정하는 7종
  // (clear·road·terrain·npc·prop·house·structure) 중 유일하게 번역이 없어 맵에 "3/9 structure"
  // 라는 영어 원문이 찍혔다. 나머지 6종은 위에 있다.
  structure: "구조물",
  yard: "마당",
  wall: "벽",
  fence: "울타리",
  water: "물",
  terrain: "지형",
  field: "밭",
  prop: "소품",
  tree: "나무",
  forest: "숲",
  furniture: "가구",
  interior: "실내",
  room: "방",
  door: "문",
  bridge: "다리",
  plaza: "광장",
  market: "장터",
  shop: "상점",
  well: "우물",
  npc: "주민",
  event: "이벤트",
  transfer: "이동",
  chest: "상자",
};

export function blueprintKindLabel(kind: string): string {
  const key = kind.trim().toLowerCase();
  return KIND_LABELS[key] ?? (kind.trim() === "" ? "구역" : kind.trim());
}

export function subscribeAgentBlueprint(listener: Listener): () => void {
  listeners.add(listener);
  listener(getAgentBlueprintState());
  return () => listeners.delete(listener);
}

export function getAgentBlueprintState(): AgentBlueprintState {
  return { mapId, entries: [...entries], revision };
}

export function agentBlueprintForMap(state: AgentBlueprintState, currentMapId: MapId | null): readonly BlueprintEntry[] {
  if (!currentMapId || state.mapId !== currentMapId) return [];
  return state.entries;
}

/**
 * set_build_spec 이 통과한 직후, 그리고 **턴이 시작될 때마다** 호출 — 계획을 청사진으로 깐다.
 *
 * 같은 맵에서 id·사각형이 그대로인 칸은 진행 상태(building/done)를 물려받는다. 물려받지 않으면
 * 턴마다 다시 깔 때 이미 끝난 칸이 planned 로 되감기고, 스펙 자동 확장(assistantSession 의
 * expandSpecWithRegions 가 활성 스펙에 에셋을 덧붙인다)이 한 번만 일어나도 진행이 전부 날아간다.
 * 바뀐 것이 없으면 emit 하지 않는다 — 턴마다 부르는 경로라서 조용해야 재렌더가 낭비되지 않는다.
 *
 * `orderedAssets` 를 쓰므로 화면 순번이 모델이 선언한 시공 순서와 같다.
 */
export function setAgentBlueprintFromSpec(spec: BuildSpec): void {
  const inherited = new Map<string, BlueprintEntryStatus>();
  if (spec.mapId === mapId) {
    for (const entry of entries) inherited.set(entryShapeKey(entry), entry.status);
  }
  const next: BlueprintEntry[] = [];
  for (const asset of orderedAssets(spec)) {
    const normalized = normalizeAsset(asset);
    if (!normalized) continue;
    const candidate: BlueprintEntry = {
      id: asset.id,
      kind: asset.kind,
      label: blueprintKindLabel(asset.kind),
      x: normalized.x,
      y: normalized.y,
      w: normalized.w,
      h: normalized.h,
      order: next.length + 1,
      status: "planned",
    };
    next.push({ ...candidate, status: inherited.get(entryShapeKey(candidate)) ?? "planned" });
  }
  if (spec.mapId === mapId && sameEntries(entries, next)) return;
  mapId = spec.mapId;
  entries = next;
  emit();
}

/**
 * 세션의 활성 밑그림에 청사진을 맞춘다 — 스펙이 없으면 지운다.
 *
 * 고스트(초안)는 한 턴짜리지만 BuildSpec 은 세션 것이다(assistantSession.applyBuildSpec:
 * "검증 통과 시 활성화(턴 간 유지)"). 청사진 정리를 clearAgentGhostPreview 에 묶어 뒀을 때는
 * 적용 경로(aiProposalCard.applyProposal 이 적용 직전에 고스트를 지운다)가 **처음 시공한 턴의
 * 끝에서 청사진을 지웠고**, set_build_spec 은 다음 턴에 다시 오지 않으므로 그 뒤로는 영원히 빈
 * 상태였다(패널은 "밑그림 확정 — 에셋 N개" 를 계속 출력했다). 마지막 칸의 done ✓ 도 확정과
 * 정리가 같은 턴 꼬리에서 일어나 볼 수 없었다. 그래서 청사진의 수명을 **세션 스펙**에 맨다.
 */
export function syncAgentBlueprintWithSpec(spec: BuildSpec | null): void {
  if (spec === null) {
    clearAgentBlueprint();
    return;
  }
  setAgentBlueprintFromSpec(spec);
}

/**
 * 공간 쓰기 툴콜 하나가 들어왔을 때 청사진 진행을 갱신한다.
 *
 * 판정은 누적 커버리지 퍼센트가 아니라 **인과 순서**다: 이번 호출이 가장 잘 맞아떨어지는 칸
 * (bestOverlapIndex, IoU 기준)을 `building` 으로 올리고, 그 전에 `building` 이던 다른 칸은
 * `done` 으로 내린다. 누적 퍼센트를 쓰지 않는 이유는 한 에셋이 여러 툴콜로 쪼개져 들어오기
 * 때문이다(집 한 채 = paint 여러 번) — 비율은 그럴 때 조용히 거짓말을 하고, 순서는 그러지 않는다.
 *
 * 영역은 `blueprintRegionsForToolCall`(청사진 전용 추출)이 뽑는다 — 스펙 게이트의
 * `affectedRegions` 는 좌표를 wrapper 키(`area`/`at`/`wallRect`/`origin`)에 담는 툴을 면적 0 으로
 * 떨어뜨리는데(게이트에는 맞는 fail-closed 동작이다) 청사진이 그대로 받으면 진행이 한 칸도
 * 안 움직인다. 사유는 그 모듈 머리말에 있다.
 *
 * 세 가지를 막는다. 전부 실측된 오작동이다.
 * 1. **읽기 툴**(`mode !== "write"`): 패널의 tool_call 훅은 성공한 모든 툴콜에서 발화하고
 *    show_map_region/get_map_region 은 `{mapId,x,y,w,h}` 를 그대로 받는다. show_map_region 의
 *    설명이 "맵에 뭔가 깐 뒤 이 툴로 눈으로 확인하라" 이므로 시공 직후의 정상 경로인데,
 *    영역이 진짜 사각형이라 IoU 승자가 바뀌어 **아직 짓는 중인 칸이 done 으로 밀려났다**.
 * 2. **위치를 모르는 호출**: 인자에 좌표가 아예 없는 쓰기 툴이 있다(wallRect 없는 build_roof 는
 *    맵의 벽 어휘 셀을 스캔해 자리를 스스로 찾는다). 폴백 `(0,0)` 은 시공 위치가 아니라 상수라서
 *    점으로 귀속하면 맵 전체를 덮는 1번 칸(clear)이 항상 이기고 나머지 칸이 전부 done 으로
 *    밀려난다. 위치를 모르면 침묵한다.
 * 3. **done → building 역주행**: 끝난 칸을 다시 짓는 중으로 표시하면 그 사이 칸들이 done 으로
 *    확정돼 "다 지었다"는 거짓 표시가 남는다.
 */
export function markAgentBlueprintProgress(
  toolName: string,
  args: Record<string, unknown>,
  mode: BlueprintToolCallMode
): void {
  if (!mode.write) return;
  if (entries.length === 0 || mapId === null) return;
  const call = blueprintRegionsForToolCall(toolName, args);
  if (call.mapId !== mapId) return;
  const regions = call.regions.filter((region) => region.mapId === mapId && region.w > 0 && region.h > 0);
  // 대상 전체를 한 호출로 짓는 파사드(author_village)는 한 칸으로 귀속하지 않는다 — 아래 함수 주석.
  if (call.wholeTarget) {
    advanceAllPlanned(regions);
    return;
  }
  if (regions.length === 0) return;
  const targetIndex = bestOverlapIndex(entries, regions);
  if (targetIndex === -1) return;
  // planned 만 building 으로 올린다 — 같은 칸 반복 호출은 그대로 두고, done 은 되돌리지 않는다.
  if (entries[targetIndex].status !== "planned") return;

  entries = entries.map((entry, index) => {
    if (index === targetIndex) return { ...entry, status: "building" };
    if (entry.status === "building") return { ...entry, status: "done" };
    return entry;
  });
  emit();
}

/**
 * 대상 전체를 짓는 파사드 한 호출 — 걸리는 planned 칸을 **전부** 짓는 중으로 올린다.
 *
 * 왜 한 칸을 고르지 않는가: `author_village` 한 호출이 정리·길·집·소품·주민을 다 만든다. 후보
 * 사각형을 하나 만들어 IoU 로 고르면(맵 사각형을 대신 넣든 target.bounds 를 쓰든) 맵 전체를
 * 덮는 `clear` 칸이 이기고 나머지 칸은 계획 상태로 남는다 — 1차 리뷰에서 고친 결함(큰 칸이
 * 항상 이긴다)의 재발이다. "이 호출이 모든 칸을 건드렸다"를 그대로 표시하는 것이 실제로 일어난
 * 일에 가장 가깝다.
 *
 * `regions` 가 비어 있으면(bounds 없는 호출 = 대상 전체) 그 맵의 planned 칸 전부, 있으면 그
 * 영역에 걸리는 칸만 올린다 — 북쪽 절반에 지은 마을이 남쪽 계획을 끌고 가지 않는다.
 * done 은 되돌리지 않고(역주행 금지), 확정은 종전대로 턴 끝의 finishAgentBlueprint 가 한다.
 */
function advanceAllPlanned(regions: readonly AffectedRegion[]): void {
  const touched = (entry: BlueprintEntry): boolean =>
    entry.status === "planned" && (regions.length === 0 || regions.some((region) => overlapArea(entry, region) > 0));
  if (!entries.some(touched)) return;
  entries = entries.map((entry) => (touched(entry) ? { ...entry, status: "building" } : entry));
  emit();
}

/** 턴이 끝났다 — 진행 중이던 칸을 끝난 것으로 확정한다. */
export function finishAgentBlueprint(): void {
  if (!entries.some((entry) => entry.status === "building")) return;
  entries = entries.map((entry) => (entry.status === "building" ? { ...entry, status: "done" } : entry));
  emit();
}

export function clearAgentBlueprint(): void {
  if (entries.length === 0 && mapId === null) return;
  mapId = null;
  entries = [];
  emit();
}

/**
 * 이번 호출과 가장 잘 맞아떨어지는 칸의 인덱스 — 겹침 면적이 아니라 **IoU**(겹침 / 합집합)로 고른다.
 *
 * 절대 면적으로 고르면 큰 칸이 항상 이긴다: 마을 계획은 보통 맵 전체를 덮는 `clear` 에셋을
 * 1번 칸으로 두는데, 길 60칸을 칠하면 길과의 겹침도 60, clear 와의 겹침도 60 이라 동점이 되고
 * 순서가 앞선 clear 가 계속 building 으로 남는다(실측: 이 테스트가 처음 잡은 결함). IoU 는
 * 길 60/60=1.0 대 clear 60/600=0.1 로 갈라주고, 맵 전체를 치우는 호출에서는 반대로 clear 가
 * 1.0 으로 이긴다.
 *
 * 영역이 여러 개면 겹침과 영역 면적을 각각 합쳐서 계산한다 — 영역끼리 겹치면 이중 계산이
 * 되지만 진행 표시용 어림이므로 정확한 합집합을 구하는 비용을 쓰지 않는다.
 * 면적이 0 인 영역은 호출자가 이미 걸러 낸다(markAgentBlueprintProgress 주석 2번).
 * 아무 칸도 안 걸리면 -1.
 */
function bestOverlapIndex(candidates: readonly BlueprintEntry[], regions: readonly AffectedRegion[]): number {
  let regionArea = 0;
  for (const region of regions) {
    if (region.w > 0 && region.h > 0) regionArea += region.w * region.h;
  }

  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const entry = candidates[index];
    let intersection = 0;
    for (const region of regions) {
      intersection += overlapArea(entry, region);
    }
    if (intersection <= 0) continue;
    const union = entry.w * entry.h + regionArea - intersection;
    const score = union > 0 ? intersection / union : 0;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function overlapArea(entry: BlueprintEntry, region: AffectedRegion): number {
  if (region.w <= 0 || region.h <= 0) return 0;
  const x0 = Math.max(entry.x, region.x);
  const y0 = Math.max(entry.y, region.y);
  const x1 = Math.min(entry.x + entry.w, region.x + region.w);
  const y1 = Math.min(entry.y + entry.h, region.y + region.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  return (x1 - x0) * (y1 - y0);
}

/** 진행 상태를 물려받을 때 쓰는 동일성 — id 가 같아도 사각형이 움직였으면 다른 칸이다. */
function entryShapeKey(entry: BlueprintEntry): string {
  return `${entry.id}:${entry.x},${entry.y},${entry.w},${entry.h}`;
}

function sameEntries(a: readonly BlueprintEntry[], b: readonly BlueprintEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return entryShapeKey(entry) === entryShapeKey(other)
      && entry.status === other.status
      && entry.order === other.order
      && entry.label === other.label;
  });
}

function normalizeAsset(asset: SpecAsset): { x: number; y: number; w: number; h: number } | null {
  const x = Math.trunc(asset.x);
  const y = Math.trunc(asset.y);
  const w = Math.trunc(asset.w);
  const h = Math.trunc(asset.h);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function emit(): void {
  revision += 1;
  const snapshot = getAgentBlueprintState();
  for (const listener of listeners) listener(snapshot);
}
