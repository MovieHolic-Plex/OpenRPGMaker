// 재생 불가 BGM 참조를 재생 가능한 CC0 곡으로 바꾼다.
//
// 실측 배경(2026-07-26): 번들 EasyRPG RTP 음악 30곡이 전부 `.mid` 이고 브라우저
// HTMLAudioElement 는 MIDI 를 재생하지 못한다. 출하되는 샘플 데모(동결된 JSON 픽스처)의
// battleBgmResourceId 가 `easyrpg-music-battle-1` 이라, 전투에 들어가면 필드 음악이 멈춘 뒤
// **아무 소리도 나지 않았다**(브라우저 실측). 픽스처는 defaultSystem() 변경이 닿지 않는다.
//
// 왜 시스템 슬롯만 고치는가: 전투/기본 BGM 은 "게임 중 갑자기 무음이 된다" 는 확실한 결함이다.
// 반면 맵 전용 BGM 이나 타이틀 곡은 저작자가 특정 곡을 의도해 고른 것이므로 조용히 바꾸지 않고
// projectLint 의 `audio-unplayable` 경고로 알린다 — 판단은 저작자 몫이다.

import { CC0_AUDIO_ASSETS, isBrowserPlayableAudioPath } from "@/assets/cc0AudioAssets";
import { STARTER_BATTLE_BGM_ID, STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import type { Project } from "@/project/types";

/** 번들 레지스트리에서 resourceId 의 파일 경로를 찾는다. 모르는 id 는 null(업로드 리소스 등). */
function bundledAudioPath(resourceId: string | undefined): string | null {
  const id = resourceId?.trim();
  if (!id) return null;
  const cc0 = CC0_AUDIO_ASSETS.find((asset) => asset.id === id);
  if (cc0) return cc0.path;
  const rtp = EASYRPG_RTP_ASSETS.find((asset) => asset.id === id);
  return rtp ? rtp.path : null;
}

/** 번들 자산이면서 브라우저에서 재생할 수 없는 참조인가. 모르는 id 는 false(단정하지 않는다). */
function isUnplayable(resourceId: string | undefined): boolean {
  const path = bundledAudioPath(resourceId);
  return path !== null && !isBrowserPlayableAudioPath(path);
}

export interface AudioRepairResult {
  /** 바뀐 슬롯 이름과 새 값. */
  readonly replaced: readonly { readonly slot: string; readonly from: string; readonly to: string }[];
}

/** 시스템 BGM 슬롯의 재생 불가 참조를 CC0 곡으로 교체한다. project 를 제자리에서 수정한다. */
export function repairUnplayableSystemBgm(project: Project): AudioRepairResult {
  const replaced: { slot: string; from: string; to: string }[] = [];
  const swap = (slot: "battleBgmResourceId" | "defaultBgmResourceId", to: string): void => {
    const from = project.system[slot];
    if (!isUnplayable(from)) return;
    project.system = { ...project.system, [slot]: to };
    replaced.push({ slot, from: from!, to });
  };
  // 교체 대상은 기본 프로젝트와 같은 스타터 곡이다 — 레포에 파일이 있어 CDN 없이도 들린다.
  // (카탈로그의 나머지 280곡은 CDN 에서 오므로 수리 대상으로 쓰면 환경에 따라 또 무음이 된다.)
  swap("battleBgmResourceId", STARTER_BATTLE_BGM_ID);
  swap("defaultBgmResourceId", STARTER_DEFAULT_BGM_ID);
  return { replaced };
}
