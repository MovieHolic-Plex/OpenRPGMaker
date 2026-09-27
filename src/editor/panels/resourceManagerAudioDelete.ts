import { resourceReferenceMessage } from "@/editor/databaseReferences";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { resetAudioDescriptionOverride } from "@/project/audioDescriptions";
import { store } from "@/project/store";
import type { Project, UploadedAsset } from "@/project/types";
import { toast } from "@/util/toast";

function audioReferenceMessage(project: Project, id: string): string | null {
  const map = Object.values(project.maps).find(item => item.bgm?.resourceId === id);
  if (map) return `'${map.name}' 맵이 이 음원을 사용 중입니다.`;
  const system = project.system;
  const sounds = system.titleScreen?.sounds;
  const systemIds = [
    system.defaultBgmResourceId, system.battleBgmResourceId, system.battleVictoryMeResourceId,
    system.battleDefeatSeResourceId, system.battleEscapeSeResourceId,
    system.titleScreen?.musicResourceId,
    ...(system.titleScreen?.variants ?? []).map((variant) => variant.musicResourceId),
    sounds?.cursorSeResourceId, sounds?.confirmSeResourceId, sounds?.cancelSeResourceId,
  ];
  if (systemIds.includes(id)) return "시스템 설정이 이 음원을 사용 중입니다.";
  if (project.database.battleAnimations.some(animation =>
    animation.timings?.some(timing => timing.soundResourceId === id))) {
    return "전투 애니메이션이 이 음원을 사용 중입니다.";
  }
  if (project.database.terrains?.some(terrain => terrain.footstepSoundResourceId === id)) {
    return "지형 설정이 이 음원을 사용 중입니다.";
  }
  return resourceReferenceMessage(id);
}

export function deleteManagedAudioAsset(asset: UploadedAsset): void {
  const project = store.getCurrent();
  const current = project.assets.uploaded[asset.id];
  if (!current || (current.kind !== "music" && current.kind !== "sound")) return;
  const blocker = audioReferenceMessage(project, current.id);
  if (blocker) {
    toast(blocker, "error");
    return;
  }
  const ref = { kind: current.kind, resourceId: current.id };
  const label = "업로드 음원 삭제";
  recordProjectSnapshot(label);
  store.update(draft => {
    delete draft.assets.uploaded[current.id];
    draft.resourceProfiles = draft.resourceProfiles.filter(profile => profile.assetId !== current.id);
    const next = resetAudioDescriptionOverride(draft.audioDescriptions, ref);
    if (next === undefined) delete draft.audioDescriptions;
    else draft.audioDescriptions = next;
  }, { scope: "project", origin: "human", label });
  toast(`업로드 리소스 삭제됨: ${current.name}`, "ok");
}
