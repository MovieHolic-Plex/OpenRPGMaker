// project/dialogueDesk.ts
// 「대사」 책상 — 프로젝트에 저장되는 대사 관리 보조 자료.
//
//   voices    화자별 말투 메모. 사람이 자료집 「대사」 탭에서 쓰고, 조수(rewrite_dialogue)는 다듬을 때 이것을 문체 지침으로 읽는다.
//   proposals 조수가 낸 윤문 제안(바꾸기 전·후). 사람이 「대사」 탭에서 한 줄씩 또는 한꺼번에 받거나 버린다.
//             받기 전에는 게임 대사가 바뀌지 않는다. 제안은 원문 해시를 들고 있어, 원문이 그 사이 바뀌었으면 받을 수 없다.
//
// 대사 본문은 이벤트 명령이 정본이다. 여기에는 대사 사본을 두지 않는다(제안의 before 는 검토용 기록일 뿐이다).
// optional 이라 마이그레이션이 필요 없다. 화면·스토어를 모르는 순수 모듈이다(조수 도구 워커도 쓴다).

export interface DialogueSpeakerVoice {
  /** 대사 명령의 speaker 문자열과 같은 이름(공백 정리). */
  readonly speaker: string;
  /** 말투 메모. 예: 「냉정한 심문관. 짧은 평서문, 존댓말 없음, 감탄사 금지.」 */
  readonly note: string;
  readonly updatedAt?: string;
}

export type DialogueProposalSource = "ai" | "human";

export interface DialogueProposal {
  readonly id: string;
  /** 대사 줄 id(dialogueIndex 의 DialogueLine.id). */
  readonly lineId: string;
  /** 제안을 만들 때의 원문 해시. 받을 때 지금 원문과 맞아야 한다. */
  readonly baseHash: string;
  readonly before: string;
  readonly after: string;
  readonly reason?: string;
  /** 같은 요청에서 나온 제안 묶음. */
  readonly batchId?: string;
  /** 제안을 낳은 지시(사람 말 그대로). */
  readonly instruction?: string;
  readonly source: DialogueProposalSource;
  readonly createdAt: string;
}

export interface DialogueDesk {
  voices: DialogueSpeakerVoice[];
  proposals: DialogueProposal[];
}

export const DIALOGUE_VOICE_NOTE_LIMIT = 800;
export const DIALOGUE_PROPOSAL_LIMIT = 400;
const TEXT_LIMIT = 4000;

export function emptyDialogueDesk(): DialogueDesk {
  return { voices: [], proposals: [] };
}

export function normalizeSpeakerName(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function str(value: unknown, limit: number): string | undefined {
  return typeof value === "string" ? value.slice(0, limit) : undefined;
}

/** 저장본의 모르는 값은 버린다. 비면 undefined(필드를 지운다). */
export function normalizeDialogueDesk(value: unknown): DialogueDesk | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const voices: DialogueSpeakerVoice[] = [];
  const seenSpeakers = new Set<string>();
  if (Array.isArray(raw.voices)) {
    for (const entry of raw.voices) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const speaker = typeof record.speaker === "string" ? normalizeSpeakerName(record.speaker) : "";
      const note = str(record.note, DIALOGUE_VOICE_NOTE_LIMIT)?.trim() ?? "";
      if (!speaker || !note || seenSpeakers.has(speaker)) continue;
      seenSpeakers.add(speaker);
      const updatedAt = str(record.updatedAt, 40);
      voices.push({ speaker, note, ...(updatedAt ? { updatedAt } : {}) });
    }
  }
  const proposals: DialogueProposal[] = [];
  const seenLines = new Set<string>();
  if (Array.isArray(raw.proposals)) {
    for (const entry of raw.proposals) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const id = str(record.id, 120);
      const lineId = str(record.lineId, 600);
      const baseHash = str(record.baseHash, 40);
      const before = str(record.before, TEXT_LIMIT);
      const after = str(record.after, TEXT_LIMIT);
      if (!id || !lineId || !baseHash || before === undefined || after === undefined || seenLines.has(lineId)) continue;
      seenLines.add(lineId);
      const reason = str(record.reason, 400);
      const batchId = str(record.batchId, 120);
      const instruction = str(record.instruction, 600);
      proposals.push({
        id, lineId, baseHash, before, after,
        ...(reason ? { reason } : {}),
        ...(batchId ? { batchId } : {}),
        ...(instruction ? { instruction } : {}),
        source: record.source === "human" ? "human" : "ai",
        createdAt: str(record.createdAt, 40) ?? "",
      });
      if (proposals.length >= DIALOGUE_PROPOSAL_LIMIT) break;
    }
  }
  if (voices.length === 0 && proposals.length === 0) return undefined;
  return { voices, proposals };
}

interface DeskHost { dialogueDesk?: DialogueDesk }

export function readDialogueDesk(project: DeskHost): DialogueDesk {
  return project.dialogueDesk ?? emptyDialogueDesk();
}

export function speakerVoiceNote(project: DeskHost, speaker: string): string | undefined {
  const name = normalizeSpeakerName(speaker);
  return readDialogueDesk(project).voices.find((voice) => voice.speaker === name)?.note;
}

/** 말투 메모를 쓰거나(빈 note 면) 지운다. 프로젝트를 제자리에서 고친다(스토어 변경기·도구 초안 안에서 부른다). */
export function writeSpeakerVoice(project: DeskHost, speaker: string, note: string, now = new Date().toISOString()): "set" | "cleared" | "unchanged" {
  const name = normalizeSpeakerName(speaker);
  const text = note.trim().slice(0, DIALOGUE_VOICE_NOTE_LIMIT);
  const desk = readDialogueDesk(project);
  const voices = desk.voices.filter((voice) => voice.speaker !== name);
  const previous = desk.voices.find((voice) => voice.speaker === name);
  if (!text) {
    if (!previous) return "unchanged";
    setDesk(project, { voices, proposals: [...desk.proposals] });
    return "cleared";
  }
  if (previous?.note === text) return "unchanged";
  voices.push({ speaker: name, note: text, updatedAt: now });
  voices.sort((a, b) => a.speaker.localeCompare(b.speaker, "ko"));
  setDesk(project, { voices, proposals: [...desk.proposals] });
  return "set";
}

/** 같은 줄의 기존 제안은 새 제안이 대신한다. */
export function upsertDialogueProposals(project: DeskHost, next: readonly DialogueProposal[]): void {
  const desk = readDialogueDesk(project);
  const replaced = new Set(next.map((proposal) => proposal.lineId));
  const proposals = [...desk.proposals.filter((proposal) => !replaced.has(proposal.lineId)), ...next].slice(-DIALOGUE_PROPOSAL_LIMIT);
  setDesk(project, { voices: [...desk.voices], proposals });
}

export function removeDialogueProposals(project: DeskHost, proposalIds: ReadonlySet<string>): number {
  const desk = readDialogueDesk(project);
  const proposals = desk.proposals.filter((proposal) => !proposalIds.has(proposal.id));
  const removed = desk.proposals.length - proposals.length;
  if (removed > 0) setDesk(project, { voices: [...desk.voices], proposals });
  return removed;
}

// 비어도 키를 지우지 않는다 — store.update 의 copy-on-write 정리(applyCleanedProjection)는 뿌리 키 삭제를
// 전파하지 않는다(openwiki/editor-observability.md). 빈 책상은 저장본 정규화(normalizeDialogueDesk)가 걷어낸다.
function setDesk(project: DeskHost, desk: DialogueDesk): void {
  project.dialogueDesk = desk;
}
