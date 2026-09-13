import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import {
  applyAuthoringPreview,
  clearAuthoringSession,
  editAuthoringDraft,
  hasAuthoringDraft,
  hasAuthoringPreview,
  previewAuthoringDraft,
  spatialAuthoringController,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { selectSpatialDesign } from "@/editor/panels/spatialAuthoringSession";
import { catalogRegionDesign, catalogWorldDesign } from "@/editor/content/spatial/catalogSeed";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import {
  blankRegionDesign,
  blankSettlementRegionDesign,
  blankWorldDesign,
  commitGeographyEdit,
  editGeography,
  freshGeographyId,
  geographyDraftTarget,
  geographyFromProject,
  upsertGeography,
  type GeographyDesign,
  type GeographyDraftTarget,
  type GeographyEditResult,
  type GeographyKind,
} from "@/editor/panels/spatialGeographyDraft";
import { libraryGeographyCardId, previewGeographyDelete } from "@/editor/panels/spatialGeographyQuery";
import type { SpatialAuthoringRequest } from "@/editor/spatial/authoringTypes";
import type { SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { store } from "@/project/store";

export type SpatialGeographyChrome = {
  readonly add?: () => void;
  readonly activate?: () => void;
  readonly duplicate?: () => void;
  readonly delete?: () => void;
  readonly preview?: () => void;
  readonly apply?: () => void;
  readonly refresh?: () => void;
  readonly detach?: () => void;
  readonly undo?: () => void;
  readonly redo?: () => void;
  readonly saveState: string;
  readonly previewError: string | null;
  readonly deleteOpen?: boolean;
  readonly onDeleteConfirm?: () => void;
};

export function workingProject(): Project {
  return visibleAuthoringProject();
}

function compileRequest(target: GeographyDraftTarget | undefined): SpatialAuthoringRequest {
  if (target?.occurrenceId) {
    return { operation: { kind: "edit" }, compile: { occurrenceId: target.occurrenceId } };
  }
  return { operation: { kind: "edit" } };
}

function note(result: ReturnType<typeof spatialAuthoringErrorText>, saveState?: string): void {
  geographyChromeState.previewError = result;
  if (saveState !== undefined) geographyChromeState.saveState = saveState;
}

export function mutateWorkingGeography(
  target: GeographyDraftTarget,
  patch: (design: GeographyDesign) => GeographyDesign,
): void {
  const result = editAuthoringDraft((project) => editGeography(project, target, patch), compileRequest(target));
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안" : geographyChromeState.saveState);
}

export function commitWorkingGeography(target: GeographyDraftTarget, edited: GeographyEditResult): boolean {
  if (edited.kind === "rejected") {
    geographyChromeState.previewError = edited.code;
    return false;
  }
  const result = editAuthoringDraft(
    (project) => commitGeographyEdit(project, target, edited),
    compileRequest(target),
  );
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안" : geographyChromeState.saveState);
  return result.kind === "ok";
}

export function workingGeography(card: SpatialGalleryCard | undefined, kind: GeographyKind): GeographyDesign | undefined {
  if (!card) return undefined;
  return geographyFromProject(workingProject(), geographyDraftTarget(card, kind));
}

/**
 * 스테이지·인스펙터 공통 표시 설계 — 라이브러리 설계가 없는 기본 설계 카드는
 * 카탈로그 정본을 읽기 전용으로 돌려준다. `readonly` 면 편집 도구·필드를 달지 않는다.
 */
export function viewableGeography(
  card: SpatialGalleryCard | undefined,
  kind: GeographyKind,
): { design: GeographyDesign | undefined; readonly: boolean } {
  const live = workingGeography(card, kind);
  if (live) return { design: live, readonly: false };
  if (card?.source === "default" && card.localId) {
    const catalog = kind === "region" ? catalogRegionDesign(card.localId) : catalogWorldDesign(card.localId);
    if (catalog) return { design: catalog, readonly: true };
  }
  return { design: undefined, readonly: false };
}

export function visibleGeographySelection(
  card: SpatialGalleryCard | undefined,
  kind: GeographyKind,
): SpatialGalleryCard | undefined {
  const createdId = geographyChromeState.createdDesignId;
  if (!createdId) return card;
  const library = workingProject().spatialAuthoring?.library;
  const design = kind === "region" ? library?.regions[createdId] : library?.worlds[createdId];
  if (!design) return card;
  return {
    id: libraryGeographyCardId(kind, design.id),
    localId: design.id,
    name: design.name,
    source: "own",
    kind: kind === "region" ? "regions" : "worlds",
    usage: 0,
    ...(kind === "region" && "settlement" in design && design.settlement ? { regionKind: "settlement" as const } : {}),
  };
}

export function spatialGeographyChrome(
  card: SpatialGalleryCard | undefined,
  kind: GeographyKind,
  rerender: () => void,
): SpatialGeographyChrome {
  const controller = spatialAuthoringController();
  const target = card ? geographyDraftTarget(card, kind) : undefined;
  const builtinLocked = card?.source === "default";
  const missing = Boolean(card?.missingSource);
  const occurrenceId = target?.occurrenceId;
  // 활성화 실패 문구는 그 프로젝트 전용이다 — canonical 문서가 생긴 뒤에도 남으면 stale 오류가 된다.
  if (workingProject().spatialAuthoring && geographyChromeState.previewError?.startsWith("장소 설계 활성화")) {
    geographyChromeState.previewError = null;
  }
  const external = geographyChromeState.pendingExternal;
  return {
    saveState: geographyChromeState.activating ? "활성화 중…" : geographyChromeState.saveState,
    previewError: geographyChromeState.previewError,
    deleteOpen: geographyChromeState.deleteOpen || external !== null,
    activate: workingProject().spatialAuthoring || geographyChromeState.activating ? undefined : () => activateSpatialDocument(rerender),
    add: controller ? () => addBlank(kind, rerender) : undefined,
    duplicate: controller && target && !builtinLocked ? () => cloneGeography(target, rerender) : undefined,
    delete: controller && target && !builtinLocked ? () => { geographyChromeState.pendingExternal = null; geographyChromeState.deleteOpen = true; rerender(); } : undefined,
    onDeleteConfirm: external
      ? () => { geographyChromeState.pendingExternal = null; queueOperation(withRemovedExternal(external), rerender); }
      : controller && target && geographyChromeState.deleteOpen ? () => confirmDelete(target, rerender) : undefined,
    preview: controller && hasAuthoringDraft() ? () => previewGeography(rerender) : undefined,
    apply: controller && hasAuthoringPreview() ? () => applyGeography(rerender) : undefined,
    undo: controller ? () => { controller.undo(); rerender(); } : undefined,
    redo: controller ? () => { controller.redo(); rerender(); } : undefined,
    refresh: controller && occurrenceId && !missing
      ? () => queueOperation({
        operation: { kind: "refresh", request: { occurrenceId, externalConnections: "reject" } },
        compile: { occurrenceId },
      }, rerender)
      : undefined,
    detach: controller && occurrenceId
      ? () => queueOperation({ operation: { kind: "detach", occurrenceId } }, rerender)
      : undefined,
  };
}

function previewGeography(rerender: () => void): void {
  const result = previewAuthoringDraft();
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "미리보기" : geographyChromeState.saveState);
  rerender();
}

function applyGeography(rerender: () => void): void {
  if (!hasAuthoringPreview()) {
    geographyChromeState.previewError = "authoring-preview-missing";
    rerender();
    return;
  }
  const result = applyAuthoringPreview();
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "적용" : geographyChromeState.saveState);
  rerender();
}

