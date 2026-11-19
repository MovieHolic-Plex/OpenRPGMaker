import { store } from "@/project/store";
import type { AudioChannel, AudioTrackState } from "@/project/session";
import { audioChannelForCommand } from "@/player/audio/audioResources";

export function resourceDisplayName(resourceId: string | undefined, fallback: string): string {
  if (!resourceId) return fallback;
  const profile = store.getCurrent().resourceProfiles.find((entry) => entry.assetId === resourceId);
  const name = profile?.name.trim();
  return name && name.length > 0 ? name : fallback;
}

/**
 * 「지금 흐르는 곡」 배너 글자. 순서: 저자가 붙인 이름(resourceProfiles) → 올린 음원의 이름(assets.uploaded[id].name).
 * 둘 다 없으면 undefined(배너를 띄우지 않는다) — 리소스 id 는 어떤 경우에도 플레이어에게 보이지 않는다.
 * 폴른 스타 출하본에서 대사창 위에 「cc0-bgm-rtp-emo-002」 가 그대로 보였고(2026-11-08 QA V049·D024),
 * 몬스터 원정 예제에서는 「mx_audio_town」 이 HUD·전투·메뉴에 계속 보였다(terra-autopilot 엔진 갭).
 */
export function audioIndicatorText(resourceId: string | undefined): string | undefined {
  const id = resourceId?.trim();
  if (!id) return undefined;
  const named = resourceDisplayName(id, "");
  if (named) return named;
  const uploadedName = store.getCurrent().assets.uploaded[id]?.name?.trim();
  return uploadedName && uploadedName !== id ? uploadedName : undefined;
}

/** 루프 BGM만 이름을 띄운다. 이름 없는 곡이 시작하면 이전 곡의 배너를 걷는다. */
export function showAudioIndicator(
  scene: { showRuntimeOverlay(testId: string, text: string): void; clearRuntimeOverlay(testId: string): void },
  track: Pick<AudioTrackState, "resourceId" | "loop"> & { channel?: AudioChannel },
): void {
  const channel = track.channel ?? audioChannelForCommand(track.loop);
  if (channel !== "bgm" || !track.loop) return;
  const label = audioIndicatorText(track.resourceId);
  if (label) scene.showRuntimeOverlay("audio-indicator", label);
  else scene.clearRuntimeOverlay("audio-indicator");
}
