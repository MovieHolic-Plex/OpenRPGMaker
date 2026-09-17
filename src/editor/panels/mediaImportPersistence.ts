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
  if (status.kind === "disabled" && (status.reason === "dev-showcase" || status.reason === "shared-demo")) {
    // Web Storage cannot promise the audio/video file limits. Ask before creating
    // a dedicated Supabase copy, even for small files; never silently pick the
    // deployment's shared project. Cancel/failure leaves source recovery intact.
    const sharedDemo = status.reason === "shared-demo";
    const accepted = await showConfirm({
      title: "미디어를 새 폴더 사본에 저장",
      message: sharedDemo
        ? "공용 예제 원본에는 파일을 추가할 수 없습니다. 현재 화면과 선택한 파일을 새 폴더 프로젝트로 복사할까요? 공용 원본은 바뀌지 않습니다. 취소하면 파일을 가져오지 않습니다."
        : "이 쇼케이스는 미디어 용량을 보장하지 못합니다. 현재 작업과 선택한 파일을 새 폴더 프로젝트로 복사할까요? 기존 온라인 작업을 덮어쓰지 않습니다. 취소하면 파일을 가져오지 않습니다.",
      confirmLabel: "새 폴더 사본에 저장",
      cancelLabel: "취소 · 원본 유지",
    });
    if (!accepted) return false;
    const currentIdentity = store.getProjectIdentity();
    if (store.getCurrent() !== source || identity.kind !== currentIdentity.kind || identity.id !== currentIdentity.id) {
      throw new NewRemoteProjectTransactionError("concurrent-edit", "확인 중 프로젝트가 변경되었습니다. 현재 작업에서 파일을 다시 선택하세요.");
    }
    const candidate = structuredClone(source);
    addMedia(candidate, asset);
    toast("새 폴더에 사본을 만들고 다시 읽어 확인하는 중...", "info");
    const { createProjectFolderWithSeed } = await import("@/editor/projectFolderActions");
    const created = await createProjectFolderWithSeed(source.meta?.title ?? "새 프로젝트", candidate);
    if (!created) throw new NewRemoteProjectTransactionError("configuration", "새 폴더는 데스크톱 앱에서만 만들 수 있습니다. 파일을 다시 선택해 주세요.");
    // 새 폴더가 열렸다 — 문서를 다시 띄워야 그 폴더로 부팅한다.
    window.location.reload();
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