function addBlank(kind: GeographyKind, rerender: () => void): void {
  if (!spatialDocumentPresent(rerender)) return;
  let createdId: SpatialId | undefined;
  const result = editAuthoringDraft((project) => {
    const created = kind === "region" ? blankRegionDesign(project) : blankWorldDesign(project);
    createdId = created.id;
    return upsertGeography(project, kind, created);
  });
  if (result.kind === "ok" && createdId) {
    geographyChromeState.createdDesignId = createdId;
    selectSpatialDesign(libraryGeographyCardId(kind, createdId));
  }
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안" : geographyChromeState.saveState);
  rerender();
}

/** 레거시 프로젝트는 spatialAuthoring 문서가 없어 upsert가 조용히 무시된다 — 사전에 표면에 올린다. */
function spatialDocumentPresent(rerender: () => void): boolean {
  if (workingProject().spatialAuthoring) return true;
  geographyChromeState.previewError = "spatialAuthoring 문서가 없는 레거시 프로젝트입니다 — 「장소 설계 활성화」로 canonical 문서를 발행한 뒤 지역·세계를 만들 수 있습니다";
  rerender();
  return false;
}

/** 원격 베이스라인에서 canonical 문서를 발행하는 유일한 경로 — store 가 권한·저장 상태를 검증한다. */
export function activateSpatialDocument(rerender: () => void): void {
  if (geographyChromeState.activating) return;
  geographyChromeState.activating = true;
  geographyChromeState.previewError = "장소 설계 문서를 활성화하는 중…";
  rerender();
  void store.activateSpatialAuthoring()
    .then(() => {
      geographyChromeState.previewError = null;
      geographyChromeState.saveState = "활성화됨";
    })
    .catch((error: unknown) => {
      geographyChromeState.previewError = `장소 설계 활성화 실패: ${error instanceof Error ? error.message : String(error)}`;
    })
    .finally(() => {
      geographyChromeState.activating = false;
      rerender();
    });
}

