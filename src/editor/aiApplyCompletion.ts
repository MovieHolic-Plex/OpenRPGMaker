import { getMapEditHistoryEntries } from "@/editor/mapEditHistory";
import type { TileSelection } from "@/editor/editorState";
import type { MapId } from "@/project/types";

export interface AiApplyCompletionContext {
  readonly id: number;
  readonly mapId: MapId;
  readonly selection: TileSelection | null;
  readonly instruction: string;
  readonly summary: string;
  /** 적용 직전에 만들어진 undo 체크포인트. 현재 top과 같을 때만 되돌릴 수 있다. */
  readonly historyAt: number | null;
}

export interface PublishAiApplyCompletionInput {
  readonly mapId: MapId;
  readonly selection?: TileSelection | null;
  readonly instruction: string;
  readonly summary: string;
}

type Listener = (context: AiApplyCompletionContext | null) => void;

let current: AiApplyCompletionContext | null = null;
let sequence = 0;
const listeners = new Set<Listener>();

export function getAiApplyCompletion(): AiApplyCompletionContext | null {
  return current;
}

export function publishAiApplyCompletion(input: PublishAiApplyCompletionInput): AiApplyCompletionContext {
  const top = getMapEditHistoryEntries()[0];
  const context: AiApplyCompletionContext = {
    id: ++sequence,
    mapId: input.mapId,
    selection: input.selection ? { ...input.selection } : null,
    instruction: input.instruction.trim(),
    summary: input.summary.trim(),
    historyAt: top?.at ?? null,
  };
  current = context;
  emit();
  return context;
}

export function subscribeAiApplyCompletion(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

/** expected가 현재 객체/ID와 일치할 때만 지운다. 새 적용 결과를 오래된 UI가 지우지 못하게 한다. */
export function clearAiApplyCompletion(
  expected?: AiApplyCompletionContext | number | null,
): boolean {
  if (!current) return false;
  if (expected !== undefined && expected !== null) {
    const expectedId = typeof expected === "number" ? expected : expected.id;
    if (current.id !== expectedId) return false;
  }
  current = null;
  emit();
  return true;
}

export function completionUndoIsCurrent(context: AiApplyCompletionContext): boolean {
  if (context.historyAt === null) return false;
  return getMapEditHistoryEntries()[0]?.at === context.historyAt;
}

function emit(): void {
  for (const listener of listeners) listener(current);
}
