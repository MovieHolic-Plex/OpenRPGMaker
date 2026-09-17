import { isMapDestruction } from "@/ai/approvalPolicy";
import type { PiApplyMode } from "@/ai/piAgent/applyMode";
import type { PiProjectCheckpoint } from "@/ai/piAgent/protocol";
import { changedProjectKeys } from "@/ai/piAgent/protocol";
import { mapLossConfirmRequest } from "@/ai/mapDestructionConfirm";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { adoptSpatialToolProof } from "@/editor/tools/spatialToolState";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import type { Project } from "@/project/types";
import { showConfirm } from "@/editor/ui/modal";
import { createPendingReviewPrompt } from "./aiPendingReview";
import { openWideChangeViewer } from "./aiChangePreview";
import type { PiCommandSurface } from "./aiPiAgentCommand";

/** A single serialized authoring lineage. Never recapture authority from unrelated live edits. */
export function createPiPublication(base: Project, mode: PiApplyMode, surface: PiCommandSurface) {
  let project = base;
  let authority = captureProposalBase(base);
  let baseline = new AuthoredProjectBaseline(base);
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
    const next = checkpoint.project;
    if (!changedProjectKeys(project, next).length) return project;
    if (mode === "step") await approveStage(next, checkpoint.label);
    const loss = mapLossConfirmRequest(project, next) ?? (isMapDestruction(checkpoint.toolName) ? { title: "맵 전체 청소 확인", message: "맵의 타일을 전부 비웁니다. 계속할까요?", confirmLabel: "전체 청소", cancelNotice: "맵 청소를 취소했습니다." } : null);
    if (loss && mode !== "yolo" && mode !== "auto") {
      const accepted = await showConfirm({ title: loss.title, message: loss.message, confirmLabel: loss.confirmLabel, cancelLabel: "그만두기", danger: true });
      if (!accepted) throw new Error(loss.cancelNotice);
    }
    surface.signal?.throwIfAborted();
    adoptSpatialToolProof(next, checkpoint.spatialProof, project);
    const result = await applyProposedProject(next, {
      base: authority, baseline, source: "agent-milestone",
      summary: checkpoint.label, toolNames: [checkpoint.toolName],
      mapDestructionApproved: !!loss || mode === "yolo" || mode === "auto",
      skipSnapshot: mode !== "step" && count > 0,
      snapshotLabel: `AI ${checkpoint.label}`, snapshotMapId: surface.getCurrentMapId(),
      onApplied: applied => {
        project = applied.commitProject ?? applied.applied;
        // Invoked at the actual mutation boundary, before subscribers can edit the store.
        authority = captureProposalBase(project);
        baseline = new AuthoredProjectBaseline(project);
        count++;
      },
    });
    if (!result.ok) throw new Error(`적용 실패(${result.reason}): ${result.issue ?? "무결성 오류"}`);
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
      queue = next;
      return next;
    },
  };
}