/** 마을 설계서 카드 → 정주지 지역 설계 생성. */
export function createSettlementRegion(card: SpatialGalleryCard, rerender: () => void): void {
  if (!card.localId) return;
  if (!spatialDocumentPresent(rerender)) return;
  let createdId: SpatialId | undefined;
  const result = editAuthoringDraft((project) => {
    const created = blankSettlementRegionDesign(project, card.localId!, card.name);
    createdId = created.id;
    return upsertGeography(project, "region", created);
  });
  if (result.kind === "ok" && createdId) {
    geographyChromeState.createdDesignId = createdId;
    selectSpatialDesign(libraryGeographyCardId("region", createdId));
  }
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안" : geographyChromeState.saveState);
  rerender();
}

function cloneGeography(target: GeographyDraftTarget, rerender: () => void): void {
  if (target.occurrenceId) {
    queueOperation({
      operation: {
        kind: "clone-occurrence",
        request: { occurrenceId: target.occurrenceId, rootId: freshGeographyId(visibleAuthoringProject(), target.kind), externalConnections: "omit" },
      },
    }, rerender);
    return;
  }
  if (!target.libraryId) return;
  queueOperation({
    operation: {
      kind: "clone-design",
      source: { kind: target.kind, id: target.libraryId },
      id: freshGeographyId(visibleAuthoringProject(), target.kind),
      name: `${target.name} 복제`,
    },
  }, rerender);
}

function confirmDelete(target: GeographyDraftTarget, rerender: () => void): void {
  geographyChromeState.deleteOpen = false;
  if (target.occurrenceId) {
    queueOperation({
      operation: { kind: "delete-occurrence", request: { occurrenceId: target.occurrenceId, externalConnections: "reject" } },
    }, rerender);
  } else if (target.libraryId) {
    queueOperation({ operation: { kind: "delete-design", source: { kind: target.kind, id: target.libraryId } } }, rerender);
  }
}

/** 외부 연결 때문에 거부된 delete/refresh 를 remove 정책으로 한 단계만 되돌린다. */
function withRemovedExternal(request: SpatialAuthoringRequest): SpatialAuthoringRequest {
  const operation = request.operation;
  if ((operation.kind === "delete-occurrence" || operation.kind === "refresh") && operation.request.externalConnections === "reject") {
    return { ...request, operation: { ...operation, request: { ...operation.request, externalConnections: "remove" } } };
  }
  return request;
}

function queueOperation(request: SpatialAuthoringRequest, rerender: () => void): void {
  geographyChromeState.pendingExternal = null;
  const edited = editAuthoringDraft((project) => project, request);
  if (edited.kind === "error") {
    note(spatialAuthoringErrorText(edited));
    rerender();
    return;
  }
  const previewed = previewAuthoringDraft();
  if (previewed.kind === "error" && previewed.error.detail?.startsWith("external-connection") && withRemovedExternal(request) !== request) {
    geographyChromeState.pendingExternal = request;
    geographyChromeState.previewError = "외부 연결이 걸려 있습니다 — 「확인」을 누르면 외부 연결을 제거하고 실행합니다";
    rerender();
    return;
  }
  note(spatialAuthoringErrorText(previewed), previewed.kind === "ok" ? "미리보기" : geographyChromeState.saveState);
  rerender();
}

export function geographyDeletePreview(
  card: SpatialGalleryCard | undefined,
  kind: GeographyKind,
): ReturnType<typeof previewGeographyDelete> {
  if (!card) return null;
  return previewGeographyDelete(workingProject(), geographyDraftTarget(card, kind));
}

export { clearAuthoringSession };
