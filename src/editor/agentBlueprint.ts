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

import { affectedRegions, orderedAssets, type AffectedRegion, type BuildSpec, type SpecAsset } from "@/ai/buildSpec";
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
  readonly title: string;
  readonly entries: readonly BlueprintEntry[];
  readonly revision: number;
}

type Listener = (state: AgentBlueprintState) => void;

const listeners = new Set<Listener>();
let mapId: MapId | null = null;
let title = "";
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
  return { mapId, title, entries: [...entries], revision };
}

export function agentBlueprintForMap(state: AgentBlueprintState, currentMapId: MapId | null): readonly BlueprintEntry[] {
  if (!currentMapId || state.mapId !== currentMapId) return [];
  return state.entries;
}

/** 진행률 — 청사진 칸 중 몇 개가 끝났는지. 상태칩·요약에 쓴다. */
export function agentBlueprintProgress(state: AgentBlueprintState): { readonly done: number; readonly total: number } {
  return { done: state.entries.filter((entry) => entry.status === "done").length, total: state.entries.length };
}

/**
 * set_build_spec 이 통과한 직후 호출 — 계획 전체를 `planned` 로 깔아둔다.
 * `orderedAssets` 를 쓰므로 화면 순번이 모델이 선언한 시공 순서와 같다.
 */
export function setAgentBlueprintFromSpec(spec: BuildSpec): void {
  const assets = orderedAssets(spec);
  const next: BlueprintEntry[] = [];
  for (const asset of assets) {
    const normalized = normalizeAsset(asset);
    if (!normalized) continue;
    next.push({
      id: asset.id,
      kind: asset.kind,
      label: blueprintKindLabel(asset.kind),
      x: normalized.x,
      y: normalized.y,
      w: normalized.w,
      h: normalized.h,
      order: next.length + 1,
      status: "planned",
    });
  }
  mapId = spec.mapId;
  title = spec.title ?? spec.mapId;
  entries = next;
  emit();
}

/**
 * 공간 쓰기 툴콜 하나가 들어왔을 때 청사진 진행을 갱신한다.
 *
 * 판정은 누적 커버리지 퍼센트가 아니라 **인과 순서**다: 이번 호출이 가장 잘 맞아떨어지는 칸
 * (bestOverlapIndex, IoU 기준)을 `building` 으로 올리고, 그 전에 `building` 이던 다른 칸은
 * `done` 으로 내린다. 누적 퍼센트를 쓰지 않는 이유는 한 에셋이 여러 툴콜로 쪼개져 들어오고
 * (집 한 채 = paint 여러 번) 어떤 툴은 args 에서 영역을 못 뽑아 `w:0,h:0` 을 내기 때문이다 —
 * 비율은 그럴 때 조용히 거짓말을 하고, 순서는 그러지 않는다.
 */
export function markAgentBlueprintProgress(toolName: string, args: Record<string, unknown>): void {
  if (entries.length === 0 || mapId === null) return;
  const regions = affectedRegions(toolName, args).filter((region) => region.mapId === mapId);
  const targetIndex = bestOverlapIndex(entries, regions);
  if (targetIndex === -1) return;
  if (entries[targetIndex].status === "building") return;

  entries = entries.map((entry, index) => {
    if (index === targetIndex) return { ...entry, status: "building" };
    if (entry.status === "building") return { ...entry, status: "done" };
    return entry;
  });
  emit();
}

/** 턴이 끝났다 — 진행 중이던 칸을 끝난 것으로 확정한다. */
export function finishAgentBlueprint(): void {
  if (!entries.some((entry) => entry.status === "building")) return;
  entries = entries.map((entry) => (entry.status === "building" ? { ...entry, status: "done" } : entry));
  emit();
}

export function clearAgentBlueprint(): void {
  if (entries.length === 0 && mapId === null && title === "") return;
  mapId = null;
  title = "";
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
 * 면적이 0 인 영역(args 에서 사각형을 못 뽑은 호출)은 점으로 취급해 그 점을 품는 칸을 찾는다.
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
  if (bestIndex !== -1) return bestIndex;

  // 면적 0 인 영역들: 시작점이 어느 칸 안에 있는지로 귀속한다.
  for (const region of regions) {
    if (region.w > 0 && region.h > 0) continue;
    const found = candidates.findIndex((entry) => containsPoint(entry, region.x, region.y));
    if (found !== -1) return found;
  }
  return -1;
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

function containsPoint(entry: BlueprintEntry, x: number, y: number): boolean {
  return x >= entry.x && x < entry.x + entry.w && y >= entry.y && y < entry.y + entry.h;
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
