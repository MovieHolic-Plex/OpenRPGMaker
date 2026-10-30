// 효과음 자리 재생 — 프로젝트 자리 표(project.system.seCues, `@/project/seCues`)에 걸린 소리를 낸다.
//
// 계약: 자리에 저작한 소리가 있을 때만 울리고 true. 없으면 아무것도 하지 않고 false — 부르는 쪽은 예전 소리(내장 기본·
// 몬스터 세트·합성)를 그대로 낸다. 그래서 자리 표가 빈 옛 프로젝트는 소리가 바뀌지 않는다.
// 크기는 오디오 엔진의 효과음 채널(설정 메뉴 「효과음」)을 따른다.
import { playAudioCommand } from "@/player/audio";
import { projectSeCue } from "@/project/seCues";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export function playProjectSeCue(cue: string, project: Project = store.getCurrent()): boolean {
  const resourceId = projectSeCue(project, cue);
  if (!resourceId) return false;
  playAudioCommand({ resourceId, loop: false, channel: "se" }, project);
  return true;
}
