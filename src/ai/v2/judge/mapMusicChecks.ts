// 조수 v2 «맵 음악 다양성» 검사 — 게임에 맵이 여럿인데 곡이 한 가지뿐인가.
//
// 왜(2026-11-09 fs-use-tools, 보상 레인 43판 실측): 맵·전투 곡은 빌더·shipDefaults.fillBattleBgm 이 자동으로 걸어 주고
// recommend_bgm·set_game_audio 를 쓰는 판이 0이었다. 맵 3장 이상인 게임도 곡이 한 가지로 끝나기 쉽다.
// 런타임과 같은 resolveMapBgm 으로 푼다(상속·프로젝트 기본 포함). 집 안 방이 마을 곡을 같이 쓰는 것은 정상이라
// «모든 맵이 달라야 한다»가 아니라 «이벤트가 있는 맵 3장 이상이 곡 1종뿐»일 때만 짚는다. 음악을 직접 요청한 경우는 기존 [게임 검사 음악] 몫이다.
import { resolveMapBgm } from "@/project/mapMusic";
import type { Project } from "@/project/types";
import { isBlankCanvasMap } from "@/project/tilesetBaseline";
import { tagged, type Finding } from "./finding";

const MIN_MUSIC_MAPS = 3;

/** 이벤트가 있는 지은 맵의 곡을 런타임과 같은 방식으로 비교한다. */
export function mapMusicVarietyProblems(project: Project): Finding[] {
  const maps = Object.values(project.maps).filter((m) => (m.events ?? []).length > 0 && !isBlankCanvasMap(m));
  if (maps.length < MIN_MUSIC_MAPS) return [];
  const tracks = new Set<string | undefined>();
  for (const map of maps) {
    const play = resolveMapBgm(project, map.id);
    tracks.add(play.kind === "play" ? play.resourceId : undefined);
    if (tracks.size > 1) return [];
  }
  const [track] = tracks;
  const playback = track === undefined ? "모두 무음이다" : `모두 같은 곡(${track})을 튼다`;
  return [tagged("game", "음악 다양성", `이야기 맵 ${maps.length}장이 ${playback}. recommend_bgm{scene:'town'|'field'|'dungeon', query} 로 곡을 고르고 set_game_audio{role:'maps', mapIds:[…], resourceId} 로 맵 종류마다 다른 곡을 건다(보스전은 role:'boss').`)];
}
