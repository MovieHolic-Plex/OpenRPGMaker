// project/defaults/defaultOpeningSequence.ts
// 새 프로젝트가 기본으로 받는 오프닝 시네마틱과, 오프닝이 아직 없는 기존 프로젝트의 채택.
//
// 왜 기본값인가: 새 게임 제작자에게 «오프닝»은 첫 화면 다음으로 당연히 오는 장면이지만,
// 지금까지는 데이터베이스 → 오프닝 탭에서 프리셋을 직접 눌러야만 존재했다. 이 기본 시퀀스는
// OPENING_PRESETS 의 «왕국의 서막»과 같은 재료(번들 배경화 + 스타터 타이틀 곡 + pan/zoom/fade
// 움직임 + 타이틀 카드)로 완성된 연출을 깔아 준다. 저작자는 오프닝 탭에서 문장만 바꾸거나
// 프리셋으로 통째로 갈아엎으면 되고, 지우면 원래의 «오프닝 없음» 상태로 돌아간다.
//
// 리소스 id 는 전부 builtinGeneratedResourceIds()에 등록된 번들 자산이고, 곡은 레포에
// 파일이 함께 커밋된 스타터 곡이라 CDN 미설정 환경에서도 그림·소리가 모두 나온다.
import { buildOpeningPresetSequence, findOpeningPreset } from "@/editor/openingPresets";
import type { CinematicSequence } from "@/project/types";

/** 기본 오프닝의 뼈대가 되는 프리셋. 프리셋 갤러리의 «왕국의 서막»과 같은 시퀀스다. */
export const DEFAULT_OPENING_PRESET_ID = "kingdom-prologue";

export function defaultOpeningSequence(): CinematicSequence {
  const preset = findOpeningPreset(DEFAULT_OPENING_PRESET_ID);
  if (!preset) throw new Error("기본 오프닝 프리셋을 찾을 수 없습니다: kingdom-prologue");
  // 제목 토큰은 기본 프로젝트 제목으로 채운다. 저작자가 제목을 바꾸면 타이틀 카드는
  // 오프닝 탭에서 다시 쓰는 것이 정확한 계약이다(기본값은 한 번만 만들어진다).
  return buildOpeningPresetSequence(preset, { title: "새 프로젝트" });
}

/**
 * 오프닝이 아직 한 번도 저작되지 않은 프로젝트에만 기본 시퀀스를 채택한다.
 * 정규화기 계약(normalizeCurrentProject)을 따라 실제로 바꿨을 때만 true 를 돌려준다.
 * enabled: false 로 꺼 둔 것도 저작으로 친다 — 저작자가 끈 것을 몰래 다시 켜는 게 아니다.
 */
export function ensureDefaultOpeningSequence(project: { readonly system: { opening?: CinematicSequence } }): boolean {
  if (project.system.opening !== undefined) return false;
  (project.system as { opening?: CinematicSequence }).opening = defaultOpeningSequence();
  return true;
}
