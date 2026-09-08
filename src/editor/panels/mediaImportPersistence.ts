import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { showConfirm } from "@/editor/ui/modal";
import { NewRemoteProjectTransactionError, store } from "@/project/store";
import type { Project, ResourceKind, UploadedAsset } from "@/project/types";
import { toast } from "@/util/toast";

type MediaImportAsset = UploadedAsset & { readonly kind: ResourceKind };

function addMedia(project: Project, asset: MediaImportAsset): void {
  project.assets.uploaded[asset.id] = asset;
  project.resourceProfiles.push({ kind: asset.kind, name: asset.name, assetId: asset.id });
}

/** Accepted media must belong to a durable backend, never a pending FileReader edit. */
export async function persistMediaImport(asset: MediaImportAsset): Promise<boolean> {
  const source = store.getCurrent();
  const identity = store.getProjectIdentity();
  const status = store.getDbPersistenceStatus();
  if (status.kind === "disabled" && status.reason === "dev-showcase") {
    // Web Storage cannot promise the audio/video file limits. Ask before creating
    // a dedicated Supabase copy, even for small files; never silently pick the
    // deployment's shared project. Cancel/failure leaves source recovery intact.
    const accepted = await showConfirm({
      title: "미디어를 새 온라인 사본에 저장",
      message: "이 쇼케이스의 브라우저 저장소는 미디어 용량을 보장하지 못합니다. 현재 작업과 선택한 파일을 새 Supabase 프로젝트로 복사하고, 저장본을 다시 읽어 확인한 뒤 전환할까요? 기존 온라인 작업을 덮어쓰지 않으며 브라우저 원본도 유지됩니다. 취소하면 파일을 가져오지 않습니다.",
      confirmLabel: "새 온라인 사본에 저장",
      cancelLabel: "취소 · 원본 유지",
    });
    if (!accepted) return false;
    const currentIdentity = store.getProjectIdentity();
    if (store.getCurrent() !== source || identity.kind !== currentIdentity.kind || identity.id !== currentIdentity.id) {
      throw new NewRemoteProjectTransactionError("concurrent-edit", "확인 중 프로젝트가 변경되었습니다. 현재 작업에서 파일을 다시 선택하세요.");
    }
    const candidate = structuredClone(source);
    addMedia(candidate, asset);
    toast("새 온라인 사본을 저장하고 다시 읽어 확인하는 중...", "info");
    await store.loadNewRemoteProjectTransactionally(candidate, { source: "dev-showcase" });
    return true;
  }

  if (!store.isLoaded() || !store.isRemotePersistenceEnabled()) {
    throw new NewRemoteProjectTransactionError("configuration", "온라인 저장 연결을 확인한 뒤 파일을 다시 선택하세요.");
  }
  if (asset.kind === "music" || asset.kind === "sound") recordProjectSnapshot("음원 가져오기");
  store.update(project => addMedia(project, asset), { scope: "assets", origin: "human", label: "미디어 가져오기" });
  toast("가져온 미디어를 온라인에 저장하는 중...", "info");
  let saved;
  try {
    saved = await store.flush();
  } catch (error) {
    throw new NewRemoteProjectTransactionError("save", "미디어가 아직 저장되지 않았습니다. 작업을 닫지 말고 연결을 복구한 뒤 프로젝트를 다시 저장하세요.", error);
  }
  const currentIdentity = store.getProjectIdentity();
  if (identity.kind !== currentIdentity.kind || identity.id !== currentIdentity.id) return false;
  if (saved.kind !== "saved") {
    throw new NewRemoteProjectTransactionError("save", "미디어 저장을 확인하지 못했습니다. 현재 작업은 닫지 말고 연결 또는 저장 충돌을 해결한 뒤 프로젝트를 다시 저장하세요.");
  }
  return store.getCurrent().assets.uploaded[asset.id]?.dataUrl === asset.dataUrl;
}
