import { store } from "@/project/store";

export function resourceDisplayName(resourceId: string | undefined, fallback: string): string {
  if (!resourceId) return fallback;
  const profile = store.getCurrent().resourceProfiles.find((entry) => entry.assetId === resourceId);
  const name = profile?.name.trim();
  return name && name.length > 0 ? name : fallback;
}

/** 엔진에 들어 있는 공용 음원(CC0 카탈로그·EasyRPG RTP) id. 플레이어에게 보일 이름이 아니다. */
const BUNDLED_AUDIO_ID = /^(cc0|easyrpg)-/u;

/**
 * 「지금 흐르는 곡」 배너 글자. 저자가 붙인 이름이 있으면 그 이름, 저자가 올린 음원이면 그 id,
 * 공용 음원인데 이름이 없으면 undefined(배너를 띄우지 않는다).
 * 폴른 스타 출하본에서 대사창 위에 「cc0-bgm-rtp-emo-002」 가 그대로 보였다(2026-11-08 QA V049·D024).
 */
export function audioIndicatorText(resourceId: string | undefined): string | undefined {
  const id = resourceId?.trim();
  if (!id) return undefined;
  const named = resourceDisplayName(id, "");
  if (named) return named;
  return BUNDLED_AUDIO_ID.test(id) ? undefined : id;
}

/** 루프 음원 배너를 띄운다. 보일 이름이 없으면 이전 곡의 배너도 걷는다(지금 곡과 다른 글자가 남지 않게). */
export function showAudioIndicator(
  scene: { showRuntimeOverlay(testId: string, text: string): void; clearRuntimeOverlay(testId: string): void },
  resourceId: string | undefined,
): void {
  const label = audioIndicatorText(resourceId);
  if (label) scene.showRuntimeOverlay("audio-indicator", label);
  else scene.clearRuntimeOverlay("audio-indicator");
}
