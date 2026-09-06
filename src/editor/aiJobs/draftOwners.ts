import { store } from "@/project/store";
import type { LoadedProjectIdentity } from "@/project/loadedProjectIdentity";
import { sameProjectIdentity } from "@/project/loadedProjectIdentity";
import type { Command } from "@/project/types";
import type { ImageEventOwner } from "@/ai/jobs/imagePayload";
import { canonicalJson, equalJson, ResultConflict } from "@/ai/jobs/resultPatch";
import { sha256HexText } from "@/util/sha256";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";

export interface DraftBinding {
  readonly draftId: string;
  readonly draftRevision: string;
  readonly owner: ImageEventOwner;
}
export interface LiveDraftOwner {
  readonly draftId: string;
  readonly project: LoadedProjectIdentity;
  readonly epoch: number;
  readonly owner: ImageEventOwner;
  readonly isOpen: () => boolean;
  readonly readCommands: () => readonly Command[];
  /** Existing reviewed one-undo list mutation, not generation/tool replay. */
  readonly replaceAll: (commands: readonly Command[]) => void;
}
const owners = new Map<string, LiveDraftOwner>();
export function registerDraftOwner(owner: LiveDraftOwner): () => void {
  const key = canonicalJson([owner.project, owner.draftId, owner.owner]);
  owners.set(key, owner);
  return () => { if (owners.get(key) === owner) owners.delete(key); };
}
export async function captureDraftBinding(owner: LiveDraftOwner): Promise<DraftBinding> {
  const commands = structuredClone(owner.readCommands());
  const draftRevision = await sha256HexText(canonicalJson(commands));
  if (!owner.isOpen() || !equalJson(commands, owner.readCommands())) throw new ResultConflict(["draft-changed"]);
  return { draftId: owner.draftId, draftRevision, owner: owner.owner };
}
export async function resolveDraftOwner(project: LoadedProjectIdentity, binding: DraftBinding, commandPath?: readonly number[], expectedCommand?: unknown): Promise<{ owner: LiveDraftOwner; before: readonly Command[]; check: () => void }> {
  const key = canonicalJson([project, binding.draftId, binding.owner]);
  const owner = owners.get(key);
  if (!owner) throw new ResultConflict(["draft-not-open"]);
  const before = structuredClone(owner.readCommands());
  const check = (): void => {
    const current = owners.get(key);
    if (!current || !current.isOpen() || current.epoch !== store.getProjectEpoch() || !sameProjectIdentity(project, store.getLoadedProjectIdentity())) throw new ResultConflict(["draft-owner-changed"]);
    if (!equalJson(before, current.readCommands())) throw new ResultConflict(["draft-changed"]);
    if (commandPath && !equalJson(resolveCommandAtPath([...before], commandPath), expectedCommand)) throw new ResultConflict(["draft-command-changed"]);
  };
  if (await sha256HexText(canonicalJson(before)) !== binding.draftRevision) throw new ResultConflict(["draft-revision-changed"]);
  check();
  return { owner: { ...owner, replaceAll: commands => { check(); owners.get(key)!.replaceAll(commands); } }, before, check };
}

/** Read-only capture seam for admission; absent/closed owners never authorize a delayed apply. */
export function findDraftOwner(project: LoadedProjectIdentity, draftId: string, owner: ImageEventOwner): LiveDraftOwner | null {
  const live = owners.get(canonicalJson([project, draftId, owner]));
  return live?.isOpen() && live.epoch === store.getProjectEpoch() ? live : null;
}
