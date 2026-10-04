import { isMapDestruction } from "@/ai/approvalPolicy";
import type { PiApplyMode } from "@/ai/piAgent/applyMode";
import type { PiProjectCheckpoint } from "@/ai/piAgent/protocol";
import { changedProjectKeys, restoreCheckpointProject } from "@/ai/piAgent/protocol";
import { mapLossConfirmRequest } from "@/ai/mapDestructionConfirm";
import { applyProposedProject, captureApplyAuthority } from "@/editor/tools/applyChangesetToStore";
import { describeMergeConflicts } from "@/project/projectMerge";
import { adoptSpatialToolProof } from "@/editor/tools/spatialToolState";
import type { Project } from "@/project/types";
import { showConfirm } from "@/editor/ui/modal";
import { createPendingReviewPrompt } from "./aiPendingReview";
import { openWideChangeViewer } from "./aiChangePreview";
import type { PiCommandSurface } from "./aiPiAgentCommand";

/**
 * A single serialized authoring lineage. Never recapture authority from unrelated live edits.
 * 단, 같은 프로젝트 안에서 사람이나 다른 맵의 실행이 그 사이 고친 것은 거절하지 않고 3-way 병합으로 살린다
 * (`rebase` — 겹친 자리는 스토어 값을 남기고 작업 과정에 적는다). 다음 체크포인트의 계보는 병합 결과다.
 */
export function createPiPublication(base: Project, mode: PiApplyMode, surface: PiCommandSurface, presentation?: {
  beforeApply(before: Project, next: Project): Promise<void>;
  afterApply(project: Project): void;
}) {
  let project = base;
  let { base: authority, baseline } = captureApplyAuthority(base);
  let count = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const approveStage = (next: Project, title: string): Promise<void> => new Promise((resolve, reject) => {
    surface.signal?.throwIfAborted();
    const finish = (accepted: boolean) => {
      surface.signal?.removeEventListener("abort", abort);
      prompt.root.remove();
      if (accepted) resolve(); else reject(new Error("단계 적용을 중단했습니다. 이전에 적용한 단계는 유지됩니다."));
    };
    const abort = () => finish(false);
    const prompt = createPendingReviewPrompt({
      apply: () => finish(true), discard: () => finish(false),
      report: () => openWideChangeViewer({ before: project, after: next, mapId: surface.getCurrentMapId() ?? Object.keys(next.maps)[0] ?? "", title, state: "proposed" }),
    });
    prompt.root.querySelector("p")!.textContent = `${title} — 확인하고 적용하면 다음 단계로 진행합니다.`;
    (surface.appendReviewPrompt ?? surface.appendCard)(prompt.root);
    surface.setStatus("단계 적용 대기");
    surface.signal?.addEventListener("abort", abort, { once: true });
  });
  const publish = async (checkpoint: PiProjectCheckpoint): Promise<Project> => {
    surface.signal?.throwIfAborted();
    if (mode === "review") throw new Error("검토 후 적용 모드는 실행 중 변경을 반영하지 않습니다.");
    const next = restoreCheckpointProject(project, checkpoint.project, checkpoint.unchangedKeys, checkpoint.unchangedTilesetIds);
    if (!changedProjectKeys(project, next).length) return project;
    if (mode === "step") await approveStage(next, checkpoint.label);
    const loss = mapLossConfirmRequest(project, next) ?? (isMapDestruction(checkpoint.toolName) ? { title: "맵 전체 청소 확인", message: "맵의 타일을 전부 비웁니다. 계속할까요?", confirmLabel: "전체 청소", cancelNotice: "맵 청소를 취소했습니다." } : null);
    if (loss && mode !== "yolo" && mode !== "auto") {
      const accepted = await showConfirm({ title: loss.title, message: loss.message, confirmLabel: loss.confirmLabel, cancelLabel: "그만두기", danger: true });
      if (!accepted) throw new Error(loss.cancelNotice);
    }
    surface.signal?.throwIfAborted();
    await presentation?.beforeApply(project, next);
    surface.signal?.throwIfAborted();
    adoptSpatialToolProof(next, checkpoint.spatialProof, project);
    const result = await applyProposedProject(next, {
      base: authority, baseline, source: "agent-milestone",
      summary: checkpoint.label, toolNames: [checkpoint.toolName],
      mapDestructionApproved: !!loss || mode === "yolo" || mode === "auto",
      skipSnapshot: mode !== "step" && count > 0,
      snapshotLabel: `AI ${checkpoint.label}`, snapshotMapId: surface.getCurrentMapId(),
      rebase: { lineage: project },
      ...(surface.focus ? { focus: surface.focus } : {}),
      onApplied: applied => {
        project = applied.commitProject ?? applied.applied;
        // Invoked at the actual mutation boundary, before subscribers can edit the store.
        ({ base: authority, baseline } = captureApplyAuthority(project));
        count++;
      },
    });
    if (!result.ok) throw new Error(`적용 실패(${result.reason}): ${result.issue ?? "무결성 오류"}`);
    if (result.merge?.conflicts.length) surface.appendProcess?.(`다른 편집과 같은 자리를 바꿔 이미 반영된 쪽을 남겼어요: ${describeMergeConflicts(result.merge)}`);
    presentation?.afterApply(project);
    surface.setStatus("실제 맵에 반영하며 작업 중…");
    return project;
  };
  return {
    get project() { return project; },
    get count() { return count; },
    get authority() { return authority; },
    get baseline() { return baseline; },
    publish(checkpoint: PiProjectCheckpoint): Promise<Project> {
      const next = queue.then(() => publish(checkpoint));
      // 거부된 발행 하나가 줄을 막지 않게 한다. `queue = next` 였을 때는 한 번 거부되면 뒤의 모든 발행이
      // 같은 거부로 끝났다(2026-09-24 갤러리 호러 r4: set_life_flower 의 적용 검증 거부 뒤 set_title_screen·
      // set_opening·rename_switch… 전부가 그 도구의 「commonEvents[0]… color」 오류로 거부됐다 — 런타임은 되돌렸는데도).
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
