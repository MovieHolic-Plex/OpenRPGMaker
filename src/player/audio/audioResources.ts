// player/audio/audioResources.ts
// 순수 리소스 해석. resourceId → 재생 가능한 오디오 URL, 그리고 채널/볼륨그룹 분류.
// 이미지 리소스가 playAudio 에 잘못 참조돼도 소리로 재생하지 않도록 media 종류를 검증한다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { AudioChannel } from "@/project/session";
import type { Project } from "@/project/types";

// 오디오로 취급하는 업로드 리소스 kind. 그 외(타일 그림판/그림 등)는 재생 대상이 아니다.
const AUDIO_RESOURCE_KINDS: ReadonlySet<string> = new Set(["music", "sound"]);

// 루프 채널(교체 시 크로스페이드, 세이브 복원 시 재개 대상).
const LOOPING_CHANNELS: ReadonlySet<AudioChannel> = new Set<AudioChannel>(["bgm", "bgs"]);

export type AudioVolumeGroup = "bgm" | "se";

// 루프(배경) 채널인지. bgm/bgs 는 루프, me/se 는 원샷.
export function isLoopingChannel(channel: AudioChannel): boolean {
  return LOOPING_CHANNELS.has(channel);
}

// playAudio 명령의 loop 플래그로 채널을 유도. session.setAudioState 와 동일 규칙.
export function audioChannelForCommand(loop: boolean): AudioChannel {
  return loop ? "bgm" : "se";
}

// 채널별 볼륨 그룹. se 만 SE 그룹, 나머지(bgm/bgs/me)는 BGM(음악) 그룹.
export function volumeGroupForChannel(channel: AudioChannel): AudioVolumeGroup {
  return channel === "se" ? "se" : "bgm";
}

// resourceId 를 실제 재생 URL 로 해석. 없으면 null(무음 no-op 대상).
// 업로드 리소스가 오디오 kind 가 아니면 재생하지 않는다(이미지 오용 방지).
export function resolveAudioSource(
  resourceId: string | undefined,
  project: Pick<Project, "assets">
): string | null {
  if (resourceId === undefined || resourceId.trim().length === 0) return null;
  const uploaded = project.assets?.uploaded?.[resourceId];
  if (uploaded !== undefined && !AUDIO_RESOURCE_KINDS.has(uploaded.kind)) return null;
  return resolveAssetResourceUrl(resourceId, { project });
}
