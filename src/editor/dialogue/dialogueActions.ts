// editor/dialogue/dialogueActions.ts
// 자료집 「대사」 탭의 쓰기 — 사람 편집·제안 받기/버리기·말투 메모. 전부 store.update 한 번 + 되돌리기 스냅샷 한 번이다.
// 라벨·origin·fields 를 넘겨 편집 감사 로그(openwiki/editor-observability.md)에 남는다.

import { store } from "@/project/store";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { readDialogueDesk, removeDialogueProposals, writeSpeakerVoice, type DialogueProposal } from "@/project/dialogueDesk";
import { applyDialogueEdits, checkDialogueEdit, type DialogueEditVerdict } from "./dialogueEdits";
import { collectDialogueLines } from "./dialogueIndex";

function preview(text: string): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length > 24 ? `${flat.slice(0, 24)}…` : flat;
}

/** 사람이 한 줄을 고친다. 거절이면 스토어를 건드리지 않고 판정을 돌려준다. */
export function editDialogueLine(id: string, hash: string, text: string): DialogueEditVerdict {
  const project = store.getCurrent();
  // 사람 편집은 일부러 길게 쓸 수 있다 — 넘침은 화면 표시로만 알린다.
  const lines = collectDialogueLines(project);
  const verdict = checkDialogueEdit(project, { id, hash, text }, { allowOverflow: true }, lines);
  if (!verdict.ok) return verdict;
  const label = `대사 고치기: ${preview(verdict.after ?? text)}`;
  recordProjectSnapshot(label);
  let applied: DialogueEditVerdict = verdict;
  store.update((draft) => {
    applied = applyDialogueEdits(draft, [{ id, hash, text }], { allowOverflow: true }, lines)[0] ?? verdict;
    // 이 줄에 걸려 있던 제안은 사람이 직접 고쳤으니 낡았다.
    const stale = readDialogueDesk(draft).proposals.filter((proposal) => proposal.lineId === id).map((proposal) => proposal.id);
    if (stale.length) removeDialogueProposals(draft, new Set(stale));
  }, { scope: "project", label, origin: "human", fields: [{ path: id, before: verdict.before, after: verdict.after }] });
  return applied;
}

export interface ProposalOutcome {
  readonly accepted: readonly DialogueProposal[];
  readonly failed: readonly { readonly proposal: DialogueProposal; readonly verdict: DialogueEditVerdict }[];
}

/** 제안을 받는다. 원문이 그 사이 바뀐 제안은 받지 않고 남겨 둔다(사람이 버리거나 조수에게 다시 시킨다). */
export function acceptDialogueProposals(proposalIds: readonly string[]): ProposalOutcome {
  const project = store.getCurrent();
  const wanted = new Set(proposalIds);
  const proposals = readDialogueDesk(project).proposals.filter((proposal) => wanted.has(proposal.id));
  if (proposals.length === 0) return { accepted: [], failed: [] };
  const lines = collectDialogueLines(project);
  const checks = proposals.map((proposal) => ({
    proposal,
    verdict: checkDialogueEdit(project, { id: proposal.lineId, hash: proposal.baseHash, text: proposal.after }, { allowOverflow: true }, lines),
  }));
  const ok = checks.filter((entry) => entry.verdict.ok);
  const failed = checks.filter((entry) => !entry.verdict.ok);
  if (ok.length === 0) return { accepted: [], failed };
  const label = ok.length === 1 ? `대사 제안 받기: ${preview(ok[0]!.proposal.after)}` : `대사 제안 ${ok.length}줄 받기`;
  recordProjectSnapshot(label);
  store.update((draft) => {
    applyDialogueEdits(draft, ok.map(({ proposal }) => ({ id: proposal.lineId, hash: proposal.baseHash, text: proposal.after })), { allowOverflow: true }, lines);
    removeDialogueProposals(draft, new Set(ok.map(({ proposal }) => proposal.id)));
  }, {
    scope: "project",
    label,
    origin: "human",
    fields: ok.slice(0, 40).map(({ proposal }) => ({ path: proposal.lineId, before: proposal.before, after: proposal.after })),
  });
  return { accepted: ok.map((entry) => entry.proposal), failed };
}

export function rejectDialogueProposals(proposalIds: readonly string[]): number {
  const wanted = new Set(proposalIds);
  const count = readDialogueDesk(store.getCurrent()).proposals.filter((proposal) => wanted.has(proposal.id)).length;
  if (count === 0) return 0;
  const label = count === 1 ? "대사 제안 버리기" : `대사 제안 ${count}줄 버리기`;
  recordProjectSnapshot(label);
  store.update((draft) => { removeDialogueProposals(draft, wanted); }, { scope: "project", label, origin: "human" });
  return count;
}

export function setSpeakerVoiceNote(speaker: string, note: string): "set" | "cleared" | "unchanged" {
  let result: "set" | "cleared" | "unchanged" = "unchanged";
  const probe = structuredClone({ dialogueDesk: store.getCurrent().dialogueDesk });
  if (writeSpeakerVoice(probe, speaker, note) === "unchanged") return "unchanged";
  const label = `말투 메모: ${speaker}`;
  recordProjectSnapshot(label);
  store.update((draft) => { result = writeSpeakerVoice(draft, speaker, note); }, { scope: "project", label, origin: "human" });
  return result;
}
